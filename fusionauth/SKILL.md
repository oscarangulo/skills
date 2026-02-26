---
name: fusionauth
description: "Implement authentication and user management with FusionAuth. Use when asked to: add login, logout, MFA, passwordless auth, passkeys/WebAuthn, register users, refresh JWTs, set up OAuth2/OIDC, configure social login (Google, Apple, LinkedIn), handle webhooks, manage multi-tenant deployments, integrate FusionAuth SDK, set up identity providers, configure SAML, revoke tokens, enforce role-based access, or troubleshoot FusionAuth API errors."
---

# FusionAuth

Integrates authentication, authorization, and user management with FusionAuth using the official TypeScript SDK and REST APIs. Covers all auth flows, token lifecycle, webhooks, and multi-tenant deployments.

## Workflow

### 1. Audit existing setup

Read:
- `.env` / `.env.local` — look for `FUSIONAUTH_URL`, `FUSIONAUTH_API_KEY`, `FUSIONAUTH_APP_ID`, `FUSIONAUTH_TENANT_ID`
- `package.json` — confirm `@fusionauth/typescript-client` is listed
- Any existing auth files (e.g., `lib/auth.ts`, `server/fusionauth.ts`) — identify what flows are already implemented

If the SDK is not installed:
```bash
npm install @fusionauth/typescript-client
```

Required environment variables:
```env
FUSIONAUTH_URL=https://your-instance.fusionauth.io   # Self-hosted: http://localhost:9011
FUSIONAUTH_API_KEY=your-api-key                       # Created in FusionAuth Admin → API Keys
FUSIONAUTH_APP_ID=your-application-uuid               # Application UUID from FusionAuth Admin
FUSIONAUTH_TENANT_ID=your-tenant-uuid                 # Only required for multi-tenant setups
```

### 2. Initialize the client

Use the template in `assets/client-setup.ts` as the starting point.

Single-tenant setup:
```ts
import { FusionAuthClient } from '@fusionauth/typescript-client'

export const fusionauth = new FusionAuthClient(
  process.env.FUSIONAUTH_API_KEY!,
  process.env.FUSIONAUTH_URL!
)
```

Multi-tenant setup (include tenant header on every request):
```ts
export const fusionauth = new FusionAuthClient(
  process.env.FUSIONAUTH_API_KEY!,
  process.env.FUSIONAUTH_URL!,
  process.env.FUSIONAUTH_TENANT_ID   // passed as X-FusionAuth-TenantId header
)
```

> **Why**: Omitting the tenant ID in a multi-tenant deployment causes user lookups to fail silently or return users from the wrong tenant. Always pass it, even if you only have one tenant — it prevents ambiguity.

### 3. Standard login flow

Endpoint: `POST /api/login`

```ts
const result = await fusionauth.login({
  loginId: 'user@example.com',     // email, username, or phone
  password: 'plaintext-password',  // transmitted over TLS, hashed by FusionAuth
  applicationId: process.env.FUSIONAUTH_APP_ID!,
  noJWT: false,                    // set true for high-volume requests that don't need a JWT
})

switch (result.statusCode) {
  case 200:
    // Fully authenticated
    const { token, refreshToken, user } = result.response
    break
  case 202:
    // Authenticated but not registered to this application
    // → Register user to app, then issue token
    break
  case 203:
    // Password change required
    // → Redirect to /change-password
    break
  case 212:
    // Email or phone verification required
    // → Show verification prompt
    break
  case 213:
    // Registration verification required
    // → Show registration verification prompt
    break
  case 242:
    // MFA required — continue with MFA flow (see §4)
    const { twoFactorId } = result.response
    break
  case 404:
    // Invalid credentials — show generic "invalid email or password" (never reveal which is wrong)
    break
}
```

See `references/response-codes.md` for the full response code reference.

### 4. MFA (Two-Factor Authentication) flow

When login returns `242`, the response contains a `twoFactorId` (valid for ~5 minutes). Use it to complete authentication:

```ts
// Step 1: Initial login returns twoFactorId
const loginResult = await fusionauth.login({ loginId, password, applicationId })
// loginResult.statusCode === 242
const { twoFactorId } = loginResult.response

// Step 2: User enters code from authenticator app / email / SMS
const mfaResult = await fusionauth.twoFactorLogin({
  twoFactorId,
  code: '123456',                  // TOTP code, email code, or SMS code
  applicationId: process.env.FUSIONAUTH_APP_ID!,
})
// mfaResult.statusCode === 200 → fully authenticated
const { token, refreshToken, user } = mfaResult.response
```

Enable MFA for a user:
```ts
// 1. Generate a TOTP secret
const secretResult = await fusionauth.generateTwoFactorSecret()
const { secret, secretBase32Encoded } = secretResult.response
// Show secretBase32Encoded as QR code to the user

// 2. User scans QR code and confirms with a code
await fusionauth.enableTwoFactor(userId, {
  code: '123456',                  // confirmation code from authenticator app
  method: 'authenticator',         // 'authenticator' | 'email' | 'sms'
  secret,
})
```

