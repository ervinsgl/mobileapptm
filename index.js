/**
 * index.js - Backend Server
 * 
 * Express.js server for the Service Confirmation application.
 * Handles FSM Mobile web container integration, serves the UI5 frontend,
 * and mounts API route modules.
 * 
 * Security model — TWO-TIER, by design:
 * 
 * 1. FSM Mobile WebContainer path: FULLY AUTHENTICATED.
 *    - POST /web-container-access-point requires a valid Authentication Key
 *      (shared secret with FSM Admin > Web Containers).
 *    - On success, an HttpOnly session cookie is issued.
 *    - All /api/* calls from the Mobile WebView carry this cookie.
 * 
 * 2. FSM Web UI (Shell extension) path: UNAUTHENTICATED, by deliberate carve-out.
 *    - The Shell iframe loads via GET — no POST handler runs, no cookie issued.
 *    - /api/* calls from the iframe arrive without a session cookie.
 *    - We accept them anyway. This matches the pre-cookie-auth behavior and
 *      is documented as a known limitation (see docs/SECURITY.md).
 *    - TODO: replace with proper FSM JWT validation when Web UI usage grows.
 *      The Shell SDK provides an `authToken` JWT that can be verified against
 *      FSM's JWKS endpoint. Estimated effort: 2-3 hours. Tracked as Option B.
 * 
 * Required Environment Variables:
 * - FSM_WEBCONTAINER_AUTH_KEY - Shared secret matching the Authentication Key
 *   value configured in FSM Admin > Companies > [Company] > Web Containers.
 *   The server refuses to start if this is unset.
 * 
 * @file index.js
 * @requires express
 * @requires cookie-parser
 * @requires ./routes/activityRoutes
 * @requires ./routes/entryRoutes
 * @requires ./routes/lookupRoutes
 * @requires ./routes/configRoutes
 */

const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const crypto = require('crypto');

const app = express();

// ===========================
// AUTHENTICATION KEY (SHARED SECRET WITH FSM)
// ===========================
// Must match the value configured in FSM Admin > Web Containers >
// Authentication Key. FSM Mobile sends this in the POST body as
// `authenticationKey` when launching the web container.

const FSM_WEBCONTAINER_AUTH_KEY = process.env.FSM_WEBCONTAINER_AUTH_KEY;

if (!FSM_WEBCONTAINER_AUTH_KEY) {
    console.error('FATAL: FSM_WEBCONTAINER_AUTH_KEY environment variable is not set.');
    console.error('       Set it via: cf set-env mobileapptm FSM_WEBCONTAINER_AUTH_KEY <value>');
    console.error('       Then restage: cf restage mobileapptm');
    console.error('       Value must match FSM Admin > Web Containers > Authentication Key.');
    process.exit(1);
}

if (FSM_WEBCONTAINER_AUTH_KEY.length < 16) {
    console.warn('WARNING: FSM_WEBCONTAINER_AUTH_KEY is shorter than 16 characters.');
    console.warn('         Recommended: 32+ chars from `openssl rand -base64 32`.');
}

/**
 * Validate the Authentication Key shared secret from a WebContainer POST.
 * Uses constant-time comparison to avoid timing-based secret discovery.
 */
function isAuthKeyValid(body) {
    const provided = body && body.authenticationKey;
    if (typeof provided !== 'string' || provided.length === 0) {
        return false;
    }

    const providedBuf = Buffer.from(provided, 'utf8');
    const expectedBuf = Buffer.from(FSM_WEBCONTAINER_AUTH_KEY, 'utf8');
    if (providedBuf.length !== expectedBuf.length) {
        return false;
    }

    return crypto.timingSafeEqual(providedBuf, expectedBuf);
}

// ===========================
// SESSION & CONTEXT STORES
// ===========================

const SESSION_TTL_MS = 30 * 60 * 1000;
const CONTEXT_TTL_MS = 30 * 60 * 1000;

const contextStore = new Map();
const sessionStore = new Map();

const SESSION_COOKIE_NAME = 'fsm_session';

