/**
 * TMDialogMixin.js
 * 
 * Mixin containing T&M (Time & Materials) dialog event handlers.
 * Mixed into View1.controller.js to handle T&M reporting UI interactions.
 * 
 * Sections:
 * - T&M Reports Dialog (view/edit existing entries)
 * - T&M Creation Dialog (add new entries)
 * - Entry Type Buttons (add Time Effort, Material, Expense, Mileage)
 * - Per-Entry Actions (close, save)
 * - Duration/DateTime Change Handlers
 * 
 * @file TMDialogMixin.js
 * @module mobileappsc/controller/mixin/TMDialogMixin
 */
sap.ui.define([
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "mobileappsc/utils/tm/TMDialogService",
    "mobileappsc/utils/tm/TMCreationService",
    "mobileappsc/utils/tm/TMDataService",
    "mobileappsc/utils/tm/TMPayloadService",
    "mobileappsc/utils/tm/TMEditService",
    "mobileappsc/utils/helpers/DateTimeService",
    "mobileappsc/utils/services/UdfMetaService",
    "mobileappsc/utils/services/ApprovalService",
    "mobileappsc/utils/services/PersonService",
    "mobileappsc/utils/services/TimeTaskService",
    "mobileappsc/utils/services/ItemService",
    "mobileappsc/utils/services/ExpenseTypeService"
], (MessageToast, MessageBox, TMDialogService, TMCreationService, TMDataService, TMPayloadService, TMEditService, DateTimeService, UdfMetaService, ApprovalService, PersonService, TimeTaskService, ItemService, ExpenseTypeService) => {
    "use strict";

    return {

        /* ========================================
         * T&M REPORTS DIALOG METHODS
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
         * View T&M Reports (opens dialog)
         */
        async onViewTMReports(oEvent) {
            const oButton = oEvent.getSource();
            const oContext = oButton.getBindingContext("view");

            if (!oContext) return;

            const oActivity = oContext.getObject();

            try {
                let reports = oActivity.tmReports;
                
                if (!oActivity.tmReportsLoaded || !reports || reports.length === 0) {
                    console.log('Loading fresh T&M data for activity:', oActivity.code);
                    const tmData = await TMDataService.loadTMReports(oActivity.id);
                    reports = tmData.reports;
                }

                await this._enrichTMReports(reports);
                await TMDialogService.openTMReportsDialog(oActivity, reports);

            } catch (error) {
                console.error('Error loading T&M data:', error);
                MessageToast.show("Failed to load T&M data: " + error.message);
            }
        },

        /**
         * Enrich T&M reports with lookup data
         */
        async _enrichTMReports(reports) {
            await UdfMetaService.preloadUdfMetaForReports(reports);
            await ApprovalService.preloadStatusesForReports(reports);

            const personIds = reports
                .map(r => r.createPerson)
                .filter(id => id && id !== 'N/A');

            if (personIds.length > 0) {
                await PersonService.preloadPersonsById(personIds);
            }

            reports.forEach(report => {
                report.editMode = false;
                
                // Technician
                if (report.createPerson) {
                    report.createPersonDisplayText = PersonService.getPersonDisplayTextById(report.createPerson);
                } else {
                    report.createPersonDisplayText = 'N/A';
                }
                
                // Time Effort: task name
                if (report.type === "Time Effort" && report.task) {
                    report.taskDisplayText = TimeTaskService.getTaskDisplayTextById(report.task);
                }
                
                // Material: item name
                if (report.type === "Material" && report.fullData?.item) {
                    report.itemDisplayText = ItemService.getItemDisplayTextById(report.fullData.item);
                }
                
                // Expense: type name
                if ((report.type === "Expense" || report.type === "Expense Report") && report.fullData?.type) {
                    report.expenseTypeDisplayText = ExpenseTypeService.getExpenseTypeDisplayTextById(report.fullData.type);
                }
                
                // Mileage: type from UDF
                if (report.type === "Mileage" || report.type === "Mileage Report") {
                    const mileageTypeValue = this._getUdfValueByExternalId(report.udfValues, "Z_Mileage_MatID");
                    if (mileageTypeValue) {
                        report.mileageTypeDisplayText = ItemService.getItemDisplayTextByExternalId(mileageTypeValue);
                    } else {
                        report.mileageTypeDisplayText = 'N/A';
                    }
                    
                    if (report.travelStartDateTime && report.travelEndDateTime) {
                        const startTime = new Date(report.travelStartDateTime);
                        const endTime = new Date(report.travelEndDateTime);
                        report.travelDurationMinutes = Math.round((endTime - startTime) / (1000 * 60));
                        report.travelDurationText = `${report.travelDurationMinutes} min`;
                    } else {
                        report.travelDurationMinutes = 0;
                        report.travelDurationText = 'N/A';
                    }
                }
                
                // UDF values
                if (report.udfValues && report.udfValues.length > 0) {
                    report.udfValuesText = UdfMetaService.formatUdfValuesForDisplay(report.udfValues);
                }

                // Approval status
                const approvalStatus = ApprovalService.getStatusById(report.id);
                report.decisionStatus = approvalStatus;
                report.decisionStatusText = ApprovalService.getStatusDisplayText(approvalStatus);
                report.decisionStatusState = ApprovalService.getStatusState(approvalStatus);

                // Entry header
                report.entryHeaderText = this._buildEntryHeaderText(report);
            });
        },

        /**
         * Close T&M Reports Dialog
         */
        onCloseTMReportsDialog() {
            TMDialogService.closeTMReportsDialog();
        },

        /**
         * Extract activityId from model path or model property
         * For view model: path is /productGroups/X/activities/Y/tmReports/Z
         * For dialog model: activityId is at /activityId
         * @private
         */
        _getActivityIdFromPath(sPath, oModel) {
            // Check if this is a dialog model (has /activityId)
            const dialogActivityId = oModel.getProperty("/activityId");
            if (dialogActivityId) {
                return dialogActivityId;
            }
            
            // For view model, extract activity path and get activity id
            // Path format: /productGroups/X/activities/Y/tmReports/Z
            const activityPathMatch = sPath.match(/^(\/productGroups\/\d+\/activities\/\d+)/);
            if (activityPathMatch) {
                const activityPath = activityPathMatch[1];
                const activity = oModel.getProperty(activityPath);
                if (activity && activity.id) {
                    return activity.id;
                }
            }
            
            console.warn('TMDialogMixin: Could not extract activityId from path:', sPath);
            return null;
        },

        /**
         * Toggle Edit Mode for T&M Entry
         */
        onToggleEditMode(oEvent) {
            const oButton = oEvent.getSource();
            
            // Try view context first (inline entries), then dialog context
            let oContext = oButton.getBindingContext("view");
            let oModel, sModelName;
            
            if (oContext) {
                // Inline mode - using view model
                oModel = this.getView().getModel("view");
                sModelName = "view";
            } else {
                // Dialog mode - using dialog model (legacy)
                oContext = oButton.getBindingContext("dialog");
                if (!oContext) return;
                oModel = this._tmReportsDialog.getModel("dialog");
                sModelName = "dialog";
            }

            const sPath = oContext.getPath();
            const bCurrentEditMode = oModel.getProperty(sPath + "/editMode") || false;
            const sType = oModel.getProperty(sPath + "/type");
            const oEntry = oContext.getObject();

            if (bCurrentEditMode) {
                // Exiting edit mode -> Show confirmation for update
                if (sType === "Expense") {
                    this._showExpenseUpdateConfirmation(oEntry, sPath, oModel);
                    return;
                }

                if (sType === "Mileage") {
                    this._showMileageUpdateConfirmation(oEntry, sPath, oModel);
                    return;
                }

                if (sType === "Material") {
                    this._showMaterialUpdateConfirmation(oEntry, sPath, oModel);
                    return;
                }

                if (sType === "Time Effort") {
                    this._showTimeEffortUpdateConfirmation(oEntry, sPath, oModel);
                    return;
                }

                // Fallback - exit edit mode
                oModel.setProperty(sPath + "/editMode", false);
            } else {
                // Entering edit mode - initialize edit fields
                const editValues = TMEditService.initEditMode(sType, oEntry);
                TMEditService.applyEditValues(oModel, sPath, editValues);
                oModel.setProperty(sPath + "/editMode", true);
            }
        },

        /**
         * Handle duration change in edit mode (Time Effort)
         */
        onEditDurationChange(oEvent) {
            // Try view context first, then dialog context
            let oContext = oEvent.getSource().getBindingContext("view");
            let oModel;
            
            if (oContext) {
                oModel = this.getView().getModel("view");
            } else {
                oContext = oEvent.getSource().getBindingContext("dialog");
                if (!oContext) return;
                oModel = this._tmReportsDialog.getModel("dialog");
            }

            const newDuration = oEvent.getParameter("value");
            TMEditService.handleDurationChange(oModel, oContext.getPath(), "Time Effort", newDuration);
        },

        /**
         * Handle mileage duration change in edit mode
         */
        onEditMileageDurationChange(oEvent) {
            // Try view context first, then dialog context
            let oContext = oEvent.getSource().getBindingContext("view");
            let oModel;
            
            if (oContext) {
                oModel = this.getView().getModel("view");
            } else {
                oContext = oEvent.getSource().getBindingContext("dialog");
                if (!oContext) return;
                oModel = this._tmReportsDialog.getModel("dialog");
            }

            const newDuration = oEvent.getParameter("value");
            TMEditService.handleDurationChange(oModel, oContext.getPath(), "Mileage", newDuration);
        },

        /* ========================================
         * T&M CREATION DIALOG METHODS
         * ======================================== */

        /**
         * Add new T&M Entry from inline button (main view)
         */
        async onAddNewTMEntry(oEvent) {
            const oButton = oEvent.getSource();
            const oContext = oButton.getBindingContext("view");

            if (!oContext) {
                MessageToast.show("Activity context not available");
                return;
            }

            const oActivity = oContext.getObject();
            
            const activityData = {
                activityId: oActivity.id,
                activityCode: oActivity.code,
                activitySubject: oActivity.subject,
                activityExternalId: oActivity.externalId || 'N/A',
                orgLevelId: oActivity.orgLevelId || null,
                serviceProduct: oActivity.serviceProductDisplayText || 'N/A',
                serviceProductExternalId: oActivity.serviceProductId || null,
                plannedStartDate: oActivity.plannedStartDate || null,
                formattedStartDate: oActivity.formattedStartDate || 'N/A',
                formattedEndDate: oActivity.formattedEndDate || 'N/A',
                formattedDuration: oActivity.formattedDuration || 'N/A',
                quantity: oActivity.quantity || 'N/A',
                quantityUoM: oActivity.quantityUoM || 'N/A',
                responsibleExternalId: oActivity.responsibleId || 'N/A'
            };

            if (!activityData.activityCode) {
                MessageToast.show("Activity information not available");
                return;
            }

            await TMDialogService.openTMCreationDialog(activityData);
        },

        /**
         * Add new T&M Report - Opens unified creation dialog (legacy, from dialog)
         */
        async onAddTMReport(oEvent) {
            const oButton = oEvent.getSource();
            const oContext = oButton.getBindingContext("view");

            const activityData = TMDialogService.extractActivityData(oContext, this._tmReportsDialog);

            if (!activityData.activityCode) {
                MessageToast.show("Activity information not available");
                return;
            }

            await TMDialogService.openTMCreationDialog(activityData);
        },

        /**
         * Add Time Effort Entry
         */
        onAddTimeEffortEntry() {
            const oModel = this._tmCreateDialog.getModel("createTM");
            const entry = TMCreationService.createTimeEffortEntry();
            TMCreationService.addEntryToModel(oModel, entry, "Time Effort");
        },

        /**
         * Add Material Entry
         */
        onAddMaterialEntry() {
            const oModel = this._tmCreateDialog.getModel("createTM");
            const entry = TMCreationService.createMaterialEntry();
            TMCreationService.addEntryToModel(oModel, entry, "Material");
        },

        /**
         * Add Expense Entry
         */
        onAddExpenseEntry() {
            const oModel = this._tmCreateDialog.getModel("createTM");
            const entry = TMCreationService.createExpenseEntry();
            TMCreationService.addEntryToModel(oModel, entry, "Expense");
        },

        /**
         * Add Mileage Entry
         */
        onAddMileageEntry() {
            const oModel = this._tmCreateDialog.getModel("createTM");
            const entry = TMCreationService.createMileageEntry();
            TMCreationService.addEntryToModel(oModel, entry, "Mileage");
        },

        /**
         * Add Time & Material Entry (combined)
         */
        onAddTimeAndMaterialEntry() {
            const oModel = this._tmCreateDialog.getModel("createTM");
            const entry = TMCreationService.createTimeAndMaterialEntry();
            TMCreationService.addEntryToModel(oModel, entry, "Time & Material");
        },

        /**
         * Cancel T&M Creation Dialog
         */
        onCancelCreateTM() {
            TMDialogService.closeTMCreationDialog();
        },

        /* ========================================
         * PER-ENTRY ACTION BUTTONS
         * ======================================== */

        /**
         * Close/Remove individual T&M entry
         */
        onCloseEntry(oEvent) {
            const oButton = oEvent.getSource();
            const oContext = oButton.getBindingContext("createTM");

            if (!oContext) {
                MessageToast.show("Could not identify entry to close");
                return;
            }

            const sPath = oContext.getPath();
            const oModel = this._tmCreateDialog.getModel("createTM");
            const oEntry = oContext.getObject();

            MessageBox.confirm(
                `Close this ${oEntry.type} entry without saving?`,
                {
                    title: "Close Entry",
                    onClose: (sAction) => {
                        if (sAction === MessageBox.Action.OK) {
                            const aEntries = oModel.getProperty("/entries");
                            const iIndex = parseInt(sPath.split("/").pop());
                            aEntries.splice(iIndex, 1);
                            oModel.setProperty("/entries", aEntries);
                            MessageToast.show(`${oEntry.type} entry closed`);
                        }
                    }
                }
            );
        },

        /**
         * Save individual T&M entry
         */
        onSaveEntry(oEvent) {
            const oButton = oEvent.getSource();
            const oContext = oButton.getBindingContext("createTM");

            if (!oContext) {
                MessageToast.show("Could not identify entry to save");
                return;
            }

            const sPath = oContext.getPath();
            const oModel = this._tmCreateDialog.getModel("createTM");
            const oEntry = oContext.getObject();
            const sCurrentState = oEntry.saveButtonState || "unsaved";

            // Handle Expense with direct confirmation flow
            if (oEntry.type === "Expense" || oEntry.type === "Expense Report") {
                this._showExpenseConfirmation(oEntry, sPath, oModel);
                return;
            }

            // Handle Mileage with direct confirmation flow
            if (oEntry.type === "Mileage" || oEntry.type === "Mileage Report") {
                this._showMileageConfirmation(oEntry, sPath, oModel);
                return;
            }

            // Handle Time & Material with direct confirmation flow
            if (oEntry.type === "Time & Material") {
                this._showTimeAndMaterialConfirmation(oEntry, sPath, oModel);
                return;
            }

            // Standard flow for other entry types
            switch (sCurrentState) {
                case "unsaved":
                    oModel.setProperty(sPath + "/saveButtonState", "ready");
                    oModel.setProperty(sPath + "/saveButtonText", "Send for Approval");
                    oModel.setProperty(sPath + "/saveButtonIcon", "sap-icon://paper-plane");
                    MessageToast.show("Ready to send");
                    break;

                case "ready":
                    this._showEntryJSON(oEntry);
                    oModel.setProperty(sPath + "/saveButtonState", "done");
                    oModel.setProperty(sPath + "/saveButtonText", "Done!");
                    oModel.setProperty(sPath + "/saveButtonIcon", "sap-icon://accept");
                    oModel.setProperty(sPath + "/saveButtonType", "Success");
                    break;

                case "done":
                    MessageToast.show("Entry already processed");
                    break;

                default:
                    MessageToast.show("Unknown entry state");
            }
        },

        /**
         * Show Expense confirmation dialog with preview
         * @private
         */
        _showExpenseConfirmation(oEntry, sPath, oModel) {
            const oDialogModel = this._tmCreateDialog.getModel("createTM");
            const activityId = oDialogModel.getProperty("/activityId");
            const activityCode = oDialogModel.getProperty("/activityExternalId");
            const orgLevelId = oDialogModel.getProperty("/orgLevelId");

            const payload = TMPayloadService.buildPayload(oEntry, activityId, orgLevelId);
            
            // Format preview text
            const previewText = this._formatExpensePreview(oEntry, payload);

            MessageBox.confirm(previewText, {
                title: "Confirm Expense Report",
                actions: ["Send for Approval", MessageBox.Action.CLOSE],
                emphasizedAction: "Send for Approval",
                styleClass: "sapUiSizeCompact",
                onClose: (sAction) => {
                    if (sAction === "Send for Approval") {
                        this._submitExpenseToFSM(payload, oEntry, sPath, oModel, activityCode);
                    }
                }
            });
        },

        /**
         * Format expense preview for confirmation dialog
         * @private
         */
        _formatExpensePreview(oEntry, payload) {
            const lines = [
                `Type: ${oEntry.expenseTypeDisplay || 'N/A'}`,
                `Technician: ${oEntry.technicianDisplay || 'N/A'}`,
                `Date: ${payload.date || 'N/A'}`,
                `External Amount: ${payload.externalAmount?.amount || 0} EUR`,
                `Internal Amount: ${payload.internalAmount?.amount || 0} EUR`,
                `Remarks: ${oEntry.remarks || 'N/A'}`,
                '',
                'Send this expense for approval?'
            ];
            return lines.join('\n');
        },

        /**
         * Submit expense to FSM API
         * @private
         */
        async _submitExpenseToFSM(payload, oEntry, sPath, oModel, activityCode) {
            try {
                // Show busy indicator
                sap.ui.core.BusyIndicator.show(0);

                const response = await fetch('/api/create-expense', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const result = await response.json();

                sap.ui.core.BusyIndicator.hide();

                if (result.success) {
                    // Get activity ID before closing dialog
                    const activityId = oModel.getProperty("/activityId");
                    
                    // Close the Create dialog
                    TMDialogService.closeTMCreationDialog();
                    
                    // Refresh T&M Reports data
                    await this._refreshTMReportsAfterCreate(activityId);
                    
                    MessageBox.success(
                        `Expense Report created successfully for Activity ${activityCode}`,
                        { title: "Success" }
                    );
                } else {
                    MessageBox.error(
                        `Failed to create expense: ${result.message || 'Unknown error'}`,
                        { title: "Error" }
                    );
                }

            } catch (error) {
                sap.ui.core.BusyIndicator.hide();
                console.error('TMDialogMixin: Error submitting expense:', error);
                MessageBox.error(
                    `Error creating expense: ${error.message}`,
                    { title: "Error" }
                );
            }
        },

        /**
         * Show Expense update confirmation dialog with preview
         * @private
         */
        _showExpenseUpdateConfirmation(oEntry, sPath, oModel) {
            const editedValues = TMEditService.getEditedValues("Expense", oModel, sPath);
            
            // Build payload without ID (ID goes in URL) - date is read-only
            const payload = {
                externalAmount: { amount: parseFloat(editedValues.externalAmount) || 0, currency: "EUR" },
                internalAmount: { amount: parseFloat(editedValues.internalAmount) || 0, currency: "EUR" },
                remarks: editedValues.remarks || ""
            };
            
            // Format preview text
            const previewText = this._formatExpenseUpdatePreview(oEntry, payload);

            MessageBox.confirm(previewText, {
                title: "Confirm Expense Update",
                actions: ["Send for Approval", MessageBox.Action.CLOSE],
                emphasizedAction: "Send for Approval",
                styleClass: "sapUiSizeCompact",
                onClose: (sAction) => {
                    if (sAction === "Send for Approval") {
                        this._submitExpenseUpdate(oEntry.id, payload, sPath, oModel);
                    }
                }
            });
        },

        /**
         * Format expense update preview for confirmation dialog
         * @private
         */
        _formatExpenseUpdatePreview(oEntry, payload) {
            const lines = [
                `Expense ID: ${oEntry.id}`,
                `Type: ${oEntry.expenseTypeDisplayText || 'N/A'}`,
                '',
                'Updated Values:',
                `External Amount: ${payload.externalAmount?.amount || 0} EUR`,
                `Internal Amount: ${payload.internalAmount?.amount || 0} EUR`,
                `Remarks: ${payload.remarks || 'N/A'}`,
                '',
                'Send this update for approval?'
            ];
            return lines.join('\n');
        },

        /**
         * Submit expense update to FSM API
         * @private
         */
        async _submitExpenseUpdate(expenseId, payload, sPath, oModel) {
            try {
                sap.ui.core.BusyIndicator.show(0);

                const response = await fetch(`/api/update-expense/${expenseId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const result = await response.json();

                sap.ui.core.BusyIndicator.hide();

                if (result.success) {
                    // Exit edit mode
                    oModel.setProperty(sPath + "/editMode", false);
                    
                    // Refresh T&M Reports data
                    const activityId = this._getActivityIdFromPath(sPath, oModel);
                    if (activityId) {
                        await this._refreshTMReportsAfterCreate(activityId);
                    }
                    
                    MessageBox.success(
                        `Expense updated successfully`,
                        { title: "Success" }
                    );
                } else {
                    MessageBox.error(
                        `Failed to update expense: ${result.message || 'Unknown error'}`,
                        { title: "Error" }
                    );
                }

            } catch (error) {
                sap.ui.core.BusyIndicator.hide();
                console.error('TMDialogMixin: Error updating expense:', error);
                MessageBox.error(
                    `Error updating expense: ${error.message}`,
                    { title: "Error" }
                );
            }
        },

        /**
         * Show Mileage update confirmation dialog with preview
         * @private
         */
        _showMileageUpdateConfirmation(oEntry, sPath, oModel) {
            const editedValues = TMEditService.getEditedValues("Mileage", oModel, sPath);
            
            // Calculate travelEndDateTime from travelStartDateTime + duration
            const travelStartDateTime = oEntry.travelStartDateTime;
            const durationMinutes = parseInt(editedValues.travelDuration) || 0;
            
            let travelEndDateTime = editedValues.travelEndDateTime;
            if (travelStartDateTime && durationMinutes >= 0) {
                const startDate = new Date(travelStartDateTime);
                const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
                travelEndDateTime = endDate.toISOString().replace(/\.\d{3}Z$/, 'Z');
            }
            
            // Build payload - only fields we are changing
            const payload = {
                distance: parseFloat(editedValues.distance) || 0,
                distanceUnit: "KM",
                travelStartDateTime: travelStartDateTime,
                travelEndDateTime: travelEndDateTime,
                remarks: editedValues.remarks || ""
            };
            
            // Format preview text
            const previewText = this._formatMileageUpdatePreview(oEntry, payload, durationMinutes);

            MessageBox.confirm(previewText, {
                title: "Confirm Mileage Update",
                actions: ["Send for Approval", MessageBox.Action.CLOSE],
                emphasizedAction: "Send for Approval",
                styleClass: "sapUiSizeCompact",
                onClose: (sAction) => {
                    if (sAction === "Send for Approval") {
                        this._submitMileageUpdate(oEntry.id, payload, sPath, oModel);
                    }
                }
            });
        },

        /**
         * Format mileage update preview for confirmation dialog
         * @private
         */
        _formatMileageUpdatePreview(oEntry, payload, durationMinutes) {
            const lines = [
                `Mileage ID: ${oEntry.id}`,
                `Type: ${oEntry.mileageTypeDisplayText || 'N/A'}`,
                '',
                'Updated Values:',
                `Distance: ${payload.distance} KM`,
                `Duration: ${durationMinutes} min`,
                `Start: ${payload.travelStartDateTime}`,
                `End: ${payload.travelEndDateTime}`,
                `Remarks: ${payload.remarks || 'N/A'}`,
                '',
                'Send this update for approval?'
            ];
            return lines.join('\n');
        },

        /**
         * Submit mileage update to FSM API
         * @private
         */
        async _submitMileageUpdate(mileageId, payload, sPath, oModel) {
            try {
                sap.ui.core.BusyIndicator.show(0);

                const response = await fetch(`/api/update-mileage/${mileageId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const result = await response.json();

                sap.ui.core.BusyIndicator.hide();

                if (result.success) {
                    // Exit edit mode
                    oModel.setProperty(sPath + "/editMode", false);
                    
                    // Refresh T&M Reports data
                    const activityId = this._getActivityIdFromPath(sPath, oModel);
                    if (activityId) {
                        await this._refreshTMReportsAfterCreate(activityId);
                    }
                    
                    MessageBox.success(
                        `Mileage updated successfully`,
                        { title: "Success" }
                    );
                } else {
                    MessageBox.error(
                        `Failed to update mileage: ${result.message || 'Unknown error'}`,
                        { title: "Error" }
                    );
                }

            } catch (error) {
                sap.ui.core.BusyIndicator.hide();
                console.error('TMDialogMixin: Error updating mileage:', error);
                MessageBox.error(
                    `Error updating mileage: ${error.message}`,
                    { title: "Error" }
                );
            }
        },

        /**
         * Show Material update confirmation dialog with preview
         * @private
         */
        _showMaterialUpdateConfirmation(oEntry, sPath, oModel) {
            const editedValues = TMEditService.getEditedValues("Material", oModel, sPath);
            
            // Build payload - only fields we are changing (date is read-only)
            const payload = {
                quantity: parseFloat(editedValues.quantity) || 0,
                remarks: editedValues.remarks || ""
            };
            
            // Format preview text
            const previewText = this._formatMaterialUpdatePreview(oEntry, payload);

            MessageBox.confirm(previewText, {
                title: "Confirm Material Update",
                actions: ["Send for Approval", MessageBox.Action.CLOSE],
                emphasizedAction: "Send for Approval",
                styleClass: "sapUiSizeCompact",
                onClose: (sAction) => {
                    if (sAction === "Send for Approval") {
                        this._submitMaterialUpdate(oEntry.id, payload, sPath, oModel);
                    }
                }
            });
        },

        /**
         * Format material update preview for confirmation dialog
         * @private
         */
        _formatMaterialUpdatePreview(oEntry, payload) {
            const lines = [
                `Material ID: ${oEntry.id}`,
                `Item: ${oEntry.itemDisplayText || 'N/A'}`,
                '',
                'Updated Values:',
                `Quantity: ${payload.quantity}`,
                `Remarks: ${payload.remarks || 'N/A'}`,
                '',
                'Send this update for approval?'
            ];
            return lines.join('\n');
        },

        /**
         * Submit material update to FSM API
         * @private
         */
        async _submitMaterialUpdate(materialId, payload, sPath, oModel) {
            try {
                sap.ui.core.BusyIndicator.show(0);

                const response = await fetch(`/api/update-material/${materialId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const result = await response.json();

                sap.ui.core.BusyIndicator.hide();

                if (result.success) {
                    // Exit edit mode
                    oModel.setProperty(sPath + "/editMode", false);
                    
                    // Refresh T&M Reports data
                    const activityId = this._getActivityIdFromPath(sPath, oModel);
                    if (activityId) {
                        await this._refreshTMReportsAfterCreate(activityId);
                    }
                    
                    MessageBox.success(
                        `Material updated successfully`,
                        { title: "Success" }
                    );
                } else {
                    MessageBox.error(
                        `Failed to update material: ${result.message || 'Unknown error'}`,
                        { title: "Error" }
                    );
                }

            } catch (error) {
                sap.ui.core.BusyIndicator.hide();
                console.error('TMDialogMixin: Error updating material:', error);
                MessageBox.error(
                    `Error updating material: ${error.message}`,
                    { title: "Error" }
                );
            }
        },

        /**
         * Show TimeEffort update confirmation dialog with preview
         * @private
         */
        _showTimeEffortUpdateConfirmation(oEntry, sPath, oModel) {
            const editedValues = TMEditService.getEditedValues("Time Effort", oModel, sPath);
            
            // Calculate endDateTime from startDateTime + duration
            const startDateTime = oEntry.startDateTime;
            const durationMinutes = parseInt(editedValues.durationMinutes) || 0;
            
            let endDateTime = editedValues.endDateTime;
            if (startDateTime && durationMinutes >= 0) {
                const startDate = new Date(startDateTime);
                const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
                endDateTime = endDate.toISOString().replace(/\.\d{3}Z$/, 'Z');
            }
            
            // Build payload - only fields we are changing
            const payload = {
                endDateTime: endDateTime,
                remarks: editedValues.remarks || ""
            };
            
            // Format preview text
            const previewText = this._formatTimeEffortUpdatePreview(oEntry, payload, durationMinutes);

            MessageBox.confirm(previewText, {
                title: "Confirm Time Effort Update",
                actions: ["Send for Approval", MessageBox.Action.CLOSE],
                emphasizedAction: "Send for Approval",
                styleClass: "sapUiSizeCompact",
                onClose: (sAction) => {
                    if (sAction === "Send for Approval") {
                        this._submitTimeEffortUpdate(oEntry.id, payload, sPath, oModel);
                    }
                }
            });
        },

        /**
         * Format time effort update preview for confirmation dialog
         * @private
         */
        _formatTimeEffortUpdatePreview(oEntry, payload, durationMinutes) {
            const lines = [
                `Time Effort ID: ${oEntry.id}`,
                `Task: ${oEntry.taskDisplayText || 'N/A'}`,
                '',
                'Updated Values:',
                `Duration: ${durationMinutes} min`,
                `Start: ${oEntry.startDateTime}`,
                `End: ${payload.endDateTime}`,
                `Remarks: ${payload.remarks || 'N/A'}`,
                '',
                'Send this update for approval?'
            ];
            return lines.join('\n');
        },

        /**
         * Submit time effort update to FSM API
         * @private
         */
        async _submitTimeEffortUpdate(timeEffortId, payload, sPath, oModel) {
            try {
                sap.ui.core.BusyIndicator.show(0);

                const response = await fetch(`/api/update-time-effort/${timeEffortId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const result = await response.json();

                sap.ui.core.BusyIndicator.hide();

                if (result.success) {
                    // Exit edit mode
                    oModel.setProperty(sPath + "/editMode", false);
                    
                    // Refresh T&M Reports data
                    const activityId = this._getActivityIdFromPath(sPath, oModel);
                    if (activityId) {
                        await this._refreshTMReportsAfterCreate(activityId);
                    }
                    
                    MessageBox.success(
                        `Time Effort updated successfully`,
                        { title: "Success" }
                    );
                } else {
                    MessageBox.error(
                        `Failed to update time effort: ${result.message || 'Unknown error'}`,
                        { title: "Error" }
                    );
                }

            } catch (error) {
                sap.ui.core.BusyIndicator.hide();
                console.error('TMDialogMixin: Error updating time effort:', error);
                MessageBox.error(
                    `Error updating time effort: ${error.message}`,
                    { title: "Error" }
                );
            }
        },

        /**
         * Show Mileage confirmation dialog with preview
         * @private
         */
        _showMileageConfirmation(oEntry, sPath, oModel) {
            const oDialogModel = this._tmCreateDialog.getModel("createTM");
            const activityId = oDialogModel.getProperty("/activityId");
            const activityCode = oDialogModel.getProperty("/activityExternalId");
            const orgLevelId = oDialogModel.getProperty("/orgLevelId");

            const payload = TMPayloadService.buildPayload(oEntry, activityId, orgLevelId);
            
            // Format preview text
            const previewText = this._formatMileagePreview(oEntry, payload);

            MessageBox.confirm(previewText, {
                title: "Confirm Mileage Report",
                actions: ["Send for Approval", MessageBox.Action.CLOSE],
                emphasizedAction: "Send for Approval",
                styleClass: "sapUiSizeCompact",
                onClose: (sAction) => {
                    if (sAction === "Send for Approval") {
                        this._submitMileageToFSM(payload, oEntry, sPath, oModel, activityCode);
                    }
                }
            });
        },

        /**
         * Format mileage preview for confirmation dialog
         * @private
         */
        _formatMileagePreview(oEntry, payload) {
            const lines = [
                `Type: ${oEntry.itemDisplay || 'N/A'}`,
                `Technician: ${oEntry.technicianDisplay || 'N/A'}`,
                `Distance: ${oEntry.distance || 0} KM`,
                `Duration: ${oEntry.travelDuration || 0} min`,
                `Remarks: ${oEntry.remarks || 'N/A'}`,
                '',
                'Send this mileage report for approval?'
            ];
            return lines.join('\n');
        },

        /**
         * Submit mileage to FSM API
         * @private
         */
        async _submitMileageToFSM(payload, oEntry, sPath, oModel, activityCode) {
            try {
                // Show busy indicator
                sap.ui.core.BusyIndicator.show(0);

                const response = await fetch('/api/create-mileage', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const result = await response.json();

                sap.ui.core.BusyIndicator.hide();

                if (result.success) {
                    // Get activity ID before closing dialog
                    const activityId = oModel.getProperty("/activityId");
                    
                    // Close the Create dialog
                    TMDialogService.closeTMCreationDialog();
                    
                    // Refresh T&M Reports data
                    await this._refreshTMReportsAfterCreate(activityId);
                    
                    MessageBox.success(
                        `Mileage Report created successfully for Activity ${activityCode}`,
                        { title: "Success" }
                    );
                } else {
                    MessageBox.error(
                        `Failed to create mileage: ${result.message || 'Unknown error'}`,
                        { title: "Error" }
                    );
                }

            } catch (error) {
                sap.ui.core.BusyIndicator.hide();
                console.error('TMDialogMixin: Error submitting mileage:', error);
                MessageBox.error(
                    `Error creating mileage: ${error.message}`,
                    { title: "Error" }
                );
            }
        },

        /**
         * Show Time & Material confirmation dialog with preview
         * @private
         */
        _showTimeAndMaterialConfirmation(oEntry, sPath, oModel) {
            // Validate mandatory Task fields for all time entries
            const validation = this._validateTimeAndMaterialTasks(oEntry);
            if (!validation.valid) {
                MessageBox.error(validation.message, {
                    title: "Validation Error",
                    styleClass: "sapUiSizeCompact"
                });
                return;
            }

            const oDialogModel = this._tmCreateDialog.getModel("createTM");
            const activityId = oDialogModel.getProperty("/activityId");
            const activityCode = oDialogModel.getProperty("/activityExternalId");
            const orgLevelId = oDialogModel.getProperty("/orgLevelId");

            const payload = TMPayloadService.buildPayload(oEntry, activityId, orgLevelId);
            
            // Format preview text
            const previewText = this._formatTimeAndMaterialPreview(oEntry, payload);

            MessageBox.confirm(previewText, {
                title: "Confirm Time & Material Report",
                actions: ["Send for Approval", MessageBox.Action.CLOSE],
                emphasizedAction: "Send for Approval",
                styleClass: "sapUiSizeCompact",
                onClose: (sAction) => {
                    if (sAction === "Send for Approval") {
                        this._submitTimeAndMaterialToFSM(payload, oEntry, sPath, oModel, activityCode);
                    }
                }
            });
        },

        /**
         * Validate mandatory Task fields for Time & Material entries
         * @private
         */
        _validateTimeAndMaterialTasks(oEntry) {
            const errors = [];
            
            // Check Arbeitszeit entries
            (oEntry.timeEffortsAZ || []).forEach((entry, idx) => {
                if (!entry.taskCode) {
                    errors.push(`Time - Arbeitszeit entry ${idx + 1}: Task is required`);
                }
            });
            
            // Check Fahrzeit entries
            (oEntry.timeEffortsFZ || []).forEach((entry, idx) => {
                if (!entry.taskCode) {
                    errors.push(`Time - Fahrzeit entry ${idx + 1}: Task is required`);
                }
            });
            
            // Check Wartezeit entries
            (oEntry.timeEffortsWZ || []).forEach((entry, idx) => {
                if (!entry.taskCode) {
                    errors.push(`Time - Wartezeit entry ${idx + 1}: Task is required`);
                }
            });
            
            if (errors.length > 0) {
                return {
                    valid: false,
                    message: "Please select a Task for all Time entries or remove entries without a Task:\n\n" + errors.join("\n")
                };
            }
            
            return { valid: true };
        },

        /**
         * Format Time & Material preview for confirmation dialog
         * @private
         */
        _formatTimeAndMaterialPreview(oEntry, payload) {
            const timeEffortCount = (oEntry.timeEffortsAZ?.length || 0) + 
                                    (oEntry.timeEffortsFZ?.length || 0) + 
                                    (oEntry.timeEffortsWZ?.length || 0);
            
            const lines = [
                `Material: ${oEntry.itemDisplay || 'N/A'}`,
                `Quantity: ${oEntry.quantity || 0}`,
                `Technician: ${oEntry.technicianDisplay || 'N/A'}`,
                `Time Efforts: ${timeEffortCount} entries`,
                `  - Arbeitszeit (AZ): ${oEntry.timeEffortsAZ?.length || 0}`,
                `  - Fahrzeit (FZ): ${oEntry.timeEffortsFZ?.length || 0}`,
                `  - Wartezeit (WZ): ${oEntry.timeEffortsWZ?.length || 0}`,
                '',
                'Send this Time & Material report for approval?'
            ];
            return lines.join('\n');
        },

        /**
         * Submit Time & Material to FSM API (placeholder - returns to T&M Reports for now)
         * @private
         */
        async _submitTimeAndMaterialToFSM(payload, oEntry, sPath, oModel, activityCode) {
            try {
                // Show busy indicator
                sap.ui.core.BusyIndicator.show(0);

                // Payload contains: material, timeEffortsFZ, timeEffortsWZ, timeEffortsAZ
                const response = await fetch('/api/create-time-material', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const result = await response.json();

                sap.ui.core.BusyIndicator.hide();

                if (result.success || result.partialSuccess) {
                    // Get activity ID before closing dialog
                    const activityId = oModel.getProperty("/activityId");
                    
                    // Close the Create dialog
                    TMDialogService.closeTMCreationDialog();
                    
                    // Refresh T&M Reports data
                    await this._refreshTMReportsAfterCreate(activityId);
                    
                    // Count created items
                    const timeEffortCount = result.data?.timeEfforts?.length || 0;
                    
                    if (result.partialSuccess) {
                        MessageBox.warning(
                            `Time & Material created with some errors for Activity ${activityCode}.\n` +
                            `Material: Created\n` +
                            `Time Efforts: ${timeEffortCount} created, ${result.data?.errors?.length || 0} failed`,
                            { title: "Partial Success" }
                        );
                    } else {
                        MessageBox.success(
                            `Time & Material created successfully for Activity ${activityCode}.\n` +
                            `Material: 1\n` +
                            `Time Efforts: ${timeEffortCount}`,
                            { title: "Success" }
                        );
                    }
                } else {
                    MessageBox.error(
                        `Failed to create Time & Material: ${result.message || 'Unknown error'}`,
                        { title: "Error" }
                    );
                }

            } catch (error) {
                sap.ui.core.BusyIndicator.hide();
                console.error('TMDialogMixin: Error submitting Time & Material:', error);
                MessageBox.error(
                    `Error creating Time & Material: ${error.message}`,
                    { title: "Error" }
                );
            }
        },

        /**
         * Refresh T&M Reports after creating a new entry
         * @private
         */
        async _refreshTMReportsAfterCreate(activityId) {
            try {
                // Load fresh T&M data
                const tmData = await TMDataService.loadTMReports(activityId);
                
                // Clear approval cache to ensure fresh statuses
                ApprovalService.clearCache();
                
                // Preload lookups
                await UdfMetaService.preloadUdfMetaForReports(tmData.reports);
                await ApprovalService.preloadStatusesForReports(tmData.reports);
                
                const personIds = tmData.reports
                    .map(r => r.createPerson)
                    .filter(id => id && id !== 'N/A');
                if (personIds.length > 0) {
                    await PersonService.preloadPersonsById(personIds);
                }
                
                // Enrich each report
                tmData.reports.forEach(report => {
                    report.editMode = false;
                    
                    // Person name
                    if (report.createPerson) {
                        report.createPersonDisplayText = PersonService.getPersonDisplayTextById(report.createPerson);
                    } else {
                        report.createPersonDisplayText = 'N/A';
                    }
                    
                    // Time Effort: task name
                    if (report.type === "Time Effort" && report.task) {
                        report.taskDisplayText = TimeTaskService.getTaskDisplayTextById(report.task);
                    }
                    
                    // Material: item name
                    if (report.type === "Material" && report.fullData?.item) {
                        report.itemDisplayText = ItemService.getItemDisplayTextById(report.fullData.item);
                    }
                    
                    // Expense: type name
                    if ((report.type === "Expense" || report.type === "Expense Report") && report.fullData?.type) {
                        report.expenseTypeDisplayText = ExpenseTypeService.getExpenseTypeDisplayTextById(report.fullData.type);
                    }
                    
                    // Mileage: type from UDF
                    if (report.type === "Mileage" || report.type === "Mileage Report") {
                        const mileageTypeValue = this._getUdfValueByExternalId(report.udfValues, "Z_Mileage_MatID");
                        if (mileageTypeValue) {
                            report.mileageTypeDisplayText = ItemService.getItemDisplayTextByExternalId(mileageTypeValue);
                        } else {
                            report.mileageTypeDisplayText = 'N/A';
                        }
                    }
                    
                    // Approval status
                    const approvalStatus = ApprovalService.getStatusById(report.id);
                    report.decisionStatus = approvalStatus;
                    report.decisionStatusText = ApprovalService.getStatusDisplayText(approvalStatus);
                    report.decisionStatusState = ApprovalService.getStatusState(approvalStatus);
                    
                    // Entry header
                    report.entryHeaderText = this._buildEntryHeaderText(report);
                });
                
                // Update the reports dialog model
                if (this._tmReportsDialog) {
                    const oDialogModel = this._tmReportsDialog.getModel("dialog");
                    if (oDialogModel) {
                        oDialogModel.setProperty("/reports", tmData.reports);
                        oDialogModel.setProperty("/reportCount", tmData.totalCount);
                    }
                }
                
                // Update the main view model's T&M counts for this activity
                this._updateMainViewTMCounts(activityId, tmData.reports);
                
                console.log('TMDialogMixin: T&M Reports refreshed after create');
            } catch (error) {
                console.error('TMDialogMixin: Error refreshing T&M Reports:', error);
            }
        },

        /**
         * Update T&M counts on the main view for a specific activity
         * @param {string} activityId - Activity ID
         * @param {Array} reports - T&M reports array
         * @private
         */
        _updateMainViewTMCounts(activityId, reports) {
            try {
                const oViewModel = this.getView().getModel("view");
                const productGroups = oViewModel.getProperty("/productGroups") || [];
                
                // Find the activity in the view model
                for (let gIndex = 0; gIndex < productGroups.length; gIndex++) {
                    const activities = productGroups[gIndex].activities || [];
                    for (let aIndex = 0; aIndex < activities.length; aIndex++) {
                        if (activities[aIndex].id === activityId) {
                            const activityPath = `/productGroups/${gIndex}/activities/${aIndex}`;
                            
                            // Calculate counts
                            const timeEffortCount = reports.filter(r => r.type === "Time Effort").length;
                            const materialCount = reports.filter(r => r.type === "Material").length;
                            const expenseCount = reports.filter(r => r.type === "Expense").length;
                            const mileageCount = reports.filter(r => r.type === "Mileage").length;
                            
                            // Update the view model
                            oViewModel.setProperty(activityPath + "/tmReportsCount", reports.length);
                            oViewModel.setProperty(activityPath + "/tmTimeEffortCount", timeEffortCount);
                            oViewModel.setProperty(activityPath + "/tmMaterialCount", materialCount);
                            oViewModel.setProperty(activityPath + "/tmExpenseCount", expenseCount);
                            oViewModel.setProperty(activityPath + "/tmMileageCount", mileageCount);
                            oViewModel.setProperty(activityPath + "/tmReports", reports);
                            
                            console.log(`TMDialogMixin: Updated main view T&M counts for activity ${activityId}: ${reports.length} total`);
                            return;
                        }
                    }
                }
                
                console.warn(`TMDialogMixin: Activity ${activityId} not found in view model for count update`);
            } catch (error) {
                console.error('TMDialogMixin: Error updating main view T&M counts:', error);
            }
        },

        /**
         * Show entry JSON in dialog (for other entry types)
         * @private
         */
        _showEntryJSON(oEntry) {
            const oDialogModel = this._tmCreateDialog.getModel("createTM");
            const activityId = oDialogModel.getProperty("/activityId");
            const orgLevelId = oDialogModel.getProperty("/orgLevelId");

            const payload = TMPayloadService.buildPayload(oEntry, activityId, orgLevelId);
            const jsonString = TMPayloadService.formatPayloadJSON(payload);

            MessageBox.information(jsonString, {
                title: `${oEntry.type} Entry Data`,
                contentWidth: "500px",
                styleClass: "sapUiSizeCompact"
            });
        },

        /* ========================================
         * DURATION / DATETIME CHANGE HANDLERS
         * ======================================== */

        /**
         * Handle duration change for Time Effort
         */
        onDurationChange(oEvent) {
            const oContext = oEvent.getSource().getBindingContext("createTM");
            if (!oContext) return;

            const oModel = this._tmCreateDialog.getModel("createTM");
            const iDuration = oEvent.getParameter("value");
            DateTimeService.handleDurationChange(oModel, oContext.getPath(), iDuration, "startDateTime", "endDateTime");
        },

        /**
         * Handle start datetime change for Time Effort
         */
        onStartDateTimeChange(oEvent) {
            const oContext = oEvent.getSource().getBindingContext("createTM");
            if (!oContext) return;

            const oModel = this._tmCreateDialog.getModel("createTM");
            DateTimeService.handleStartDateTimeChange(oModel, oContext.getPath(), "startDateTime", "duration", "endDateTime", 30);
        },

        /**
         * Handle duration1 change for Time & Material
         */
        onDuration1Change(oEvent) {
            this._handleTimeAndMaterialDurationChange(oEvent, 1);
        },

        /**
         * Handle duration2 change for Time & Material
         */
        onDuration2Change(oEvent) {
            this._handleTimeAndMaterialDurationChange(oEvent, 2);
        },

        /**
         * Handle duration3 change for Time & Material
         */
        onDuration3Change(oEvent) {
            this._handleTimeAndMaterialDurationChange(oEvent, 3);
        },

        /**
         * Handle start datetime change for T&M column 1
         */
        onStartDateTime1Change(oEvent) {
            this._handleTimeAndMaterialStartChange(oEvent, 1);
        },

        /**
         * Handle start datetime change for T&M column 2
         */
        onStartDateTime2Change(oEvent) {
            this._handleTimeAndMaterialStartChange(oEvent, 2);
        },

        /**
         * Handle start datetime change for T&M column 3
         */
        onStartDateTime3Change(oEvent) {
            this._handleTimeAndMaterialStartChange(oEvent, 3);
        },

        /**
         * Generic handler for Time & Material duration changes
         * @private
         */
        _handleTimeAndMaterialDurationChange(oEvent, iColumnIndex) {
            const oContext = oEvent.getSource().getBindingContext("createTM");
            if (!oContext) return;

            const oModel = this._tmCreateDialog.getModel("createTM");
            const iDuration = oEvent.getParameter("value");
            DateTimeService.handleDurationChange(
                oModel, 
                oContext.getPath(), 
                iDuration, 
                "startDateTime" + iColumnIndex, 
                "endDateTime" + iColumnIndex
            );
        },

        /**
         * Generic handler for Time & Material start datetime changes
         * @private
         */
        _handleTimeAndMaterialStartChange(oEvent, iColumnIndex) {
            const oContext = oEvent.getSource().getBindingContext("createTM");
            if (!oContext) return;

            const oModel = this._tmCreateDialog.getModel("createTM");
            DateTimeService.handleStartDateTimeChange(
                oModel, 
                oContext.getPath(), 
                "startDateTime" + iColumnIndex, 
                "duration" + iColumnIndex, 
                "endDateTime" + iColumnIndex, 
                30
            );
        },

        /* ========================================
         * TIME & MATERIAL - DYNAMIC TIME ENTRIES
         * ======================================== */

        /**
         * Add Time Effort - Fahrzeit
         */
        onAddTimeEffortFZ(oEvent) {
            this._addTimeEffort(oEvent, "FZ", "timeEffortsFZ");
        },

        /**
         * Add Time Effort - Wartezeit
         */
        onAddTimeEffortWZ(oEvent) {
            this._addTimeEffort(oEvent, "WZ", "timeEffortsWZ");
        },

        /**
         * Add Time Effort - Arbeitszeit
         */
        onAddTimeEffortAZ(oEvent) {
            this._addTimeEffort(oEvent, "AZ", "timeEffortsAZ");
        },

        /**
         * Remove Time Effort - Fahrzeit
         */
        onRemoveTimeEffortFZ(oEvent) {
            this._removeTimeEffort(oEvent, "timeEffortsFZ");
        },

        /**
         * Remove Time Effort - Wartezeit
         */
        onRemoveTimeEffortWZ(oEvent) {
            this._removeTimeEffort(oEvent, "timeEffortsWZ");
        },

        /**
         * Remove Time Effort - Arbeitszeit
         */
        onRemoveTimeEffortAZ(oEvent) {
            this._removeTimeEffort(oEvent, "timeEffortsAZ");
        },

        /**
         * Generic add time effort handler
         * @private
         */
        _addTimeEffort(oEvent, sType, sArrayProperty) {
            const oButton = oEvent.getSource();
            // Navigate up to find the T&M entry context
            let oContext = oButton.getBindingContext("createTM");
            
            // If no direct context, find parent entry
            if (!oContext) {
                const oPanel = oButton.getParent()?.getParent()?.getParent()?.getParent()?.getParent();
                if (oPanel) {
                    oContext = oPanel.getBindingContext("createTM");
                }
            }
            
            if (!oContext) {
                MessageToast.show("Could not identify entry");
                return;
            }

            const sPath = oContext.getPath();
            const oModel = this._tmCreateDialog.getModel("createTM");
            const oEntry = oModel.getProperty(sPath);
            const aTimeEfforts = oModel.getProperty(sPath + "/" + sArrayProperty) || [];
            
            // Get default technician from parent T&M entry
            const defaultTechnician = oEntry.technicianId ? {
                id: oEntry.technicianId,
                externalId: oEntry.technicianExternalId,
                displayText: oEntry.technicianDisplay
            } : null;
            
            // Create new time effort entry with default technician
            const newEntry = TMCreationService.createTimeEffortForTM(sType, defaultTechnician);
            aTimeEfforts.push(newEntry);
            
            oModel.setProperty(sPath + "/" + sArrayProperty, aTimeEfforts);
            console.log('Added time effort', sType, 'to', sPath, '- total:', aTimeEfforts.length, 'with technician:', defaultTechnician?.displayText);
        },

        /**
         * Generic remove time effort handler
         * @private
         */
        _removeTimeEffort(oEvent, sArrayProperty) {
            const oButton = oEvent.getSource();
            const oContext = oButton.getBindingContext("createTM");
            
            if (!oContext) {
                MessageToast.show("Could not identify entry to remove");
                return;
            }

            const sPath = oContext.getPath();
            const oModel = this._tmCreateDialog.getModel("createTM");
            
            // Parse path to get parent entry path and index
            // Path format: /entries/0/timeEffortsFZ/0
            const pathParts = sPath.split("/");
            const iIndex = parseInt(pathParts.pop());
            const sArrayPath = pathParts.join("/");
            
            const aTimeEfforts = oModel.getProperty(sArrayPath) || [];
            aTimeEfforts.splice(iIndex, 1);
            oModel.setProperty(sArrayPath, aTimeEfforts);
            
            console.log('Removed time effort at index', iIndex, 'from', sArrayPath);
        }
    };
});