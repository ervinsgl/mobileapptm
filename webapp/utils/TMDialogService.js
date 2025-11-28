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
                activityId: oActivity.id,
                activityCode: oActivity.code,
                activitySubject: oActivity.subject,
                orgLevelId: oActivity.orgLevelId || null,
                serviceProduct: oActivity.serviceProductDisplayText || 'N/A',
                serviceProductExternalId: oActivity.serviceProductId || null,
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
            let defaultTechDisplay = "";
            let defaultTechId = "";
            try {
                await TechnicianService.initialize();
                console.log('TMDialogService: TechnicianService initialized');
                
                // Set default technician from activity responsible
                const responsibleExtId = activityData.responsibleExternalId;
                console.log('TMDialogService: Looking for responsibleExternalId:', responsibleExtId);
                
                if (responsibleExtId && responsibleExtId !== 'N/A') {
                    const defaultTech = TechnicianService.getTechnicianByExternalId(responsibleExtId);
                    console.log('TMDialogService: getTechnicianByExternalId returned:', defaultTech);
                    if (defaultTech) {
                        defaultTechId = defaultTech.id;
                        defaultTechDisplay = defaultTech.displayText;
                        TMCreationService.setDefaultTechnician(defaultTech);
                        console.log('TMDialogService: Default technician SET:', defaultTechDisplay);
                    } else {
                        console.warn('TMDialogService: Technician NOT FOUND for externalId:', responsibleExtId);
                    }
                } else {
                    console.log('TMDialogService: No valid responsibleExternalId provided');
                }
                
                console.log('TMDialogService: Final default technician:', { id: defaultTechId, displayText: defaultTechDisplay });
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

            // Load Items for dropdown (with search/filter support)
            let itemSuggestions = [];
            let defaultItemDisplay = "";
            let defaultItemId = "";
            try {
                await ItemService.fetchItems();
                itemSuggestions = ItemService.getAllForSuggestions();
                console.log('TMDialogService: Loaded', itemSuggestions.length, 'items');
                
                // Debug: Log first few items to verify data structure
                if (itemSuggestions.length > 0) {
                    console.log('TMDialogService: Sample items:', itemSuggestions.slice(0, 3));
                }
                
                // Set default item from Service Product (externalId)
                const serviceProductExtId = activityData.serviceProductExternalId;
                console.log('TMDialogService: Looking for serviceProductExternalId:', serviceProductExtId);
                console.log('TMDialogService: activityData.serviceProduct:', activityData.serviceProduct);
                
                if (serviceProductExtId && serviceProductExtId !== 'N/A') {
                    const defaultItem = ItemService.getItemSuggestionByExternalId(serviceProductExtId);
                    console.log('TMDialogService: getItemSuggestionByExternalId returned:', defaultItem);
                    if (defaultItem) {
                        defaultItemDisplay = defaultItem.displayText;
                        defaultItemId = defaultItem.id;
                        console.log('TMDialogService: Default item SET:', defaultItemDisplay);
                    } else {
                        console.warn('TMDialogService: Item NOT FOUND for externalId:', serviceProductExtId);
                        // Try to find if item exists with different case
                        const allItems = ItemService.getAllForSuggestions();
                        const matchingItem = allItems.find(i => 
                            i.externalId && i.externalId.toLowerCase() === serviceProductExtId.toLowerCase()
                        );
                        if (matchingItem) {
                            console.log('TMDialogService: Found case-insensitive match:', matchingItem);
                        }
                    }
                } else {
                    console.log('TMDialogService: No valid serviceProductExternalId provided');
                }
                
                // Set default item in TMCreationService for new entries
                TMCreationService.setDefaultItem({
                    id: defaultItemId,
                    displayText: defaultItemDisplay
                });
                console.log('TMDialogService: Final default item:', { id: defaultItemId, displayText: defaultItemDisplay });
            } catch (error) {
                console.error('TMDialogService: Failed to load items:', error);
                MessageToast.show("Warning: Item search may not be available");
            }

            // Load Expense Types for dropdown (only 6 items)
            let expenseTypeSuggestions = [];
            try {
                await ExpenseTypeService.fetchExpenseTypes();
                expenseTypeSuggestions = ExpenseTypeService.getExpenseTypesForDropdown();
                console.log('TMDialogService: Loaded', expenseTypeSuggestions.length, 'expense types');
                console.log('TMDialogService: Available expense type codes:', expenseTypeSuggestions.map(et => et.code));
                
                // Set default expense type to Z40000001 - Reisenebenkosten (should be first after sorting)
                if (expenseTypeSuggestions.length > 0) {
                    // Find Z40000001 specifically, fallback to first if not found
                    let defaultExpType = expenseTypeSuggestions.find(et => et.code === 'Z40000001');
                    console.log('TMDialogService: Find result for Z40000001:', defaultExpType);
                    
                    if (!defaultExpType) {
                        // Use first item (which should be Z40000001 after sorting, but fallback if not)
                        defaultExpType = expenseTypeSuggestions[0];
                        console.log('TMDialogService: Z40000001 not found, using first:', defaultExpType.code);
                    }
                    
                    TMCreationService.setDefaultExpenseType({
                        id: defaultExpType.key,
                        code: defaultExpType.code,
                        displayText: defaultExpType.text
                    });
                    console.log('TMDialogService: Default expense type SET:', defaultExpType.text);
                }
            } catch (error) {
                console.error('TMDialogService: Failed to load expense types:', error);
                MessageToast.show("Warning: Expense types may not be available");
            }

            // Create dialog model with empty entries array
            // Parse quantity for max constraint (handle "1.0" or "N/A")
            let maxQuantity = 9999; // Default high value if not parseable
            if (activityData.quantity && activityData.quantity !== 'N/A') {
                const parsed = parseFloat(activityData.quantity);
                if (!isNaN(parsed) && parsed > 0) {
                    maxQuantity = parsed;
                }
            }
            console.log('TMDialogService: Max quantity set to:', maxQuantity);

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
                maxQuantity: maxQuantity,  // Max quantity for StepInput constraint
                responsibleExternalId: activityData.responsibleExternalId,
                entries: [],  // Dynamic array for T&M entries
                // Technician suggestions for Input with suggestions
                technicianSuggestions: TechnicianService.getAllForDropdown(),
                // Item suggestions for Input with suggestions
                itemSuggestions: itemSuggestions,
                // Time Task suggestions for Select dropdown (all tasks - for Time Effort)
                taskSuggestions: taskSuggestions,
                // Filtered task suggestions for Time & Material columns
                taskSuggestionsAZ: taskSuggestionsAZ,  // Arbeitszeit
                taskSuggestionsFZ: taskSuggestionsFZ,  // Fahrzeit
                taskSuggestionsWZ: taskSuggestionsWZ,  // Wartezeit
                // Expense type suggestions for Select dropdown
                expenseTypeSuggestions: expenseTypeSuggestions
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
                // Clear default values
                TMCreationService.clearDefaultTechnician();
                TMCreationService.clearDefaultItem();
                TMCreationService.clearDefaultExpenseType();
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
                // Called from TMReportsDialog - get from dialog model
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