import type { Issue, Project } from '../shared.js';
import type { ProjectIdentity } from './projects.js';

export interface TaskRef { project: string; id: string }
export interface DocumentRef { project: string; path: string; startLine?: number; endLine?: number }
export type Recipient = { kind: 'existing'; terminal: string } | { kind: 'new'; agent: string };
export interface HandoffGroup {
  tasks: TaskRef[];
  target: string;
  recipient: Recipient;
  mode: 'implementation' | 'research';
  documents: DocumentRef[];
}
export interface AgentDiscovery {
  sessions: { terminal: string; agent: string; state: string; workspace: string; host: string; sendable: boolean; reason?: string }[];
  providers: { id: string; name: string }[];
  warnings: string[];
}
export interface HandoffPreview {
  id: string;
  createdAt: string;
  group: HandoffGroup;
  source: Project;
  target: Project;
  accessIdentity: { source: ProjectIdentity; target: ProjectIdentity };
  actor: string;
  issues: Issue[];
  documents: (DocumentRef & { text: string; hash: string })[];
  blockers: { task: string; dependency: string; internal: boolean }[];
  warnings: string[];
  errors: string[];
  prompt: string;
  transportPrompt: string;
  contextPath: string | null;
  reportPath: string;
  fingerprint: string;
  /** Comparison details for fresh previews; older private history may omit them. */
  revalidation?: {
    targetIdentity: string;
    dependencies: { id: string; hash: string }[];
    readyIds: string[];
    blockedIds: string[];
    providerAvailable: boolean;
  };
  recipientState: AgentDiscovery['sessions'][number] | null;
}
export interface HandoffReport {
  version: 1;
  handoffId: string;
  summary: string;
  /** changes[] contains normalized target-workspace-relative file paths, not URLs or commit references. */
  tasks: { id: string; outcome: 'completed' | 'partial' | 'blocked' | 'not-started'; summary: string; changes: string[]; checks: { command: string; result: string }[] }[];
  comparisonBase: string | null;
}
export interface HistoryEntry {
  id: string;
  preview: HandoffPreview;
  delivery: 'draft' | 'unknown' | 'rejected' | 'input-accepted' | 'turn-started' | 'journaled' | 'handed-to-terminal';
  receipt?: unknown;
  error?: string;
  sentAt?: string;
  report?: HandoffReport;
  imported?: boolean;
  artifactsRemoved?: string[];
  publications?: { task: string; at: string; outcome: 'published' | 'unknown'; error?: string }[];
}
export interface HistoryExport { version: 1; warning: string; entries: HistoryEntry[] }
export interface WorktreePreview {
  id: string;
  project: Project;
  name: string;
  branch: string;
  base?: string;
  host: string;
  argv: string[];
  warnings: string[];
}
export interface WorkflowInputs {
  'agents.list': { target: string };
  'handoff.preview': { groups: HandoffGroup[] };
  'handoff.send': { id: string };
  'history.list': { offset?: number; limit?: number };
  'history.get': { id: string };
  'history.delete': { ids: string[] };
  'history.export': { ids: string[]; offset?: number; hash?: string };
  'history.import': { data: HistoryExport };
  'history.import.begin': Record<string, never>;
  'history.import.chunk': { id: string; text: string };
  'history.import.finish': { id: string };
  'handoff.report': { id: string };
  'handoff.openChange': { id: string; path: string };
  'handoff.cleanup': { id: string; paths: string[] };
  'history.publish': { id: string; taskIds: string[] };
  'workspace.open': { target: string };
  'worktree.preview': { project: string; name: string; branch: string; base?: string };
  'worktree.create': { id: string };
}
export interface WorkflowResults {
  'agents.list': AgentDiscovery;
  'handoff.preview': HandoffPreview[];
  'handoff.send': HistoryEntry;
  'history.list': { entries: HistoryEntry[]; nextOffset: number | null };
  'history.get': HistoryEntry;
  'history.delete': { deleted: string[] };
  'history.export': { version: 1; text: string; nextOffset: number | null; hash: string };
  'history.import': { imported: string[]; skipped: string[] };
  'history.import.begin': { id: string };
  'history.import.chunk': { received: number };
  'history.import.finish': { imported: string[]; skipped: string[] };
  'handoff.report': HistoryEntry;
  'handoff.openChange': { path: string; opened: true };
  'handoff.cleanup': HistoryEntry;
  'history.publish': HistoryEntry;
  'workspace.open': unknown;
  'worktree.preview': WorktreePreview;
  'worktree.create': { preview: WorktreePreview; result: unknown; outcome: 'created' | 'unknown'; error?: string };
}
export type WorkflowMethod = keyof WorkflowInputs;
export type WorkflowRequest = { [K in WorkflowMethod]: { method: K; input: WorkflowInputs[K] } }[WorkflowMethod];
