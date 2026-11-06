import { mount } from '../../src/ui/index.ts';

const transport = {
  async request(request) {
    const plugin = window.orca?.plugin;
    if (!plugin) throw new Error('Open the Beads panel in Orca to connect to the plugin.');
    return await plugin.request('beads', request);
  },
};

const root = document.getElementById('app') ?? document.body.appendChild(document.createElement('div'));
mount(root, transport);
