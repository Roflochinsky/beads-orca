import assert from 'node:assert/strict';
import test from 'node:test';
import activate from '../src/orca/worker.js';
import type { Project } from '../src/shared.js';

test('local workspaces remain selectable while remote paths cannot reach the local Beads adapter', async () => {
  let request: (input: unknown) => Promise<unknown> = async () => { throw new Error('Worker not activated'); };
  const workspaces = [
    { id: 'local-current', name: 'Current local', path: '/demo/project', hostId: 'local' },
    { id: 'local-legacy', name: 'Legacy local', path: '/demo/legacy', hostId: null },
    { id: 'ssh-project', name: 'SSH twin', path: '/demo/project', hostId: 'ssh:demo' },
    { id: 'wsl-project', name: 'WSL twin', path: '/demo/project', hostId: 'wsl:demo' },
    { id: 'paired-project', name: 'Paired twin', path: '/demo/project', hostId: 'runtime:demo' },
  ];
  activate({
    host: { async call(method) {
      if (method === 'workspace.list') return { workspaces, truncated: false };
      throw new Error(`Unexpected host method: ${method}`);
    } },
    settings: { async get() { return ''; } },
    panels: { handle(_name, handler) { request = handler; } },
  });
  const projects = await request({ method: 'projects' }) as Project[];
  assert.deepEqual(projects.map((project) => project.id), ['local-current', 'local-legacy']);
  for (const project of ['ssh-project', 'wsl-project', 'paired-project']) {
    await assert.rejects(request({ method: 'snapshot', project }), /registered project ID/);
  }
});
