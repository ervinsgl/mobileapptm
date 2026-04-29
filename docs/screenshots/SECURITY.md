# Security Architecture

> **Status:** Approved deviation from BTP coding guideline (Programmierrichtlinie für SAP-Erweiterungen §10).
> **Last updated:** April 2026
> **Owner:** TUVN
> **Architecture approval:** [Approver name and date — fill in per Programmierrichtlinie §12]

## Purpose of this document

This document describes the inbound authentication and authorization model of the
T&M Journal app, why it differs from the company's standard XSUAA/OAuth2 pattern,
and what the deliberate limitations of the current model are. It is intended for:

- Developers maintaining or extending this app.
- Architects reviewing the app's compliance with internal coding standards.
- Auditors verifying that security trade-offs have been deliberately made and documented.

If you are reading this because you are about to change anything in `index.js` related
to `requireSession`, `optionalSession`, the WebContainer POST handlers, the
`fsm_session` cookie, or the FSM Authentication Key, **read this document first.**

---

## Summary

The app implements a **two-tier inbound authentication model**:

| Path | Tier | Mechanism |
|---|---|---|
| `POST /web-container-access-point` (and `POST /`) | Tier 1 | FSM Authentication Key (shared secret) — required |
| `GET /web-container-context` | Tier 2 | Session cookie — required |
| `/api/v1/*` | Tier 2 | Session cookie — required when present, accepted when absent (Web UI carve-out) |

The app does **not** use SAP XSUAA or IAS for inbound authentication. This is a
deliberate, approved deviation from the Programmierrichtlinie §10 ("Security: XSUAA,
OAuth2"). The reasons are documented below.

The app does use the SAP BTP Destination Service with OAuth2 for **outbound**
authentication to FSM APIs. Outbound credentials are not affected by this model —
they remain compliant with the Programmierrichtlinie.

---

## Architecture context

The T&M Journal app is launched in three different contexts. Understanding which
one is being used is essential for understanding why this security model exists.

### Context 1 — FSM Mobile WebContainer

The app is opened as a WebContainer inside the FSM Mobile native app on a
technician's phone. FSM Mobile sends an HTTP `POST` request to
`/web-container-access-point` with the user's session context (cloudId, userName,
account, company, etc.) and an Authentication Key value configured in FSM Admin.
The app then renders inside the FSM Mobile WebView.

This is the primary, most-used context.

### Context 2 — FSM Web UI Shell extension

The app is opened as an iframe-embedded extension inside the FSM Web UI (the
browser-based FSM workspace). The iframe loads via `GET /` directly. There is no
POST handshake. Context is delivered via the `fsm-shell` SDK, which uses
`postMessage` to communicate with the FSM Web UI host page.

This context is occasionally used.

### Context 3 — Standalone URL

A developer or tester opens the app directly in a browser with URL parameters
(`?activityId=...` or `?serviceCallId=...`). Used for development, debugging,
or specific demo scenarios.

This context is rarely used and is treated as a development-only convenience.

---

## The security challenge

Each context delivers a different signal of "this user is legitimate":

- **Mobile** authenticates the user inside FSM Mobile (the native app handles login,
  TOTP, SAML, etc.). FSM Mobile then sends the session context to your URL via POST.
  By default, that POST has **no authentication** at the HTTP level — anyone who
  knows the URL can send a crafted POST claiming to be any user.
- **Web UI** authenticates the user via the FSM Shell. The `authToken` field in the
  Shell context is a real RS256-signed JWT issued by FSM, but verifying it requires
  fetching FSM's public keys (JWKS), and FSM does not expose a public JWKS endpoint
  at standard discovery paths.
- **Standalone** has no authentication signal at all — it's just URL parameters.

Without an auth model, the `/api/v1/*` endpoints (which include destructive operations
like `batch-delete` and PII-exposing operations like `get-persons`) are reachable by
anyone who knows the URL.

The standard SAP-recommended solution is XSUAA + IAS with federated authentication.
This was evaluated and rejected — see "Why not XSUAA" below.

