import assert from 'node:assert/strict';
import test from 'node:test';
import { WorkflowHistory } from '../src/orca/workflow-history.js';
import { launchDelivery } from '../src/orca/workflow-cli.js';
import { parseReport, parseHistoryImport } from '../src/orca/workflow-validation.js';
import type { HistoryEntry } from '../src/orca/workflow-types.js';

const report = { version: 1, handoffId: 'abc', summary: 'Partial result', comparisonBase: null, tasks: [{ id: 'A', outcome: 'partial', summary: 'Code changed; verification missing', changes: ['src/feature.ts'], checks: [] }] };
test('structured reports reject foreign, duplicated, and missing tasks without inventing checks', () => {
  assert.equal(parseReport(report, 'abc', ['A']).tasks[0].outcome, 'partial');
  assert.throws(() => parseReport(report, 'other', ['A']), /handoff/);
  assert.throws(() => parseReport(report, 'abc', ['A', 'B']), /every selected task/);
  assert.throws(() => parseReport({ ...report, tasks: [...report.tasks, ...report.tasks] }, 'abc', ['A']), /Duplicate/);
  assert.throws(() => parseReport({ ...report, tasks: [{ ...report.tasks[0], id: 'B' }] }, 'abc', ['A']), /Foreign/);
});
test('report changes are workspace-relative file paths rather than arbitrary navigation targets', () => {
  for (const path of ['/etc/passwd', '../outside.ts', 'src/../outside.ts', 'file:///private/file', 'https://example.test/file', 'C:\\\\private\\\\file.ts', 'src//file.ts', './src/file.ts', 'src/file.ts' + String.fromCharCode(0)]) {
    assert.throws(() => parseReport({ ...report, tasks: [{ ...report.tasks[0], changes: [path] }] }, 'abc', ['A']), /workspace-relative/);
  }
  assert.deepEqual(parseReport({ ...report, tasks: [{ ...report.tasks[0], changes: ['src/with spaces.ts'] }] }, 'abc', ['A']).tasks[0].changes, ['src/with spaces.ts']);
});
test('a handle or accepted launch is not a prompt delivery proof', () => {
  assert.equal(launchDelivery({ terminalId: 'term:1', accepted: true }), 'unknown');
  assert.equal(launchDelivery({ outcome: { kind: 'structured', handle: 'chat:1' }, prompt: { outcome: 'journaled' } }), 'unknown');
  assert.equal(launchDelivery({ outcome: { kind: 'terminal', handle: 'term:1' }, prompt: { outcome: 'journaled' } }), 'journaled');
});
test('malformed imports cannot introduce live cleanup paths', () => {
  assert.throws(() => parseHistoryImport({ version: 1, entries: [{ id: '../../outside', preview: {} }] }), /history|handoff|Invalid/i);
});
test('private context is chunked below native value capacity and survives explicit deletion', async () => {
  const values = new Map<string, unknown>();
  const history = new WorkflowHistory({ host: { async call(method, params) {
    const key = String(params?.key);
    if (method === 'storage.get') return { value: values.get(key) };
    if (method === 'storage.set') {
      assert.ok(Buffer.byteLength(JSON.stringify(params?.value)) <= 256 * 1024, 'native per-value limit');
      values.set(key, structuredClone(params?.value)); return {};
    }
    if (method === 'storage.delete') { values.delete(key); return {}; }
    throw new Error(method);
  } }, settings: { async get() {} } });
  const entry = { id: 'abc', preview: { prompt: 'Full context. '.repeat(30_000) }, delivery: 'draft' } as unknown as HistoryEntry;
  await history.save([entry]);
  assert.deepEqual(await history.list(), [entry]);
  await history.save([]);
  assert.deepEqual(await history.list(), []);
  assert.equal([...values.keys()].filter((key) => key.startsWith('workflow.context.')).length, 0);
});
