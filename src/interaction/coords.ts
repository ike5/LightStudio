export const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/**
 * Map a client (screen) point to normalized image space [0..1], top-left origin.
 *
 * The whole app uses one convention: top-left origin for the orb position, the
 * mask canvas, and the shader uv. Because the quad UVs already put uv.y = 0 at
 * the top, no Y-flip is needed anywhere — the orb's (x, y) feeds the shader light
 * position directly.
 */
export function clientToNormalized(
  clientX: number,
  clientY: number,
  rect: DOMRect
): { x: number; y: number } {
  return {
    x: clamp01((clientX - rect.left) / rect.width),
    y: clamp01((clientY - rect.top) / rect.height),
  };
}
