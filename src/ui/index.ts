import type { Issue, Project, Snapshot, Transport } from '../shared.js';
import { icon } from './icons.js';
import { createProductUI } from './product.js';

type Group = 'ready' | 'active' | 'blocked' | 'closed' | 'deferred' | 'other';
type Draft = { title: string; description: string; type: string; priority: string; assignee: string; labels: string };
type EditValues = { title: string; description: string; priority: string; assignee: string; notes: string; acceptance: string; design: string };
type EditDraft = { baseline: EditValues; values: EditValues };
type Comment = { author: string; text: string; created_at: string };
type SortKey = 'status' | 'id' | 'title' | 'priority' | 'relationships' | 'assignee' | 'type' | 'epic' | 'labels' | 'updated';

const groupNames: Record<Group, string> = {
  ready: 'Ready', active: 'In progress', blocked: 'Blocked', closed: 'Closed', deferred: 'Deferred', other: 'Other',
};
const groupOrder: Group[] = ['ready', 'active', 'blocked', 'closed', 'deferred', 'other'];
const types = ['task', 'bug', 'feature', 'chore', 'epic', 'decision', 'spike', 'story', 'milestone'];
const typeIcons: Record<string, string> = {
  task: 'task_alt', bug: 'bug_report', feature: 'lightbulb', chore: 'handyman', epic: 'stacks',
  decision: 'gavel', spike: 'science', story: 'auto_stories', milestone: 'flag',
};
const editFields: Array<keyof EditValues> = ['title', 'description', 'priority', 'assignee', 'notes', 'acceptance', 'design'];
const cleanups = new WeakMap<HTMLElement, () => void>();
const emptyDraft = (): Draft => ({ title: '', description: '', type: 'task', priority: '2', assignee: '', labels: '' });
const escapeHtml = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
const shell = (value: string): string => `'${value.replace(/'/g, `'\\''`)}'`;
const textError = (error: unknown): string => error instanceof Error ? error.message : String(error);
const selected = (a: string, b: string): string => a === b ? ' selected' : '';
const pressed = (yes: boolean): string => String(yes);
const bead = (group: Group): string => `<span class="bead${group === 'active' ? ' bead--active' : group === 'closed' ? ' bead--done' : ''}" aria-hidden="true"></span>`;
const priority = (issue: Issue): string => `<span class="chip chip--priority chip--p${escapeHtml(issue.priority)}">P${escapeHtml(issue.priority)}</span>`;

function relativeTime(value: string): string {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - time) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}

function createCommand(draft: Draft): string {
  const args = ['bd', '--json', '--no-color', 'create', '--repo=.', `--title=${shell(draft.title.trim())}`];
  if (draft.description.trim()) args.push(`--description=${shell(draft.description.trim())}`);
  args.push(`--type=${shell(draft.type)}`, `--priority=${shell(draft.priority)}`);
  if (draft.assignee.trim()) args.push(`--assignee=${shell(draft.assignee.trim())}`);
  const labels = draft.labels.split(',').map((label) => label.trim()).filter(Boolean);
  if (labels.length) args.push(`--labels=${shell(labels.map((label) => `"${label.replaceAll('"', '""')}"`).join(','))}`);
  return args.join(' ');
}

function editValues(issue: Issue): EditValues {
  return {
    title: issue.title, description: issue.description, priority: String(issue.priority), assignee: issue.assignee,
    notes: issue.notes ?? '', acceptance: issue.acceptance ?? '', design: issue.design ?? '',
  };
}

function changedFields(draft: EditDraft): Record<string, unknown> {
  const changes: Record<string, unknown> = {};
  for (const field of editFields) {
    const value = field === 'title' ? draft.values[field].trim() : draft.values[field];
    if (value !== draft.baseline[field]) changes[field] = field === 'priority' ? Number(value) : value;
  }
  return changes;
}

function updateCommand(id: string, changes: Record<string, unknown>): string {
  const flags = editFields.filter((field) => Object.hasOwn(changes, field)).map((field) => `--${field}=${shell(String(changes[field]))}`);
  return flags.length ? ['bd', '--json', '--no-color', 'update', ...flags, '--', shell(id)].join(' ') : 'No changes to save';
}

function actionCommand(method: string, id: string, dependsOn = '', type = 'blocks'): string {
  const issue = shell(id);
  switch (method) {
    case 'claim': return `bd --json --no-color update --claim -- ${issue}`;
    case 'close': return `bd --json --no-color close -- ${issue}`;
    case 'reopen': return `bd --json --no-color reopen -- ${issue}`;
    case 'reclaim': return `bd --json --no-color reclaim --id=${issue}`;
    case 'link': return `bd --json --no-color dep add --type=${shell(type)} -- ${issue} ${shell(dependsOn)}`;
    case 'unlink': return `bd --json --no-color dep remove -- ${issue} ${shell(dependsOn)}`;
    default: return `bd --json --no-color --readonly show --brief-deps --id=${issue}`;
  }
}

/** Mount the live Orca Beads board into a panel-owned element. */
export function mount(root: HTMLElement, transport: Transport): void {
  cleanups.get(root)?.();
  let projects: Project[] = [];
  let projectId = '';
  let snapshot: Snapshot | null = null;
  let issueIndex = new Map<string, Issue>();
  let readyIds = new Set<string>();
  let blockedIds = new Set<string>();
  let filteredCache: Issue[] | null = null;
  let loadingProjects = true;
  let loadingSnapshot = false;
  let connectionLost = false;
  let loadError = '';
  let loadErrorSource: 'projects' | 'snapshot' = 'snapshot';
  let actionError = '';
  let pending = false;
  let disposed = false;
  let projectPickerOpen = false;
  let productReturn: 'handoff' | 'workflows' = 'workflows';
  let rendering = false;
  let refreshTask: Promise<void> | null = null;
  let detailSequence = 0;
  let detail: Issue | null = null;
  let detailLoading = false;
  let detailError = '';
  let selectedId = '';
  let view: Group | 'all' = 'all';
  let layout: 'board' | 'table' = 'board';
  let query = '';
  let typeFilter = '';
  let priorityFilter = '';
  let assigneeFilter = '';
  let showClosed = true;
  let filtersExpanded = false;
  let scope: { projectNames: string[]; hostNames: string[] } | null = null;
  let createOpen = false;
  let draft = emptyDraft();
  let dependencyId = '';
  let dependencyType = 'blocks';
  let sortKey: SortKey = 'status';
  let sortDirection: 'ascending' | 'descending' = 'ascending';
  let spotlightOn = true;
  let hoverId = '';
  let focusId = '';
  let drag: { id: string; project: string } | null = null;
  const taskPool = new Map<string, { project: string; id: string; title: string }>();
  const editDrafts = new Map<string, EditDraft>();
  const commentDrafts = new Map<string, string>();
  let comments: Comment[] = [];
  let commentsLoading = false;
  let commentsError = '';
  let commentsSequence = 0;
  let undoClose: { project: string; id: string; updatedAt: string; closedAt?: string } | null = null;
  let projectLoadTask: Promise<void> | null = null;
  let snapshotGeneration = 0;
  let projectsReloadPending = false;
  function portableHostName(project: Project): string {
    if (!project.hostId || project.hostId === 'local') return project.hostName || 'Local';
    return project.hostName && project.hostName !== project.hostId ? project.hostName : '';
  }
  function inScope(project: Project, criteria: { projectNames: string[]; hostNames: string[] } | null): boolean {
    return !criteria || ((!criteria.projectNames.length || criteria.projectNames.includes(project.name))
      && (!criteria.hostNames.length || criteria.hostNames.includes(portableHostName(project))));
  }
  const product = createProductUI({
    root, transport,
    projects: () => projects,
    projectId: () => projectId,
    issueId: () => selectedId,
    currentUnavailable: () => offline(),
    projectAvailability,
    snapshot: () => snapshot,
    pool: () => [...taskPool.values()],
    addTask: (item) => { taskPool.set(`${item.project}\0${item.id}`, item); },
    removeTask: (project, id) => { taskPool.delete(`${project}\0${id}`); },
    criteria: () => {
      const project = projects.find((item) => item.id === projectId);
      return { query, view, layout, typeFilter, priorityFilter, assigneeFilter, showClosed, sortKey, sortDirection,
        projectNames: scope ? [...scope.projectNames] : project ? [project.name] : [],
        hostNames: scope ? [...scope.hostNames] : project && portableHostName(project) ? [portableHostName(project)] : [] };
    },
    applyCriteria: (criteria) => {
      const match = projects.find((project) => project.id === projectId && inScope(project, criteria))
        || projects.find((project) => inScope(project, criteria));
      if ((criteria.projectNames.length || criteria.hostNames.length) && !match) { actionError = 'No available project matches this filter scope.'; return; }
      scope = { projectNames: [...criteria.projectNames], hostNames: [...criteria.hostNames] };
      query = criteria.query; view = criteria.view; layout = criteria.layout; typeFilter = criteria.typeFilter;
      priorityFilter = criteria.priorityFilter; assigneeFilter = criteria.assigneeFilter; showClosed = criteria.showClosed;
      sortKey = criteria.sortKey; sortDirection = criteria.sortDirection;
      if (match && match.id !== projectId) selectProject(match.id, false); else render();
    },
    selectProject: (id) => selectProject(id, false),
    reloadProjects: () => { void loadProjects(); },
    render,
  });

  const groupOf = (issue: Issue): Group => {
    if (issue.status === 'closed') return 'closed';
    if (issue.status === 'blocked' || blockedIds.has(issue.id)) return 'blocked';
    if (issue.status === 'deferred') return 'deferred';
    if (issue.status === 'in_progress') return 'active';
    if (readyIds.has(issue.id)) return 'ready';
    return 'other';
  };
  const allIssues = (): Issue[] => snapshot?.issues ?? [];
  const byId = (id: string): Issue | undefined => issueIndex.get(id);
  const relationships = (issue: Issue): string => issue.dependencies.map((dep) => `${dep.type}: ${dep.id}`).join(', ');
  const filtered = (): Issue[] => {
    const search = query.trim().toLocaleLowerCase();
    return filteredCache ??= allIssues().filter((issue) => {
      const group = groupOf(issue);
      if (!showClosed && group === 'closed') return false;
      if (view !== 'all' && group !== view) return false;
      if (typeFilter && issue.type !== typeFilter) return false;
      if (priorityFilter && String(issue.priority) !== priorityFilter) return false;
      if (assigneeFilter && issue.assignee !== assigneeFilter) return false;
      return !search || [issue.id, issue.title, issue.description, issue.assignee, ...issue.labels].join(' ').toLocaleLowerCase().includes(search);
    }).sort((a, b) => groupOrder.indexOf(groupOf(a)) - groupOrder.indexOf(groupOf(b)) || a.priority - b.priority || a.id.localeCompare(b.id));
  };
  const count = (group: Group): number => allIssues().filter((issue) => groupOf(issue) === group).length;
  const currentIssue = (): Issue | undefined => detail?.id === selectedId ? detail : byId(selectedId);
  const disabled = (): string => pending ? ' disabled' : '';
  const offline = (): boolean => connectionLost || !snapshot || !!snapshot.offline || snapshot.project.availability === 'offline' || snapshot.project.availability === 'unsupported';

  function projectBasename(project: Project): string {
    return project.path.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || project.name;
  }
  function projectAvailability(project: Project): string {
    if (project.id === projectId) {
      if (loadingSnapshot || loadingProjects) return snapshot ? offline() ? 'Refreshing · stale' : 'Refreshing' : 'Loading';
      if (loadError || connectionLost) return snapshot ? 'Stale' : 'Unavailable';
      if (snapshot?.offline || snapshot?.project.availability === 'offline') return 'Offline · stale';
      if (snapshot?.project.availability === 'unsupported') return 'Unsupported';
      if (snapshot) return 'Online';
    }
    switch (project.availability) {
      case 'online': return 'Last checked online';
      case 'offline': return 'Offline';
      case 'unsupported': return 'Unsupported';
      default: return 'Not checked';
    }
  }
  function projectSelect(): string {
    const project = projects.find((item) => item.id === projectId);
    const identities = new Map<string, number>();
    for (const item of projects) {
      const key = JSON.stringify([item.name, item.path, item.hostId || 'local']);
      identities.set(key, (identities.get(key) || 0) + 1);
    }
    const choices = projects.map((item) => {
      const key = JSON.stringify([item.name, item.path, item.hostId || 'local']);
      const identity = (identities.get(key) || 0) > 1 ? ` · Workspace ID: ${item.workspaceId || item.id}` : '';
      return `<button type="button" class="project-picker__option" data-action="choose-project" data-id="${escapeHtml(item.id)}" aria-current="${item.id === projectId ? 'true' : 'false'}"${inScope(item, scope) ? '' : ' disabled'}><span class="project-picker__option-title">${escapeHtml(projectBasename(item))}${item.current ? ' <span class="project-picker__current">Current workspace</span>' : ''}</span><span class="project-picker__meta">${escapeHtml(item.workspaceId ? `Workspace: ${item.name}` : 'Additional project path')} · ${escapeHtml(item.hostName || item.hostId || 'Local')} · ${escapeHtml(projectAvailability(item))}${escapeHtml(identity)}</span><span class="project-picker__path">${escapeHtml(item.path)}</span></button>`;
    }).join('');
    return `<div class="project-picker"><button class="project-picker__trigger" type="button" data-action="toggle-project-picker" data-focus="project-picker" aria-label="${escapeHtml(project ? `Choose project, selected ${projectBasename(project)}, ${project.workspaceId ? `workspace ${project.name}` : 'additional path'}, ${project.hostName || project.hostId || 'Local'}, ${project.path}` : 'Choose project')}"${project ? ` title="${escapeHtml(project.path)}"` : ''} aria-expanded="${pressed(projectPickerOpen)}" aria-controls="project-picker-options"${pending || !projects.length ? ' disabled' : ''}><span class="project-picker__trigger-text"><strong>${escapeHtml(project ? projectBasename(project) : loadingProjects ? 'Loading projects…' : 'No project')}</strong><span>${escapeHtml(project ? `${project.workspaceId ? `Workspace: ${project.name}` : 'Additional path'} · ${projectAvailability(project)}` : 'Choose a workspace')}</span></span>${icon('arrow_drop_down')}</button><div id="project-picker-options" class="project-picker__panel" aria-label="Available projects"${projectPickerOpen ? '' : ' hidden'}><div class="project-picker__heading">Projects <span>Workspace · host · path</span></div>${scope ? '<p class="project-picker__scope">Saved filter scope limits project choices. Clear filters to see all projects.</p>' : ''}<div class="project-picker__list">${choices}</div></div></div>`;
  }

  function searchField(): string {
    return `<label class="search">${icon('search')}<span class="visually-hidden">Search issues</span><input data-input="search" data-focus="search" type="search" aria-label="Search issues" placeholder="Search by title, ID or label" value="${escapeHtml(query)}" autocomplete="off"><kbd>/</kbd></label>`;
  }

  function errorBanner(): string {
    const reason = loadError || snapshot?.project.availabilityReason || '';
    const stale = snapshot && offline() ? `<div class="banner banner--state" role="status"><div><strong>Showing stale, read-only data</strong><p>Last fetched ${escapeHtml(snapshot.fetchedAt)}. Refresh to reconnect before changing issues or sending work.</p>${reason ? `<details data-persist="load-details"><summary data-focus="load-details">Technical details</summary><p>${escapeHtml(reason)}</p></details>` : ''}</div><button class="btn btn--outlined btn--sm" data-action="retry" type="button"${pending || loadingSnapshot || loadingProjects ? ' disabled' : ''}>Retry loading</button></div>` : '';
    const error = actionError && !createOpen ? `<div class="banner" role="alert">${icon('error')}<div><strong>Could not complete the action</strong><p>${escapeHtml(actionError)}</p></div><button class="btn btn--icon" data-action="dismiss-error" type="button" aria-label="Dismiss error">${icon('close')}</button></div>` : '';
    const undo = undoClose && undoClose.project === projectId ? `<div class="banner banner--undo" role="status"><div><strong>Closed ${escapeHtml(undoClose.id)}</strong><p>Undo reopens this issue if it has not changed.</p></div><button class="btn btn--outlined btn--sm" type="button" data-action="undo-close" title="${escapeHtml(actionCommand('reopen', undoClose.id))}"${disabled()}>Undo</button><button class="btn btn--icon" type="button" data-action="dismiss-undo" aria-label="Dismiss close message">${icon('close')}</button></div>` : '';
    const cacheNotice = snapshot?.project.cacheError && !offline() ? `<div class="banner" role="status"><div><strong>Offline cache unavailable</strong><p>${escapeHtml(snapshot.project.cacheError)} The current snapshot is live but may not be available offline.</p></div></div>` : '';
    return stale + cacheNotice + error + undo;
  }

  function createButton(): string {
    return `<button type="button" class="btn btn--primary" data-action="new"${disabled()}${projectId ? '' : ' disabled'}>${icon('add')}<span>New issue</span><kbd>N</kbd></button>`;
  }

  function card(issue: Issue): string {
    const group = groupOf(issue);
    const dependencyBlocked = blockedIds.has(issue.id);
    return `<article class="issue-card${selectedId === issue.id ? ' issue-card--selected' : ''}${group === 'closed' ? ' issue-card--closed' : ''}" draggable="${pressed(!pending && !offline())}" data-action="select" data-id="${escapeHtml(issue.id)}" title="Drag to move, or open for keyboard-accessible actions">
      <span class="issue-card__top"><input type="checkbox" data-change="pool" data-id="${escapeHtml(issue.id)}" aria-label="Select ${escapeHtml(issue.id)} for handoff"${taskPool.has(`${projectId}\0${issue.id}`) ? ' checked' : ''}>${icon(typeIcons[issue.type] ?? 'task_alt')}<span class="mono">${escapeHtml(issue.id)}</span>${priority(issue)}</span>
      <span class="issue-card__relation" hidden></span>
      <button type="button" class="text-link issue-card__title" data-action="select" data-id="${escapeHtml(issue.id)}" aria-label="Open ${escapeHtml(issue.id)}: ${escapeHtml(issue.title)}">${escapeHtml(issue.title)}</button>
      ${dependencyBlocked ? `<span class="issue-card__blockers">${icon('lock')}<span>Blocked by dependencies</span></span>` : ''}
      ${issue.dependencies.length ? `<span class="issue-card__footer">Relationships: ${escapeHtml(relationships(issue))}</span>` : ''}
      <span class="issue-card__footer"><span>${escapeHtml(issue.type)}</span>${issue.assignee ? `<span>${escapeHtml(issue.assignee)}</span>` : '<span>Unassigned</span>'}</span>
      ${issue.labels.length ? `<span class="issue-card__labels">${issue.labels.map((label) => `<span class="chip chip--label">${escapeHtml(label)}</span>`).join('')}</span>` : ''}
    </article>`;
  }

  function tableContent(issues: Issue[]): string {
    const headers: Array<[SortKey, string]> = [
      ['status', 'Status'], ['id', 'ID'], ['title', 'Title'], ['priority', 'Priority'],
      ['relationships', 'Relationships'], ['assignee', 'Assignee'], ['type', 'Type'], ['epic', 'Epic'], ['labels', 'Labels'], ['updated', 'Updated'],
    ];
    const epic = (issue: Issue): Issue | undefined => issue.dependencies
      .filter((dep) => dep.type === 'parent-child')
      .map((dep) => byId(dep.id)).find((parent) => parent?.type === 'epic');
    const value = (issue: Issue): string | number => {
      switch (sortKey) {
        case 'status': return groupOrder.indexOf(groupOf(issue));
        case 'priority': return issue.priority;
        case 'relationships': return relationships(issue);
        case 'epic': return epic(issue)?.title || '';
        case 'labels': return issue.labels.join(', ');
        case 'updated': return Date.parse(issue.updatedAt) || 0;
        default: return issue[sortKey];
      }
    };
    const sorted = [...issues].sort((a, b) => {
      const left = value(a);
      const right = value(b);
      const order = typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right));
      return (sortDirection === 'ascending' ? order : -order) || a.priority - b.priority || a.id.localeCompare(b.id);
    });
    return `<div class="table-wrap"><table class="issue-table"><thead><tr><th scope="col"><span class="visually-hidden">Select for handoff</span></th>${headers.map(([key, label]) => `<th scope="col" aria-sort="${key === sortKey ? sortDirection : 'none'}"><button class="table-sort" type="button" data-action="sort" data-value="${key}">${label}${key === sortKey ? `<span class="table-sort__arrow${sortDirection === 'ascending' ? ' table-sort__arrow--up' : ''}">${icon('arrow_drop_down')}</span>` : ''}</button></th>`).join('')}</tr></thead><tbody>${sorted.map((issue) => `<tr class="issue-table__row" data-id="${escapeHtml(issue.id)}" data-selected="${pressed(issue.id === selectedId)}"><td><input type="checkbox" data-change="pool" data-id="${escapeHtml(issue.id)}" aria-label="Select ${escapeHtml(issue.id)} for handoff"${taskPool.has(`${projectId}\0${issue.id}`) ? ' checked' : ''}></td><td>${bead(groupOf(issue))} ${escapeHtml(groupNames[groupOf(issue)])}</td><td class="mono">${escapeHtml(issue.id)}</td><td><button class="table-link" type="button" data-action="select" data-id="${escapeHtml(issue.id)}">${escapeHtml(issue.title)}</button><span class="issue-table__relation" hidden></span></td><td>${priority(issue)}</td><td class="mono">${escapeHtml(relationships(issue) || '—')}</td><td>${escapeHtml(issue.assignee || 'Unassigned')}</td><td>${escapeHtml(issue.type)}</td><td>${escapeHtml(epic(issue)?.title || '—')}</td><td>${issue.labels.map((label) => `<span class="chip chip--label">${escapeHtml(label)}</span>`).join(' ') || '—'}</td><td>${escapeHtml(relativeTime(issue.updatedAt))}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function applySpotlight(): void {
    const id = hoverId || focusId || selectedId;
    const issue = byId(id);
    const relations = new Map<string, string>();
    if (issue && spotlightOn) {
      for (const dep of issue.dependencies) {
        relations.set(dep.id, dep.type === 'blocks' ? 'Dependency · blocks' : dep.type === 'discovered-from' ? 'Found in' : dep.type);
      }
      for (const other of allIssues()) {
        for (const dep of other.dependencies) {
          if (dep.id === id && !relations.has(other.id)) relations.set(other.id, dep.type === 'blocks' ? 'Depends on this · blocks' : dep.type);
        }
      }
    }
    for (const element of root.querySelectorAll<HTMLElement>('.issue-card, .issue-table__row')) {
      const itemId = element.dataset.id || '';
      const relation = relations.get(itemId) || '';
      const chain = !!issue && relations.size > 0 && itemId !== id && !!relation;
      const dimmed = !!issue && relations.size > 0 && itemId !== id && !relation;
      element.classList.toggle('spotlight--chain', chain);
      element.classList.toggle('spotlight--dimmed', dimmed);
      const badge = element.querySelector<HTMLElement>('.issue-card__relation, .issue-table__relation');
      if (badge) { badge.hidden = !chain; badge.textContent = relation; }
    }
  }

  function boardContent(): string {
    const issues = filtered();
    if (!allIssues().length) return `<div class="empty-state"><h2>No issues yet</h2><p>${offline() ? 'This saved snapshot contains no issues.' : 'Create the first issue in this project to start the board.'}</p>${offline() ? '' : createButton()}</div>`;
    if (!issues.length) return `<div class="empty-state"><h2>No matching issues</h2><p>Try another search or clear the filters.</p><button class="btn btn--outlined" data-action="clear-filters" type="button">Clear filters</button></div>`;
    if (layout === 'table') return tableContent(issues);
    return `<div class="board" aria-label="Issues by status">${groupOrder.filter((group) => (group !== 'other' || issues.some((issue) => groupOf(issue) === group)) && (showClosed || group !== 'closed') && (view === 'all' || view === group)).map((group) => {
      const items = issues.filter((issue) => groupOf(issue) === group);
      return `<section class="column" data-drop-group="${group}" aria-label="${escapeHtml(groupNames[group])}"><h2 class="column__header">${bead(group)}<span>${escapeHtml(groupNames[group])}</span><span class="column__count">${items.length}</span></h2><p class="column__drop-hint" hidden></p><div class="column__list">${items.map(card).join('') || '<p class="column__empty">No issues</p>'}</div></section>`;
    }).join('')}</div>`;
  }

  function filters(): string {
    const issueTypes = [...new Set(allIssues().map((issue) => issue.type))].sort();
    const assignees = [...new Set(allIssues().map((issue) => issue.assignee).filter(Boolean))].sort();
    const activeFilters = Number(!!typeFilter) + Number(!!priorityFilter) + Number(!!assigneeFilter) + Number(!showClosed)
      + Number(!!(scope?.projectNames.length || scope?.hostNames.length));
    return `<div class="filters${filtersExpanded ? ' filters--expanded' : ''}"><button type="button" class="btn btn--outlined btn--sm filters__toggle" data-action="toggle-filters" aria-expanded="${pressed(filtersExpanded)}" aria-controls="issue-filters">Filters${activeFilters ? ` (${activeFilters})` : ''}${icon('arrow_drop_down')}</button><div id="issue-filters" class="filter-bar${filtersExpanded ? ' filter-bar--expanded' : ''}" aria-label="Filters"><label><span class="visually-hidden">Type</span><select data-change="type" data-focus="type" aria-label="Filter by type"><option value="">All types</option>${issueTypes.map((type) => `<option value="${escapeHtml(type)}"${selected(typeFilter, type)}>${escapeHtml(type)}</option>`).join('')}</select></label><label><span class="visually-hidden">Priority</span><select data-change="priority" data-focus="priority" aria-label="Filter by priority"><option value="">All priorities</option>${[0, 1, 2, 3, 4].map((value) => `<option value="${value}"${selected(priorityFilter, String(value))}>P${value}</option>`).join('')}</select></label><label><span class="visually-hidden">Assignee</span><select data-change="assignee" data-focus="assignee" aria-label="Filter by assignee"><option value="">All assignees</option>${assignees.map((assignee) => `<option value="${escapeHtml(assignee)}"${selected(assigneeFilter, assignee)}>${escapeHtml(assignee)}</option>`).join('')}</select></label><label class="check"><input type="checkbox" data-change="closed"${showClosed ? ' checked' : ''}> Closed</label><button class="btn btn--text btn--sm" type="button" data-action="clear-filters">Clear filters</button><span class="filter-bar__spacer"></span><span class="muted">${snapshot ? `${filtered().length} issues` : 'Issues not loaded'}${taskPool.size ? ` · ${taskPool.size} selected` : ''}</span>${taskPool.size ? '<button class="btn btn--text btn--sm" type="button" data-action="clear-pool">Clear selection</button>' : ''}</div></div>`;
  }

  function rail(): string {
    const groups: Array<Group | 'all'> = ['all', 'ready', 'active', 'blocked', 'closed', 'deferred'];
    if (view === 'other' || allIssues().some((issue) => groupOf(issue) === 'other')) groups.push('other');
    const project = projects.find((item) => item.id === projectId);
    return `<nav class="rail" aria-label="Workspace"><div class="rail__workspace"><span class="rail__glyph">${escapeHtml((project ? projectBasename(project) : 'B').slice(0, 2).toLocaleLowerCase())}</span><div>${projectSelect()}</div></div><label class="rail__view"><span class="visually-hidden">Issue view</span><select data-change="view" data-focus="view" aria-label="Issue view">${groups.map((group) => `<option value="${group}"${selected(view, group)}>${group === 'all' ? 'All issues' : escapeHtml(groupNames[group])}</option>`).join('')}</select></label><h2 class="rail__heading">Views</h2>${groups.map((group) => `<button type="button" class="rail__item" data-action="view" data-value="${group}" aria-current="${pressed(view === group)}">${group === 'all' ? icon('view_kanban') : bead(group)}<span>${group === 'all' ? 'All issues' : escapeHtml(groupNames[group])}</span><span class="rail__count">${snapshot ? group === 'all' ? allIssues().length : count(group) : '—'}</span></button>`).join('')}</nav>`;
  }

  function detailActions(issue: Issue): string {
    const group = groupOf(issue);
    const button = (method: string, label: string, glyph: string, primary: boolean): string => `<button type="button" class="btn ${primary ? 'btn--primary' : 'btn--secondary'}" data-action="${method}" data-id="${escapeHtml(issue.id)}" title="${escapeHtml(actionCommand(method, issue.id))}"${disabled()}>${icon(glyph)}${label}</button>`;
    if (group === 'closed') return button('reopen', 'Reopen', 'undo', false);
    const claim = group === 'ready' ? button('claim', 'Claim', 'play_arrow', true) : '';
    const reclaim = issue.status === 'in_progress' && issue.heartbeatAt && Date.now() - Date.parse(issue.heartbeatAt) > 30 * 60_000 ? button('reclaim', 'Reclaim lease', 'hourglass_disabled', false) : '';
    return `${claim}${reclaim}${button('close', 'Close', 'check', !claim && !reclaim)}`;
  }

  function draftKey(id: string): string {
    return `${projectId}\0${id}`;
  }

  function editSection(issue: Issue): string {
    const edit = editDrafts.get(draftKey(issue.id));
    if (!edit) return `<button type="button" class="btn btn--outlined" data-action="edit" data-id="${escapeHtml(issue.id)}"${pending || detailLoading || detailError ? ' disabled' : ''}>Edit issue</button>`;
    const values = edit.values;
    const changes = changedFields(edit);
    const field = (name: keyof EditValues, label: string, multiline = false): string => `<label class="field">${label}${multiline
      ? `<textarea name="${name}" data-input="edit" rows="3"${disabled()}>${escapeHtml(values[name])}</textarea>`
      : `<input name="${name}" data-input="edit" value="${escapeHtml(values[name])}"${name === 'title' ? ' required' : ''}${disabled()}>`}</label>`;
    return `<form class="edit-form" data-form="update"><h3>Edit issue</h3>${field('title', 'Title')}${field('description', 'Description', true)}
      <div class="dialog__row"><label class="field">Priority<select name="priority" data-input="edit"${disabled()}>${[0, 1, 2, 3, 4].map((value) => `<option value="${value}"${selected(values.priority, String(value))}>P${value}</option>`).join('')}</select></label>${field('assignee', 'Assignee')}</div>
      ${field('notes', 'Notes', true)}${field('acceptance', 'Acceptance criteria', true)}${field('design', 'Design', true)}
      <div class="command" data-command="update">${escapeHtml(updateCommand(issue.id, changes))}</div>
      <div class="detail__actions"><button class="btn btn--primary" type="submit" data-update-submit${pending || !Object.keys(changes).length || !values.title.trim() ? ' disabled' : ''}>Save changes</button><button class="btn btn--text" type="button" data-action="cancel-edit"${disabled()}>Cancel</button></div></form>`;
  }

  function commentsSection(issue: Issue): string {
    const text = commentDrafts.get(draftKey(issue.id)) ?? '';
    const command = `bd --json --no-color comment -- ${shell(issue.id)} ${shell(text.trim())}`;
    return `<section class="detail__section"><h3>Comments</h3>
      ${commentsLoading ? '<p class="muted" role="status">Loading comments…</p>' : ''}
      ${commentsError ? `<p class="detail__error" role="alert">${escapeHtml(commentsError)} <button class="btn btn--text btn--sm" type="button" data-action="retry-comments">Retry</button></p>` : ''}
      ${comments.length ? `<ol class="comment-list">${comments.map((comment) => `<li><div class="comment-list__meta"><strong>${escapeHtml(comment.author)}</strong><span>${escapeHtml(relativeTime(comment.created_at) || comment.created_at)}</span></div><p class="detail__prose">${escapeHtml(comment.text)}</p></li>`).join('')}</ol>` : (!commentsLoading && !commentsError ? '<p class="muted">No comments yet.</p>' : '')}
      <form class="comment-form" data-form="comment"><label class="field">Add a comment<textarea name="text" data-input="comment" rows="3" required${disabled()}>${escapeHtml(text)}</textarea></label><div class="command" data-command="comment">${escapeHtml(command)}</div><button class="btn btn--outlined" type="submit" data-comment-submit${pending || !text.trim() ? ' disabled' : ''}>Add comment</button></form></section>`;
  }

 
  function issueDetail(issue: Issue): string {
    const group = groupOf(issue);
    const deps = issue.dependencies;
    const dependents = allIssues().filter((other) => other.dependencies.some((dep) => dep.id === issue.id));
    const candidates = allIssues().filter((other) => other.id !== issue.id && !deps.some((dep) => dep.id === other.id));
    if (dependencyId && !candidates.some((candidate) => candidate.id === dependencyId)) dependencyId = '';
    return `<div class="detail"><div class="detail__top">${icon(typeIcons[issue.type] ?? 'task_alt')}<span class="mono">${escapeHtml(issue.id)}</span>${priority(issue)}<span class="detail__spacer"></span><button type="button" class="btn btn--icon" data-action="close-detail" aria-label="Close issue details">${icon('close')}</button></div>
      <h2 class="detail__title">${escapeHtml(issue.title)}</h2><div class="detail__actions">${detailActions(issue)}</div>
      ${editSection(issue)}
      <dl class="meta-list"><dt>Status</dt><dd>${bead(group)} ${escapeHtml(groupNames[group])}</dd><dt>Type</dt><dd>${escapeHtml(issue.type)}</dd><dt>Assignee</dt><dd>${escapeHtml(issue.assignee || 'Unassigned')}</dd><dt>Updated</dt><dd>${escapeHtml(relativeTime(issue.updatedAt) || 'Unknown')}</dd>${issue.labels.length ? `<dt>Labels</dt><dd>${issue.labels.map((label) => `<span class="chip chip--label">${escapeHtml(label)}</span>`).join(' ')}</dd>` : ''}</dl>
      ${detailLoading ? '<p class="muted" role="status">Loading issue details…</p>' : ''}${detailError ? `<p class="detail__error" role="alert">${escapeHtml(detailError)} <button class="btn btn--text btn--sm" type="button" data-action="retry-detail">Retry</button></p>` : ''}
      ${issue.description ? `<section class="detail__section"><h3>Description</h3><p class="detail__prose">${escapeHtml(issue.description)}</p></section>` : ''}
      ${issue.acceptance ? `<section class="detail__section"><h3>Acceptance criteria</h3><p class="detail__prose">${escapeHtml(issue.acceptance)}</p></section>` : ''}
      ${issue.notes ? `<section class="detail__section"><h3>Notes</h3><p class="detail__prose">${escapeHtml(issue.notes)}</p></section>` : ''}
      ${issue.design ? `<section class="detail__section"><h3>Design</h3><p class="detail__prose">${escapeHtml(issue.design)}</p></section>` : ''}
      ${product.documents(issue)}
      <section class="detail__section"><h3>Dependencies</h3>${deps.length ? `<ul class="thread">${deps.map((dep) => `<li><span class="thread__node">${bead(byId(dep.id) ? groupOf(byId(dep.id) as Issue) : 'other')}</span><span><button type="button" class="text-link" data-action="select" data-id="${escapeHtml(dep.id)}"${byId(dep.id) ? '' : ' disabled'}>${escapeHtml(byId(dep.id)?.title || dep.id)}</button><span class="thread__meta mono">${escapeHtml(dep.id)} · ${escapeHtml(dep.type)}</span></span><button type="button" class="btn btn--icon" data-action="unlink" data-id="${escapeHtml(issue.id)}" data-depends="${escapeHtml(dep.id)}" aria-label="Remove dependency ${escapeHtml(dep.id)}" title="${escapeHtml(actionCommand('unlink', issue.id, dep.id))}"${disabled()}>${icon('close')}</button></li>`).join('')}</ul>` : '<p class="muted">No dependencies.</p>'}
      ${dependents.length ? `<p class="muted">Referenced by</p><ul class="thread">${dependents.map((other) => `<li><span class="thread__node">${bead(groupOf(other))}</span><button type="button" class="text-link" data-action="select" data-id="${escapeHtml(other.id)}">${escapeHtml(other.title)} <span class="mono">${escapeHtml(other.id)}</span></button></li>`).join('')}</ul>` : ''}
      ${candidates.length ? `<form class="dependency-form" data-form="link"><label>Link issue<select name="dependsOn" data-input="dependency" aria-label="Dependency issue"${disabled()}><option value="">Choose an issue</option>${candidates.map((candidate) => `<option value="${escapeHtml(candidate.id)}"${selected(dependencyId, candidate.id)}>${escapeHtml(candidate.id)} · ${escapeHtml(candidate.title)}</option>`).join('')}</select></label><label>Relationship<select name="type" data-input="dependency-type" aria-label="Dependency relationship"${disabled()}>${['blocks', 'parent-child', 'related', 'discovered-from'].map((type) => `<option value="${type}"${selected(dependencyType, type)}>${type}</option>`).join('')}</select></label><button class="btn btn--outlined" type="submit" data-link-submit${pending || !dependencyId ? ' disabled' : ''}>${icon('add_link')}Link</button><code class="command dependency-form__command" data-command="link">${escapeHtml(actionCommand('link', issue.id, dependencyId || 'ISSUE', dependencyType))}</code></form>` : ''}</section>
      ${commentsSection(issue)}
      <div class="command"><span>$ </span>${escapeHtml(actionCommand(group === 'ready' ? 'claim' : group === 'closed' ? 'reopen' : 'close', issue.id))}</div></div>`;
  }

  function createDialog(): string {
    if (!createOpen) return '';
    return `<dialog class="dialog" aria-labelledby="create-heading"><form data-form="create"><header class="dialog__header"><h2 id="create-heading">New issue</h2><button type="button" class="btn btn--icon" data-action="cancel-create" aria-label="Close">${icon('close')}</button></header><div class="dialog__body"><label class="field">Title<input name="title" data-input="draft" data-focus="create-title" value="${escapeHtml(draft.title)}" placeholder="What needs to be done?" required maxlength="300"${disabled()}></label><div class="dialog__row"><label class="field">Type<select name="type" data-input="draft"${disabled()}>${types.map((type) => `<option value="${type}"${selected(draft.type, type)}>${type}</option>`).join('')}</select></label><label class="field">Priority<select name="priority" data-input="draft"${disabled()}>${[0, 1, 2, 3, 4].map((value) => `<option value="${value}"${selected(draft.priority, String(value))}>P${value}</option>`).join('')}</select></label></div><label class="field">Description<textarea name="description" data-input="draft" rows="4" placeholder="Context, links, what done looks like"${disabled()}>${escapeHtml(draft.description)}</textarea></label><label class="field">Assignee<input name="assignee" data-input="draft" value="${escapeHtml(draft.assignee)}" autocomplete="off"${disabled()}></label><label class="field">Labels, comma separated<input name="labels" data-input="draft" value="${escapeHtml(draft.labels)}" autocomplete="off"${disabled()}></label><div class="command" aria-label="Equivalent command"><span>$ </span><span data-command="create">${escapeHtml(createCommand(draft))}</span></div>${actionError ? `<p class="detail__error" role="alert">${escapeHtml(actionError)}</p>` : ''}</div><footer class="dialog__actions"><button type="button" class="btn btn--text" data-action="cancel-create"${disabled()}>Cancel</button><button type="submit" class="btn btn--primary"${disabled()}>${pending ? 'Creating…' : 'Create issue'}</button></footer></form></dialog>`;
  }

  function boardShell(): string {
    const issue = currentIssue();
    const project = projects.find((item) => item.id === projectId);
    const sync = project ? `${projectAvailability(project)}${snapshot ? ` · ${relativeTime(snapshot.fetchedAt) || snapshot.fetchedAt}` : ''}` : 'Refresh';
    return `<div class="app${issue ? ' app--drawer-open' : ''}">
      <header class="app-bar"><div class="brand"><span class="brand__mark">${bead('closed')}${bead('active')}${bead('ready')}</span><span>beads</span></div><div class="app-bar__search">${searchField()}</div><div class="app-bar__actions"><button type="button" class="btn btn--text btn--sm" data-action="refresh" aria-label="${projectId ? 'Refresh issues' : 'Refresh projects'}" title="${escapeHtml(sync)}"${pending || loadingSnapshot || loadingProjects ? ' disabled' : ''}>${icon('sync')}<span>${escapeHtml(sync)}</span></button>${createButton()}</div></header>
      ${rail()}<main class="main"><div class="main__head"><div class="main__title-row"><h1 tabindex="-1" data-focus="board-heading">${layout === 'board' ? 'Board' : 'Table'}</h1>${snapshot ? `<span class="muted">${count('ready')} ready · ${count('active')} in progress · ${count('blocked')} blocked${offline() ? ' · stale' : ''}</span>` : ''}
      <div class="segmented" aria-label="Layout"><button type="button" data-action="layout" data-value="board" aria-pressed="${pressed(layout === 'board')}">${icon('view_kanban')}Board</button><button type="button" data-action="layout" data-value="table" aria-pressed="${pressed(layout === 'table')}">${icon('table_rows')}Table</button></div>
      <button type="button" class="btn btn--icon" data-action="spotlight" aria-label="Highlight dependencies" aria-pressed="${pressed(spotlightOn)}" title="Highlight dependencies on hover or focus">${icon('account_tree')}</button></div><div class="main__tools">${filters()}<div class="product-controls">${product.controls()}</div></div>${scope ? '<p class="muted">Saved filter scope limits project choices. Clear filters to see all projects.</p>' : ''}</div>${errorBanner()}${bodyState() || boardContent()}</main>
      ${issue ? `<aside class="drawer" aria-label="Issue details">${issueDetail(issue)}</aside>` : ''}</div>${createDialog()}${product.dialog()}`;
  }

  function bodyState(): string {
    if (!snapshot && (loadingProjects || loadingSnapshot)) return `<div class="empty-state" role="status"><h2>${loadingProjects ? 'Loading projects…' : 'Loading issues…'}</h2><p>${loadingProjects ? 'Finding available workspaces.' : 'Reading this project from Beads.'}</p></div>`;
    if (!snapshot && loadError) return `<div class="empty-state empty-state--error" role="alert"><h2>${loadErrorSource === 'projects' ? 'Projects unavailable' : 'Issues unavailable'}</h2><p>${loadErrorSource === 'projects' ? 'Could not load the project list.' : 'Could not load issues for this project.'} Try again to reconnect.</p><details data-persist="load-details"><summary data-focus="load-details">Technical details</summary><p>${escapeHtml(loadError)}</p></details><button class="btn btn--outlined" type="button" data-action="retry"${pending ? ' disabled' : ''}>Retry loading</button></div>`;
    if (!projects.length) return '<div class="empty-state"><h2>No projects available</h2><p>Add a local Beads workspace in Orca or an additional project path in the plugin settings, then refresh.</p><button class="btn btn--outlined" type="button" data-action="retry">Refresh</button></div>';
    if (!snapshot) return '<div class="empty-state" role="status"><h2>Loading issues…</h2><p>Reading this project from Beads.</p></div>';
    return '';
  }


  function render(): void {
    if (disposed) return;
    rendering = true;
    filteredCache = null;
    const active = document.activeElement instanceof HTMLElement && root.contains(document.activeElement) ? document.activeElement : null;
    const hadProductDialog = !!root.querySelector('[data-product-dialog]');
    const hadCreateDialog = !!root.querySelector('dialog:not([data-product-dialog])');
    const candidates = (container: HTMLElement): HTMLElement[] => Array.from(container.querySelectorAll<HTMLElement>('[data-focus], [data-input], [data-action], [data-change], [data-product-action], [data-product-input], [data-product-change]'));
    const matches = (element: HTMLElement): boolean => !!active && element.tagName === active.tagName
      && element.dataset.focus === active.dataset.focus && element.dataset.input === active.dataset.input
      && element.dataset.action === active.dataset.action && element.dataset.change === active.dataset.change
      && element.dataset.id === active.dataset.id && element.dataset.value === active.dataset.value
      && element.dataset.productAction === active.dataset.productAction && element.dataset.productInput === active.dataset.productInput
      && element.dataset.productChange === active.dataset.productChange && element.dataset.group === active.dataset.group
      && element.dataset.path === active.dataset.path && element.dataset.scope === active.dataset.scope
      && (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement)
        || element.name === (active as HTMLInputElement).name);
    const focusIndex = active ? candidates(root).filter(matches).indexOf(active) : -1;
    const start = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement ? active.selectionStart : null;
    const end = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement ? active.selectionEnd : null;
    const scrollSelector = '.board, .column__list, .table-wrap, .drawer, .dialog__body, .project-picker__list';
    const scrollPositions = Array.from(root.querySelectorAll<HTMLElement>(scrollSelector), (element) => [element.scrollTop, element.scrollLeft] as const);
    const openDetails = new Set(Array.from(root.querySelectorAll<HTMLDetailsElement>('details[data-persist][open]'), (element) => element.dataset.persist));
    hoverId = '';
    root.innerHTML = boardShell();
    for (const element of root.querySelectorAll<HTMLDetailsElement>('details[data-persist]')) element.open = openDetails.has(element.dataset.persist);
    if (projectPickerOpen) setProjectPicker(true);
    if (offline()) {
      const selectors = ['[data-action=\"new\"]', '[data-action=\"edit\"]', '[data-action=\"claim\"]', '[data-action=\"reclaim\"]', '[data-action=\"close\"]', '[data-action=\"reopen\"]', '[data-action=\"unlink\"]', '[data-action=\"undo-close\"]', '[data-form=\"create\"] input', '[data-form=\"create\"] select', '[data-form=\"create\"] textarea', '[data-form=\"create\"] button[type=\"submit\"]', '[data-form=\"update\"] input', '[data-form=\"update\"] select', '[data-form=\"update\"] textarea', '[data-form=\"update\"] button[type=\"submit\"]', '[data-form=\"comment\"] textarea', '[data-form=\"comment\"] button[type=\"submit\"]', '[data-form=\"link\"] select', '[data-form=\"link\"] button[type=\"submit\"]'];
      for (const element of root.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(selectors.join(', '))) element.disabled = true;
      for (const element of root.querySelectorAll<HTMLButtonElement>('[data-action=\"retry-comments\"], [data-product-action=\"documents-retry\"]')) element.disabled = true;
    }
    const dialog = root.querySelector<HTMLDialogElement>('dialog');
    if (dialog) {
      dialog.addEventListener('cancel', (event) => { event.preventDefault(); if (dialog.hasAttribute('data-product-dialog')) product.close(); else if (!pending) { createOpen = false; render(); } });
      if (!document.querySelector('.product-confirm[open]')) dialog.showModal();
    }
    Array.from(root.querySelectorAll<HTMLElement>(scrollSelector)).forEach((element, index) => {
      const position = scrollPositions[index];
      if (position) { element.scrollTop = position[0]; element.scrollLeft = position[1]; }
    });
    if (focusIndex >= 0) {
      const next = candidates(root).filter(matches)[focusIndex];
      next?.focus({ preventScroll: true });
      if ((next instanceof HTMLInputElement || next instanceof HTMLTextAreaElement) && start !== null && end !== null) {
        try { next.setSelectionRange(start, end); } catch { /* Search fields and selects vary by browser. */ }
      }
      if ((active?.dataset.action === 'retry' || active?.dataset.action === 'refresh')
        && (!next || (next instanceof HTMLButtonElement && next.disabled))) {
        root.querySelector<HTMLElement>('[data-focus="board-heading"]')?.focus({ preventScroll: true });
      }
    }
    if (hadProductDialog && !root.querySelector('[data-product-dialog]')) {
      const handoff = productReturn === 'handoff' ? root.querySelector<HTMLButtonElement>('[data-product-action="handoff"]:not(:disabled)') : null;
      (handoff || root.querySelector<HTMLElement>('[data-focus="workflows"]'))?.focus({ preventScroll: true });
    } else if (hadCreateDialog && !root.querySelector('dialog')) {
      (root.querySelector<HTMLButtonElement>('[data-action="new"]:not(:disabled)') || root.querySelector<HTMLElement>('[data-focus="board-heading"]'))?.focus({ preventScroll: true });
    }
    rendering = false;
    if (hoverId || focusId || selectedId) applySpotlight();
  }

  async function loadProjects(): Promise<void> {
    if (projectLoadTask) { projectsReloadPending = true; return; }
    loadingProjects = true;
    loadError = '';
    render();
    const task = (async () => {
      try {
        const result = await transport.request<Project[]>({ method: 'projects' });
        if (disposed) return;
        projects = result;
        if (!projects.some((project) => project.id === projectId)) {
          const current = projects.filter((project) => project.current);
          projectId = (!projectId && current.length === 1 ? current[0]?.id : undefined) || projects[0]?.id || '';
          snapshot = null; issueIndex.clear(); readyIds.clear(); blockedIds.clear();
          selectedId = ''; detail = null; detailSequence++; commentsSequence++;
          comments = []; commentsError = ''; undoClose = null;
        }
        loadingProjects = false;
        if (projectId) await refresh();
        else { snapshot = null; render(); }
      } catch (error) {
        if (disposed) return;
        loadingProjects = false;
        loadError = textError(error) || 'No technical details were provided.'; loadErrorSource = 'projects'; connectionLost = !!snapshot;
        render();
      }
    })();
    projectLoadTask = task;
    try { await task; } finally {
      if (projectLoadTask === task) projectLoadTask = null;
      if (projectsReloadPending && !disposed && !pending) {
        projectsReloadPending = false;
        void loadProjects();
      }
    }
  }

  async function refresh(showLoading = false): Promise<void> {
    while (refreshTask) await refreshTask;
    const requestedProject = projectId;
    if (!requestedProject || disposed) return;
    const wasLoading = loadingSnapshot;
    loadingSnapshot = true;
    if (showLoading || (!snapshot && !wasLoading)) render();
    const request = (async () => {
      try {
        const result = await transport.request<Snapshot>({ method: 'snapshot', project: requestedProject });
        if (disposed || projectId !== requestedProject) return;
        if (result.project.id !== requestedProject) throw new Error('Beads returned data for a different project.');
        snapshot = result;
        issueIndex = new Map(result.issues.map((issue) => [issue.id, issue]));
        readyIds = new Set(result.readyIds); blockedIds = new Set(result.blockedIds);
        connectionLost = false;
        projects = projects.map((project) => project.id === result.project.id ? { ...project, ...result.project } : project);
        snapshotGeneration++;
        loadError = ''; loadErrorSource = 'snapshot';
        if (selectedId && !result.issues.some((issue) => issue.id === selectedId)) {
          selectedId = ''; detail = null; detailSequence++;
        } else if (selectedId && result.offline) {
          detail = result.issues.find((issue) => issue.id === selectedId) || null;
          detailSequence++; detailLoading = false; detailError = '';
          commentsSequence++; comments = []; commentsLoading = false; commentsError = 'Comments are unavailable offline.';
        } else if (selectedId) {
          const id = selectedId;
          void product.loadDocuments(requestedProject, id, result.issues.find((issue) => issue.id === id)?.updatedAt || '');
          const sequence = ++detailSequence;
          try {
            const latest = await transport.request<Issue>({ method: 'issue', project: requestedProject, input: { id } });
            if (!disposed && projectId === requestedProject && selectedId === id && sequence === detailSequence) {
              detail = latest; detailError = '';
            }
          } catch (error) {
            if (!disposed && projectId === requestedProject && selectedId === id && sequence === detailSequence) detailError = textError(error);
          } finally {
            if (!disposed && projectId === requestedProject && selectedId === id && sequence === detailSequence) detailLoading = false;
          }
          if (!disposed && projectId === requestedProject && selectedId === id) await loadComments(id, true);
        }
      } catch (error) {
        if (!disposed && projectId === requestedProject) { connectionLost = true; loadError = textError(error) || 'No technical details were provided.'; loadErrorSource = 'snapshot'; }
      } finally {
        if (!disposed && projectId === requestedProject) { loadingSnapshot = false; render(); }
      }
    })();
    refreshTask = request;
    try { await request; } finally { if (refreshTask === request) refreshTask = null; }
  }

  async function loadComments(id: string, quiet = false): Promise<void> {
    const requestedProject = projectId;
    const sequence = ++commentsSequence;
    if (offline()) { comments = []; commentsLoading = false; commentsError = 'Comments are unavailable offline.'; render(); return; }
    if (!quiet) { commentsLoading = true; commentsError = ''; render(); }
    try {
      const rows = await transport.request<unknown>({ method: 'comments', project: requestedProject, input: { id } });
      if (!Array.isArray(rows) || rows.some((row: unknown) => {
        if (!row || typeof row !== 'object') return true;
        const item = row as Record<string, unknown>;
        return ['author', 'text', 'created_at'].some((field) => typeof item[field] !== 'string') || (item.issue_id !== undefined && item.issue_id !== id);
      })) throw new Error('Beads returned invalid comments for this issue.');
      if (!disposed && projectId === requestedProject && selectedId === id && sequence === commentsSequence) {
        comments = rows as Comment[]; commentsError = '';
      }
    } catch (error) {
      if (!disposed && projectId === requestedProject && selectedId === id && sequence === commentsSequence) commentsError = textError(error);
    } finally {
      if (!disposed && projectId === requestedProject && selectedId === id && sequence === commentsSequence) { commentsLoading = false; render(); }
    }
  }

  async function loadDetail(id: string): Promise<void> {
    const requestedProject = projectId;
    const sequence = ++detailSequence;
    if (selectedId !== id) { comments = []; commentsError = ''; }
    selectedId = id;
    detail = null;
    detailError = '';
    detailLoading = true;
    dependencyId = '';
    dependencyType = 'blocks';
    if (offline()) {
      detail = byId(id) || null; detailLoading = false; commentsSequence++;
      comments = []; commentsLoading = false; commentsError = 'Comments are unavailable offline.';
      render(); return;
    }
    render();
    void loadComments(id);
    void product.loadDocuments(requestedProject, id, byId(id)?.updatedAt || '');
    try {
      const result = await transport.request<Issue>({ method: 'issue', project: requestedProject, input: { id } });
      if (!disposed && projectId === requestedProject && selectedId === id && sequence === detailSequence) detail = result;
    } catch (error) {
      if (!disposed && projectId === requestedProject && selectedId === id && sequence === detailSequence) detailError = textError(error);
    } finally {
      if (!disposed && projectId === requestedProject && selectedId === id && sequence === detailSequence) { detailLoading = false; render(); }
    }
  }

  async function mutate(method: string, input: Record<string, unknown>): Promise<void> {
    if (pending || !projectId || offline()) return;
    pending = true;
    actionError = '';
    const requestedProject = projectId;
    render();
    try {
      if (refreshTask) await refreshTask;
      if (offline()) throw new Error('The project is offline. No change was sent.');
      const before = snapshotGeneration;
      await transport.request({ method, project: requestedProject, input });
      if (disposed || projectId !== requestedProject) return;
      undoClose = null;
      if (method === 'create') { createOpen = false; draft = emptyDraft(); }
      if (method === 'update' && typeof input.id === 'string') editDrafts.delete(draftKey(input.id));
      if (method === 'comment' && typeof input.id === 'string') commentDrafts.delete(draftKey(input.id));
      await refresh();
      if (method === 'close' && typeof input.id === 'string' && snapshotGeneration > before) {
        const closed = selectedId === input.id && !detailError ? detail : null;
        if (closed?.status === 'closed') undoClose = { project: requestedProject, id: closed.id, updatedAt: closed.updatedAt, closedAt: closed.closedAt };
      }
    } catch (error) {
      if (!disposed && projectId === requestedProject) actionError = textError(error);
    } finally {
      if (!disposed) {
        pending = false;
        render();
        if (projectsReloadPending && !projectLoadTask) { projectsReloadPending = false; void loadProjects(); }
      }
    }
  }

  async function undoLastClose(): Promise<void> {
    const undo = undoClose;
    if (!undo || pending || offline() || projectId !== undo.project) return;
    pending = true;
    actionError = '';
    render();
    try {
      if (refreshTask) await refreshTask;
      if (offline()) throw new Error('The project is offline. The issue was not reopened.');
      const latest = await transport.request<Issue>({ method: 'issue', project: undo.project, input: { id: undo.id } });
      if (disposed || projectId !== undo.project) return;
      if (latest.status !== 'closed' || latest.updatedAt !== undo.updatedAt || latest.closedAt !== undo.closedAt) {
        undoClose = null;
        throw new Error('The issue changed after it was closed; it was not reopened.');
      }
      await transport.request({ method: 'reopen', project: undo.project, input: { id: undo.id } });
      undoClose = null;
      await refresh();
    } catch (error) {
      if (!disposed && projectId === undo.project) actionError = textError(error);
    } finally {
      if (!disposed) {
        pending = false;
        render();
        if (projectsReloadPending && !projectLoadTask) { projectsReloadPending = false; void loadProjects(); }
      }
    }
  }


  function openCreate(): void {
    if (!projectId || pending || offline()) return;
    actionError = '';
    createOpen = true;
    render();
    root.querySelector<HTMLInputElement>('[data-focus="create-title"]')?.focus();
  }

  function clearFilters(): void {
    query = ''; typeFilter = ''; priorityFilter = ''; assigneeFilter = ''; showClosed = true; view = 'all'; scope = null;
    render();
  }
  function selectProject(id: string, clearQuery: boolean): void {
    const project = projects.find((item) => item.id === id);
    if (!project || id === projectId) return;
    if (!inScope(project, scope)) { actionError = 'This project is outside the saved filter scope. Clear filters to view it.'; render(); return; }
    projectId = id; snapshot = null; issueIndex.clear(); readyIds.clear(); blockedIds.clear();
    loadingSnapshot = true; connectionLost = false; selectedId = ''; detail = null; detailSequence++; commentsSequence++;
    comments = []; commentsError = ''; commentsLoading = false; undoClose = null;
    loadError = ''; actionError = ''; if (clearQuery && !scope) query = ''; render(); void refresh();
  }

  function setProjectPicker(open: boolean, focusChoice = false): void {
    projectPickerOpen = open;
    const trigger = root.querySelector<HTMLButtonElement>('[data-action="toggle-project-picker"]');
    const panel = root.querySelector<HTMLElement>('#project-picker-options');
    trigger?.setAttribute('aria-expanded', pressed(open));
    if (panel) panel.hidden = !open;
    if (open && trigger && panel) {
      const rect = trigger.getBoundingClientRect();
      const width = Math.min(480, window.innerWidth - 16);
      const top = Math.max(8, Math.min(rect.bottom + 8, window.innerHeight - 120));
      panel.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`;
      panel.style.top = `${top}px`;
      panel.style.maxHeight = `${Math.max(100, window.innerHeight - top - 8)}px`;
    }
    if (open && focusChoice) {
      const choice = panel?.querySelector<HTMLButtonElement>('[data-action="choose-project"][aria-current="true"]:not(:disabled)')
        || panel?.querySelector<HTMLButtonElement>('[data-action="choose-project"]:not(:disabled)');
      choice?.focus();
    }
  }

  function onDocumentPointerDown(event: PointerEvent): void {
    const picker = root.querySelector('.project-picker');
    if (projectPickerOpen && event.target instanceof Node && !picker?.contains(event.target)) setProjectPicker(false);
    const menu = root.querySelector<HTMLDetailsElement>('.workflow-menu[open]');
    if (menu && event.target instanceof Node && !menu.contains(event.target)) menu.open = false;
  }

  function onResize(): void {
    if (projectPickerOpen) setProjectPicker(true);
  }


  function onClick(event: MouseEvent): void {
    const productTarget = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-product-action]') : null;
    if (productTarget && root.contains(productTarget)) {
      if (['handoff', 'filters', 'history', 'worktree', 'hosts'].includes(productTarget.dataset.productAction || '')) {
        productReturn = productTarget.dataset.productAction === 'handoff' ? 'handoff' : 'workflows';
      }
      const menu = productTarget.closest<HTMLDetailsElement>('.workflow-menu');
      if (menu) menu.open = false;
      void product.onClick(productTarget); return;
    }
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-action]') : null;
    if (event.target instanceof HTMLInputElement && event.target.dataset.change === 'pool') return;
    if (!target || !root.contains(target)) return;
    const action = target.dataset.action;
    const id = target.dataset.id || '';
    switch (action) {
      case 'toggle-project-picker': setProjectPicker(!projectPickerOpen, !projectPickerOpen); break;
      case 'choose-project':
        setProjectPicker(false);
        root.querySelector<HTMLButtonElement>('[data-action="toggle-project-picker"]')?.focus();
        if (id) selectProject(id, true);
        break;
      case 'new': openCreate(); break;
      case 'cancel-create': if (!pending) { createOpen = false; actionError = ''; render(); } break;
      case 'refresh': if (!pending) { if (projectId) void refresh(true); else void loadProjects(); } break;
      case 'retry': if (loadErrorSource === 'projects' || !projects.length) void loadProjects(); else void refresh(true); break;
      case 'retry-detail': if (selectedId) void loadDetail(selectedId); break;
      case 'retry-comments': if (selectedId) void loadComments(selectedId); break;
      case 'undo-close': void undoLastClose(); break;
      case 'dismiss-undo': undoClose = null; render(); break;
      case 'edit': {
        const issue = currentIssue();
        if (issue && !pending && !detailLoading && !detailError) {
          const baseline = editValues(issue);
          editDrafts.set(draftKey(issue.id), { baseline, values: { ...baseline } });
          render();
        }
        break;
      }
      case 'cancel-edit': if (!pending && selectedId) { editDrafts.delete(draftKey(selectedId)); render(); } break;
      case 'sort': {
        const key = target.dataset.value as SortKey;
        if (['status', 'id', 'title', 'priority', 'relationships', 'assignee', 'type', 'epic', 'labels', 'updated'].includes(key)) {
          sortDirection = key === sortKey && sortDirection === 'ascending' ? 'descending' : 'ascending';
          sortKey = key;
          render();
        }
        break;
      }
      case 'dismiss-error': actionError = ''; render(); break;
      case 'toggle-filters': filtersExpanded = !filtersExpanded; render(); break;
      case 'clear-filters': clearFilters(); break;
      case 'clear-pool': taskPool.clear(); render(); break;
      case 'layout': if (target.dataset.value === 'board' || target.dataset.value === 'table') { layout = target.dataset.value; render(); } break;
      case 'spotlight': spotlightOn = !spotlightOn; render(); break;
      case 'view': view = (target.dataset.value || 'all') as Group | 'all'; if (view === 'closed') showClosed = true; render(); break;
      case 'select': if (id && byId(id)) void loadDetail(id); break;
      case 'close-detail': selectedId = ''; detail = null; detailSequence++; render(); break;
      case 'claim': case 'close': case 'reopen': case 'reclaim': if (id) void mutate(action, { id }); break;
      case 'unlink': if (id && target.dataset.depends) void mutate('unlink', { id, dependsOn: target.dataset.depends }); break;
    }
  }

  function onChange(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) return;
    if (product.onChange(target)) return;
    const change = target.dataset.change;
    if (change === 'pool' && target instanceof HTMLInputElement) {
      const issue = byId(target.dataset.id || '');
      if (issue) {
        const key = `${projectId}\0${issue.id}`;
        if (target.checked) taskPool.set(key, { project: projectId, id: issue.id, title: issue.title });
        else taskPool.delete(key);
        render();
      }
    } else if (change === 'type') { typeFilter = target.value; render(); }
    else if (change === 'view' && ['all', ...groupOrder].includes(target.value)) { view = target.value as Group | 'all'; if (view === 'closed') showClosed = true; render(); }
    else if (change === 'priority') { priorityFilter = target.value; render(); }
    else if (change === 'assignee') { assigneeFilter = target.value; render(); }
    else if (change === 'closed' && target instanceof HTMLInputElement) { showClosed = target.checked; render(); }
    else onInput(event);
  }

  function onInput(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) return;
    if (product.onInput(target)) return;
    if (target.dataset.input === 'search') {
      if (query === target.value) return;
      query = target.value;
      render();
    } else if (target.dataset.input === 'draft' && target.name in draft) {
      draft[target.name as keyof Draft] = target.value;
      const command = root.querySelector<HTMLElement>('[data-command="create"]');
      if (command) command.textContent = createCommand(draft);
    } else if (target.dataset.input === 'edit' && selectedId) {
      const edit = editDrafts.get(draftKey(selectedId));
      if (!edit || !(target.name in edit.values)) return;
      edit.values[target.name as keyof EditValues] = target.value;
      for (const field of root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('[data-input="edit"]')) {
        if (field !== target && field.name === target.name) field.value = target.value;
      }
      const changes = changedFields(edit);
      for (const command of root.querySelectorAll<HTMLElement>('[data-command="update"]')) command.textContent = updateCommand(selectedId, changes);
      for (const button of root.querySelectorAll<HTMLButtonElement>('[data-update-submit]')) button.disabled = pending || offline() || !Object.keys(changes).length || !edit.values.title.trim();
    } else if (target.dataset.input === 'comment' && selectedId) {
      commentDrafts.set(draftKey(selectedId), target.value);
      for (const field of root.querySelectorAll<HTMLTextAreaElement>('[data-input="comment"]')) {
        if (field !== target) field.value = target.value;
      }
      const commandText = `bd --json --no-color comment -- ${shell(selectedId)} ${shell(target.value.trim())}`;
      for (const command of root.querySelectorAll<HTMLElement>('[data-command="comment"]')) command.textContent = commandText;
      for (const button of root.querySelectorAll<HTMLButtonElement>('[data-comment-submit]')) button.disabled = pending || offline() || !target.value.trim();
    } else if (target.dataset.input === 'dependency' || target.dataset.input === 'dependency-type') {
      if (target.dataset.input === 'dependency') dependencyId = target.value; else dependencyType = target.value;
      for (const select of root.querySelectorAll<HTMLSelectElement>('[data-input="dependency"], [data-input="dependency-type"]')) {
        select.value = select.dataset.input === 'dependency' ? dependencyId : dependencyType;
      }
      for (const button of root.querySelectorAll<HTMLButtonElement>('[data-link-submit]')) button.disabled = pending || offline() || !dependencyId;
      for (const command of root.querySelectorAll<HTMLElement>('[data-command="link"]')) {
        if (selectedId) command.textContent = actionCommand('link', selectedId, dependencyId || 'ISSUE', dependencyType);
      }
    }
  }

  function onSubmit(event: SubmitEvent): void {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    event.preventDefault();
    if (form.dataset.form === 'create') {
      const title = draft.title.trim();
      if (!title) { root.querySelector<HTMLInputElement>('[data-focus="create-title"]')?.focus(); return; }
      const input: Record<string, unknown> = { title, type: draft.type, priority: Number(draft.priority) };
      if (draft.description.trim()) input.description = draft.description.trim();
      if (draft.assignee.trim()) input.assignee = draft.assignee.trim();
      const labels = draft.labels.split(',').map((label) => label.trim()).filter(Boolean);
      if (labels.length) input.labels = labels;
      void mutate('create', input);
    } else if (form.dataset.form === 'update' && selectedId) {
      const edit = editDrafts.get(draftKey(selectedId));
      if (edit && edit.values.title.trim()) {
        const changes = changedFields(edit);
        if (Object.keys(changes).length) void mutate('update', { id: selectedId, ...changes });
      }
    } else if (form.dataset.form === 'comment' && selectedId) {
      const text = (commentDrafts.get(draftKey(selectedId)) ?? '').trim();
      if (text) void mutate('comment', { id: selectedId, text });
    } else if (form.dataset.form === 'link' && selectedId && dependencyId) {
      void mutate('link', { id: selectedId, dependsOn: dependencyId, type: dependencyType });
    }
  }

  function onKey(event: KeyboardEvent): void {
    if (disposed || !root.isConnected || event.defaultPrevented || event.metaKey || event.altKey || event.ctrlKey) return;
    if (root.querySelector('[data-product-dialog]')) {
      if (event.key === 'Escape') { product.close(); event.preventDefault(); }
      return;
    }
    const target = event.target;
    if (projectPickerOpen) {
      if (event.key === 'Escape') {
        setProjectPicker(false);
        root.querySelector<HTMLButtonElement>('[data-action="toggle-project-picker"]')?.focus();
        event.preventDefault(); return;
      }
      if (target instanceof Element && target.closest('.project-picker') && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        const choices = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-action="choose-project"]:not(:disabled)'));
        const index = choices.indexOf(target as HTMLButtonElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? choices.length - 1
          : event.key === 'ArrowDown' ? Math.min(index + 1, choices.length - 1) : Math.max(index - 1, 0);
        choices[next]?.focus(); event.preventDefault(); return;
      }
      if (target instanceof Element && target.closest('.project-picker')) return;
    } else if (target instanceof Element && target.closest('[data-action="toggle-project-picker"]') && event.key === 'ArrowDown') {
      setProjectPicker(true, true); event.preventDefault(); return;
    }
    const menu = root.querySelector<HTMLDetailsElement>('.workflow-menu[open]');
    if (event.key === 'Escape' && menu) {
      menu.open = false; menu.querySelector<HTMLElement>('summary')?.focus();
      event.preventDefault(); return;
    }
    if (target instanceof Element && target.closest('.workflow-menu')) return;
    if (drag) {
      if (event.key === 'Escape') { endDrag(); flushAfterDrag(); event.preventDefault(); }
      return;
    }
    if (event.key === 'Escape') {
      if (createOpen && !pending) { createOpen = false; render(); event.preventDefault(); }
      else if (query) { query = ''; render(); event.preventDefault(); }
      else if (selectedId) { selectedId = ''; detail = null; detailSequence++; render(); event.preventDefault(); }
      return;
    }
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable) || createOpen) return;
    if (target instanceof Element && target.closest('[data-form="update"], [data-form="comment"], [data-form="link"]')) return;
    if (event.key === '/') { event.preventDefault(); root.querySelector<HTMLInputElement>('[data-focus="search"]')?.focus(); return; }
    if (event.key.toLowerCase() === 'n') { event.preventDefault(); openCreate(); return; }
    if (event.key.toLowerCase() === 'v') { layout = layout === 'board' ? 'table' : 'board'; render(); }
  }

  function spotlightItem(target: EventTarget | null): HTMLElement | null {
    if (!(target instanceof Element)) return null;
    const item = target.closest<HTMLElement>('.issue-card, .issue-table__row');
    return item && root.contains(item) ? item : null;
  }
  function onPointerOver(event: PointerEvent): void {
    if (event.pointerType === 'touch') return;
    const item = spotlightItem(event.target);
    if (item && item !== spotlightItem(event.relatedTarget)) { hoverId = item.dataset.id || ''; applySpotlight(); }
  }
  function onPointerOut(event: PointerEvent): void {
    if (event.pointerType === 'touch') return;
    const item = spotlightItem(event.target);
    if (item && item !== spotlightItem(event.relatedTarget)) { hoverId = ''; applySpotlight(); }
  }
  function onFocusIn(event: FocusEvent): void {
    const id = spotlightItem(event.target)?.dataset.id || '';
    if (id !== focusId) { focusId = id; if (!rendering) applySpotlight(); }
  }
  function onFocusOut(event: FocusEvent): void {
    const picker = root.querySelector('.project-picker');
    if (!rendering && projectPickerOpen && event.target instanceof Node && picker?.contains(event.target)
      && event.relatedTarget instanceof Node && !picker.contains(event.relatedTarget)) setProjectPicker(false);
    const menu = root.querySelector<HTMLDetailsElement>('.workflow-menu[open]');
    if (!rendering && menu && event.target instanceof Node && menu.contains(event.target)
      && event.relatedTarget instanceof Node && !menu.contains(event.relatedTarget)) menu.open = false;
    const item = spotlightItem(event.target);
    if (item && item !== spotlightItem(event.relatedTarget)) { focusId = ''; applySpotlight(); }
  }

  function dropTransition(issue: Issue, target: Group): { method?: 'claim' | 'close' | 'reopen'; hint: string } {
    const source = groupOf(issue);
    if (source === target) return { hint: `This issue is already in ${groupNames[target]}.` };
    if (target === 'blocked') return { hint: 'Blocked includes explicit status and dependency-blocked issues. Set the status in Beads or link a dependency.' };
    if (target === 'closed' && issue.status !== 'closed') return { method: 'close', hint: 'Close issue' };
    if (source === 'ready' && target === 'active') return { method: 'claim', hint: 'Claim issue' };
    if (source === 'closed' && target === 'ready') return { method: 'reopen', hint: 'Reopen issue; it may still be blocked' };
    return { hint: `Moving from ${groupNames[source]} to ${groupNames[target]} is not supported.` };
  }

  function endDrag(): void {
    drag = null;
    for (const card of root.querySelectorAll<HTMLElement>('.issue-card--dragging')) card.classList.remove('issue-card--dragging');
    for (const column of root.querySelectorAll<HTMLElement>('.column[data-drop-group]')) {
      column.classList.remove('column--drop-valid', 'column--drop-invalid', 'column--drop-over');
      const hint = column.querySelector<HTMLElement>('.column__drop-hint');
      if (hint) { hint.hidden = true; hint.textContent = ''; }
    }
  }

  function flushAfterDrag(): void {
    if (disposed || pending || projectLoadTask) return;
    if (projectsReloadPending) { projectsReloadPending = false; void loadProjects(); }
  }

  function onDragEnd(): void {
    endDrag();
    flushAfterDrag();
  }

  function onDragStart(event: DragEvent): void {
    const card = event.target instanceof Element ? event.target.closest<HTMLElement>('.issue-card[data-id]') : null;
    const issue = card ? byId(card.dataset.id || '') : undefined;
    if (!card || !issue || pending || offline() || !event.dataTransfer || event.target instanceof HTMLInputElement) { event.preventDefault(); return; }
    if (loadingSnapshot || loadingProjects || (selectedId && (detailLoading || commentsLoading))) {
      event.preventDefault();
      actionError = 'Wait for the current refresh or issue details to finish before moving this issue.';
      render();
      return;
    }
    drag = { id: issue.id, project: projectId };
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', issue.id);
    card.classList.add('issue-card--dragging');
    for (const column of root.querySelectorAll<HTMLElement>('.column[data-drop-group]')) {
      const target = column.dataset.dropGroup as Group;
      const transition = dropTransition(issue, target);
      column.classList.add(transition.method ? 'column--drop-valid' : 'column--drop-invalid');
      const hint = column.querySelector<HTMLElement>('.column__drop-hint');
      if (hint) { hint.textContent = transition.hint; hint.hidden = false; }
    }
  }

  function onDragOver(event: DragEvent): void {
    if (!drag) return;
    const column = event.target instanceof Element ? event.target.closest<HTMLElement>('.column[data-drop-group]') : null;
    if (!column || !root.contains(column)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    for (const other of root.querySelectorAll<HTMLElement>('.column--drop-over')) if (other !== column) other.classList.remove('column--drop-over');
    column.classList.add('column--drop-over');
  }

  function onDragLeave(event: DragEvent): void {
    const column = event.target instanceof Element ? event.target.closest<HTMLElement>('.column[data-drop-group]') : null;
    if (column && !(event.relatedTarget instanceof Node && column.contains(event.relatedTarget))) column.classList.remove('column--drop-over');
  }

  function onDrop(event: DragEvent): void {
    if (!drag) return;
    const column = event.target instanceof Element ? event.target.closest<HTMLElement>('.column[data-drop-group]') : null;
    if (!column || !root.contains(column)) return;
    event.preventDefault();
    const source = drag;
    const issue = source.project === projectId ? byId(source.id) : undefined;
    const target = column.dataset.dropGroup as Group;
    endDrag();
    if (!issue) { actionError = 'The issue or project changed during the drag. Refresh and try again.'; render(); flushAfterDrag(); return; }
    const transition = dropTransition(issue, target);
    if (!transition.method) { actionError = transition.hint; render(); flushAfterDrag(); return; }
    void mutate(transition.method, { id: issue.id });
  }

  function onVisibility(): void {
    if (!document.hidden && !pending && !drag && !refreshTask && !loadingProjects) {
      if (projectId) void refresh(); else void loadProjects();
    }
  }
  root.addEventListener('click', onClick);
  root.addEventListener('input', onInput);
  root.addEventListener('change', onChange);
  root.addEventListener('submit', onSubmit);
  root.addEventListener('pointerover', onPointerOver);
  root.addEventListener('pointerout', onPointerOut);
  root.addEventListener('focusin', onFocusIn);
  root.addEventListener('focusout', onFocusOut);
  root.addEventListener('dragstart', onDragStart);
  root.addEventListener('dragover', onDragOver);
  root.addEventListener('dragleave', onDragLeave);
  root.addEventListener('drop', onDrop);
  root.addEventListener('dragend', onDragEnd);
  document.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', onVisibility);
  document.addEventListener('pointerdown', onDocumentPointerDown);
  window.addEventListener('resize', onResize);
  const timer = window.setInterval(() => {
    if (!root.isConnected) { cleanup(); return; }
    if (!document.hidden && projectId && !pending && !drag && !refreshTask) void refresh();
  }, 15_000);
  function cleanup(): void {
    disposed = true;
    window.clearInterval(timer);
    root.removeEventListener('click', onClick);
    root.removeEventListener('input', onInput);
    root.removeEventListener('change', onChange);
    root.removeEventListener('submit', onSubmit);
    root.removeEventListener('pointerover', onPointerOver);
    root.removeEventListener('pointerout', onPointerOut);
    root.removeEventListener('focusin', onFocusIn);
    root.removeEventListener('focusout', onFocusOut);
    root.removeEventListener('dragstart', onDragStart);
    root.removeEventListener('dragover', onDragOver);
    root.removeEventListener('dragleave', onDragLeave);
    root.removeEventListener('drop', onDrop);
    root.removeEventListener('dragend', onDragEnd);
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('visibilitychange', onVisibility);
    document.removeEventListener('pointerdown', onDocumentPointerDown);
    window.removeEventListener('resize', onResize);
  }
  cleanups.set(root, cleanup);
  render();
  void loadProjects();
}
