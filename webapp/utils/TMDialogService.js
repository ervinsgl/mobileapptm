/**
 * TMDialogService.js
 * 
 * Frontend service for managing T&M dialogs.
 * Handles opening, closing, and data preparation for T&M dialogs.
 * 
 * Key Features:
 * - Open T&M Reports Dialog (view existing reports)
 * - Open T&M Creation Dialog (create new entries)
 * - Initialize services and load lookup data
 * - Set default values from activity context
 * - Extract activity data from various sources
 * 
 * Dialogs Managed:
 * - TMReportsDialog: View existing T&M reports
 * - TMCreateDialog: Create new T&M entries
 * 
 * @file TMDialogService.js
 * @module mobileappsc/utils/TMDialogService
 * @requires sap/ui/core/Fragment
 * @requires sap/ui/model/json/JSONModel
 * @requires sap/m/MessageToast
 * @requires mobileappsc/utils/TechnicianService
 * @requires mobileappsc/utils/TMCreationService
 * @requires mobileappsc/utils/TimeTaskService
 * @requires mobileappsc/utils/ItemService
 * @requires mobileappsc/utils/ExpenseTypeService
 */
sap.ui.define([
    "sap/ui/core/Fragment",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "mobileappsc/utils/TechnicianService",
    "mobileappsc/utils/TMCreationService",
    "mobileappsc/utils/TimeTaskService",
    "mobileappsc/utils/ItemService",
    "mobileappsc/utils/ExpenseTypeService"
], (Fragment, JSONModel, MessageToast, TechnicianService, TMCreationService, TimeTaskService, ItemService, ExpenseTypeService) => {
    "use strict";

    return {
        /**
         * Reference to the controller.
         * @type {sap.ui.core.mvc.Controller|null}
         * @private
         */
        _controller: null,

        /**
         * Initialize service with controller reference.
         * @param {sap.ui.core.mvc.Controller} controller - View controller
         */
        init(controller) {
            this._controller = controller;
        },

        /**
         * Open T&M Reports Dialog.
         * @param {Object} oActivity - Activity data object
         * @param {Array} reports - Array of T&M reports
         * @returns {Promise<void>}
         */
        async openTMReportsDialog(oActivity, reports) {
            if (!this._controller) {
                throw new Error("TMDialogService not initialized");
            }

            const oDialogModel = new JSONModel({
                activityId: oActivity.id,
                activityCode: oActivity.code,
                activitySubject: oActivity.subject,
                orgLevelId: oActivity.orgLevelId || null,
                serviceProduct: oActivity.serviceProductDisplayText || 'N/A',
                serviceProductExternalId: oActivity.serviceProductId || null,
                reports: reports,
                reportCount: reports.length,
                formattedStartDate: oActivity.formattedStartDate || 'N/A',
                formattedEndDate: oActivity.formattedEndDate || 'N/A',
                formattedDuration: oActivity.formattedDuration || 'N/A',
                quantity: oActivity.quantity || 'N/A',
                quantityUoM: oActivity.quantityUoM || 'N/A',
                responsibleExternalId: oActivity.responsibleId || 'N/A'
            });

            await this._openDialog("TMReportsDialog", oDialogModel, "dialog", "_tmReportsDialog");
        },

        /**
         * Open T&M Creation Dialog.
         * Initializes all required services and sets default values.
         * @param {Object} activityData - Activity data object
         * @returns {Promise<void>}
         */
        async openTMCreationDialog(activityData) {
            if (!this._controller) {
                throw new Error("TMDialogService not initialized");
            }

            // Initialize TechnicianService and set default technician
            let defaultTechDisplay = "";
            let defaultTechId = "";
            try {
                await TechnicianService.initialize();
                
                const responsibleExtId = activityData.responsibleExternalId;
                if (responsibleExtId && responsibleExtId !== 'N/A') {
                    const defaultTech = TechnicianService.getTechnicianByExternalId(responsibleExtId);
                    if (defaultTech) {
                        defaultTechId = defaultTech.id;
                        defaultTechDisplay = defaultTech.displayText;
                        TMCreationService.setDefaultTechnician(defaultTech);
                    }
                }
            } catch (error) {
                console.error('TMDialogService: Failed to initialize TechnicianService:', error);
                MessageToast.show("Warning: Technician search may not be available");
            }

            // Load Time Tasks and filter by prefix
            let taskSuggestions = [];
            let taskSuggestionsAZ = [];
            let taskSuggestionsFZ = [];
            let taskSuggestionsWZ = [];
            try {
                await TimeTaskService.fetchTimeTasks();
                taskSuggestions = TimeTaskService.getTasksForDropdown();
                
                taskSuggestionsAZ = taskSuggestions.filter(task => task.code && task.code.startsWith('AZ'));
                taskSuggestionsFZ = taskSuggestions.filter(task => task.code && task.code.startsWith('FZ'));
                taskSuggestionsWZ = taskSuggestions.filter(task => task.code && task.code.startsWith('WZ'));
            } catch (error) {
                console.error('TMDialogService: Failed to load time tasks:', error);
                MessageToast.show("Warning: Time tasks may not be available");
            }

            // Load Items and set default from service product
            let itemSuggestions = [];
            let defaultItemDisplay = "";
            let defaultItemId = "";
            try {
                await ItemService.fetchItems();
                itemSuggestions = ItemService.getAllForSuggestions();
                
                const serviceProductExtId = activityData.serviceProductExternalId;
                if (serviceProductExtId && serviceProductExtId !== 'N/A') {
                    const defaultItem = ItemService.getItemSuggestionByExternalId(serviceProductExtId);
                    if (defaultItem) {
                        defaultItemDisplay = defaultItem.displayText;
                        defaultItemId = defaultItem.id;
                    }
                }
                
                TMCreationService.setDefaultItem({
                    id: defaultItemId,
                    displayText: defaultItemDisplay
                });
            } catch (error) {
                console.error('TMDialogService: Failed to load items:', error);
                MessageToast.show("Warning: Item search may not be available");
            }

            // Load Expense Types and set default
            let expenseTypeSuggestions = [];
            try {
                await ExpenseTypeService.fetchExpenseTypes();
                expenseTypeSuggestions = ExpenseTypeService.getExpenseTypesForDropdown();
                
                if (expenseTypeSuggestions.length > 0) {
                    let defaultExpType = expenseTypeSuggestions.find(et => et.code === 'Z40000001');
                    if (!defaultExpType) {
                        defaultExpType = expenseTypeSuggestions[0];
                    }
                    
                    TMCreationService.setDefaultExpenseType({
                        id: defaultExpType.key,
                        code: defaultExpType.code,
                        displayText: defaultExpType.text
                    });
                }
            } catch (error) {
                console.error('TMDialogService: Failed to load expense types:', error);
                MessageToast.show("Warning: Expense types may not be available");
            }

            // Parse quantity for max constraint
            let maxQuantity = 9999;
            if (activityData.quantity && activityData.quantity !== 'N/A') {
                const parsed = parseFloat(activityData.quantity);
                if (!isNaN(parsed) && parsed > 0) {
                    maxQuantity = parsed;
                }
            }

            const oCreateTMDialogModel = new JSONModel({
                activityId: activityData.activityId,
                activityCode: activityData.activityCode,
                activitySubject: activityData.activitySubject,
                orgLevelId: activityData.orgLevelId,
                serviceProduct: activityData.serviceProduct,
                serviceProductExternalId: activityData.serviceProductExternalId,
                formattedStartDate: activityData.formattedStartDate,
                formattedEndDate: activityData.formattedEndDate,
                formattedDuration: activityData.formattedDuration,
                quantity: activityData.quantity,
                quantityUoM: activityData.quantityUoM,
                maxQuantity: maxQuantity,
                responsibleExternalId: activityData.responsibleExternalId,
                entries: [],
                technicianSuggestions: TechnicianService.getAllForDropdown(),
                itemSuggestions: itemSuggestions,
                taskSuggestions: taskSuggestions,
                taskSuggestionsAZ: taskSuggestionsAZ,
                taskSuggestionsFZ: taskSuggestionsFZ,
                taskSuggestionsWZ: taskSuggestionsWZ,
                expenseTypeSuggestions: expenseTypeSuggestions
            });

            await this._openDialog("TMCreateDialog", oCreateTMDialogModel, "createTM", "_tmCreateDialog");
        },

        /**
         * Generic dialog opener.
         * @param {string} fragmentName - Fragment name without path
         * @param {sap.ui.model.json.JSONModel} model - Dialog model
         * @param {string} modelName - Model name for binding
         * @param {string} dialogProperty - Controller property to store dialog
         * @returns {Promise<void>}
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
         * Close T&M Reports Dialog.
         */
        closeTMReportsDialog() {
            if (this._controller && this._controller._tmReportsDialog) {
                this._controller._tmReportsDialog.close();
            }
        },

        /**
         * Close T&M Creation Dialog and reset state.
         */
        closeTMCreationDialog() {
            if (this._controller && this._controller._tmCreateDialog) {
                this._controller._tmCreateDialog.close();
                
                const oModel = this._controller._tmCreateDialog.getModel("createTM");
                if (oModel) {
                    oModel.setProperty("/entries", []);
                }
                
                TMCreationService.clearDefaultTechnician();
                TMCreationService.clearDefaultItem();
                TMCreationService.clearDefaultExpenseType();
            }
        },

        /**
         * Extract activity data for dialog from context or existing dialog.
         * @param {sap.ui.model.Context|null} oContext - Binding context from view
         * @param {sap.m.Dialog|null} tmReportsDialog - Reference to T&M Reports Dialog
         * @returns {Object} Activity data object
         */
        extractActivityData(oContext, tmReportsDialog) {
            let activityData = {};

            if (oContext) {
                const oActivity = oContext.getObject();
                activityData = {
                    activityId: oActivity.id,
                    activityCode: oActivity.code,
                    activitySubject: oActivity.subject,
                    orgLevelId: oActivity.orgLevelId || null,
                    serviceProduct: oActivity.serviceProductDisplayText || 'N/A',
                    serviceProductExternalId: oActivity.serviceProductId || null,
                    formattedStartDate: oActivity.formattedStartDate || 'N/A',
                    formattedEndDate: oActivity.formattedEndDate || 'N/A',
                    formattedDuration: oActivity.formattedDuration || 'N/A',
                    quantity: oActivity.quantity || 'N/A',
                    quantityUoM: oActivity.quantityUoM || 'N/A',
                    responsibleExternalId: oActivity.responsibleId || 'N/A'
                };
            } else if (tmReportsDialog) {
                const oDialogModel = tmReportsDialog.getModel("dialog");
                if (oDialogModel) {
                    activityData = {
                        activityId: oDialogModel.getProperty("/activityId"),
                        activityCode: oDialogModel.getProperty("/activityCode"),
                        activitySubject: oDialogModel.getProperty("/activitySubject"),
                        orgLevelId: oDialogModel.getProperty("/orgLevelId") || null,
                        serviceProduct: oDialogModel.getProperty("/serviceProduct") || 'N/A',
                        serviceProductExternalId: oDialogModel.getProperty("/serviceProductExternalId") || null,
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