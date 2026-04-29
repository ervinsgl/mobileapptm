/**
 * index.js - Backend Server
 * 
 * Express.js server for the Service Confirmation application.
 * Handles FSM Mobile web container integration, serves the UI5 frontend,
 * and mounts API route modules.
 * 
 * Security model (two layers):
 * 1. Authentication Key (shared secret with FSM) — validates that incoming
 *    WebContainer POSTs come from a legitimate FSM Mobile client.
 * 2. Session Cookie (per-session opaque token) — issued after successful
 *    auth-key validation, required on all /api/* and /web-container-context
 *    calls. Prevents anyone-with-the-URL from calling the API directly.
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
//
// Fail fast at startup if not configured — running without the secret
// would silently leave the entry point unauthenticated.

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
// Two parallel maps with the same TTL:
//   - contextStore: keyed by "userName_cloudId", holds FSM context data.
//   - sessionStore: keyed by random session token, points to a contextKey.
// 
// The session token is what the browser holds in its HttpOnly cookie.
// It's an opaque random string with no information; lookup happens server-side.

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const CONTEXT_TTL_MS = 30 * 60 * 1000; // 30 minutes — matches session TTL

const contextStore = new Map();
const sessionStore = new Map();

const SESSION_COOKIE_NAME = 'fsm_session';

/**
 * Build a unique context key from POST body.
 */
function buildContextKey(body) {
    const userName = (body.userName || 'anonymous').replace(/[^a-zA-Z0-9_-]/g, '_');
    const cloudId  = (body.cloudId  || 'unknown'  ).replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${userName}_${cloudId}`;
}

/**
 * Generate a fresh random session token.
 * 32 random bytes encoded as base64url → 43-character opaque string.
 */
function generateSessionToken() {
    return crypto.randomBytes(32).toString('base64url');
}

/**
 * Remove expired entries from both stores.
 * Called on every WebContainer POST and during session validation.
 */
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

/**
 * Look up a session token and return the associated context key.
 * Returns null if missing, expired, or unknown.
 */
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
 * Express middleware: require a valid session cookie.
 * Used for /api/* and /web-container-context.
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

    // Attach contextKey to request for downstream handlers if they want it
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
// FSM Mobile sends POST request with context when opening web container.
// iOS: Content-Type: application/json
// Android: Content-Type: application/x-www-form-urlencoded
// Configure this URL in FSM Admin > Web Containers.

/**
 * Shared handler for both POST entry points.
 * Validates auth key → stores context → issues session cookie → redirects.
 */
function handleWebContainerPost(req, res, label) {
    const body = req.body || {};

    // STEP 1: Validate the Authentication Key shared secret.
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

    // STEP 2: Auth passed. Clean up stale entries before storing new ones.
    evictExpired();

    // STEP 3: Strip the secret out of the data we keep.
    const { authenticationKey, ...storableBody } = body;

    // STEP 4: Store context.
    const contextKey = buildContextKey(storableBody);
    contextStore.set(contextKey, { data: storableBody, timestamp: Date.now() });

    // STEP 5: Generate session token, store mapping.
    const sessionToken = generateSessionToken();
    sessionStore.set(sessionToken, {
        contextKey: contextKey,
        expiresAt: Date.now() + SESSION_TTL_MS
    });

    console.log(`${label}: context stored, session issued ` +
                `(contextKey=${contextKey}, contextStoreSize=${contextStore.size}, ` +
                `sessionStoreSize=${sessionStore.size})`);

    // STEP 6: Set session cookie + redirect.
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
// PROTECTED CONTEXT ENDPOINT
// ===========================
// Frontend calls this to retrieve its stored FSM context after redirect.
// Now requires the session cookie — closes the previous "guess the contextKey"
// side-channel.

app.get("/web-container-context", requireSession, (req, res) => {
    const key = req.query.key;

    if (!key) {
        return res.status(400).json({
            message: 'Missing context key.',
            hint: 'Pass ?key=<contextKey> — value comes from the contextKey URL param after redirect.'
        });
    }

    // Belt-and-suspenders: only allow reading the context tied to THIS session.
    // Without this check, an authenticated user could read another user's context
    // by passing a different contextKey.
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
// Served BEFORE the protected /api/* mount, so the UI itself loads
// without authentication. The UI then gets its session from the cookie
// already set by the WebContainer POST.

app.use(express.static(path.join(__dirname, 'webapp')));

// ===========================
// PROTECTED API ROUTES
// ===========================
// All /api/* endpoints require a valid session cookie.
// The cookie is set automatically by the WebContainer POST handler;
// browsers attach it to subsequent same-origin requests with no
// frontend code changes required (after the global fetch wrapper
// in webapp/Component.js — which is needed because UI5's fetch
// defaults to omit cookies on some platforms).

app.use('/api', requireSession);

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
});