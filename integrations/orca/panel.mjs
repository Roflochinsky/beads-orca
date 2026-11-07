import { mount } from '../../src/ui/index.ts';

const transport = {
  async request(request) {
    const host = window.orca?.host;
    if (!host) throw new Error('Open the Beads panel in Orca to connect to the plugin.');
    const { output } = await host.call('plugin.request', {
      name: 'beads', input: request, timeoutMs: 120_000,
    });
    return output;
  },
};

const root = document.getElementById('app') ?? document.body.appendChild(document.createElement('div'));
mount(root, transport);