MFA methods by plan:
| Method | Plans | Notes |
|--------|-------|-------|
| `authenticator` (TOTP) | All | Google Authenticator, Authy compatible |
| `email` | Starter+ | Code delivered via email |
| `sms` | Starter+ | Code delivered via SMS |

### 5. Passwordless login flow

Three-step flow — start → send → complete:

```ts
// Step 1: Generate a passwordless code
const startResult = await fusionauth.startPasswordlessLogin({
  loginId: 'user@example.com',
  applicationId: process.env.FUSIONAUTH_APP_ID!,
  state: {},
})
const { code } = startResult.response  // one-time code, expires ~5 min

// Step 2: Send the code to the user (optional if using ClickableLink method)
await fusionauth.sendPasswordlessCode({
  code,
})

// Step 3: User submits the code → complete login
const loginResult = await fusionauth.passwordlessLogin({
  code,
  applicationId: process.env.FUSIONAUTH_APP_ID!,
})
const { token, refreshToken } = loginResult.response
```

### 6. WebAuthn / Passkeys

Registration ceremony (add a passkey to an existing account):
```ts
// Step 1: Get registration options from FusionAuth
const startResult = await fusionauth.startWebAuthnRegistration(userId, {
  displayName: 'My Laptop',
  name: 'user@example.com',
  userVerificationRequirement: 'required',
  workflow: 'general',
})
const { options } = startResult.response

// Step 2: Browser performs navigator.credentials.create(options)
// Step 3: Send credential back to FusionAuth
const completeResult = await fusionauth.completeWebAuthnRegistration({
  credential: browserCredentialResponse,
})
```

Authentication ceremony:
```ts
// Step 1: Get assertion options
const assertResult = await fusionauth.startWebAuthnLogin({
  loginId: 'user@example.com',
  applicationId: process.env.FUSIONAUTH_APP_ID!,
  workflow: 'general',
})
const { options } = assertResult.response

// Step 2: Browser performs navigator.credentials.get(options)
// Step 3: Verify credential
const loginResult = await fusionauth.completeWebAuthnLogin({
  credential: browserAssertionResponse,
  applicationId: process.env.FUSIONAUTH_APP_ID!,
})
const { token, refreshToken } = loginResult.response
```

### 7. User registration and management

Create a user and register them to an application in a single call:
```ts
const result = await fusionauth.register(undefined, {
  user: {
    email: 'user@example.com',
    password: 'secure-password',
    firstName: 'Ada',
    lastName: 'Lovelace',
  },
  registration: {
    applicationId: process.env.FUSIONAUTH_APP_ID!,
    roles: ['user', 'admin'],      // use role NAMES, not UUIDs
  },
  sendSetPasswordEmail: false,
  skipVerification: false,
})
const { user, registration, token } = result.response
```

Update a user (partial patch):
```ts
await fusionauth.patchUser(userId, {
  user: {
    firstName: 'Ada',
    data: { plan: 'pro' },         // store arbitrary key-value data here
  },
})
```

Register an existing user to an application:
```ts
await fusionauth.register(userId, {
  registration: {
    applicationId: process.env.FUSIONAUTH_APP_ID!,
    roles: ['user'],
  },
})
```

Retrieve user by different identifiers:
```ts
// By userId
const { response: { user } } = await fusionauth.retrieveUser(userId)

// By email
const { response: { user } } = await fusionauth.retrieveUserByEmail('user@example.com')

// By login ID (email or username)
const { response: { user } } = await fusionauth.retrieveUserByLoginId('user@example.com')
```

### 8. JWT and token management

Refresh an access token:
```ts
const result = await fusionauth.exchangeRefreshTokenForAccessToken(refreshToken)
// result.statusCode === 200
const { token: newAccessToken, refreshToken: newRefreshToken } = result.response
```

> **Why refresh tokens may not be issued**: `application.loginConfiguration.generateRefreshTokens` defaults to `false`. Enable it in FusionAuth Admin → Applications → [App] → OAuth → Refresh token grant.

Validate a JWT (server-side check):
```ts
// Via SDK
const result = await fusionauth.validateJWT(accessToken)
// result.statusCode === 200 → valid; 401 → expired or invalid

// Or call the API directly:
// GET /api/jwt/validate
// Authorization: Bearer <token>
```

Retrieve public keys for local verification:
```ts
// Fetch once and cache; re-fetch only on JWT kid mismatch
const keysResult = await fusionauth.retrieveJwtPublicKeys()
const { publicKeys } = keysResult.response
```

Revoke all refresh tokens for a user (force logout all sessions):
```ts
await fusionauth.revokeRefreshTokensByUserId(userId)
```

Revoke a single refresh token:
```ts
await fusionauth.revokeRefreshTokenByToken(refreshToken)
```

### 9. Webhooks

