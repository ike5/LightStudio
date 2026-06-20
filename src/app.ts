import { Renderer } from './gl/renderer';
import { OrbsController } from './interaction/orbs';
import { MaskTool } from './interaction/maskTool';
import { ControlsPanel } from './ui/controls';
import { LayersPanel } from './ui/layers';
import { exportPNG } from './ui/export';
import { state, createLayer, MAX_LIGHTS } from './state';

export interface AppElements {
  canvas: HTMLCanvasElement;
  overlay: HTMLElement;
  canvasWrap: HTMLElement;
  prompt: HTMLElement;
  controls: HTMLElement;
  layerList: HTMLElement;
  addLayer: HTMLButtonElement;
  editMask: HTMLButtonElement;
  maskCard: HTMLElement;
  exportBtn: HTMLButtonElement;
  // mask panel
  maskBrush: HTMLButtonElement;
  maskLasso: HTMLButtonElement;
  maskAdd: HTMLButtonElement;
  maskErase: HTMLButtonElement;
  maskSize: HTMLInputElement;
  maskSizeVal: HTMLElement;
  maskFeather: HTMLInputElement;
  maskFeatherVal: HTMLElement;
  maskFill: HTMLButtonElement;
  maskClear: HTMLButtonElement;
  maskInvert: HTMLButtonElement;
}

/**
 * Orchestrator: owns the renderer, the interaction controllers, the UI panels,
 * and the central state. Drives an rAF-coalesced redraw so dragging and painting
 * never trigger more than one draw per frame.
 */
export class App {
  private renderer: Renderer;
  private orbs: OrbsController;
  private maskTool: MaskTool;
  private controls: ControlsPanel;
  private layersPanel: LayersPanel;
  private rafPending = false;

  constructor(private el: AppElements) {
    const gl = el.canvas.getContext('webgl2');
    if (!gl) throw new Error('WebGL2 is required but not available in this browser.');

    this.renderer = new Renderer(gl);
    this.orbs = new OrbsController(el.overlay, this);
    this.maskTool = new MaskTool(el.overlay, this);
    this.controls = new ControlsPanel(el.controls, this);
    this.layersPanel = new LayersPanel(el.layerList, el.addLayer, el.editMask, this);

    el.exportBtn.addEventListener('click', () => exportPNG(el.canvas));
    this.setupMaskPanel();
    this.refreshUI();
  }

  private setupMaskPanel(): void {
    const e = this.el;
    const pair = (a: HTMLButtonElement, b: HTMLButtonElement, onA: () => void, onB: () => void) => {
      a.addEventListener('click', () => { a.classList.add('active'); b.classList.remove('active'); onA(); });
      b.addEventListener('click', () => { b.classList.add('active'); a.classList.remove('active'); onB(); });
    };
    pair(e.maskBrush, e.maskLasso, () => (this.maskTool.mode = 'brush'), () => (this.maskTool.mode = 'lasso'));
    pair(e.maskAdd, e.maskErase, () => (this.maskTool.erase = false), () => (this.maskTool.erase = true));

    const sync = (input: HTMLInputElement, label: HTMLElement, apply: (v: number) => void) => {
      const update = () => { const v = parseFloat(input.value); label.textContent = String(v); apply(v); };
      input.addEventListener('input', update);
      update();
    };
    sync(e.maskSize, e.maskSizeVal, (v) => (this.maskTool.size = v));
    sync(e.maskFeather, e.maskFeatherVal, (v) => (this.maskTool.feather = v));

    e.maskFill.addEventListener('click', () => this.maskTool.fillAll('white'));
    e.maskClear.addEventListener('click', () => this.maskTool.fillAll('black'));
    e.maskInvert.addEventListener('click', () => this.maskTool.invert());
  }

  /** Load a new source image: resize buffers, reset to a single default light. */
  async setImage(bitmap: ImageBitmap): Promise<void> {
    state.image = bitmap;
    state.imageWidth = bitmap.width;
    state.imageHeight = bitmap.height;
    this.el.canvas.width = bitmap.width;
    this.el.canvas.height = bitmap.height;
    this.renderer.setImage(bitmap, bitmap.width, bitmap.height);

    state.layers = [createLayer(bitmap.width, bitmap.height, 0)];
    state.activeLayerId = state.layers[0].id;
    state.editingMask = false;
    this.el.overlay.classList.remove('editing');
    this.el.maskCard.style.display = 'none';

    this.el.prompt.style.display = 'none';
    this.el.canvasWrap.style.display = 'inline-block';
    this.el.exportBtn.disabled = false;

    this.refreshUI();
    this.requestRender();
  }

  addLayer(): void {
    if (!state.image || state.layers.length >= MAX_LIGHTS) return;
    const layer = createLayer(state.imageWidth, state.imageHeight, state.layers.length);
    state.layers.push(layer);
    state.activeLayerId = layer.id;
    this.refreshUI();
    this.requestRender();
  }

  removeLayer(id: string): void {
    state.layers = state.layers.filter((l) => l.id !== id);
    if (state.activeLayerId === id) {
      state.activeLayerId = state.layers[0]?.id ?? null;
    }
    if (!state.activeLayerId) this.setEditingMask(false);
    // Indices shift on removal, so every mask slice must be re-uploaded.
    this.markAllMasksDirty();
    this.refreshUI();
    this.requestRender();
  }

  setActiveLayer(id: string): void {
    state.activeLayerId = id;
    this.refreshUI();
    this.requestRender();
  }

  setEditingMask(on: boolean): void {
    state.editingMask = on && !!state.activeLayerId;
    this.el.overlay.classList.toggle('editing', state.editingMask);
    this.el.maskCard.style.display = state.editingMask ? 'block' : 'none';
    this.layersPanel.refresh();
    this.maskTool.refreshPreview();
  }

  markAllMasksDirty(): void {
    for (const l of state.layers) l.maskDirty = true;
  }

  private refreshUI(): void {
    this.layersPanel.refresh();
    this.controls.refresh();
    this.maskTool.refreshPreview();
  }

  requestRender(): void {
    if (this.rafPending) return;
    this.rafPending = true;
    requestAnimationFrame(() => {
      this.rafPending = false;
      this.render();
    });
  }

  private render(): void {
    if (!state.image) return;
    state.layers.forEach((layer, i) => {
      if (layer.maskDirty) {
        this.renderer.uploadMask(i, layer.maskCanvas);
        layer.maskDirty = false;
      }
    });
    this.renderer.render(state.layers);
    this.orbs.sync();
  }
}
