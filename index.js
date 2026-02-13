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
// Stores context from FSM Mobile web container POST request
let mobileAppContext = undefined;

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
    // Store context in memory (for frontend Session Context panel and cloudId)
    mobileAppContext = req.body || {};
    
    // Redirect to app root (frontend will fetch context via GET)
    const redirectUrl = req.protocol + '://' + req.get('host');
    res.redirect(redirectUrl);
});

// GET endpoint for frontend to retrieve stored context
app.get("/web-container-context", (req, res) => {
    if (mobileAppContext === undefined) {
        return res.status(404).json({ 
            message: 'Context from mobile web container is not available.',
            hint: 'Open this app from FSM Mobile web container, not directly in browser.'
        });
    }
    
    // Return context (for Session Context panel and cloudId)
    return res.json(mobileAppContext);
});

// Also handle POST to root "/" in case FSM sends there
app.post("/", (req, res) => {
    mobileAppContext = req.body || {};
    const redirectUrl = req.protocol + '://' + req.get('host');
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