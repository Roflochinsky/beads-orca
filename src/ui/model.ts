import type { Issue, Project, Snapshot } from '../shared.js';

export type IssueGroup = 'ready' | 'active' | 'blocked' | 'closed' | 'deferred' | 'other';
export const issueGroupOrder: IssueGroup[] = ['ready', 'active', 'blocked', 'closed', 'deferred', 'other'];
export type IssueFacets = {
  query: string;
  typeFilter: string;
  priorityFilter: string;
  assigneeFilter: string;
  /** Undefined means all epics; null means verified no epic. */
  epic: string | null | undefined;
  view: IssueGroup | 'all';
  showClosed: boolean;
};

export function portableHostName(project: Project): string {
  if (!project.hostId || project.hostId === 'local') return project.hostName || 'Local';
  return project.hostName && project.hostName !== project.hostId ? project.hostName : '';
}

export function resolveEpicProject(projects: Project[], epic: { projectName: string; hostName: string }):
  { kind: 'matched'; project: Project } | { kind: 'missing' | 'ambiguous' } {
  const matches = projects.filter((project) => project.name === epic.projectName && portableHostName(project) === epic.hostName);
  return matches.length === 1 ? { kind: 'matched', project: matches[0]! } : { kind: matches.length ? 'ambiguous' : 'missing' };
}


export interface IssueModel {
  issues: Issue[];
  byId: Map<string, Issue>;
  epics: Issue[];
  references: Map<string, Array<{ issue: Issue; type: string }>>;
  groupOf(issue: Issue): IssueGroup;
  epicFor(issue: Issue): Issue | undefined;
  matchesEpic(issue: Issue, epic: string | null | undefined): boolean;
  matchesSearch(issue: Issue, search: string): boolean;
}
/** Snapshot-owned indexes. Only parent-child edges establish epic membership. */
export function createIssueModel(snapshot: Snapshot): IssueModel {
  const byId = new Map(snapshot.issues.map((issue) => [issue.id, issue]));
  const searchIndex = new Map(snapshot.issues.map((issue) => [issue.id, [issue.id, issue.title, issue.description, issue.assignee, ...issue.labels].join(' ').toLocaleLowerCase()]));
  const ready = new Set(snapshot.readyIds);
  const blocked = new Set(snapshot.blockedIds);
  const children = new Map<string, string[]>();
  const references = new Map<string, Array<{ issue: Issue; type: string }>>();
  const missingRoots: string[] = [];
  for (const issue of snapshot.issues) {
    for (const dependency of issue.dependencies) {
      const refs = references.get(dependency.id) || [];
      refs.push({ issue, type: dependency.type });
      references.set(dependency.id, refs);
      if (dependency.type !== 'parent-child') continue;
      const list = children.get(dependency.id) || [];
      list.push(issue.id);
      children.set(dependency.id, list);
      if (!byId.has(dependency.id)) missingRoots.push(issue.id);
    }
  }
  const epics = snapshot.issues.filter((issue) => issue.type === 'epic');
  const walk = (roots: string[]): Set<string> => {
    const visited = new Set(roots);
    const queue = [...visited];
    for (let i = 0; i < queue.length; i++) {
      for (const child of children.get(queue[i]!) || []) {
        if (!visited.has(child)) { visited.add(child); queue.push(child); }
      }
    }
    return visited;
  };
  const nearestEpic = new Map(epics.map((epic) => [epic.id, epic]));
  const epicQueue = epics.map((epic) => epic.id);
  for (let index = 0; index < epicQueue.length; index++) {
    const id = epicQueue[index]!;
    for (const child of children.get(id) || []) {
      if (!nearestEpic.has(child)) { nearestEpic.set(child, nearestEpic.get(id)!); epicQueue.push(child); }
    }
  }
  const unknown = walk(missingRoots);
  const subtrees = new Map<string, Set<string>>();
  const groupOf = (issue: Issue): IssueGroup => {
    if (issue.status === 'closed') return 'closed';
    if (issue.status === 'blocked' || blocked.has(issue.id)) return 'blocked';
    if (issue.status === 'deferred') return 'deferred';
    if (issue.status === 'in_progress') return 'active';
    return ready.has(issue.id) ? 'ready' : 'other';
  };
  const epicFor = (issue: Issue): Issue | undefined => nearestEpic.get(issue.id);
  return {
    issues: snapshot.issues, byId, epics, references, groupOf,
    epicFor,
    matchesSearch(issue: Issue, search: string): boolean { return !search || !!searchIndex.get(issue.id)?.includes(search); },
    matchesEpic(issue: Issue, epic: string | null | undefined): boolean {
      if (epic === undefined) return true;
      if (epic === null) return !nearestEpic.has(issue.id) && !unknown.has(issue.id);
      if (byId.get(epic)?.type !== 'epic') return false;
      if (!subtrees.has(epic)) subtrees.set(epic, walk([epic]));
      return subtrees.get(epic)!.has(issue.id);
    },
  };
}


/** Counts are faceted before either the selected view or All's closed toggle. */
export function selectIssues(model: IssueModel, facets: IssueFacets) {
  const search = facets.query.trim().toLocaleLowerCase();
  const counts: Record<IssueGroup | 'all', number> = { all: 0, ready: 0, active: 0, blocked: 0, closed: 0, deferred: 0, other: 0 };
  const visible: Issue[] = [];
  for (const issue of model.issues) {
    if (!model.matchesEpic(issue, facets.epic)
      || (facets.typeFilter && issue.type !== facets.typeFilter)
      || (facets.priorityFilter && String(issue.priority) !== facets.priorityFilter)
      || (facets.assigneeFilter && issue.assignee !== facets.assigneeFilter)
      || !model.matchesSearch(issue, search)) continue;
    const group = model.groupOf(issue);
    counts.all++; counts[group]++;
    if (facets.view !== 'all' ? group === facets.view : facets.showClosed || group !== 'closed') visible.push(issue);
  }
  visible.sort((a, b) => issueGroupOrder.indexOf(model.groupOf(a)) - issueGroupOrder.indexOf(model.groupOf(b)) || a.priority - b.priority || a.id.localeCompare(b.id));
  return { counts, visible };
}

/** Offsets contains a zero followed by the bottom offset of each item. */
export function virtualRange(offsets: readonly number[], scrollTop: number, viewportHeight: number, overscan: number) {
  const count = Math.max(0, offsets.length - 1);
  const find = (position: number) => {
    let low = 0, high = count;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (offsets[middle + 1]! <= position) low = middle + 1; else high = middle;
    }
    return low;
  };
  const start = Math.max(0, find(Math.max(0, scrollTop)) - overscan);
  const end = Math.min(count, find(Math.max(0, scrollTop) + Math.max(0, viewportHeight)) + 1 + overscan);
  return { start, end, before: offsets[start] || 0, after: (offsets[count] || 0) - (offsets[end] || 0) };
}