---

## What is implemented

### Tier 1 — Authentication Key on WebContainer entry POSTs

**Mechanism:** Shared secret between FSM and the app.

**FSM side:** The Authentication Key is configured in FSM Admin →
Companies → [Company] → Web Containers → [Web Container] → Authentication Key.
FSM Mobile reads this value during sync and includes it as the `authenticationKey`
field in the body of every WebContainer POST.

**App side:** The value is stored as the `FSM_WEBCONTAINER_AUTH_KEY` environment
variable in Cloud Foundry (`cf set-env`). The Express server validates the
`authenticationKey` field on every POST to `/web-container-access-point` and
`POST /` using a constant-time comparison (`crypto.timingSafeEqual`) to prevent
timing attacks. Mismatches return HTTP 401 and are logged.

**Threat blocked:** A random attacker who knows the URL cannot inject fake context
into the app's session store. They would need the secret, which is known only to
FSM Mobile clients (transmitted internally during sync).

**Rotation:** Update FSM Admin first, then `cf set-env mobileapptm
FSM_WEBCONTAINER_AUTH_KEY <new>` and `cf restage mobileapptm`. Brief failure
window during which in-flight WebContainer launches return 401; user just retaps
the button.

### Tier 2 — Session cookie on subsequent requests

**Mechanism:** Server-issued opaque session token, set as an HttpOnly cookie.

**Issuance:** When a WebContainer POST passes Tier 1 validation, the server
generates a cryptographically random 32-byte token (`crypto.randomBytes(32)`),
stores it in an in-memory `sessionStore` keyed to the user's context, and sets
it as the `fsm_session` cookie on the redirect response.

**Cookie attributes:** `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`,
`Max-Age=1800` (30 minutes).
- `HttpOnly` — JavaScript cannot read the cookie. Mitigates XSS-based session theft.
- `Secure` — only transmitted over HTTPS. CF enforces HTTPS, so this is satisfied.
- `SameSite=Lax` — sent on the redirect that follows the WebContainer POST, but
  not in arbitrary cross-site contexts. Note: this attribute is the reason the
  cookie does not flow in the FSM Web UI iframe context — see "Web UI carve-out".
- `Max-Age=1800` — session expires after 30 minutes of inactivity. Server-side
  store also has a matching TTL with eviction on every entry POST.

**Validation:** The `requireSession` middleware (used on `/web-container-context`)
reads the cookie, looks up the token in `sessionStore`, and proceeds if found
and non-expired. Missing or invalid cookies return HTTP 401.

**Threat blocked:** A random attacker who knows the URL cannot read another
user's stored context, cannot replay an old contextKey, and cannot impersonate
an active user's Mobile session.

### Cookie scoping for `/api/v1/*` — the lenient carve-out

The `/api/v1/*` routes use `optionalSession` instead of `requireSession`:

- **If a session cookie is present and valid** → request proceeds with the user's
  context attached. (Mobile flow.)
- **If a session cookie is present but invalid or expired** → request is rejected
  with HTTP 401. Forces re-authentication.
- **If no session cookie is present at all** → request proceeds without a context.
  Logged at `console.log` level as `API-UNAUTH:` for monitoring. (Web UI carve-out
  and standalone flow.)

The "no cookie" branch is the deliberate compromise that allows Web UI and
standalone flows to function. See next section for the rationale.

---

## Web UI carve-out — known limitation

### What the carve-out is

The `optionalSession` middleware on `/api/v1/*` permits requests without a session
cookie. This means:

- **Legitimate Web UI iframe traffic works.** The Web UI Shell loads the app via
  GET, never receives a Set-Cookie from the WebContainer POST handler, and makes
  `/api/v1/*` calls without a cookie. With this carve-out, those calls succeed.
- **Anyone with the URL can call `/api/v1/*` directly without a cookie.** A `curl`
  command targeting any endpoint will succeed, just like it did before any auth
  model was implemented.