Create a webhook subscription:
```ts
await fusionauth.createWebhook({
  webhook: {
    url: 'https://your-app.com/webhooks/fusionauth',
    eventsEnabled: {
      'user.create': true,
      'user.login.success': true,
      'user.delete': true,
      'jwt.refresh-token.revoke': true,
      'user.password.breach': true,   // Requires Enterprise plan
    },
    connectTimeout: 1000,
    readTimeout: 2000,
    global: true,                     // false → tenant-specific
    signatureConfiguration: {
      enabled: true,                  // Available in v1.48.0+
    },
  },
})
```

Handle incoming webhook events (see `assets/webhook-handler.ts` for a full Express handler):
```ts
// Verify signature before trusting payload
import * as crypto from 'crypto'

function verifyWebhookSignature(body: string, signature: string, secret: string): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex')
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(`sha256=${expected}`))
}

app.post('/webhooks/fusionauth', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-fusionauth-signature'] as string
  if (!verifyWebhookSignature(req.body.toString(), signature, process.env.WEBHOOK_SECRET!)) {
    return res.status(401).send('Invalid signature')
  }
  const event = JSON.parse(req.body.toString())
  // handle event.type
  res.sendStatus(200)
})
```

See `references/webhook-events.md` for the full event catalogue.

### 10. OAuth2 / OIDC

PKCE flow for SPAs and server-side apps:
```ts
// 1. Redirect user to FusionAuth authorization endpoint
const authUrl = new URL(`${process.env.FUSIONAUTH_URL}/oauth2/authorize`)
authUrl.searchParams.set('client_id', process.env.FUSIONAUTH_APP_ID!)
authUrl.searchParams.set('redirect_uri', 'https://your-app.com/auth/callback')
authUrl.searchParams.set('response_type', 'code')
authUrl.searchParams.set('scope', 'openid offline_access')
authUrl.searchParams.set('code_challenge', pkceChallenge)
authUrl.searchParams.set('code_challenge_method', 'S256')
// redirect(authUrl.toString())

// 2. After redirect, exchange code for tokens
const tokenResult = await fusionauth.exchangeOAuthCodeForAccessTokenUsingPKCE(
  code,
  'your-client-secret',           // empty string for public clients
  'https://your-app.com/auth/callback',
  process.env.FUSIONAUTH_APP_ID!,
  codeVerifier
)
const { access_token, refresh_token, id_token } = tokenResult.response
```

Logout (invalidate session):
```ts
const logoutUrl = new URL(`${process.env.FUSIONAUTH_URL}/oauth2/logout`)
logoutUrl.searchParams.set('client_id', process.env.FUSIONAUTH_APP_ID!)
logoutUrl.searchParams.set('post_logout_redirect_uri', 'https://your-app.com')
// redirect(logoutUrl.toString())
```

### 11. Multi-tenant patterns

When a single FusionAuth instance serves multiple independent tenants:

```ts
// Always include X-FusionAuth-TenantId in the client constructor or per-request
const tenantClient = new FusionAuthClient(
  process.env.FUSIONAUTH_API_KEY!,
  process.env.FUSIONAUTH_URL!,
  tenantId                         // scopes ALL requests to this tenant
)

// Or dynamically per-request (create a new client per tenant):
function getClientForTenant(tenantId: string) {
  return new FusionAuthClient(
    process.env.FUSIONAUTH_API_KEY!,
    process.env.FUSIONAUTH_URL!,
    tenantId
  )
}
```

> **Why**: In multi-tenant mode, identical email addresses can exist in different tenants. Without the tenant ID header, FusionAuth may return users from the wrong tenant or return a 400/404 ambiguity error.

### 12. Identity providers (social login)

Identity providers are configured in FusionAuth Admin — the SDK handles the token exchange after the OAuth redirect:

```ts
// After user returns from Google/Apple/etc. with an authorization code:
const result = await fusionauth.identityProviderLogin({
  applicationId: process.env.FUSIONAUTH_APP_ID!,
  data: {
    token: googleIdToken,          // ID token from the identity provider
  },
  identityProviderId: 'google-identity-provider-uuid',
  noJWT: false,
})
const { token, refreshToken, user } = result.response
```

Supported identity provider types (15 total):
- Social: Google, Apple, Facebook, Twitter/X, LinkedIn, GitHub, Twitch, Steam, Xbox, PlayStation, Epic Games
- Federated: SAML v2, OpenID Connect (OIDC), External JWT
- Directory: HYPR

## References

- **`references/api-cheatsheet.md`** — All FusionAuth API endpoints in one quick-scan table. Read this when you need an endpoint path or HTTP method quickly.
- **`references/response-codes.md`** — Full HTTP status code reference for the Login API. Read this when building conditional login flows or debugging unexpected response codes.
- **`references/gotchas.md`** — Common integration mistakes and how to fix them. Read this when something isn't working or before starting a new integration.
- **`references/webhook-events.md`** — Full catalogue of 40+ webhook event types with payload shapes and plan requirements. Read this when configuring webhooks or building event handlers.
- **`assets/client-setup.ts`** — Ready-to-use TypeScript client with wrapper functions for every major flow. Copy and customize for your project.
- **`assets/webhook-handler.ts`** — Express.js webhook handler with signature verification and typed event routing. Copy for server-side webhook endpoints.
