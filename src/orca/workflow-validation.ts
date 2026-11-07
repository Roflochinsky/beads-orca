import type { HandoffReport, HistoryEntry } from './workflow-types.js';

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid history/report object');
  return value as Record<string, unknown>;
}
function string(value: unknown): asserts value is string {
  if (typeof value !== 'string') throw new Error('Invalid history/report string');
}
function array(value: unknown): asserts value is unknown[] {
  if (!Array.isArray(value)) throw new Error('Invalid history/report array');
}
function stringArray(value: unknown): asserts value is string[] {
  array(value); value.forEach(string);
}

/** LF-delimited lines retain their exact terminators; a final LF does not add a phantom line. */
export function documentLines(text: string): string[] {
  return text.match(/[^\n]*\n|[^\n]+$/g) ?? [];
}

export function documentRange(value: { startLine?: unknown; endLine?: unknown; path?: unknown }, lineCount?: number): { startLine: number; endLine: number } | Record<string, never> {
  const { startLine, endLine } = value;
  if (startLine === undefined && endLine === undefined) return {};
  const label = `Document ${String(value.path ?? '')} line range`;
  if (typeof startLine !== 'number' || typeof endLine !== 'number' || !Number.isSafeInteger(startLine) || !Number.isSafeInteger(endLine) || startLine < 1 || endLine < startLine) {
    throw new Error(`${label}: provide both first and last lines as positive integers, with first <= last`);
  }
  if (lineCount !== undefined && endLine > lineCount) throw new Error(`${label} ${startLine}-${endLine} exceeds the file's ${lineCount} lines; no text was clipped`);
  return { startLine, endLine };
}

export function parseReport(value: unknown, handoffId: string, taskIds: string[]): HandoffReport {
  const report = record(value);
  if (report.version !== 1 || report.handoffId !== handoffId) throw new Error('Report handoff/version does not match');
  string(report.summary);
  if (report.comparisonBase !== null) string(report.comparisonBase);
  array(report.tasks);
  const seen = new Set<string>();
  const tasks: HandoffReport['tasks'] = report.tasks.map((value) => {
    const task = record(value);
    string(task.id); string(task.summary); stringArray(task.changes); array(task.checks);
    for (const path of task.changes) {
      if (!path || path.startsWith('/') || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(path) || /[\\\u0000-\u001f\u007f]/.test(path)
        || path.split('/').some((part) => !part || part === '.' || part === '..')) {
        throw new Error('Reported changes must be normalized workspace-relative file paths');
      }
    }
    if (!taskIds.includes(task.id)) throw new Error('Foreign task in report');
    if (seen.has(task.id)) throw new Error('Duplicate task in report');
    seen.add(task.id);
    if (task.outcome !== 'completed' && task.outcome !== 'partial' && task.outcome !== 'blocked' && task.outcome !== 'not-started') throw new Error('Invalid task outcome');
    const checks = task.checks.map((value) => { const check = record(value); string(check.command); string(check.result); return { command: check.command, result: check.result }; });
    return { id: task.id, summary: task.summary, outcome: task.outcome, changes: task.changes, checks };
  });
  if (seen.size !== taskIds.length) throw new Error('Report must include every selected task');
  return { version: 1, handoffId, summary: report.summary, comparisonBase: report.comparisonBase, tasks };
}

