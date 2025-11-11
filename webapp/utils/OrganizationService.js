sap.ui.define([], () => {
    "use strict";

    return {
        /**
         * Fetch organizational levels from backend
         */
        async fetchOrganizationalLevels() {
            try {
                const response = await fetch("/api/get-organizational-levels", {
                    method: "GET",
                    headers: { "Content-Type": "application/json" }
                });

                if (!response.ok) {
                    throw new Error(`Failed to fetch organizational levels: ${response.status}`);
                }

                const data = await response.json();
                return data.levels || [];
            } catch (error) {
                console.error("OrganizationService: Error fetching levels:", error);
                throw error;
            }
        },

        /**
         * Transform levels for dropdown display
         */
        transformLevelsForDropdown(levels) {
            if (!Array.isArray(levels)) {
                console.warn("OrganizationService: levels is not an array:", levels);
                return [];
            }

            const transformed = levels.map(level => ({
                key: level.id,
                text: level.name,
                shortDescription: level.shortDescription || level.name,
                longDescription: level.longDescription || level.name
            }));

            // Verify no duplicate keys
            const keys = transformed.map(t => t.key);
            const uniqueKeys = [...new Set(keys)];
            if (keys.length !== uniqueKeys.length) {
                console.error("OrganizationService: DUPLICATE KEYS DETECTED!", keys);
            }

            return transformed;
        }
    };
});