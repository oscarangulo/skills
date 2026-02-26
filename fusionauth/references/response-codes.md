# FusionAuth Login Response Codes

The Login API (`POST /api/login`) uses HTTP status codes to communicate the full authentication state. These codes drive all conditional UI logic in your application.

---

## Success Codes

| Code | Name | Meaning | Required Action |
|------|------|---------|-----------------|
| `200` | Authenticated | User is fully authenticated | Store `token` and `refreshToken`, redirect to app |
| `202` | Authenticated — Not Registered | Credentials valid, but user has no registration for this `applicationId` | Call `POST /api/user/registration/{userId}` to register them, then issue JWT |

---

## Conditional / Incomplete Auth Codes

These codes mean the credentials were valid but the login cannot complete without further action.

| Code | Name | Meaning | Required Action |
|------|------|---------|-----------------|
| `203` | Password Change Required | Admin or policy forced a password change | Redirect to change-password form; use `changePasswordId` from response |
| `212` | Email Verification Required | User's email address is not yet verified | Show verification prompt; resend via `PUT /api/user/verify-email?applicationId=&email=` |
| `213` | Registration Verification Required | User's registration for this app is not verified | Show registration verification prompt; resend via `PUT /api/user/verify-registration?applicationId=&email=` |
| `242` | MFA Required | The account has MFA enabled and requires a second factor | Redirect to MFA step; use `twoFactorId` from response (expires in ~5 min) |

> **Handling `242` correctly**: Store the `twoFactorId` in session state. The subsequent `POST /api/two-factor/login` call requires it. If the user takes longer than ~5 minutes, restart the login flow — the `twoFactorId` has expired.

---

## Error Codes

| Code | Name | Meaning | Required Action |
|------|------|---------|-----------------|
| `400` | Bad Request | Missing required field or malformed request body | Log `error.fieldErrors`, show form validation feedback |
| `401` | Unauthorized | Invalid API key (not the user's password) | Check server-side `FUSIONAUTH_API_KEY` environment variable |
| `404` | Not Found | No user found with that `loginId`, or wrong `applicationId` | Show generic "Invalid email or password" — never reveal which field is wrong |
| `409` | Conflict | Account is locked or a user action is blocking login | Check `changePasswordId`, `lockCount`, or `twoFactorId` in error response |
| `410` | Gone | Account has been deleted | Show "Account not found" or re-registration prompt |
| `423` | User Locked | Too many failed login attempts — account temporarily locked | Show lockout message; unlock via admin or user action expiry |
| `500` | Server Error | Internal FusionAuth error | Log and retry; report to FusionAuth if persistent |

---

## MFA Login Response Codes (`POST /api/two-factor/login`)

| Code | Meaning |
|------|---------|
| `200` | MFA verified — fully authenticated |
| `400` | Invalid code format |
| `401` | Invalid `twoFactorId` or code expired |
| `404` | User not found |
| `421` | Invalid MFA code — wrong TOTP/email/SMS code |
| `409` | Trust challenge required (for trusted device workflows) |

---

## Passwordless Login Response Codes

### `POST /api/passwordless/start`
| Code | Meaning |
|------|---------|
| `200` | Code generated, `code` in response |
| `400` | Missing `loginId` or `applicationId` |
| `404` | User not found |

### `POST /api/passwordless/login`
| Code | Meaning |
|------|---------|
| `200` | Authenticated |
| `400` | Invalid or expired code |
| `404` | User not found |

---

## Registration API Response Codes (`POST /api/user/registration`)

| Code | Meaning |
|------|---------|
| `200` | User + registration created, no email sent |
| `400` | Validation errors — check `error.fieldErrors` |
| `401` | Invalid API key |
| `404` | User not found (when registering existing user by ID) |
| `409` | User already has a registration for this application |

---

## JWT API Response Codes

### `POST /api/jwt/refresh`
| Code | Meaning |
|------|---------|
| `200` | New `token` issued |
| `400` | Missing refresh token in body or cookie |
| `401` | Refresh token expired, revoked, or invalid |
| `404` | Refresh token not found |

### `GET /api/jwt/validate`
| Code | Meaning |
|------|---------|
| `200` | Token valid; decoded payload in `jwt` field |
| `401` | Token invalid, expired, or missing |

---

## Quick Decision Tree

```
login() response
├── 200  → Store tokens, redirect ✓
├── 202  → Register user to app → store tokens
├── 203  → Redirect to change-password (use changePasswordId)
├── 212  → Show email verification prompt
├── 213  → Show registration verification prompt
├── 242  → Show MFA step (store twoFactorId, expires ~5 min)
├── 404  → Show "Invalid email or password"
├── 423  → Show "Account locked, try again later"
└── 4xx  → Log error, show generic failure message
```
