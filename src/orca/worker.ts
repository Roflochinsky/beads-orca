import type { RpcRequest, Snapshot } from '../shared.js';
import { ProjectAccess, type ProductHost } from './projects.js';
import { LibraryService } from './library.js';
import { WorkflowService } from './workflow.js';

interface OrcaHost extends ProductHost {
  panels: { handle(name: string, handler: (input: unknown) => Promise<unknown>): void };
}

export default function activate(orca: OrcaHost): void {
  const access = new ProjectAccess(orca);
  const library = new LibraryService(orca, access);
  const workflow = new WorkflowService(orca, access, library);
  orca.panels.handle('beads', async (input) => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid Beads request.');
    const request = input as RpcRequest;
    if (typeof request.method !== 'string') throw new Error('A Beads request method is required.');
    const response = await (workflow.handles(request.method) ? workflow.request(request)
      : library.handles(request.method) ? library.request(request)
        : access.request(request));
    if (request.method === 'snapshot') {
      const snapshot = response as Snapshot;
      await orca.host.call('statusBar.update', {
        id: 'queue', text: snapshot.offline ? 'Beads offline' : `Beads ${snapshot.readyIds.length}`,
        tone: snapshot.offline ? 'warning' : 'neutral',
        tooltip: `${snapshot.project.name}: ${snapshot.offline ? 'offline snapshot · ' : ''}${snapshot.readyIds.length} ready · ${snapshot.blockedIds.length} blocked · updated ${snapshot.fetchedAt}`,
      });
    }
    return response;
  });
}
