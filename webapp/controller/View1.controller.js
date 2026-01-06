/**
 * View1.controller.js
 * 
 * Main controller for the Service Confirmation application.
 * Handles FSM Mobile web container integration, user organization level
 * resolution, activity loading, and T&M (Time & Materials) reporting.
 * 
 * @file View1.controller.js
 * @module mobileappsc/controller/View1
 * 
 * Initialization Flow:
 * 1. Load web container context (FSM Mobile sends userName, cloudId, etc.)
 * 2. Resolve user's organization level from FSM APIs
 * 3. Load organizational hierarchy for name lookups
 * 4. Load lookup data (tasks, items, expense types) in background
 * 5. Load activity from URL/context and filter by user's org level
 * 
 * Mixins:
 * - DataLoadingMixin: All data fetching and loading operations
 * - TMDialogMixin: T&M dialog handlers (view/edit/create)
 * - TechnicianMixin: Technician/item/expense search handlers
 */
sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "mobileappsc/model/formatter",
    "mobileappsc/utils/services/OrganizationService",
    "mobileappsc/utils/services/PersonService",
    "mobileappsc/utils/services/ItemService",
    "mobileappsc/utils/services/UdfMetaService",
    "mobileappsc/utils/tm/TMDialogService",
    "./mixin/DataLoadingMixin",
    "./mixin/TMDialogMixin",
    "./mixin/TechnicianMixin"
], (Controller, JSONModel, MessageToast, formatter, OrganizationService, PersonService, ItemService, UdfMetaService, TMDialogService, DataLoadingMixin, TMDialogMixin, TechnicianMixin) => {
    "use strict";

    /**
     * Merge all mixins with controller methods
     */
    return Controller.extend("mobileappsc.controller.View1", Object.assign({}, DataLoadingMixin, TMDialogMixin, TechnicianMixin, {

        formatter: formatter,

        /* =========================================================================
         * LIFECYCLE METHODS
         * ========================================================================= */

        /**
         * Controller initialization
         */
        onInit() {
            TMDialogService.init(this);
            this._initializeModel();
            
            // Load web container context first (needed for user org level resolution)
            this._loadWebContainerContext().then(() => {
                this._loadOrganizationLevels();
            });
            
            // Background loading (parallel) - non-blocking
            this._loadOrganizationalHierarchy();
            this._loadTimeTasks();
            this._loadItems();
            this._loadExpenseTypes();
        },

        /* =========================================================================
         * MODEL INITIALIZATION
         * ========================================================================= */

        /**
         * Initialize the view model with default state
         * @private
         */
        _initializeModel() {
            const viewModel = new JSONModel({
                busy: false,
                pageLoading: true,
                activitiesLoading: false,
                organizationLevelsLoading: false,

                // Entry context - tracks how app was opened
                entryContext: {
                    objectType: null,      // 'ACTIVITY' or 'SERVICECALL'
                    objectId: null,        // The ID of the entry object
                    source: null           // 'URL' or 'WebContainer'
                },

                webContainerContext: {
                    available: false,
                    userName: null,
                    language: null,
                    cloudAccount: null,
                    companyName: null,
                    objectType: null,
                    cloudId: null,
                    orgLevelId: null,
                    orgLevelName: "Loading..."
                },

                serviceCall: {
                    id: null,
                    externalId: null,
                    subject: null,
                    businessPartnerExternalId: null,
                    responsibleExternalId: null,
                    earliestStartDateTime: null,
                    dueDateTime: null
                },

                organizationLevels: [],
                selectedOrganizationLevel: {
                    key: null,
                    text: "Please select organization level"
                },

                productGroups: [],
                organizationSelected: false,
                userOrgLevelResolved: false
            });

            this.getView().setModel(viewModel, "view");
        },

        /* =========================================================================
         * ACTIVITY DATA PREPARATION
         * ========================================================================= */

        /**
         * Prepare activity data for display.
         * @param {Object} activity - Activity data
         * @param {string} [entryActivityId] - ID of entry activity (for highlighting)
         * @returns {Object} Prepared activity data
         * @private
         */
        _prepareActivityDataOptimized(activity, entryActivityId) {
            const isClosed = activity.executionStage === 'CLOSED';
            const fullActivity = activity.fullActivity || {};
            
            // Check if this is the entry activity (case-insensitive comparison)
            const entryIdLower = entryActivityId ? entryActivityId.toLowerCase() : null;
            const isEntryActivity = entryIdLower && (
                (activity.id && activity.id.toLowerCase() === entryIdLower) || 
                (fullActivity.id && fullActivity.id.toLowerCase() === entryIdLower)
            );
            
            // Use string for customData (booleans don't work with writeToDom)
            const entryActivityFlag = isEntryActivity ? "true" : "false";

            const quantity = this._getUdfValue(fullActivity, 'Z_Quantity') || 'N/A';
            const quantityUoM = this._getUdfValue(fullActivity, 'Z_QuantityUoM') || 'N/A';
            const formattedQuantity = quantity !== 'N/A' && quantityUoM !== 'N/A'
                ? `${quantity} ${quantityUoM}`
                : quantity;

            return {
                id: activity.id,
                code: activity.code,
                subject: activity.subject,
                status: activity.status,
                type: activity.type,
                executionStage: activity.executionStage,
                plannedStartDate: activity.plannedStartDate,
                plannedEndDate: activity.plannedEndDate,

                isClosed: isClosed,
                isReadOnly: isClosed,
                isEntryActivity: isEntryActivity,
                entryActivityFlag: entryActivityFlag,

                tmReportsLoaded: false,
                tmReportsLoading: false,
                tmReportsCount: 0,
                tmTimeEffortCount: 0,
                tmMaterialCount: 0,
                tmExpenseCount: 0,
                tmMileageCount: 0,

                // Auto-expand entry activity, collapse others
                detailsExpanded: isEntryActivity,
                textClass: isClosed ? 'closedActivityText' : '',
                statusState: this._getStatusState(activity),
                stageState: isClosed ? 'None' : 'Information',

                externalId: fullActivity.externalId || 'N/A',
                orgLevelId: fullActivity.orgLevelIds?.[0] || 'N/A',
                orgLevelDisplayText: fullActivity.orgLevelIds?.[0] 
                    ? OrganizationService.getOrgLevelDisplayTextById(fullActivity.orgLevelIds[0])
                    : 'N/A',
                responsibleId: fullActivity.responsibles?.[0]?.externalId || 'N/A',
                responsibleDisplayText: fullActivity.responsibles?.[0]?.externalId 
                    ? PersonService.getPersonDisplayTextByExternalId(fullActivity.responsibles[0].externalId)
                    : 'N/A',
                serviceProductId: fullActivity.serviceProduct?.externalId || 'N/A',
                serviceProductDisplayText: fullActivity.serviceProduct?.externalId 
                    ? ItemService.getItemDisplayTextByExternalId(fullActivity.serviceProduct.externalId)
                    : 'N/A',
                plannedDuration: fullActivity.plannedDurationInMinutes || 0,

                quantity: quantity,
                quantityUoM: quantityUoM,
                formattedQuantity: formattedQuantity,

                addressStreet: fullActivity.address?.street || '',
                addressStreetNumber: fullActivity.address?.streetNumber || '',
                addressCity: fullActivity.address?.city || '',
                addressFull: this._formatAddress(fullActivity.address),

                formattedStartDate: this.formatter.formatDateTime(activity.plannedStartDate),
                formattedEndDate: this.formatter.formatDateTime(activity.plannedEndDate),
                formattedDuration: (fullActivity.plannedDurationInMinutes || 0) + ' min',

                fullActivity: fullActivity
            };
        },

        /* =========================================================================
         * HELPER METHODS
         * ========================================================================= */

        /**
         * Extract UDF value from activity
         * @private
         */
        _getUdfValue(activity, udfExternalId) {
            if (!activity.udfValues || !Array.isArray(activity.udfValues)) {
                return null;
            }

            const udfValue = activity.udfValues.find(udf =>
                udf.udfMeta && udf.udfMeta.externalId === udfExternalId
            );

            return udfValue ? udfValue.value : null;
        },

        /**
         * Extract UDF value by externalId from T&M report
         * @private
         */
        _getUdfValueByExternalId(udfValues, targetExternalId) {
            if (!udfValues || !Array.isArray(udfValues) || !targetExternalId) {
                return null;
            }

            for (const udf of udfValues) {
                if (udf.meta) {
                    const externalId = UdfMetaService.getExternalIdById(udf.meta);
                    if (externalId === targetExternalId) {
                        return udf.value;
                    }
                }
            }

            return null;
        },

        /**
         * Build entry header text for T&M report
         * Simplified format: "Type - Name" (e.g., "Time Effort - Arbeitszeit")
         * @private
         */
        _buildEntryHeaderText(report) {
            const type = report.type;
            let name = '';

            switch (type) {
                case 'Time Effort':
                    name = this._extractNameFromDisplayText(report.taskDisplayText);
                    break;
                case 'Material':
                    name = this._extractNameFromDisplayText(report.itemDisplayText);
                    break;
                case 'Expense':
                    name = this._extractNameFromDisplayText(report.expenseTypeDisplayText);
                    break;
                case 'Mileage':
                    name = this._extractNameFromDisplayText(report.mileageTypeDisplayText);
                    break;
            }

            return name ? `${type} - ${name}` : type;
        },

        /**
         * Extract name from display text by removing code prefix
         * e.g., "AZ - Arbeitszeit" -> "Arbeitszeit"
         * e.g., "Z12000007 - PrÃ¼fung" -> "PrÃ¼fung"
         * @private
         */
        _extractNameFromDisplayText(displayText) {
            if (!displayText || displayText === 'N/A') {
                return '';
            }
            
            // If text contains " - ", take everything after it
            const separatorIndex = displayText.indexOf(' - ');
            if (separatorIndex !== -1) {
                return displayText.substring(separatorIndex + 3);
            }
            
            return displayText;
        },

        /**
         * Get status state for activity
         * @private
         */
        _getStatusState(activity) {
            if (activity.executionStage === 'CLOSED') {
                return 'None';
            }

            switch (activity.status) {
                case 'OPEN': return 'Warning';
                case 'COMPLETED': return 'Success';
                default: return 'None';
            }
        },

        /**
         * Format address into single string
         * @private
         */
        _formatAddress(address) {
            if (!address) return 'N/A';

            const parts = [];
            if (address.street) parts.push(address.street);
            if (address.streetNumber) parts.push(address.streetNumber);
            if (address.city) parts.push(address.city);

            return parts.length > 0 ? parts.join(' ') : 'N/A';
        },

        /* =========================================================================
         * UI EVENT HANDLERS
         * ========================================================================= */

        /**
         * Refresh view
         */
        onRefresh() {
            const model = this.getView().getModel("view");

            model.setProperty("/organizationSelected", false);
            model.setProperty("/userOrgLevelResolved", false);
            
            // Clear all service caches to ensure fresh data
            this._clearAllServiceCaches();
            
            this._resetActivityData();

            this._loadWebContainerContext().then(() => {
                this._loadOrganizationLevels();
            });

            MessageToast.show("View refreshed");
        },

        /**
         * Handle product panel expand
         */
        onProductPanelExpand(oEvent) {
            const expanded = oEvent.getParameter("expand");
            const panel = oEvent.getSource();
            const bindingContext = panel.getBindingContext("view");

            if (bindingContext) {
                const productPath = bindingContext.getPath();
                const model = this.getView().getModel("view");
                model.setProperty(productPath + "/expanded", expanded);
            }
        },

        /**
         * Toggle T&M Reports (legacy method)
         */
        async onToggleTMReports(oEvent) {
            const oIcon = oEvent.getSource();
            const oContext = oIcon.getBindingContext("view");

            if (!oContext) return;

            const sPath = oContext.getPath();
            const oModel = this.getView().getModel("view");
            const oActivity = oContext.getObject();

            const bCurrentState = oModel.getProperty(sPath + "/tmReportsExpanded");
            const bNewState = !bCurrentState;

            oModel.setProperty(sPath + "/tmReportsExpanded", bNewState);
            oModel.setProperty(sPath + "/tmIconClass", bNewState ? 'expandIcon expandIconRotated' : 'expandIcon');

            if (bNewState && !oModel.getProperty(sPath + "/tmReportsLoaded")) {
                await this._loadTMReports(sPath, oActivity.id);
            }
        }

    }));
});