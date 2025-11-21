sap.ui.define([], () => {
    "use strict";

    return {
        /**
         * Fetch all reported items (Time Effort, Material, Expense, Mileage) for an activity
         * @param {string} activityId - Activity ID to fetch items for
         * @returns {Promise<Array>} Array of reported items
         */
        async getReportedItems(activityId) {
            if (!activityId) {
                console.error("ReportedItemsData: Activity ID is required");
                throw new Error("Activity ID is required");
            }

            try {
                console.log('ReportedItemsData: Fetching T&M for activity:', activityId);

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
                const items = data.items || [];

                console.log('ReportedItemsData: Received T&M items:', items);
                console.log('ReportedItemsData: Items count:', items.length);

                // ✅ Debug each item structure
                items.forEach((item, index) => {
                    console.log(`ReportedItemsData: Item ${index + 1}:`, item);
                });

                return items;

            } catch (error) {
                console.error("ReportedItemsData: Error fetching reported items:", error);
                throw error;
            }
        }
    };
});