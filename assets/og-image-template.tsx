/**
 * app/opengraph-image.tsx — Next.js App Router OG image boilerplate
 *
 * Copy this file to app/opengraph-image.tsx and customize:
 *   1. LOGO_PATH        — path inside /public to your logo
 *   2. LOGO_W / LOGO_H  — exact pixel dimensions of the logo file
 *   3. BRAND_*          — your brand colors
 *   4. The headline and subtitle text
 *
 * Satori rules (enforced here, do not break them):
 *   - All image dimensions must be explicit integers (no "auto", no %)
 *   - Multi-color text uses separate <span> elements in flexDirection:"column"
 *   - Every container uses display:"flex"
 *   - runtime="nodejs" is required for fs.readFile
 */
import { ImageResponse } from "next/og"
import { readFile } from "fs/promises"
import { join } from "path"

// ─── Config ───────────────────────────────────────────────────────────────────
const LOGO_PATH = "public/images/logo.png" // relative to project root
const LOGO_W = 86                           // explicit px — no "auto" in Satori
const LOGO_H = 86

const BRAND_BG      = "#1a2b3c"            // dark background
const BRAND_PRIMARY = "#6EC7E8"            // accent / headline color
const BRAND_WHITE   = "#ffffff"
const BRAND_MUTED   = "rgba(255,255,255,0.55)"
const BRAND_BADGE_BG     = "rgba(110,199,232,0.12)"
const BRAND_BADGE_BORDER = "rgba(110,199,232,0.25)"
const BRAND_BAR_GRADIENT = "linear-gradient(90deg, #6EC7E8 0%, #A8E6CF 50%, #E8C547 100%)"

// ─── Next.js file conventions ─────────────────────────────────────────────────
export const runtime     = "nodejs"      // required for fs access
export const alt         = "Your Site — Tagline"
export const size        = { width: 1200, height: 630 }
export const contentType = "image/png"

// ─── Image ────────────────────────────────────────────────────────────────────
export default async function Image() {
  // Load logo as base64 — relative paths and next/image don't work in Satori
  const logoData   = await readFile(join(process.cwd(), LOGO_PATH))
  const logoBase64 = `data:image/png;base64,${logoData.toString("base64")}`

  return new ImageResponse(
    (
      <div
        style={{
          background: BRAND_BG,
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* ── Decorative background circles ─────────────────────────────── */}
        <div style={{
          position: "absolute", top: -140, right: -140,
          width: 520, height: 520, borderRadius: "50%",
          background: "rgba(110,199,232,0.07)",
        }} />
        <div style={{
          position: "absolute", bottom: -120, left: -120,
          width: 400, height: 400, borderRadius: "50%",
          background: "rgba(232,197,71,0.05)",
        }} />

        {/* ── Main content ──────────────────────────────────────────────── */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          zIndex: 1,
          padding: "0 80px",
          width: "100%",
        }}>

          {/* Logo — explicit px required, no "auto" */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoBase64}
            alt="Logo"
            style={{ width: LOGO_W, height: LOGO_H, marginBottom: 28, objectFit: "contain" }}
          />

          {/* Tagline badge */}
          <div style={{
            background: BRAND_BADGE_BG,
            border: `1px solid ${BRAND_BADGE_BORDER}`,
            borderRadius: 24,
            padding: "8px 22px",
            marginBottom: 32,
            display: "flex",
            alignItems: "center",
          }}>
            <span style={{ color: BRAND_PRIMARY, fontSize: 16, fontWeight: 500, letterSpacing: "0.04em" }}>
              Your tagline here
            </span>
          </div>

          {/*
           * Multi-color headline — ALWAYS use separate elements, never inline spans.
           * Mixing <span style={{color:X}}> inside a text node breaks Satori rendering.
           */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <span style={{ color: BRAND_WHITE,   fontSize: 52, fontWeight: 700, textAlign: "center", lineHeight: 1.15 }}>
              First line of headline
            </span>
            <span style={{ color: BRAND_PRIMARY, fontSize: 52, fontWeight: 700, textAlign: "center", lineHeight: 1.15 }}>
              Second line in accent color
            </span>
          </div>

          {/* Subtitle */}
          <p style={{
            color: BRAND_MUTED,
            fontSize: 20,
            textAlign: "center",
            marginTop: 24,
            marginBottom: 0,
            maxWidth: 720,
            lineHeight: 1.55,
          }}>
            Short, punchy description. Two sentences max.
          </p>
        </div>

        {/* ── Bottom gradient bar ───────────────────────────────────────── */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 5,
          background: BRAND_BAR_GRADIENT,
        }} />

        {/* ── Domain watermark ─────────────────────────────────────────── */}
        <div style={{
          position: "absolute", bottom: 22, right: 44,
          display: "flex", alignItems: "center", gap: 7,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: BRAND_PRIMARY }} />
          <span style={{ color: "rgba(255,255,255,0.28)", fontSize: 13, letterSpacing: "0.06em" }}>
            yourdomain.com
          </span>
        </div>
      </div>
    ),
    { ...size }
  )
}