/** Imports are validated for display, then made inert: never dispatch or mutate their recorded paths. */
export function parseHistoryImport(value: unknown): HistoryEntry[] {
  const data = record(value);
  if (data.version !== 1) throw new Error('Unsupported history export version');
  array(data.entries);
  const seen = new Set<string>();
  return data.entries.map((value) => {
    const entry = record(value), preview = record(entry.preview);
    string(entry.id);
    if (!/^[a-zA-Z0-9-]{1,100}$/.test(entry.id) || seen.has(entry.id) || preview.id !== entry.id) throw new Error('Invalid or duplicate history handoff ID');
    seen.add(entry.id);
    if (!['draft', 'unknown', 'rejected', 'input-accepted', 'turn-started', 'journaled', 'handed-to-terminal'].includes(String(entry.delivery))) throw new Error('Invalid history delivery state');
    for (const field of ['createdAt', 'actor', 'prompt', 'transportPrompt', 'reportPath', 'fingerprint']) string(preview[field]);
    if (preview.contextPath !== null) string(preview.contextPath);
    stringArray(preview.warnings); stringArray(preview.errors);
    for (const key of ['source', 'target']) {
      const project = record(preview[key]);
      for (const field of ['id', 'name', 'path']) string(project[field]);
      for (const field of ['hostId', 'hostName', 'workspaceId', 'availabilityReason', 'lastFetchedAt']) if (project[field] !== undefined && project[field] !== null) string(project[field]);
    }
    const identities = record(preview.accessIdentity);
    for (const key of ['source', 'target']) {
      const identity = record(identities[key]);
      string(identity.path); string(identity.fingerprint);
      if (identity.hostId !== null) string(identity.hostId);
      if (identity.workspaceId !== null) string(identity.workspaceId);
    }
    const group = record(preview.group), recipient = record(group.recipient);
    string(group.target);
    if (group.mode !== 'implementation' && group.mode !== 'research') throw new Error('Invalid history handoff mode');
    if (recipient.kind === 'new') string(recipient.agent);
    else if (recipient.kind === 'existing') string(recipient.terminal);
    else throw new Error('Invalid history recipient');
    array(group.tasks); array(group.documents); array(preview.documents); array(preview.issues); array(preview.blockers);
    const ids: string[] = [];
    for (const value of group.tasks) { const task = record(value); string(task.project); string(task.id); ids.push(task.id); }
    if (!ids.length || new Set(ids).size !== ids.length) throw new Error('Invalid history tasks');
    for (const value of group.documents) { const doc = record(value); string(doc.project); string(doc.path); documentRange(doc); }
    for (const value of preview.documents) {
      const doc = record(value);
      for (const key of ['project', 'path', 'text', 'hash']) string(doc[key]);
      const range = documentRange(doc);
      if (range.startLine !== undefined && documentLines(doc.text as string).length !== range.endLine - range.startLine + 1) throw new Error('History document line range does not match its selected text');
    }
    const selectedDocuments = group.documents, includedDocuments = preview.documents;
    const hasFragments = selectedDocuments.some((value) => record(value).startLine !== undefined) || includedDocuments.some((value) => record(value).startLine !== undefined);
    if (hasFragments && (selectedDocuments.length !== includedDocuments.length || selectedDocuments.some((value, index) => {
      const selected = record(value), included = record(includedDocuments[index]);
      // Recorded paths may be canonicalized by document IO; bounds must still agree.
      return selected.startLine !== included.startLine || selected.endLine !== included.endLine;
    }))) throw new Error('History document selection does not match its preview');
    for (const value of preview.issues) {
      const issue = record(value);
      for (const key of ['id', 'title', 'description', 'status', 'type', 'assignee', 'updatedAt', 'createdAt']) string(issue[key]);
      if (typeof issue.priority !== 'number' || !Number.isFinite(issue.priority)) throw new Error('Invalid history priority');
      stringArray(issue.labels); array(issue.dependencies);
      for (const value of issue.dependencies) { const dep = record(value); string(dep.id); string(dep.type); }
      for (const key of ['acceptance', 'notes', 'design', 'closedAt', 'dueAt', 'deferUntil', 'heartbeatAt']) if (issue[key] !== undefined) string(issue[key]);
    }
    for (const value of preview.blockers) { const blocker = record(value); string(blocker.task); string(blocker.dependency); if (typeof blocker.internal !== 'boolean') throw new Error('Invalid history blocker'); }
    if (preview.recipientState !== null) {
      const session = record(preview.recipientState);
      for (const key of ['terminal', 'agent', 'state', 'workspace', 'host']) string(session[key]);
      if (typeof session.sendable !== 'boolean') throw new Error('Invalid history session');
      if (session.reason !== undefined) string(session.reason);
    }
    if (preview.revalidation !== undefined) {
      const state = record(preview.revalidation);
      string(state.targetIdentity); stringArray(state.readyIds); stringArray(state.blockedIds); array(state.dependencies);
      if (typeof state.providerAvailable !== 'boolean') throw new Error('Invalid history provider availability');
      for (const value of state.dependencies) { const dep = record(value); string(dep.id); string(dep.hash); }
    }
    for (const key of ['error', 'sentAt']) if (entry[key] !== undefined) string(entry[key]);
    if (entry.artifactsRemoved !== undefined) stringArray(entry.artifactsRemoved);
    if (entry.publications !== undefined) {
      array(entry.publications);
      for (const value of entry.publications) { const publication = record(value); string(publication.task); string(publication.at); if (publication.outcome !== 'published' && publication.outcome !== 'unknown') throw new Error('Invalid history publication'); if (publication.error !== undefined) string(publication.error); }
    }
    const report = entry.report === undefined ? undefined : parseReport(entry.report, entry.id, ids);
    // Every field used by history UI has been checked above. Imported records stay read-only.
    const imported = structuredClone(entry) as unknown as HistoryEntry;
    imported.imported = true;
    if (report) imported.report = report;
    return imported;
  });
}
