sap.ui.define([], () => {
    "use strict";

    return {
        /**
         * Cache for person data
         * Key: person ID or externalId
         * Value: { id, externalId, firstName, lastName, fullName }
         */
        _personCache: new Map(),
        _loadingPromises: new Map(), // Track ongoing loads to prevent duplicate requests

        /**
         * Get person display text by ID
         * Loads from API on-demand if not in cache
         * Format: "First Last (ZZ00094912)"
         */
        getPersonDisplayTextById(personId) {
            if (!personId || personId === 'N/A') return 'N/A';

            // Check cache first
            const cached = this._personCache.get(personId);
            if (cached) {
                return cached.externalId 
                    ? `${cached.fullName} (${cached.externalId})`
                    : cached.fullName;
            }

            // Not in cache - load asynchronously
            this._loadPersonById(personId);

            // Return ID for now (will be updated when loaded)
            return personId;
        },

        /**
         * Get person display text by externalId
         * Loads from API on-demand if not in cache
         * Format: "First Last (ZZ00094912)"
         */
        getPersonDisplayTextByExternalId(externalId) {
            if (!externalId || externalId === 'N/A') return 'N/A';

            // Check cache first
            const cached = this._personCache.get(externalId);
            if (cached) {
                return `${cached.fullName} (${cached.externalId})`;
            }

            // Not in cache - load asynchronously
            this._loadPersonByExternalId(externalId);

            // Return externalId for now (will be updated when loaded)
            return externalId;
        },

        /**
         * Load person by ID (async, caches result)
         */
        async _loadPersonById(personId) {
            if (!personId) return;

            // Check if already loading
            if (this._loadingPromises.has(personId)) {
                return this._loadingPromises.get(personId);
            }

            // Create loading promise
            const promise = (async () => {
                try {
                    console.log('PersonService: Loading person by ID:', personId);

                    const response = await fetch("/api/get-person-by-id", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ personId })
                    });

                    if (!response.ok) {
                        throw new Error(`Failed to load person: ${response.status}`);
                    }

                    const data = await response.json();
                    const person = data.person;

                    if (person) {
                        const personData = {
                            id: person.id,
                            externalId: person.externalId,
                            firstName: person.firstName,
                            lastName: person.lastName,
                            fullName: this._formatFullName(person.firstName, person.lastName)
                        };

                        // Cache by ID
                        this._personCache.set(person.id, personData);
                        
                        // Cache by externalId
                        if (person.externalId) {
                            this._personCache.set(person.externalId, personData);
                        }

                        console.log('PersonService: Loaded person:', personData);
                    }

                } catch (error) {
                    console.error("PersonService: Error loading person by ID:", error);
                } finally {
                    this._loadingPromises.delete(personId);
                }
            })();

            this._loadingPromises.set(personId, promise);
            return promise;
        },

        /**
         * Load person by externalId (async, caches result)
         */
        async _loadPersonByExternalId(externalId) {
            if (!externalId) return;

            // Check if already loading
            if (this._loadingPromises.has(externalId)) {
                return this._loadingPromises.get(externalId);
            }

            // Create loading promise
            const promise = (async () => {
                try {
                    console.log('PersonService: Loading person by externalId:', externalId);

                    const response = await fetch("/api/get-person-by-external-id", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ externalId })
                    });

                    if (!response.ok) {
                        throw new Error(`Failed to load person: ${response.status}`);
                    }

                    const data = await response.json();
                    const person = data.person;

                    if (person) {
                        const personData = {
                            id: person.id,
                            externalId: person.externalId,
                            firstName: person.firstName,
                            lastName: person.lastName,
                            fullName: this._formatFullName(person.firstName, person.lastName)
                        };

                        // Cache by ID
                        this._personCache.set(person.id, personData);
                        
                        // Cache by externalId
                        if (person.externalId) {
                            this._personCache.set(person.externalId, personData);
                        }

                        console.log('PersonService: Loaded person:', personData);
                    }

                } catch (error) {
                    console.error("PersonService: Error loading person by externalId:", error);
                } finally {
                    this._loadingPromises.delete(externalId);
                }
            })();

            this._loadingPromises.set(externalId, promise);
            return promise;
        },

        /**
         * Preload specific persons by ID (for batch operations)
         * Returns promise that resolves when all loaded
         */
        async preloadPersonsById(personIds) {
            if (!personIds || personIds.length === 0) return;

            console.log('PersonService: Preloading', personIds.length, 'persons by ID');

            const promises = personIds
                .filter(id => id && id !== 'N/A' && !this._personCache.has(id))
                .map(id => this._loadPersonById(id));

            await Promise.allSettled(promises);
        },

        /**
         * Preload specific persons by externalId (for batch operations)
         * Returns promise that resolves when all loaded
         */
        async preloadPersonsByExternalId(externalIds) {
            if (!externalIds || externalIds.length === 0) return;

            console.log('PersonService: Preloading', externalIds.length, 'persons by externalId');

            const promises = externalIds
                .filter(id => id && id !== 'N/A' && !this._personCache.has(id))
                .map(id => this._loadPersonByExternalId(id));

            await Promise.allSettled(promises);
        },

        /**
         * Load all persons from FSM API (for dropdown/search - use sparingly!)
         * Only call when needed for full person list (e.g., search functionality)
         */
        async loadAllPersons() {
            console.log('PersonService: Loading all persons (4000+ records)...');

            try {
                const response = await fetch("/api/get-persons", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ loadAll: true })
                });

                if (!response.ok) {
                    throw new Error(`Failed to load persons: ${response.status}`);
                }

                const data = await response.json();
                const persons = data.persons || [];

                console.log(`PersonService: Loaded ${persons.length} persons`);

                // Cache all persons
                persons.forEach(person => {
                    const personData = {
                        id: person.id,
                        externalId: person.externalId,
                        firstName: person.firstName,
                        lastName: person.lastName,
                        fullName: this._formatFullName(person.firstName, person.lastName)
                    };

                    // Cache by ID
                    this._personCache.set(person.id, personData);
                    
                    // Cache by externalId
                    if (person.externalId) {
                        this._personCache.set(person.externalId, personData);
                    }
                });

            } catch (error) {
                console.error("PersonService: Error loading all persons:", error);
                throw error;
            }
        },

        /**
         * Format full name
         */
        _formatFullName(firstName, lastName) {
            const parts = [];
            if (firstName) parts.push(firstName);
            if (lastName) parts.push(lastName);
            return parts.length > 0 ? parts.join(' ') : 'Unknown';
        },

        /**
         * Search persons by name or externalId (requires loadAllPersons first)
         */
        searchPersons(searchTerm) {
            if (!searchTerm || searchTerm.length < 2) {
                return [];
            }

            const term = searchTerm.toLowerCase();
            const results = [];

            this._personCache.forEach((person, key) => {
                // Only search by actual person objects (not duplicate externalId keys)
                if (key === person.id) {
                    const fullNameMatch = person.fullName.toLowerCase().includes(term);
                    const externalIdMatch = person.externalId && person.externalId.toLowerCase().includes(term);
                    const firstNameMatch = person.firstName && person.firstName.toLowerCase().includes(term);
                    const lastNameMatch = person.lastName && person.lastName.toLowerCase().includes(term);

                    if (fullNameMatch || externalIdMatch || firstNameMatch || lastNameMatch) {
                        results.push({
                            id: person.id,
                            externalId: person.externalId,
                            fullName: person.fullName,
                            displayText: person.externalId 
                                ? `${person.fullName} (${person.externalId})`
                                : person.fullName
                        });
                    }
                }
            });

            // Sort by fullName
            results.sort((a, b) => a.fullName.localeCompare(b.fullName));

            return results;
        },

        /**
         * Get all persons for dropdown (cached data only)
         */
        getAllPersonsForDropdown() {
            const persons = [];

            this._personCache.forEach((person, key) => {
                // Only include actual person objects (not duplicate externalId keys)
                if (key === person.id) {
                    persons.push({
                        key: person.id,
                        text: person.externalId 
                            ? `${person.fullName} (${person.externalId})`
                            : person.fullName,
                        externalId: person.externalId,
                        fullName: person.fullName
                    });
                }
            });

            // Sort by text
            persons.sort((a, b) => a.text.localeCompare(b.text));

            return persons;
        },

        /**
         * Clear cache
         */
        clearCache() {
            this._personCache.clear();
            this._loadingPromises.clear();
            console.log('PersonService: Cache cleared');
        }
    };
});