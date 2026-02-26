# FusionAuth API Cheatsheet

Quick reference for all major endpoints. Base URL: `https://your-instance.fusionauth.io`

All requests require `Authorization: <API_KEY>` header.
Multi-tenant deployments also require `X-FusionAuth-TenantId: <tenantId>`.

---

## Client Initialization

```ts
import { FusionAuthClient } from '@fusionauth/typescript-client'

const client = new FusionAuthClient(
  process.env.FUSIONAUTH_API_KEY!,
  process.env.FUSIONAUTH_URL!,
  process.env.FUSIONAUTH_TENANT_ID   // optional, required for multi-tenant
)
```

---

## Authentication

| Method | Endpoint | SDK Method | Description |
|--------|----------|-----------|-------------|
| POST | `/api/login` | `login(request)` | Standard credential login |
| POST | `/api/two-factor/login` | `twoFactorLogin(request)` | Complete MFA step |
| POST | `/api/passwordless/start` | `startPasswordlessLogin(request)` | Generate passwordless code |
| POST | `/api/passwordless/send` | `sendPasswordlessCode(request)` | Send code via email/SMS |
| POST | `/api/passwordless/login` | `passwordlessLogin(request)` | Complete passwordless login |
| POST | `/api/logout` | `logout(global, refreshToken)` | Log out / revoke session |

---

## WebAuthn / Passkeys

| Method | Endpoint | SDK Method | Description |
|--------|----------|-----------|-------------|
| POST | `/api/webauthn/register/start` | `startWebAuthnRegistration(userId, request)` | Begin passkey registration |
| POST | `/api/webauthn/register/complete` | `completeWebAuthnRegistration(request)` | Finalize passkey registration |
| POST | `/api/webauthn/assert/start` | `startWebAuthnLogin(request)` | Begin passkey authentication |
| POST | `/api/webauthn/assert/complete` | `completeWebAuthnLogin(request)` | Finalize passkey authentication |
| GET | `/api/webauthn/{id}` | `retrieveWebAuthnCredential(id)` | Retrieve a passkey |
| GET | `/api/webauthn?userId={id}` | `retrieveWebAuthnCredentialsForUser(userId)` | List user passkeys |
| DELETE | `/api/webauthn/{id}` | `deleteWebAuthnCredential(id)` | Remove a passkey |

---

## Users

| Method | Endpoint | SDK Method | Description |
|--------|----------|-----------|-------------|
| POST | `/api/user` | `createUser(userId?, request)` | Create user (no registration) |
| GET | `/api/user/{userId}` | `retrieveUser(userId)` | Retrieve by UUID |
| GET | `/api/user?email={email}` | `retrieveUserByEmail(email)` | Retrieve by email |
| GET | `/api/user?loginId={loginId}` | `retrieveUserByLoginId(loginId)` | Retrieve by login ID |
| GET | `/api/user?username={username}` | `retrieveUserByUsername(username)` | Retrieve by username |
| PUT | `/api/user/{userId}` | `updateUser(userId, request)` | Full replacement |
| PATCH | `/api/user/{userId}` | `patchUser(userId, request)` | Partial update (JSON Merge Patch) |
| DELETE | `/api/user/{userId}` | `deleteUser(userId)` | Deactivate or hard delete |
| POST | `/api/user/search` | `searchUsersByQuery(request)` | Elasticsearch-powered search |
| PUT | `/api/user/{userId}/action` | `actionOnUser(userId, request)` | Apply user action (lock, etc.) |
| POST | `/api/user/change-password/{changePasswordId}` | `changePassword(changePasswordId, request)` | Set new password via workflow |
| PUT | `/api/user/{userId}/change-password` | `changePasswordByIdentity(request)` | Admin: change user password |
| PUT | `/api/user/verify-email` | `verifyUserRegistration(verificationId)` | Verify email address |
| PUT | `/api/user/send-forgot-password` | `forgotPassword(request)` | Send forgot-password email |

---

## Registrations

| Method | Endpoint | SDK Method | Description |
|--------|----------|-----------|-------------|
| POST | `/api/user/registration` | `register(userId?, request)` | Create user + registration |
| GET | `/api/user/registration/{userId}/{appId}` | `retrieveRegistration(userId, appId)` | Retrieve registration |
| PUT | `/api/user/registration/{userId}/{appId}` | `updateRegistration(userId, request)` | Full replacement |
| PATCH | `/api/user/registration/{userId}/{appId}` | `patchRegistration(userId, request)` | Partial update |
| DELETE | `/api/user/registration/{userId}/{appId}` | `deleteRegistration(userId, appId)` | Remove registration |
| PUT | `/api/user/verify-registration` | `verifyUserRegistration(verificationId)` | Verify registration |

