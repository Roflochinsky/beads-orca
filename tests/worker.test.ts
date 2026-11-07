import assert from 'node:assert/strict';
import test from 'node:test';
import activate from '../src/orca/worker.js';
import type { Project } from '../src/shared.js';

test('workspaces on unsupported hosts remain visible and cannot reach a local Beads twin', async () => {
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
  assert.deepEqual(projects.map((project) => project.id), ['local-current', 'local-legacy', 'ssh-project', 'wsl-project', 'paired-project']);
  for (const project of ['ssh-project', 'wsl-project', 'paired-project']) {
    assert.equal(projects.find((candidate) => candidate.id === project)?.availability, 'unsupported');
    await assert.rejects(request({ method: 'snapshot', project }), /unsupported|mapping/i);
  }
});
