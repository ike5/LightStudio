/**
 * Download the current canvas as a PNG. The drawing buffer is kept at full image
 * resolution, so this exports the relit composite at full quality directly.
 */
export function exportPNG(canvas: HTMLCanvasElement, filename = 'lightstudio.png'): void {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}
