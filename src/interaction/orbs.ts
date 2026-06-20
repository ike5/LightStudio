import type { App } from '../app';
import { state } from '../state';
import { RGB } from '../types';
import { clientToNormalized } from './coords';

const rgbCss = (c: RGB, a = 1): string =>
  `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`;

/**
 * Renders one draggable glowing orb per light layer over the canvas. The active
 * layer's orb is highlighted and draggable; clicking any orb activates its layer.
 * Pointer capture keeps a drag alive even when the cursor leaves the canvas.
 */
export class OrbsController {
  private els = new Map<string, HTMLElement>();

  constructor(private overlay: HTMLElement, private app: App) {}

  /** Reconcile orb DOM elements with the current layers and reposition them. */
  sync(): void {
    const live = new Set(state.layers.map((l) => l.id));
    for (const [id, el] of this.els) {
      if (!live.has(id)) {
        el.remove();
        this.els.delete(id);
      }
    }
    for (const layer of state.layers) {
      let el = this.els.get(layer.id);
      if (!el) {
        el = this.createOrb(layer.id);
        this.overlay.appendChild(el);
        this.els.set(layer.id, el);
      }
      el.style.left = `${layer.light.pos.x * 100}%`;
      el.style.top = `${layer.light.pos.y * 100}%`;
      el.style.setProperty('--orb-glow', rgbCss(layer.light.color, 0.7));
      el.classList.toggle('active', layer.id === state.activeLayerId);
    }
  }

  private createOrb(id: string): HTMLElement {
    const el = document.createElement('div');
    el.className = 'orb';
    let dragging = false;

    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.app.setActiveLayer(id);
      dragging = true;
      el.setPointerCapture(e.pointerId);
      el.style.cursor = 'grabbing';
    });

    el.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const layer = state.layers.find((l) => l.id === id);
      if (!layer) return;
      const rect = this.overlay.getBoundingClientRect();
      const p = clientToNormalized(e.clientX, e.clientY, rect);
      layer.light.pos.x = p.x;
      layer.light.pos.y = p.y;
      el.style.left = `${p.x * 100}%`;
      el.style.top = `${p.y * 100}%`;
      this.app.requestRender();
    });

    const end = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      el.style.cursor = 'grab';
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);

    return el;
  }
}
