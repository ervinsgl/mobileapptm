sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/Item",
    "mobileappsc/utils/formatter",
    "mobileappsc/utils/ActivityService",
    "mobileappsc/utils/ServiceOrderService",
    "mobileappsc/utils/ProductGroupService",
    "mobileappsc/utils/URLHelper",
    "mobileappsc/utils/OrganizationService"
], (Controller, JSONModel, MessageToast, MessageBox, Item, formatter, ActivityService, ServiceOrderService, ProductGroupService, URLHelper, OrganizationService) => {
    "use strict";

    return Controller.extend("mobileappsc.controller.View1", {

        formatter: formatter,

        /* ========================================
         * LIFECYCLE METHODS
         * ======================================== */

        onInit() {
            this._initializeModel();
            this._loadOrganizationLevels();
            this._loadActivityFromURL();
        },

        /* ========================================
         * MODEL INITIALIZATION
         * ======================================== */

        _initializeModel() {
            const viewModel = new JSONModel({
                // Loading states
                busy: false,
                organizationLevelsLoading: false,

                // Service Call data
                serviceCall: { 
                    id: null, 
                    externalId: null,
                    subject: null,
                    businessPartnerExternalId: null,
                    responsibleExternalId: null,
                    earliestStartDateTime: null,
                    dueDateTime: null
                },

                // Organization Level data
                organizationLevels: [],
                selectedOrganizationLevel: {
                    key: null,
                    text: "Please select organization level"
                },

                // Product Groups (UDF-based grouping)
                productGroups: [],

                // Selected activity data
                selectedActivity: {
                    id: null,
                    code: null,
                    subject: null,
                    createPerson: null,
                    type: null,
                    status: null,
                    startDateTime: null,
                    endDateTime: null
                },
                activityFullData: null,

                // T&M Reporting data
                tmReporting: {
                    date: "",
                    createPerson: ""
                },

                // Panel visibility controls
                organizationSelected: false,
                activitySelected: false
            });

            this.getView().setModel(viewModel, "view");
        },

        /* ========================================
         * ORGANIZATION LEVEL MANAGEMENT
         * ======================================== */

        async _loadOrganizationLevels() {
            const viewModel = this.getView().getModel("view");
            viewModel.setProperty("/organizationLevelsLoading", true);

            try {
                const levels = await OrganizationService.fetchOrganizationalLevels();
                const transformedLevels = OrganizationService.transformLevelsForDropdown(levels);

                viewModel.setProperty("/organizationLevels", transformedLevels);

                // Populate dropdown
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
                // Update model
                model.setProperty("/selectedOrganizationLevel", selectedLevel);
                model.setProperty("/organizationSelected", true);

                MessageToast.show(`Loading activities for: ${selectedLevel.text}`);

                // Initialize activity panels
                await this._initializeActivityPanels();

                // Restore dropdown selection
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

        /* ========================================
         * ACTIVITY MANAGEMENT
         * ======================================== */

        async _initializeActivityPanels() {
            const model = this.getView().getModel("view");
            model.setProperty("/busy", true);

            try {
                // Reset activity data
                this._resetActivityData();

                // Load activities if URL contains activity ID
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
            model.setProperty("/selectedActivity", {
                id: null,
                code: null,
                subject: null,
                createPerson: null,
                type: null,
                status: null,
                startDateTime: null,
                endDateTime: null
            });
            model.setProperty("/productGroups", []);
            model.setProperty("/activitySelected", false);
            
            // Reset T&M Reporting data
            model.setProperty("/tmReporting", {
                date: "",
                createPerson: ""
            });
        },

        async _loadActivity(activityId) {
            console.log('\n========================================');
            console.log('CONTROLLER: Load Activity');
            console.log('========================================');
            console.log('Activity ID:', activityId);
            
            const viewModel = this.getView().getModel("view");
            viewModel.setProperty("/busy", true);

            try {
                const response = await ActivityService.fetchActivityById(activityId);
                
                console.log('\n--- CONTROLLER: Extracting Activity Data ---');
                const activity = ActivityService.extractActivityData(response);
                console.log('Extracted Activity:', activity);

                // Update model with activity data
                viewModel.setProperty("/activityFullData", response);
                viewModel.setProperty("/selectedActivity", {
                    id: activity.id,
                    code: activity.code,
                    subject: activity.subject,
                    createPerson: activity.createPerson,
                    type: activity.type,
                    status: activity.status,
                    startDateTime: activity.startDateTime,
                    endDateTime: activity.endDateTime
                });

                // Load service call and related activities
                console.log('\n--- CONTROLLER: Extracting Service Call Data ---');
                const serviceCall = ActivityService.extractServiceCallData(activity);
                console.log('Service Call:', serviceCall);
                
                if (serviceCall) {
                    viewModel.setProperty("/serviceCall", serviceCall);
                    await this._loadServiceCallActivities(serviceCall.id);
                }

                MessageToast.show("Activity loaded: " + activity.subject);

            } catch (error) {
                console.error('\n========================================');
                console.error('CONTROLLER: Load Activity ERROR');
                console.error('========================================');
                console.error("Load activity error:", error);
                MessageBox.error("Failed to load activity: " + error.message);
            } finally {
                viewModel.setProperty("/busy", false);
            }
        },

        async _loadServiceCallActivities(serviceCallId) {
            console.log('\n========================================');
            console.log('CONTROLLER: Load Service Call Activities');
            console.log('========================================');
            console.log('Service Call ID:', serviceCallId);
            
            try {
                // Fetch composite tree data (contains both service order and activities)
                const compositeData = await ServiceOrderService.fetchServiceCallById(serviceCallId);
                
                // Extract service order data
                console.log('\n--- CONTROLLER: Extracting Service Order Data ---');
                const serviceOrderData = ServiceOrderService.extractServiceOrderData(compositeData);
                
                // Extract activities
                console.log('\n--- CONTROLLER: Extracting Activities ---');
                const allActivities = ServiceOrderService.extractActivitiesFromCompositeTree(compositeData);
                
                // Filter EXECUTION activities
                const executionActivities = allActivities.filter(activity => 
                    activity.executionStage === "EXECUTION"
                );
                
                console.log('\n--- CONTROLLER: Filtered EXECUTION Activities ---');
                console.log('EXECUTION activities count:', executionActivities.length);
                
                // Group activities by Product Description and Parent Item ID
                console.log('\n--- CONTROLLER: Creating Product Groups ---');
                const productGroups = ProductGroupService.groupActivitiesByProduct(
                    executionActivities, 
                    serviceOrderData.externalId
                );
                
                // Add expanded properties for UI
                productGroups.forEach(group => {
                    group.expanded = false; // Product panel collapsed by default
                    group.activities.forEach(activity => {
                        activity.activityExpanded = false; // Activity panel collapsed by default
                    });
                });
                
                const viewModel = this.getView().getModel("view");
                
                // Update service order data
                if (serviceOrderData) {
                    console.log('\n--- CONTROLLER: Setting Service Order Data ---');
                    console.log('Service Order Data:', serviceOrderData);
                    viewModel.setProperty("/serviceCall", serviceOrderData);
                }
                
                // Set product groups
                console.log('\n--- CONTROLLER: Setting Product Groups ---');
                console.log('Product groups count:', productGroups.length);
                viewModel.setProperty("/productGroups", productGroups);

            } catch (error) {
                console.error('\n========================================');
                console.error('CONTROLLER: Load Service Call Activities ERROR');
                console.error('========================================');
                console.error("Load activities error:", error);
            }
        },

        _clearAllDropdowns() {
            const orgComboBox = this.byId("organizationLevelComboBox");
            if (orgComboBox) {
                orgComboBox.setSelectedKey("");
                orgComboBox.removeAllItems();
            }
        },

        /* ========================================
         * URL HANDLING
         * ======================================== */

        _loadActivityFromURL() {
            if (URLHelper.hasActivityId()) {
                const activityId = URLHelper.getActivityId();
                this._loadActivity(activityId);
            }
        },

        _getCurrentActivityId() {
            return URLHelper.hasActivityId() ? URLHelper.getActivityId() : null;
        },

        /* ========================================
         * USER ACTIONS
         * ======================================== */

        onRefresh() {
            const model = this.getView().getModel("view");

            // Reset all state
            model.setProperty("/organizationSelected", false);
            model.setProperty("/activitySelected", false);
            this._resetActivityData();

            // Clear and reset dropdowns
            this._clearAllDropdowns();

            // Reload data
            this._loadOrganizationLevels();

            MessageToast.show("View refreshed");
        },

        /* ========================================
         * PRODUCT GROUP MANAGEMENT
         * ======================================== */

        onProductPanelExpand(oEvent) {
            const expanded = oEvent.getParameter("expand");
            const panel = oEvent.getSource();
            const bindingContext = panel.getBindingContext("view");
            
            console.log('\n--- Product Panel Expanded ---');
            console.log('Expanded:', expanded);
            console.log('Product:', bindingContext.getProperty("productDescription"));
        },

        onActivityPress(oEvent) {
            const listItem = oEvent.getSource();
            const bindingContext = listItem.getBindingContext("view");
            const activityPath = bindingContext.getPath();
            const model = this.getView().getModel("view");
            
            // Toggle activity panel expansion
            const currentExpanded = model.getProperty(activityPath + "/activityExpanded");
            model.setProperty(activityPath + "/activityExpanded", !currentExpanded);
            
            console.log('\n--- Activity Panel Toggled ---');
            console.log('Activity:', bindingContext.getProperty("subject"));
            console.log('New Expanded State:', !currentExpanded);
        },

        onSelectActivityPress(oEvent) {
            const button = oEvent.getSource();
            const bindingContext = button.getBindingContext("view");
            const activity = bindingContext.getObject();
            
            console.log('\n========================================');
            console.log('CONTROLLER: Activity Selected');
            console.log('========================================');
            console.log('Activity ID:', activity.id);
            console.log('Activity Code:', activity.code);
            console.log('Activity Subject:', activity.subject);
            
            if (activity && activity.id) {
                MessageToast.show(`Loading activity: ${activity.subject}`);
                
                // Load the full activity data
                this._loadActivity(activity.id);
            }
        },

        /* ========================================
         * T&M REPORTING
         * ======================================== */

        onSendForApproval() {
            const model = this.getView().getModel("view");
            const tmData = model.getProperty("/tmReporting");

            const payload = {
                date: tmData.date || "",
                createPerson: tmData.createPerson || ""
            };

            MessageBox.information(
                JSON.stringify(payload, null, 2),
                {
                    title: "T&M Reporting Data",
                    contentWidth: "400px"
                }
            );
        }
    });
});