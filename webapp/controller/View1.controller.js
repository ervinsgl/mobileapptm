sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "mobileappsc/utils/formatter",
    "mobileappsc/utils/ActivityService",
    "mobileappsc/utils/URLHelper"
], (Controller, JSONModel, MessageToast, MessageBox, formatter, ActivityService, URLHelper) => {
    "use strict";

    return Controller.extend("mobileappsc.controller.View1", {
        
        formatter: formatter,

        onInit() {
            this._initializeModel();
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
                serviceCallActivities: []
            });
            
            this.getView().setModel(viewModel, "view");
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
                
                console.log("=== ACTIVITY DATA ===", response);
                
                // Extract activity data
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
                    console.log("=== SERVICE CALL DATA ===", serviceCall);
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
                
                console.log("=== ACTIVITIES LIST ===", activities);
                
                const viewModel = this.getView().getModel("view");
                viewModel.setProperty("/serviceCallActivities", activities);
                
            } catch (error) {
                console.error("Load activities error:", error);
            }
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
            const viewModel = this.getView().getModel("view");
            const currentActivityId = viewModel.getProperty("/selectedActivity/id");
            
            if (currentActivityId) {
                this._loadActivity(currentActivityId);
            } else {
                this._loadActivityFromURL();
            }
        }
    });
});