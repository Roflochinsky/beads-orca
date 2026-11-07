import { randomUUID } from 'node:crypto';
import {
  CHUNK_UNITS, INLINE_BYTES, MAX_REPLY_BYTES, MAX_RETAINED_BYTES, MAX_TRANSFERS,
  TRANSFER_TTL_MS, TRANSFER_VERSION, record, validId,
} from './transfer-protocol.js';

type Transfer = {
  timer: NodeJS.Timeout;
  cancelled: boolean;
  text?: string;
  transferId?: string;
  nextIndex: number;
};

/** One store per worker. Request UUIDs are per-call capabilities, never project IDs.
 * Chunk/release operations only access retained JSON; they never rerun application RPCs.
 * Expiry is absolute, including pending application work, not extended by chunk reads.
 */
export function createReplyHandler(application: (request: unknown) => Promise<unknown>): (input: unknown) => Promise<unknown> {
  const transfers = new Map<string, Transfer>();
  let retainedBytes = 0;
  function remove(requestId: string, transfer: Transfer): void {
    clearTimeout(transfer.timer);
    if (transfer.text !== undefined) retainedBytes -= transfer.text.length * 2;
    transfers.delete(requestId);
  }
  function cancel(requestId: string, transfer: Transfer): void {
    transfer.cancelled = true;
    // Pending calls keep their slot until they settle: cancellation is not proof
    // that a mutation stopped, and must not admit unbounded concurrent work.
    if (transfer.text !== undefined) remove(requestId, transfer);
  }
  return async (input) => {
    if (!record(input) || input.beadsTransfer !== TRANSFER_VERSION || !validId(input.requestId)) throw new Error('Invalid Beads transfer identity or version.');
    const requestId = input.requestId;
    if (input.operation === 'release') {
      const transfer = transfers.get(requestId);
      if (transfer) cancel(requestId, transfer);
      return { released: true };
    }
    if (input.operation === 'chunk') {
      const transfer = transfers.get(requestId);
      if (!transfer || transfer.cancelled || transfer.text === undefined) throw new Error('Beads transfer expired or unavailable. Refresh to read again; do not automatically retry a mutation.');
      if (input.transferId !== transfer.transferId || !Number.isSafeInteger(input.index) || input.index !== transfer.nextIndex) throw new Error('Invalid Beads transfer identity or chunk order.');
      const index = transfer.nextIndex;
      const start = index * CHUNK_UNITS;
      if (start >= transfer.text.length) throw new Error('Beads transfer is already complete.');
      const text = transfer.text.slice(start, start + CHUNK_UNITS);
      transfer.nextIndex++;
      // A split surrogate pair is escaped by JSON and joined before parsing.
      return { beadsTransfer: TRANSFER_VERSION, kind: 'chunk', requestId, transferId: transfer.transferId, index, text };
    }
    if (input.operation !== 'request' || !record(input.request) || typeof input.request.method !== 'string') throw new Error('Invalid Beads transfer request.');
    if (transfers.has(requestId)) throw new Error('Beads transfer request identity is already active.');
    if (transfers.size >= MAX_TRANSFERS) throw new Error('Too many active Beads transfers. Wait for a pending request to finish.');
    const transfer: Transfer = {
      timer: setTimeout(() => cancel(requestId, transfer), TRANSFER_TTL_MS),
      cancelled: false, nextIndex: 0,
    };
    transfer.timer.unref();
    transfers.set(requestId, transfer);
    try {
      const response = await application(input.request);
      if (transfer.cancelled) throw new Error('Beads transfer cancelled or expired. Application work may already have completed; it was not retried.');
      const text = JSON.stringify(response);
      if (text === undefined) throw new Error('Beads response must be JSON serializable.');
      const bytes = Buffer.byteLength(text);
      if (bytes <= INLINE_BYTES) {
        remove(requestId, transfer);
        return { beadsTransfer: TRANSFER_VERSION, kind: 'value', requestId, value: response };
      }
      if (bytes > MAX_REPLY_BYTES) throw new Error('Beads response exceeds the 32 MiB transfer limit. No data was truncated; the application request was not retried.');
      const cost = text.length * 2;
      if (retainedBytes + cost > MAX_RETAINED_BYTES) throw new Error('Beads transfer storage is full. No data was truncated; the application request was not retried.');
      transfer.text = text;
      transfer.transferId = randomUUID();
      retainedBytes += cost;
      return {
        beadsTransfer: TRANSFER_VERSION, kind: 'transfer', requestId,
        transferId: transfer.transferId, units: text.length, chunks: Math.ceil(text.length / CHUNK_UNITS),
      };
    } catch (error) {
      remove(requestId, transfer);
      throw error;
    }
  };
}
