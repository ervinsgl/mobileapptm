/**
 * DataLoadingMixin.js
 * 
 * Mixin containing all data loading and fetching methods.
 * Handles initialization loading, activity loading, and T&M batch loading.
 * 
 * Responsibilities:
 * - Organization level loading and user resolution
 * - Lookup data loading (tasks, items, expense types)
 * - Web container context loading
 * - Activity and service call loading (supports both entry points)
 * - T&M reports batch loading
 * 
 * Entry Points:
 * - Activity: Fetches activity first to get service call ID, then loads service call
 * - ServiceCall: Goes directly to service call API (skips activity fetch)
 * 
 * @file DataLoadingMixin.js
 * @module mobileappsc/controller/mixin/DataLoadingMixin
 */
sap.ui.define([
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "mobileappsc/utils/services/OrganizationService",
    "mobileappsc/utils/services/TimeTaskService",
    "mobileappsc/utils/services/ItemService",
    "mobileappsc/utils/services/ExpenseTypeService",
    "mobileappsc/utils/services/ActivityService",
    "mobileappsc/utils/services/ServiceOrderService",
    "mobileappsc/utils/services/PersonService",
    "mobileappsc/utils/services/BusinessPartnerService",
    "mobileappsc/utils/services/ApprovalService",
    "mobileappsc/utils/services/UdfMetaService",
    "mobileappsc/utils/services/TechnicianService",
    "mobileappsc/utils/helpers/URLHelper",
    "mobileappsc/utils/helpers/ProductGroupService",
    "mobileappsc/utils/helpers/ReportedItemsData",
    "mobileappsc/utils/tm/TMDataService"
], (MessageToast, MessageBox, OrganizationService, TimeTaskService, ItemService, ExpenseTypeService, ActivityService, ServiceOrderService, PersonService, BusinessPartnerService, ApprovalService, UdfMetaService, TechnicianService, URLHelper, ProductGroupService, ReportedItemsData, TMDataService) => {
    "use strict";

    return {

        /* =========================================================================
         * INITIALIZATION LOADING
         * ========================================================================= */

        /**
         * Load organization levels and auto-resolve user's org level
         * @private
         */
        async _loadOrganizationLevels() {
            const viewModel = this.getView().getModel("view");
            viewModel.setProperty("/organizationLevelsLoading", true);

            try {
                await OrganizationService.loadOrganizationalHierarchy();

                const webContext = viewModel.getProperty("/webContainerContext");
                const userName = webContext?.userName;

                if (userName && userName !== 'N/A') {
                    console.log('View1: Attempting to auto-resolve org level for user:', userName);
                    
                    const resolvedOrgLevel = await OrganizationService.getUserResolvedOrgLevel(userName);
                    
                    if (resolvedOrgLevel && resolvedOrgLevel.found) {
                        console.log('View1: Auto-resolved org level:', resolvedOrgLevel.name);
                        
                        viewModel.setProperty("/webContainerContext/orgLevelId", resolvedOrgLevel.id);
                        viewModel.setProperty("/webContainerContext/orgLevelName", resolvedOrgLevel.name);
                        viewModel.setProperty("/selectedOrganizationLevel", {
                            key: resolvedOrgLevel.id,
                            text: resolvedOrgLevel.name
                        });
                        viewModel.setProperty("/organizationSelected", true);
                        viewModel.setProperty("/userOrgLevelResolved", true);

                        await this._loadActivityFromURL();
                        return;
                    } else {
                        console.log('View1: Could not auto-resolve org level');
                        viewModel.setProperty("/webContainerContext/orgLevelName", "Not Assigned");
                    }
                } else {
                    viewModel.setProperty("/webContainerContext/orgLevelName", "N/A");
                }

                await this._loadActivityFromURL();

            } catch (error) {
                console.error("Failed to load organization levels:", error);
                viewModel.setProperty("/webContainerContext/orgLevelName", "Error");
            } finally {
                viewModel.setProperty("/organizationLevelsLoading", false);
                viewModel.setProperty("/pageLoading", false);
            }
        },

        /**
         * Load organizational hierarchy for name lookups
         * @private
         */
        async _loadOrganizationalHierarchy() {
            try {
                console.log('Loading full organizational hierarchy...');
                await OrganizationService.loadOrganizationalHierarchy();
                console.log('Organizational hierarchy loaded successfully');
            } catch (error) {
                console.error("Failed to load organizational hierarchy:", error);
            }
        },

        /**
         * Load Time Tasks for lookup
         * @private
         */
        async _loadTimeTasks() {
            try {
                console.log('Loading time tasks for lookup...');
                await TimeTaskService.fetchTimeTasks();
                console.log('Time tasks loaded successfully');
            } catch (error) {
                console.error("Failed to load time tasks:", error);
            }
        },

        /**
         * Load Items for lookup
         * @private
         */
        async _loadItems() {
            try {
                console.log('Loading items for lookup...');
                await ItemService.fetchItems();
                console.log('Items loaded successfully');
            } catch (error) {
                console.error("Failed to load items:", error);
            }
        },

        /**
         * Load Expense Types for lookup
         * @private
         */
        async _loadExpenseTypes() {
            try {
                console.log('Loading expense types for lookup...');
                await ExpenseTypeService.fetchExpenseTypes();
                console.log('Expense types loaded successfully');
            } catch (error) {
                console.error("Failed to load expense types:", error);
            }
        },

        /* =========================================================================
         * WEB CONTAINER & URL METHODS
         * ========================================================================= */

        /**
         * Load web container context from FSM Mobile
         * @private
         */
        async _loadWebContainerContext() {
            const viewModel = this.getView().getModel("view");
            
            try {
                const response = await fetch("/web-container-context");
                
                if (response.ok) {
                    const webContext = await response.json();
                    console.log('Web container context loaded:', webContext);
                    
                    viewModel.setProperty("/webContainerContext", {
                        available: true,
                        userName: webContext.userName || 'N/A',
                        language: (webContext.language || 'N/A').toUpperCase(),
                        cloudAccount: webContext.cloudAccount || 'N/A',
                        companyName: webContext.companyName || 'N/A',
                        objectType: webContext.objectType || 'N/A',
                        cloudId: webContext.cloudId || 'N/A',
                        orgLevelId: null,
                        orgLevelName: "Loading..."
                    });
                    
                    URLHelper.setWebContainerContext(webContext);
                    return webContext;
                } else {
                    console.log('No web container context available');
                    return null;
                }
            } catch (error) {
                console.log('Could not load web container context:', error.message);
                return null;
            }
        },

        /**
         * Load data from URL parameters or web container context.
         * Handles both Activity and ServiceCall object types.
         * @private
         */
        async _loadFromContext() {
            const contextInfo = await URLHelper.getContextInfo();
            
            if (!contextInfo) {
                console.log('No context found - no Activity or ServiceCall ID in URL or web container');
                return;
            }

            console.log(`Loading from ${contextInfo.source}: ${contextInfo.objectType} = ${contextInfo.objectId}`);

            // Store entry context for highlighting and reference
            const viewModel = this.getView().getModel("view");
            viewModel.setProperty("/entryContext", {
                objectType: contextInfo.objectType,
                objectId: contextInfo.objectId,
                source: contextInfo.source
            });

            if (contextInfo.objectType === URLHelper.OBJECT_TYPES.ACTIVITY) {
                // Activity context: fetch activity first to get service call ID
                await this._loadActivity(contextInfo.objectId);
            } else if (contextInfo.objectType === URLHelper.OBJECT_TYPES.SERVICECALL) {
                // ServiceCall context: go directly to service call loading
                await this._loadServiceCallDirect(contextInfo.objectId);
            }
        },

        /**
         * @deprecated Use _loadFromContext instead
         * Load activity from URL parameters or web container context
         * @private
         */
        async _loadActivityFromURL() {
            // Delegate to new method for backward compatibility
            await this._loadFromContext();
        },

        /**
         * Get current activity ID from URL or web container
         * @private
         */
        async _getCurrentActivityId() {
            return await URLHelper.getActivityIdAsync();
        },

        /* =========================================================================
         * ACTIVITY LOADING METHODS
         * ========================================================================= */

        /**
         * Load single activity by ID
         * @private
         */
        async _loadActivity(activityId) {
            console.log('Loading activity:', activityId);

            const viewModel = this.getView().getModel("view");
            viewModel.setProperty("/busy", true);

            try {
                const response = await ActivityService.fetchActivityById(activityId);
                const activity = ActivityService.extractActivityData(response);
                const serviceCall = ActivityService.extractServiceCallData(activity);

                if (serviceCall) {
                    viewModel.setProperty("/serviceCall", serviceCall);
                    await this._loadServiceCallActivities(serviceCall.id);
                }

                MessageToast.show("Activity loaded: " + activity.subject);

            } catch (error) {
                console.error("Load activity error:", error);
                MessageBox.error("Failed to load activity: " + error.message);
            } finally {
                viewModel.setProperty("/busy", false);
            }
        },

        /**
         * Load service call directly (when opened from ServiceCall context).
         * Skips the activity fetch step and goes directly to service call API.
         * @param {string} serviceCallId - The service call ID
         * @private
         */
        async _loadServiceCallDirect(serviceCallId) {
            console.log('Loading service call directly:', serviceCallId);

            const viewModel = this.getView().getModel("view");
            viewModel.setProperty("/busy", true);

            try {
                // Go directly to service call activities loading
                await this._loadServiceCallActivities(serviceCallId);
                
                MessageToast.show("Service Call loaded");

            } catch (error) {
                console.error("Load service call error:", error);
                MessageBox.error("Failed to load service call: " + error.message);
            } finally {
                viewModel.setProperty("/busy", false);
            }
        },

        /**
         * Load all activities for a service call
         * @private
         */
        async _loadServiceCallActivities(serviceCallId) {
            console.log('Loading service call activities:', serviceCallId);
            
            const viewModel = this.getView().getModel("view");
            viewModel.setProperty("/activitiesLoading", true);

            try {
                const compositeData = await ServiceOrderService.fetchServiceCallById(serviceCallId);
                const serviceOrderData = ServiceOrderService.extractServiceOrderData(compositeData);
                const allActivities = ServiceOrderService.extractActivitiesFromCompositeTree(compositeData);

                const userOrgLevelId = viewModel.getProperty("/webContainerContext/orgLevelId");

                // Filter EXECUTION and CLOSED activities
                let filteredActivities = allActivities.filter(activity =>
                    activity.executionStage === "EXECUTION" || activity.executionStage === "CLOSED"
                );

                console.log('Filtered activities (EXECUTION + CLOSED):', filteredActivities.length);

                // Filter by user's org level if available
                if (userOrgLevelId) {
                    console.log('Filtering activities by user org level:', userOrgLevelId);
                    
                    filteredActivities = filteredActivities.filter(activity => {
                        const activityOrgLevelIds = activity.orgLevelIds || [];
                        console.log('Activity', activity.code, 'orgLevelIds:', activityOrgLevelIds);
                        
                        return activityOrgLevelIds.some(activityOrgLevelId => {
                            const formattedActivityOrgLevelId = OrganizationService.formatOrgLevelId(activityOrgLevelId);
                            const match = formattedActivityOrgLevelId === userOrgLevelId;
                            if (match) {
                                console.log('  -> MATCH:', formattedActivityOrgLevelId, '===', userOrgLevelId);
                            }
                            return match;
                        });
                    });

                    console.log('Filtered activities (by org level):', filteredActivities.length);
                }

                // Preload activity responsible persons for display
                const responsibleExternalIds = filteredActivities
                    .map(a => a.responsibles?.[0]?.externalId)
                    .filter(id => id && id !== 'N/A');
                
                if (responsibleExternalIds.length > 0) {
                    const uniqueResponsibleIds = [...new Set(responsibleExternalIds)];
                    console.log('Preloading activity responsible persons:', uniqueResponsibleIds.length);
                    await PersonService.preloadPersonsByExternalId(uniqueResponsibleIds);
                }

                const productGroups = ProductGroupService.groupActivitiesByProduct(
                    filteredActivities,
                    serviceOrderData.externalId
                );

                // Get entry activity ID for highlighting (only if opened from Activity)
                const entryContext = viewModel.getProperty("/entryContext");
                const entryActivityId = entryContext?.objectType === 'ACTIVITY' ? entryContext.objectId : null;

                // Prepare data WITHOUT auto-loading T&M
                const optimizedGroups = productGroups.map(group => ({
                    ...group,
                    expanded: true,
                    activityCount: group.activities.length,
                    activities: group.activities.map(activity => this._prepareActivityDataOptimized(activity, entryActivityId))
                }));

                // Enrich service order data
                if (serviceOrderData) {
                    if (serviceOrderData.responsibleExternalId && serviceOrderData.responsibleExternalId !== 'N/A') {
                        await PersonService.preloadPersonsByExternalId([serviceOrderData.responsibleExternalId]);
                        serviceOrderData.responsibleDisplayText = PersonService.getPersonDisplayTextByExternalId(serviceOrderData.responsibleExternalId);
                    } else {
                        serviceOrderData.responsibleDisplayText = serviceOrderData.responsibleExternalId;
                    }
                    
                    if (serviceOrderData.businessPartnerExternalId && serviceOrderData.businessPartnerExternalId !== 'N/A') {
                        await BusinessPartnerService.preloadBusinessPartnersByExternalId([serviceOrderData.businessPartnerExternalId]);
                        serviceOrderData.businessPartnerDisplayText = BusinessPartnerService.getBusinessPartnerDisplayTextByExternalId(serviceOrderData.businessPartnerExternalId);
                    } else {
                        serviceOrderData.businessPartnerDisplayText = serviceOrderData.businessPartnerExternalId;
                    }
                    
                    viewModel.setProperty("/serviceCall", serviceOrderData);
                }

                viewModel.setProperty("/productGroups", optimizedGroups);

                // Batch load T&M reports in background
                this._batchLoadTMReports(optimizedGroups);

            } catch (error) {
                console.error("Load activities error:", error);
            } finally {
                viewModel.setProperty("/activitiesLoading", false);
            }
        },

        /**
         * Reset activity data
         * @private
         */
        _resetActivityData() {
            const model = this.getView().getModel("view");
            model.setProperty("/productGroups", []);
        },

        /**
         * Clear all service caches.
         * Called during refresh to ensure fresh data is loaded.
         * @private
         */
        _clearAllServiceCaches() {
            console.log('DataLoadingMixin: Clearing all service caches');
            
            // Clear approval status cache (important for status updates)
            ApprovalService.clearCache();
            
            // Clear other service caches
            PersonService.clearCache();
            BusinessPartnerService.clearCache();
            TimeTaskService.clearCache();
            ItemService.clearCache();
            ExpenseTypeService.clearCache();
            UdfMetaService.clearCache();
            TechnicianService.clearCache();
            OrganizationService.clearCache();
            
            console.log('DataLoadingMixin: All service caches cleared');
        },

        /* =========================================================================
         * T&M BATCH LOADING METHODS
         * ========================================================================= */

        /**
         * Batch load T&M reports for all activities
         * @private
         */
        async _batchLoadTMReports(productGroups) {
            console.log('Starting batch T&M loading...');

            const allActivities = [];

            productGroups.forEach((group, groupIndex) => {
                group.activities.forEach((activity, activityIndex) => {
                    allActivities.push({
                        id: activity.id,
                        code: activity.code,
                        path: `/productGroups/${groupIndex}/activities/${activityIndex}`
                    });
                });
            });

            console.log(`Batch loading T&M for ${allActivities.length} activities`);

            const model = this.getView().getModel("view");
            await this._batchLoadWithEnrichment(allActivities, model);

            console.log('Batch T&M loading completed');
            model.refresh(true);
        },

        /**
         * Batch load with enrichment in chunks
         * @private
         */
        async _batchLoadWithEnrichment(activities, model) {
            const chunkSize = 10;

            for (let i = 0; i < activities.length; i += chunkSize) {
                const chunk = activities.slice(i, i + chunkSize);

                chunk.forEach(activity => {
                    TMDataService.setLoadingState(model, activity.path, true);
                });

                const promises = chunk.map(activity =>
                    this._loadAndEnrichSingleActivity(activity.id, activity.path, model)
                );

                try {
                    await Promise.allSettled(promises);
                } catch (error) {
                    console.error('Error in batch loading chunk:', error);
                }

                if (i + chunkSize < activities.length) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
        },

        /**
         * Load and enrich T&M for single activity
         * @private
         */
        async _loadAndEnrichSingleActivity(activityId, activityPath, model) {
            try {
                const tmData = await TMDataService.loadTMReports(activityId);
                await this._enrichTMReports(tmData.reports);
                TMDataService.updateActivityWithTMData(model, activityPath, tmData);

            } catch (error) {
                console.error(`Error loading T&M for activity ${activityId}:`, error);
                TMDataService.setErrorState(model, activityPath);
            }
        },

        /**
         * Load T&M Reports for an activity (legacy method)
         * @private
         */
        async _loadTMReports(activityPath, activityId) {
            const oModel = this.getView().getModel("view");

            oModel.setProperty(activityPath + "/tmReportsLoading", true);

            try {
                const reports = await ReportedItemsData.getReportedItems(activityId);

                const timeEffortCount = reports.filter(r => r.type === "Time Effort").length;
                const materialCount = reports.filter(r => r.type === "Material").length;
                const expenseCount = reports.filter(r => r.type === "Expense").length;
                const mileageCount = reports.filter(r => r.type === "Mileage").length;

                oModel.setProperty(activityPath + "/tmReports", reports);
                oModel.setProperty(activityPath + "/tmReportsCount", reports.length);
                oModel.setProperty(activityPath + "/tmReportsLoaded", true);
                oModel.setProperty(activityPath + "/tmTimeEffortCount", timeEffortCount);
                oModel.setProperty(activityPath + "/tmMaterialCount", materialCount);
                oModel.setProperty(activityPath + "/tmExpenseCount", expenseCount);
                oModel.setProperty(activityPath + "/tmMileageCount", mileageCount);

                if (reports.length > 0) {
                    MessageToast.show(`Loaded ${reports.length} T&M report(s)`);
                }

            } catch (error) {
                console.error("Error loading T&M reports:", error);
                MessageToast.show("Failed to load T&M reports: " + error.message);
                oModel.setProperty(activityPath + "/tmReports", []);
                oModel.setProperty(activityPath + "/tmReportsCount", 0);
            } finally {
                oModel.setProperty(activityPath + "/tmReportsLoading", false);
            }
        }
    };
});