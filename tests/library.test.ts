import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { LibraryService, type DocumentResult, type SavedFilter } from '../src/orca/library.js';
import { ProjectAccess, type ProductHost } from '../src/orca/projects.js';

// Exercise the public LibraryService/ProjectAccess seam with a real temporary
// workspace; only the native Orca host and, where needed, bd are external fakes.
async function fixture(run: (context: {
  root: string;
  host: ProductHost;
  library: LibraryService;
  opened: Array<{ workspaceId: string; path: string }>;
}) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), 'beads-library-'));
  const opened: Array<{ workspaceId: string; path: string }> = [];
  const storage = new Map<string, unknown>();
  const host: ProductHost = {
    host: { async call(method, params) {
      if (method === 'workspace.list') return { workspaces: [
        { id: 'workspace-one', name: 'Example', path: root, hostId: null, kind: 'folder', branch: null },
      ], truncated: false };
      if (method === 'workspace.readContext') return null;
      if (method === 'editor.open') {
        opened.push(params as { workspaceId: string; path: string });
        return { opened: true };
      }
      if (method === 'storage.get') return { value: storage.get(String(params?.key)) ?? null };
      if (method === 'storage.set') { storage.set(String(params?.key), params?.value); return { ok: true }; }
      throw new Error(`Unexpected host method: ${method}`);
    } },
    settings: { async get() { return ''; } },
  };
  try {
    await mkdir(join(root, '.beads'));
    await mkdir(join(root, 'docs'));
    await writeFile(join(root, 'docs', 'guide.md'), 'hello\n');
    const access = new ProjectAccess(host);
    await run({ root, host, library: new LibraryService(host, access), opened });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('a manually selected Markdown file opens only in its validated Orca workspace', async () => {
  await fixture(async ({ library, opened }) => {
    const expected: DocumentResult = {
      path: 'docs/guide.md', text: 'hello\n',
      hash: '5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03',
    };
    assert.deepEqual(await library.readDocument('workspace-one', 'docs/guide.md'), expected);
    assert.deepEqual(await library.request({ method: 'documents.open', project: 'workspace-one', input: { path: 'docs/guide.md' } }), {
      path: expected.path, opened: true,
    });
    assert.deepEqual(opened, [{ workspaceId: 'workspace-one', path: 'docs/guide.md' }]);
    await assert.rejects(library.request({ method: 'documents.open', project: 'workspace-one', input: { path: '../outside.md' } }), /path|relative|outside|travers/i);
    await assert.rejects(library.request({ method: 'documents.open', project: 'workspace-one', input: { path: 'docs/missing.md' } }), /not found|no such|enoent/i);
    assert.equal(opened.length, 1);
  });
});

test('document discovery uses explicit issue links, not file scans or code examples', async () => {
  await fixture(async ({ root, library }) => {
    const issue = {
      id: 'example-1', title: '[Overview](docs/guide.md#intro)',
      description: '[Outside](../outside.md) and [Reference][spec].\n\n[spec]: <docs/design%20notes.markdown> "Design"\n\n`[Example](docs/ignored.md)`\n\n![image](docs/image.md)\n\nUnlinked: docs/secret.md',
      notes: '```\n[Not a link](docs/code.md)\n```',
      acceptance_criteria: '[Missing](docs/missing.md), [Shortcut] and [Remote](https://example.com/external.md).\n\n[Shortcut]: docs/shortcut.md',
      design: '[Overview again](docs/guide.md). [Nested [plan]](docs/plan(one(two)).md)',
      status: 'open', priority: 2, issue_type: 'task',
      created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-02T00:00:00Z',
    };
    await writeFile(join(root, 'bd'), `#!${process.execPath}\nconst args = process.argv.slice(2);\nprocess.stdout.write(JSON.stringify((args.includes('show') || args.includes('list')) && !args.includes('dep') ? [${JSON.stringify(issue)}] : []));\n`, { mode: 0o755 });
    const previousPath = process.env.PATH;
    process.env.PATH = `${root}:${previousPath ?? ''}`;
    try {
      assert.deepEqual(await library.request({ method: 'documents.list', project: 'workspace-one', input: { id: 'example-1' } }), [
        { path: 'docs/guide.md', label: 'Overview', source: 'title' },
        { path: '../outside.md', label: 'Outside', source: 'description' },
        { path: 'docs/design notes.markdown', label: 'Reference', source: 'description' },
        { path: 'docs/missing.md', label: 'Missing', source: 'acceptance' },
        { path: 'docs/shortcut.md', label: 'Shortcut', source: 'acceptance' },
        { path: 'https://example.com/external.md', label: 'Remote', source: 'acceptance' },
        { path: 'docs/plan(one(two)).md', label: 'Nested [plan]', source: 'design' },
      ]);
    } finally {
      if (previousPath === undefined) delete process.env.PATH;
      else process.env.PATH = previousPath;
    }
  });
});

const readyFilter: SavedFilter = {
  id: 'ready-filter', name: 'Ready work',
  criteria: {
    query: 'payments', view: 'ready', layout: 'table', typeFilter: 'bug', priorityFilter: '1',
    assigneeFilter: '', showClosed: false, sortKey: 'updated', sortDirection: 'descending',
    projectNames: ['Example'], hostNames: ['Local'],
  },
};

test('personal saved filters remain dynamic, survive a service restart, and delete explicitly', async () => {
  await fixture(async ({ host, library }) => {
    assert.deepEqual(await library.request({ method: 'filters.save', input: { scope: 'personal', filter: readyFilter } }), readyFilter);
    const restarted = new LibraryService(host, new ProjectAccess(host));
    assert.deepEqual(await restarted.request({ method: 'filters.list' }), { personal: [readyFilter], project: [] });
    assert.deepEqual(await restarted.request({ method: 'filters.delete', input: { scope: 'personal', id: readyFilter.id } }), { deleted: true });
    assert.deepEqual(await restarted.request({ method: 'filters.list' }), { personal: [], project: [] });
    assert.deepEqual(await restarted.request({ method: 'filters.delete', input: { scope: 'personal', id: readyFilter.id } }), { deleted: false });
  });
});

test('concurrent personal saves retain both filters', async () => {
  await fixture(async ({ library }) => {
    const second: SavedFilter = { ...readyFilter, id: 'second', name: 'Second' };
    await Promise.all([readyFilter, second].map((filter) =>
      library.request({ method: 'filters.save', input: { scope: 'personal', filter } })));
    assert.deepEqual(await library.request({ method: 'filters.list' }), { personal: [readyFilter, second], project: [] });
  });
});

test('project filters are published explicitly as a portable reviewed file, and remain separate from personal filters', async () => {
  await fixture(async ({ root, library, host }) => {
    await library.request({ method: 'filters.save', input: { scope: 'personal', filter: readyFilter } });
    assert.deepEqual(await library.request({ method: 'filters.list', project: 'workspace-one' }), { personal: [readyFilter], project: [] });
    const path = join(root, '.beads-orca', 'filters.json');
    await assert.rejects(readFile(path, 'utf8'), /ENOENT/u);
    assert.deepEqual(await library.request({ method: 'filters.publish', project: 'workspace-one', input: { filter: readyFilter } }), readyFilter);
    assert.deepEqual(JSON.parse(await readFile(path, 'utf8')), { version: 1, filters: [readyFilter] });
    const restarted = new LibraryService(host, new ProjectAccess(host));
    assert.deepEqual(await restarted.request({ method: 'filters.list', project: 'workspace-one' }), { personal: [readyFilter], project: [readyFilter] });
    const changed: SavedFilter = { ...readyFilter, name: 'Updated' };
    await restarted.request({ method: 'filters.publish', project: 'workspace-one', input: { filter: changed } });
    assert.deepEqual(await restarted.request({ method: 'filters.delete', project: 'workspace-one', input: { scope: 'project', id: changed.id } }), { deleted: true });
    assert.deepEqual(await restarted.request({ method: 'filters.list', project: 'workspace-one' }), { personal: [readyFilter], project: [] });
  });
});

test('concurrent project publications preserve both reviewed filters', async () => {
  await fixture(async ({ library }) => {
    const second: SavedFilter = { ...readyFilter, id: 'second', name: 'Second' };
    await Promise.all([readyFilter, second].map((filter) => library.request({
      method: 'filters.publish', project: 'workspace-one', input: { filter },
    })));
    assert.deepEqual(await library.request({ method: 'filters.list', project: 'workspace-one' }), { personal: [], project: [readyFilter, second] });
  });
});

test('publication refuses private paths, connection identifiers and credentials without changing the reviewed file', async () => {
  await fixture(async ({ root, library }) => {
    await library.request({ method: 'filters.publish', project: 'workspace-one', input: { filter: readyFilter } });
    const path = join(root, '.beads-orca', 'filters.json');
    const before = await readFile(path, 'utf8');
    for (const criteria of [
      { ...readyFilter.criteria, projectNames: [root] },
      { ...readyFilter.criteria, hostNames: ['ssh:private-connection'] },
      { ...readyFilter.criteria, query: '/home/alice/private' },
      { ...readyFilter.criteria, query: 'password=hunter2' },
      { ...readyFilter.criteria, assigneeFilter: 'Bearer abcdefghijklmnop' },
    ]) {
      await assert.rejects(library.request({ method: 'filters.publish', project: 'workspace-one', input: { filter: { ...readyFilter, criteria } } }), /portable|private|secret|credential|path|scope/i);
      assert.equal(await readFile(path, 'utf8'), before);
    }
  });
});

test('publication refuses to overwrite malformed project settings', async () => {
  await fixture(async ({ root, library }) => {
    await mkdir(join(root, '.beads-orca'));
    await writeFile(join(root, '.beads-orca', 'filters.json'), '{ broken');
    await assert.rejects(library.request({ method: 'filters.publish', project: 'workspace-one', input: { filter: readyFilter } }), /filter|json|format/i);
    assert.equal(await readFile(join(root, '.beads-orca', 'filters.json'), 'utf8'), '{ broken');
  });
});

test('publication never writes into a workspace reassigned during the operation', async () => {
  await fixture(async ({ root, host, library }) => {
    const other = join(root, 'other');
    await mkdir(other);
    const call = host.host.call;
    let calls = 0;
    host.host.call = async (method, params) => {
      if (method === 'workspace.list' && ++calls >= 2) {
        return { workspaces: [{ id: 'workspace-one', name: 'Example', path: other, hostId: null, kind: 'folder', branch: null }], truncated: false };
      }
      return call(method, params);
    };
    await assert.rejects(library.request({ method: 'filters.publish', project: 'workspace-one', input: { filter: readyFilter } }), /workspace|project|path/i);
    await assert.rejects(readFile(join(root, '.beads-orca', 'filters.json'), 'utf8'), /ENOENT/u);
    await assert.rejects(readFile(join(other, '.beads-orca', 'filters.json'), 'utf8'), /ENOENT/u);
  });
});

test('confinement rejects linked or manually entered symlinks, traversal, and other file types', async () => {
  await fixture(async ({ root, library, opened }) => {
    const outside = await mkdtemp(join(tmpdir(), 'beads-library-outside-'));
    try {
      await writeFile(join(outside, 'secret.md'), 'not project content');
      await symlink(join(outside, 'secret.md'), join(root, 'docs', 'escape.md'));
      for (const path of ['docs/escape.md', '../secret.md', join(outside, 'secret.md'), 'docs/data.json']) {
        await assert.rejects(library.request({ method: 'documents.open', project: 'workspace-one', input: { path } }));
      }
      assert.deepEqual(opened, []);
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });
});

test('storage quota failure preserves previous filters and does not poison later saves', async () => {
  await fixture(async ({ host, library }) => {
    await library.request({ method: 'filters.save', input: { scope: 'personal', filter: readyFilter } });
    const call = host.host.call;
    host.host.call = async (method, params) => {
      if (method === 'storage.set') throw new Error('storage quota exceeded');
      return call(method, params);
    };
    const second: SavedFilter = { ...readyFilter, id: 'second', name: 'Second' };
    await assert.rejects(library.request({ method: 'filters.save', input: { scope: 'personal', filter: second } }), /quota/i);
    host.host.call = call;
    assert.deepEqual(await library.request({ method: 'filters.list' }), { personal: [readyFilter], project: [] });
    await library.request({ method: 'filters.save', input: { scope: 'personal', filter: second } });
    assert.deepEqual(await library.request({ method: 'filters.list' }), { personal: [readyFilter, second], project: [] });
  });
});

test('a symlinked project filter file is an error, not an absent file to overwrite', async () => {
  await fixture(async ({ root, library }) => {
    await mkdir(join(root, '.beads-orca'));
    await symlink(join(root, 'docs', 'guide.md'), join(root, '.beads-orca', 'filters.json'));
    await assert.rejects(library.request({ method: 'filters.publish', project: 'workspace-one', input: { filter: readyFilter } }), /link|path|symlink/i);
    assert.equal(await readFile(join(root, 'docs', 'guide.md'), 'utf8'), 'hello\n');
  });
});

test('opening fails rather than switching workspace if the native workspace changes identity', async () => {
  await fixture(async ({ root, host, library, opened }) => {
    const call = host.host.call;
    let calls = 0;
    let changedAt = 0;
    host.host.call = async (method, params) => {
      const result = await call(method, params);
      if (method === 'workspace.list' && ++calls === changedAt) {
        return { workspaces: [{ id: 'workspace-one', name: 'Example', path: join(root, 'other'), hostId: null, kind: 'folder', branch: null }], truncated: false };
      }
      return result;
    };
    const request = { method: 'documents.open', project: 'workspace-one', input: { path: 'docs/guide.md' } };
    await library.request(request);
    assert.ok(calls > 0);
    changedAt = calls;
    calls = 0;
    opened.length = 0;
    await assert.rejects(library.request(request), /workspace|project|path/i);
    assert.deepEqual(opened, []);
  });
});

test('opening does not follow a workspace reassigned between identity lookup and file validation', async () => {
  await fixture(async ({ root, host, library, opened }) => {
    const other = join(root, 'other');
    await mkdir(join(other, 'docs'), { recursive: true });
    await writeFile(join(other, 'docs', 'guide.md'), 'different workspace');
    const call = host.host.call;
    let calls = 0;
    host.host.call = async (method, params) => {
      if (method === 'workspace.list' && ++calls >= 2) {
        return { workspaces: [{ id: 'workspace-one', name: 'Example', path: other, hostId: null, kind: 'folder', branch: null }], truncated: false };
      }
      return call(method, params);
    };
    await assert.rejects(library.request({ method: 'documents.open', project: 'workspace-one', input: { path: 'docs/guide.md' } }), /workspace|project|path/i);
    assert.deepEqual(opened, []);
  });
});

test('project publication cannot smuggle undeclared fields or copy existing private IDs', async () => {
  await fixture(async ({ root, library }) => {
    await assert.rejects(library.request({
      method: 'filters.publish', project: 'workspace-one',
      input: { filter: { ...readyFilter, secret: 'do not publish' } },
    }), /field/i);
    await assert.rejects(library.request({
      method: 'filters.save',
      input: { scope: 'personal', filter: { ...readyFilter, criteria: { ...readyFilter.criteria, selectedIds: ['example-1'] } } },
    }), /field/i);
    await mkdir(join(root, '.beads-orca'));
    const existing = { ...readyFilter, id: 'existing', criteria: { ...readyFilter.criteria, query: 'workspace-one' } };
    const original = JSON.stringify({ version: 1, filters: [existing] });
    const path = join(root, '.beads-orca', 'filters.json');
    await writeFile(path, original);
    await assert.rejects(library.request({ method: 'filters.publish', project: 'workspace-one', input: { filter: readyFilter } }), /private|ID/i);
    assert.equal(await readFile(path, 'utf8'), original);
  });
});

test('an additional project path can be read but never opened as a fabricated workspace', async () => {
  await fixture(async ({ host, library, opened }) => {
    const extra = await mkdtemp(join(tmpdir(), 'beads-library-extra-'));
    try {
      await writeFile(join(extra, 'extra.md'), 'extra content');
      host.settings.get = async (key) => key === 'projectPaths' ? extra : '';
      const project = `path:${await realpath(extra)}`;
      const document = await library.readDocument(project, 'extra.md');
      assert.equal(document.text, 'extra content');
      await assert.rejects(library.request({ method: 'documents.open', project, input: { path: 'extra.md' } }), /workspace/i);
      assert.deepEqual(opened, []);
    } finally {
      await rm(extra, { recursive: true, force: true });
    }
  });
});

test('re-reading a selected document returns the current complete content and hash', async () => {
  await fixture(async ({ root, library }) => {
    const first = await library.readDocument('workspace-one', 'docs/guide.md');
    await writeFile(join(root, 'docs', 'guide.md'), 'updated content\n');
    const second = await library.readDocument('workspace-one', 'docs/guide.md');
    assert.equal(second.text, 'updated content\n');
    assert.notEqual(second.hash, first.hash);
  });
});

test('opening is not reported as successful when the native editor declines', async () => {
  await fixture(async ({ host, library }) => {
    const call = host.host.call;
    host.host.call = async (method, params) => method === 'editor.open' ? { opened: false } : call(method, params);
    await assert.rejects(library.request({ method: 'documents.open', project: 'workspace-one', input: { path: 'docs/guide.md' } }), /open/i);
  });
});

test('oversized documents still open, but RPC reads fail explicitly without truncation', async () => {
  await fixture(async ({ root, library, opened }) => {
    const content = '\\'.repeat(900_000);
    await writeFile(join(root, 'docs', 'large.md'), content);
    assert.equal((await library.readDocument('workspace-one', 'docs/large.md')).text, content);
    await assert.rejects(library.request({ method: 'documents.read', project: 'workspace-one', input: { path: 'docs/large.md' } }), /large|limit|editor/i);
    const result = await library.request({ method: 'documents.open', project: 'workspace-one', input: { path: 'docs/large.md' } });
    assert.deepEqual(result, { path: 'docs/large.md', opened: true });
    assert.deepEqual(opened, [{ workspaceId: 'workspace-one', path: 'docs/large.md' }]);
  });
});

test('opening a confined Markdown file larger than the read limit does not read or truncate it', async () => {
  await fixture(async ({ root, library, opened }) => {
    await writeFile(join(root, 'docs', 'huge.md'), 'x'.repeat(2 * 1024 * 1024 + 1));
    await assert.rejects(library.readDocument('workspace-one', 'docs/huge.md'), /large|limit|2 MiB/i);
    assert.deepEqual(await library.request({ method: 'documents.open', project: 'workspace-one', input: { path: 'docs/huge.md' } }), {
      path: 'docs/huge.md', opened: true,
    });
    assert.deepEqual(opened, [{ workspaceId: 'workspace-one', path: 'docs/huge.md' }]);
  });
});

test('oversized project filter lists fail visibly instead of overflowing native RPC or rewriting data', async () => {
  await fixture(async ({ root, library }) => {
    const filters = Array.from({ length: 24 }, (_, index) => ({
      ...readyFilter, id: `filter-${index}`, name: 'x'.repeat(64_000),
    }));
    const path = join(root, '.beads-orca', 'filters.json');
    await mkdir(join(root, '.beads-orca'));
    const original = JSON.stringify({ version: 1, filters });
    await writeFile(path, original);
    await assert.rejects(library.request({ method: 'filters.list', project: 'workspace-one' }), /large|limit/i);
    await assert.rejects(library.request({ method: 'filters.publish', project: 'workspace-one', input: { filter: readyFilter } }), /large|limit/i);
    assert.equal(await readFile(path, 'utf8'), original);
  });
});
