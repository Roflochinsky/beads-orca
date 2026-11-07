import type { Issue, RpcRequest } from '../shared.js';
import type { ProductHost, ProjectAccess, ProjectIdentity } from './projects.js';

export type DocumentResult = { path: string; text: string; hash: string };
export type DocumentOpenResult = { path: string; opened: true };
export type DocumentLink = {
  path: string;
  label: string;
  source: 'title' | 'description' | 'notes' | 'acceptance' | 'design';
};

export type FilterCriteria = {
  query: string;
  view: 'all' | 'ready' | 'active' | 'blocked' | 'closed' | 'deferred' | 'other';
  layout: 'board' | 'table';
  typeFilter: string;
  priorityFilter: string;
  assigneeFilter: string;
  showClosed: boolean;
  sortKey: 'status' | 'id' | 'title' | 'priority' | 'relationships' | 'assignee' | 'type' | 'epic' | 'labels' | 'updated';
  sortDirection: 'ascending' | 'descending';
  projectNames: string[];
  hostNames: string[];
};
export type SavedFilter = { id: string; name: string; criteria: FilterCriteria };
export type FilterListResult = { personal: SavedFilter[]; project: SavedFilter[] };
export type ProjectFilterFile = { version: 1; filters: SavedFilter[] };
export type LibraryResults = {
  'documents.list': DocumentLink[];
  'documents.read': DocumentResult;
  'documents.open': DocumentOpenResult;
  'filters.list': FilterListResult;
  'filters.save': SavedFilter;
  'filters.delete': { deleted: boolean };
  'filters.publish': SavedFilter;
};
export type LibraryRequest =
  | { method: 'documents.list'; project: string; input: { id: string } }
  | { method: 'documents.read' | 'documents.open'; project: string; input: { path: string } }
  | { method: 'filters.list'; project?: string }
  | { method: 'filters.save'; input: { scope: 'personal'; filter: SavedFilter } }
  | { method: 'filters.delete'; project?: string; input: { scope: 'personal' | 'project'; id: string } }
  | { method: 'filters.publish'; project: string; input: { filter: SavedFilter } };

const METHODS: Record<string, true> = {
  'documents.list': true, 'documents.read': true, 'documents.open': true,
  'filters.list': true, 'filters.save': true, 'filters.delete': true, 'filters.publish': true,
};

const FILTER_STORAGE_KEY = 'library.filters.v1';
const PROJECT_FILTER_PATH = '.beads-orca/filters.json';
// Leave headroom below Orca's 1 MiB RPC limit for the enclosing message.
const RPC_OUTPUT_LIMIT = 768 * 1024;
// A personal storage value may use 256 KiB; leave room for both filter scopes.
const PROJECT_FILTER_LIMIT = 480 * 1024;

function boundedRpc<T extends object>(value: T, description: string): T {
  if (Buffer.byteLength(JSON.stringify(value), 'utf8') > RPC_OUTPUT_LIMIT) {
    throw new Error(`${description} is too large for Orca's RPC limit; open the file in the editor or reduce the data`);
  }
  return value;
}

