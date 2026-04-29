// ===========================================================================
// GLOBAL FETCH WRAPPER — INCLUDE COOKIES AND/OR AUTHORIZATION BEARER
// ===========================================================================
// All /api/v1/* calls require authentication. Supplied via either:
//
//   - HttpOnly session cookie (Mobile flow — WebView stores it fine)
//   - Authorization: Bearer header (Web UI flow — third-party iframe
//     context where browsers refuse to store cookies)
//
// The cookie is set automatically by the browser when present. The Bearer
// token is held in memory by ContextService and exposed via
// window.__fsmSessionToken; this wrapper attaches it as a request header
// when available. Sending both is harmless — the backend uses whichever is
// valid.
//
// Gating: /api/* requests wait for window.__fsmSessionReady to resolve
// before firing. ContextService resolves it after either:
//   - cached context returned (cookie already set in a previous load), or
//   - shell-session-init completed and __fsmSessionToken was set
// 
// Safety timeout: 10s, after which queued requests proceed regardless. This
// avoids deadlock if context resolution fails entirely.
// ===========================================================================
(function wrapFetchToIncludeCookies() {
    if (typeof window === 'undefined' || !window.fetch) return;
    if (window.__fetchWrappedForCookies) return;
    window.__fetchWrappedForCookies = true;

    // Slot for the session token (Web UI flow). Mobile flow leaves this null.
    // ContextService writes here after shell-session-init succeeds.
    window.__fsmSessionToken = null;

    // Gate Promise — resolved by ContextService when session is ready.
    window.__fsmSessionGateResolved = false;
    let sessionReady = new Promise(resolve => {
        const innerResolve = resolve;
        window.__fsmSessionReadyResolve = function() {
            if (window.__fsmSessionGateResolved) return;
            window.__fsmSessionGateResolved = true;
            innerResolve();
        };
        // Safety: never hang forever
        setTimeout(() => {
            if (!window.__fsmSessionGateResolved) {
                console.warn("fetch-wrapper: session readiness gate timed out after 10s — proceeding anyway");
                window.__fsmSessionReadyResolve();
            }
        }, 10000);
    });
    window.__fsmSessionReady = sessionReady;

    const originalFetch = window.fetch.bind(window);
    window.fetch = async function(input, init) {
        const opts = init || {};
        if (!opts.credentials) {
            opts.credentials = 'include';
        }

        const urlStr = typeof input === 'string' ? input : (input && input.url) || '';
        const isApi = urlStr.indexOf('/api/') === 0;
        const isInitEndpoint = urlStr.indexOf('/api/v1/shell-session-init') === 0;

        // Gate /api/* requests on session readiness, except shell-session-init
        // (which is what RESOLVES the gate — chicken-and-egg).
        if (isApi && !isInitEndpoint) {
            await window.__fsmSessionReady;
        }

        // Inject Authorization header if we have a Bearer token (Web UI flow).
        // Skip the init endpoint — it doesn't need auth (it's establishing it).
        if (isApi && !isInitEndpoint && window.__fsmSessionToken) {
            const headers = new Headers(opts.headers || {});
            // Only add if caller didn't already set one
            if (!headers.has('Authorization')) {
                headers.set('Authorization', 'Bearer ' + window.__fsmSessionToken);
                opts.headers = headers;
            }
        }

        return originalFetch(input, opts);
    };
})();

/**
 * Component.js
 * ... (rest of file unchanged — keep your existing sap.ui.define block as-is)
 */
sap.ui.define([
    "sap/ui/core/UIComponent",
    "mobileapptm/model/models"
], (UIComponent, models) => {
    "use strict";

    return UIComponent.extend("mobileapptm.Component", {
        metadata: {
            manifest: "json",
            interfaces: [
                "sap.ui.core.IAsyncContentCreation"
            ]
        },

        init() {
            UIComponent.prototype.init.apply(this, arguments);
            this.setModel(models.createDeviceModel(), "device");

            const router = this.getRouter();

            if (router) {
                router.attachBypassed(() => {
                    router.navTo("RouteView1", {}, true);
                });

                router.initialize();

                setTimeout(() => {
                    const targets = router.getTargets();
                    if (targets) {
                        const view1Target = targets.getTarget("TargetView1");
                        if (view1Target && !view1Target._oView) {
                            router.navTo("RouteView1", {}, true);
                        }
                    }
                }, 500);
            }
        }
    });
});