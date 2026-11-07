import assert from 'node:assert/strict';
import test from 'node:test';
import type { Issue, Snapshot } from '../src/shared.js';
import { createIssueModel, resolveEpicProject, selectIssues, virtualRange } from '../src/ui/model.js';

const issue = (id: string, options: Partial<Issue> = {}): Issue => ({
  id, title: id, description: '', status: 'open', priority: 2, type: 'task', assignee: '',
  labels: [], dependencies: [], createdAt: '', updatedAt: '', ...options,
});
const snapshot = (issues: Issue[], readyIds: string[] = [], blockedIds: string[] = []): Snapshot => ({
  project: { id: 'project', name: 'Project', path: '/fixture' }, issues, readyIds, blockedIds, fetchedAt: '',
});
const parent = (id: string) => ({ id, type: 'parent-child' });
const facets = { query: '', typeFilter: '', priorityFilter: '', assigneeFilter: '', epic: undefined, view: 'all' as const, showClosed: true };

test('epic selection follows parent-child descendants, includes the epic, and excludes missing ancestry from No epic', () => {
  const model = createIssueModel(snapshot([
    issue('epic', { type: 'epic' }), issue('child', { dependencies: [parent('epic')] }),
    issue('grandchild', { dependencies: [parent('child'), parent('epic')] }),
    issue('cycle-a', { dependencies: [parent('cycle-b')] }), issue('cycle-b', { dependencies: [parent('cycle-a')] }),
    issue('missing', { dependencies: [parent('not-loaded')] }), issue('unknown-child', { dependencies: [parent('missing')] }),
    issue('blocked-link', { dependencies: [{ id: 'epic', type: 'blocks' }] }),
  ]));
  assert.deepEqual(selectIssues(model, { ...facets, epic: 'epic' }).visible.map((row) => row.id).sort(), ['child', 'epic', 'grandchild']);
  assert.deepEqual(selectIssues(model, { ...facets, epic: null }).visible.map((row) => row.id).sort(), ['blocked-link', 'cycle-a', 'cycle-b']);
});

test('epic ancestry handles cyclic and multiply connected paths without duplicate issues', () => {
  const model = createIssueModel(snapshot([
    issue('epic', { type: 'epic', dependencies: [parent('loop-b')] }),
    issue('loop-a', { dependencies: [parent('epic'), parent('loop-b')] }),
    issue('loop-b', { dependencies: [parent('loop-a')] }),
    issue('deep', { dependencies: [parent('loop-a'), parent('loop-b')] }),
  ]));
  assert.deepEqual(selectIssues(model, { ...facets, epic: 'epic' }).visible.map((row) => row.id).sort(), ['deep', 'epic', 'loop-a', 'loop-b']);
  assert.deepEqual(selectIssues(model, { ...facets, epic: null }).visible, []);
});

test('displayed epic is the nearest epic ancestor, including a nested epic itself', () => {
  const model = createIssueModel(snapshot([
    issue('outer', { type: 'epic' }),
    issue('inner', { type: 'epic', dependencies: [parent('outer')] }),
    issue('task', { dependencies: [parent('inner')] }),
  ]));
  assert.equal(model.epicFor(model.byId.get('task')!)?.id, 'inner');
  assert.equal(model.epicFor(model.byId.get('inner')!)?.id, 'inner');
});

test('saved epic qualifiers select exactly one registered project and never resolve an ambiguous twin', () => {
  const projects = [
    { id: 'local', name: 'Beads', path: '/one' },
    { id: 'remote', name: 'Beads', path: '/two', hostId: 'ssh:host', hostName: 'Remote' },
  ];
  assert.deepEqual(resolveEpicProject(projects, { projectName: 'Beads', hostName: 'Remote' }), { kind: 'matched', project: projects[1] });
  assert.deepEqual(resolveEpicProject([...projects, { id: 'twin', name: 'Beads', path: '/three' }], { projectName: 'Beads', hostName: 'Local' }), { kind: 'ambiguous' });
  assert.deepEqual(resolveEpicProject(projects, { projectName: 'Beads', hostName: 'Other' }), { kind: 'missing' });
});

test('faceted counts precede status and include-closed; dependency grouping does not erase raw status', () => {
  const model = createIssueModel(snapshot([
    issue('ready', { priority: 0 }),
    issue('active', { priority: 0, status: 'in_progress' }),
    issue('blocked', { priority: 0, status: 'in_progress' }),
    issue('closed', { priority: 0, status: 'closed' }),
    issue('deferred', { priority: 1, status: 'deferred' }),
  ], ['ready'], ['blocked']));
  const result = selectIssues(model, { ...facets, priorityFilter: '0', view: 'closed', showClosed: false });
  assert.deepEqual(result.counts, { all: 4, ready: 1, active: 1, blocked: 1, closed: 1, deferred: 0, other: 0 });
  assert.deepEqual(result.visible.map((row) => row.id), ['closed']);
  assert.equal(model.byId.get('blocked')?.status, 'in_progress');
  assert.equal(model.groupOf(model.byId.get('blocked')!), 'blocked');
  assert.deepEqual(selectIssues(model, { ...facets, showClosed: false }).visible.map((row) => row.id), ['ready', 'active', 'blocked', 'deferred']);
});

test('virtual windows cover both ends and variable-height boundaries without exceeding the model', () => {
  const offsets = [0, 10, 30, 60, 100, 150];
  assert.deepEqual(virtualRange(offsets, 0, 15, 1), { start: 0, end: 3, before: 0, after: 90 });
  assert.deepEqual(virtualRange(offsets, 90, 60, 1), { start: 2, end: 5, before: 30, after: 0 });
  assert.deepEqual(virtualRange([0], 0, 100, 2), { start: 0, end: 0, before: 0, after: 0 });
});

test('search intersects the other facets before counts and matches labels and descriptions', () => {
  const model = createIssueModel(snapshot([
    issue('one', { description: 'Native Markdown', priority: 1 }),
    issue('two', { labels: ['markdown'], priority: 1, status: 'in_progress' }),
    issue('three', { title: 'Markdown', priority: 2 }),
  ], ['one']));
  const result = selectIssues(model, { ...facets, query: 'MARKDOWN', priorityFilter: '1', view: 'ready' });
  assert.equal(result.counts.all, 2);
  assert.equal(result.counts.ready, 1);
  assert.equal(result.counts.active, 1);
  assert.deepEqual(result.visible.map((row) => row.id), ['one']);
});
