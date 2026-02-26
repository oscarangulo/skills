# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.3.0] - 2026-02-25

### Added
- `fusionauth` skill — full authentication and user management integration with FusionAuth using the TypeScript SDK. Covers standard login, MFA (TOTP/email/SMS), passwordless, WebAuthn/passkeys, user and registration CRUD, JWT lifecycle, webhooks with signature verification, OAuth2/OIDC PKCE flow, multi-tenant patterns, and social/identity provider login.
  - `references/api-cheatsheet.md` — quick-scan table of all FusionAuth API endpoints with SDK method names.
  - `references/response-codes.md` — complete HTTP status code reference for the Login API and all conditional flows.
  - `references/gotchas.md` — common integration mistakes with ❌/✅ working fixes.
  - `references/webhook-events.md` — full catalogue of 40+ webhook event types with payload shapes, plan requirements, and signature verification.
  - `assets/client-setup.ts` — TypeScript client wrapper with typed functions for every major auth flow.
  - `assets/webhook-handler.ts` — Express.js webhook handler with HMAC-SHA256 signature verification and typed event routing.

---

## [0.2.0] - 2026-02-18

### Added
- `README.md` at repo root — skill index, installation instructions (project-level and global), contributing guide, and skill structure reference.
- `CHANGELOG.md` to track all notable changes going forward.

### Changed
- Moved `nextjs-og-image` skill files into a dedicated `nextjs-og-image/` subdirectory to support a multi-skill repository structure.

---

## [0.1.0] - 2026-02-17

### Added
- `nextjs-og-image` skill — generates production-quality dynamic Open Graph images for Next.js App Router using `next/og` (Satori). Includes multi-domain support, full Satori CSS gotchas reference, `generateMetadata()` patterns, favicon configuration, and a ready-to-use `opengraph-image.tsx` template.
