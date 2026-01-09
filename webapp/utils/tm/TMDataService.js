/**
 * TMDataService.js
 * 
 * Frontend service for loading and managing T&M report data.
 * Handles batch loading and model updates for activity T&M reports.
 * 
 * Key Features:
 * - Load T&M reports for single activity
 * - Batch load with chunking and rate limiting
 * - Update activity model with T&M counts
 * - Loading/error state management
 * 
 * T&M Report Types:
 * - Time Effort
 * - Material
 * - Expense
 * - Mileage
 * 
 * @file TMDataService.js
 * @module mobileappsc/utils/tm/TMDataService
 * @requires mobileappsc/utils/helpers/ReportedItemsData
 */
sap.ui.define([
    "mobileappsc/utils/helpers/ReportedItemsData"
], (ReportedItemsData) => {
    "use strict";

    return {
        /**
         * Load T&M reports for a single activity.
         * @param {string} activityId - Activity ID
         * @returns {Promise<{reports: Array, totalCount: number, counts: Object}>} T&M reports with counts
         */
        async loadTMReports(activityId) {
            try {
                const reports = await ReportedItemsData.getReportedItems(activityId);

                return {
                    reports,
                    totalCount: reports.length,
                    counts: {
                        timeEffort: reports.filter(r => r.type === "Time Effort").length,
                        material: reports.filter(r => r.type === "Material").length,
                        expense: reports.filter(r => r.type === "Expense").length,
                        mileage: reports.filter(r => r.type === "Mileage").length
                    }
                };
            } catch (error) {
                console.error("TMDataService: Error loading T&M reports:", error);
                throw error;
            }
        },

        /**
         * Update activity model with T&M data.
         * @param {sap.ui.model.json.JSONModel} model - View model
         * @param {string} activityPath - Path to activity in model
         * @param {Object} tmData - T&M data object from loadTMReports
         */
        updateActivityWithTMData(model, activityPath, tmData) {
            const updates = {
                [`${activityPath}/tmReports`]: tmData.reports,
                [`${activityPath}/tmReportsCount`]: tmData.totalCount,
                [`${activityPath}/tmReportsLoaded`]: true,
                [`${activityPath}/tmReportsLoading`]: false,
                [`${activityPath}/tmReportsLoadingState`]: 'loaded',
                [`${activityPath}/tmTimeEffortCount`]: tmData.counts.timeEffort,
                [`${activityPath}/tmMaterialCount`]: tmData.counts.material,
                [`${activityPath}/tmExpenseCount`]: tmData.counts.expense,
                [`${activityPath}/tmMileageCount`]: tmData.counts.mileage
            };

            Object.keys(updates).forEach(path => {
                model.setProperty(path, updates[path]);
            });
        },

        /**
         * Set loading state for activity.
         * @param {sap.ui.model.json.JSONModel} model - View model
         * @param {string} activityPath - Path to activity in model
         * @param {boolean} isLoading - Loading state
         */
        setLoadingState(model, activityPath, isLoading) {
            model.setProperty(`${activityPath}/tmReportsLoading`, isLoading);
            model.setProperty(`${activityPath}/tmReportsLoadingState`, isLoading ? 'loading' : 'loaded');
        },

        /**
         * Set error state for activity.
         * @param {sap.ui.model.json.JSONModel} model - View model
         * @param {string} activityPath - Path to activity in model
         */
        setErrorState(model, activityPath) {
            model.setProperty(`${activityPath}/tmReportsLoadingState`, 'error');
            model.setProperty(`${activityPath}/tmReportsLoading`, false);
            model.setProperty(`${activityPath}/tmReportsCount`, 0);
        }
    };
});