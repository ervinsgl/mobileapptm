sap.ui.define([], () => {
    "use strict";

    return {
        /**
         * Format JSON object for display
         * @param {object} data - Data to format
         * @returns {string} Formatted JSON string
         */
        formatJSON(data) {
            if (!data) return "";
            return JSON.stringify(data, null, 2);
        },

        /**
         * Format datetime for display
         * @param {string} dateTime - ISO datetime string
         * @returns {string} Formatted datetime
         */
        formatDateTime(dateTime) {
            if (!dateTime) return "";
            try {
                return new Date(dateTime).toLocaleString();
            } catch (e) {
                return dateTime;
            }
        },

        /**
         * Format date for display
         * @param {string} date - ISO date string
         * @returns {string} Formatted date
         */
        formatDate(date) {
            if (!date) return "";
            try {
                return new Date(date).toLocaleDateString();
            } catch (e) {
                return date;
            }
        },

        /**
         * Format quantity (remove trailing zeros)
         * @param {string|number} quantity - Quantity value
         * @returns {number} Formatted quantity
         */
        formatQuantity(quantity) {
            if (!quantity) return 0;
            return parseFloat(quantity);
        },

        /**
         * Format amount (remove trailing zeros)
         * @param {string|number} amount - Amount value
         * @returns {number} Formatted amount
         */
        formatAmount(amount) {
            if (!amount) return 0;
            return parseFloat(amount);
        },

        /**
         * Format distance (remove trailing zeros)
         * @param {string|number} distance - Distance value
         * @returns {number} Formatted distance
         */
        formatDistance(distance) {
            if (!distance) return 0;
            return parseFloat(distance);
        }
    };
});