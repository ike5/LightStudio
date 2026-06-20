import type { App } from '../app';
import { state, MAX_LIGHTS } from '../state';
import { RGB } from '../types';

const rgbCss = (c: RGB): string =>
  `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`;

/** The "Lights" panel: list, add/remove/select/rename, and the Edit-mask toggle. */
export class LayersPanel {
  constructor(
    private list: HTMLElement,
    private addBtn: HTMLButtonElement,
    private editMaskBtn: HTMLButtonElement,
    private app: App
  ) {
    this.addBtn.addEventListener('click', () => this.app.addLayer());
    this.editMaskBtn.addEventListener('click', () => this.app.setEditingMask(!state.editingMask));
  }

  refresh(): void {
    this.list.replaceChildren();
    for (const layer of state.layers) {
      const item = document.createElement('div');
      item.className = 'layer-item' + (layer.id === state.activeLayerId ? ' active' : '');
      item.addEventListener('click', () => this.app.setActiveLayer(layer.id));

      const swatch = document.createElement('span');
      swatch.className = 'layer-swatch';
      swatch.style.background = rgbCss(layer.light.color);

      const name = document.createElement('span');
      name.className = 'layer-name';
      name.textContent = layer.name;
      name.title = 'Double-click to rename';
      name.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const next = prompt('Rename light', layer.name);
        if (next && next.trim()) {
          layer.name = next.trim();
          this.refresh();
        }
      });

      const del = document.createElement('button');
      del.className = 'layer-del';
      del.textContent = '✕';
      del.title = 'Remove light';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        this.app.removeLayer(layer.id);
      });

      item.append(swatch, name, del);
      this.list.appendChild(item);
    }

    this.addBtn.disabled = state.layers.length >= MAX_LIGHTS || !state.image;
    this.editMaskBtn.disabled = !state.activeLayerId;
    this.editMaskBtn.classList.toggle('active', state.editingMask);
    this.editMaskBtn.textContent = state.editingMask ? 'Done editing' : 'Edit mask';
  }
}
