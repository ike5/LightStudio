import { MAX_LIGHTS } from '../state';

export const VERTEX_SHADER = `#version 300 es
in vec2 a_pos;
in vec2 a_uv;
out vec2 v_uv;
void main() {
  v_uv = a_uv;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

/**
 * Relighting fragment shader.
 *
 * The surface normal is estimated once per fragment from the luminance gradient
 * (Sobel) — bright is treated as "high". Each active light then contributes
 * Lambert diffuse + Blinn-Phong specular with a radial falloff, blended in only
 * where that light's mask is white. uv uses a top-left origin throughout (quad
 * UVs, image texture, and mask textures all agree), so no Y-flip is needed.
 */
export const FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp sampler2DArray;

in vec2 v_uv;
out vec4 fragColor;

const int MAX_LIGHTS = ${MAX_LIGHTS};

uniform sampler2D u_image;
uniform sampler2DArray u_masks;
uniform vec2 u_texel;
uniform int u_lightCount;
uniform vec3 u_lightPos[MAX_LIGHTS];
uniform vec3 u_lightColor[MAX_LIGHTS];
uniform float u_intensity[MAX_LIGHTS];
uniform float u_ambient[MAX_LIGHTS];
uniform float u_specStrength[MAX_LIGHTS];
uniform float u_shininess[MAX_LIGHTS];
uniform float u_normalStrength[MAX_LIGHTS];
uniform float u_attenuation[MAX_LIGHTS];

float luma(vec2 uv) {
  vec3 c = texture(u_image, uv).rgb;
  return dot(c, vec3(0.299, 0.587, 0.114));
}

void main() {
  vec2 uv = v_uv;
  vec3 base = texture(u_image, uv).rgb;

  // Sobel gradient of luminance -> surface relief.
  float tl = luma(uv + u_texel * vec2(-1.0,  1.0));
  float  l = luma(uv + u_texel * vec2(-1.0,  0.0));
  float bl = luma(uv + u_texel * vec2(-1.0, -1.0));
  float  t = luma(uv + u_texel * vec2( 0.0,  1.0));
  float  b = luma(uv + u_texel * vec2( 0.0, -1.0));
  float tr = luma(uv + u_texel * vec2( 1.0,  1.0));
  float  r = luma(uv + u_texel * vec2( 1.0,  0.0));
  float br = luma(uv + u_texel * vec2( 1.0, -1.0));
  float dX = (tr + 2.0 * r + br) - (tl + 2.0 * l + bl);
  float dY = (tl + 2.0 * t + tr) - (bl + 2.0 * b + br);

  vec3 result = base;
  vec3 V = vec3(0.0, 0.0, 1.0);

  for (int i = 0; i < MAX_LIGHTS; i++) {
    if (i >= u_lightCount) break;

    vec3 N = normalize(vec3(-dX * u_normalStrength[i], -dY * u_normalStrength[i], 1.0));

    vec3 lvec = u_lightPos[i] - vec3(uv, 0.0);
    float dist = length(lvec.xy);
    vec3 L = normalize(lvec);

    float diff = max(dot(N, L), 0.0);
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), u_shininess[i]) * u_specStrength[i];
    float atten = 1.0 / (1.0 + u_attenuation[i] * dist * dist);

    vec3 lit = base * (u_ambient[i] + diff * u_intensity[i] * atten * u_lightColor[i])
             + spec * u_intensity[i] * atten * u_lightColor[i];

    float m = texture(u_masks, vec3(uv, float(i))).r;
    result = mix(result, lit, m);
  }

  fragColor = vec4(clamp(result, 0.0, 1.0), 1.0);
}
`;
