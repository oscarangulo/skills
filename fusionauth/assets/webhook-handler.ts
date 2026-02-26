/**
 * FusionAuth Webhook Handler — Express.js
 *
 * CRITICAL: mount this route BEFORE any global express.json() middleware.
 * express.raw() must capture the body as a Buffer for HMAC verification to work.
 *
 * Usage in your Express app:
 *   import { fusionAuthWebhookRouter } from './webhook-handler'
 *   app.use('/webhooks', fusionAuthWebhookRouter)
 *
 * Environment variables:
 *   FUSIONAUTH_WEBHOOK_SECRET  — set in FusionAuth Admin → Webhooks → Signing key secret
 *
 * Available in FusionAuth v1.48.0+. If you're on an older version,
 * remove signature verification and rely on network-level security (VPN, IP allowlist).
 */

import * as crypto from 'crypto'
import { Router, raw } from 'express'

// ─── Types ────────────────────────────────────────────────────────────────────

interface WebhookEvent {
  type: string
  id: string
  createInstant: number
  tenantId?: string
  applicationId?: string
  info?: {
    ipAddress?: string
    userAgent?: string
    deviceName?: string
    deviceType?: string
  }
  [key: string]: unknown
}

interface FusionAuthUser {
  id: string
  email?: string
  username?: string
  firstName?: string
  lastName?: string
  active?: boolean
  verified?: boolean
  data?: Record<string, unknown>
  registrations?: Array<{
    applicationId: string
    roles: string[]
  }>
}

// ─── Signature Verification ───────────────────────────────────────────────────

/**
 * Verify the X-FusionAuth-Signature header against the raw request body.
 * Uses HMAC-SHA256 with your webhook signing key.
 *
 * Requires FusionAuth v1.48.0+ and signatureConfiguration.enabled = true on the webhook.
 */
function verifyWebhookSignature(rawBody: Buffer, signatureHeader: string, secret: string): boolean {
  try {
    const expected = `sha256=${crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex')}`

    // Use timingSafeEqual to prevent timing attacks
    const a = Buffer.from(signatureHeader)
    const b = Buffer.from(expected)
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}

// ─── Event Handlers ──────────────────────────────────────────────────────────

/**
 * Replace these with your real application logic.
 * Each handler receives the full typed event object.
 */

async function onUserCreate(event: WebhookEvent) {
  const user = event.user as FusionAuthUser
  console.log(`[fusionauth] New user registered: ${user.email} (${user.id})`)
  // TODO: create user record in your own database
  // TODO: send welcome email
  // TODO: provision default resources
}

async function onUserDelete(event: WebhookEvent) {
  const user = event.user as FusionAuthUser
  console.log(`[fusionauth] User deleted: ${user.email} (${user.id})`)
  // TODO: remove user data from your database (GDPR / right to erasure)
  // TODO: cancel subscriptions, revoke API keys, etc.
}

async function onUserUpdate(event: WebhookEvent) {
  const user = event.user as FusionAuthUser
  console.log(`[fusionauth] User updated: ${user.id}`)
  // TODO: sync profile changes to your database
}

async function onLoginSuccess(event: WebhookEvent) {
  const user = event.user as FusionAuthUser
  console.log(
    `[fusionauth] Login success: ${user.email} from ${event.info?.ipAddress ?? 'unknown'}`
  )
  // TODO: update last_login_at in your database
  // TODO: record login to audit log
}

async function onLoginFailed(event: WebhookEvent) {
  console.warn(
    `[fusionauth] Login failed: ${event.loginId} from ${event.info?.ipAddress ?? 'unknown'} — reason: ${event.reason}`
  )
  // TODO: rate-limit or alert on suspicious repeated failures
}

async function onRegistrationCreate(event: WebhookEvent) {
  const user = event.user as FusionAuthUser
  const reg = event.registration as { applicationId: string; roles: string[] }
  console.log(
    `[fusionauth] User ${user.id} registered to app ${reg.applicationId} with roles: ${reg.roles.join(', ')}`
  )
  // TODO: provision app-specific resources for this user
}

async function onRefreshTokenRevoke(event: WebhookEvent) {
  const userId = event.userId as string
  console.log(`[fusionauth] All refresh tokens revoked for user: ${userId}`)
  // TODO: invalidate any server-side session associated with this user
  // TODO: force re-authentication on next API call
}

async function onPasswordBreach(event: WebhookEvent) {
  const user = event.user as FusionAuthUser
  console.warn(`[fusionauth] BREACH DETECTED for user: ${user.email} (${user.id})`)
  // TODO: force password reset
  // TODO: notify security team
  // TODO: log to SIEM
}

async function onPasswordReset(event: WebhookEvent) {
  const user = event.user as FusionAuthUser
  console.log(`[fusionauth] Password reset completed for: ${user.email}`)
  // TODO: revoke all refresh tokens after password change
  // await revokeAllSessions(user.id)
}

// ─── Event Router ─────────────────────────────────────────────────────────────

async function dispatchEvent(event: WebhookEvent): Promise<void> {
  switch (event.type) {
    case 'user.create':
      return onUserCreate(event)
    case 'user.update':
      return onUserUpdate(event)
    case 'user.delete':
    case 'user.deactivate':
      return onUserDelete(event)
    case 'user.login.success':
      return onLoginSuccess(event)
    case 'user.login.failed':
      return onLoginFailed(event)
    case 'user.registration.create':
      return onRegistrationCreate(event)
    case 'jwt.refresh-token.revoke':
      return onRefreshTokenRevoke(event)
    case 'user.password.breach':
      return onPasswordBreach(event)
    case 'user.password.reset.success':
      return onPasswordReset(event)
    default:
      console.log(`[fusionauth] Unhandled event type: ${event.type} (id: ${event.id})`)
  }
}

// ─── Express Router ───────────────────────────────────────────────────────────

export const fusionAuthWebhookRouter = Router()

fusionAuthWebhookRouter.post(
  '/fusionauth',
  // MUST use raw() here — express.json() would break HMAC signature verification
  raw({ type: 'application/json' }),
  async (req, res) => {
    const webhookSecret = process.env.FUSIONAUTH_WEBHOOK_SECRET

    // 1. Verify signature (skip if webhook signing is not configured)
    if (webhookSecret) {
      const signature = req.headers['x-fusionauth-signature'] as string | undefined

      if (!signature) {
        console.warn('[fusionauth] Webhook received without signature header')
        return res.status(401).json({ error: 'Missing signature' })
      }

      if (!verifyWebhookSignature(req.body as Buffer, signature, webhookSecret)) {
        console.warn('[fusionauth] Webhook signature verification failed')
        return res.status(401).json({ error: 'Invalid signature' })
      }
    }

    // 2. Parse body
    let payload: { event: WebhookEvent }
    try {
      payload = JSON.parse((req.body as Buffer).toString('utf-8'))
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body' })
    }

    const event = payload?.event
    if (!event?.type) {
      return res.status(400).json({ error: 'Missing event.type' })
    }

    // 3. Dispatch — respond 200 BEFORE processing to avoid FusionAuth timeouts
    // FusionAuth considers any non-2xx response a delivery failure and may retry.
    res.sendStatus(200)

    try {
      await dispatchEvent(event)
    } catch (err) {
      console.error(`[fusionauth] Error handling event ${event.type}:`, err)
    }
  }
)
