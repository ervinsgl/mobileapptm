sap.ui.define([], () => {
    "use strict";

    return {
        /**
         * Cache for business partner data
         * Key: externalId
         * Value: { externalId, name }
         */
        _businessPartnerCache: new Map(),
        _loadingPromises: new Map(), // Track ongoing loads to prevent duplicate requests

        /**
         * Get business partner display text by externalId
         * Loads from API on-demand if not in cache
         * Format: "Company Name (55003748)"
         */
        getBusinessPartnerDisplayTextByExternalId(externalId) {
            if (!externalId || externalId === 'N/A') return 'N/A';

            // Check cache first
            const cached = this._businessPartnerCache.get(externalId);
            if (cached) {
                return `${cached.name} (${cached.externalId})`;
            }

            // Not in cache - load asynchronously
            this._loadBusinessPartnerByExternalId(externalId);

            // Return externalId for now (will be updated when loaded)
            return externalId;
        },

        /**
         * Load business partner by externalId (async, caches result)
         */
        async _loadBusinessPartnerByExternalId(externalId) {
            if (!externalId) return;

            // Check if already loading
            if (this._loadingPromises.has(externalId)) {
                return this._loadingPromises.get(externalId);
            }

            // Create loading promise
            const promise = (async () => {
                try {
                    console.log('BusinessPartnerService: Loading business partner by externalId:', externalId);

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

                        // Cache by externalId
                        this._businessPartnerCache.set(businessPartner.externalId, bpData);

                        console.log('BusinessPartnerService: Loaded business partner:', bpData);
                    }

                } catch (error) {
                    console.error("BusinessPartnerService: Error loading business partner by externalId:", error);
                } finally {
                    this._loadingPromises.delete(externalId);
                }
            })();

            this._loadingPromises.set(externalId, promise);
            return promise;
        },

        /**
         * Preload specific business partners by externalId (for batch operations)
         * Returns promise that resolves when all loaded
         */
        async preloadBusinessPartnersByExternalId(externalIds) {
            if (!externalIds || externalIds.length === 0) return;

            console.log('BusinessPartnerService: Preloading', externalIds.length, 'business partners by externalId');

            const promises = externalIds
                .filter(id => id && id !== 'N/A' && !this._businessPartnerCache.has(id))
                .map(id => this._loadBusinessPartnerByExternalId(id));

            await Promise.allSettled(promises);
        },

        /**
         * Get business partner name only (from cache)
         */
        getBusinessPartnerNameByExternalId(externalId) {
            if (!externalId || externalId === 'N/A') return 'N/A';

            const businessPartner = this._businessPartnerCache.get(externalId);
            if (businessPartner) {
                return businessPartner.name;
            }

            return externalId; // Return externalId if not in cache
        },

        /**
         * Search business partners by name or externalId (cached data only)
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

            // Sort by name
            results.sort((a, b) => a.name.localeCompare(b.name));

            return results;
        },

        /**
         * Get all business partners for dropdown (cached data only)
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

            // Sort by text
            businessPartners.sort((a, b) => a.text.localeCompare(b.text));

            return businessPartners;
        },

        /**
         * Clear cache
         */
        clearCache() {
            this._businessPartnerCache.clear();
            this._loadingPromises.clear();
            console.log('BusinessPartnerService: Cache cleared');
        }
    };
});