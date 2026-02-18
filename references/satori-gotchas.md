# Satori CSS Gotchas

`next/og` uses [Satori](https://github.com/vercel/satori) to render JSX to PNG. Satori implements a **subset** of CSS — many common properties are silently ignored or behave differently.

## Table of Contents

1. [Images](#images)
2. [Text & Typography](#text--typography)
3. [Layout](#layout)
4. [Unsupported CSS](#unsupported-css)
5. [Runtime & Filesystem](#runtime--filesystem)
6. [Debugging Checklist](#debugging-checklist)

---

## Images

### ❌ `width: "auto"` silently renders nothing

Satori requires **explicit integer pixel dimensions** for `<img>` elements.

```tsx
// ❌ Image invisible — Satori ignores auto width
<img src={logo} style={{ height: 80, width: "auto" }} />

// ✅ Must use explicit integers
<img src={logo} style={{ width: 200, height: 80 }} />
```

**How to find the real dimensions of a PNG:**
```bash
python3 -c "import struct; d=open('public/images/logo.png','rb').read(); w,h=struct.unpack('>II',d[16:24]); print(f'{w}x{h}')"
```

Then scale proportionally: if the logo is 998×1000 (near-square), use `width: 86, height: 86`.

### ❌ `maxWidth`, `minWidth`, `maxHeight` not supported

These properties are ignored. Use explicit `width` and `height` only.

### ✅ Use base64 for local images

Read images from disk and convert to base64 data URIs — do not use relative paths or `next/image`.

```ts
import { readFile } from "fs/promises"
import { join } from "path"

const logoData = await readFile(join(process.cwd(), "public/images/logo.png"))
const logoBase64 = `data:image/png;base64,${logoData.toString("base64")}`
```

---

## Text & Typography

### ❌ Mixed-color inline text breaks layout

Using a `<span>` with a different color inside a text node causes text to overlap or disappear.

```tsx
// ❌ Broken — "inteligente" overlaps or disappears
<h1 style={{ color: "#fff", fontSize: 54 }}>
  Bienestar emocional{" "}
  <span style={{ color: "#6EC7E8" }}>inteligente</span> para tu organización
</h1>

// ✅ Use separate elements in a flex column
<div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
  <span style={{ color: "#ffffff", fontSize: 54, fontWeight: 700 }}>
    Bienestar emocional
  </span>
  <span style={{ color: "#6EC7E8", fontSize: 54, fontWeight: 700 }}>
    inteligente para tu empresa
  </span>
</div>
```

### ❌ `{" "}` whitespace between JSX elements is unreliable

Avoid relying on JSX whitespace for spacing between colored text segments. Use `gap` in flex containers or explicit `marginRight`/`marginLeft`.

### ❌ Custom fonts from `next/font/google` don't work

Load fonts manually via `fetch`:

```ts
const fontData = await fetch(
  'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff'
).then(r => r.arrayBuffer())

return new ImageResponse(<div>…</div>, {
  ...size,
  fonts: [{ name: 'Inter', data: fontData, weight: 400 }],
})
```

Or use `system-ui` in the root style which works without loading fonts:
```tsx
<div style={{ fontFamily: "system-ui, sans-serif" }}>
```

### ❌ `text-overflow: ellipsis` not supported

Truncate strings in JavaScript before rendering:
```ts
const truncated = text.length > 60 ? text.slice(0, 57) + "…" : text
```

### ❌ `text-wrap: balance`, `text-pretty` not supported

Manually break long text into multiple `<span>` elements.

---

## Layout

### ❌ `display: block` / `display: inline` ignored

Every element must use `display: "flex"`. Satori only implements flexbox layout.

```tsx
// ❌ Satori ignores this
<div style={{ display: "block" }}>

// ✅ Always use flex
<div style={{ display: "flex", flexDirection: "column" }}>
```

### ❌ `position: fixed` not supported

Use `position: "absolute"` with a `position: "relative"` parent.

### ✅ Z-index works with absolute positioning

```tsx
<div style={{ position: "relative", width: "100%", height: "100%" }}>
  {/* background layer */}
  <div style={{ position: "absolute", inset: 0, background: "..." }} />
  {/* foreground content */}
  <div style={{ position: "relative", zIndex: 1, display: "flex" }}>
    ...
  </div>
</div>
```

---

## Unsupported CSS

| Property | Workaround |
|---|---|
| `calc()` | Compute the value in JS |
| `clamp()` | Pick a fixed value for the static image |
| `background-clip: text` (gradient text) | Not possible |
| `filter` (blur, etc.) | Not supported |
| `backdrop-filter` | Not supported |
| `transition`, `animation` | Ignored (static image) |
| `::before`, `::after` pseudo-elements | Not supported |
| `overflow: hidden` with `border-radius` | Works partially — test carefully |
| `text-shadow` | Not supported |
| `box-shadow` | Supported ✅ |
| `border-radius` | Supported ✅ |
| `opacity` | Supported ✅ |
| `background: linear-gradient(...)` | Supported ✅ |
| `background: radial-gradient(...)` | Supported ✅ |

---

## Runtime & Filesystem

### Use `runtime = "nodejs"` for `fs` access

The default `edge` runtime cannot read files from disk.

```ts
// Required at the top of opengraph-image.tsx to use readFile()
export const runtime = "nodejs"
```

With `runtime = "nodejs"`, the route renders as `○ (Static)` at build time — still fast.

### The route should be Static, not Dynamic

After building, confirm in the route table:
```
○ /opengraph-image   ← correct: static, cached
ƒ /opengraph-image   ← wrong: dynamic, causes cache misses
```

If it shows as `ƒ`, check that `opengraph-image.tsx` has no `headers()` or `cookies()` calls.

---

## Debugging Checklist

When the OG image looks wrong, check these in order:

1. **Logo not visible** → `width: "auto"` used. Replace with explicit `width` integer.
2. **Text overlapping or garbled** → Mixed-color inline spans. Split into separate flex elements.
3. **Element missing** → Missing `display: "flex"` on parent or element itself.
4. **Image not updating** → Social platforms cache OG images aggressively. Use a cache-busting query param or test at the direct URL: `https://yourdomain.com/opengraph-image`.
5. **OG image points to wrong domain** → `metadataBase` is hardcoded. Switch to `generateMetadata()` that reads `x-forwarded-host` header.
6. **Font not rendering as expected** → Custom fonts from CSS variables don't work. Use `system-ui` or load font data manually.