---

## Multi-Factor Authentication

| Method | Endpoint | SDK Method | Description |
|--------|----------|-----------|-------------|
| GET | `/api/two-factor/secret` | `generateTwoFactorSecret()` | Generate TOTP secret |
| POST | `/api/user/two-factor/{userId}` | `enableTwoFactor(userId, request)` | Enable MFA method |
| DELETE | `/api/user/two-factor/{userId}` | `disableTwoFactor(userId, code, method)` | Disable MFA method |
| POST | `/api/two-factor/send` | `sendTwoFactorCode(request)` | Resend MFA code |
| POST | `/api/two-factor/recovery-code/{userId}` | `generateTwoFactorRecoveryCodes(userId)` | Regenerate recovery codes |
| GET | `/api/two-factor/recovery-code/{userId}` | `retrieveTwoFactorRecoveryCodes(userId)` | Retrieve recovery codes |

---

## JWT & Tokens

| Method | Endpoint | SDK Method | Description |
|--------|----------|-----------|-------------|
| POST | `/api/jwt/refresh` | `exchangeRefreshTokenForAccessToken(token)` | Refresh access token |
| GET | `/api/jwt/validate` | `validateJWT(jwt)` | Validate access token |
| GET | `/api/jwt/issue` | `issueJWT(appId, refreshToken)` | Issue JWT for SSO |
| POST | `/api/jwt/vend` | `vendJWT(request)` | Issue custom JWT with claims |
| GET | `/api/jwt/public-key` | `retrieveJwtPublicKeys()` | Get public keys for local verification |
| GET | `/api/jwt/refresh/{tokenId}` | `retrieveRefreshTokenById(tokenId)` | Get single refresh token details |
| GET | `/api/jwt/refresh?userId={id}` | `retrieveRefreshTokens(userId)` | Get all user refresh tokens |
| DELETE | `/api/jwt/refresh/{tokenId}` | `revokeRefreshTokenById(tokenId)` | Revoke single token by ID |
| DELETE | `/api/jwt/refresh?token={token}` | `revokeRefreshTokenByToken(token)` | Revoke single token by value |
| DELETE | `/api/jwt/refresh?userId={id}` | `revokeRefreshTokensByUserId(userId)` | Revoke all user tokens |
| DELETE | `/api/jwt/refresh?applicationId={id}` | `revokeRefreshTokensByApplicationId(appId)` | Revoke all tokens for an app |

---

## Applications

| Method | Endpoint | SDK Method | Description |
|--------|----------|-----------|-------------|
| POST | `/api/application` | `createApplication(appId?, request)` | Create application |
| GET | `/api/application/{appId}` | `retrieveApplication(appId)` | Retrieve application |
| GET | `/api/application` | `retrieveApplications()` | List all applications |
| PUT | `/api/application/{appId}` | `updateApplication(appId, request)` | Update application |
| DELETE | `/api/application/{appId}` | `deleteApplication(appId)` | Delete application |
| POST | `/api/application/{appId}/role` | `createApplicationRole(appId, roleId?, request)` | Create role |
| DELETE | `/api/application/{appId}/role/{roleId}` | `deleteApplicationRole(appId, roleId)` | Delete role |

---

## Tenants

| Method | Endpoint | SDK Method | Description |
|--------|----------|-----------|-------------|
| POST | `/api/tenant` | `createTenant(tenantId?, request)` | Create tenant |
| GET | `/api/tenant/{tenantId}` | `retrieveTenant(tenantId)` | Retrieve tenant |
| GET | `/api/tenant` | `retrieveTenants()` | List all tenants |
| PUT | `/api/tenant/{tenantId}` | `updateTenant(tenantId, request)` | Update tenant |
| DELETE | `/api/tenant/{tenantId}` | `deleteTenant(tenantId)` | Delete tenant |

---

## Identity Providers

