/**
 * index.js - Backend Server
 * 
 * Express.js server for the Service Confirmation application.
 * Handles FSM Mobile web container integration, serves the UI5 frontend,
 * and mounts API route modules.
 * 
 * Key Responsibilities:
 * 1. Web Container Entry Point - Receives POST from FSM Mobile with context
 * 2. Static File Serving - Serves the UI5 frontend from /webapp
 * 3. Route Mounting - Delegates API handling to route modules
 * 
 * Route Modules (mounted at /api):
 * - activityRoutes  - Activity CRUD and reported items
 * - entryRoutes     - T&M entry batch and individual CRUD
 * - lookupRoutes    - Person, org, lookup data, approval, user endpoints
 * - configRoutes    - Expense/Mileage type configuration
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

const app = express();

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
// FSM Mobile sends POST request with context when opening web container
// iOS: Content-Type: application/json
// Android: Content-Type: application/x-www-form-urlencoded
// Configure this URL in FSM Admin > Web Containers

app.post("/web-container-access-point", (req, res) => {
    const body = req.body || {};

    // Clean up stale entries first
    evictExpiredContexts();

    // Store under unique key
    const key = buildContextKey(body);
    contextStore.set(key, { data: body, timestamp: Date.now() });
    console.log(`WebContainer: context stored for key=${key} (store size=${contextStore.size})`);

    // Pass key to frontend via redirect URL query param
    const redirectUrl = `${req.protocol}://${req.get('host')}/?contextKey=${encodeURIComponent(key)}`;
    res.redirect(redirectUrl);
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

// Also handle POST to root "/" in case FSM sends there
app.post("/", (req, res) => {
    const body = req.body || {};

    evictExpiredContexts();

    const key = buildContextKey(body);
    contextStore.set(key, { data: body, timestamp: Date.now() });
    console.log(`WebContainer (/): context stored for key=${key} (store size=${contextStore.size})`);

    const redirectUrl = `${req.protocol}://${req.get('host')}/?contextKey=${encodeURIComponent(key)}`;
    res.redirect(redirectUrl);
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
});