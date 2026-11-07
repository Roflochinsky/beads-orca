import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { CHUNK_UNITS, MAX_REPLY_BYTES, MAX_TRANSFERS, TRANSFER_TTL_MS, record } from '../src/orca/transfer-protocol.js';
import { createReplyHandler } from '../src/orca/reply-transfer.js';
import { createPanelTransport } from '../src/orca/panel-transport.js';

function cappedHost(handler: (input: unknown) => Promise<unknown>) {
  const requests: Record<string, unknown>[] = [];
  const sizes: number[] = [];
  return {
    requests, sizes,
    async call(method: string, params: Record<string, unknown>): Promise<{ output: unknown }> {
      assert.equal(method, 'plugin.request');
      assert.equal(params.name, 'beads');
      assert.equal(params.timeoutMs, 120_000);
      assert.ok(Buffer.byteLength(JSON.stringify(params.input)) <= 64 * 1024);
      requests.push(params.input as Record<string, unknown>);
      const output = await handler(params.input);
      const wire = JSON.stringify({ output });
      sizes.push(Buffer.byteLength(wire));
      assert.ok(Buffer.byteLength(wire) < 1024 * 1024, 'native reply must stay below 1 MiB after JSON encoding');
      return JSON.parse(wire) as { output: unknown };
    },
  };
}

test('panel reconstructs every issue and long Unicode/escaped field through the capped native host', async () => {
  const snapshot = {
    project: { id: 'real-shape', name: 'develop' },
    issues: Array.from({ length: 1262 }, (_, index) => ({
      id: `task-${index}`, title: `Задача ${index} 🐋`,
      description: '漢字🙂"\\\n\t\u0000\ud800'.repeat(100),
    })),
    readyIds: ['task-1'], blockedIds: ['task-2'], fetchedAt: '2026-11-07T00:00:00.000Z',
  };
  assert.ok(Buffer.byteLength(JSON.stringify(snapshot)) > 1024 * 1024);
  const applicationRequests: unknown[] = [];
  const host = cappedHost(createReplyHandler(async (request) => {
    applicationRequests.push(request);
    return snapshot;
  }));
  const transport = createPanelTransport(host);
  const request = { method: 'snapshot', project: 'real-shape', input: { readonly: true } };
  assert.deepEqual(await transport.request(request), snapshot);
  assert.deepEqual(applicationRequests, [request], 'application request is forwarded unchanged exactly once');
  assert.ok(host.requests.some((request) => request.operation === 'chunk'));
  assert.equal(host.requests.at(-1)?.operation, 'release');
  assert.ok(host.sizes.every((size) => size < 512 * 1024));
});

test('small marker-shaped application values survive the versioned transport unchanged', async () => {
  const value = { beadsTransfer: 1, kind: 'transfer', requestId: 'application-owned', text: 'small' };
  const handler = createReplyHandler(async () => value);
  assert.deepEqual(await createPanelTransport(cappedHost(handler)).request({ method: 'projects' }), value);
});

test('worker rejects unversioned requests before application work can run', async () => {
  let applications = 0;
  const handler = createReplyHandler(async () => { applications++; return { ok: true }; });
  for (const input of [null, [], {}, { method: 'create', input: { title: 'Do not execute' } }]) {
    await assert.rejects(handler(input), /identity|version/);
  }
  assert.equal(applications, 0);
});

test('Unicode split across chunk boundaries is reconstructed before JSON parsing', async () => {
  // The opening quote consumes one unit; the high surrogate is the last unit of chunk zero.
  const value = 'a'.repeat(CHUNK_UNITS - 2) + '🙂' + '\\"漢\n'.repeat(CHUNK_UNITS);
  const transport = createPanelTransport(cappedHost(createReplyHandler(async () => value)));
  assert.equal(await transport.request({ method: 'documents.read' }), value);
});

test('application and chunk failures are never retried, including mutating requests', async () => {
  for (const failChunk of [false, true]) {
    let applications = 0;
    let chunks = 0;
    const failure = new Error(failChunk ? 'native chunk failed' : 'mutation outcome unknown');
    const handler = createReplyHandler(async () => {
      applications++;
      if (!failChunk) throw failure;
      return { text: 'x'.repeat(1024 * 1024) };
    });
    const host = cappedHost(async (input) => {
      assert.ok(record(input));
      if (input.operation === 'chunk') { chunks++; throw failure; }
      return handler(input);
    });
    await assert.rejects(createPanelTransport(host).request({ method: 'create', input: { title: 'Do not repeat' } }), (error) => error === failure);
    assert.equal(applications, 1);
    assert.equal(chunks, failChunk ? 1 : 0);
    assert.equal(host.requests.at(-1)?.operation, 'release');
    const begin = host.requests[0];
    await assert.rejects(handler({ beadsTransfer: 1, operation: 'chunk', requestId: begin.requestId, index: 0 }), /expired|unavailable/);
  }
});

