# LightStudio

A browser photo editor built around a **draggable light orb**. Load a photo, drag a glowing orb to position a light source, and the image is re-lit in real time — shading shifts across surfaces and highlights slide as you move the light. You can add several lights and **paint a mask** so each light only affects part of the photo (e.g. one light on the subject, another on the background).

## How it works

The relighting is real per-pixel shading, not a sliding vignette:

1. A surface **normal map** is estimated from the photo's luminance (bright = high) using a Sobel gradient.
2. Each light applies **Lambert diffuse + Blinn-Phong specular** with a radial falloff, driven by the orb's position `(x, y)` and a height `z`.
3. Each light is blended in only where its **mask** is white, so several masked lights composite together.

All of this runs in a single WebGL2 fragment shader, so dragging stays at 60fps.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
```

Build a production bundle:

```bash
npm run build    # type-checks, then bundles to dist/
npm run preview
```

## Using it

- **Upload** a photo with the file picker.
- **Drag an orb** to move its light. Click an orb (or a row in *Lights*) to make it active.
- **Light settings** adjust the active light: intensity, ambient floor, light height, relief (how 3D the surface reads), specular, falloff, and color.
- **Add light** creates another orb/light (up to 4).
- **Edit mask** paints the region the active light affects. Click *Clear*, then **Brush** or **Lasso** the area to light. Use *Add*/*Erase*, brush size, and feather; *Fill all*, *Clear*, and *Invert* act on the whole mask. A blue tint previews the lit region while editing.
- **Download PNG** exports the relit result at full image resolution.

## Tech

Vanilla TypeScript + Vite + WebGL2. No UI framework — the WebGL core is self-contained.

```
src/
  main.ts            entry: wires DOM to the App
  app.ts             orchestrator: state + rAF-coalesced redraw
  state.ts           LightLayer / LightState store
  gl/                shaders, program/uniform utils, textures, renderer
  interaction/       coordinate mapping, draggable orbs, mask painting
  ui/                light controls, layer list, PNG export
```

## Notes & future ideas

- The normal map is a heuristic from luminance, so textured/portrait subjects relight more convincingly than flat areas (a flat sky stays flat — which is correct).
- Masks are painted manually today. Because a mask is just a grayscale texture, smarter selection can drop into the same input later: magic-wand (click-to-grow-by-color), or AI click-to-segment (MediaPipe for people, Segment Anything for arbitrary objects like "the forest").
- Other ideas: presets, color temperature, undo/redo, and more than 4 lights.
