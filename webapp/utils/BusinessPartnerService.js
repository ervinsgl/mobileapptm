/**
 * BusinessPartnerService.js
 * 
 * Frontend service for business partner data management.
 * Handles on-demand loading, caching, and lookup of business partners.
 * 
 * Key Features:
 * - On-demand loading of business partners by externalId
 * - Caching to avoid redundant API calls
 * - Prevention of duplicate concurrent requests
 * - Search and dropdown support for cached data
 * 
 * Display Format: "Company Name (55003748)"
 * 
 * API Endpoint Used:
 * - POST /api/get-business-partner-by-external-id
 * 
 * @file BusinessPartnerService.js
 * @module mobileappsc/utils/BusinessPartnerService
 */
sap.ui.define([], () => {
    "use strict";

    return {
        /**
         * Cache for business partner data.
         * @type {Map<string, {externalId: string, name: string}>}
         * @private
         */
        _businessPartnerCache: new Map(),
        
        /**
         * Track ongoing loads to prevent duplicate requests.
         * @type {Map<string, Promise>}
         * @private
         */
        _loadingPromises: new Map(),

        /**
         * Get business partner display text by externalId.
         * Loads from API on-demand if not in cache.
         * @param {string} externalId - Business partner external ID
         * @returns {string} Display text "Name (externalId)" or just externalId if not cached
         */
        getBusinessPartnerDisplayTextByExternalId(externalId) {
            if (!externalId || externalId === 'N/A') return 'N/A';

            const cached = this._businessPartnerCache.get(externalId);
            if (cached) {
                return `${cached.name} (${cached.externalId})`;
            }

            // Not in cache - load asynchronously
            this._loadBusinessPartnerByExternalId(externalId);

            return externalId;
        },

        /**
         * Load business partner by externalId (async, caches result).
         * @param {string} externalId - Business partner external ID
         * @returns {Promise<void>}
         * @private
         */
        async _loadBusinessPartnerByExternalId(externalId) {
            if (!externalId) return;

            // Check if already loading
            if (this._loadingPromises.has(externalId)) {
                return this._loadingPromises.get(externalId);
            }

            const promise = (async () => {
                try {
                    const response = await fetch("/api/get-business-partner-by-external-id", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ externalId })
                    });

                    if (!response.ok) {
                        throw new Error(`Failed to load business partner: ${response.status}`);
                    }

                    const data = await response.json();
                    const businessPartner = data.businessPartner;

                    if (businessPartner) {
                        const bpData = {
                            externalId: businessPartner.externalId,
                            name: businessPartner.name || 'Unknown'
                        };
                        this._businessPartnerCache.set(businessPartner.externalId, bpData);
                    }

                } catch (error) {
                    console.error("BusinessPartnerService: Error loading business partner:", error);
                } finally {
                    this._loadingPromises.delete(externalId);
                }
            })();

            this._loadingPromises.set(externalId, promise);
            return promise;
        },

        /**
         * Preload specific business partners by externalId (for batch operations).
         * @param {string[]} externalIds - Array of external IDs to preload
         * @returns {Promise<void>}
         */
        async preloadBusinessPartnersByExternalId(externalIds) {
            if (!externalIds || externalIds.length === 0) return;

            const promises = externalIds
                .filter(id => id && id !== 'N/A' && !this._businessPartnerCache.has(id))
                .map(id => this._loadBusinessPartnerByExternalId(id));

            await Promise.allSettled(promises);
        },

        /**
         * Get business partner name only from cache.
         * @param {string} externalId - Business partner external ID
         * @returns {string} Name or externalId if not cached
         */
        getBusinessPartnerNameByExternalId(externalId) {
            if (!externalId || externalId === 'N/A') return 'N/A';

            const businessPartner = this._businessPartnerCache.get(externalId);
            if (businessPartner) {
                return businessPartner.name;
            }

            return externalId;
        },

        /**
         * Search business partners by name or externalId (cached data only).
         * @param {string} searchTerm - Search term (minimum 2 characters)
         * @returns {Array<{externalId: string, name: string, displayText: string}>}
         */
        searchBusinessPartners(searchTerm) {
            if (!searchTerm || searchTerm.length < 2) {
                return [];
            }

            const term = searchTerm.toLowerCase();
            const results = [];

            this._businessPartnerCache.forEach((bp) => {
                const nameMatch = bp.name.toLowerCase().includes(term);
                const externalIdMatch = bp.externalId.toLowerCase().includes(term);

                if (nameMatch || externalIdMatch) {
                    results.push({
                        externalId: bp.externalId,
                        name: bp.name,
                        displayText: `${bp.name} (${bp.externalId})`
                    });
                }
            });

            results.sort((a, b) => a.name.localeCompare(b.name));
            return results;
        },

        /**
         * Get all business partners for dropdown (cached data only).
         * @returns {Array<{key: string, text: string, externalId: string, name: string}>}
         */
        getAllBusinessPartnersForDropdown() {
            const businessPartners = [];

            this._businessPartnerCache.forEach((bp) => {
                businessPartners.push({
                    key: bp.externalId,
                    text: `${bp.name} (${bp.externalId})`,
                    externalId: bp.externalId,
                    name: bp.name
                });
            });

            businessPartners.sort((a, b) => a.text.localeCompare(b.text));
            return businessPartners;
        },

        /**
         * Clear cache.
         */
        clearCache() {
            this._businessPartnerCache.clear();
            this._loadingPromises.clear();
        }
    };
});