sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/Item",
    "mobileappsc/utils/formatter",
    "mobileappsc/utils/ActivityService",
    "mobileappsc/utils/URLHelper",
    "mobileappsc/utils/OrganizationService"
], (Controller, JSONModel, MessageToast, MessageBox, Item, formatter, ActivityService, URLHelper, OrganizationService) => {
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
                serviceCall: { id: null, subject: null },
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
                serviceCallActivities: [],

                // Organization Level data
                organizationLevels: [],
                organizationLevelsLoading: false,
                selectedOrganizationLevel: {
                    key: null,
                    text: "Please select organization level"
                },

                // Control panel visibility
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

                // Manually populate ComboBox items
                setTimeout(() => {
                    this._populateComboBoxItems(transformedLevels);
                }, 100);

            } catch (error) {
                console.error("Failed to load organization levels:", error);
                MessageToast.show("Failed to load organization levels");
            } finally {
                viewModel.setProperty("/organizationLevelsLoading", false);
            }
        },

        _populateComboBoxItems(levels) {
            const comboBox = this.byId("organizationLevelComboBox");
            if (!comboBox) return;

            // Clear existing items
            comboBox.removeAllItems();

            // Add items manually
            levels.forEach(level => {
                const item = new Item({
                    key: level.key,
                    text: level.text
                });
                comboBox.addItem(item);
            });
        },

        _loadActivityFromURL() {
            if (URLHelper.hasActivityId()) {
                const activityId = URLHelper.getActivityId();
                this._loadActivity(activityId);
            }
        },

        async _loadActivity(activityId) {
            const viewModel = this.getView().getModel("view");
            viewModel.setProperty("/busy", true);

            try {
                // Fetch activity
                const response = await ActivityService.fetchActivityById(activityId);
                const activity = ActivityService.extractActivityData(response);

                // Update model
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

                // Load service call data
                const serviceCall = ActivityService.extractServiceCallData(activity);
                if (serviceCall) {
                    viewModel.setProperty("/serviceCall", serviceCall);
                    this._loadServiceCallActivities(serviceCall.id);
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
            try {
                const activities = await ActivityService.fetchActivitiesForServiceCall(serviceCallId);
                const viewModel = this.getView().getModel("view");
                viewModel.setProperty("/serviceCallActivities", activities);
            } catch (error) {
                console.error("Load activities error:", error);
            }
        },

        async onOrganizationLevelChange(oEvent) {
            const selectedItem = oEvent.getParameter("selectedItem");

            if (selectedItem) {
                const selectedKey = selectedItem.getKey();
                const model = this.getView().getModel("view");
                const organizationLevels = model.getProperty("/organizationLevels");
                const selectedLevel = organizationLevels.find(level => level.key === selectedKey);

                if (selectedLevel) {
                    // Update selected organization
                    model.setProperty("/selectedOrganizationLevel", selectedLevel);

                    // Show the activity panels
                    model.setProperty("/organizationSelected", true);

                    MessageToast.show(`Loading activities for: ${selectedLevel.text}`);

                    // Load activities for this organization
                    await this._initializeActivityPanels(selectedLevel);

                    // Re-populate ComboBox items to prevent corruption
                    setTimeout(() => {
                        this._populateComboBoxItems(organizationLevels);
                        const comboBox = this.byId("organizationLevelComboBox");
                        if (comboBox) {
                            comboBox.setSelectedKey(selectedLevel.key);
                        }
                    }, 100);
                } else {
                    console.warn("Selected level not found for key:", selectedKey);
                }
            }
        },

        async _initializeActivityPanels(organizationLevel) {
            const model = this.getView().getModel("view");
            model.setProperty("/busy", true);

            try {
                // Clear previous data
                model.setProperty("/selectedActivity", null);
                model.setProperty("/serviceCallActivities", []);

                // Load activities
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

        _getCurrentActivityId() {
            if (URLHelper.hasActivityId()) {
                return URLHelper.getActivityId();
            }
            return null;
        },

        onActivityPress(event) {
            const context = event.getSource().getBindingContext("view");
            const activity = context.getObject();
            this._loadActivity(activity.id);
        },

        onSelectActivity() {
            MessageBox.information(
                "Activity selection will be implemented here.",
                { title: "Activity Selection" }
            );
        },

        onRefresh() {
            const model = this.getView().getModel("view");
            const currentActivityId = model.getProperty("/selectedActivity/id");

            if (currentActivityId) {
                this._loadActivity(currentActivityId);
            } else {
                this._loadActivityFromURL();
            }

            // Also refresh organization levels
            this._loadOrganizationLevels();

            MessageToast.show("View refreshed");
        }
    });
});