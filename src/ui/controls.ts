import type { App } from '../app';
import { activeLayer } from '../state';
import { LightState, RGB } from '../types';

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
function rgbToHex(rgb: RGB): string {
  const h = (v: number) => Math.round(clamp01(v) * 255).toString(16).padStart(2, '0');
  return `#${h(rgb[0])}${h(rgb[1])}${h(rgb[2])}`;
}

interface SliderDef {
  label: string;
  min: number;
  max: number;
  step: number;
  get: (l: LightState) => number;
  set: (l: LightState, v: number) => void;
}

const SLIDERS: SliderDef[] = [
  { label: 'Intensity', min: 0, max: 2, step: 0.01, get: (l) => l.intensity, set: (l, v) => (l.intensity = v) },
  { label: 'Ambient', min: 0, max: 1, step: 0.01, get: (l) => l.ambient, set: (l, v) => (l.ambient = v) },
  { label: 'Height', min: 0.02, max: 1, step: 0.01, get: (l) => l.pos.z, set: (l, v) => (l.pos.z = v) },
  { label: 'Relief', min: 0, max: 5, step: 0.05, get: (l) => l.normalStrength, set: (l, v) => (l.normalStrength = v) },
  { label: 'Specular', min: 0, max: 1, step: 0.01, get: (l) => l.specStrength, set: (l, v) => (l.specStrength = v) },
  { label: 'Shininess', min: 1, max: 128, step: 1, get: (l) => l.shininess, set: (l, v) => (l.shininess = v) },
  { label: 'Falloff', min: 0, max: 5, step: 0.05, get: (l) => l.attenuation, set: (l, v) => (l.attenuation = v) },
];

/** Slider + color controls bound to the active layer's light. */
export class ControlsPanel {
  private rows: { def: SliderDef; input: HTMLInputElement; val: HTMLElement }[] = [];
  private colorInput: HTMLInputElement;

  constructor(private container: HTMLElement, private app: App) {
    for (const def of SLIDERS) {
      const row = document.createElement('div');
      row.className = 'row';
      const label = document.createElement('label');
      label.textContent = def.label;
      const input = document.createElement('input');
      input.type = 'range';
      input.min = String(def.min);
      input.max = String(def.max);
      input.step = String(def.step);
      const val = document.createElement('span');
      val.className = 'val';
      input.addEventListener('input', () => {
        const layer = activeLayer();
        if (!layer) return;
        const v = parseFloat(input.value);
        def.set(layer.light, v);
        val.textContent = this.fmt(v);
        this.app.requestRender();
      });
      row.append(label, input, val);
      this.container.appendChild(row);
      this.rows.push({ def, input, val });
    }

    const colorRow = document.createElement('div');
    colorRow.className = 'row';
    const colorLabel = document.createElement('label');
    colorLabel.textContent = 'Color';
    this.colorInput = document.createElement('input');
    this.colorInput.type = 'color';
    this.colorInput.addEventListener('input', () => {
      const layer = activeLayer();
      if (!layer) return;
      layer.light.color = hexToRgb(this.colorInput.value);
      this.app.requestRender();
    });
    colorRow.append(colorLabel, this.colorInput);
    this.container.appendChild(colorRow);
  }

  private fmt(v: number): string {
    return Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(2);
  }

  /** Pull current values from the active layer into the inputs. */
  refresh(): void {
    const layer = activeLayer();
    const enabled = !!layer;
    for (const { def, input, val } of this.rows) {
      input.disabled = !enabled;
      if (layer) {
        const v = def.get(layer.light);
        input.value = String(v);
        val.textContent = this.fmt(v);
      }
    }
    this.colorInput.disabled = !enabled;
    if (layer) this.colorInput.value = rgbToHex(layer.light.color);
  }
}
