import type { RpcRequest, Transport } from '../shared.js';
import { mount } from './index.js';
import './styles.css';

declare global {
  interface Window {
    orca?: { plugin?: { request: (plugin: string, request: RpcRequest) => Promise<unknown> } };
  }
}

const transport: Transport = {
  async request<T>(request: RpcRequest): Promise<T> {
    const plugin = window.orca?.plugin;
    if (!plugin) throw new Error('Open the Beads panel in Orca to connect to the plugin.');
    return await plugin.request('beads', request) as T;
  },
};
const root = document.getElementById('app') ?? document.body.appendChild(document.createElement('div'));
mount(root, transport);