function buildContextKey(body) {
    const userName = (body.userName || 'anonymous').replace(/[^a-zA-Z0-9_-]/g, '_');
    const cloudId  = (body.cloudId  || 'unknown'  ).replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${userName}_${cloudId}`;
}

function generateSessionToken() {
    return crypto.randomBytes(32).toString('base64url');
}

function evictExpired() {
    const now = Date.now();
    for (const [key, entry] of contextStore.entries()) {
        if (now - entry.timestamp > CONTEXT_TTL_MS) {
            contextStore.delete(key);
        }
    }
    for (const [token, entry] of sessionStore.entries()) {
        if (now > entry.expiresAt) {
            sessionStore.delete(token);
        }
    }
}

function resolveSession(token) {
    if (!token || typeof token !== 'string') return null;
    const entry = sessionStore.get(token);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        sessionStore.delete(token);
        return null;
    }
    return entry.contextKey;
}

/**
 * STRICT middleware: require a valid session cookie. Used for
 * /web-container-context where cookie presence is guaranteed by the
 * Mobile flow (the only flow that uses this endpoint).
 * 
 * Returns 401 if no cookie or invalid cookie.
 */
function requireSession(req, res, next) {
    const token = req.cookies && req.cookies[SESSION_COOKIE_NAME];
    const contextKey = resolveSession(token);

    if (!contextKey) {
        const reason = !token ? 'missing-cookie' : 'invalid-or-expired';
        console.warn(`AUTH: rejected ${req.method} ${req.originalUrl} — session ${reason} ` +
                     `(remoteIp=${req.ip})`);
        return res.status(401).json({
            message: 'Unauthorized: missing or expired session.',
            hint: 'This endpoint requires a valid session cookie issued via FSM Mobile WebContainer.'
        });
    }

    req.fsmContextKey = contextKey;
    next();
}

/**
 * LENIENT middleware: validate session cookie if present, but allow the
 * request through if absent. Used for /api/* to support both flows:
 *   - Mobile WebContainer: cookie present → validated, contextKey attached.
 *   - Web UI Shell iframe: no cookie → request passes unauthenticated.
 * 
 * SECURITY NOTE: This is the deliberate Web UI carve-out. Any caller can
 * reach /api/* without a cookie — we cannot distinguish "Shell iframe" from
 * "attacker with curl." This matches pre-cookie-auth behavior and is the
 * agreed trade-off until Option B (FSM JWT validation) is implemented.
 * 
 * Unauthenticated requests are LOGGED so we have visibility into how often
 * the carve-out is exercised. If the log is loud, that's signal to invest
 * in Option B sooner.
 */
function optionalSession(req, res, next) {
    const token = req.cookies && req.cookies[SESSION_COOKIE_NAME];

    if (!token) {
        // No cookie → unauthenticated (Web UI iframe path or anonymous caller).
        // Log for visibility; do NOT reject.
        console.log(`API-UNAUTH: ${req.method} ${req.originalUrl} ` +
                    `(no cookie, remoteIp=${req.ip}, ua=${req.get('user-agent')?.slice(0, 60) || 'unknown'})`);
        req.fsmContextKey = null;
        return next();
    }

    // Cookie present → must be valid, otherwise reject.
    // (A bad cookie is not the same as no cookie — bad means tampered or expired,
    //  which is a different failure mode than "Web UI never had one.")
    const contextKey = resolveSession(token);
    if (!contextKey) {
        console.warn(`API-AUTH: rejected ${req.method} ${req.originalUrl} — invalid-or-expired cookie ` +
                     `(remoteIp=${req.ip})`);
        return res.status(401).json({
            message: 'Unauthorized: invalid or expired session.',
            hint: 'Your session has expired. Please re-open the app from FSM Mobile or refresh the FSM Web UI.'
        });
    }

    req.fsmContextKey = contextKey;
    next();
}

// ===========================
// MIDDLEWARE
// ===========================
app.use((req, res, next) => {
    res.removeHeader('X-Frame-Options');
    next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.enable('trust proxy');

// ===========================
// FSM WEB CONTAINER ENTRY POINTS
// ===========================
// Used by FSM Mobile only. Web UI does NOT hit these — it loads via GET
// directly from the iframe. The auth-key check enforced here is the
// security boundary for the Mobile flow.

function handleWebContainerPost(req, res, label) {
    const body = req.body || {};

    if (!isAuthKeyValid(body)) {
        const provided = body && body.authenticationKey;
        const reason = !provided
            ? 'missing'
            : (typeof provided !== 'string' ? 'wrong-type' : 'mismatch');
        console.warn(`${label}: rejected POST — authenticationKey ${reason} ` +
                     `(remoteIp=${req.ip}, userName=${body.userName || 'unknown'})`);
        return res.status(401).json({
            message: 'Unauthorized: invalid or missing authentication key.',
            hint: 'This endpoint can only be reached from FSM Mobile.'
        });
    }

    evictExpired();

    const { authenticationKey, ...storableBody } = body;
    const contextKey = buildContextKey(storableBody);
    contextStore.set(contextKey, { data: storableBody, timestamp: Date.now() });

    const sessionToken = generateSessionToken();
    sessionStore.set(sessionToken, {
        contextKey: contextKey,
        expiresAt: Date.now() + SESSION_TTL_MS
    });

    console.log(`${label}: context stored, session issued ` +
                `(contextKey=${contextKey}, contextStoreSize=${contextStore.size}, ` +
                `sessionStoreSize=${sessionStore.size})`);

    res.cookie(SESSION_COOKIE_NAME, sessionToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: SESSION_TTL_MS
    });

    const redirectUrl = `${req.protocol}://${req.get('host')}/?contextKey=${encodeURIComponent(contextKey)}`;
    res.redirect(redirectUrl);
}

