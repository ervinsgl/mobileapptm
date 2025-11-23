sap.ui.define([], () => {
    "use strict";

    // Private cache for UDF meta - maps ID to externalId
    let _udfMetaCache = new Map();

    return {
        /**
         * Fetch UDF Meta externalId by ID from backend
         * Results are cached for the session
         * @param {string} udfMetaId - UDF Meta ID
         * @returns {Promise<string|null>} externalId or null if not found
         */
        async fetchUdfMetaById(udfMetaId) {
            if (!udfMetaId) {
                return null;
            }

            // Return cached data if available
            if (_udfMetaCache.has(udfMetaId)) {
                const cached = _udfMetaCache.get(udfMetaId);
                console.log('UdfMetaService: Returning cached externalId for', udfMetaId, ':', cached);
                return cached;
            }

            try {
                console.log('UdfMetaService: Fetching UDF Meta for ID:', udfMetaId);

                const response = await fetch("/api/get-udf-meta", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ udfMetaId: udfMetaId })
                });

                if (!response.ok) {
                    console.warn('UdfMetaService: Failed to fetch UDF Meta:', response.status);
                    _udfMetaCache.set(udfMetaId, null);
                    return null;
                }

                const data = await response.json();
                const externalId = data.externalId || null;

                // Cache the result
                _udfMetaCache.set(udfMetaId, externalId);

                console.log('UdfMetaService: Resolved', udfMetaId, 'to', externalId);
                return externalId;

            } catch (error) {
                console.error("UdfMetaService: Error fetching UDF Meta:", error);
                _udfMetaCache.set(udfMetaId, null);
                return null;
            }
        },

        /**
         * Batch fetch multiple UDF Meta externalIds
         * @param {Array<string>} udfMetaIds - Array of UDF Meta IDs
         * @returns {Promise<Map<string, string>>} Map of ID to externalId
         */
        async fetchMultipleUdfMeta(udfMetaIds) {
            if (!udfMetaIds || udfMetaIds.length === 0) {
                return new Map();
            }

            // Filter out already cached IDs
            const uncachedIds = udfMetaIds.filter(id => !_udfMetaCache.has(id));

            if (uncachedIds.length > 0) {
                console.log('UdfMetaService: Batch fetching', uncachedIds.length, 'UDF Meta records');

                // Fetch uncached ones in parallel (with limit to avoid overwhelming API)
                const chunkSize = 10;
                for (let i = 0; i < uncachedIds.length; i += chunkSize) {
                    const chunk = uncachedIds.slice(i, i + chunkSize);
                    await Promise.all(chunk.map(id => this.fetchUdfMetaById(id)));
                }
            }

            // Build result map from cache
            const result = new Map();
            udfMetaIds.forEach(id => {
                if (_udfMetaCache.has(id)) {
                    result.set(id, _udfMetaCache.get(id));
                }
            });

            return result;
        },

        /**
         * Get cached externalId for a UDF Meta ID (synchronous)
         * @param {string} udfMetaId - UDF Meta ID
         * @returns {string|null} externalId or null if not cached/found
         */
        getExternalIdById(udfMetaId) {
            if (!udfMetaId) {
                return null;
            }
            return _udfMetaCache.get(udfMetaId) || null;
        },

        /**
         * Format UDF values array for display
         * Filters out UDFs without externalId and formats as "externalId: value"
         * @param {Array} udfValues - Array of UDF value objects with {meta, value}
         * @returns {string} Formatted string or 'N/A'
         */
        formatUdfValuesForDisplay(udfValues) {
            if (!udfValues || !Array.isArray(udfValues) || udfValues.length === 0) {
                return 'N/A';
            }

            const formattedParts = [];

            udfValues.forEach(udf => {
                const metaId = udf.meta;
                const value = udf.value;

                if (metaId && value !== undefined && value !== null) {
                    const externalId = this.getExternalIdById(metaId);
                    
                    // Only include if externalId exists
                    if (externalId) {
                        formattedParts.push(`${externalId}: ${value}`);
                    }
                }
            });

            return formattedParts.length > 0 ? formattedParts.join(', ') : 'N/A';
        },

        /**
         * Pre-load UDF Meta for an array of reports
         * Call this before formatting to ensure cache is populated
         * @param {Array} reports - Array of T&M report objects
         * @returns {Promise<void>}
         */
        async preloadUdfMetaForReports(reports) {
            if (!reports || reports.length === 0) {
                return;
            }

            // Collect all unique UDF meta IDs from all reports
            const allMetaIds = new Set();

            reports.forEach(report => {
                const udfValues = report.udfValues || report.fullData?.udfValues || [];
                udfValues.forEach(udf => {
                    if (udf.meta) {
                        allMetaIds.add(udf.meta);
                    }
                });
            });

            if (allMetaIds.size > 0) {
                console.log('UdfMetaService: Pre-loading', allMetaIds.size, 'unique UDF meta IDs');
                await this.fetchMultipleUdfMeta(Array.from(allMetaIds));
            }
        },

        /**
         * Check if a UDF Meta ID is cached
         * @param {string} udfMetaId - UDF Meta ID
         * @returns {boolean} True if cached
         */
        isCached(udfMetaId) {
            return _udfMetaCache.has(udfMetaId);
        },

        /**
         * Get cache size
         * @returns {number} Number of cached entries
         */
        getCacheSize() {
            return _udfMetaCache.size;
        },

        /**
         * Clear the cache (useful for refresh scenarios)
         */
        clearCache() {
            _udfMetaCache.clear();
            console.log('UdfMetaService: Cache cleared');
        }
    };
});