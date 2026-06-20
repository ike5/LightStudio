import type { App } from '../app';
import { state, activeLayer } from '../state';
import { clientToNormalized } from './coords';

export type MaskMode = 'brush' | 'lasso';

/**
 * Paints the active layer's mask while "Edit mask" is on. Brush stamps a soft
 * circle along the drag; lasso fills the drawn loop. White adds the region to the
 * light, black removes it. A tinted preview shows the lit region while editing.
 */
export class MaskTool {
  mode: MaskMode = 'brush';
  size = 80;        // brush diameter, image pixels
  feather = 12;     // soft-edge radius, pixels
  erase = false;

  private preview: HTMLCanvasElement;
  private painting = false;
  private last: { x: number; y: number } | null = null;
  private lasso: { x: number; y: number }[] = [];

  constructor(private overlay: HTMLElement, private app: App) {
    this.preview = document.createElement('canvas');
    this.preview.style.position = 'absolute';
    this.preview.style.inset = '0';
    this.preview.style.width = '100%';
    this.preview.style.height = '100%';
    this.preview.style.pointerEvents = 'none';
    this.preview.style.display = 'none';
    this.preview.style.opacity = '0.5';
    this.overlay.appendChild(this.preview);

    this.overlay.addEventListener('pointerdown', this.onDown);
    this.overlay.addEventListener('pointermove', this.onMove);
    this.overlay.addEventListener('pointerup', this.onUp);
    this.overlay.addEventListener('pointercancel', this.onUp);
  }

  /** Match the preview buffer to the active mask and toggle its visibility. */
  refreshPreview(): void {
    const layer = activeLayer();
    if (!state.editingMask || !layer) {
      this.preview.style.display = 'none';
      return;
    }
    const mask = layer.maskCanvas;
    if (this.preview.width !== mask.width || this.preview.height !== mask.height) {
      this.preview.width = mask.width;
      this.preview.height = mask.height;
    }
    const ctx = this.preview.getContext('2d')!;
    ctx.clearRect(0, 0, mask.width, mask.height);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(mask, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = 'rgba(110,168,254,1)';
    ctx.fillRect(0, 0, mask.width, mask.height);
    ctx.globalCompositeOperation = 'source-over';
    this.preview.style.display = 'block';
  }

  private toMaskPx(e: PointerEvent): { x: number; y: number } {
    const rect = this.overlay.getBoundingClientRect();
    const n = clientToNormalized(e.clientX, e.clientY, rect);
    return { x: n.x * state.imageWidth, y: n.y * state.imageHeight };
  }

  private onDown = (e: PointerEvent): void => {
    if (!state.editingMask || !activeLayer()) return;
    e.preventDefault();
    this.overlay.setPointerCapture(e.pointerId);
    this.painting = true;
    const p = this.toMaskPx(e);
    if (this.mode === 'brush') {
      this.last = p;
      this.stamp(p.x, p.y);
      this.commit();
    } else {
      this.lasso = [p];
    }
  };

  private onMove = (e: PointerEvent): void => {
    if (!this.painting) return;
    const p = this.toMaskPx(e);
    if (this.mode === 'brush') {
      this.strokeTo(p);
      this.commit();
    } else {
      this.lasso.push(p);
    }
  };

  private onUp = (e: PointerEvent): void => {
    if (!this.painting) return;
    this.painting = false;
    if (this.overlay.hasPointerCapture(e.pointerId)) this.overlay.releasePointerCapture(e.pointerId);
    if (this.mode === 'lasso' && this.lasso.length > 2) {
      this.fillLasso();
      this.commit();
    }
    this.last = null;
    this.lasso = [];
  };

  /** Stamp soft circles between the last point and the new one for a continuous stroke. */
  private strokeTo(p: { x: number; y: number }): void {
    if (!this.last) {
      this.stamp(p.x, p.y);
      this.last = p;
      return;
    }
    const dx = p.x - this.last.x;
    const dy = p.y - this.last.y;
    const dist = Math.hypot(dx, dy);
    const step = Math.max(1, this.size / 4);
    const steps = Math.max(1, Math.floor(dist / step));
    for (let i = 1; i <= steps; i++) {
      this.stamp(this.last.x + (dx * i) / steps, this.last.y + (dy * i) / steps);
    }
    this.last = p;
  }

  private stamp(cx: number, cy: number): void {
    const layer = activeLayer();
    if (!layer) return;
    const ctx = layer.maskCanvas.getContext('2d')!;
    const r = this.size / 2;
    const inner = Math.max(0, r - this.feather);
    const col = this.erase ? '0,0,0' : '255,255,255';
    const grad = ctx.createRadialGradient(cx, cy, inner, cx, cy, Math.max(inner + 0.5, r));
    grad.addColorStop(0, `rgba(${col},1)`);
    grad.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(inner + 0.5, r), 0, Math.PI * 2);
    ctx.fill();
  }

  private fillLasso(): void {
    const layer = activeLayer();
    if (!layer) return;
    const ctx = layer.maskCanvas.getContext('2d')!;
    ctx.save();
    if (this.feather > 0) ctx.filter = `blur(${this.feather}px)`;
    ctx.fillStyle = this.erase ? '#000000' : '#ffffff';
    ctx.beginPath();
    ctx.moveTo(this.lasso[0].x, this.lasso[0].y);
    for (let i = 1; i < this.lasso.length; i++) ctx.lineTo(this.lasso[i].x, this.lasso[i].y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private commit(): void {
    const layer = activeLayer();
    if (!layer) return;
    layer.maskDirty = true;
    this.refreshPreview();
    this.app.requestRender();
  }

  /** Whole-mask operations exposed to the mask panel buttons. */
  fillAll(value: 'white' | 'black'): void {
    const layer = activeLayer();
    if (!layer) return;
    const ctx = layer.maskCanvas.getContext('2d')!;
    ctx.save();
    ctx.filter = 'none';
    ctx.fillStyle = value === 'white' ? '#ffffff' : '#000000';
    ctx.fillRect(0, 0, layer.maskCanvas.width, layer.maskCanvas.height);
    ctx.restore();
    this.commit();
  }

  invert(): void {
    const layer = activeLayer();
    if (!layer) return;
    const ctx = layer.maskCanvas.getContext('2d')!;
    ctx.save();
    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'difference';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, layer.maskCanvas.width, layer.maskCanvas.height);
    ctx.restore();
    this.commit();
  }
}
