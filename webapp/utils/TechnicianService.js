sap.ui.define([
    "mobileappsc/utils/PersonService"
], (PersonService) => {
    "use strict";

    return {
        /**
         * Flag to track if persons are loaded
         */
        _isLoaded: false,
        _isLoading: false,
        _loadPromise: null,

        /**
         * Cached persons array for quick filtering
         * Stored separately for performance (avoid Map iteration)
         */
        _personsArray: [],

        /**
         * Initialize and load all persons (call once on app start or dialog open)
         * @returns {Promise<void>}
         */
        async initialize() {
            if (this._isLoaded) {
                console.log('TechnicianService: Already loaded');
                return;
            }

            if (this._isLoading) {
                console.log('TechnicianService: Already loading, waiting...');
                return this._loadPromise;
            }

            this._isLoading = true;
            this._loadPromise = this._loadPersons();
            
            try {
                await this._loadPromise;
                this._isLoaded = true;
            } finally {
                this._isLoading = false;
            }
        },

        /**
         * Load all persons and build optimized array
         * @private
         */
        async _loadPersons() {
            try {
                console.log('TechnicianService: Loading all persons...');
                
                await PersonService.loadAllPersons();
                
                // Build optimized array from PersonService cache
                this._buildPersonsArray();
                
                console.log('TechnicianService: Loaded', this._personsArray.length, 'technicians');
                
            } catch (error) {
                console.error('TechnicianService: Failed to load persons:', error);
                throw error;
            }
        },

        /**
         * Build optimized array from PersonService cache
         * @private
         */
        _buildPersonsArray() {
            this._personsArray = [];
            const seenIds = new Set();

            PersonService._personCache.forEach((person, key) => {
                // Only add each person once (by ID, not externalId duplicate)
                if (key === person.id && !seenIds.has(person.id)) {
                    seenIds.add(person.id);
                    
                    // Pre-compute search text for faster filtering
                    const searchText = [
                        person.firstName || '',
                        person.lastName || '',
                        person.externalId || '',
                        person.fullName || ''
                    ].join(' ').toLowerCase();

                    this._personsArray.push({
                        id: person.id,
                        externalId: person.externalId,
                        firstName: person.firstName,
                        lastName: person.lastName,
                        fullName: person.fullName,
                        displayText: person.externalId 
                            ? `${person.firstName} ${person.lastName} (${person.externalId})`
                            : `${person.firstName} ${person.lastName}`,
                        searchText: searchText
                    });
                }
            });

            // Sort by firstName for consistent display
            this._personsArray.sort((a, b) => {
                const nameA = (a.firstName || '').toLowerCase();
                const nameB = (b.firstName || '').toLowerCase();
                return nameA.localeCompare(nameB);
            });
        },

        /**
         * Search technicians with optimized filtering
         * Returns max 50 results for performance
         * @param {string} searchTerm - Search term (min 2 chars)
         * @returns {Array} Filtered array of technicians
         */
        searchTechnicians(searchTerm) {
            if (!this._isLoaded) {
                console.warn('TechnicianService: Not loaded yet');
                return [];
            }

            if (!searchTerm || searchTerm.length < 2) {
                // Return first 50 for initial display
                return this._personsArray.slice(0, 50);
            }

            const term = searchTerm.toLowerCase();
            const results = [];
            const maxResults = 50;

            // Optimized search - stop early when we have enough results
            for (let i = 0; i < this._personsArray.length && results.length < maxResults; i++) {
                const person = this._personsArray[i];
                if (person.searchText.includes(term)) {
                    results.push(person);
                }
            }

            return results;
        },

        /**
         * Get technician by ID
         * @param {string} technicianId - Person ID
         * @returns {object|null} Technician object or null
         */
        getTechnicianById(technicianId) {
            if (!technicianId || !this._isLoaded) return null;
            return this._personsArray.find(p => p.id === technicianId) || null;
        },

        /**
         * Get technician by externalId
         * @param {string} externalId - Person external ID
         * @returns {object|null} Technician object or null
         */
        getTechnicianByExternalId(externalId) {
            if (!externalId || !this._isLoaded) return null;
            return this._personsArray.find(p => p.externalId === externalId) || null;
        },

        /**
         * Get technician display text by ID (for showing in UI)
         * @param {string} technicianId - Person ID
         * @returns {string} Display text or 'N/A'
         */
        getDisplayTextById(technicianId) {
            const technician = this.getTechnicianById(technicianId);
            return technician ? technician.displayText : 'N/A';
        },

        /**
         * Get default technician from activity responsible
         * @param {string} responsibleExternalId - Activity responsible external ID
         * @returns {object|null} Technician object or null
         */
        getDefaultTechnician(responsibleExternalId) {
            if (!responsibleExternalId || responsibleExternalId === 'N/A') {
                return null;
            }
            return this.getTechnicianByExternalId(responsibleExternalId);
        },

        /**
         * Check if service is ready
         * @returns {boolean}
         */
        isReady() {
            return this._isLoaded;
        },

        /**
         * Get all technicians for dropdown (limited to first 100)
         * @returns {Array} Array of technician objects
         */
        getAllForDropdown() {
            if (!this._isLoaded) return [];
            return this._personsArray.slice(0, 100);
        },

        /**
         * Get total count of loaded technicians
         * @returns {number}
         */
        getTotalCount() {
            return this._personsArray.length;
        },

        /**
         * Clear cache and reset state
         */
        clearCache() {
            this._isLoaded = false;
            this._isLoading = false;
            this._loadPromise = null;
            this._personsArray = [];
            console.log('TechnicianService: Cache cleared');
        }
    };
});