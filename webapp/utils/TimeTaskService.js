sap.ui.define([], () => {
    "use strict";

    // Private cache for time tasks
    let _timeTasksCache = null;
    let _timeTasksMap = null;

    return {
        /**
         * Fetch all time tasks from backend
         * Results are cached for the session
         * @returns {Promise<Array>} Array of time task objects
         */
        async fetchTimeTasks() {
            // Return cached data if available
            if (_timeTasksCache) {
                console.log('TimeTaskService: Returning cached time tasks');
                return _timeTasksCache;
            }

            try {
                console.log('TimeTaskService: Fetching time tasks from API...');

                const response = await fetch("/api/get-time-tasks", {
                    method: "GET",
                    headers: { "Content-Type": "application/json" }
                });

                if (!response.ok) {
                    throw new Error(`Failed to fetch time tasks: ${response.status}`);
                }

                const data = await response.json();
                _timeTasksCache = data.timeTasks || [];

                // Build lookup map for quick ID-to-name resolution
                this._buildLookupMap();

                console.log('TimeTaskService: Loaded', _timeTasksCache.length, 'time tasks');
                return _timeTasksCache;

            } catch (error) {
                console.error("TimeTaskService: Error fetching time tasks:", error);
                throw error;
            }
        },

        /**
         * Build internal lookup map for ID-to-name resolution
         * @private
         */
        _buildLookupMap() {
            _timeTasksMap = new Map();
            
            if (_timeTasksCache) {
                _timeTasksCache.forEach(task => {
                    _timeTasksMap.set(task.id, task);
                });
            }
            
            console.log('TimeTaskService: Built lookup map with', _timeTasksMap.size, 'entries');
        },

        /**
         * Get time task name by ID
         * @param {string} taskId - Time task ID
         * @returns {string} Time task name or 'N/A' if not found
         */
        getTaskNameById(taskId) {
            if (!taskId || taskId === 'N/A') {
                return 'N/A';
            }

            if (!_timeTasksMap) {
                console.warn('TimeTaskService: Lookup map not initialized. Call fetchTimeTasks() first.');
                return taskId; // Return ID as fallback
            }

            const task = _timeTasksMap.get(taskId);
            return task ? task.name : taskId; // Return ID as fallback if not found
        },

        /**
         * Get time task display text (code + name) by ID
         * @param {string} taskId - Time task ID
         * @returns {string} Formatted display text "code - name" or 'N/A'
         */
        getTaskDisplayTextById(taskId) {
            if (!taskId || taskId === 'N/A') {
                return 'N/A';
            }

            if (!_timeTasksMap) {
                console.warn('TimeTaskService: Lookup map not initialized. Call fetchTimeTasks() first.');
                return taskId;
            }

            const task = _timeTasksMap.get(taskId);
            if (task) {
                return `${task.code} - ${task.name}`;
            }
            return taskId; // Return ID as fallback
        },

        /**
         * Get full time task object by ID
         * @param {string} taskId - Time task ID
         * @returns {object|null} Time task object or null
         */
        getTaskById(taskId) {
            if (!taskId || !_timeTasksMap) {
                return null;
            }
            return _timeTasksMap.get(taskId) || null;
        },

        /**
         * Get all cached time tasks
         * @returns {Array} Array of time task objects
         */
        getAllTasks() {
            return _timeTasksCache || [];
        },

        /**
         * Transform time tasks for dropdown/select control
         * @returns {Array} Array of {key, text} objects for dropdown binding
         */
        getTasksForDropdown() {
            if (!_timeTasksCache) {
                return [];
            }

            return _timeTasksCache.map(task => ({
                key: task.id,
                text: `${task.code} - ${task.name}`,
                code: task.code,
                name: task.name
            }));
        },

        /**
         * Check if time tasks are loaded
         * @returns {boolean} True if cache is populated
         */
        isLoaded() {
            return _timeTasksCache !== null;
        },

        /**
         * Clear the cache (useful for refresh scenarios)
         */
        clearCache() {
            _timeTasksCache = null;
            _timeTasksMap = null;
            console.log('TimeTaskService: Cache cleared');
        }
    };
});