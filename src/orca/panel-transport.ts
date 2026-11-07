import type { RpcRequest } from '../shared.js';
import { CHUNK_UNITS, MAX_REPLY_BYTES, MAX_TRANSFERS, TRANSFER_VERSION, record, validId } from './transfer-protocol.js';

interface PanelHost {
  call(method: string, params: Record<string, unknown>): Promise<{ output: unknown }>;
}

/** Preserve the application request/result boundary; only this native adapter
 * knows about transfer envelopes. Aborting never promises to undo application work.
 */
export function createPanelTransport(host: PanelHost) {
  const active = new Set<AbortController>();
  let disposed = false;
  return {
    dispose(): void {
      disposed = true;
      for (const controller of active) controller.abort();
    },
    async request<T = unknown>(request: RpcRequest, options: { signal?: AbortSignal } = {}): Promise<T> {
      if (disposed) throw new Error('Beads panel transport is closed.');
      options.signal?.throwIfAborted();
      if (active.size >= MAX_TRANSFERS) throw new Error('Too many active Beads panel requests.');
      const requestId = crypto.randomUUID();
      const controller = new AbortController();
      const abort = () => controller.abort(options.signal?.reason);
      options.signal?.addEventListener('abort', abort, { once: true });
      active.add(controller);
      const invoke = async (fields: Record<string, unknown>) => {
        const { output } = await host.call('plugin.request', {
          name: 'beads', input: { beadsTransfer: TRANSFER_VERSION, requestId, ...fields }, timeoutMs: 120_000,
        });
        return output;
      };
      const release = () => { void invoke({ operation: 'release' }).catch(() => {}); };
      const { promise: cancelled, reject } = Promise.withResolvers<never>();
      const onAbort = () => reject(controller.signal.reason);
      controller.signal.addEventListener('abort', onAbort, { once: true });
      const send = async (fields: Record<string, unknown>) => {
        controller.signal.throwIfAborted();
        const pending = invoke(fields).then((output) => {
          // An initial reply can arrive after cancellation/release was delivered.
          if (controller.signal.aborted) release();
          return output;
        });
        return Promise.race([pending, cancelled]);
      };
      try {
        const first = await send({ operation: 'request', request });
        if (!record(first) || first.beadsTransfer !== TRANSFER_VERSION || first.requestId !== requestId) throw new Error('Invalid Beads reply identity or version.');
        if (first.kind === 'value' && Object.hasOwn(first, 'value')) return first.value as T;
        if (first.kind !== 'transfer' || !validId(first.transferId)
          || typeof first.units !== 'number' || !Number.isSafeInteger(first.units) || first.units < 1 || first.units > MAX_REPLY_BYTES
          || typeof first.chunks !== 'number' || first.chunks !== Math.ceil(first.units / CHUNK_UNITS)) throw new Error('Invalid Beads transfer descriptor.');
        const { transferId, units, chunks } = first;
        const parts: string[] = [];
        for (let index = 0; index < chunks; index++) {
          const chunk = await send({ operation: 'chunk', transferId, index });
          if (!record(chunk) || chunk.beadsTransfer !== TRANSFER_VERSION || chunk.kind !== 'chunk'
            || chunk.requestId !== requestId || chunk.transferId !== transferId || chunk.index !== index
            || typeof chunk.text !== 'string' || chunk.text.length !== Math.min(CHUNK_UNITS, units - index * CHUNK_UNITS)) throw new Error('Invalid Beads transfer chunk identity, order or length.');
          parts.push(chunk.text);
        }
        return JSON.parse(parts.join('')) as T;
      } finally {
        controller.signal.removeEventListener('abort', onAbort);
        options.signal?.removeEventListener('abort', abort);
        active.delete(controller);
        // Cleanup must never mask a result or an ambiguous mutation failure.
        // Lost release messages are covered by the worker's absolute lease.
        release();
      }
    },
  };
}
