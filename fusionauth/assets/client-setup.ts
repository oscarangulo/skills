/**
 * FusionAuth TypeScript Client — Setup & Common Patterns
 *
 * Installation:
 *   npm install @fusionauth/typescript-client
 *
 * Required environment variables:
 *   FUSIONAUTH_URL        — e.g. https://your-instance.fusionauth.io
 *   FUSIONAUTH_API_KEY    — created in FusionAuth Admin → API Keys
 *   FUSIONAUTH_APP_ID     — Application UUID from FusionAuth Admin
 *   FUSIONAUTH_TENANT_ID  — Optional; required for multi-tenant deployments
 *
 * Copy this file to lib/fusionauth.ts and customize as needed.
 */

import { FusionAuthClient } from '@fusionauth/typescript-client'

// ─── Client ───────────────────────────────────────────────────────────────────

/**
 * Single shared FusionAuth client.
 * Pass FUSIONAUTH_TENANT_ID if using multi-tenant deployments —
 * it sets X-FusionAuth-TenantId on every request.
 */
export const fusionauth = new FusionAuthClient(
  process.env.FUSIONAUTH_API_KEY!,
  process.env.FUSIONAUTH_URL!,
  process.env.FUSIONAUTH_TENANT_ID   // omit if single-tenant
)

const APP_ID = process.env.FUSIONAUTH_APP_ID!

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuthResult =
  | { status: 'ok';              token: string; refreshToken: string; userId: string }
  | { status: 'mfa_required';    twoFactorId: string }
  | { status: 'password_change'; changePasswordId: string }
  | { status: 'verify_email' }
  | { status: 'not_registered';  userId: string }
  | { status: 'error';           code: number; message: string }

// ─── Login ────────────────────────────────────────────────────────────────────

/**
 * Standard credential login.
 * Returns a typed AuthResult — handle every case in your controller.
 */
export async function login(loginId: string, password: string): Promise<AuthResult> {
  const result = await fusionauth.login({
    loginId,
    password,
    applicationId: APP_ID,
  })

  switch (result.statusCode) {
    case 200:
      return {
        status: 'ok',
        token: result.response.token!,
        refreshToken: result.response.refreshToken!,
        userId: result.response.user!.id!,
      }
    case 202:
      // Authenticated but not registered to this application
      return { status: 'not_registered', userId: result.response.user!.id! }
    case 203:
      // Password change required
      return { status: 'password_change', changePasswordId: result.response.changePasswordId! }
    case 212:
    case 213:
      // Email or registration verification required
      return { status: 'verify_email' }
    case 242:
      // MFA required — twoFactorId valid for ~5 min
      return { status: 'mfa_required', twoFactorId: result.response.twoFactorId! }
    default:
      return {
        status: 'error',
        code: result.statusCode,
        message: result.exception?.message ?? 'Login failed',
      }
  }
}

// ─── MFA ─────────────────────────────────────────────────────────────────────

/**
 * Complete MFA step after receiving a 242 from login().
 *
 * @param twoFactorId  — from the 242 login response (expires ~5 min)
 * @param code         — TOTP code, email code, or SMS code entered by user
 */
export async function loginMFA(twoFactorId: string, code: string): Promise<AuthResult> {
  const result = await fusionauth.twoFactorLogin({
    twoFactorId,
    code,
    applicationId: APP_ID,
  })

  if (result.statusCode === 200) {
    return {
      status: 'ok',
      token: result.response.token!,
      refreshToken: result.response.refreshToken!,
      userId: result.response.user!.id!,
    }
  }

  return {
    status: 'error',
    code: result.statusCode,
    message: result.statusCode === 401
      ? 'MFA code expired — please log in again'
      : result.statusCode === 421
      ? 'Invalid MFA code'
      : 'MFA verification failed',
  }
}

/**
 * Generate a TOTP secret for enabling authenticator-app MFA.
 * Show secretBase32Encoded as a QR code (otpauth:// URI).
 */
export async function generateMFASecret() {
  const result = await fusionauth.generateTwoFactorSecret()
  if (result.statusCode !== 200) throw new Error('Failed to generate MFA secret')
  return {
    secret: result.response.secret!,
    secretBase32Encoded: result.response.secretBase32Encoded!,
  }
}

/**
 * Enable MFA on a user's account.
 * Requires the user to confirm with a valid code first.
 */
export async function enableMFA(
  userId: string,
  secret: string,
  confirmationCode: string,
  method: 'authenticator' | 'email' | 'sms' = 'authenticator'
) {
  const result = await fusionauth.enableTwoFactor(userId, {
    code: confirmationCode,
    method,
    secret,
  })
  if (result.statusCode !== 200) throw new Error(`Failed to enable MFA: ${result.statusCode}`)
}

// ─── Passwordless ─────────────────────────────────────────────────────────────

/**
 * Step 1 of passwordless login — generate a one-time code.
 * Returns the code; you then call sendPasswordlessCode() or use it directly.
 */
export async function startPasswordlessLogin(loginId: string): Promise<string> {
  const result = await fusionauth.startPasswordlessLogin({
    loginId,
    applicationId: APP_ID,
    state: {},
  })
  if (result.statusCode !== 200) throw new Error(`Passwordless start failed: ${result.statusCode}`)
  return result.response.code!
}

/**
 * Step 2 (optional) — send the code to the user via email or SMS.
 */
export async function sendPasswordlessCode(code: string) {
  await fusionauth.sendPasswordlessCode({ code })
}

/**
 * Step 3 — complete passwordless login with the code the user submitted.
 */
