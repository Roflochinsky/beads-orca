import { mount } from '../../src/ui/index.ts';
import { createPanelTransport } from '../../src/orca/panel-transport.ts';

const transport = createPanelTransport({
  async call(method, params) {
    const host = window.orca?.host;
    if (!host) throw new Error('Open the Beads panel in Orca to connect to the plugin.');
    return host.call(method, params);
  },
});
window.addEventListener('pagehide', () => transport.dispose(), { once: true });

const root = document.getElementById('app') ?? document.body.appendChild(document.createElement('div'));
mount(root, transport);
