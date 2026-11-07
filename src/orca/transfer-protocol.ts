// Native plugin.request permits 1 MiB replies. A JSON string costs at most six
// bytes per UTF-16 code unit, so even a maximally escaped chunk is < 400 KiB.
export const TRANSFER_VERSION = 1;
export const CHUNK_UNITS = 64 * 1024;
export const INLINE_BYTES = 512 * 1024;
export const MAX_REPLY_BYTES = 32 * 1024 * 1024;
export const MAX_RETAINED_BYTES = 64 * 1024 * 1024;
export const MAX_TRANSFERS = 8;
export const TRANSFER_TTL_MS = 120_000;

export function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function validId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