export async function loginPasswordless(code: string): Promise<AuthResult> {
  const result = await fusionauth.passwordlessLogin({
    code,
    applicationId: APP_ID,
  })
  if (result.statusCode === 200) {
    return {
      status: 'ok',
      token: result.response.token!,
      refreshToken: result.response.refreshToken!,
      userId: result.response.user!.id!,
    }
  }
  return { status: 'error', code: result.statusCode, message: 'Passwordless login failed' }
}

// ─── Tokens ───────────────────────────────────────────────────────────────────

/**
 * Exchange a refresh token for a new access token.
 * Returns the new access token string on success; throws on failure.
 */
export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const result = await fusionauth.exchangeRefreshTokenForAccessToken(refreshToken)
  if (result.statusCode !== 200) {
    throw new Error(`Token refresh failed: ${result.statusCode}`)
  }
  return result.response.token!
}

/**
 * Validate a JWT access token.
 * Returns the decoded payload on success; returns null on invalid/expired.
 */
export async function validateToken(token: string) {
  const result = await fusionauth.validateJWT(token)
  if (result.statusCode === 200) return result.response.jwt
  return null
}

/**
 * Revoke all refresh tokens for a user (force logout from all sessions).
 */
export async function revokeAllSessions(userId: string) {
  await fusionauth.revokeRefreshTokensByUserId(userId)
}

/**
 * Revoke a specific refresh token (single-session logout).
 */
export async function revokeSession(refreshToken: string) {
  await fusionauth.revokeRefreshTokenByToken(refreshToken)
}

// ─── Users & Registrations ────────────────────────────────────────────────────

/**
 * Create a new user and register them to the application in one call.
 * Use role NAMES (not UUIDs) in the roles array.
 */
export async function createUser(
  email: string,
  password: string,
  roles: string[] = ['user'],
  extraData?: Record<string, unknown>
) {
  const result = await fusionauth.register(undefined, {
    user: {
      email,
      password,
      data: extraData,
    },
    registration: {
      applicationId: APP_ID,
      roles,
    },
    sendSetPasswordEmail: false,
    skipVerification: false,
  })

  if (result.statusCode !== 200) {
    const errors = result.exception?.fieldErrors ?? result.error
    throw new Error(`User creation failed: ${JSON.stringify(errors)}`)
  }

  return {
    userId: result.response.user!.id!,
    token: result.response.token,
    refreshToken: result.response.refreshToken,
  }
}

/**
 * Register an existing user to an application.
 */
export async function registerUserToApp(
  userId: string,
  roles: string[] = ['user']
) {
  const result = await fusionauth.register(userId, {
    registration: {
      applicationId: APP_ID,
      roles,
    },
  })
  if (result.statusCode !== 200) {
    throw new Error(`Registration failed: ${result.statusCode}`)
  }
}

/**
 * Partially update a user (JSON Merge Patch — only specified fields change).
 */
export async function updateUser(userId: string, changes: {
  firstName?: string
  lastName?: string
  data?: Record<string, unknown>
  [key: string]: unknown
}) {
  const result = await fusionauth.patchUser(userId, { user: changes })
  if (result.statusCode !== 200) {
    throw new Error(`User update failed: ${result.statusCode}`)
  }
  return result.response.user
}

/**
 * Retrieve a user by their FusionAuth UUID.
 */
export async function getUserById(userId: string) {
  const result = await fusionauth.retrieveUser(userId)
  if (result.statusCode === 404) return null
  if (result.statusCode !== 200) throw new Error(`Retrieve user failed: ${result.statusCode}`)
  return result.response.user
}

/**
 * Retrieve a user by email address.
 */
export async function getUserByEmail(email: string) {
  const result = await fusionauth.retrieveUserByEmail(email)
  if (result.statusCode === 404) return null
  if (result.statusCode !== 200) throw new Error(`Retrieve user failed: ${result.statusCode}`)
  return result.response.user
}

/**
 * Soft-delete (deactivate) a user. Use hardDelete = true to permanently remove.
 */
export async function deleteUser(userId: string, hardDelete = false) {
  const result = await fusionauth.deleteUser(userId, hardDelete)
  if (result.statusCode !== 200) throw new Error(`Delete user failed: ${result.statusCode}`)
}

// ─── OAuth2 / OIDC ────────────────────────────────────────────────────────────

/**
 * Build the FusionAuth Authorization URL for the OAuth2 PKCE flow.
 * Store codeVerifier in session for use in the callback.
 */
export function buildAuthorizationUrl(
  redirectUri: string,
  state: string,
  codeChallenge: string,
  scopes = 'openid offline_access'
): string {
  const url = new URL(`${process.env.FUSIONAUTH_URL}/oauth2/authorize`)
  url.searchParams.set('client_id', APP_ID)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', scopes)
  url.searchParams.set('state', state)
  url.searchParams.set('code_challenge', codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  return url.toString()
}

/**
 * Build the FusionAuth Logout URL (OIDC end_session_endpoint).
 */
export function buildLogoutUrl(postLogoutRedirectUri: string): string {
  const url = new URL(`${process.env.FUSIONAUTH_URL}/oauth2/logout`)
  url.searchParams.set('client_id', APP_ID)
  url.searchParams.set('post_logout_redirect_uri', postLogoutRedirectUri)
  return url.toString()
}

/**
 * Exchange an authorization code for tokens (PKCE flow).
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
  codeVerifier: string,
  clientSecret = ''
) {
  const result = await fusionauth.exchangeOAuthCodeForAccessTokenUsingPKCE(
    code,
    clientSecret,
    redirectUri,
    APP_ID,
    codeVerifier
  )
  if (result.statusCode !== 200) {
    throw new Error(`OAuth code exchange failed: ${result.statusCode}`)
  }
  return result.response
}