| Method | Endpoint | SDK Method | Description |
|--------|----------|-----------|-------------|
| POST | `/api/identity-provider` | `createIdentityProvider(idpId?, request)` | Create identity provider |
| GET | `/api/identity-provider/{idpId}` | `retrieveIdentityProvider(idpId)` | Retrieve IDP |
| GET | `/api/identity-provider` | `retrieveIdentityProviders()` | List all IDPs |
| PUT | `/api/identity-provider/{idpId}` | `updateIdentityProvider(idpId, request)` | Update IDP |
| DELETE | `/api/identity-provider/{idpId}` | `deleteIdentityProvider(idpId)` | Delete IDP |
| POST | `/api/identity-provider/login` | `identityProviderLogin(request)` | Login via external IDP token |
| GET | `/api/identity-provider/link?userId={id}` | `retrieveUserLink(idpId, idpUserId, userId)` | Get IDP link for user |
| POST | `/api/identity-provider/link` | `linkUserByVerificationCode(request)` | Link account to IDP |
| DELETE | `/api/identity-provider/link` | `deleteUserLink(idpId, idpUserId, userId)` | Unlink IDP account |

---

## Groups

| Method | Endpoint | SDK Method | Description |
|--------|----------|-----------|-------------|
| POST | `/api/group` | `createGroup(groupId?, request)` | Create group |
| GET | `/api/group/{groupId}` | `retrieveGroup(groupId)` | Retrieve group |
| PUT | `/api/group/{groupId}` | `updateGroup(groupId, request)` | Update group |
| DELETE | `/api/group/{groupId}` | `deleteGroup(groupId)` | Delete group |
| POST | `/api/group/member` | `createGroupMembers(request)` | Add members to group |
| DELETE | `/api/group/member?groupId={id}&userId={id}` | `deleteGroupMembers(request)` | Remove members |

---

## Webhooks

| Method | Endpoint | SDK Method | Description |
|--------|----------|-----------|-------------|
| POST | `/api/webhook` | `createWebhook(webhookId?, request)` | Create webhook |
| GET | `/api/webhook/{webhookId}` | `retrieveWebhook(webhookId)` | Retrieve webhook |
| GET | `/api/webhook` | `retrieveWebhooks()` | List all webhooks |
| PUT | `/api/webhook/{webhookId}` | `updateWebhook(webhookId, request)` | Update webhook |
| DELETE | `/api/webhook/{webhookId}` | `deleteWebhook(webhookId)` | Delete webhook |

---

## Email & Messaging

| Method | Endpoint | SDK Method | Description |
|--------|----------|-----------|-------------|
| POST | `/api/email/send` | `sendEmail(templateId, request)` | Send templated email |
| GET | `/api/email/template/{id}` | `retrieveEmailTemplate(id)` | Retrieve email template |
| PUT | `/api/email/template/{id}` | `updateEmailTemplate(id, request)` | Update email template |

---

## API Keys

| Method | Endpoint | SDK Method | Description |
|--------|----------|-----------|-------------|
| POST | `/api/api-key` | `createAPIKey(keyId?, request)` | Create API key |
| GET | `/api/api-key/{keyId}` | `retrieveAPIKey(keyId)` | Retrieve API key |
| PUT | `/api/api-key/{keyId}` | `updateAPIKey(keyId, request)` | Update API key |
| DELETE | `/api/api-key/{keyId}` | `deleteAPIKey(keyId)` | Delete API key |

---

## Audit & Event Logs

| Method | Endpoint | SDK Method | Description |
|--------|----------|-----------|-------------|
| GET | `/api/audit-log/{logId}` | `retrieveAuditLog(logId)` | Retrieve single audit log |
| POST | `/api/audit-log/search` | `searchAuditLogs(request)` | Search audit logs |
| GET | `/api/event-log/{logId}` | `retrieveEventLog(logId)` | Retrieve event log entry |
| POST | `/api/event-log/search` | `searchEventLogs(request)` | Search event logs |

---

## System

| Method | Endpoint | SDK Method | Description |
|--------|----------|-----------|-------------|
| GET | `/api/system-configuration` | `retrieveSystemConfiguration()` | Retrieve system config |
| PUT | `/api/system-configuration` | `updateSystemConfiguration(request)` | Update system config |
| GET | `/api/status` | `retrieveSystemStatus()` | Health check |
| GET | `/api/tenant/oauth-configuration/{appId}` | `retrieveTenantOAuthConfiguration(appId)` | OAuth config for tenant |
