import { basename, isAbsolute } from 'node:path';
import { realpath } from 'node:fs/promises';
import { handleRequest } from '../core/service.js';
import type { Project, RpcRequest, Snapshot } from '../shared.js';

type Workspace = { id: string; name: string; path: string; hostId: string | null };
interface OrcaHost {
  host: {
    call(method: 'workspace.list'): Promise<{ workspaces: Workspace[]; truncated: boolean }>;
    call(method: 'statusBar.update', params: { id: string; text: string; tooltip: string }): Promise<unknown>;
  };
  settings: { get(key: string): Promise<unknown> };
  panels: { handle(name: string, handler: (input: unknown) => Promise<unknown>): void };
}

async function projectsFor(orca: OrcaHost): Promise<Project[]> {
  const result = await orca.host.call('workspace.list');
  if (result.truncated) throw new Error('Orca truncated its workspace list. Narrow the registered workspaces before using Beads.');
  const projects: Project[] = result.workspaces
    .filter((workspace) => workspace.hostId === null)
    .map(({ id, name, path }) => ({ id, name, path }));
  const configured = await orca.settings.get('projectPaths');
  if (typeof configured === 'string') {
    for (const line of configured.split('\n').map((value) => value.trim()).filter(Boolean)) {
      if (!isAbsolute(line)) throw new Error('Beads project paths must be absolute.');
      const path = await realpath(line);
      if (!projects.some((project) => project.path === path)) projects.push({ id: `path:${path}`, name: basename(path), path });
    }
  }
  return projects;
}

export default function activate(orca: OrcaHost): void {
  orca.panels.handle('beads', async (input) => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid Beads request.');
    const request = input as RpcRequest;
    const projects = await projectsFor(orca);
    const response = await handleRequest(request, projects);
    if (request.method === 'snapshot') {
      const snapshot = response as Snapshot;
      await orca.host.call('statusBar.update', {
        id: 'queue', text: `Beads ${snapshot.readyIds.length}`,
        tooltip: `${snapshot.project.name}: ${snapshot.readyIds.length} ready · ${snapshot.blockedIds.length} blocked · updated ${snapshot.fetchedAt}`,
      });
    }
    return response;
  });
}
