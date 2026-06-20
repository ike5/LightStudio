import { LightLayer, LightState, RGB } from './types';

/** Hard cap on simultaneous lights (matches MAX_LIGHTS in the fragment shader). */
export const MAX_LIGHTS = 4;

/** Distinct default colors so stacked lights are visually tellable apart. */
const LAYER_COLORS: RGB[] = [
  [1.0, 0.95, 0.85], // warm white
  [0.65, 0.8, 1.0],  // cool blue
  [1.0, 0.7, 0.5],   // amber
  [0.7, 1.0, 0.8],   // soft green
];

export interface AppState {
  image: ImageBitmap | null;
  imageWidth: number;
  imageHeight: number;
  layers: LightLayer[];
  activeLayerId: string | null;
  editingMask: boolean;
}

export const state: AppState = {
  image: null,
  imageWidth: 0,
  imageHeight: 0,
  layers: [],
  activeLayerId: null,
  editingMask: false,
};

let idCounter = 0;
const nextId = (): string => `layer-${++idCounter}`;

export function defaultLight(index: number): LightState {
  // Stagger orb positions so new lights don't stack exactly on top of each other.
  const x = 0.5 + (index % 2 === 0 ? -0.18 : 0.18) * Math.min(index, 3);
  const y = 0.4 + 0.12 * (index % 3);
  return {
    pos: { x: Math.min(0.9, Math.max(0.1, x)), y: Math.min(0.9, Math.max(0.1, y)), z: 0.35 },
    intensity: 1.0,
    color: LAYER_COLORS[index % LAYER_COLORS.length].slice() as RGB,
    ambient: 0.35,
    specStrength: 0.4,
    shininess: 32,
    normalStrength: 2.0,
    attenuation: 1.0,
  };
}

/**
 * Create a layer with a full-white mask (acts global until the user carves out a
 * region). Mask canvas matches image resolution so the shader samples 1:1.
 */
export function createLayer(width: number, height: number, index: number): LightLayer {
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = Math.max(1, width);
  maskCanvas.height = Math.max(1, height);
  const ctx = maskCanvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
  return {
    id: nextId(),
    name: `Light ${index + 1}`,
    light: defaultLight(index),
    maskCanvas,
    maskDirty: true,
  };
}

export function activeLayer(): LightLayer | null {
  return state.layers.find((l) => l.id === state.activeLayerId) ?? null;
}