### Why we accept this

Three reasons, in order of weight:

1. **Equivalence to the prior state.** Before any auth was implemented, all
   `/api/v1/*` calls were reachable by anyone with the URL. The carve-out preserves
   that exact behavior for Web UI users while adding strict auth for Mobile users.
   We did not regress; we improved Mobile.
2. **Web UI usage is low and known.** The Web UI flow is occasionally used,
   primarily by office-based supervisors. The realistic threat — a random
   internet scanner — is partially mitigated because outbound FSM API calls
   require valid FSM destination credentials that the attacker also needs the
   FSM data context for. The blast radius is bounded.
3. **The "right" fix (FSM JWT validation) is blocked on external dependencies.**
   See "Future work — Option B" below.

### What this carve-out does NOT excuse

This carve-out is bounded to `/api/v1/*` only. The following endpoints remain
strictly authenticated and **MUST NOT** be relaxed:

- `POST /web-container-access-point` — requires Authentication Key (Tier 1).
- `POST /` — requires Authentication Key (Tier 1).
- `GET /web-container-context` — requires session cookie (Tier 2 strict).

### Monitoring the carve-out

Every unauthenticated call to `/api/v1/*` is logged with the `API-UNAUTH:` prefix.
Review CF logs periodically:

```bash
cf logs mobileapptm --recent | grep "API-UNAUTH:"
```

Two reasons to act on what you see:

- **Volume far higher than known Web UI usage** — possible signal of attacker
  scanning. Investigate User-Agent strings and IPs in the log lines.
- **Unusual endpoints being called without a cookie** — for example, a flood of
  `batch-delete` calls without cookies could indicate abuse.

Neither has been observed to date, but the logging exists so the data is there
when needed.

---

## Why not XSUAA / IAS / Federated Authentication

This was the first option evaluated. It was rejected for the following reasons:

1. **FSM Mobile WebContainer flow is not compatible with browser-based login redirects.**
   XSUAA's authentication model relies on redirecting the user agent to an IAS
   login page, completing a SAML/OIDC flow, and redirecting back. The FSM Mobile
   WebView does not handle this cleanly — login state established inside the
   WebView often does not persist across WebContainer launches, and FSM Mobile
   does not pass any IAS-recognized authentication context into the WebView.
2. **Documented industry experience.** SAP community posts (e.g.,
   *"Developing a SAP FSM extension on SAP BTP CF using Federated Authentication"*)
   describe XSUAA-protected extensions failing during installation in FSM
   Extension Management. The clean integration path is XSUAA+IAS for FSM Web UI
   only, with a separate auth path for FSM Mobile WebContainer. Maintaining two
   parallel authentication systems is more complex than the current model.
3. **The cost-to-benefit ratio is poor for this app's threat model.** Implementing
   full XSUAA+IAS+approuter would take an estimated 2-3 days of work, plus
   coordination with the BTP admin and IAS tenant configuration. The benefit
   over the current Authentication Key + cookie model, given Web UI's low usage,
   does not justify that investment at this time.

This decision should be revisited if any of the following change:

- FSM Web UI usage grows substantially.
- A compliance or audit requirement specifically demands XSUAA on inbound paths.
- FSM Mobile changes its WebContainer auth model in a way that aligns with XSUAA.

---

## Future work — Option B (FSM JWT validation)

The Shell SDK provides a real RS256-signed JWT (`authToken`) in the Shell context.
A future improvement is to validate this JWT on every `/api/v1/*` call from the
Web UI flow, eliminating the carve-out.

### What's blocking it

FSM does not expose a public JWKS endpoint at standard discovery paths
(`.well-known/openid-configuration`, `.well-known/jwks.json`, etc., all return
307 redirects to the Shell login page or 404). Without the JWKS URL, JWT signature
verification is impossible.

The path forward is one of:

- Open an SAP support ticket (component `CEC-SRV-FSM`) requesting the public
  JWKS endpoint URL for `cloud-authentication-service-de`.
