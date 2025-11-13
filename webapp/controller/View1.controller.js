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

                selectedActivities: [],
                selectedActivitiesCount: 0,
                hasActivitySelection: false,

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
            model.setProperty("/selectedActivities", []);
            model.setProperty("/selectedActivitiesCount", 0);
        },

        async _loadActivity(activityId) {
            console.log('Loading activity:', activityId);

            const viewModel = this.getView().getModel("view");
            viewModel.setProperty("/busy", true);

            try {
                const response = await ActivityService.fetchActivityById(activityId);
                const activity = ActivityService.extractActivityData(response);

                viewModel.setProperty("/activityFullData", activity.rawData);

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
                
                const executionActivities = allActivities.filter(activity => 
                    activity.executionStage === "EXECUTION"
                );
                
                const productGroups = ProductGroupService.groupActivitiesByProduct(
                    executionActivities, 
                    serviceOrderData.externalId
                );
                
                productGroups.forEach(group => {
                    group.expanded = true;
                });
                
                const viewModel = this.getView().getModel("view");
                
                if (serviceOrderData) {
                    viewModel.setProperty("/serviceCall", serviceOrderData);
                }
                
                viewModel.setProperty("/productGroups", productGroups);

            } catch (error) {
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

        onActivitySelectionChange(oEvent) {
            const oTable = oEvent.getSource();
            const aSelectedItems = oTable.getSelectedItems();
            const oViewModel = this.getView().getModel("view");
            
            const aSelectedActivities = aSelectedItems.map(oItem => {
                const oContext = oItem.getBindingContext("view");
                const oActivity = oContext.getObject();
                
                const sPath = oContext.getPath();
                const aPathParts = sPath.split("/");
                const iGroupIndex = parseInt(aPathParts[2]);
                const productGroup = oViewModel.getProperty("/productGroups/" + iGroupIndex);
                
                return {
                    id: oActivity.id,
                    code: oActivity.code,
                    externalId: oActivity.fullActivity?.externalId,
                    subject: oActivity.subject,
                    status: oActivity.status,
                    type: oActivity.type,
                    productDescription: productGroup?.productDescription,
                    soItemId: productGroup?.soItemId,
                    fullActivity: oActivity.fullActivity
                };
            });
            
            oViewModel.setProperty("/selectedActivities", aSelectedActivities);
            oViewModel.setProperty("/selectedActivitiesCount", aSelectedActivities.length);
            
            this._updateSelectionState();
            
            if (aSelectedActivities.length > 0) {
                MessageToast.show(
                    `${aSelectedActivities.length} ${aSelectedActivities.length === 1 ? 'activity' : 'activities'} selected`
                );
            }
        },

        onViewActivityDetails(oEvent) {
            const oSource = oEvent.getSource();
            const oContext = oSource.getBindingContext("view");
            const oActivity = oContext.getObject();
            
            const sDetails = `Activity: ${oActivity.code}\n` +
                           `Subject: ${oActivity.subject}\n` +
                           `Status: ${oActivity.status}\n` +
                           `Type: ${oActivity.type}\n` +
                           `External ID: ${oActivity.fullActivity?.externalId || 'N/A'}`;
            
            MessageBox.information(sDetails, {
                title: "Activity Details",
                contentWidth: "400px"
            });
        },

        _updateSelectionState() {
            const oViewModel = this.getView().getModel("view");
            const aSelected = oViewModel.getProperty("/selectedActivities") || [];
            const bHasSelection = aSelected.length > 0;
            
            oViewModel.setProperty("/hasActivitySelection", bHasSelection);
        },

        getSelectedActivities() {
            const oViewModel = this.getView().getModel("view");
            return oViewModel.getProperty("/selectedActivities") || [];
        },

        onActivityPress(oEvent) {
            this.onViewActivityDetails(oEvent);
        }
    });
});