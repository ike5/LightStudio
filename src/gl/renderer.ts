import { LightLayer } from '../types';
import { MAX_LIGHTS } from '../state';
import { createProgram, getUniformLocations } from './program';
import { VERTEX_SHADER, FRAGMENT_SHADER } from './shaders';
import { createImageTexture, createMaskArray } from './texture';

/**
 * Owns the WebGL2 context state: the relighting program, a full-screen quad, the
 * image texture, and the mask 2D-array texture. The drawing buffer is kept at
 * full image resolution; CSS scales the canvas for display, so exports are
 * full-quality straight from canvas.toBlob.
 */
export class Renderer {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private u: Record<string, WebGLUniformLocation | null>;
  private imageTex: WebGLTexture | null = null;
  private maskTex: WebGLTexture | null = null;
  private width = 0;
  private height = 0;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.program = createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);
    this.u = getUniformLocations(gl, this.program);
    this.vao = this.createQuad();
  }

  private createQuad(): WebGLVertexArrayObject {
    const gl = this.gl;
    // Two triangles covering clip space. UVs use a top-left origin: uv.y = 0 maps
    // to the top of the screen and the first (top) row of image data.
    const data = new Float32Array([
      // x, y,   u, v
      -1, -1, 0, 1,
       1, -1, 1, 1,
      -1,  1, 0, 0,
      -1,  1, 0, 0,
       1, -1, 1, 1,
       1,  1, 1, 0,
    ]);
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(this.program, 'a_pos');
    const uvLoc = gl.getAttribLocation(this.program, 'a_uv');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(uvLoc);
    gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 16, 8);
    gl.bindVertexArray(null);
    return vao;
  }

  /** Swap in a new source image and (re)allocate the mask array to match its size. */
  setImage(source: TexImageSource, width: number, height: number): void {
    const gl = this.gl;
    if (this.imageTex) gl.deleteTexture(this.imageTex);
    if (this.maskTex) gl.deleteTexture(this.maskTex);
    this.imageTex = createImageTexture(gl, source);
    this.maskTex = createMaskArray(gl, width, height, MAX_LIGHTS);
    this.width = width;
    this.height = height;
  }

  /** Re-upload one layer's mask canvas into its slice of the array texture. */
  uploadMask(index: number, canvas: HTMLCanvasElement): void {
    if (!this.maskTex) return;
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.maskTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texSubImage3D(
      gl.TEXTURE_2D_ARRAY, 0, 0, 0, index,
      canvas.width, canvas.height, 1,
      gl.RGBA, gl.UNSIGNED_BYTE, canvas
    );
  }

  render(layers: LightLayer[]): void {
    const gl = this.gl;
    if (!this.imageTex || !this.maskTex) return;

    gl.viewport(0, 0, this.width, this.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.imageTex);
    gl.uniform1i(this.u.u_image, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.maskTex);
    gl.uniform1i(this.u.u_masks, 1);

    gl.uniform2f(this.u.u_texel, 1 / this.width, 1 / this.height);

    const n = Math.min(layers.length, MAX_LIGHTS);
    gl.uniform1i(this.u.u_lightCount, n);

    const pos = new Float32Array(MAX_LIGHTS * 3);
    const color = new Float32Array(MAX_LIGHTS * 3);
    const intensity = new Float32Array(MAX_LIGHTS);
    const ambient = new Float32Array(MAX_LIGHTS);
    const specStrength = new Float32Array(MAX_LIGHTS);
    const shininess = new Float32Array(MAX_LIGHTS);
    const normalStrength = new Float32Array(MAX_LIGHTS);
    const attenuation = new Float32Array(MAX_LIGHTS);

    for (let i = 0; i < n; i++) {
      const L = layers[i].light;
      pos[i * 3] = L.pos.x;
      pos[i * 3 + 1] = L.pos.y;
      pos[i * 3 + 2] = L.pos.z;
      color[i * 3] = L.color[0];
      color[i * 3 + 1] = L.color[1];
      color[i * 3 + 2] = L.color[2];
      intensity[i] = L.intensity;
      ambient[i] = L.ambient;
      specStrength[i] = L.specStrength;
      shininess[i] = L.shininess;
      normalStrength[i] = L.normalStrength;
      attenuation[i] = L.attenuation;
    }

    gl.uniform3fv(this.u.u_lightPos, pos);
    gl.uniform3fv(this.u.u_lightColor, color);
    gl.uniform1fv(this.u.u_intensity, intensity);
    gl.uniform1fv(this.u.u_ambient, ambient);
    gl.uniform1fv(this.u.u_specStrength, specStrength);
    gl.uniform1fv(this.u.u_shininess, shininess);
    gl.uniform1fv(this.u.u_normalStrength, normalStrength);
    gl.uniform1fv(this.u.u_attenuation, attenuation);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}
