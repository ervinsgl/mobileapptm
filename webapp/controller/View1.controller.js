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
                serviceCall: { id: null, subject: null },

                // Organization Level data
                organizationLevels: [],
                selectedOrganizationLevel: {
                    key: null,
                    text: "Please select organization level"
                },

                // Activities data
                serviceCallActivities: [],
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
            model.setProperty("/serviceCallActivities", []);
            model.setProperty("/activitySelected", false);
        },

        async _loadActivity(activityId) {
            const viewModel = this.getView().getModel("view");
            viewModel.setProperty("/busy", true);

            try {
                const response = await ActivityService.fetchActivityById(activityId);
                const activity = ActivityService.extractActivityData(response);

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
            try {
                const activities = await ActivityService.fetchActivitiesForServiceCall(serviceCallId);
                const viewModel = this.getView().getModel("view");
                viewModel.setProperty("/serviceCallActivities", activities);

                // Populate activities dropdown
                setTimeout(() => {
                    this._populateActivitiesComboBox(activities);
                }, 100);

            } catch (error) {
                console.error("Load activities error:", error);
            }
        },

        _populateActivitiesComboBox(activities) {
            const comboBox = this.byId("activitiesComboBox");
            if (!comboBox) return;

            comboBox.removeAllItems();

            activities.forEach(activity => {
                const item = new Item({
                    key: activity.id,
                    text: `${activity.code} - ${activity.subject}`
                });
                comboBox.addItem(item);
            });
        },

        async onActivitySelectionChange(oEvent) {
            const selectedItem = oEvent.getParameter("selectedItem");
            if (!selectedItem) return;

            const selectedActivityId = selectedItem.getKey();
            const model = this.getView().getModel("view");
            const activities = model.getProperty("/serviceCallActivities");
            const selectedActivity = activities.find(activity => activity.id === selectedActivityId);

            if (selectedActivity) {
                MessageToast.show(`Loading activity: ${selectedActivity.subject}`);

                // Show activity panels and load data
                model.setProperty("/activitySelected", true);
                await this._loadActivity(selectedActivityId);

                // Restore dropdown selection
                this._restoreActivitySelection(activities, selectedActivityId);
            } else {
                console.warn("Selected activity not found for ID:", selectedActivityId);
            }
        },

        _restoreActivitySelection(activities, selectedActivityId) {
            setTimeout(() => {
                this._populateActivitiesComboBox(activities);
                const comboBox = this.byId("activitiesComboBox");
                if (comboBox) {
                    comboBox.setSelectedKey(selectedActivityId);
                }
            }, 100);
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

        onSelectActivity() {
            MessageBox.information(
                "Activity selection will be implemented here.",
                { title: "Activity Selection" }
            );
        },

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

        _clearAllDropdowns() {
            const orgComboBox = this.byId("organizationLevelComboBox");
            if (orgComboBox) {
                orgComboBox.setSelectedKey("");
                orgComboBox.removeAllItems();
            }

            const actComboBox = this.byId("activitiesComboBox");
            if (actComboBox) {
                actComboBox.setSelectedKey("");
                actComboBox.removeAllItems();
            }
        }
    });
});