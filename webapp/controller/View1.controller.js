sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/Item",
    "sap/ui/core/Fragment",
    "mobileappsc/utils/formatter",
    "mobileappsc/utils/ActivityService",
    "mobileappsc/utils/ServiceOrderService",
    "mobileappsc/utils/ProductGroupService",
    "mobileappsc/utils/URLHelper",
    "mobileappsc/utils/OrganizationService",
    "mobileappsc/utils/ReportedItemsData"
], (Controller, JSONModel, MessageToast, MessageBox, Item, Fragment, formatter, ActivityService, ServiceOrderService, ProductGroupService, URLHelper, OrganizationService, ReportedItemsData) => {
    "use strict";

    return Controller.extend("mobileappsc.controller.View1", {

        formatter: formatter,

        onInit() {
            this._initializeModel();
            this._loadOrganizationLevels();
            this._loadActivityFromURL();
        },

        _initializeModel() {
            const viewModel = new JSONModel({
                busy: false,
                organizationLevelsLoading: false,

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

                organizationSelected: false
            });

            this.getView().setModel(viewModel, "view");
        },

        async _loadOrganizationLevels() {
            const viewModel = this.getView().getModel("view");
            viewModel.setProperty("/organizationLevelsLoading", true);

            try {
                const levels = await OrganizationService.fetchOrganizationalLevels();
                const transformedLevels = OrganizationService.transformLevelsForDropdown(levels);

                viewModel.setProperty("/organizationLevels", transformedLevels);

                setTimeout(() => {
                    this._populateOrganizationLevelComboBox(transformedLevels);
                }, 100);

            } catch (error) {
                console.error("Failed to load organization levels:", error);
                MessageToast.show("Failed to load organization levels");
            } finally {
                viewModel.setProperty("/organizationLevelsLoading", false);
            }
        },

        _populateOrganizationLevelComboBox(levels) {
            const comboBox = this.byId("organizationLevelComboBox");
            if (!comboBox) return;

            comboBox.removeAllItems();

            levels.forEach(level => {
                const item = new Item({
                    key: level.key,
                    text: level.text
                });
                comboBox.addItem(item);
            });
        },

        async onOrganizationLevelChange(oEvent) {
            const selectedItem = oEvent.getParameter("selectedItem");
            if (!selectedItem) return;

            const selectedKey = selectedItem.getKey();
            const model = this.getView().getModel("view");
            const organizationLevels = model.getProperty("/organizationLevels");
            const selectedLevel = organizationLevels.find(level => level.key === selectedKey);

            if (selectedLevel) {
                model.setProperty("/selectedOrganizationLevel", selectedLevel);
                model.setProperty("/organizationSelected", true);

                MessageToast.show(`Loading activities for: ${selectedLevel.text}`);

                await this._initializeActivityPanels();

                this._restoreOrganizationLevelSelection(organizationLevels, selectedLevel.key);
            } else {
                console.warn("Selected level not found for key:", selectedKey);
            }
        },

        _restoreOrganizationLevelSelection(organizationLevels, selectedKey) {
            setTimeout(() => {
                this._populateOrganizationLevelComboBox(organizationLevels);
                const comboBox = this.byId("organizationLevelComboBox");
                if (comboBox) {
                    comboBox.setSelectedKey(selectedKey);
                }
            }, 100);
        },

        async _initializeActivityPanels() {
            const model = this.getView().getModel("view");
            model.setProperty("/busy", true);

            try {
                this._resetActivityData();

                const currentActivityId = this._getCurrentActivityId();
                if (currentActivityId) {
                    await this._loadActivity(currentActivityId);
                }

            } catch (error) {
                console.error("Error initializing activity panels:", error);
                MessageBox.error("Failed to load activities for selected organization");
            } finally {
                model.setProperty("/busy", false);
            }
        },

        _resetActivityData() {
            const model = this.getView().getModel("view");
            model.setProperty("/productGroups", []);
        },

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

        async _loadServiceCallActivities(serviceCallId) {
            console.log('Loading service call activities:', serviceCallId);

            try {
                const compositeData = await ServiceOrderService.fetchServiceCallById(serviceCallId);
                const serviceOrderData = ServiceOrderService.extractServiceOrderData(compositeData);
                const allActivities = ServiceOrderService.extractActivitiesFromCompositeTree(compositeData);

                // Filter EXECUTION and CLOSED activities
                const filteredActivities = allActivities.filter(activity =>
                    activity.executionStage === "EXECUTION" || activity.executionStage === "CLOSED"
                );

                console.log('Filtered activities (EXECUTION + CLOSED):', filteredActivities.length);

                const productGroups = ProductGroupService.groupActivitiesByProduct(
                    filteredActivities,
                    serviceOrderData.externalId
                );

                // Optimize data - pre-calculate all display values in single pass
                const optimizedGroups = productGroups.map(group => ({
                    ...group,
                    expanded: true,
                    activityCount: group.activities.length,
                    activities: group.activities.map(activity => this._prepareActivityData(activity))
                }));

                const viewModel = this.getView().getModel("view");

                if (serviceOrderData) {
                    viewModel.setProperty("/serviceCall", serviceOrderData);
                }

                // Single model update for better performance
                viewModel.setProperty("/productGroups", optimizedGroups);

            } catch (error) {
                console.error("Load activities error:", error);
            }
        },

        /**
         * Pre-calculate all display values to avoid expression bindings
         */
        _prepareActivityData(activity) {
            const isClosed = activity.executionStage === 'CLOSED';
            const fullActivity = activity.fullActivity || {};

            const preparedData = {
                // Original data
                id: activity.id,
                code: activity.code,
                subject: activity.subject,
                status: activity.status,
                type: activity.type,
                executionStage: activity.executionStage,
                plannedStartDate: activity.plannedStartDate,
                plannedEndDate: activity.plannedEndDate,

                // Pre-calculated flags
                isClosed: isClosed,
                isReadOnly: isClosed,

                // T&M Reports flags - ONLY SET ONCE HERE
                tmReportsExpanded: false,
                tmReportsLoaded: false,
                tmReportsLoading: false,
                tmReportsCount: 0,
                tmReports: [],
                tmIconClass: 'expandIcon',

                // T&M Type counts
                tmTimeEffortCount: 0,
                tmMaterialCount: 0,
                tmExpenseCount: 0,
                tmMileageCount: 0,

                // Details expansion flag
                detailsExpanded: false,

                // Pre-calculated CSS classes
                textClass: isClosed ? 'closedActivityText' : '',

                // Pre-calculated status state
                statusState: this._getStatusState(activity),
                stageState: isClosed ? 'None' : 'Information',

                // Flattened and pre-formatted fields
                externalId: fullActivity.externalId || 'N/A',
                orgLevelId: fullActivity.orgLevelIds?.[0] || 'N/A',
                responsibleId: fullActivity.responsibles?.[0]?.externalId || 'N/A',
                serviceProductId: fullActivity.serviceProduct?.externalId || 'N/A',
                plannedDuration: fullActivity.plannedDurationInMinutes || 0,

                // Address fields
                addressStreet: fullActivity.address?.street || '',
                addressStreetNumber: fullActivity.address?.streetNumber || '',
                addressCity: fullActivity.address?.city || '',
                addressFull: this._formatAddress(fullActivity.address),

                // Formatted dates
                formattedStartDate: this.formatter.formatDateTime(activity.plannedStartDate),
                formattedEndDate: this.formatter.formatDateTime(activity.plannedEndDate),
                formattedDuration: (fullActivity.plannedDurationInMinutes || 0) + ' min',

                // Keep full activity for edge cases
                fullActivity: fullActivity
            };

            // AUTO-LOAD T&M Reports for immediate count display
            this._autoLoadTMReportsFixed(activity.id, preparedData);

            return preparedData;
        },

        /**
         * Auto-load T&M reports and update model properly
         */
        async _autoLoadTMReportsFixed(activityId, activityData) {
            try {
                const reports = await ReportedItemsData.getReportedItems(activityId);

                // Calculate counts by type
                const timeEffortCount = reports.filter(r => r.type === "Time Effort").length;
                const materialCount = reports.filter(r => r.type === "Material").length;
                const expenseCount = reports.filter(r => r.type === "Expense").length;
                const mileageCount = reports.filter(r => r.type === "Mileage").length;

                // Update activity data directly
                activityData.tmReports = reports;
                activityData.tmReportsCount = reports.length;
                activityData.tmReportsLoaded = true;
                activityData.tmTimeEffortCount = timeEffortCount;
                activityData.tmMaterialCount = materialCount;
                activityData.tmExpenseCount = expenseCount;
                activityData.tmMileageCount = mileageCount;

                // Force model update after data is loaded
                setTimeout(() => {
                    const model = this.getView().getModel("view");
                    if (model) {
                        model.refresh(true); // Force refresh
                    }
                }, 100);

                console.log(`Auto-loaded ${reports.length} T&M reports for activity ${activityData.code}`);

            } catch (error) {
                console.error("Error auto-loading T&M reports for activity", activityId, ":", error);
                activityData.tmReportsCount = 0;
                activityData.tmReportsLoaded = false;
            }
        },

        /**
         * Calculate status state based on execution stage and status
         */
        _getStatusState(activity) {
            if (activity.executionStage === 'CLOSED') {
                return 'None';
            }

            switch (activity.status) {
                case 'OPEN':
                    return 'Warning';
                case 'COMPLETED':
                    return 'Success';
                default:
                    return 'None';
            }
        },

        /**
         * Format address into single string
         */
        _formatAddress(address) {
            if (!address) {
                return 'N/A';
            }

            const parts = [];

            if (address.street) {
                parts.push(address.street);
            }
            if (address.streetNumber) {
                parts.push(address.streetNumber);
            }
            if (address.city) {
                parts.push(address.city);
            }

            return parts.length > 0 ? parts.join(' ') : 'N/A';
        },

        _clearAllDropdowns() {
            const orgComboBox = this.byId("organizationLevelComboBox");
            if (orgComboBox) {
                orgComboBox.setSelectedKey("");
                orgComboBox.removeAllItems();
            }
        },

        _loadActivityFromURL() {
            if (URLHelper.hasActivityId()) {
                const activityId = URLHelper.getActivityId();
                this._loadActivity(activityId);
            }
        },

        _getCurrentActivityId() {
            return URLHelper.hasActivityId() ? URLHelper.getActivityId() : null;
        },

        onRefresh() {
            const model = this.getView().getModel("view");

            model.setProperty("/organizationSelected", false);
            this._resetActivityData();

            this._clearAllDropdowns();

            this._loadOrganizationLevels();

            MessageToast.show("View refreshed");
        },

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
         * Toggle T&M Reports for an activity (OLD METHOD - Keep for backward compatibility)
         */
        async onToggleTMReports(oEvent) {
            const oIcon = oEvent.getSource();
            const oContext = oIcon.getBindingContext("view");

            if (!oContext) {
                return;
            }

            const sPath = oContext.getPath();
            const oModel = this.getView().getModel("view");
            const oActivity = oContext.getObject();

            // Toggle expanded state
            const bCurrentState = oModel.getProperty(sPath + "/tmReportsExpanded");
            const bNewState = !bCurrentState;

            oModel.setProperty(sPath + "/tmReportsExpanded", bNewState);
            oModel.setProperty(sPath + "/tmIconClass", bNewState ? 'expandIcon expandIconRotated' : 'expandIcon');

            // If expanding and reports not loaded yet, fetch them
            if (bNewState && !oModel.getProperty(sPath + "/tmReportsLoaded")) {
                await this._loadTMReports(sPath, oActivity.id);
            }
        },

        /**
         * Load T&M Reports for an activity with type counts
         */
        async _loadTMReports(activityPath, activityId) {
            const oModel = this.getView().getModel("view");

            oModel.setProperty(activityPath + "/tmReportsLoading", true);

            try {
                const reports = await ReportedItemsData.getReportedItems(activityId);

                // Calculate counts by type
                const timeEffortCount = reports.filter(r => r.type === "Time Effort").length;
                const materialCount = reports.filter(r => r.type === "Material").length;
                const expenseCount = reports.filter(r => r.type === "Expense").length;
                const mileageCount = reports.filter(r => r.type === "Mileage").length;

                oModel.setProperty(activityPath + "/tmReports", reports);
                oModel.setProperty(activityPath + "/tmReportsCount", reports.length);
                oModel.setProperty(activityPath + "/tmReportsLoaded", true);

                // NEW - Set type counts
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
        },

        /* ========================================
         * METHODS FOR SIMPLIFIED T&M UI
         * ======================================== */

        /**
         * Toggle extended activity details
         */
        onToggleDetails(oEvent) {
            const oLink = oEvent.getSource();
            const oContext = oLink.getBindingContext("view");

            if (!oContext) return;

            const sPath = oContext.getPath();
            const oModel = this.getView().getModel("view");
            const bCurrentState = oModel.getProperty(sPath + "/detailsExpanded");

            oModel.setProperty(sPath + "/detailsExpanded", !bCurrentState);
        },

        /**
         * View T&M Reports (opens dialog or shows summary)
         */
        async onViewTMReports(oEvent) {
            const oButton = oEvent.getSource();
            const oContext = oButton.getBindingContext("view");

            if (!oContext) return;

            const oActivity = oContext.getObject();
            const reports = oActivity.tmReports || [];

            // Create dialog model
            const oDialogModel = new JSONModel({
                activityCode: oActivity.code,
                activitySubject: oActivity.subject,
                reports: reports,
                reportCount: reports.length
            });

            // Load and open dialog
            if (!this._tmReportsDialog) {
                Fragment.load({
                    name: "mobileappsc.view.fragments.TMReportsDialog",
                    controller: this
                }).then((oDialog) => {
                    this._tmReportsDialog = oDialog;
                    this.getView().addDependent(oDialog);
                    oDialog.setModel(oDialogModel, "dialog");
                    oDialog.open();
                });
            } else {
                this._tmReportsDialog.setModel(oDialogModel, "dialog");
                this._tmReportsDialog.open();
            }
        },

        /**
         * Close T&M Reports Dialog
         */
        onCloseTMReportsDialog() {
            if (this._tmReportsDialog) {
                this._tmReportsDialog.close();
            }
        },

        /**
         * Add new T&M Report
         */
        onAddTMReport(oEvent) {
            const oButton = oEvent.getSource();
            const oContext = oButton.getBindingContext("view");

            if (!oContext) {
                MessageToast.show("Please select an activity first");
                return;
            }

            const oActivity = oContext.getObject();

            // TODO: Open T&M Creation Dialog
            MessageBox.information(
                `Add T&M Report for:\n\nActivity: ${oActivity.code}\nSubject: ${oActivity.subject}`,
                {
                    title: "Add T&M Report",
                    actions: ["Time Effort", "Material", "Expense", "Mileage", MessageBox.Action.CANCEL],
                    onClose: (sAction) => {
                        if (sAction !== MessageBox.Action.CANCEL) {
                            MessageToast.show(`Creating ${sAction} report...`);
                            // TODO: Implement T&M creation
                        }
                    }
                }
            );
        }
    });
});