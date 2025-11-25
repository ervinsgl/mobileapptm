sap.ui.define([
    "mobileappsc/utils/ReportedItemsData"
], (ReportedItemsData) => {
    "use strict";

    return {
        /**
         * Load T&M reports for a single activity
         * @param {string} activityId - Activity ID
         * @returns {Promise<object>} T&M reports with counts
         */
        async loadTMReports(activityId) {
            try {
                console.log('TMDataService: Loading T&M for activity:', activityId);

                const reports = await ReportedItemsData.getReportedItems(activityId);

                // Calculate counts by type
                const timeEffortCount = reports.filter(r => r.type === "Time Effort").length;
                const materialCount = reports.filter(r => r.type === "Material").length;
                const expenseCount = reports.filter(r => r.type === "Expense").length;
                const mileageCount = reports.filter(r => r.type === "Mileage").length;

                return {
                    reports,
                    totalCount: reports.length,
                    counts: {
                        timeEffort: timeEffortCount,
                        material: materialCount,
                        expense: expenseCount,
                        mileage: mileageCount
                    }
                };
            } catch (error) {
                console.error("TMDataService: Error loading T&M reports:", error);
                throw error;
            }
        },

        /**
         * Update activity model with T&M data
         * @param {sap.ui.model.json.JSONModel} model - View model
         * @param {string} activityPath - Path to activity in model
         * @param {object} tmData - T&M data object
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

            // Apply all updates at once
            Object.keys(updates).forEach(path => {
                model.setProperty(path, updates[path]);
            });
        },

        /**
         * Set loading state for activity
         * @param {sap.ui.model.json.JSONModel} model - View model
         * @param {string} activityPath - Path to activity in model
         * @param {boolean} isLoading - Loading state
         */
        setLoadingState(model, activityPath, isLoading) {
            model.setProperty(`${activityPath}/tmReportsLoading`, isLoading);
            model.setProperty(`${activityPath}/tmReportsLoadingState`, isLoading ? 'loading' : 'loaded');
        },

        /**
         * Set error state for activity
         * @param {sap.ui.model.json.JSONModel} model - View model
         * @param {string} activityPath - Path to activity in model
         */
        setErrorState(model, activityPath) {
            model.setProperty(`${activityPath}/tmReportsLoadingState`, 'error');
            model.setProperty(`${activityPath}/tmReportsLoading`, false);
            model.setProperty(`${activityPath}/tmReportsCount`, 0);
        },

        /**
         * Batch load T&M reports for multiple activities
         * @param {array} activities - Array of activity objects with paths
         * @param {sap.ui.model.json.JSONModel} model - View model
         * @param {number} chunkSize - Number of activities to process in parallel
         * @returns {Promise} Batch load promise
         */
        async batchLoadTMReports(activities, model, chunkSize = 10) {
            console.log(`TMDataService: Batch loading T&M for ${activities.length} activities`);

            for (let i = 0; i < activities.length; i += chunkSize) {
                const chunk = activities.slice(i, i + chunkSize);

                // Set loading state for this chunk
                chunk.forEach(activity => {
                    this.setLoadingState(model, activity.path, true);
                });

                // Load T&M reports for this chunk in parallel
                const promises = chunk.map(activity =>
                    this.loadSingleActivityTM(activity.id, activity.path, model)
                );

                try {
                    await Promise.allSettled(promises);
                } catch (error) {
                    console.error('TMDataService: Error in batch loading chunk:', error);
                }

                // Small delay between chunks to avoid API rate limiting
                if (i + chunkSize < activities.length) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

            console.log('TMDataService: Batch T&M loading completed');
            model.refresh(true);
        },

        /**
         * Load T&M for single activity (used in batch loading)
         * @private
         */
        async loadSingleActivityTM(activityId, activityPath, model) {
            try {
                const tmData = await this.loadTMReports(activityId);
                this.updateActivityWithTMData(model, activityPath, tmData);
            } catch (error) {
                console.error(`TMDataService: Error loading T&M for activity ${activityId}:`, error);
                this.setErrorState(model, activityPath);
            }
        }
    };
});