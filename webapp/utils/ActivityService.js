sap.ui.define([], () => {
    "use strict";

    return {
        /**
         * Format activity ID for FSM API
         * Converts: 77f485d3-c917-49db-8da3-c4045d95c2b9
         * To:       77F485D3C91749DB8DA3C4045D95C2B9
         */
        formatActivityId(activityId) {
            if (!activityId) return "";
            return activityId.replace(/-/g, '').toUpperCase();
        },

        /**
         * Fetch activity by ID from backend
         */
        async fetchActivityById(activityId) {
            const formattedId = this.formatActivityId(activityId);
            
            const response = await fetch("/api/get-activity-by-id", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ activityId: formattedId })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP ${response.status}`);
            }

            return response.json();
        },

        /**
         * Fetch activities for a service call
         */
        async fetchActivitiesForServiceCall(serviceCallId) {
            const response = await fetch("/api/get-activities-by-service-call", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ serviceCallId: serviceCallId })
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch activities: ${response.status}`);
            }

            const data = await response.json();
            
            // Filter only EXECUTION stage activities
            const activities = data.activities || [];
            return activities.filter(activity => 
                activity.executionStage === "EXECUTION"
            );
        },

        /**
         * Extract activity data from FSM response
         */
        extractActivityData(response) {
            const activity = response.data?.[0]?.activity || response;
            
            return {
                id: activity.id,
                code: activity.code,
                subject: activity.subject,
                createPerson: activity.createPerson,
                type: activity.type,
                status: activity.status,
                startDateTime: activity.startDateTime,
                endDateTime: activity.endDateTime,
                object: activity.object,
                rawData: activity
            };
        },

        /**
         * Extract service call data from activity
         */
        extractServiceCallData(activity) {
            if (!activity.object) return null;
            
            return {
                id: activity.object.objectId,
                subject: activity.subject
            };
        }
    };
});