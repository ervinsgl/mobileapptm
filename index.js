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
 *    - All /api/v1/* calls from the Mobile WebView carry this cookie.
 * 
 * 2. FSM Web UI (Shell extension) path: UNAUTHENTICATED, by deliberate carve-out.
 *    - The Shell iframe loads via GET — no POST handler runs, no cookie issued.
 *    - /api/v1/* calls from the iframe arrive without a session cookie.
 *    - We accept them anyway. This matches the pre-cookie-auth behavior and
 *      is documented as a known limitation (see docs/SECURITY.md).
 *    - TODO: replace with proper FSM JWT validation when Web UI usage grows.
 * 
 * API VERSIONING:
 * All API routes are mounted under /api/v1/* per the company's BTP coding
 * guideline (Programmierrichtlinie §7). When breaking changes are required
 * in the future, mount /api/v2 alongside /api/v1 — do NOT modify v1 in place.
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

function optionalSession(req, res, next) {
    const token = req.cookies && req.cookies[SESSION_COOKIE_NAME];

    if (!token) {
        console.log(`API-UNAUTH: ${req.method} ${req.originalUrl} ` +
                    `(no cookie, remoteIp=${req.ip}, ua=${req.get('user-agent')?.slice(0, 60) || 'unknown'})`);
        req.fsmContextKey = null;
        return next();
    }

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
// API ROUTES — VERSIONED at /api/v1
// ===========================
// Per the BTP coding guideline (Programmierrichtlinie §7), all API routes
// are mounted under a version prefix. Future breaking changes get a new
// version (e.g., /api/v2) mounted alongside, never replacing v1 in place.

app.use('/api/v1', optionalSession);

app.use('/api/v1', require('./routes/activityRoutes'));
app.use('/api/v1', require('./routes/entryRoutes'));
app.use('/api/v1', require('./routes/lookupRoutes'));
app.use('/api/v1', require('./routes/configRoutes'));

// ===========================
// START SERVER
// ===========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`FSM_WEBCONTAINER_AUTH_KEY is set (${FSM_WEBCONTAINER_AUTH_KEY.length} chars)`);
    console.log(`Session TTL: ${SESSION_TTL_MS / 60000} minutes`);
    console.log(`API mounted at /api/v1 — use /api/v1/<endpoint> in all client calls.`);
});