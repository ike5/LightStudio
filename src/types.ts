export type RGB = [number, number, number];

/** All per-light parameters. Positions are in normalized image space [0..1]. */
export interface LightState {
  /** x,y in [0..1] (top-left origin, matches the mask canvas and shader uv). z is light height above the plane. */
  pos: { x: number; y: number; z: number };
  intensity: number;      // 0..2
  color: RGB;             // 0..1 per channel
  ambient: number;        // 0..1 — floor brightness so shadows don't crush to black
  specStrength: number;   // 0..1 — Blinn-Phong highlight strength
  shininess: number;      // ~1..128 — highlight tightness
  normalStrength: number; // 0..5 — how pronounced the estimated surface relief is
  attenuation: number;    // 0..5 — radial falloff k around the orb
}

/** A single light + the region (mask) it affects. One orb per layer. */
export interface LightLayer {
  id: string;
  name: string;
  light: LightState;
  /** Grayscale mask at image resolution. White = relit, black = original. */
  maskCanvas: HTMLCanvasElement;
  /** Set when the mask canvas changed and its GPU texture slice needs re-upload. */
  maskDirty: boolean;
}
