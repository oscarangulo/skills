# FusionAuth Integration Gotchas

Common mistakes when integrating FusionAuth, with working fixes.

---

## Client Setup

### ❌ Missing `X-FusionAuth-TenantId` in multi-tenant deployments

In a multi-tenant FusionAuth instance, calling user APIs without specifying a tenant causes ambiguity errors or silently returns users from the wrong tenant.

```ts
// ❌ Dangerous in multi-tenant — FusionAuth doesn't know which tenant to search
const client = new FusionAuthClient(apiKey, url)
await client.retrieveUserByEmail('user@example.com')
```

```ts
// ✅ Always pass tenantId — even if you only have one tenant
const client = new FusionAuthClient(apiKey, url, tenantId)
await client.retrieveUserByEmail('user@example.com')
```

**Why**: Identical email addresses can exist in different tenants. Without a tenant ID header, FusionAuth may return a `400` "multiple users found" error or return the wrong user.

---

### ❌ Using the FusionAuth SDK directly in browser code

The SDK requires an API key. API keys must never be exposed in browser-side code.

```ts
// ❌ Never do this — API key is visible in browser DevTools
const client = new FusionAuthClient('your-secret-api-key', url)
```

```ts
// ✅ Always proxy through your own server endpoint
// Browser → your API → FusionAuth
// Pass `null` as the API key only if you're building a browser SDK wrapper
// for public (unauthenticated) operations like OAuth code exchange
const publicClient = new FusionAuthClient(null, url)
```

---

## Login & Tokens

### ❌ Refresh tokens not issued after login

By default, `generateRefreshTokens` is `false` in application settings. The login response will have `token` (JWT) but no `refreshToken`.

```ts
// ❌ refreshToken is undefined — generateRefreshTokens is false
const { token, refreshToken } = result.response
// refreshToken === undefined
```

**Fix**: In FusionAuth Admin → Applications → [Your App] → OAuth tab → enable "Generate refresh tokens". Or check the application config:

```json
{
  "application": {
    "loginConfiguration": {
      "generateRefreshTokens": true,
      "refreshTokenExpirationPolicy": "SlidingWindow",
      "refreshTokenTimeToLiveInMinutes": 43200
    }
  }
}
```

---

### ❌ Using `noJWT: true` when you actually need the token

The `noJWT` login option skips JWT generation entirely. Useful for high-volume login checks (e.g., headless import scripts), but a common mistake when building actual user sessions.

```ts
// ❌ Returns 200 but token is null — forgot noJWT was set
const result = await fusionauth.login({ loginId, password, applicationId, noJWT: true })
const { token } = result.response  // token === null
```

```ts
// ✅ Remove noJWT (or set to false) when user needs a session token
const result = await fusionauth.login({ loginId, password, applicationId })
```

---

### ❌ Not handling `twoFactorId` expiry on MFA step

The `twoFactorId` returned on a `242` response is only valid for approximately 5 minutes. If the user takes too long to enter their MFA code, the subsequent `twoFactorLogin` call returns `401`.

```ts
// ❌ No expiry handling — user gets a confusing error
const mfaResult = await fusionauth.twoFactorLogin({ twoFactorId, code, applicationId })
// May return 401 if > 5 min have passed
```

```ts
// ✅ Store the twoFactorId start time and restart login if expired
if (mfaResult.statusCode === 401) {
  // twoFactorId expired — redirect back to login step
  return res.redirect('/login?error=mfa_expired')
}
```

---

### ❌ JWT public key cache not invalidated on `kid` mismatch

If you cache public keys for local JWT verification and FusionAuth rotates its signing key, your cache becomes stale. Verifying a token with the wrong key causes all validations to fail.

```ts
// ❌ Cached forever — breaks silently after key rotation
const { publicKeys } = await fusionauth.retrieveJwtPublicKeys()
// saved once, never refreshed
```

```ts
// ✅ Re-fetch when the JWT's kid header doesn't match any cached key
import jwt from 'jsonwebtoken'
import jwksClient from 'jwks-rsa'

// Use a JWKS client that fetches automatically
const client = jwksClient({
  jwksUri: `${process.env.FUSIONAUTH_URL}/.well-known/jwks.json`,
  cache: true,
  rateLimit: true,
})
```

---

## Users & Registrations

### ❌ Using role UUIDs instead of role names in registrations

FusionAuth registration roles are referenced by **name**, not by UUID.

```ts
// ❌ Wrong — UUID will be silently ignored or cause a 400 error
await fusionauth.register(userId, {
  registration: {
    applicationId,
    roles: ['550e8400-e29b-41d4-a716-446655440000'],  // ❌ UUID
  },
})
```

```ts
// ✅ Use the role name string as configured in the application
await fusionauth.register(userId, {
  registration: {
    applicationId,
    roles: ['admin', 'user'],  // ✅ Names
  },
})
```

---

### ❌ Overwriting `user.data` on PATCH instead of merging

