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
 * 
 * Mobile Compatibility:
 * FSM Mobile web container may bypass initial routing, so the component
 * includes fallback navigation to ensure View1 loads correctly.
 * 
 * @file Component.js
 * @module mobileappsc/Component
 * @extends sap.ui.core.UIComponent
 * @requires sap/ui/core/UIComponent
 * @requires mobileappsc/model/models
 */
sap.ui.define([
    "sap/ui/core/UIComponent",
    "mobileappsc/model/models"
], (UIComponent, models) => {
    "use strict";

    return UIComponent.extend("mobileappsc.Component", {
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