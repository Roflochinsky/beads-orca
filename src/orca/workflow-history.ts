import { createHash } from 'node:crypto';
import type { ProductHost } from './projects.js';
import type { HandoffPreview, HistoryEntry } from './workflow-types.js';

const INDEX = 'workflow.history.index.v1';
const CHUNK_UNITS = 24_000; // JSON escaping remains below the native 256 KiB/value limit.
const RECEIPT_RESERVE = 32_768;
interface Pointer { id: string; digest: string; chunks: number }

/** Immutable context chunks plus a small mutable record, private to this plugin profile. */
export class WorkflowHistory {
  constructor(private readonly host: ProductHost) {}
  private async get(key: string): Promise<unknown> {
    const response = await this.host.host.call('storage.get', { key });
    if (!response || typeof response !== 'object' || !('value' in response)) throw new Error('Invalid native storage response');
    return response.value;
  }
  private async index(): Promise<Pointer[]> {
    const value = await this.get(INDEX);
    if (value === null || value === undefined) return [];
    if (!Array.isArray(value) || value.some((item) => !item || typeof item !== 'object' || typeof item.id !== 'string' || !/^[a-zA-Z0-9-]+$/.test(item.id) || typeof item.digest !== 'string' || !/^[a-f0-9]{64}$/.test(item.digest) || !Number.isSafeInteger(item.chunks) || item.chunks < 1 || item.chunks > 1000)) throw new Error('Private history index is corrupt; nothing was overwritten');
    return value as Pointer[];
  }
  async list(): Promise<HistoryEntry[]> {
    const result: HistoryEntry[] = [];
    for (const pointer of await this.index()) {
      let context = '';
      for (let i = 0; i < pointer.chunks; i++) {
        const chunk = await this.get(`workflow.context.${pointer.id}.${i}`);
        if (typeof chunk !== 'string') throw new Error(`History context is missing for ${pointer.id}`);
        context += chunk;
      }
      if (createHash('sha256').update(context).digest('hex') !== pointer.digest) throw new Error(`History context integrity mismatch for ${pointer.id}`);
      const record = await this.get(`workflow.entry.${pointer.id}`);
      if (!record || typeof record !== 'object' || !('entry' in record) || !record.entry || typeof record.entry !== 'object') throw new Error(`History record is missing for ${pointer.id}`);
      const metadata = record.entry as Omit<HistoryEntry, 'preview'>;
      if (metadata.id !== pointer.id) throw new Error('History identity mismatch');
      const preview = JSON.parse(context) as HandoffPreview;
      result.push({ ...metadata, preview });
    }
    return result;
  }
  async save(entries: HistoryEntry[]): Promise<void> {
    const previous = await this.index();
    const next: Pointer[] = [];
    const created: string[] = [];
    try {
      for (const entry of entries) {
        if (!/^[a-zA-Z0-9-]+$/.test(entry.id)) throw new Error('Invalid history identity');
        const context = JSON.stringify(entry.preview);
        // Leave room for a 240 KiB receipt/report and framing under the native 1 MiB response cap.
        if (Buffer.byteLength(context) > 512 * 1024) throw new Error('Handoff preview exceeds the 512 KiB per-handoff context limit required by native panel RPC. Select fewer documents/tasks; no context was truncated.');
        const digest = createHash('sha256').update(context).digest('hex');
        const old = previous.find((pointer) => pointer.id === entry.id);
        if (old && old.digest !== digest) throw new Error('A stored handoff context is immutable; create a new preview');
        const chunks = Math.ceil(context.length / CHUNK_UNITS);
        if (!old) for (let i = 0; i < chunks; i++) {
          const key = `workflow.context.${entry.id}.${i}`;
          created.push(key);
          await this.host.host.call('storage.set', { key, value: context.slice(i * CHUNK_UNITS, (i + 1) * CHUNK_UNITS) });
        }
        const { preview: _preview, ...metadata } = entry;
        const serialized = JSON.stringify(metadata);
        // Reserve room while still a draft, before any file write or agent launch.
        const value = { entry: metadata, reserve: ' '.repeat(Math.max(0, RECEIPT_RESERVE - Buffer.byteLength(serialized))) };
        if (Buffer.byteLength(JSON.stringify(value)) > 240 * 1024) throw new Error('History receipt/report exceeds the native per-value capacity; stored context was not truncated');
        const key = `workflow.entry.${entry.id}`;
        if (!old) created.push(key);
        await this.host.host.call('storage.set', { key, value });
        next.push(old ?? { id: entry.id, digest, chunks });
      }
      if (Buffer.byteLength(JSON.stringify(next)) > 240 * 1024) throw new Error('History index is full; explicitly export/delete entries before continuing');
      await this.host.host.call('storage.set', { key: INDEX, value: next });
    } catch (error) {
      // Reclaim only newly allocated, unindexed chunks; existing history remains authoritative.
      for (const key of created) await this.host.host.call('storage.delete', { key }).catch(() => {});
      throw new Error(`Private history capacity/storage failure. No automatic eviction or truncation: ${String(error)}`);
    }
    for (const pointer of previous) if (!next.some((entry) => entry.id === pointer.id)) {
      await this.host.host.call('storage.delete', { key: `workflow.entry.${pointer.id}` });
      for (let i = 0; i < pointer.chunks; i++) await this.host.host.call('storage.delete', { key: `workflow.context.${pointer.id}.${i}` });
    }
  }
}
