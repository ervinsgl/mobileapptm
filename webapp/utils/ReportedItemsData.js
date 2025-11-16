sap.ui.define([], () => {
    "use strict";

    return {
        /**
         * Fetch all reported items (Time Effort, Material, Expense, Mileage) for an activity
         * @param {string} activityId - Activity ID to fetch items for
         * @returns {Promise<Array>} Array of reported items
         */
        async getReportedItems(activityId) {
            console.log("ReportedItemsData: Fetching reported items for activity:", activityId);

            if (!activityId) {
                console.error("ReportedItemsData: Activity ID is required");
                throw new Error("Activity ID is required");
            }

            try {
                const response = await fetch("/api/get-reported-items", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ activityId })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || `Failed to fetch reported items: ${response.status}`);
                }

                const data = await response.json();
                console.log(`ReportedItemsData: Found ${data.items?.length || 0} reported items`);
                
                return data.items || [];

            } catch (error) {
                console.error("ReportedItemsData: Error fetching reported items:", error);
                throw error;
            }
        }
    };
});