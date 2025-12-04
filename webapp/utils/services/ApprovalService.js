/**
 * ApprovalService.js
 * 
 * Frontend service for T&M entry approval status management.
 * Handles fetching, caching, and displaying approval decision statuses.
 * 
 * Key Features:
 * - Batch fetch approval statuses for multiple T&M entries
 * - Cache statuses to avoid redundant API calls
 * - Convert status codes to display text and UI5 ValueStates
 * 
 * Decision Status Values:
 * - PENDING: Awaiting decision
 * - REVIEW: Under review
 * - APPROVED: Approved
 * - DECLINED: Declined
 * - APPROVED_CLOSED: Approved and closed
 * - DECLINED_CLOSED: Declined and closed
 * - CANCELLED: Cancelled
 * 
 * API Endpoint Used:
 * - POST /api/get-approval-status
 * 
 * @file ApprovalService.js
 * @module mobileappsc/utils/services/ApprovalService
 */
sap.ui.define([], () => {
    "use strict";

    return {
        /**
         * Cache for approval statuses.
         * @type {Map<string, string|null>}
         * @private
         */
        _statusCache: new Map(),

        /**
         * Fetch approval statuses for multiple T&M entry IDs.
         * Uses cache to avoid redundant API calls.
         * @param {string[]} objectIds - Array of T&M entry IDs
         * @returns {Promise<Object>} Map of objectId → decisionStatus
         */
        async fetchApprovalStatuses(objectIds) {
            if (!objectIds || objectIds.length === 0) {
                return {};
            }

            // Filter out IDs we already have cached
            const uncachedIds = objectIds.filter(id => !this._statusCache.has(id));

            if (uncachedIds.length > 0) {
                try {
                    const response = await fetch("/api/get-approval-status", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ objectIds: uncachedIds })
                    });

                    if (!response.ok) {
                        throw new Error(`Failed to fetch approval statuses: ${response.status}`);
                    }

                    const data = await response.json();
                    const statuses = data.statuses || {};

                    // Cache the results
                    Object.keys(statuses).forEach(id => {
                        this._statusCache.set(id, statuses[id]);
                    });

                    // Also cache null for IDs that had no approval record
                    uncachedIds.forEach(id => {
                        if (!this._statusCache.has(id)) {
                            this._statusCache.set(id, null);
                        }
                    });

                } catch (error) {
                    console.error("ApprovalService: Error fetching statuses:", error);
                    // Cache null for failed lookups to avoid repeated requests
                    uncachedIds.forEach(id => {
                        if (!this._statusCache.has(id)) {
                            this._statusCache.set(id, null);
                        }
                    });
                }
            }

            // Return all requested statuses from cache
            const result = {};
            objectIds.forEach(id => {
                result[id] = this._statusCache.get(id) || null;
            });
            return result;
        },

        /**
         * Get approval status for a single T&M entry ID from cache.
         * @param {string} objectId - T&M entry ID
         * @returns {string|null} Decision status or null if not found
         */
        getStatusById(objectId) {
            return this._statusCache.get(objectId) || null;
        },

        /**
         * Get human-readable display text for decision status.
         * @param {string} status - Decision status code
         * @returns {string} Human-readable status text
         */
        getStatusDisplayText(status) {
            if (!status) {
                return 'N/A';
            }

            const statusTexts = {
                'PENDING': 'Pending',
                'REVIEW': 'Under Review',
                'APPROVED': 'Approved',
                'DECLINED': 'Declined',
                'APPROVED_CLOSED': 'Approved (Closed)',
                'DECLINED_CLOSED': 'Declined (Closed)',
                'CANCELLED': 'Cancelled'
            };

            return statusTexts[status] || status;
        },

        /**
         * Get UI5 ValueState for decision status (for styling).
         * @param {string} status - Decision status code
         * @returns {string} UI5 ValueState (None, Success, Warning, Error, Information)
         */
        getStatusState(status) {
            if (!status) {
                return 'None';
            }

            const stateMap = {
                'PENDING': 'Warning',
                'REVIEW': 'Information',
                'APPROVED': 'Success',
                'DECLINED': 'Error',
                'APPROVED_CLOSED': 'Success',
                'DECLINED_CLOSED': 'Error',
                'CANCELLED': 'None'
            };

            return stateMap[status] || 'None';
        },

        /**
         * Preload approval statuses for an array of T&M reports.
         * @param {Array} reports - Array of T&M report objects with 'id' property
         * @returns {Promise<void>}
         */
        async preloadStatusesForReports(reports) {
            if (!reports || reports.length === 0) {
                return;
            }

            const objectIds = reports.map(report => report.id).filter(id => id);
            await this.fetchApprovalStatuses(objectIds);
        },

        /**
         * Clear the status cache.
         */
        clearCache() {
            this._statusCache.clear();
        }
    };
});