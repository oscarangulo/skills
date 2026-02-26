# FusionAuth Webhook Events

All webhook events are delivered as `POST` requests with `Content-Type: application/json` to your configured endpoint URL.

---

## Event Payload Envelope

Every event shares the same outer envelope:

```json
{
  "event": {
    "type": "user.create",
    "createInstant": 1710000000000,
    "id": "uuid-of-this-event",
    "tenantId": "uuid-of-tenant",
    "info": {
      "ipAddress": "203.0.113.1",
      "userAgent": "Mozilla/5.0 ...",
      "deviceName": "iPhone",
      "deviceType": "Mobile"
    }
  }
}
```

The `event.type` field determines the event type. Additional fields are nested under `event` and vary per event type.

---

## Signature Verification (v1.48.0+)

When `webhook.signatureConfiguration.enabled = true`, FusionAuth includes an `X-FusionAuth-Signature` header:

```
X-FusionAuth-Signature: sha256=<hex-encoded-hmac>
```

Verify before trusting the payload:

```ts
import * as crypto from 'crypto'

function verifySignature(rawBody: string, header: string, secret: string): boolean {
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`
  return crypto.timingSafeEqual(Buffer.from(header), Buffer.from(expected))
}
```

> Use `express.raw({ type: 'application/json' })` — **not** `express.json()` — to preserve the raw body buffer needed for HMAC computation.

---

## Event Catalogue

### User Lifecycle

| Event Type | When It Fires | Key Fields |
|-----------|--------------|------------|
| `user.create` | New user is created | `event.user` (full user object) |
| `user.update` | User record is modified | `event.user`, `event.original` |
| `user.delete` | User is deleted | `event.user` |
| `user.deactivate` | User is deactivated (soft delete) | `event.user` |
| `user.reactivate` | Deactivated user is reactivated | `event.user` |
| `user.bulk.create` | Multiple users created via bulk import | `event.users[]` |

### Authentication

| Event Type | When It Fires | Key Fields | Plan |
|-----------|--------------|------------|------|
| `user.login.success` | Successful login | `event.user`, `event.applicationId`, `event.authenticationType` | All |
| `user.login.failed` | Failed login attempt | `event.loginId`, `event.applicationId`, `event.reason` | All |
| `user.login.new-device` | Login from an unrecognized device | `event.user`, `event.info.deviceName` | Starter+ |
| `user.login.suspicious` | Login flagged as suspicious | `event.user`, `event.info.ipAddress`, `event.reason` | Enterprise |

### Registration

| Event Type | When It Fires | Key Fields |
|-----------|--------------|------------|
| `user.registration.create` | User registered to an application | `event.user`, `event.registration` (applicationId, roles) |
| `user.registration.update` | Registration record modified | `event.user`, `event.registration`, `event.original` |
| `user.registration.delete` | User deregistered from application | `event.user`, `event.registration` |
| `user.registration.verified` | User completed registration verification | `event.user`, `event.registration` |

### Password & Security

| Event Type | When It Fires | Key Fields | Plan |
|-----------|--------------|------------|------|
| `user.password.update` | User changes their password | `event.user` | All |
| `user.password.reset.send` | Forgot-password email is sent | `event.user` | All |
| `user.password.reset.start` | Password reset workflow starts | `event.user` | All |
| `user.password.reset.success` | Password successfully reset | `event.user` | All |
| `user.password.breach` | Password found in breach database | `event.user`, `event.loginId` | Enterprise |

### Email & Verification

| Event Type | When It Fires | Key Fields |
|-----------|--------------|------------|
| `user.email.verified` | Email address verified | `event.user` |
| `user.email.update` | Email address changed | `event.user`, `event.previousEmail` |

### MFA

| Event Type | When It Fires | Key Fields |
|-----------|--------------|------------|
| `user.two-factor.method.add` | MFA method added to account | `event.user`, `event.method` |
| `user.two-factor.method.remove` | MFA method removed from account | `event.user`, `event.method` |

### Identity Provider

| Event Type | When It Fires | Key Fields |
|-----------|--------------|------------|
| `user.identity-provider.link` | User account linked to external IDP | `event.user`, `event.identityProviderLink` |
| `user.identity-provider.unlink` | IDP link removed from user | `event.user`, `event.identityProviderLink` |

### JWT & Tokens

| Event Type | When It Fires | Key Fields |
|-----------|--------------|------------|
| `jwt.refresh-token.revoke` | Refresh token(s) revoked | `event.userId`, `event.applicationTimeToLiveInSeconds` |
| `jwt.public-key.update` | JWT signing key rotated | `event.applicationIds[]` |
| `jwt.refresh` | Access token refreshed | `event.applicationId`, `event.userId` |

### User Actions

| Event Type | When It Fires | Key Fields |
|-----------|--------------|------------|
| `user.action` | User action applied (lock, etc.) | `event.user`, `event.action`, `event.actionerUserId` |

### System

| Event Type | When It Fires | Key Fields |
|-----------|--------------|------------|
| `audit-log.create` | Admin action logged | `event.auditLog` |
| `event-log.create` | FusionAuth internal event logged | `event.eventLog` |
| `kickstart.success` | Kickstart configuration applied | — |

### SCIM (Enterprise)

| Event Type | Plan |
|-----------|------|
| `user.create` (via SCIM) | Enterprise |
| `group.create` | Enterprise |
| `group.update` | Enterprise |
| `group.delete` | Enterprise |
| `group.member.add` | Enterprise |
| `group.member.remove` | Enterprise |

---

## Event-Specific Payload Examples

### `user.login.success`

```json
{
  "event": {
    "type": "user.login.success",
    "createInstant": 1710000000000,
    "id": "event-uuid",
    "tenantId": "tenant-uuid",
    "applicationId": "app-uuid",
    "authenticationType": "PASSWORD",
    "info": {
      "ipAddress": "203.0.113.1",
      "userAgent": "Mozilla/5.0 ...",
      "deviceType": "DESKTOP"
    },
    "user": {
      "id": "user-uuid",
      "email": "user@example.com",
      "firstName": "Ada",
      "lastName": "Lovelace",
      "registrations": [
        {
          "applicationId": "app-uuid",
          "roles": ["user"]
        }
      ]
    }
  }
}
```

### `user.create`

```json
{
  "event": {
    "type": "user.create",
    "createInstant": 1710000000000,
    "id": "event-uuid",
    "tenantId": "tenant-uuid",
    "user": {
      "id": "user-uuid",
      "email": "newuser@example.com",
      "firstName": "New",
      "lastName": "User",
      "verified": false,
      "active": true,
      "data": {}
    }
  }
}
```

### `jwt.refresh-token.revoke`

```json
{
  "event": {
    "type": "jwt.refresh-token.revoke",
    "createInstant": 1710000000000,
    "id": "event-uuid",
    "tenantId": "tenant-uuid",
    "userId": "user-uuid",
    "applicationTimeToLiveInSeconds": {
      "app-uuid": 3600
    }
  }
}
```

---

## Webhook Configuration Reference

```ts
// Create webhook via SDK
await fusionauth.createWebhook({
  webhook: {
    url: 'https://your-app.com/webhooks/fusionauth',
    connectTimeout: 1000,    // ms to establish connection
    readTimeout: 2000,       // ms to wait for response
    global: true,            // true = all tenants, false = specific tenants
    tenantIds: [],           // populate if global = false
    headers: {               // custom headers sent with every request
      'X-Custom-Header': 'value',
    },
    httpAuthenticationUsername: 'webhook-user',  // optional basic auth
    httpAuthenticationPassword: 'webhook-pass',
    signatureConfiguration: {
      enabled: true,         // v1.48.0+ — enables X-FusionAuth-Signature header
      signingKeyId: 'key-uuid',
    },
    eventsEnabled: {
      'user.create': true,
      'user.login.success': true,
      'user.delete': true,
      'jwt.refresh-token.revoke': true,
    },
    sslCertificateKeyId: 'cert-uuid',  // optional client certificate auth
  },
})
```
