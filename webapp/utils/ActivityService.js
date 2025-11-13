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
            console.log('\n========================================');
            console.log('FRONTEND: Fetch Activity By ID - REQUEST');
            console.log('========================================');
            console.log('Original Activity ID:', activityId);
            
            const formattedId = this.formatActivityId(activityId);
            console.log('Formatted Activity ID:', formattedId);
            console.log('API Endpoint: /api/get-activity-by-id');
            
            const response = await fetch("/api/get-activity-by-id", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ activityId: formattedId })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('ERROR:', errorData);
                throw new Error(errorData.message || `HTTP ${response.status}`);
            }

            const data = await response.json();
            
            console.log('\n========================================');
            console.log('FRONTEND: Fetch Activity By Id - RESPONSE');
            console.log('========================================');
            console.log('Full Response:', data);
            
            if (data.data && Array.isArray(data.data)) {
                console.log('\n--- Activity Data ---');
                console.log('Number of activities:', data.data.length);
                data.data.forEach((item, index) => {
                    console.log(`\nActivity ${index + 1}:`, item.activity);
                });
            }

            return data;
        },

        /**
         * Fetch activities for a service call (EXECUTION stage only)
         */
        async fetchActivitiesForServiceCall(serviceCallId) {
            console.log('\n========================================');
            console.log('ACTIVITY SERVICE: Fetch Activities - REQUEST');
            console.log('========================================');
            console.log('Service Call ID:', serviceCallId);
            console.log('API Endpoint: /api/get-activities-by-service-call');
            
            const response = await fetch("/api/get-activities-by-service-call", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ serviceCallId: serviceCallId })
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch activities: ${response.status}`);
            }

            const data = await response.json();
            
            console.log('\n========================================');
            console.log('ACTIVITY SERVICE: Fetch Activities - RESPONSE');
            console.log('========================================');
            
            // Extract activities array
            const activities = data.activities || [];
            console.log('Total activities:', activities.length);
            
            // Filter only EXECUTION stage activities
            const executionActivities = activities.filter(activity => 
                activity.executionStage === "EXECUTION"
            );
            
            console.log('EXECUTION stage activities:', executionActivities.length);
            
            return executionActivities;
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