`PATCH /api/user/{userId}` with `user.data` performs a **JSON Merge Patch** — sending partial data replaces the existing keys in `data`, but omitting a key does NOT delete it. However, sending an explicit `null` for a key DOES delete it.

```ts
// ❌ This removes every key in user.data except 'plan'
await fusionauth.patchUser(userId, {
  user: { data: { plan: 'pro' } }  // existing keys NOT in this object are preserved
})

// ✅ Correct — merge patch keeps existing keys, only updates 'plan'
// The above is actually fine — merge patch is safe for partial updates
// The gotcha is when you do a PUT (full replace) thinking it's a PATCH
```

**The real gotcha**: Accidentally using `updateUser` (PUT) when you only want to change one field. PUT replaces the entire user object.

```ts
// ❌ PUT replaces everything — blanks out firstName, lastName, etc.
await fusionauth.updateUser(userId, { user: { data: { plan: 'pro' } } })

// ✅ PATCH only changes what you specify
await fusionauth.patchUser(userId, { user: { data: { plan: 'pro' } } })
```

---

### ❌ Creating a user without registering them to an application

Users created with `POST /api/user` exist in FusionAuth but have no relationship to any application. They cannot log in via your app until registered.

```ts
// ❌ User exists but can't log in — no registration
await fusionauth.createUser(undefined, { user: { email, password } })
```

```ts
// ✅ Create user AND registration in a single call
await fusionauth.register(undefined, {
  user: { email, password },
  registration: { applicationId, roles: ['user'] },
})
```

---

## Webhooks

### ❌ Not using `express.raw()` for webhook signature verification

Signature verification requires the raw request body as a Buffer. If you use `express.json()` middleware before the webhook route, the body is already parsed and the signature will never match.

```ts
// ❌ Body is already a parsed object — HMAC will fail
app.use(express.json())
app.post('/webhooks/fusionauth', (req, res) => {
  const sig = req.headers['x-fusionauth-signature']
  // req.body is an object here, not the raw bytes — verification will fail
})
```

```ts
// ✅ Use raw body parser specifically for this route, BEFORE express.json()
app.post(
  '/webhooks/fusionauth',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    // req.body is a Buffer — correct for HMAC
    const raw = req.body.toString('utf-8')
    const sig = req.headers['x-fusionauth-signature'] as string
    // verify signature against raw
  }
)
```

---

### ❌ Subscribing to Enterprise-only events on a Community/Starter plan

Some webhook events are silently not emitted if your FusionAuth plan doesn't include them.

Events requiring **Starter** or higher:
- `user.login.suspicious`
- `user.password.breach`
- `user.email.update` (in some contexts)

Events requiring **Enterprise**:
- `threat-detection.*`
- Advanced security events

**Fix**: Check your plan at FusionAuth Admin → Reactor before subscribing to these events. The webhook will be created successfully but the events will never fire.

---

## OAuth2 / OIDC

### ❌ Missing `offline_access` scope when requesting a refresh token via OAuth

If you're using the OAuth Authorization Code flow and want a refresh token, you must include `offline_access` in the scope parameter. Without it, only an access token is issued.

```ts
// ❌ No refresh token will be issued
authUrl.searchParams.set('scope', 'openid')

// ✅ Include offline_access
authUrl.searchParams.set('scope', 'openid offline_access')
```

---

### ❌ Not validating the `state` parameter in OAuth callbacks

CSRF attacks on OAuth flows are possible if you don't verify the `state` parameter.

```ts
// ❌ No state validation
app.get('/auth/callback', async (req, res) => {
  const { code } = req.query
  const tokens = await exchangeCode(code)
})

// ✅ Generate and verify state
app.get('/login', (req, res) => {
  const state = crypto.randomUUID()
  req.session.oauthState = state
  authUrl.searchParams.set('state', state)
  res.redirect(authUrl.toString())
})

app.get('/auth/callback', async (req, res) => {
  if (req.query.state !== req.session.oauthState) {
    return res.status(400).send('Invalid state — possible CSRF attack')
  }
  // ... exchange code
})
```

---

## Security

### ❌ Returning different error messages for wrong email vs. wrong password

This is a security vulnerability — it allows attackers to enumerate valid accounts.

```ts
// ❌ Reveals which field is wrong
if (result.statusCode === 404) return res.json({ error: 'Email not found' })
if (result.statusCode === 200 && !match) return res.json({ error: 'Wrong password' })

// ✅ Always return the same generic message
if (result.statusCode === 404 || result.statusCode === 400) {
  return res.json({ error: 'Invalid email or password' })
}
```

---

### ❌ Storing `FUSIONAUTH_API_KEY` in version control

Never commit `.env` files containing API keys.

```bash
# .gitignore
.env
.env.local
.env.production
```

Use environment variables in CI/CD (Vercel, Railway, GitHub Secrets) and rotate API keys via FusionAuth Admin → API Keys if they are ever exposed.
