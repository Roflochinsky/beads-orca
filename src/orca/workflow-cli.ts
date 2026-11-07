import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { HistoryEntry } from './workflow-types.js';

export interface WorkflowCli { run(argv: string[]): Promise<unknown> }
const execute = promisify(execFile);

export class WorkflowCliError extends Error {
  constructor(message: string, readonly receipt: unknown) { super(message); }
}

export class NativeWorkflowCli implements WorkflowCli {
  async run(argv: string[]): Promise<unknown> {
    const executable = process.env.ORCA_CLI_COMMAND || (process.env.ORCA_DEV_REPO_ROOT ? 'orca-dev' : process.platform === 'linux' ? 'orca-ide' : 'orca');
    // Never inherit a paired-server target from the worker's launch environment.
    // Every supported workspace is addressed explicitly through this desktop runtime.
    const env = { ...process.env };
    delete env.ORCA_PAIRING_CODE;
    delete env.ORCA_ENVIRONMENT;
    delete env.ELECTRON_RUN_AS_NODE;
    let stdout: string;
    try {
      const execution = execute(executable, [...argv, '--json'], { env, timeout: 90_000, maxBuffer: 16 * 1024 * 1024, windowsHide: true });
      execution.child.stdin?.end();
      ({ stdout } = await execution);
    } catch (error) {
      const failure = error && typeof error === 'object' ? error : {};
      // A nonzero process exit can still carry a durable operation ID/error receipt.
      const output = 'stdout' in failure ? String(failure.stdout) : '';
      let receipt: unknown = output;
      try { receipt = JSON.parse(output); } catch { /* Preserve the exact non-JSON diagnostic. */ }
      const refusal = receipt && typeof receipt === 'object' && 'error' in receipt
        ? `Orca CLI refused: ${JSON.stringify(receipt.error)}`
        : String(error);
      throw new WorkflowCliError(refusal, { receipt, stderr: 'stderr' in failure ? String(failure.stderr) : '', code: 'code' in failure ? failure.code : null });
    }
    let envelope: unknown;
    try { envelope = JSON.parse(stdout); } catch { throw new WorkflowCliError('Invalid Orca CLI JSON receipt', stdout); }
    if (!envelope || typeof envelope !== 'object') throw new WorkflowCliError('Invalid Orca CLI JSON receipt', envelope);
    const reply = envelope as Record<string, unknown>;
    if (reply.ok === false) throw new WorkflowCliError(`Orca CLI refused: ${JSON.stringify(reply.error)}`, envelope);
    if (reply.ok !== true || !('result' in reply)) throw new WorkflowCliError('Orca CLI returned no runtime receipt', envelope);
    return reply.result && typeof reply.result === 'object' && !Array.isArray(reply.result)
      ? { ...reply.result, _cli: { id: reply.id ?? null, meta: reply._meta ?? null } }
      : reply.result;
  }
}

export const EXISTING_SESSION_REASON = 'Existing-session handoff is unavailable: this Orca runtime has durable send receipts, but no atomic idle-only send gate. A precheck or plugin prompt hook cannot prevent a busy-state race. Choose a new CLI session.';

/** Receipt truth, never inferred from a terminal handle or an agent's done state. */
export function launchDelivery(value: unknown): HistoryEntry['delivery'] {
  if (!value || typeof value !== 'object') return 'unknown';
  const result = value as Record<string, unknown>;
  const launch = result.launch && typeof result.launch === 'object' ? result.launch as Record<string, unknown> : result;
  const outcome = launch.outcome as Record<string, unknown> | undefined;
  const prompt = launch.prompt as Record<string, unknown> | undefined;
  if (outcome?.kind !== 'terminal' || typeof outcome.handle !== 'string') return 'unknown';
  if (prompt?.outcome === 'handed-to-terminal') return 'handed-to-terminal';
  // Journaled means durable prompt retention, not proof of a started turn.
  if (prompt?.outcome === 'journaled') return 'journaled';
  return 'unknown';
}
