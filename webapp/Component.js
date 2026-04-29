// ===========================================================================
// GLOBAL FETCH WRAPPER — INCLUDE COOKIES ON ALL REQUESTS
// ===========================================================================
// All /api/* calls require a session cookie set by the backend after the
// FSM WebContainer POST. This wrapper ensures every fetch() in the app
// sends cookies automatically, without having to add credentials:'include'
// to each call site individually across the 15+ service modules.
//
// Placed OUTSIDE sap.ui.define so it runs at file-parse time, before any
// other module loads and fires its first request. Idempotent — safe if
// the file is somehow evaluated more than once.
// ===========================================================================
(function wrapFetchToIncludeCookies() {
    if (typeof window === 'undefined' || !window.fetch) return;
    if (window.__fetchWrappedForCookies) return;
    window.__fetchWrappedForCookies = true;

    const originalFetch = window.fetch.bind(window);
    window.fetch = function(input, init) {
        const opts = init || {};
        // Only set credentials if the caller didn't specify it explicitly.
        // This preserves any future call that genuinely wants credentials:'omit'.
        if (!opts.credentials) {
            opts.credentials = 'include';
        }
        return originalFetch(input, opts);
    };
})();

/**
 * Component.js
 * 
 * Main UI5 application component for the FSM Service Confirmation app.
 * Initializes the application, sets up models, and configures routing.
 * 
 * Key Features:
 * - Initialize device model for responsive layouts
 * - Configure router with mobile navigation fixes
 * - Handle bypassed routes for FSM Mobile compatibility
 * - Wrap window.fetch globally to include session cookies on /api/* calls
 *   (see IIFE at top of file).
 * 
 * Mobile Compatibility:
 * FSM Mobile web container may bypass initial routing, so the component
 * includes fallback navigation to ensure View1 loads correctly.
 * 
 * @file Component.js
 * @module mobileapptm/Component
 * @extends sap.ui.core.UIComponent
 * @requires sap/ui/core/UIComponent
 * @requires mobileapptm/model/models
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

        /**
         * Initialize the component.
         * Sets up device model and configures router with mobile fixes.
         */
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