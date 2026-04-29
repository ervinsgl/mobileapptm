/**
 * index.js - Backend Server
 * 
 * Express.js server for the Service Confirmation application.
 * Handles FSM Mobile web container integration, serves the UI5 frontend,
 * and mounts API route modules.
 * 
 * Key Responsibilities:
 * 1. Web Container Entry Point - Receives POST from FSM Mobile with context
 *    Validates the Authentication Key shared secret before accepting context.
 * 2. Static File Serving - Serves the UI5 frontend from /webapp
 * 3. Route Mounting - Delegates API handling to route modules
 * 
 * Route Modules (mounted at /api):
 * - activityRoutes  - Activity CRUD and reported items
 * - entryRoutes     - T&M entry batch and individual CRUD
 * - lookupRoutes    - Person, org, lookup, approval, user endpoints
 * - configRoutes    - Expense/Mileage type configuration
 * 
 * Required Environment Variables:
 * - FSM_WEBCONTAINER_AUTH_KEY - Shared secret matching the Authentication Key
 *   value configured in FSM Admin > Companies > [Company] > Web Containers.
 *   The server refuses to start if this is unset.
 * 
 * @file index.js
 * @requires express
 * @requires ./routes/activityRoutes
 * @requires ./routes/entryRoutes
 * @requires ./routes/lookupRoutes
 * @requires ./routes/configRoutes
 */

const express = require('express');
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
 * 
 * @param {Object} body - The parsed request body
 * @returns {boolean} true if the key matches, false otherwise
 */
function isAuthKeyValid(body) {
    const provided = body && body.authenticationKey;
    if (typeof provided !== 'string' || provided.length === 0) {
        return false;
    }

    // Both buffers must be the same length for timingSafeEqual.
    // If lengths differ, the secret is wrong — return false without comparing.
    const providedBuf = Buffer.from(provided, 'utf8');
    const expectedBuf = Buffer.from(FSM_WEBCONTAINER_AUTH_KEY, 'utf8');
    if (providedBuf.length !== expectedBuf.length) {
        return false;
    }

    return crypto.timingSafeEqual(providedBuf, expectedBuf);
}

// ===========================
// FSM WEB CONTAINER CONTEXT STORAGE
// ===========================
// Keyed by "userName_cloudId" so each user/object gets their own slot.
// Prevents concurrent users overwriting each other's context.
// Each entry has a timestamp — entries older than 30 min are cleaned up on every POST.

const contextStore = new Map();
const CONTEXT_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Build a unique key from POST body.
 * Falls back gracefully if fields are missing.
 */
function buildContextKey(body) {
    const userName = (body.userName || 'anonymous').replace(/[^a-zA-Z0-9_-]/g, '_');
    const cloudId  = (body.cloudId  || 'unknown'  ).replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${userName}_${cloudId}`;
}

/**
 * Remove entries older than CONTEXT_TTL_MS.
 * Called on every POST to keep memory usage bounded.
 */
function evictExpiredContexts() {
    const now = Date.now();
    for (const [key, entry] of contextStore.entries()) {
        if (now - entry.timestamp > CONTEXT_TTL_MS) {
            contextStore.delete(key);
        }
    }
}

// Middleware
app.use((req, res, next) => {
    res.removeHeader('X-Frame-Options');
    next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.enable('trust proxy');

// ===========================
// FSM WEB CONTAINER ENTRY POINT
// ===========================
// FSM Mobile sends POST request with context when opening web container.
// iOS: Content-Type: application/json
// Android: Content-Type: application/x-www-form-urlencoded
// Configure this URL in FSM Admin > Web Containers.
//
// FSM Mobile transmits the Authentication Key value in the body as
// `authenticationKey`. We validate it here before storing anything.

/**
 * Shared handler for both POST entry points (/web-container-access-point and /).
 * Validates auth key, stores context, redirects to the frontend with a context key.
 */
function handleWebContainerPost(req, res, label) {
    const body = req.body || {};

    // STEP 1: Validate the Authentication Key shared secret.
    // Without this, anyone with the URL could inject fake context for any user.
    if (!isAuthKeyValid(body)) {
        // Log enough to diagnose mistakes (config drift, missing key) but
        // never log the provided value — that would leak any partial guess
        // an attacker is making, and could leak the real key on misconfig.
        const provided = body && body.authenticationKey;
        const reason = !provided
            ? 'missing'
            : (typeof provided !== 'string' ? 'wrong-type' : 'mismatch');
        console.warn(`${label}: rejected POST — authenticationKey ${reason} ` +
                     `(remoteIp=${req.ip}, userName=${body.userName || 'unknown'})`);

        return res.status(401).json({
            message: 'Unauthorized: invalid or missing authentication key.',
            hint: 'This endpoint can only be reached from FSM Mobile. ' +
                  'Verify the Authentication Key in FSM Admin > Web Containers ' +
                  'matches the FSM_WEBCONTAINER_AUTH_KEY environment variable.'
        });
    }

    // STEP 2: Auth passed. Clean up stale context entries before storing a new one.
    evictExpiredContexts();

    // STEP 3: Store context under a unique key.
    // Note: we strip authenticationKey out of the stored data so the secret
    // never sits in memory longer than this request needs it to.
    const { authenticationKey, ...storableBody } = body;
    const key = buildContextKey(storableBody);
    contextStore.set(key, { data: storableBody, timestamp: Date.now() });
    console.log(`${label}: context stored for key=${key} (store size=${contextStore.size})`);

    // STEP 4: Redirect browser to frontend with the context key.
    const redirectUrl = `${req.protocol}://${req.get('host')}/?contextKey=${encodeURIComponent(key)}`;
    res.redirect(redirectUrl);
}

app.post("/web-container-access-point", (req, res) => {
    handleWebContainerPost(req, res, 'WC-ACCESS-POINT');
});

// Also handle POST to root "/" in case FSM sends there
app.post("/", (req, res) => {
    handleWebContainerPost(req, res, 'WC-ROOT');
});

// GET endpoint for frontend to retrieve stored context
app.get("/web-container-context", (req, res) => {
    const key = req.query.key;

    if (!key) {
        return res.status(400).json({
            message: 'Missing context key.',
            hint: 'Pass ?key=<contextKey> — value comes from the contextKey URL param after redirect.'
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

// Serve static files (Fiori app) - serve from webapp folder
app.use(express.static(path.join(__dirname, 'webapp')));

// ===========================
// API ROUTES
// ===========================
app.use('/api', require('./routes/activityRoutes'));
app.use('/api', require('./routes/entryRoutes'));
app.use('/api', require('./routes/lookupRoutes'));
app.use('/api', require('./routes/configRoutes'));

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`FSM_WEBCONTAINER_AUTH_KEY is set (${FSM_WEBCONTAINER_AUTH_KEY.length} chars)`);
});