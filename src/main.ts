import { App, AppElements } from './app';

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
};

const elements: AppElements = {
  canvas: $('gl'),
  overlay: $('overlay'),
  canvasWrap: $('canvas-wrap'),
  prompt: $('prompt'),
  controls: $('controls'),
  layerList: $('layer-list'),
  addLayer: $('add-layer'),
  editMask: $('edit-mask'),
  maskCard: $('mask-card'),
  exportBtn: $('export'),
  maskBrush: $('mask-brush'),
  maskLasso: $('mask-lasso'),
  maskAdd: $('mask-add'),
  maskErase: $('mask-erase'),
  maskSize: $('mask-size'),
  maskSizeVal: $('mask-size-v'),
  maskFeather: $('mask-feather'),
  maskFeatherVal: $('mask-feather-v'),
  maskFill: $('mask-fill'),
  maskClear: $('mask-clear'),
  maskInvert: $('mask-invert'),
};

const app = new App(elements);

const fileInput = $<HTMLInputElement>('file');
fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  try {
    const bitmap = await createImageBitmap(file);
    await app.setImage(bitmap);
  } catch (err) {
    console.error(err);
    alert('Could not load that image. Try a different file.');
  }
});
