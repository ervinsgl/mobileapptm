/**
 * DateTimeService.js
 * 
 * Utility service for duration and datetime calculations.
 * Used by T&M entry forms (Time Effort, Mileage, Time & Material).
 * 
 * Key Features:
 * - Generate ISO datetime strings for FSM API
 * - Calculate end datetime from start + duration
 * - Calculate duration between two datetimes
 * - Handle model updates for datetime/duration changes
 * - Provide default values for new T&M entries
 * 
 * DateTime Format: ISO 8601 without milliseconds (e.g., "2025-11-28T12:30:00Z")
 * Date Format: yyyy-MM-dd (e.g., "2025-11-28")
 * 
 * @file DateTimeService.js
 * @module mobileappsc/utils/helpers/DateTimeService
 */
sap.ui.define([], () => {
    "use strict";

    return {
        
        /* =========================================================================
         * DATETIME STRING GENERATORS
         * ========================================================================= */

        /**
         * Get current datetime in ISO format for API.
         * @returns {string} ISO datetime string (e.g., "2025-11-28T12:30:00Z")
         */
        getNowDateTimeString() {
            const now = new Date();
            return now.toISOString().replace(/\.\d{3}Z$/, 'Z');
        },

        /**
         * Get datetime with offset in ISO format.
         * @param {number} offsetMinutes - Minutes to add (can be negative)
         * @returns {string} ISO datetime string
         */
        getDateTimeWithOffset(offsetMinutes) {
            const date = new Date();
            date.setMinutes(date.getMinutes() + offsetMinutes);
            return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
        },

        /**
         * Get today's date in yyyy-MM-dd format for API.
         * @returns {string} Date string (e.g., "2025-11-28")
         */
        getTodayDateString() {
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        },

        /* =========================================================================
         * DURATION CALCULATIONS
         * ========================================================================= */

        /**
         * Calculate end datetime from start datetime and duration.
         * @param {string} startDateTime - ISO datetime string
         * @param {number} durationMinutes - Duration in minutes
         * @returns {string} ISO datetime string for end
         */
        calculateEndDateTime(startDateTime, durationMinutes) {
            if (!startDateTime || durationMinutes === undefined) {
                return this.getDateTimeWithOffset(30);
            }
            const start = new Date(startDateTime);
            start.setMinutes(start.getMinutes() + durationMinutes);
            return start.toISOString().replace(/\.\d{3}Z$/, 'Z');
        },

        /**
         * Calculate duration in minutes between two datetimes.
         * @param {string} startDateTime - ISO datetime string
         * @param {string} endDateTime - ISO datetime string
         * @returns {number} Duration in minutes (minimum 0)
         */
        calculateDurationMinutes(startDateTime, endDateTime) {
            if (!startDateTime || !endDateTime) {
                return 30;
            }
            const start = new Date(startDateTime);
            const end = new Date(endDateTime);
            const diffMs = end - start;
            return Math.max(0, Math.round(diffMs / 60000));
        },

        /* =========================================================================
         * MODEL UPDATE HANDLERS
         * Used by controller event handlers
         * ========================================================================= */

        /**
         * Handle duration change - updates end datetime in model.
         * @param {sap.ui.model.json.JSONModel} oModel - Dialog model
         * @param {string} sPath - Entry path in model
         * @param {number} iDuration - New duration value
         * @param {string} sStartField - Start datetime field name
         * @param {string} sEndField - End datetime field name
         * @returns {string|null} New end datetime or null
         */
        handleDurationChange(oModel, sPath, iDuration, sStartField, sEndField) {
            const sStartDateTime = oModel.getProperty(sPath + "/" + sStartField);

            if (sStartDateTime && iDuration >= 0) {
                const sEndDateTime = this.calculateEndDateTime(sStartDateTime, iDuration);
                oModel.setProperty(sPath + "/" + sEndField, sEndDateTime);
                return sEndDateTime;
            }
            return null;
        },

        /**
         * Handle start datetime change - updates end datetime based on duration.
         * @param {sap.ui.model.json.JSONModel} oModel - Dialog model
         * @param {string} sPath - Entry path in model
         * @param {string} sStartField - Start datetime field name
         * @param {string} sDurationField - Duration field name
         * @param {string} sEndField - End datetime field name
         * @param {number} [iDefaultDuration=30] - Default duration if not set
         * @returns {string|null} New end datetime or null
         */
        handleStartDateTimeChange(oModel, sPath, sStartField, sDurationField, sEndField, iDefaultDuration) {
            const sStartDateTime = oModel.getProperty(sPath + "/" + sStartField);
            const iDuration = oModel.getProperty(sPath + "/" + sDurationField) || iDefaultDuration || 30;

            if (sStartDateTime) {
                const sEndDateTime = this.calculateEndDateTime(sStartDateTime, iDuration);
                oModel.setProperty(sPath + "/" + sEndField, sEndDateTime);
                return sEndDateTime;
            }
            return null;
        },

        /* =========================================================================
         * DEFAULT VALUES FOR ENTRY CREATION
         * ========================================================================= */

        /**
         * Get default datetime values for a new entry.
         * @param {number} [defaultDuration=30] - Default duration in minutes
         * @returns {{duration: number, startDateTime: string, endDateTime: string}}
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
         * Get default travel datetime values for Mileage entry.
         * @param {number} [defaultDuration=30] - Default duration in minutes
         * @returns {{travelDuration: number, travelStartDateTime: string, travelEndDateTime: string}}
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
         * Get default datetime values for Time & Material column.
         * @param {number} columnIndex - Column index (1, 2, or 3)
         * @param {number} [defaultDuration=30] - Default duration in minutes
         * @returns {Object} Object with duration{n}, startDateTime{n}, endDateTime{n}
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