- Use FSM's token introspection endpoint instead of local JWKS verification
  (slower, creates runtime dependency on FSM availability).
- Implement full XSUAA+IAS+federated auth (see "Why not XSUAA" above for cost).

### Estimated effort once JWKS is known

~2-3 hours, contained to:

- One new backend file (`utils/FSMJwtValidator.js`)
- One new endpoint (`POST /api/v1/shell-session-init`)
- One new env var (`FSM_JWKS_URL`)
- Two new npm dependencies (`jsonwebtoken`, `jwks-rsa`)
- One frontend modification in `webapp/utils/services/ContextService.js` to call
  the new endpoint after Shell context is detected
- Cookie attribute change from `SameSite=Lax` to `SameSite=None; Secure` (required
  for cross-site iframe; harmless for Mobile)

---

## Operational notes

### Required environment variables

| Variable | Required | Purpose |
|---|---|---|
| `FSM_WEBCONTAINER_AUTH_KEY` | Yes — server refuses to start without it | Shared secret matching the FSM Web Container Authentication Key. Set via `cf set-env` and `cf restage`. |

### Required FSM configuration

| Setting | Where | Value |
|---|---|---|
| Authentication Key | FSM Admin → Companies → [Company] → Web Containers → [TUVNMobileAppTMJournal] | Must byte-exactly match `FSM_WEBCONTAINER_AUTH_KEY` env var |

### In-memory state

- `contextStore` — Map from contextKey (`<userName>_<cloudId>`) to FSM context.
  TTL 30 minutes. In-memory only; not persisted.
- `sessionStore` — Map from session token to contextKey + expiration timestamp.
  TTL 30 minutes. In-memory only; not persisted.

Both stores are reset on container restart. Active sessions become invalid
on restart, and users must re-launch the app from FSM Mobile. This is acceptable
for a single-instance deployment; would need to be migrated to Redis or similar
for horizontal scaling. See `manifest.yaml` (currently `instances: 1`).

### Log signals

| Log prefix | Meaning |
|---|---|
| `WC-ACCESS-POINT: context stored, session issued` | Successful Mobile entry |
| `WC-ACCESS-POINT: rejected POST — authenticationKey ...` | Mobile entry with bad/missing auth key — investigate if frequent |
| `AUTH: rejected ... missing-cookie` | Strict-auth endpoint hit without cookie — Web UI client trying to use a Mobile-only endpoint |
| `AUTH: rejected ... invalid-or-expired` | Cookie tampered or expired — typically benign (user idle past TTL) |
| `API-UNAUTH:` | `/api/v1/*` called without a cookie — Web UI traffic; monitor for unusual volume |

---

## Compliance reference (Programmierrichtlinie)

- **§7 (API Versioning):** Compliant. All routes mounted at `/api/v1`. Future
  breaking changes will use `/api/v2` alongside, never replacing v1.
- **§10 (Security):** Deliberate deviation. The guideline specifies "XSUAA, OAuth2"
  for inbound auth. This app uses Authentication Key + session cookie for the
  reasons documented in "Why not XSUAA" above. This deviation has been approved
  per §12 ("Abweichungen nur mit Architekturfreigabe") on **[date]** by **[approver]**.
- **§10 (Secrets):** Compliant. No secrets are hardcoded. Authentication Key is
  read from environment variable. Outbound FSM credentials come from the BTP
  Destination Service binding.

---

## When to revisit this document

Update this document whenever any of the following change:

- The auth mechanism on any endpoint (e.g., adding XSUAA, removing the Web UI
  carve-out, implementing Option B).
- The cookie attributes (e.g., changing `SameSite`, the TTL, or the cookie name).
- The `FSM_WEBCONTAINER_AUTH_KEY` rotation procedure.
- A new context (beyond Mobile / Web UI / Standalone) is added to the app.
- The session storage is moved from in-memory to Redis or similar.
- A security incident affects this app.

The "Last updated" line at the top of this document MUST be kept current.