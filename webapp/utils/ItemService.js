sap.ui.define([], () => {
    "use strict";

    // Private cache for items
    let _itemsCache = null;
    let _itemsMapById = null;
    let _itemsMapByExternalId = null;

    return {
        /**
         * Fetch all items from backend (excluding tools and Z11% items)
         * Results are cached for the session
         * @returns {Promise<Array>} Array of item objects
         */
        async fetchItems() {
            // Return cached data if available
            if (_itemsCache) {
                console.log('ItemService: Returning cached items');
                return _itemsCache;
            }

            try {
                console.log('ItemService: Fetching items from API...');

                const response = await fetch("/api/get-items", {
                    method: "GET",
                    headers: { "Content-Type": "application/json" }
                });

                if (!response.ok) {
                    throw new Error(`Failed to fetch items: ${response.status}`);
                }

                const data = await response.json();
                _itemsCache = data.items || [];

                // Build lookup maps for quick resolution
                this._buildLookupMaps();

                console.log('ItemService: Loaded', _itemsCache.length, 'items');
                return _itemsCache;

            } catch (error) {
                console.error("ItemService: Error fetching items:", error);
                throw error;
            }
        },

        /**
         * Build internal lookup maps for ID and externalId resolution
         * @private
         */
        _buildLookupMaps() {
            _itemsMapById = new Map();
            _itemsMapByExternalId = new Map();
            
            if (_itemsCache) {
                _itemsCache.forEach(item => {
                    if (item.id) {
                        _itemsMapById.set(item.id, item);
                    }
                    if (item.externalId) {
                        _itemsMapByExternalId.set(item.externalId, item);
                    }
                });
            }
            
            console.log('ItemService: Built lookup maps -', _itemsMapById.size, 'by ID,', _itemsMapByExternalId.size, 'by externalId');
        },

        /**
         * Get item name by ID
         * @param {string} itemId - Item ID
         * @returns {string} Item name or the original ID if not found
         */
        getItemNameById(itemId) {
            if (!itemId || itemId === 'N/A') {
                return 'N/A';
            }

            if (!_itemsMapById) {
                console.warn('ItemService: Lookup maps not initialized. Call fetchItems() first.');
                return itemId;
            }

            const item = _itemsMapById.get(itemId);
            return item ? item.name : itemId;
        },

        /**
         * Get item name by external ID
         * @param {string} externalId - Item external ID
         * @returns {string} Item name or the original externalId if not found
         */
        getItemNameByExternalId(externalId) {
            if (!externalId || externalId === 'N/A') {
                return 'N/A';
            }

            if (!_itemsMapByExternalId) {
                console.warn('ItemService: Lookup maps not initialized. Call fetchItems() first.');
                return externalId;
            }

            const item = _itemsMapByExternalId.get(externalId);
            return item ? item.name : externalId;
        },

        /**
         * Get item display text (externalId - name) by ID
         * @param {string} itemId - Item ID
         * @returns {string} Formatted display text "externalId - name" or original ID
         */
        getItemDisplayTextById(itemId) {
            if (!itemId || itemId === 'N/A') {
                return 'N/A';
            }

            if (!_itemsMapById) {
                console.warn('ItemService: Lookup maps not initialized. Call fetchItems() first.');
                return itemId;
            }

            const item = _itemsMapById.get(itemId);
            if (item) {
                return `${item.externalId} - ${item.name}`;
            }
            return itemId;
        },

        /**
         * Get item display text (externalId - name) by external ID
         * @param {string} externalId - Item external ID
         * @returns {string} Formatted display text "externalId - name" or original externalId
         */
        getItemDisplayTextByExternalId(externalId) {
            if (!externalId || externalId === 'N/A') {
                return 'N/A';
            }

            if (!_itemsMapByExternalId) {
                console.warn('ItemService: Lookup maps not initialized. Call fetchItems() first.');
                return externalId;
            }

            const item = _itemsMapByExternalId.get(externalId);
            if (item) {
                return `${item.externalId} - ${item.name}`;
            }
            return externalId;
        },

        /**
         * Get full item object by ID
         * @param {string} itemId - Item ID
         * @returns {object|null} Item object or null
         */
        getItemById(itemId) {
            if (!itemId || !_itemsMapById) {
                return null;
            }
            return _itemsMapById.get(itemId) || null;
        },

        /**
         * Get full item object by external ID
         * @param {string} externalId - Item external ID
         * @returns {object|null} Item object or null
         */
        getItemByExternalId(externalId) {
            if (!externalId || !_itemsMapByExternalId) {
                return null;
            }
            return _itemsMapByExternalId.get(externalId) || null;
        },

        /**
         * Get all cached items
         * @returns {Array} Array of item objects
         */
        getAllItems() {
            return _itemsCache || [];
        },

        /**
         * Transform items for dropdown/select control
         * @returns {Array} Array of {key, text} objects for dropdown binding
         */
        getItemsForDropdown() {
            if (!_itemsCache) {
                return [];
            }

            return _itemsCache.map(item => ({
                key: item.id,
                text: `${item.externalId} - ${item.name}`,
                externalId: item.externalId,
                name: item.name
            }));
        },

        /**
         * Search items by name or externalId (client-side filtering)
         * @param {string} searchTerm - Search term
         * @returns {Array} Filtered array of items
         */
        searchItems(searchTerm) {
            if (!_itemsCache || !searchTerm) {
                return _itemsCache || [];
            }

            const lowerSearch = searchTerm.toLowerCase();
            return _itemsCache.filter(item => 
                (item.name && item.name.toLowerCase().includes(lowerSearch)) ||
                (item.externalId && item.externalId.toLowerCase().includes(lowerSearch))
            );
        },

        /**
         * Get all items formatted for Input suggestions
         * @returns {Array} Array of {id, externalId, name, displayText} objects
         */
        getAllForSuggestions() {
            if (!_itemsCache) {
                return [];
            }

            return _itemsCache.map(item => ({
                id: item.id,
                externalId: item.externalId,
                name: item.name,
                displayText: `${item.externalId} - ${item.name}`
            }));
        },

        /**
         * Filter items by search term for suggestions (optimized for liveChange)
         * @param {string} searchTerm - Search term (min 2 chars)
         * @returns {Array} Filtered array of suggestion items
         */
        filterBySearch(searchTerm) {
            if (!searchTerm || searchTerm.length < 2) {
                return [];
            }

            const lowerSearch = searchTerm.toLowerCase();
            const results = [];

            if (_itemsCache) {
                _itemsCache.forEach(item => {
                    const nameMatch = item.name && item.name.toLowerCase().includes(lowerSearch);
                    const externalIdMatch = item.externalId && item.externalId.toLowerCase().includes(lowerSearch);

                    if (nameMatch || externalIdMatch) {
                        results.push({
                            id: item.id,
                            externalId: item.externalId,
                            name: item.name,
                            displayText: `${item.externalId} - ${item.name}`
                        });
                    }
                });
            }

            // Sort by externalId
            results.sort((a, b) => a.externalId.localeCompare(b.externalId));

            // Limit results for performance
            return results.slice(0, 50);
        },

        /**
         * Get item by externalId for default value lookup
         * @param {string} externalId - Item external ID
         * @returns {object|null} Item suggestion object or null
         */
        getItemSuggestionByExternalId(externalId) {
            if (!externalId || !_itemsMapByExternalId) {
                return null;
            }
            
            const item = _itemsMapByExternalId.get(externalId);
            if (item) {
                return {
                    id: item.id,
                    externalId: item.externalId,
                    name: item.name,
                    displayText: `${item.externalId} - ${item.name}`
                };
            }
            return null;
        },

        /**
         * Check if items are loaded
         * @returns {boolean} True if cache is populated
         */
        isLoaded() {
            return _itemsCache !== null;
        },

        /**
         * Clear the cache (useful for refresh scenarios)
         */
        clearCache() {
            _itemsCache = null;
            _itemsMapById = null;
            _itemsMapByExternalId = null;
            console.log('ItemService: Cache cleared');
        }
    };
});