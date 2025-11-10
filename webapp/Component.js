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

        init() {
            // Call base component init
            UIComponent.prototype.init.apply(this, arguments);

            // Set device model
            this.setModel(models.createDeviceModel(), "device");

            // Get router and add mobile fix
            const router = this.getRouter();
            
            if (router) {
                // MOBILE FIX: Force navigation if route bypassed
                router.attachBypassed(function() {
                    router.navTo("RouteView1", {}, true);
                });
                
                // Initialize router
                router.initialize();
                
                // MOBILE FIX: Double-check after 500ms using getTargets
                setTimeout(function() {
                    const targets = router.getTargets();
                    if (targets) {
                        const view1Target = targets.getTarget("TargetView1");
                        if (view1Target && !view1Target._oView) {
                            // View not loaded, force navigation
                            router.navTo("RouteView1", {}, true);
                        }
                    }
                }, 500);
            }
        }
    });
});