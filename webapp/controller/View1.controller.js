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
                organizationLevelsLoading: false,

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
         * Pre-calculate all display values for activity
         * @private
         */
        _prepareActivityDataOptimized(activity) {
            const isClosed = activity.executionStage === 'CLOSED';
            const fullActivity = activity.fullActivity || {};

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

                tmReportsLoaded: false,
                tmReportsLoading: false,
                tmReportsCount: 0,
                tmTimeEffortCount: 0,
                tmMaterialCount: 0,
                tmExpenseCount: 0,
                tmMileageCount: 0,

                detailsExpanded: false,
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
         * @private
         */
        _buildEntryHeaderText(report) {
            const baseText = `T&M Entry - ${report.type}`;
            let typeSpecificText = '';

            switch (report.type) {
                case 'Time Effort':
                    typeSpecificText = report.taskDisplayText && report.taskDisplayText !== 'N/A' 
                        ? report.taskDisplayText : '';
                    break;
                case 'Material':
                    typeSpecificText = report.itemDisplayText && report.itemDisplayText !== 'N/A' 
                        ? report.itemDisplayText : '';
                    break;
                case 'Expense':
                    typeSpecificText = report.expenseTypeDisplayText && report.expenseTypeDisplayText !== 'N/A' 
                        ? report.expenseTypeDisplayText : '';
                    break;
                case 'Mileage':
                    typeSpecificText = report.mileageTypeDisplayText && report.mileageTypeDisplayText !== 'N/A' 
                        ? report.mileageTypeDisplayText : '';
                    break;
            }

            return typeSpecificText ? `${baseText} - ${typeSpecificText}` : baseText;
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