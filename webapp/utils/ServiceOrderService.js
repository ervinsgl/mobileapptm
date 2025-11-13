sap.ui.define([], () => {
    "use strict";

    return {
        /**
         * Fetch service call details by ID
         */
        async fetchServiceCallById(serviceCallId) {
            console.log('\n========================================');
            console.log('SERVICE ORDER: Fetch By ID - REQUEST');
            console.log('========================================');
            console.log('Service Call ID:', serviceCallId);
            console.log('API Endpoint: /api/get-activities-by-service-call');
            
            const response = await fetch("/api/get-activities-by-service-call", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ serviceCallId: serviceCallId })
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch service call: ${response.status}`);
            }

            const data = await response.json();
            
            console.log('\n========================================');
            console.log('SERVICE ORDER: Fetch By ID - RESPONSE');
            console.log('========================================');
            console.log('Full Composite Tree Response:', data);
            
            return data;
        },

        /**
         * Extract service order data from composite-tree response
         * In composite-tree API, service call data is at ROOT level
         */
        extractServiceOrderData(compositeData) {
            console.log('\n========================================');
            console.log('SERVICE ORDER: Extract Data');
            console.log('========================================');
            
            if (!compositeData) {
                console.warn('No composite data provided');
                return null;
            }
            
            console.log('Composite data keys:', Object.keys(compositeData));
            console.log('Service Call ID:', compositeData.id);
            console.log('External ID:', compositeData.externalId);
            console.log('Code:', compositeData.code);
            console.log('Subject:', compositeData.subject);
            
            // Extract business partner external ID
            let businessPartnerExternalId = null;
            if (compositeData.businessPartner && compositeData.businessPartner.externalId) {
                businessPartnerExternalId = compositeData.businessPartner.externalId;
            }
            console.log('Business Partner External ID:', businessPartnerExternalId);
            
            // Extract responsible external ID (first responsible if multiple)
            let responsibleExternalId = null;
            if (compositeData.responsibles && compositeData.responsibles.length > 0) {
                responsibleExternalId = compositeData.responsibles[0].externalId || 
                                       compositeData.responsibles[0].code ||
                                       compositeData.responsibles[0].id;
            }
            console.log('Responsible External ID:', responsibleExternalId);
            
            const serviceOrderData = {
                id: compositeData.id,
                externalId: compositeData.externalId || compositeData.code || compositeData.id,
                subject: compositeData.subject || '',
                businessPartnerExternalId: businessPartnerExternalId || 'N/A',
                responsibleExternalId: responsibleExternalId || 'N/A',
                earliestStartDateTime: compositeData.earliestStartDateTime || null,
                dueDateTime: compositeData.dueDateTime || null
            };
            
            console.log('\n--- EXTRACTED SERVICE ORDER DATA ---');
            console.log(serviceOrderData);
            
            return serviceOrderData;
        },

        /**
         * Extract activities array from composite-tree response
         */
        extractActivitiesFromCompositeTree(compositeData) {
            console.log('\n========================================');
            console.log('SERVICE ORDER: Extract Activities Array');
            console.log('========================================');
            
            if (!compositeData || !compositeData.activities) {
                console.warn('No activities in composite tree response');
                return [];
            }
            
            const activities = compositeData.activities || [];
            console.log('Total activities in response:', activities.length);
            
            // Group by executionStage
            const stages = {};
            activities.forEach(activity => {
                const stage = activity.executionStage || 'NO_STAGE';
                if (!stages[stage]) stages[stage] = [];
                stages[stage].push(activity);
            });
            
            console.log('\nActivities grouped by executionStage:');
            Object.keys(stages).forEach(stage => {
                console.log(`  ${stage}: ${stages[stage].length} activities`);
            });
            
            // Group by type
            const types = {};
            activities.forEach(activity => {
                const type = activity.type || 'NO_TYPE';
                if (!types[type]) types[type] = [];
                types[type].push(activity);
            });
            
            console.log('\nActivities grouped by type:');
            Object.keys(types).forEach(type => {
                console.log(`  ${type}: ${types[type].length} activities`);
            });
            
            // Log sample activity
            if (activities.length > 0) {
                console.log('\n--- SAMPLE ACTIVITY (first one) ---');
                console.log('Activity Object:', activities[0]);
                console.log('Activity Keys:', Object.keys(activities[0]));
            }
            
            // Log all activity summaries
            console.log('\n--- ALL ACTIVITIES SUMMARY ---');
            activities.forEach((activity, index) => {
                console.log(`${index + 1}. ID: ${activity.id}, Code: ${activity.code}, Subject: ${activity.subject}, Stage: ${activity.executionStage}, Type: ${activity.type}`);
            });
            
            return activities;
        }
    };
});