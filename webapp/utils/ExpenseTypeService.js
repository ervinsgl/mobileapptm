sap.ui.define([], () => {
    "use strict";

    // Private cache for expense types
    let _expenseTypesCache = null;
    let _expenseTypesMap = null;

    return {
        /**
         * Fetch all expense types from backend
         * Results are cached for the session
         * @returns {Promise<Array>} Array of expense type objects
         */
        async fetchExpenseTypes() {
            // Return cached data if available
            if (_expenseTypesCache) {
                console.log('ExpenseTypeService: Returning cached expense types');
                return _expenseTypesCache;
            }

            try {
                console.log('ExpenseTypeService: Fetching expense types from API...');

                const response = await fetch("/api/get-expense-types", {
                    method: "GET",
                    headers: { "Content-Type": "application/json" }
                });

                if (!response.ok) {
                    throw new Error(`Failed to fetch expense types: ${response.status}`);
                }

                const data = await response.json();
                _expenseTypesCache = data.expenseTypes || [];

                // Build lookup map for quick ID-to-name resolution
                this._buildLookupMap();

                console.log('ExpenseTypeService: Loaded', _expenseTypesCache.length, 'expense types');
                return _expenseTypesCache;

            } catch (error) {
                console.error("ExpenseTypeService: Error fetching expense types:", error);
                throw error;
            }
        },

        /**
         * Build internal lookup map for ID-to-name resolution
         * @private
         */
        _buildLookupMap() {
            _expenseTypesMap = new Map();
            
            if (_expenseTypesCache) {
                _expenseTypesCache.forEach(expenseType => {
                    _expenseTypesMap.set(expenseType.id, expenseType);
                });
            }
            
            console.log('ExpenseTypeService: Built lookup map with', _expenseTypesMap.size, 'entries');
        },

        /**
         * Get expense type name by ID
         * @param {string} expenseTypeId - Expense type ID
         * @returns {string} Expense type name or 'N/A' if not found
         */
        getExpenseTypeNameById(expenseTypeId) {
            if (!expenseTypeId || expenseTypeId === 'N/A') {
                return 'N/A';
            }

            if (!_expenseTypesMap) {
                console.warn('ExpenseTypeService: Lookup map not initialized. Call fetchExpenseTypes() first.');
                return expenseTypeId; // Return ID as fallback
            }

            const expenseType = _expenseTypesMap.get(expenseTypeId);
            return expenseType ? expenseType.name : expenseTypeId; // Return ID as fallback if not found
        },

        /**
         * Get expense type display text (code - name) by ID
         * @param {string} expenseTypeId - Expense type ID
         * @returns {string} Formatted display text "code - name" or 'N/A'
         */
        getExpenseTypeDisplayTextById(expenseTypeId) {
            if (!expenseTypeId || expenseTypeId === 'N/A') {
                return 'N/A';
            }

            if (!_expenseTypesMap) {
                console.warn('ExpenseTypeService: Lookup map not initialized. Call fetchExpenseTypes() first.');
                return expenseTypeId;
            }

            const expenseType = _expenseTypesMap.get(expenseTypeId);
            if (expenseType) {
                return `${expenseType.code} - ${expenseType.name}`;
            }
            return expenseTypeId; // Return ID as fallback
        },

        /**
         * Get full expense type object by ID
         * @param {string} expenseTypeId - Expense type ID
         * @returns {object|null} Expense type object or null
         */
        getExpenseTypeById(expenseTypeId) {
            if (!expenseTypeId || !_expenseTypesMap) {
                return null;
            }
            return _expenseTypesMap.get(expenseTypeId) || null;
        },

        /**
         * Get all cached expense types
         * @returns {Array} Array of expense type objects
         */
        getAllExpenseTypes() {
            return _expenseTypesCache || [];
        },

        /**
         * Transform expense types for dropdown/select control
         * @returns {Array} Array of {key, text} objects for dropdown binding
         */
        getExpenseTypesForDropdown() {
            if (!_expenseTypesCache) {
                return [];
            }

            return _expenseTypesCache.map(expenseType => ({
                key: expenseType.id,
                text: `${expenseType.code} - ${expenseType.name}`,
                code: expenseType.code,
                name: expenseType.name
            }));
        },

        /**
         * Check if expense types are loaded
         * @returns {boolean} True if cache is populated
         */
        isLoaded() {
            return _expenseTypesCache !== null;
        },

        /**
         * Clear the cache (useful for refresh scenarios)
         */
        clearCache() {
            _expenseTypesCache = null;
            _expenseTypesMap = null;
            console.log('ExpenseTypeService: Cache cleared');
        }
    };
});