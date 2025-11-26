sap.ui.define([
    "sap/ui/core/Fragment",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "mobileappsc/utils/TechnicianService",
    "mobileappsc/utils/TMCreationService",
    "mobileappsc/utils/TimeTaskService"
], (Fragment, JSONModel, MessageToast, TechnicianService, TMCreationService, TimeTaskService) => {
    "use strict";

    return {
        /**
         * Reference to the controller
         */
        _controller: null,

        /**
         * Initialize service with controller reference
         */
        init(controller) {
            this._controller = controller;
        },

        /**
         * Open T&M Reports Dialog
         * @param {object} oActivity - Activity data object
         * @param {array} reports - Array of T&M reports
         */
        async openTMReportsDialog(oActivity, reports) {
            if (!this._controller) {
                throw new Error("TMDialogService not initialized");
            }

            console.log('Opening T&M Reports Dialog for activity:', oActivity.code);

            // Create dialog model
            const oDialogModel = new JSONModel({
                activityCode: oActivity.code,
                activitySubject: oActivity.subject,
                serviceProduct: oActivity.serviceProductDisplayText || 'N/A',
                reports: reports,
                reportCount: reports.length,
                // Activity details for dialog header
                formattedStartDate: oActivity.formattedStartDate || 'N/A',
                formattedEndDate: oActivity.formattedEndDate || 'N/A',
                formattedDuration: oActivity.formattedDuration || 'N/A',
                quantity: oActivity.quantity || 'N/A',
                quantityUoM: oActivity.quantityUoM || 'N/A',
                // Store responsible for default technician
                responsibleExternalId: oActivity.responsibleId || 'N/A'
            });

            // Load and open dialog
            await this._openDialog("TMReportsDialog", oDialogModel, "dialog", "_tmReportsDialog");
        },

        /**
         * Open T&M Creation Dialog
         * @param {object} activityData - Activity data object
         */
        async openTMCreationDialog(activityData) {
            if (!this._controller) {
                throw new Error("TMDialogService not initialized");
            }

            console.log('Opening T&M Creation Dialog for activity:', activityData.activityCode);

            // Initialize TechnicianService (load all persons in background)
            try {
                await TechnicianService.initialize();
                
                // Set default technician from activity responsible
                if (activityData.responsibleExternalId && activityData.responsibleExternalId !== 'N/A') {
                    const defaultTech = TechnicianService.getTechnicianByExternalId(activityData.responsibleExternalId);
                    if (defaultTech) {
                        TMCreationService.setDefaultTechnician(defaultTech);
                        console.log('TMDialogService: Default technician set from responsible:', defaultTech.displayText);
                    }
                }
            } catch (error) {
                console.error('TMDialogService: Failed to initialize TechnicianService:', error);
                MessageToast.show("Warning: Technician search may not be available");
            }

            // Load Time Tasks for dropdown
            let taskSuggestions = [];
            let taskSuggestionsAZ = [];
            let taskSuggestionsFZ = [];
            let taskSuggestionsWZ = [];
            try {
                await TimeTaskService.fetchTimeTasks();
                taskSuggestions = TimeTaskService.getTasksForDropdown();
                
                // Filter tasks by prefix for Time & Material entry columns
                taskSuggestionsAZ = taskSuggestions.filter(task => task.code && task.code.startsWith('AZ'));
                taskSuggestionsFZ = taskSuggestions.filter(task => task.code && task.code.startsWith('FZ'));
                taskSuggestionsWZ = taskSuggestions.filter(task => task.code && task.code.startsWith('WZ'));
                
                console.log('TMDialogService: Loaded', taskSuggestions.length, 'time tasks');
                console.log('TMDialogService: Filtered - AZ:', taskSuggestionsAZ.length, 'FZ:', taskSuggestionsFZ.length, 'WZ:', taskSuggestionsWZ.length);
            } catch (error) {
                console.error('TMDialogService: Failed to load time tasks:', error);
                MessageToast.show("Warning: Time tasks may not be available");
            }

            // Create dialog model with empty entries array
            const oCreateTMDialogModel = new JSONModel({
                activityCode: activityData.activityCode,
                activitySubject: activityData.activitySubject,
                serviceProduct: activityData.serviceProduct,
                formattedStartDate: activityData.formattedStartDate,
                formattedEndDate: activityData.formattedEndDate,
                formattedDuration: activityData.formattedDuration,
                quantity: activityData.quantity,
                quantityUoM: activityData.quantityUoM,
                responsibleExternalId: activityData.responsibleExternalId,
                entries: [],  // Dynamic array for T&M entries
                // Technician suggestions for Input with suggestions
                technicianSuggestions: TechnicianService.getAllForDropdown(),
                // Time Task suggestions for Select dropdown (all tasks - for Time Effort)
                taskSuggestions: taskSuggestions,
                // Filtered task suggestions for Time & Material columns
                taskSuggestionsAZ: taskSuggestionsAZ,  // Arbeitszeit
                taskSuggestionsFZ: taskSuggestionsFZ,  // Fahrzeit
                taskSuggestionsWZ: taskSuggestionsWZ   // Wartezeit
            });

            // Load and open dialog
            await this._openDialog("TMCreateDialog", oCreateTMDialogModel, "createTM", "_tmCreateDialog");
        },

        /**
         * Generic dialog opener
         * @private
         */
        async _openDialog(fragmentName, model, modelName, dialogProperty) {
            if (!this._controller[dialogProperty]) {
                this._controller[dialogProperty] = await Fragment.load({
                    name: `mobileappsc.view.fragments.${fragmentName}`,
                    controller: this._controller
                });
                this._controller.getView().addDependent(this._controller[dialogProperty]);
            }

            this._controller[dialogProperty].setModel(model, modelName);
            this._controller[dialogProperty].open();
        },

        /**
         * Close T&M Reports Dialog
         */
        closeTMReportsDialog() {
            if (this._controller && this._controller._tmReportsDialog) {
                this._controller._tmReportsDialog.close();
            }
        },

        /**
         * Close T&M Creation Dialog
         */
        closeTMCreationDialog() {
            if (this._controller && this._controller._tmCreateDialog) {
                this._controller._tmCreateDialog.close();
                // Reset entries when closing
                const oModel = this._controller._tmCreateDialog.getModel("createTM");
                if (oModel) {
                    oModel.setProperty("/entries", []);
                }
                // Clear default technician
                TMCreationService.clearDefaultTechnician();
            }
        },

        /**
         * Extract activity data for dialog
         * @param {object} oContext - Binding context (view or dialog)
         * @param {object} tmReportsDialog - Reference to T&M Reports Dialog (optional)
         * @returns {object} Activity data object
         */
        extractActivityData(oContext, tmReportsDialog) {
            let activityData = {};

            if (oContext) {
                // Called from ProductGroups - get from view model
                const oActivity = oContext.getObject();
                activityData = {
                    activityCode: oActivity.code,
                    activitySubject: oActivity.subject,
                    serviceProduct: oActivity.serviceProductDisplayText || 'N/A',
                    formattedStartDate: oActivity.formattedStartDate || 'N/A',
                    formattedEndDate: oActivity.formattedEndDate || 'N/A',
                    formattedDuration: oActivity.formattedDuration || 'N/A',
                    quantity: oActivity.quantity || 'N/A',
                    quantityUoM: oActivity.quantityUoM || 'N/A',
                    responsibleExternalId: oActivity.responsibleId || 'N/A'
                };
            } else if (tmReportsDialog) {
                // Called from TMReportsDialog - get from dialog model
                const oDialogModel = tmReportsDialog.getModel("dialog");
                if (oDialogModel) {
                    activityData = {
                        activityCode: oDialogModel.getProperty("/activityCode"),
                        activitySubject: oDialogModel.getProperty("/activitySubject"),
                        serviceProduct: oDialogModel.getProperty("/serviceProduct") || 'N/A',
                        formattedStartDate: oDialogModel.getProperty("/formattedStartDate") || 'N/A',
                        formattedEndDate: oDialogModel.getProperty("/formattedEndDate") || 'N/A',
                        formattedDuration: oDialogModel.getProperty("/formattedDuration") || 'N/A',
                        quantity: oDialogModel.getProperty("/quantity") || 'N/A',
                        quantityUoM: oDialogModel.getProperty("/quantityUoM") || 'N/A',
                        responsibleExternalId: oDialogModel.getProperty("/responsibleExternalId") || 'N/A'
                    };
                }
            }

            return activityData;
        }
    };
});