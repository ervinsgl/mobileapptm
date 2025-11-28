sap.ui.define([], () => {
    "use strict";

    /**
     * DateTimeService - Utility service for Duration and DateTime calculations
     * Used by T&M entry forms (Time Effort, Mileage, Time & Material)
     * 
     * Handles:
     * - DateTime string generation (ISO format)
     * - Duration calculations
     * - End datetime calculations based on start + duration
     */
    return {
        
        /* ========================================
         * DATETIME STRING GENERATORS
         * ======================================== */

        /**
         * Get current datetime in ISO format for API
         * @returns {string} ISO datetime string like "2025-11-28T12:30:00Z"
         */
        getNowDateTimeString() {
            const now = new Date();
            return now.toISOString().replace(/\.\d{3}Z$/, 'Z'); // Remove milliseconds
        },

        /**
         * Get datetime + offset minutes in ISO format
         * @param {number} offsetMinutes - Minutes to add (can be negative)
         * @returns {string} ISO datetime string
         */
        getDateTimeWithOffset(offsetMinutes) {
            const date = new Date();
            date.setMinutes(date.getMinutes() + offsetMinutes);
            return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
        },

        /**
         * Get today's date in yyyy-MM-dd format for API
         * @returns {string} Date string like "2025-11-28"
         */
        getTodayDateString() {
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        },

        /* ========================================
         * DURATION CALCULATIONS
         * ======================================== */

        /**
         * Calculate end datetime from start datetime and duration
         * @param {string} startDateTime - ISO datetime string
         * @param {number} durationMinutes - Duration in minutes
         * @returns {string} ISO datetime string for end
         */
        calculateEndDateTime(startDateTime, durationMinutes) {
            if (!startDateTime || durationMinutes === undefined) {
                return this.getDateTimeWithOffset(30); // Default 30 min from now
            }
            const start = new Date(startDateTime);
            start.setMinutes(start.getMinutes() + durationMinutes);
            return start.toISOString().replace(/\.\d{3}Z$/, 'Z');
        },

        /**
         * Calculate duration in minutes between two datetimes
         * @param {string} startDateTime - ISO datetime string
         * @param {string} endDateTime - ISO datetime string
         * @returns {number} Duration in minutes (minimum 0)
         */
        calculateDurationMinutes(startDateTime, endDateTime) {
            if (!startDateTime || !endDateTime) {
                return 30; // Default
            }
            const start = new Date(startDateTime);
            const end = new Date(endDateTime);
            const diffMs = end - start;
            return Math.max(0, Math.round(diffMs / 60000)); // Convert to minutes, min 0
        },

        /* ========================================
         * MODEL UPDATE HANDLERS
         * Used by controller event handlers
         * ======================================== */

        /**
         * Handle duration change - updates end datetime in model
         * @param {sap.ui.model.json.JSONModel} oModel - Dialog model
         * @param {string} sPath - Entry path in model
         * @param {number} iDuration - New duration value
         * @param {string} sStartField - Start datetime field name (e.g., "startDateTime")
         * @param {string} sEndField - End datetime field name (e.g., "endDateTime")
         */
        handleDurationChange(oModel, sPath, iDuration, sStartField, sEndField) {
            const sStartDateTime = oModel.getProperty(sPath + "/" + sStartField);

            if (sStartDateTime && iDuration >= 0) {
                const sEndDateTime = this.calculateEndDateTime(sStartDateTime, iDuration);
                oModel.setProperty(sPath + "/" + sEndField, sEndDateTime);
                console.log('DateTimeService: Duration changed:', iDuration, 'min -> End:', sEndDateTime);
                return sEndDateTime;
            }
            return null;
        },

        /**
         * Handle start datetime change - updates end datetime based on duration
         * @param {sap.ui.model.json.JSONModel} oModel - Dialog model
         * @param {string} sPath - Entry path in model
         * @param {string} sStartField - Start datetime field name
         * @param {string} sDurationField - Duration field name
         * @param {string} sEndField - End datetime field name
         * @param {number} iDefaultDuration - Default duration if not set (default: 30)
         */
        handleStartDateTimeChange(oModel, sPath, sStartField, sDurationField, sEndField, iDefaultDuration) {
            const sStartDateTime = oModel.getProperty(sPath + "/" + sStartField);
            const iDuration = oModel.getProperty(sPath + "/" + sDurationField) || iDefaultDuration || 30;

            if (sStartDateTime) {
                const sEndDateTime = this.calculateEndDateTime(sStartDateTime, iDuration);
                oModel.setProperty(sPath + "/" + sEndField, sEndDateTime);
                console.log('DateTimeService: Start changed:', sStartDateTime, '+ Duration:', iDuration, '-> End:', sEndDateTime);
                return sEndDateTime;
            }
            return null;
        },

        /* ========================================
         * DEFAULT VALUES FOR ENTRY CREATION
         * ======================================== */

        /**
         * Get default datetime values for a new entry
         * @param {number} defaultDuration - Default duration in minutes (default: 30)
         * @returns {object} Object with duration, startDateTime, endDateTime
         */
        getDefaultDateTimeValues(defaultDuration) {
            const duration = defaultDuration || 30;
            return {
                duration: duration,
                startDateTime: this.getNowDateTimeString(),
                endDateTime: this.getDateTimeWithOffset(duration)
            };
        },

        /**
         * Get default travel datetime values for Mileage entry
         * @param {number} defaultDuration - Default duration in minutes (default: 30)
         * @returns {object} Object with travelDuration, travelStartDateTime, travelEndDateTime
         */
        getDefaultTravelDateTimeValues(defaultDuration) {
            const duration = defaultDuration || 30;
            return {
                travelDuration: duration,
                travelStartDateTime: this.getNowDateTimeString(),
                travelEndDateTime: this.getDateTimeWithOffset(duration)
            };
        },

        /**
         * Get default datetime values for Time & Material column
         * @param {number} columnIndex - Column index (1, 2, or 3)
         * @param {number} defaultDuration - Default duration in minutes (default: 30)
         * @returns {object} Object with duration{n}, startDateTime{n}, endDateTime{n}
         */
        getDefaultColumnDateTimeValues(columnIndex, defaultDuration) {
            const duration = defaultDuration || 30;
            const n = columnIndex;
            return {
                [`duration${n}`]: duration,
                [`startDateTime${n}`]: this.getNowDateTimeString(),
                [`endDateTime${n}`]: this.getDateTimeWithOffset(duration)
            };
        }
    };
});