test('independent panels never mix transfer identities and the worker enforces order', async () => {
  const handler = createReplyHandler(async (input) => {
    assert.ok(record(input));
    return { project: input.project, text: '漢🙂"\\'.repeat(150_000) };
  });
  const first = createPanelTransport(cappedHost(handler));
  const second = createPanelTransport(cappedHost(handler));
  const results = await Promise.all([
    first.request<{ project: string }>({ method: 'snapshot', project: 'one' }),
    second.request<{ project: string }>({ method: 'snapshot', project: 'two' }),
  ]);
  assert.deepEqual(results.map((result) => result.project), ['one', 'two']);
  const requestId = randomUUID();
  const descriptor = await handler({ beadsTransfer: 1, operation: 'request', requestId, request: { method: 'snapshot', project: 'one' } }) as Record<string, unknown>;
  const chunk = { beadsTransfer: 1, operation: 'chunk', requestId, transferId: descriptor.transferId, index: 0 };
  await assert.rejects(handler({ ...chunk, requestId: randomUUID() }), /expired|unavailable/);
  await assert.rejects(handler({ ...chunk, transferId: randomUUID() }), /identity/);
  await assert.rejects(handler({ ...chunk, index: 1 }), /order/);
  await assert.rejects(handler({ ...chunk, index: -1 }), /order/);
  await assert.rejects(handler({ ...chunk, index: 0.5 }), /order/);
  await handler(chunk);
  await assert.rejects(handler(chunk), /order/);
  await handler({ beadsTransfer: 1, operation: 'release', requestId });
  await assert.rejects(handler({ ...chunk, index: 1 }), /expired|unavailable/);
});

test('panel rejects malformed metadata and chunks and always releases the transfer', async () => {
  const corruptions = [
    { kind: 'transfer', units: MAX_REPLY_BYTES + 1 },
    { kind: 'transfer', chunks: 0 },
    { kind: 'transfer', transferId: 'invalid' },
    { kind: 'transfer', requestId: randomUUID() },
    { kind: 'chunk', requestId: randomUUID() },
    { kind: 'chunk', transferId: randomUUID() },
    { kind: 'chunk', index: 1 },
    { kind: 'chunk', text: 'short' },
    { kind: 'chunk', beadsTransfer: 2 },
  ];
  for (const corruption of corruptions) {
    const handler = createReplyHandler(async () => 'x'.repeat(1024 * 1024));
    const host = cappedHost(async (input) => {
      const output = await handler(input);
      assert.ok(record(output));
      if (output.kind === corruption.kind) return { ...output, ...corruption };
      return output;
    });
    await assert.rejects(createPanelTransport(host).request({ method: 'snapshot' }), /Invalid Beads/);
    assert.equal(host.requests.at(-1)?.operation, 'release');
  }
});

test('active and retained-memory bounds reject explicitly and released capacity is reusable', async () => {
  const handler = createReplyHandler(async (input) => {
    assert.ok(record(input) && record(input.input));
    assert.equal(typeof input.input.units, 'number');
    return 'a'.repeat(input.input.units as number);
  });
  const start = (requestId: string, units: number) => handler({
    beadsTransfer: 1, operation: 'request', requestId, request: { method: 'snapshot', input: { units } },
  });
  const release = (requestId: string) => handler({ beadsTransfer: 1, operation: 'release', requestId });
  const ids = Array.from({ length: MAX_TRANSFERS }, () => randomUUID());
  for (const id of ids) await start(id, 600_000);
  await assert.rejects(start(randomUUID(), 600_000), /Too many active/);
  await assert.rejects(start(ids[0], 600_000), /already active/);
  for (const id of ids) await release(id);
  const large = randomUUID();
  await start(large, 20 * 1024 * 1024);
  await assert.rejects(start(randomUUID(), 20 * 1024 * 1024), /storage is full/);
  await release(large);
  const replacement = randomUUID();
  await start(replacement, 20 * 1024 * 1024);
  await release(replacement);
  await assert.rejects(start(randomUUID(), MAX_REPLY_BYTES), /32 MiB/);
  await assert.rejects(handler({ beadsTransfer: 2, operation: 'request', requestId: randomUUID() }), /version/);
  await assert.rejects(handler({ beadsTransfer: 1, operation: 'request', requestId: 'not-an-id' }), /identity/);
});

