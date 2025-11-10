sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "mobileappsc/utils/formatter"
], (Controller, JSONModel, MessageToast, MessageBox, formatter) => {
    "use strict";

    return Controller.extend("mobileappsc.controller.View1", {
        
        formatter: formatter,

        onInit() {
            // Create view model
            const viewModel = new JSONModel({
                busy: false,
                serviceCall: {
                    id: null,
                    subject: null
                },
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
                activityFullData: null
            });
            
            this.getView().setModel(viewModel, "view");

            // Check URL parameters for activity context
            this._checkUrlParameters();
        },

        _checkUrlParameters() {
            const urlParams = new URLSearchParams(window.location.search);
            const activityId = urlParams.get('activityId');

            if (activityId) {
                this._fetchAndSelectActivity(activityId);
            }
        },

        _fetchAndSelectActivity(activityId) {
            const viewModel = this.getView().getModel("view");
            viewModel.setProperty("/busy", true);

            fetch("/api/get-activity-by-id", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ activityId: activityId })
            })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Activity not found (HTTP ${response.status})`);
                    }
                    return response.json();
                })
                .then(data => {
                    // FSM returns: { data: [{ activity: {...} }] }
                    const activity = data.data?.[0]?.activity || data;
                    
                    // Set full data for debug panel
                    viewModel.setProperty("/activityFullData", data);
                    
                    // Set selected activity
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
                    
                    // Set service call info
                    if (activity.object) {
                        viewModel.setProperty("/serviceCall", {
                            id: activity.object.objectId,
                            subject: activity.subject
                        });
                    }
                    
                    viewModel.setProperty("/busy", false);
                    MessageToast.show("Activity loaded: " + activity.subject);
                })
                .catch(error => {
                    viewModel.setProperty("/busy", false);
                    MessageBox.error("Failed to load activity: " + error.message);
                });
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
                this._fetchAndSelectActivity(currentActivityId);
            } else {
                this._checkUrlParameters();
            }
        }
    });
});