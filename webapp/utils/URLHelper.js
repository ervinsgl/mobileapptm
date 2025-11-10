sap.ui.define([], () => {
    "use strict";

    return {
        /**
         * Get URL parameters as object
         */
        getUrlParameters() {
            const urlParams = new URLSearchParams(window.location.search);
            return {
                activityId: urlParams.get('activityId'),
                activityCode: urlParams.get('activityCode'),
                activitySubject: urlParams.get('activitySubject')
            };
        },

        /**
         * Check if activity ID exists in URL
         */
        hasActivityId() {
            return !!this.getUrlParameters().activityId;
        },

        /**
         * Get activity ID from URL
         */
        getActivityId() {
            return this.getUrlParameters().activityId;
        }
    };
});