test('abandoned transfers expire without requiring another request to trigger cleanup', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const handler = createReplyHandler(async () => 'a'.repeat(600_000));
  const requestId = randomUUID();
  const descriptor = await handler({ beadsTransfer: 1, operation: 'request', requestId, request: { method: 'snapshot' } }) as Record<string, unknown>;
  t.mock.timers.tick(TRANSFER_TTL_MS + 1);
  await assert.rejects(handler({ beadsTransfer: 1, operation: 'chunk', requestId, transferId: descriptor.transferId, index: 0 }), /expired/);
  // Reusing all slots proves expiry reclaimed capacity, not merely hid old data.
  for (let index = 0; index < MAX_TRANSFERS; index++) {
    await handler({ beadsTransfer: 1, operation: 'request', requestId: randomUUID(), request: { method: 'snapshot' } });
  }
  t.mock.timers.tick(TRANSFER_TTL_MS + 1);
});

test('cancellation and panel disposal release pending application results without retrying them', async () => {
  for (const disposal of [false, true]) {
    const result = Promise.withResolvers<unknown>();
    let applications = 0;
    const handler = createReplyHandler(async () => { applications++; return result.promise; });
    const host = cappedHost(handler);
    const transport = createPanelTransport(host);
    const controller = new AbortController();
    const pending = transport.request({ method: 'create' }, { signal: controller.signal });
    const rejected = assert.rejects(pending, /abort/i);
    if (disposal) transport.dispose(); else controller.abort();
    await rejected;
    result.resolve('a'.repeat(1024 * 1024));
    // Wait for the already-started handler to settle, not a second application call.
    await result.promise;
    assert.equal(applications, 1);
    assert.equal(host.requests.filter((request) => request.operation === 'request').length, 1);
    assert.ok(host.requests.some((request) => request.operation === 'release'));
    await assert.rejects(handler({ beadsTransfer: 1, operation: 'chunk', requestId: host.requests[0].requestId, index: 0 }), /expired|unavailable/);
    if (disposal) await assert.rejects(transport.request({ method: 'projects' }), /closed/);
  }
});

test('expired or cancelled pending requests keep bounded admission until application work settles', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const result = Promise.withResolvers<unknown>();
  let applications = 0;
  const handler = createReplyHandler(async () => { applications++; return result.promise; });
  const ids = Array.from({ length: MAX_TRANSFERS }, () => randomUUID());
  const pending = ids.map((requestId) => handler({
    beadsTransfer: 1, operation: 'request', requestId, request: { method: 'create' },
  }));
  const outcomes = Promise.allSettled(pending);
  await handler({ beadsTransfer: 1, operation: 'release', requestId: ids[0] });
  t.mock.timers.tick(TRANSFER_TTL_MS + 1);
  await assert.rejects(handler({
    beadsTransfer: 1, operation: 'request', requestId: randomUUID(), request: { method: 'create' },
  }), /Too many active/);
  assert.equal(applications, MAX_TRANSFERS);
  result.resolve('a'.repeat(600_000));
  for (const outcome of await outcomes) {
    assert.equal(outcome.status, 'rejected');
    if (outcome.status === 'rejected') assert.match(String(outcome.reason), /cancelled|expired/);
  }
  const requestId = randomUUID();
  const descriptor = await handler({
    beadsTransfer: 1, operation: 'request', requestId, request: { method: 'snapshot' },
  });
  assert.ok(record(descriptor));
  assert.equal(descriptor.kind, 'transfer');
  await handler({ beadsTransfer: 1, operation: 'release', requestId });
});

test('a lost release reply cannot change a successful application result', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const expected = { text: '漢🙂'.repeat(200_000) };
  const handler = createReplyHandler(async () => expected);
  const host = cappedHost(async (input) => {
    assert.ok(record(input));
    if (input.operation === 'release') throw new Error('panel disconnected');
    return handler(input);
  });
  assert.deepEqual(await createPanelTransport(host).request({ method: 'snapshot' }), expected);
  t.mock.timers.tick(TRANSFER_TTL_MS + 1);
  await assert.rejects(handler({
    beadsTransfer: 1, operation: 'chunk', requestId: host.requests[0].requestId, index: 0,
  }), /expired|unavailable/);
});