app.post("/web-container-access-point", (req, res) => {
    handleWebContainerPost(req, res, 'WC-ACCESS-POINT');
});

app.post("/", (req, res) => {
    handleWebContainerPost(req, res, 'WC-ROOT');
});

// ===========================
// PROTECTED CONTEXT ENDPOINT (Mobile-only)
// ===========================
// /web-container-context is read by ContextService.js when
// _getMobileContext() runs — only invoked when the app loaded from a
// WebContainer redirect. Web UI uses the Shell SDK and never hits this.
// Therefore: full session enforcement is appropriate here; no carve-out.

app.get("/web-container-context", requireSession, (req, res) => {
    const key = req.query.key;

    if (!key) {
        return res.status(400).json({
            message: 'Missing context key.',
            hint: 'Pass ?key=<contextKey> — value comes from the contextKey URL param after redirect.'
        });
    }

    if (key !== req.fsmContextKey) {
        console.warn(`CONTEXT-FETCH: session ${req.fsmContextKey} attempted to read ${key}`);
        return res.status(403).json({
            message: 'Forbidden: session does not own this context.',
        });
    }

    const entry = contextStore.get(key);

    if (!entry) {
        return res.status(404).json({
            message: 'Context not found or expired.',
            hint: 'Open this app from FSM Mobile web container, not directly in browser.'
        });
    }

    return res.json(entry.data);
});

// ===========================
// STATIC FILES (UI5 FRONTEND)
// ===========================

app.use(express.static(path.join(__dirname, 'webapp')));

// ===========================
// API ROUTES — LENIENT AUTH (Mobile + Web UI carve-out)
// ===========================
// /api/* uses optionalSession instead of requireSession to permit
// the Web UI Shell iframe flow, which never receives a session cookie.
// See SECURITY NOTE on optionalSession above.

app.use('/api', optionalSession);

app.use('/api', require('./routes/activityRoutes'));
app.use('/api', require('./routes/entryRoutes'));
app.use('/api', require('./routes/lookupRoutes'));
app.use('/api', require('./routes/configRoutes'));

// ===========================
// START SERVER
// ===========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`FSM_WEBCONTAINER_AUTH_KEY is set (${FSM_WEBCONTAINER_AUTH_KEY.length} chars)`);
    console.log(`Session TTL: ${SESSION_TTL_MS / 60000} minutes`);
    console.log(`/api/* uses lenient auth — Web UI carve-out is ACTIVE.`);
});