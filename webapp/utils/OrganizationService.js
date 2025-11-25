sap.ui.define([], () => {
    "use strict";

    return {
        /**
         * Cache for organizational level data (full hierarchy)
         */
        _orgLevelCache: new Map(), // Key: formatted ID, Value: { id, name, shortDescription, longDescription }
        _hierarchyLoaded: false,

        /**
         * Format organization level ID for lookup
         * Converts: 2B6F748557D44F249F6BEFC6D0FB07B0
         * To:       2b6f7485-57d4-4f24-9f6b-efc6d0fb07b0
         */
        formatOrgLevelId(orgLevelId) {
            if (!orgLevelId) return null;
            
            // Remove any existing hyphens and convert to lowercase
            const cleaned = orgLevelId.replace(/-/g, '').toLowerCase();
            
            // Add hyphens in UUID format: 8-4-4-4-12
            if (cleaned.length === 32) {
                return `${cleaned.substring(0, 8)}-${cleaned.substring(8, 12)}-${cleaned.substring(12, 16)}-${cleaned.substring(16, 20)}-${cleaned.substring(20, 32)}`;
            }
            
            return orgLevelId; // Return as-is if not 32 characters
        },

        /**
         * Fetch organizational levels from backend (full hierarchy)
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
         * Load full organizational hierarchy and populate cache
         */
        async loadOrganizationalHierarchy() {
            if (this._hierarchyLoaded) {
                console.log('OrganizationService: Hierarchy already loaded');
                return;
            }

            try {
                console.log('OrganizationService: Loading full organizational hierarchy...');

                const response = await fetch("/api/get-organization-levels-full", {
                    method: "GET",
                    headers: { "Content-Type": "application/json" }
                });

                if (!response.ok) {
                    throw new Error(`Failed to load organization levels: ${response.status}`);
                }

                const data = await response.json();
                
                // Recursively process all levels and sublevels
                if (data.level && data.level.subLevels) {
                    this._processLevelsRecursive(data.level.subLevels);
                }

                this._hierarchyLoaded = true;
                console.log('OrganizationService: Loaded', this._orgLevelCache.size, 'organization levels');

            } catch (error) {
                console.error("OrganizationService: Error loading hierarchy:", error);
                throw error;
            }
        },

        /**
         * Recursively process organization levels and add to cache
         */
        _processLevelsRecursive(levels) {
            if (!levels || !Array.isArray(levels)) return;

            levels.forEach(level => {
                // Cache this level
                const orgLevelData = {
                    id: level.id,
                    name: level.name || '',
                    shortDescription: level.shortDescription || level.name || '',
                    longDescription: level.longDescription || level.name || ''
                };

                this._orgLevelCache.set(level.id, orgLevelData);

                // Process sublevels recursively
                if (level.subLevels && Array.isArray(level.subLevels)) {
                    this._processLevelsRecursive(level.subLevels);
                }
            });
        },

        /**
         * Get organization level display text by ID
         * Automatically formats the ID and looks up in cache
         * Format: "2130_MPA_TEAM1"
         */
        getOrgLevelDisplayTextById(orgLevelId) {
            if (!orgLevelId || orgLevelId === 'N/A') return 'N/A';

            // Format ID to UUID format
            const formattedId = this.formatOrgLevelId(orgLevelId);

            // Check cache
            const orgLevel = this._orgLevelCache.get(formattedId);
            if (orgLevel) {
                return orgLevel.shortDescription || orgLevel.name;
            }

            // If not in cache, try to load hierarchy (async)
            if (!this._hierarchyLoaded) {
                this.loadOrganizationalHierarchy();
            }

            // Return original ID if not found
            return orgLevelId;
        },

        /**
         * Get organization level full name by ID
         * Format: "Service Unit 2130_MPA_Team1  MPA Service Team 1"
         */
        getOrgLevelFullNameById(orgLevelId) {
            if (!orgLevelId || orgLevelId === 'N/A') return 'N/A';

            const formattedId = this.formatOrgLevelId(orgLevelId);

            const orgLevel = this._orgLevelCache.get(formattedId);
            if (orgLevel) {
                return orgLevel.longDescription || orgLevel.name;
            }

            return orgLevelId;
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
        },

        /**
         * Search organization levels by name
         */
        searchOrgLevels(searchTerm) {
            if (!searchTerm || searchTerm.length < 2) {
                return [];
            }

            const term = searchTerm.toLowerCase();
            const results = [];

            this._orgLevelCache.forEach((orgLevel) => {
                const nameMatch = orgLevel.name.toLowerCase().includes(term);
                const shortDescMatch = orgLevel.shortDescription.toLowerCase().includes(term);
                const longDescMatch = orgLevel.longDescription.toLowerCase().includes(term);

                if (nameMatch || shortDescMatch || longDescMatch) {
                    results.push({
                        id: orgLevel.id,
                        name: orgLevel.name,
                        shortDescription: orgLevel.shortDescription,
                        displayText: orgLevel.shortDescription || orgLevel.name
                    });
                }
            });

            // Sort by name
            results.sort((a, b) => a.name.localeCompare(b.name));

            return results;
        },

        /**
         * Clear cache
         */
        clearCache() {
            this._orgLevelCache.clear();
            this._hierarchyLoaded = false;
            console.log('OrganizationService: Cache cleared');
        }
    };
});