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
         * ACTIVITY DETAILS TOGGLE
         * ======================================== */

        /**
         * Enrich T&M reports with lookup data
         */
        async _enrichTMReports(reports) {
            // Extract person IDs before parallel loading
            const personIds = reports
                .map(r => r.createPerson)
                .filter(id => id && id !== 'N/A');

            // Parallel loading of lookup data
            await Promise.all([
                UdfMetaService.preloadUdfMetaForReports(reports),
                ApprovalService.preloadStatusesForReports(reports),
                personIds.length > 0 ? PersonService.preloadPersonsById(personIds) : Promise.resolve()
            ]);

            reports.forEach(report => {
                report.editMode = false;
                report.expanded = false;
                
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
                
                // Expense: type name and amounts
                if ((report.type === "Expense" || report.type === "Expense Report") && report.fullData?.type) {
                    report.expenseTypeDisplayText = ExpenseTypeService.getExpenseTypeDisplayTextById(report.fullData.type);
                }
                
                // Expense: amounts for display (amounts are at root level)
                if (report.type === "Expense" || report.type === "Expense Report") {
                    report.externalAmountValue = report.externalAmount?.amount || 0;
                    report.internalAmountValue = report.internalAmount?.amount || 0;
                }
                
                // Mileage: type from UDF
                if (report.type === "Mileage" || report.type === "Mileage Report") {
                    const mileageTypeValue = this._getUdfValueByExternalId(report.udfValues, "Z_Mileage_MatID");
                    if (mileageTypeValue) {
                        report.mileageTypeDisplayText = ItemService.getItemDisplayTextByExternalId(mileageTypeValue);
                    } else {
                        report.mileageTypeDisplayText = 'N/A';
                    }
                    
                    // Distance for display (distance is at root level)
                    report.distanceValue = report.distance || 0;
                    
                    // Duration - travelDurationMinutes might be "N/A" string from backend
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
            
            return null;
        },

        /**
         * Toggle Edit Mode for T&M Entry
         */
        async onToggleEditMode(oEvent) {
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
                // Entering edit mode - refresh status first to check if still PENDING
                const entryId = oEntry.id;
                if (entryId) {
                    try {
                        const freshStatus = await ApprovalService.refreshStatusForEntry(entryId);
                        
                        if (freshStatus && freshStatus !== 'PENDING') {
                            // Status changed - update UI and notify user
                            oModel.setProperty(sPath + "/decisionStatus", freshStatus);
                            oModel.setProperty(sPath + "/decisionStatusText", ApprovalService.getStatusDisplayText(freshStatus));
                            oModel.setProperty(sPath + "/decisionStatusState", ApprovalService.getStatusState(freshStatus));
                            
                            MessageToast.show(`Entry status changed to ${ApprovalService.getStatusDisplayText(freshStatus)}`);
                            return; // Don't enter edit mode for non-PENDING entries
                        }
                    } catch (error) {
                        console.error("Error refreshing entry status:", error);
                        // Continue to edit mode even if refresh fails
                    }
                }
                
                // Initialize edit fields and enter edit mode
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
            const durationMinutes = parseInt(editedValues.travelDurationMinutes) || 0;
            
            let travelEndDateTime = editedValues.travelEndDateTime;
            if (travelStartDateTime && durationMinutes >= 0) {
                const startDate = new Date(travelStartDateTime);
                const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
                travelEndDateTime = endDate.toISOString().replace(/\.\d{3}Z$/, 'Z');
            }
            
            // Build payload - all editable fields
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
                    report.expanded = false;
                    
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
                            oViewModel.setProperty(activityPath + "/tmReportsLoaded", true);
                            // Initialize edit mode flags to false
                            oViewModel.setProperty(activityPath + "/tmEditMode", false);
                            oViewModel.setProperty(activityPath + "/expenseEditMode", false);
                            oViewModel.setProperty(activityPath + "/mileageEditMode", false);
                            return;
                        }
                    }
                }
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
            
            // Get default date from Activity's Planned Start Date
            const plannedStartDate = oModel.getProperty("/plannedStartDate");
            const defaultDate = plannedStartDate ? plannedStartDate.split('T')[0] : "";
            
            // Create new time effort entry with default technician and date
            const newEntry = TMCreationService.createTimeEffortForTM(sType, defaultTechnician, defaultDate);
            aTimeEfforts.push(newEntry);
            
            oModel.setProperty(sPath + "/" + sArrayProperty, aTimeEfforts);
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
        },

        /* ========================================
        /* ========================================
         * T&M TYPE FILTER (SegmentedButton)
         * ======================================== */

        onTMTypeFilterChange(oEvent) {
            const sSelectedKey = oEvent.getParameter("item")?.getKey() || "ALL";
            const oSegmentedButton = oEvent.getSource();
            const oToolbar = oSegmentedButton.getParent();
            const oPanel = oToolbar ? oToolbar.getParent() : null;
            
            if (!oPanel) return;
            
            const aContent = oPanel.getContent();
            const oTable = aContent && aContent.length > 0 ? aContent[0] : null;
            
            if (!oTable) return;
            
            // sap.m.Table uses "items" binding, sap.ui.table.Table uses "rows"
            const oBinding = oTable.getBinding("rows");
            if (!oBinding) return;
            
            const Filter = sap.ui.model.Filter;
            const FilterOperator = sap.ui.model.FilterOperator;
            const aFilters = [];
            
            aFilters.push(new Filter("type", FilterOperator.NE, "Expense"));
            aFilters.push(new Filter("type", FilterOperator.NE, "Mileage"));
            
            if (sSelectedKey !== "ALL") {
                aFilters.push(new Filter("type", FilterOperator.EQ, sSelectedKey));
            }
            
            oBinding.filter(new Filter({ filters: aFilters, and: true }));
        },

        /* ========================================
         * EDIT FLOW: Edit Selected -> Save All / End Edit
         * ======================================== */

        /**
         * Get table type from toolbar context
         */
        _getTableTypeFromToolbar(oToolbar) {
            const oPanel = oToolbar.getParent();
            if (!oPanel) return null;
            
            const oHeaderToolbar = oPanel.getHeaderToolbar();
            if (oHeaderToolbar) {
                const aContent = oHeaderToolbar.getContent();
                for (let item of aContent) {
                    if (item.getText) {
                        const text = item.getText();
                        if (text.includes("Time Effort")) return "tm";
                        if (text.includes("Expenses")) return "expense";
                        if (text.includes("Mileage")) return "mileage";
                    }
                }
            }
            return "tm";
        },

        /**
         * Get activity path from table
         */
        _getActivityPathFromTable(oTable) {
            // sap.m.Table uses "items" binding, sap.ui.table.Table uses "rows"
            const oBinding = oTable.getBinding("rows");
            if (!oBinding) return null;
            
            const sPath = oBinding.getPath();
            // Path format: view>tmReports - need to get parent activity path
            const oContext = oBinding.getContext();
            if (oContext) {
                return oContext.getPath();
            }
            return null;
        },

        /**
         * Handle Edit Selected - enables edit mode for checked PENDING rows
         */
        onEditSelectedTM(oEvent) {
            const oButton = oEvent.getSource();
            const oToolbar = oButton.getParent();
            const oPanel = oToolbar ? oToolbar.getParent() : null;
            
            if (!oPanel || !oPanel.getContent) {
                MessageToast.show("Could not find table");
                return;
            }
            
            const aContent = oPanel.getContent();
            const oTable = aContent && aContent.length > 0 ? aContent[0] : null;
            
            if (!oTable) {
                MessageToast.show("Could not find table");
                return;
            }
            
            const oModel = this.getView().getModel("view");
            // sap.m.Table uses "items" binding, sap.ui.table.Table uses "rows"
            const oBinding = oTable.getBinding("rows");
            if (!oBinding) return;
            
            // Find checked PENDING rows
            const aContexts = oBinding.getContexts();
            let editableCount = 0;
            const aEditPaths = [];
            
            aContexts.forEach(oContext => {
                if (oContext) {
                    const sPath = oContext.getPath();
                    const oEntry = oModel.getProperty(sPath);
                    
                    if (oEntry && oEntry.selected === true && oEntry.decisionStatus === "PENDING") {
                        oModel.setProperty(sPath + "/editMode", true);
                        oModel.setProperty(sPath + "/selected", false);
                        aEditPaths.push(sPath);
                        editableCount++;
                    }
                }
            });
            
            if (editableCount === 0) {
                MessageToast.show("Please select PENDING rows to edit (use checkboxes)");
                return;
            }
            
            // Set activity-level edit mode flag
            const sActivityPath = this._getActivityPathFromTable(oTable);
            const sTableType = this._getTableTypeFromToolbar(oToolbar);
            
            if (sActivityPath) {
                if (sTableType === "expense") {
                    oModel.setProperty(sActivityPath + "/expenseEditMode", true);
                } else if (sTableType === "mileage") {
                    oModel.setProperty(sActivityPath + "/mileageEditMode", true);
                } else {
                    oModel.setProperty(sActivityPath + "/tmEditMode", true);
                }
            }
            
            // Store editing paths for save
            this._aEditingPaths = aEditPaths;
            this._sEditingActivityPath = sActivityPath;
            this._sEditingTableType = sTableType;
            
            MessageToast.show(`${editableCount} row(s) now editable`);
        },

        /**
         * Handle End Edit - cancel editing without saving
         */
        onEndEditTM(oEvent) {
            const oButton = oEvent.getSource();
            const oToolbar = oButton.getParent();
            const oPanel = oToolbar ? oToolbar.getParent() : null;
            
            if (!oPanel || !oPanel.getContent) return;
            
            const aContent = oPanel.getContent();
            const oTable = aContent && aContent.length > 0 ? aContent[0] : null;
            if (!oTable) return;
            
            const oModel = this.getView().getModel("view");
            // sap.m.Table uses "items" binding, sap.ui.table.Table uses "rows"
            const oBinding = oTable.getBinding("rows");
            if (!oBinding) return;
            
            // Clear edit mode from all rows
            const aContexts = oBinding.getContexts();
            aContexts.forEach(oContext => {
                if (oContext) {
                    const sPath = oContext.getPath();
                    const oEntry = oModel.getProperty(sPath);
                    if (oEntry && oEntry.editMode) {
                        oModel.setProperty(sPath + "/editMode", false);
                    }
                }
            });
            
            // Clear activity-level edit mode
            const sActivityPath = this._getActivityPathFromTable(oTable);
            const sTableType = this._getTableTypeFromToolbar(oToolbar);
            
            if (sActivityPath) {
                if (sTableType === "expense") {
                    oModel.setProperty(sActivityPath + "/expenseEditMode", false);
                } else if (sTableType === "mileage") {
                    oModel.setProperty(sActivityPath + "/mileageEditMode", false);
                } else {
                    oModel.setProperty(sActivityPath + "/tmEditMode", false);
                }
            }
            
            // Refresh to restore original values
            const activityId = oModel.getProperty(sActivityPath + "/id");
            if (activityId) {
                this._refreshTMReportsAfterCreate(activityId);
            }
            
            this._aEditingPaths = null;
            MessageToast.show("Edit cancelled");
        },

        /**
         * Handle Save All - show confirmation dialog then save all edited entries
         */
        onSaveAllTM(oEvent) {
            const oButton = oEvent.getSource();
            const oToolbar = oButton.getParent();
            const oPanel = oToolbar ? oToolbar.getParent() : null;
            
            if (!oPanel || !oPanel.getContent) return;
            
            const aContent = oPanel.getContent();
            const oTable = aContent && aContent.length > 0 ? aContent[0] : null;
            if (!oTable) return;
            
            const oModel = this.getView().getModel("view");
            // sap.m.Table uses "items" binding, sap.ui.table.Table uses "rows"
            const oBinding = oTable.getBinding("rows");
            if (!oBinding) return;
            
            // Collect entries in edit mode
            const aContexts = oBinding.getContexts();
            const aEntriesToSave = [];
            
            aContexts.forEach(oContext => {
                if (oContext) {
                    const sPath = oContext.getPath();
                    const oEntry = oModel.getProperty(sPath);
                    if (oEntry && oEntry.editMode === true) {
                        aEntriesToSave.push({
                            path: sPath,
                            entry: oEntry
                        });
                    }
                }
            });
            
            if (aEntriesToSave.length === 0) {
                MessageToast.show("No entries to save");
                return;
            }
            
            // Build list of entry descriptions
            const aDescriptions = aEntriesToSave.map(item => {
                const e = item.entry;
                let desc = e.type + ": ";
                if (e.type === "Time Effort") {
                    desc += (e.taskDisplayText || "Time Entry") + " - " + e.durationMinutes + " min";
                } else if (e.type === "Material") {
                    desc += (e.itemDisplayText || "Material") + " - " + e.quantity + " pcs";
                } else if (e.type === "Expense") {
                    desc += (e.expenseTypeDisplayText || "Expense") + " - " + e.externalAmountValue + " EUR";
                } else if (e.type === "Mileage") {
                    desc += (e.mileageTypeDisplayText || "Mileage") + " - " + e.distanceValue + " KM";
                }
                return desc;
            });
            
            // Store for later
            this._aPendingSaveEntries = aEntriesToSave;
            this._oPendingSaveTable = oTable;
            this._oPendingSaveToolbar = oToolbar;
            
            // Show confirmation dialog
            const sMessage = `You are about to update ${aEntriesToSave.length} entry(ies):\n\n• ` + aDescriptions.join("\n• ");
            
            MessageBox.show(sMessage, {
                icon: MessageBox.Icon.QUESTION,
                title: "Confirm Update",
                actions: ["Send for Approval", MessageBox.Action.CLOSE],
                emphasizedAction: "Send for Approval",
                onClose: (sAction) => {
                    if (sAction === "Send for Approval") {
                        this._executeSaveAll();
                    }
                }
            });
        },

        /**
         * Execute save for all pending entries
         */
        async _executeSaveAll() {
            const aEntriesToSave = this._aPendingSaveEntries;
            const oTable = this._oPendingSaveTable;
            const oToolbar = this._oPendingSaveToolbar;
            
            if (!aEntriesToSave || aEntriesToSave.length === 0) return;
            
            const oModel = this.getView().getModel("view");
            sap.ui.core.BusyIndicator.show(0);
            
            let successCount = 0;
            let failCount = 0;
            
            // Save entries one by one
            for (const item of aEntriesToSave) {
                try {
                    const result = await this._saveSingleEntry(item.entry, item.path, oModel);
                    if (result) {
                        successCount++;
                    } else {
                        failCount++;
                    }
                } catch (error) {
                    console.error("Save error:", error);
                    failCount++;
                }
            }
            
            sap.ui.core.BusyIndicator.hide();
            
            // Clear edit modes
            aEntriesToSave.forEach(item => {
                oModel.setProperty(item.path + "/editMode", false);
            });
            
            // Clear activity-level edit mode
            const sActivityPath = this._getActivityPathFromTable(oTable);
            const sTableType = this._getTableTypeFromToolbar(oToolbar);
            
            if (sActivityPath) {
                if (sTableType === "expense") {
                    oModel.setProperty(sActivityPath + "/expenseEditMode", false);
                } else if (sTableType === "mileage") {
                    oModel.setProperty(sActivityPath + "/mileageEditMode", false);
                } else {
                    oModel.setProperty(sActivityPath + "/tmEditMode", false);
                }
                
                // Refresh data
                const activityId = oModel.getProperty(sActivityPath + "/id");
                if (activityId) {
                    await this._refreshTMReportsAfterCreate(activityId);
                }
            }
            
            // Show result
            if (failCount === 0) {
                MessageToast.show(`${successCount} entry(ies) saved successfully`);
            } else {
                MessageBox.warning(`${successCount} saved, ${failCount} failed`);
            }
            
            this._aPendingSaveEntries = null;
            this._oPendingSaveTable = null;
            this._oPendingSaveToolbar = null;
        },

        /**
         * Save a single entry via API
         */
        async _saveSingleEntry(oEntry, sPath, oModel) {
            let payload, endpoint;
            
            switch (oEntry.type) {
                case "Time Effort":
                    const durationMinutes = parseInt(oEntry.durationMinutes) || 0;
                    let endDateTime = oEntry.endDateTime;
                    if (oEntry.startDateTime && durationMinutes >= 0) {
                        const startDate = new Date(oEntry.startDateTime);
                        const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
                        endDateTime = endDate.toISOString().replace(/\.\d{3}Z$/, 'Z');
                    }
                    payload = { endDateTime, remarks: oEntry.remarksText || "" };
                    endpoint = `/api/update-time-effort/${oEntry.id}`;
                    break;
                    
                case "Material":
                    payload = { quantity: parseFloat(oEntry.quantity) || 0, remarks: oEntry.remarksText || "" };
                    endpoint = `/api/update-material/${oEntry.id}`;
                    break;
                    
                case "Expense":
                    payload = {
                        externalAmount: { amount: parseFloat(oEntry.externalAmountValue) || 0, currency: "EUR" },
                        internalAmount: { amount: parseFloat(oEntry.internalAmountValue) || 0, currency: "EUR" },
                        remarks: oEntry.remarksText || ""
                    };
                    endpoint = `/api/update-expense/${oEntry.id}`;
                    break;
                    
                case "Mileage":
                    const travelDuration = parseInt(oEntry.travelDurationMinutes) || 0;
                    let travelEndDateTime = oEntry.travelEndDateTime;
                    if (oEntry.travelStartDateTime && travelDuration >= 0) {
                        const startDate = new Date(oEntry.travelStartDateTime);
                        const endDate = new Date(startDate.getTime() + travelDuration * 60 * 1000);
                        travelEndDateTime = endDate.toISOString().replace(/\.\d{3}Z$/, 'Z');
                    }
                    payload = {
                        distance: parseFloat(oEntry.distanceValue) || 0,
                        distanceUnit: "KM",
                        travelStartDateTime: oEntry.travelStartDateTime,
                        travelEndDateTime: travelEndDateTime,
                        remarks: oEntry.remarksText || ""
                    };
                    endpoint = `/api/update-mileage/${oEntry.id}`;
                    break;
                    
                default:
                    return false;
            }
            
            const response = await fetch(endpoint, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            const result = await response.json();
            return result.success === true;
        }
    };
});