function record(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object`);
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim() || value.includes('\0')) throw new Error(`${name} must be a nonempty string`);
  return value;
}

function documentPath(value: unknown): string {
  const path = requiredString(value, 'document path');
  if (!/\.(?:md|markdown)$/iu.test(path)) throw new Error('A Markdown document path is required');
  return path;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], name: string): void {
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) throw new Error(`Unsupported ${name} field: ${key}`);
  }
}

function filterString(value: unknown, name: string, nonempty = false): string {
  if (typeof value !== 'string' || value.includes('\0') || value.length > 65536 || (nonempty && !value.trim())) {
    throw new Error(`${name} must be ${nonempty ? 'a nonempty' : 'a'} string of at most 65536 characters without NUL`);
  }
  return value;
}

function choice<T extends string>(value: unknown, name: string, options: readonly T[]): T {
  if (typeof value !== 'string' || !options.some((option) => option === value)) throw new Error(`Invalid ${name}`);
  return value as T;
}

function filterNames(value: unknown, name: string): string[] {
  if (!Array.isArray(value) || value.length > 100) throw new Error(`${name} must be an array of at most 100 names`);
  return value.map((entry) => filterString(entry, name, true));
}

function savedFilter(value: unknown): SavedFilter {
  const filter = record(value, 'filter');
  exactKeys(filter, ['id', 'name', 'criteria'], 'filter');
  const criteria = record(filter.criteria, 'filter criteria');
  exactKeys(criteria, [
    'query', 'view', 'layout', 'typeFilter', 'priorityFilter', 'assigneeFilter', 'showClosed',
    'sortKey', 'sortDirection', 'projectNames', 'hostNames',
  ], 'filter criteria');
  if (typeof criteria.showClosed !== 'boolean') throw new Error('showClosed must be a boolean');
  return {
    id: filterString(filter.id, 'filter ID', true),
    name: filterString(filter.name, 'filter name', true),
    criteria: {
      query: filterString(criteria.query, 'query'),
      view: choice(criteria.view, 'view', ['all', 'ready', 'active', 'blocked', 'closed', 'deferred', 'other']),
      layout: choice(criteria.layout, 'layout', ['board', 'table']),
      typeFilter: filterString(criteria.typeFilter, 'typeFilter'),
      priorityFilter: filterString(criteria.priorityFilter, 'priorityFilter'),
      assigneeFilter: filterString(criteria.assigneeFilter, 'assigneeFilter'),
      showClosed: criteria.showClosed,
      sortKey: choice(criteria.sortKey, 'sortKey', ['status', 'id', 'title', 'priority', 'relationships', 'assignee', 'type', 'epic', 'labels', 'updated']),
      sortDirection: choice(criteria.sortDirection, 'sortDirection', ['ascending', 'descending']),
      projectNames: filterNames(criteria.projectNames, 'projectNames'),
      hostNames: filterNames(criteria.hostNames, 'hostNames'),
    },
  };
}

function filterArray(value: unknown): SavedFilter[] {
  if (!Array.isArray(value)) throw new Error('Saved filters must be an array');
  const filters = value.map(savedFilter);
  const seen = new Set<string>();
  for (const filter of filters) {
    if (seen.has(filter.id)) throw new Error(`Duplicate saved filter ID: ${filter.id}`);
    seen.add(filter.id);
  }
  return filters;
}

function assertPortableFilter(filter: SavedFilter): void {
  const criteria = filter.criteria;
  const strings = [
    filter.id, filter.name, criteria.query, criteria.typeFilter, criteria.priorityFilter, criteria.assigneeFilter,
    ...criteria.projectNames, ...criteria.hostNames,
  ];
  // This is a guard against common accidental disclosure, not a secret scanner:
  // users must still review the project file before sharing it.
  const privatePath = /(?:^|[\s"'=(,:])(?:~[A-Za-z0-9_.-]*[\\/]|[A-Za-z]:[\\/]|\/(?!\/)|\\\\)\S*/u;
  const credential = /(?:\b(?:password|passwd|passphrase|secret|token|api[_-]?key|authorization|private[_-]?key)\s*[:=]\s*\S+|\bbearer\s+\S+|\b(?:sk-[a-z0-9_-]{8,}|ghp_[a-z0-9_]{16,}|github_pat_[a-z0-9_]{16,}|glpat-[a-z0-9_-]{16,}|xox[baprs]-[a-z0-9-]{10,}|AKIA[A-Z0-9]{16})|-----BEGIN [A-Z ]*PRIVATE KEY-----)/iu;
  if (strings.some((value) => privatePath.test(value) || /\bfile:\/\//iu.test(value) || credential.test(value))) {
    throw new Error('Project filters cannot contain private paths or credentials; review the portable filter');
  }
  if (strings.some((value) => /(?:^|[\s"'=(,])(?:ssh|wsl|runtime|paired):\S+/iu.test(value))
    || [...criteria.projectNames, ...criteria.hostNames].some((name) => /^(?:host|workspace):/iu.test(name))) {
    throw new Error('Project filter scopes must use portable names, not connection or workspace IDs');
  }
}

function inlineLinkTarget(text: string, open: number): { destination: string; end: number } | null {
  let index = open + 1;
  while (index < text.length && /\s/u.test(text[index]!)) index++;
  let destination: string;
  if (text[index] === '<') {
    const start = ++index;
    while (index < text.length && text[index] !== '>' && text[index] !== '\n') {
      index += text[index] === '\\' && index + 1 < text.length ? 2 : 1;
    }
    if (text[index] !== '>') return null;
    destination = text.slice(start, index++);
  } else {
    const start = index;
    let depth = 0;
    while (index < text.length) {
      const char = text[index]!;
      if (char === '\\' && index + 1 < text.length) { index += 2; continue; }
      if (/\s/u.test(char)) break;
      if (char === '(') depth++;
      if (char === ')') {
        if (depth === 0) break;
        depth--;
      }
      index++;
    }
    if (depth !== 0 || index === start) return null;
    destination = text.slice(start, index);
  }
  const afterDestination = index;
  while (index < text.length && /\s/u.test(text[index]!)) index++;
  if (text[index] !== ')') {
    if (index === afterDestination) return null;
    const quote = text[index];
    if (quote !== '"' && quote !== "'" && quote !== '(') return null;
    const close = quote === '(' ? ')' : quote;
    index++;
    while (index < text.length && text[index] !== close) {
      index += text[index] === '\\' && index + 1 < text.length ? 2 : 1;
    }
    if (text[index] !== close) return null;
    index++;
    while (index < text.length && /\s/u.test(text[index]!)) index++;
    if (text[index] !== ')') return null;
  }
  return { destination, end: index + 1 };
}

function linkedDocuments(issue: Issue): DocumentLink[] {
  const result: DocumentLink[] = [];
  const seen = new Set<string>();
  const fields: DocumentLink['source'][] = ['title', 'description', 'notes', 'acceptance', 'design'];
  for (const source of fields) {
    const text = issue[source];
    if (!text) continue;
    const definitions = new Map<string, string>();
    let fence = '';
    let fenceLength = 0;
    const lines = text.split(/\r?\n/u).map((line) => {
      const marker = /^ {0,3}(`{3,}|~{3,})/u.exec(line)?.[1];
      if (fence) {
        if (marker && marker[0] === fence && marker.length >= fenceLength) fence = '';
        return '';
      }
      if (marker) {
        fence = marker[0]!;
        fenceLength = marker.length;
        return '';
      }
      if (/^(?: {4}|\t)/u.test(line)) return '';
      const definition = /^ {0,3}\[([^\]]+)\]:[ \t]*(?:<([^>\r\n]+)>|(\S+))/u.exec(line);
      if (definition) {
        const key = definition[1]!.trim().replace(/\s+/gu, ' ').toLocaleLowerCase();
        if (!definitions.has(key)) definitions.set(key, definition[2] ?? definition[3]!);
        return '';
      }
      return line.replace(/(`+)[^\n]*?\1/gu, '');
    });
    const sourceText = lines.join('\n');
    const brackets = new Map<number, number>();
    const stack: number[] = [];
    for (let index = 0; index < sourceText.length; index++) {
      if (sourceText[index] === '\\') { index++; continue; }
      if (sourceText[index] === '[') stack.push(index);
      else if (sourceText[index] === ']') {
        const open = stack.pop();
        if (open !== undefined) brackets.set(open, index);
      }
    }
    for (let index = 0; index < sourceText.length;) {
      if (sourceText[index] === '\\') { index += 2; continue; }
      if (sourceText[index] !== '[') { index++; continue; }
      const close = brackets.get(index);
      if (close === undefined) { index++; continue; }
      let escapes = 0;
      for (let previous = index - 2; previous >= 0 && sourceText[previous] === '\\'; previous--) escapes++;
      if (sourceText[index - 1] === '!' && escapes % 2 === 0) { index = close + 1; continue; }
      const label = sourceText.slice(index + 1, close).replace(/\\([^\p{L}\p{N}])/gu, '$1');
      let destination: string | undefined;
      const next = close + 1;
      if (sourceText[next] === '(') {
        const target = inlineLinkTarget(sourceText, next);
        index = target?.end ?? next + 1;
        destination = target?.destination;
      } else if (sourceText[next] === '[' && brackets.has(next)) {
        const end = brackets.get(next)!;
        const reference = sourceText.slice(next + 1, end) || label;
        destination = definitions.get(reference.trim().replace(/\s+/gu, ' ').toLocaleLowerCase());
        index = end + 1;
      } else {
        destination = definitions.get(label.trim().replace(/\s+/gu, ' ').toLocaleLowerCase());
        index = next;
      }
      if (!destination) continue;
      const withoutFragment = destination.replace(/\\([^\p{L}\p{N}])/gu, '$1').split(/[?#]/u, 1)[0]!;
      let path: string;
      try { path = decodeURIComponent(withoutFragment); } catch { path = withoutFragment; }
      if (!/\.(?:md|markdown)$/iu.test(path) || seen.has(path)) continue;
      seen.add(path);
      result.push({ path, label, source });
    }
  }
  return result;
}

/** Explicit document access and personal/project saved views. */
export class LibraryService {
  private changes: Promise<void> = Promise.resolve();

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.changes.then(operation);
    this.changes = result.then(() => undefined, () => undefined);
    return result;
  }

  private async personalFilters(): Promise<SavedFilter[]> {
    const response = record(await this.host.host.call('storage.get', { key: FILTER_STORAGE_KEY }), 'storage.get result');
    return response.value === null ? [] : filterArray(response.value);
  }

  private async writePersonalFilters(filters: SavedFilter[]): Promise<void> {
    const response = record(await this.host.host.call('storage.set', { key: FILTER_STORAGE_KEY, value: filters }), 'storage.set result');
    if (response.ok !== true) throw new Error('Could not store personal filters');
  }

  private async projectFilters(projectId: string, expected?: ProjectIdentity): Promise<SavedFilter[]> {
    let text: string;
    try {
      text = (await this.access.readText(projectId, PROJECT_FILTER_PATH, expected)).text;
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return [];
      throw error;
    }
    let parsed: unknown;
    try { parsed = JSON.parse(text) as unknown; }
    catch (error) { throw new Error('Invalid project filter JSON', { cause: error }); }
    const file = record(parsed, 'project filter file');
    exactKeys(file, ['version', 'filters'], 'project filter file');
    if (file.version !== 1) throw new Error('Unsupported project filter file format');
    return filterArray(file.filters);
  }

  private async writeProjectFilters(projectId: string, filters: SavedFilter[], expected: ProjectIdentity, published?: SavedFilter): Promise<void> {
    if (Buffer.byteLength(JSON.stringify(filters), 'utf8') > PROJECT_FILTER_LIMIT) {
      throw new Error('Project filters are too large for the Orca RPC limit; reduce the project filter file');
    }
    for (const filter of filters) assertPortableFilter(filter);
    const projects = await this.access.list();
    if (published) {
      const projectNames = new Set(projects.map((project) => project.name));
      const hostNames = new Set(projects.map((project) => project.hostName || (project.hostId == null || project.hostId === 'local' ? 'Local' : '')));
      if (published.criteria.projectNames.some((name) => !projectNames.has(name))
        || published.criteria.hostNames.some((name) => !hostNames.has(name))) {
        throw new Error('Project filter scope must use registered portable project and host display names');
      }
    }
    const privateIds = projects.flatMap((project) => [
      project.id === project.name ? '' : project.id,
      project.workspaceId === project.name ? '' : project.workspaceId,
      project.hostId === 'local' ? '' : project.hostId,
    ]).filter((id): id is string => typeof id === 'string' && id.length > 0);
    for (const filter of filters) {
      const values = [
        filter.id, filter.name, filter.criteria.query, filter.criteria.typeFilter,
        filter.criteria.priorityFilter, filter.criteria.assigneeFilter,
        ...filter.criteria.projectNames, ...filter.criteria.hostNames,
      ];
      if (values.some((value) => privateIds.some((id) => value === id || (id.length >= 6 && value.includes(id))))) {
        throw new Error('Project filters cannot contain private workspace or connection IDs');
      }
    }
    await this.access.writeText(projectId, PROJECT_FILTER_PATH, `${JSON.stringify({ version: 1, filters }, null, 2)}\n`, expected);
  }

  constructor(private readonly host: ProductHost, private readonly access: ProjectAccess) {}

  handles(method: string): boolean { return Object.hasOwn(METHODS, method); }

  async readDocument(projectId: string, path: string): Promise<DocumentResult> {
    return this.access.readText(requiredString(projectId, 'project ID'), documentPath(path));
  }

  private async openDocument(projectId: string, path: string): Promise<DocumentOpenResult> {
    const project = await this.access.captureIdentity(projectId);
    if (!project.workspaceId) throw new Error('This project has no registered Orca workspace to open the document in');
    const localHost = (host: unknown): unknown => host === null || host === undefined || host === 'local' ? 'local' : host;
    const result = await this.access.inspectFile(projectId, documentPath(path), project);
    const current = await this.access.captureIdentity(projectId);
    if (current.fingerprint !== project.fingerprint || current.workspaceId !== project.workspaceId
      || current.path !== project.path || localHost(current.hostId) !== localHost(project.hostId)) {
      throw new Error('The project workspace changed while validating the document');
    }
    const response = record(await this.host.host.call('workspace.list'), 'workspace.list result');
    const workspaces = response.workspaces;
    if (!Array.isArray(workspaces) || !workspaces.some((value: unknown) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
      const workspace = value as Record<string, unknown>;
      return workspace.id === project.workspaceId && workspace.path === project.path
        && localHost(workspace.hostId) === localHost(project.hostId);
    })) {
      throw new Error('The project no longer matches a registered Orca workspace');
    }
    const opened = record(await this.host.host.call('editor.open', { workspaceId: project.workspaceId, path: result.path }), 'editor.open result');
    if (opened.opened !== true) throw new Error('The Orca editor did not open the document');
    return { path: result.path, opened: true };
  }

  async request(request: RpcRequest): Promise<unknown> {
    if (!this.handles(request.method)) throw new Error(`Unsupported library method: ${request.method}`);
    const input = request.input === undefined ? {} : record(request.input, 'input');
    switch (request.method) {
      case 'documents.list': {
        const project = requiredString(request.project, 'project ID');
        const id = requiredString(input.id, 'issue ID');
        const issue = await this.access.request({ method: 'issue', project, input: { id } }) as Issue;
        return boundedRpc(linkedDocuments(issue), 'Document links');
      }
      case 'documents.read':
        return boundedRpc(await this.readDocument(requiredString(request.project, 'project ID'), documentPath(input.path)), 'Document');
      case 'documents.open':
        return this.openDocument(requiredString(request.project, 'project ID'), documentPath(input.path));
      case 'filters.list':
        await this.changes;
        return boundedRpc({
          personal: await this.personalFilters(),
          project: request.project === undefined ? [] : await this.projectFilters(requiredString(request.project, 'project ID')),
        } satisfies FilterListResult, 'Saved filters');
      case 'filters.save': {
        if (input.scope !== 'personal') throw new Error('filters.save requires personal scope; publish project filters explicitly');
        const filter = savedFilter(input.filter);
        boundedRpc(filter, 'Saved filter');
        return this.serialize(async () => {
          const filters = await this.personalFilters();
          const index = filters.findIndex((entry) => entry.id === filter.id);
          if (index < 0) filters.push(filter);
          else filters[index] = filter;
          await this.writePersonalFilters(filters);
          return filter;
        });
      }
      case 'filters.publish': {
        const project = requiredString(request.project, 'project ID');
        const filter = savedFilter(input.filter);
        boundedRpc(filter, 'Saved filter');
        assertPortableFilter(filter);
        return this.serialize(async () => {
          const expected = await this.access.captureIdentity(project);
          const filters = await this.projectFilters(project, expected);
          const index = filters.findIndex((entry) => entry.id === filter.id);
          if (index < 0) filters.push(filter);
          else filters[index] = filter;
          await this.writeProjectFilters(project, filters, expected, filter);
          return filter;
        });
      }
      case 'filters.delete': {
        const scope = choice(input.scope, 'filter scope', ['personal', 'project']);
        const id = requiredString(input.id, 'filter ID');
        const project = scope === 'project' ? requiredString(request.project, 'project ID') : '';
        return this.serialize(async () => {
          const expected = scope === 'project' ? await this.access.captureIdentity(project) : undefined;
          const filters = scope === 'personal' ? await this.personalFilters() : await this.projectFilters(project, expected);
          const index = filters.findIndex((entry) => entry.id === id);
          if (index < 0) return { deleted: false };
          filters.splice(index, 1);
          if (scope === 'personal') await this.writePersonalFilters(filters);
          else await this.writeProjectFilters(project, filters, expected!);
          return { deleted: true };
        });
      }
      default:
        throw new Error(`Unsupported library method: ${request.method}`);
    }
  }
}
