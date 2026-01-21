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
    "mobileappsc/utils/services/ExpenseTypeService",
    "mobileappsc/utils/services/TechnicianService"
], (MessageToast, MessageBox, TMDialogService, TMCreationService, TMDataService, TMPayloadService, TMEditService, DateTimeService, UdfMetaService, ApprovalService, PersonService, TimeTaskService, ItemService, ExpenseTypeService, TechnicianService) => {
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
                
                // Time Effort: task name and date
                if (report.type === "Time Effort" && report.task) {
                    report.taskDisplayText = TimeTaskService.getTaskDisplayTextById(report.task);
                }
                if (report.type === "Time Effort") {
                    // Extract date from startDateTime for display/edit (format: yyyy-MM-dd)
                    const timeDate = report.startDateTime || report.createDateTime;
                    if (timeDate) {
                        report.entryDateFormatted = timeDate.split('T')[0];
                    } else {
                        report.entryDateFormatted = '';
                    }
                }
                
                // Material: item name and date
                if (report.type === "Material" && report.fullData?.item) {
                    report.itemDisplayText = ItemService.getItemDisplayTextById(report.fullData.item);
                }
                if (report.type === "Material") {
                    // Extract date from date field or createDateTime (format: yyyy-MM-dd)
                    const matDate = report.date || report.fullData?.date || report.createDateTime;
                    if (matDate) {
                        report.entryDateFormatted = matDate.split('T')[0];
                    } else {
                        report.entryDateFormatted = '';
                    }
                }
                
                // Expense: type name and amounts for table display
                if ((report.type === "Expense" || report.type === "Expense Report")) {
                    if (report.fullData?.type) {
                        report.expenseTypeDisplayText = ExpenseTypeService.getExpenseTypeDisplayTextById(report.fullData.type);
                    }
                    // Use direct fields (report.externalAmount) or fallback to fullData
                    report.externalAmountValue = report.externalAmount?.amount ?? report.fullData?.externalAmount?.amount ?? 0;
                    report.internalAmountValue = report.internalAmount?.amount ?? report.fullData?.internalAmount?.amount ?? 0;
                    
                    // Extract date from createDateTime for display/edit (format: yyyy-MM-dd)
                    const expenseDate = report.date || report.fullData?.date || report.createDateTime;
                    if (expenseDate) {
                        report.entryDateFormatted = expenseDate.split('T')[0];
                    } else {
                        report.entryDateFormatted = '';
                    }
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
                    
                    // Distance value for table display
                    report.distanceValue = report.distance ?? report.fullData?.distance ?? 0;
                    
                    // Extract date from travelStartDateTime for display/edit (format: yyyy-MM-dd)
                    const mileageDate = report.date || report.fullData?.date || report.travelStartDateTime || report.createDateTime;
                    if (mileageDate) {
                        report.entryDateFormatted = mileageDate.split('T')[0];
                    } else {
                        report.entryDateFormatted = '';
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
            
            // First try direct binding context
            let oContext = oButton.getBindingContext("view");
            
            // If not found, traverse up the control hierarchy to find activity context
            if (!oContext) {
                let oParent = oButton.getParent();
                while (oParent && !oContext) {
                    oContext = oParent.getBindingContext("view");
                    if (oContext) {
                        const sPath = oContext.getPath();
                        // Make sure we found an activity context, not a productGroup context
                        if (sPath && sPath.includes("/activities/")) {
                            break;
                        } else {
                            oContext = null; // Keep searching
                        }
                    }
                    oParent = oParent.getParent ? oParent.getParent() : null;
                }
            }

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
            console.log("onAddExpenseEntry called");
            
            if (!this._tmCreateDialog) {
                console.error("_tmCreateDialog not available");
                MessageToast.show("Dialog not initialized");
                return;
            }
            
            const oModel = this._tmCreateDialog.getModel("createTM");
            if (!oModel) {
                console.error("createTM model not available");
                MessageToast.show("Model not initialized");
                return;
            }
            
            const entry = TMCreationService.createExpenseEntry();
            TMCreationService.addEntryToModel(oModel, entry, "Expense");
            console.log("Expense entry added to /entries");
        },

        /**
         * Add Mileage Entry
         */
        onAddMileageEntry() {
            console.log("onAddMileageEntry called");
            
            if (!this._tmCreateDialog) {
                console.error("_tmCreateDialog not available");
                MessageToast.show("Dialog not initialized");
                return;
            }
            
            const oModel = this._tmCreateDialog.getModel("createTM");
            if (!oModel) {
                console.error("createTM model not available");
                MessageToast.show("Model not initialized");
                return;
            }
            
            const entry = TMCreationService.createMileageEntry();
            TMCreationService.addEntryToModel(oModel, entry, "Mileage");
            console.log("Mileage entry added to /entries");
        },

        /**
         * Add Time & Material Entry (combined)
         */
        onAddTimeAndMaterialEntry() {
            console.log("onAddTimeAndMaterialEntry called");
            
            if (!this._tmCreateDialog) {
                console.error("_tmCreateDialog not available");
                MessageToast.show("Dialog not initialized");
                return;
            }
            
            const oModel = this._tmCreateDialog.getModel("createTM");
            if (!oModel) {
                console.error("createTM model not available");
                MessageToast.show("Model not initialized");
                return;
            }
            
            const entry = TMCreationService.createTimeAndMaterialEntry();
            TMCreationService.addEntryToModel(oModel, entry, "Time & Material");
            console.log("Time & Material entry added");
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
                    report.expanded = false;
                    
                    // Person name
                    if (report.createPerson) {
                        report.createPersonDisplayText = PersonService.getPersonDisplayTextById(report.createPerson);
                    } else {
                        report.createPersonDisplayText = 'N/A';
                    }
                    
                    // Time Effort: task name and date
                    if (report.type === "Time Effort" && report.task) {
                        report.taskDisplayText = TimeTaskService.getTaskDisplayTextById(report.task);
                    }
                    if (report.type === "Time Effort") {
                        // Extract date from startDateTime for display/edit (format: yyyy-MM-dd)
                        const timeDate = report.startDateTime || report.createDateTime;
                        if (timeDate) {
                            report.entryDateFormatted = timeDate.split('T')[0];
                        } else {
                            report.entryDateFormatted = '';
                        }
                    }
                    
                    // Material: item name and date
                    if (report.type === "Material" && report.fullData?.item) {
                        report.itemDisplayText = ItemService.getItemDisplayTextById(report.fullData.item);
                    }
                    if (report.type === "Material") {
                        // Extract date from date field or createDateTime (format: yyyy-MM-dd)
                        const matDate = report.date || report.fullData?.date || report.createDateTime;
                        if (matDate) {
                            report.entryDateFormatted = matDate.split('T')[0];
                        } else {
                            report.entryDateFormatted = '';
                        }
                    }
                    
                    // Expense: type name and amounts
                    if ((report.type === "Expense" || report.type === "Expense Report")) {
                        if (report.fullData?.type) {
                            report.expenseTypeDisplayText = ExpenseTypeService.getExpenseTypeDisplayTextById(report.fullData.type);
                        }
                        // Use direct fields (report.externalAmount) or fallback to fullData
                        report.externalAmountValue = report.externalAmount?.amount ?? report.fullData?.externalAmount?.amount ?? 0;
                        report.internalAmountValue = report.internalAmount?.amount ?? report.fullData?.internalAmount?.amount ?? 0;
                        
                        // Extract date for display/edit (format: yyyy-MM-dd)
                        const expenseDate = report.date || report.fullData?.date || report.createDateTime;
                        if (expenseDate) {
                            report.entryDateFormatted = expenseDate.split('T')[0];
                        } else {
                            report.entryDateFormatted = '';
                        }
                    }
                    
                    // Mileage: type from UDF and distance value
                    if (report.type === "Mileage" || report.type === "Mileage Report") {
                        const mileageTypeValue = this._getUdfValueByExternalId(report.udfValues, "Z_Mileage_MatID");
                        if (mileageTypeValue) {
                            report.mileageTypeDisplayText = ItemService.getItemDisplayTextByExternalId(mileageTypeValue);
                        } else {
                            report.mileageTypeDisplayText = 'N/A';
                        }
                        // Use direct fields or fallback to fullData
                        report.distanceValue = report.distance ?? report.fullData?.distance ?? 0;
                        
                        // Calculate travel duration
                        if (report.travelStartDateTime && report.travelEndDateTime) {
                            const startTime = new Date(report.travelStartDateTime);
                            const endTime = new Date(report.travelEndDateTime);
                            report.travelDurationMinutes = Math.round((endTime - startTime) / (1000 * 60));
                            report.travelDurationText = `${report.travelDurationMinutes} min`;
                        } else {
                            report.travelDurationMinutes = 0;
                            report.travelDurationText = 'N/A';
                        }
                        
                        // Extract date for display/edit (format: yyyy-MM-dd)
                        const mileageDate = report.date || report.fullData?.date || report.travelStartDateTime || report.createDateTime;
                        if (mileageDate) {
                            report.entryDateFormatted = mileageDate.split('T')[0];
                        } else {
                            report.entryDateFormatted = '';
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
         * TABLE EDIT HANDLERS (Main View)
         * ======================================== */

        /**
         * Filter Time & Material table by type
         */
        onTMTypeFilterChange(oEvent) {
            const sKey = oEvent.getParameter("item").getKey();
            const oButton = oEvent.getSource();
            const oToolbar = oButton.getParent();
            const oPanel = oToolbar ? oToolbar.getParent() : null;
            
            if (!oPanel || !oPanel.getContent) return;
            
            const aContent = oPanel.getContent();
            const oTable = aContent && aContent.length > 0 ? aContent[0] : null;
            if (!oTable || !oTable.getBinding) return;
            
            const oBinding = oTable.getBinding("rows") || oTable.getBinding("items");
            if (!oBinding) return;
            
            // Build filters
            const aFilters = [];
            if (sKey === "Time Effort") {
                aFilters.push(new sap.ui.model.Filter("type", "EQ", "Time Effort"));
            } else if (sKey === "Material") {
                aFilters.push(new sap.ui.model.Filter("type", "EQ", "Material"));
            } else {
                // ALL - exclude Expense and Mileage
                aFilters.push(new sap.ui.model.Filter("type", "NE", "Expense"));
                aFilters.push(new sap.ui.model.Filter("type", "NE", "Mileage"));
            }
            
            oBinding.filter(aFilters);
        },

        /**
         * Sort table based on dropdown selection
         */
        onTMSortChange(oEvent) {
            const sKey = oEvent.getParameter("selectedItem").getKey();
            const oSelect = oEvent.getSource();
            const oToolbar = oSelect.getParent();
            const oPanel = oToolbar ? oToolbar.getParent() : null;
            
            if (!oPanel || !oPanel.getContent) return;
            
            const aContent = oPanel.getContent();
            const oTable = aContent && aContent.length > 0 ? aContent[0] : null;
            if (!oTable || !oTable.getBinding) return;
            
            const oBinding = oTable.getBinding("rows") || oTable.getBinding("items");
            if (!oBinding) return;
            
            // Parse key: "fieldName-direction"
            const [sPath, sDirection] = sKey.split("-");
            const bDescending = sDirection === "desc";
            
            // Create sorter
            const oSorter = new sap.ui.model.Sorter(sPath, bDescending);
            oBinding.sort(oSorter);
        },

        /**
         * Edit Selected rows in table
         */
        onEditSelectedTM(oEvent) {
            const oButton = oEvent.getSource();
            const oToolbar = oButton.getParent();
            const oPanel = oToolbar ? oToolbar.getParent() : null;
            
            if (!oPanel || !oPanel.getContent) return;
            
            const aContent = oPanel.getContent();
            const oTable = aContent && aContent.length > 0 ? aContent[0] : null;
            if (!oTable) return;
            
            const oModel = this.getView().getModel("view");
            const oBinding = oTable.getBinding("rows") || oTable.getBinding("items");
            if (!oBinding) return;
            
            // Get all contexts
            const aContexts = oBinding.getContexts ? oBinding.getContexts() : [];
            let iEditCount = 0;
            
            // Enable edit mode on selected (checked) entries
            aContexts.forEach(oContext => {
                if (oContext) {
                    const sPath = oContext.getPath();
                    const oEntry = oModel.getProperty(sPath);
                    if (oEntry && oEntry.selected && oEntry.decisionStatus === 'PENDING') {
                        oModel.setProperty(sPath + "/editMode", true);
                        iEditCount++;
                    }
                }
            });
            
            if (iEditCount === 0) {
                sap.m.MessageToast.show("No entries selected for editing");
                return;
            }
            
            // Find activity path from panel's binding context (traverse up to find activity context)
            let sActivityPath = null;
            let oParent = oPanel;
            while (oParent && !sActivityPath) {
                const oContext = oParent.getBindingContext("view");
                if (oContext) {
                    const sPath = oContext.getPath();
                    // Check if this is an activity path
                    if (sPath && sPath.includes("/activities/")) {
                        sActivityPath = sPath;
                        break;
                    }
                }
                oParent = oParent.getParent ? oParent.getParent() : null;
            }
            
            if (sActivityPath) {
                // Determine which edit mode flag to set based on panel title
                const oHeaderToolbar = oPanel.getHeaderToolbar ? oPanel.getHeaderToolbar() : null;
                const aToolbarContent = oHeaderToolbar ? oHeaderToolbar.getContent() : [];
                const sPanelTitle = aToolbarContent.length > 1 && aToolbarContent[1].getText ? aToolbarContent[1].getText() : "";
                
                if (sPanelTitle.includes("Expense")) {
                    oModel.setProperty(sActivityPath + "/expenseEditMode", true);
                } else if (sPanelTitle.includes("Mileage")) {
                    oModel.setProperty(sActivityPath + "/mileageEditMode", true);
                } else {
                    oModel.setProperty(sActivityPath + "/tmEditMode", true);
                }
            }
            
            sap.m.MessageToast.show(`${iEditCount} entry(ies) now in edit mode`);
        },

        /**
         * End Edit mode for table
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
            const oBinding = oTable.getBinding("rows") || oTable.getBinding("items");
            if (!oBinding) return;
            
            // Get all contexts and disable edit mode
            const aContexts = oBinding.getContexts ? oBinding.getContexts() : [];
            aContexts.forEach(oContext => {
                if (oContext) {
                    const sPath = oContext.getPath();
                    oModel.setProperty(sPath + "/editMode", false);
                    oModel.setProperty(sPath + "/selected", false);
                }
            });
            
            // Find activity path from panel's binding context (traverse up to find activity context)
            let sActivityPath = null;
            let oParent = oPanel;
            while (oParent && !sActivityPath) {
                const oContext = oParent.getBindingContext("view");
                if (oContext) {
                    const sPath = oContext.getPath();
                    if (sPath && sPath.includes("/activities/")) {
                        sActivityPath = sPath;
                        break;
                    }
                }
                oParent = oParent.getParent ? oParent.getParent() : null;
            }
            
            if (sActivityPath) {
                oModel.setProperty(sActivityPath + "/tmEditMode", false);
                oModel.setProperty(sActivityPath + "/expenseEditMode", false);
                oModel.setProperty(sActivityPath + "/mileageEditMode", false);
            }
            
            sap.m.MessageToast.show("Edit mode ended");
        },

        /**
         * Save All edited rows in table
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
            const oBinding = oTable.getBinding("rows") || oTable.getBinding("items");
            if (!oBinding) return;
            
            // Collect entries in edit mode
            const aContexts = oBinding.getContexts ? oBinding.getContexts() : [];
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
                sap.m.MessageToast.show("No entries to save");
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
            const sMessage = `You are about to update ${aEntriesToSave.length} entry(ies):\n\nâ€¢ ` + aDescriptions.join("\nâ€¢ ");
            
            sap.m.MessageBox.show(sMessage, {
                icon: sap.m.MessageBox.Icon.QUESTION,
                title: "Confirm Update",
                actions: ["Send for Approval", sap.m.MessageBox.Action.CLOSE],
                emphasizedAction: "Send for Approval",
                onClose: (sAction) => {
                    if (sAction === "Send for Approval") {
                        this._executeSaveAllTM();
                    }
                }
            });
        },

        /**
         * Execute the save after confirmation
         * @private
         */
        async _executeSaveAllTM() {
            const aEntriesToSave = this._aPendingSaveEntries;
            if (!aEntriesToSave || aEntriesToSave.length === 0) return;
            
            const oModel = this.getView().getModel("view");
            let iSuccessCount = 0;
            let iFailCount = 0;
            
            sap.ui.core.BusyIndicator.show(0);
            
            for (const item of aEntriesToSave) {
                try {
                    const oEntry = item.entry;
                    const sPath = item.path;
                    
                    // Get activity ID
                    const activityId = this._getActivityIdFromPath(sPath, oModel);
                    if (!activityId) {
                        console.error("Could not determine activity ID for path:", sPath);
                        iFailCount++;
                        continue;
                    }
                    
                    // Build payload and update based on type
                    let response, payload;
                    
                    if (oEntry.type === "Time Effort") {
                        // Get existing startDateTime and calculate new times based on date change
                        let startDateTime = oEntry.startDateTime;
                        const durationMinutes = parseInt(oEntry.durationMinutes) || 0;
                        
                        // If date was edited, update the startDateTime with the new date but keep original time
                        if (oEntry.entryDateFormatted && startDateTime) {
                            const originalTime = startDateTime.split('T')[1] || '08:00:00.000Z';
                            startDateTime = oEntry.entryDateFormatted + 'T' + originalTime;
                        }
                        
                        // Calculate endDateTime from startDateTime + duration
                        let endDateTime = oEntry.endDateTime;
                        if (startDateTime && durationMinutes >= 0) {
                            const startDate = new Date(startDateTime);
                            const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
                            endDateTime = endDate.toISOString().replace(/\.\d{3}Z$/, 'Z');
                        }
                        
                        payload = {
                            startDateTime: startDateTime,
                            endDateTime: endDateTime,
                            remarks: oEntry.remarksText || ""
                        };
                        response = await fetch(`/api/update-time-effort/${oEntry.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });
                    } else if (oEntry.type === "Material") {
                        payload = {
                            quantity: parseFloat(oEntry.quantity) || 0,
                            remarks: oEntry.remarksText || ""
                        };
                        // Add date if available (format: yyyy-MM-dd)
                        if (oEntry.entryDateFormatted) {
                            payload.date = oEntry.entryDateFormatted;
                        }
                        response = await fetch(`/api/update-material/${oEntry.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });
                    } else if (oEntry.type === "Expense") {
                        payload = {
                            externalAmount: { amount: parseFloat(oEntry.externalAmountValue) || 0, currency: "EUR" },
                            internalAmount: { amount: parseFloat(oEntry.internalAmountValue) || 0, currency: "EUR" },
                            remarks: oEntry.remarksText || ""
                        };
                        // Add date if available (format: yyyy-MM-dd)
                        if (oEntry.entryDateFormatted) {
                            payload.date = oEntry.entryDateFormatted;
                        }
                        response = await fetch(`/api/update-expense/${oEntry.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });
                    } else if (oEntry.type === "Mileage") {
                        // Mileage uses startDateTime and calculates endDateTime from duration
                        let startDateTime = oEntry.travelStartDateTime || new Date().toISOString();
                        const durationMinutes = parseInt(oEntry.travelDurationMinutes) || 0;
                        
                        // If date was edited, update the startDateTime with the new date
                        if (oEntry.entryDateFormatted) {
                            // Get time portion from existing startDateTime or use 08:00
                            const existingTime = startDateTime.split('T')[1] || '08:00:00.000Z';
                            startDateTime = oEntry.entryDateFormatted + 'T' + existingTime;
                        }
                        
                        const endDateTime = new Date(new Date(startDateTime).getTime() + durationMinutes * 60000).toISOString();
                        
                        payload = {
                            distance: parseFloat(oEntry.distanceValue) || 0,
                            distanceUnit: "KM",
                            travelStartDateTime: startDateTime,
                            travelEndDateTime: endDateTime,
                            remarks: oEntry.remarksText || ""
                        };
                        // Add date if available (format: yyyy-MM-dd)
                        if (oEntry.entryDateFormatted) {
                            payload.date = oEntry.entryDateFormatted;
                        }
                        response = await fetch(`/api/update-mileage/${oEntry.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });
                    }
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        // Clear edit mode
                        oModel.setProperty(sPath + "/editMode", false);
                        oModel.setProperty(sPath + "/selected", false);
                        iSuccessCount++;
                    } else {
                        console.error("Failed to save entry:", result.message);
                        iFailCount++;
                    }
                    
                } catch (error) {
                    console.error("Error saving entry:", error);
                    iFailCount++;
                }
            }
            
            sap.ui.core.BusyIndicator.hide();
            
            // Clear edit mode flags - traverse up from toolbar to find activity context
            let sActivityPath = null;
            if (this._oPendingSaveToolbar) {
                let oParent = this._oPendingSaveToolbar.getParent(); // Panel
                while (oParent && !sActivityPath) {
                    const oContext = oParent.getBindingContext("view");
                    if (oContext) {
                        const sPath = oContext.getPath();
                        if (sPath && sPath.includes("/activities/")) {
                            sActivityPath = sPath;
                            break;
                        }
                    }
                    oParent = oParent.getParent ? oParent.getParent() : null;
                }
            }
            
            if (sActivityPath) {
                oModel.setProperty(sActivityPath + "/tmEditMode", false);
                oModel.setProperty(sActivityPath + "/expenseEditMode", false);
                oModel.setProperty(sActivityPath + "/mileageEditMode", false);
                
                // Refresh T&M data
                const activity = oModel.getProperty(sActivityPath);
                if (activity && activity.id) {
                    await this._refreshTMReportsAfterCreate(activity.id);
                }
            }
            
            // Show result
            if (iFailCount === 0) {
                sap.m.MessageToast.show(`${iSuccessCount} entry(ies) updated successfully`);
            } else {
                sap.m.MessageBox.warning(`${iSuccessCount} succeeded, ${iFailCount} failed`);
            }
            
            // Clean up
            this._aPendingSaveEntries = null;
            this._oPendingSaveTable = null;
            this._oPendingSaveToolbar = null;
        },

        /* ========================================
         * TABLE-BASED CREATION HANDLERS
         * ======================================== */

        /**
         * Add new row to Expense creation table
         */
        onAddCreateExpenseRow() {
            console.log("onAddCreateExpenseRow called");
            
            if (!this._tmCreateDialog) {
                console.error("_tmCreateDialog not available");
                MessageToast.show("Dialog not initialized");
                return;
            }
            
            const oModel = this._tmCreateDialog.getModel("createTM");
            if (!oModel) {
                console.error("createTM model not available");
                MessageToast.show("Model not initialized");
                return;
            }
            
            const aEntries = oModel.getProperty("/expenseEntries") || [];
            
            // Get defaults
            const defaultTechId = oModel.getProperty("/defaultTechnicianId") || "";
            const defaultTechDisplay = oModel.getProperty("/defaultTechnicianDisplay") || "";
            const defaultTechExternalId = oModel.getProperty("/defaultTechnicianExternalId") || "";
            const defaultExpenseTypeId = oModel.getProperty("/defaultExpenseTypeId") || "";
            const defaultExpenseTypeCode = oModel.getProperty("/defaultExpenseTypeCode") || "";
            const defaultExpenseTypeDisplay = oModel.getProperty("/defaultExpenseTypeDisplay") || "";
            const defaultDate = oModel.getProperty("/defaultDate") || "";
            
            const newEntry = {
                id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                type: "Expense",
                technicianId: defaultTechId,
                technicianExternalId: defaultTechExternalId,
                technicianDisplay: defaultTechDisplay,
                expenseTypeId: defaultExpenseTypeId,
                expenseTypeCode: defaultExpenseTypeCode,
                expenseTypeDisplay: defaultExpenseTypeDisplay,
                externalAmountValue: 0,
                internalAmountValue: 0,
                entryDate: defaultDate,
                remarks: ""
            };
            
            aEntries.push(newEntry);
            oModel.setProperty("/expenseEntries", aEntries);
            oModel.refresh(true); // Force UI refresh
            console.log("Expense entries now:", aEntries.length);
            MessageToast.show("Expense entry added");
        },

        /**
         * Remove row from Expense creation table
         */
        onRemoveCreateExpenseRow(oEvent) {
            const oButton = oEvent.getSource();
            const oContext = oButton.getBindingContext("createTM");
            
            if (!oContext) {
                MessageToast.show("Could not identify entry to remove");
                return;
            }
            
            const sPath = oContext.getPath();
            const oModel = this._tmCreateDialog.getModel("createTM");
            
            // Path format: /expenseEntries/0
            const iIndex = parseInt(sPath.split("/").pop());
            const aEntries = oModel.getProperty("/expenseEntries") || [];
            aEntries.splice(iIndex, 1);
            oModel.setProperty("/expenseEntries", aEntries);
            MessageToast.show("Expense entry removed");
        },

        /**
         * Save all Expense entries with confirmation
         */
        onSaveAllCreateExpense() {
            const oModel = this._tmCreateDialog.getModel("createTM");
            const aEntries = oModel.getProperty("/expenseEntries") || [];
            
            if (aEntries.length === 0) {
                MessageToast.show("No expense entries to save");
                return;
            }
            
            // Build preview
            const lines = aEntries.map((entry, idx) => {
                return `${idx + 1}. ${entry.expenseTypeDisplay || 'N/A'} - Ext: ${entry.externalAmountValue} EUR, Int: ${entry.internalAmountValue} EUR`;
            });
            
            const previewText = `You are about to submit ${aEntries.length} expense entry(ies):\n\n` + 
                lines.join('\n') + 
                '\n\nSend for approval?';
            
            MessageBox.confirm(previewText, {
                title: "Confirm Expense Report",
                actions: ["Send for Approval", MessageBox.Action.CLOSE],
                emphasizedAction: "Send for Approval",
                styleClass: "sapUiSizeCompact",
                onClose: (sAction) => {
                    if (sAction === "Send for Approval") {
                        this._submitCreateExpenseEntries(aEntries, oModel);
                    }
                }
            });
        },

        /**
         * Submit Expense entries to FSM API
         * @private
         */
        async _submitCreateExpenseEntries(aEntries, oModel) {
            try {
                sap.ui.core.BusyIndicator.show(0);
                
                const activityId = oModel.getProperty("/activityId");
                const activityCode = oModel.getProperty("/activityExternalId");
                const orgLevelId = oModel.getProperty("/orgLevelId");
                
                let successCount = 0;
                let errorCount = 0;
                
                for (const entry of aEntries) {
                    const payload = TMPayloadService.buildPayload({
                        type: "Expense",
                        technicianId: entry.technicianId,
                        technicianExternalId: entry.technicianExternalId,
                        expenseTypeId: entry.expenseTypeId,
                        expenseTypeCode: entry.expenseTypeCode,
                        externalAmountValue: entry.externalAmountValue,
                        internalAmountValue: entry.internalAmountValue,
                        date: entry.entryDate,
                        remarks: entry.remarks,
                        chargeOption: "CHARGEABLE"
                    }, activityId, orgLevelId);
                    
                    try {
                        const response = await fetch('/api/create-expense', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });
                        
                        const result = await response.json();
                        if (result.success) {
                            successCount++;
                        } else {
                            errorCount++;
                        }
                    } catch (err) {
                        console.error('Error creating expense:', err);
                        errorCount++;
                    }
                }
                
                sap.ui.core.BusyIndicator.hide();
                
                // Clear entries and refresh
                oModel.setProperty("/expenseEntries", []);
                
                // Refresh T&M Reports
                await this._refreshTMReportsAfterCreate(activityId);
                
                // Close dialog
                TMDialogService.closeTMCreationDialog();
                
                if (errorCount === 0) {
                    MessageBox.success(
                        `Successfully created ${successCount} expense entry(ies) for Activity ${activityCode}`,
                        { title: "Success" }
                    );
                } else {
                    MessageBox.warning(
                        `Created ${successCount} expense entry(ies), ${errorCount} failed for Activity ${activityCode}`,
                        { title: "Partial Success" }
                    );
                }
                
            } catch (error) {
                sap.ui.core.BusyIndicator.hide();
                console.error('TMDialogMixin: Error creating expenses:', error);
                MessageBox.error(`Error creating expenses: ${error.message}`, { title: "Error" });
            }
        },

        /**
         * Add new row to Mileage creation table
         */
        onAddCreateMileageRow() {
            console.log("onAddCreateMileageRow called");
            
            if (!this._tmCreateDialog) {
                console.error("_tmCreateDialog not available");
                MessageToast.show("Dialog not initialized");
                return;
            }
            
            const oModel = this._tmCreateDialog.getModel("createTM");
            if (!oModel) {
                console.error("createTM model not available");
                MessageToast.show("Model not initialized");
                return;
            }
            
            const aEntries = oModel.getProperty("/mileageEntries") || [];
            
            // Get defaults
            const defaultTechId = oModel.getProperty("/defaultTechnicianId") || "";
            const defaultTechDisplay = oModel.getProperty("/defaultTechnicianDisplay") || "";
            const defaultTechExternalId = oModel.getProperty("/defaultTechnicianExternalId") || "";
            const defaultMileageTypeId = oModel.getProperty("/defaultMileageTypeId") || "";
            const defaultMileageTypeDisplay = oModel.getProperty("/defaultMileageTypeDisplay") || "";
            const defaultQuantity = oModel.getProperty("/quantity") || 0;
            const defaultDate = oModel.getProperty("/defaultDate") || "";
            
            const newEntry = {
                id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                type: "Mileage",
                technicianId: defaultTechId,
                technicianExternalId: defaultTechExternalId,
                technicianDisplay: defaultTechDisplay,
                mileageTypeId: defaultMileageTypeId,
                mileageTypeDisplay: defaultMileageTypeDisplay,
                distance: parseFloat(defaultQuantity) || 0,
                travelDuration: 30,
                entryDate: defaultDate,
                remarks: ""
            };
            
            aEntries.push(newEntry);
            oModel.setProperty("/mileageEntries", aEntries);
            oModel.refresh(true); // Force UI refresh
            console.log("Mileage entries now:", aEntries.length);
            MessageToast.show("Mileage entry added");
        },

        /**
         * Remove row from Mileage creation table
         */
        onRemoveCreateMileageRow(oEvent) {
            const oButton = oEvent.getSource();
            const oContext = oButton.getBindingContext("createTM");
            
            if (!oContext) {
                MessageToast.show("Could not identify entry to remove");
                return;
            }
            
            const sPath = oContext.getPath();
            const oModel = this._tmCreateDialog.getModel("createTM");
            
            // Path format: /mileageEntries/0
            const iIndex = parseInt(sPath.split("/").pop());
            const aEntries = oModel.getProperty("/mileageEntries") || [];
            aEntries.splice(iIndex, 1);
            oModel.setProperty("/mileageEntries", aEntries);
            MessageToast.show("Mileage entry removed");
        },

        /**
         * Save all Mileage entries with confirmation
         */
        onSaveAllCreateMileage() {
            const oModel = this._tmCreateDialog.getModel("createTM");
            const aEntries = oModel.getProperty("/mileageEntries") || [];
            
            if (aEntries.length === 0) {
                MessageToast.show("No mileage entries to save");
                return;
            }
            
            // Build preview
            const lines = aEntries.map((entry, idx) => {
                return `${idx + 1}. ${entry.mileageTypeDisplay || 'N/A'} - ${entry.distance} KM, ${entry.travelDuration} min`;
            });
            
            const previewText = `You are about to submit ${aEntries.length} mileage entry(ies):\n\n` + 
                lines.join('\n') + 
                '\n\nSend for approval?';
            
            MessageBox.confirm(previewText, {
                title: "Confirm Mileage Report",
                actions: ["Send for Approval", MessageBox.Action.CLOSE],
                emphasizedAction: "Send for Approval",
                styleClass: "sapUiSizeCompact",
                onClose: (sAction) => {
                    if (sAction === "Send for Approval") {
                        this._submitCreateMileageEntries(aEntries, oModel);
                    }
                }
            });
        },

        /**
         * Submit Mileage entries to FSM API
         * @private
         */
        async _submitCreateMileageEntries(aEntries, oModel) {
            try {
                sap.ui.core.BusyIndicator.show(0);
                
                const activityId = oModel.getProperty("/activityId");
                const activityCode = oModel.getProperty("/activityExternalId");
                const orgLevelId = oModel.getProperty("/orgLevelId");
                
                let successCount = 0;
                let errorCount = 0;
                
                for (const entry of aEntries) {
                    const payload = TMPayloadService.buildPayload({
                        type: "Mileage",
                        technicianId: entry.technicianId,
                        technicianExternalId: entry.technicianExternalId,
                        itemId: entry.mileageTypeId,
                        itemDisplay: entry.mileageTypeDisplay,
                        distance: entry.distance,
                        travelDuration: entry.travelDuration,
                        date: entry.entryDate,
                        remarks: entry.remarks,
                        chargeOption: "CHARGEABLE"
                    }, activityId, orgLevelId);
                    
                    try {
                        const response = await fetch('/api/create-mileage', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });
                        
                        const result = await response.json();
                        if (result.success) {
                            successCount++;
                        } else {
                            errorCount++;
                        }
                    } catch (err) {
                        console.error('Error creating mileage:', err);
                        errorCount++;
                    }
                }
                
                sap.ui.core.BusyIndicator.hide();
                
                // Clear entries and refresh
                oModel.setProperty("/mileageEntries", []);
                
                // Refresh T&M Reports
                await this._refreshTMReportsAfterCreate(activityId);
                
                // Close dialog
                TMDialogService.closeTMCreationDialog();
                
                if (errorCount === 0) {
                    MessageBox.success(
                        `Successfully created ${successCount} mileage entry(ies) for Activity ${activityCode}`,
                        { title: "Success" }
                    );
                } else {
                    MessageBox.warning(
                        `Created ${successCount} mileage entry(ies), ${errorCount} failed for Activity ${activityCode}`,
                        { title: "Partial Success" }
                    );
                }
                
            } catch (error) {
                sap.ui.core.BusyIndicator.hide();
                console.error('TMDialogMixin: Error creating mileage:', error);
                MessageBox.error(`Error creating mileage: ${error.message}`, { title: "Error" });
            }
        },

        /**
         * Handle technician live change for table-based creation
         */
        onCreateTechnicianLiveChange(oEvent) {
            const sValue = oEvent.getParameter("value");
            const oInput = oEvent.getSource();
            const oModel = this._tmCreateDialog.getModel("createTM");
            
            if (sValue.length < 2) {
                oModel.setProperty("/technicianSuggestions", []);
                return;
            }
            
            // Search technicians
            const aSuggestions = TechnicianService.searchTechnicians(sValue);
            oModel.setProperty("/technicianSuggestions", aSuggestions);
        },

        /**
         * Handle technician suggestion select for table-based creation
         */
        onCreateTechnicianSuggestionSelect(oEvent) {
            const oItem = oEvent.getParameter("selectedItem");
            if (!oItem) return;
            
            const oInput = oEvent.getSource();
            const oContext = oInput.getBindingContext("createTM");
            if (!oContext) return;
            
            const sPath = oContext.getPath();
            const oModel = this._tmCreateDialog.getModel("createTM");
            
            const sTechId = oItem.getKey();
            const sTechDisplay = oItem.getText();
            
            // Get full technician data
            const oTech = TechnicianService.getTechnicianById(sTechId);
            
            oModel.setProperty(sPath + "/technicianId", sTechId);
            oModel.setProperty(sPath + "/technicianDisplay", sTechDisplay);
            oModel.setProperty(sPath + "/technicianExternalId", oTech?.externalId || "");
        },

        /* ========================================
         * MATERIAL TABLE CREATION HANDLERS
         * ======================================== */

        /**
         * Add new row to Material creation table
         */
        onAddCreateMaterialRow() {
            console.log("onAddCreateMaterialRow called");
            
            if (!this._tmCreateDialog) {
                MessageToast.show("Dialog not initialized");
                return;
            }
            
            const oModel = this._tmCreateDialog.getModel("createTM");
            if (!oModel) {
                MessageToast.show("Model not initialized");
                return;
            }
            
            const aEntries = oModel.getProperty("/materialEntries") || [];
            
            // Get defaults - technician from activity (responsible/supporting)
            const defaultTechId = oModel.getProperty("/defaultTechnicianId") || "";
            const defaultTechDisplay = oModel.getProperty("/defaultTechnicianDisplay") || "";
            const defaultTechExternalId = oModel.getProperty("/defaultTechnicianExternalId") || "";
            const defaultItemId = oModel.getProperty("/defaultItemId") || "";
            const defaultItemDisplay = oModel.getProperty("/defaultItemDisplay") || "";
            const defaultDate = oModel.getProperty("/defaultDate") || "";
            const defaultQuantity = oModel.getProperty("/quantity") || 1;
            
            const newEntry = {
                id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                type: "Material",
                technicianId: defaultTechId,
                technicianExternalId: defaultTechExternalId,
                technicianDisplay: defaultTechDisplay,
                itemId: defaultItemId,
                itemDisplay: defaultItemDisplay,
                quantity: parseFloat(defaultQuantity) || 1,
                entryDate: defaultDate,
                remarks: ""
            };
            
            aEntries.push(newEntry);
            oModel.setProperty("/materialEntries", aEntries);
            oModel.refresh(true);
            console.log("Material entries now:", aEntries.length);
            MessageToast.show("Material entry added");
        },

        /**
         * Remove row from Material creation table
         */
        onRemoveCreateMaterialRow(oEvent) {
            const oButton = oEvent.getSource();
            const oContext = oButton.getBindingContext("createTM");
            
            if (!oContext) {
                MessageToast.show("Could not identify entry to remove");
                return;
            }
            
            const sPath = oContext.getPath();
            const oModel = this._tmCreateDialog.getModel("createTM");
            
            const iIndex = parseInt(sPath.split("/").pop());
            const aEntries = oModel.getProperty("/materialEntries") || [];
            aEntries.splice(iIndex, 1);
            oModel.setProperty("/materialEntries", aEntries);
            MessageToast.show("Material entry removed");
        },

        /**
         * Handle technician selection for Material
         */
        onCreateMaterialTechnicianSelect(oEvent) {
            const oSelect = oEvent.getSource();
            const oContext = oSelect.getBindingContext("createTM");
            if (!oContext) return;
            
            const sPath = oContext.getPath();
            const oModel = this._tmCreateDialog.getModel("createTM");
            const oSelectedItem = oEvent.getParameter("selectedItem");
            
            if (oSelectedItem) {
                const oTech = oSelectedItem.getBindingContext("createTM").getObject();
                oModel.setProperty(sPath + "/technicianId", oTech.id);
                oModel.setProperty(sPath + "/technicianDisplay", oTech.displayText);
                oModel.setProperty(sPath + "/technicianExternalId", oTech.externalId);
            }
        },

        /* ========================================
         * TIME ENTRY TABLE CREATION HANDLERS
         * ======================================== */

        /**
         * Add new row to Time Entry AZ (Arbeitszeit) creation table
         */
        onAddCreateTimeEntryAZ() {
            this._addTimeEntry("AZ", "/timeEntriesAZ");
        },

        /**
         * Add new row to Time Entry FZ (Fahrzeit) creation table
         */
        onAddCreateTimeEntryFZ() {
            this._addTimeEntry("FZ", "/timeEntriesFZ");
        },

        /**
         * Add new row to Time Entry WZ (Wartezeit) creation table
         */
        onAddCreateTimeEntryWZ() {
            this._addTimeEntry("WZ", "/timeEntriesWZ");
        },

        /**
         * Generic time entry add helper
         * @private
         */
        _addTimeEntry(sType, sArrayPath) {
            console.log(`onAddCreateTimeEntry${sType} called`);
            
            if (!this._tmCreateDialog) {
                MessageToast.show("Dialog not initialized");
                return;
            }
            
            const oModel = this._tmCreateDialog.getModel("createTM");
            if (!oModel) {
                MessageToast.show("Model not initialized");
                return;
            }
            
            const aEntries = oModel.getProperty(sArrayPath) || [];
            
            // Get defaults - for time entries, default technician is from activity
            const defaultTechId = oModel.getProperty("/defaultTechnicianId") || "";
            const defaultTechDisplay = oModel.getProperty("/defaultTechnicianDisplay") || "";
            const defaultTechExternalId = oModel.getProperty("/defaultTechnicianExternalId") || "";
            const defaultDate = oModel.getProperty("/defaultDate") || "";
            
            const newEntry = {
                id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                timeType: sType,
                technicianId: defaultTechId,
                technicianExternalId: defaultTechExternalId,
                technicianDisplay: defaultTechDisplay,
                technicianSuggestions: [], // Local suggestions for this entry
                taskCode: "",
                taskDisplay: "",
                durationHrs: 0.5, // Default 0.5 hours (30 minutes)
                entryDate: defaultDate,
                remarks: ""
            };
            
            aEntries.push(newEntry);
            oModel.setProperty(sArrayPath, aEntries);
            oModel.refresh(true);
            console.log(`${sType} time entries now:`, aEntries.length);
            MessageToast.show(`${sType === 'AZ' ? 'Arbeitszeit' : sType === 'FZ' ? 'Fahrzeit' : 'Wartezeit'} entry added`);
        },

        /**
         * Remove row from Time Entry AZ creation table
         */
        onRemoveCreateTimeEntryAZ(oEvent) {
            this._removeTimeEntry(oEvent, "/timeEntriesAZ");
        },

        /**
         * Remove row from Time Entry FZ creation table
         */
        onRemoveCreateTimeEntryFZ(oEvent) {
            this._removeTimeEntry(oEvent, "/timeEntriesFZ");
        },

        /**
         * Remove row from Time Entry WZ creation table
         */
        onRemoveCreateTimeEntryWZ(oEvent) {
            this._removeTimeEntry(oEvent, "/timeEntriesWZ");
        },

        /**
         * Generic time entry remove helper
         * @private
         */
        _removeTimeEntry(oEvent, sArrayPath) {
            const oButton = oEvent.getSource();
            const oContext = oButton.getBindingContext("createTM");
            
            if (!oContext) {
                MessageToast.show("Could not identify entry to remove");
                return;
            }
            
            const sPath = oContext.getPath();
            const oModel = this._tmCreateDialog.getModel("createTM");
            
            const iIndex = parseInt(sPath.split("/").pop());
            const aEntries = oModel.getProperty(sArrayPath) || [];
            aEntries.splice(iIndex, 1);
            oModel.setProperty(sArrayPath, aEntries);
            MessageToast.show("Time entry removed");
        },

        /**
         * Handle technician live change for Time Entry search (all technicians)
         */
        onCreateTimeEntryTechnicianLiveChange(oEvent) {
            const sValue = oEvent.getParameter("value");
            const oInput = oEvent.getSource();
            const oContext = oInput.getBindingContext("createTM");
            
            if (!oContext) return;
            
            const sPath = oContext.getPath();
            const oModel = this._tmCreateDialog.getModel("createTM");
            
            if (sValue.length < 2) {
                oModel.setProperty(sPath + "/technicianSuggestions", []);
                return;
            }
            
            // Search all technicians (not just activity technicians)
            const aSuggestions = TechnicianService.searchTechnicians(sValue);
            oModel.setProperty(sPath + "/technicianSuggestions", aSuggestions);
        },

        /**
         * Handle technician suggestion select for Time Entry
         */
        onCreateTimeEntrySuggestionSelect(oEvent) {
            const oItem = oEvent.getParameter("selectedItem");
            if (!oItem) return;
            
            const oInput = oEvent.getSource();
            const oContext = oInput.getBindingContext("createTM");
            if (!oContext) return;
            
            const sPath = oContext.getPath();
            const oModel = this._tmCreateDialog.getModel("createTM");
            
            const sTechId = oItem.getKey();
            const sTechDisplay = oItem.getText();
            
            // Get full technician data
            const oTech = TechnicianService.getTechnicianById(sTechId);
            
            oModel.setProperty(sPath + "/technicianId", sTechId);
            oModel.setProperty(sPath + "/technicianDisplay", sTechDisplay);
            oModel.setProperty(sPath + "/technicianExternalId", oTech?.externalId || "");
        },

        /* ========================================
         * SAVE ALL TIME & MATERIAL ENTRIES
         * ======================================== */

        /**
         * Save all Time & Material entries with confirmation
         */
        onSaveAllCreateTM() {
            const oModel = this._tmCreateDialog.getModel("createTM");
            const aMaterialEntries = oModel.getProperty("/materialEntries") || [];
            const aTimeEntriesAZ = oModel.getProperty("/timeEntriesAZ") || [];
            const aTimeEntriesFZ = oModel.getProperty("/timeEntriesFZ") || [];
            const aTimeEntriesWZ = oModel.getProperty("/timeEntriesWZ") || [];
            
            const totalEntries = aMaterialEntries.length + aTimeEntriesAZ.length + aTimeEntriesFZ.length + aTimeEntriesWZ.length;
            
            if (totalEntries === 0) {
                MessageToast.show("No entries to save");
                return;
            }
            
            // Validate entries
            let hasErrors = false;
            
            // Check time entries have tasks
            [...aTimeEntriesAZ, ...aTimeEntriesFZ, ...aTimeEntriesWZ].forEach((entry, idx) => {
                if (!entry.taskCode) {
                    hasErrors = true;
                }
            });
            
            if (hasErrors) {
                MessageBox.warning("Please select a task for all time entries before saving.");
                return;
            }
            
            // Build preview
            const lines = [];
            
            if (aMaterialEntries.length > 0) {
                lines.push(`Materials (${aMaterialEntries.length}):`);
                aMaterialEntries.forEach((e, i) => {
                    lines.push(`  ${i + 1}. ${e.itemDisplay || 'N/A'} - Qty: ${e.quantity}`);
                });
            }
            
            if (aTimeEntriesAZ.length > 0) {
                lines.push(`\nArbeitszeit (${aTimeEntriesAZ.length}):`);
                aTimeEntriesAZ.forEach((e, i) => {
                    const taskName = this._getTaskNameByCode(oModel, 'AZ', e.taskCode);
                    lines.push(`  ${i + 1}. ${taskName} - ${e.durationHrs} hrs`);
                });
            }
            
            if (aTimeEntriesFZ.length > 0) {
                lines.push(`\nFahrzeit (${aTimeEntriesFZ.length}):`);
                aTimeEntriesFZ.forEach((e, i) => {
                    const taskName = this._getTaskNameByCode(oModel, 'FZ', e.taskCode);
                    lines.push(`  ${i + 1}. ${taskName} - ${e.durationHrs} hrs`);
                });
            }
            
            if (aTimeEntriesWZ.length > 0) {
                lines.push(`\nWartezeit (${aTimeEntriesWZ.length}):`);
                aTimeEntriesWZ.forEach((e, i) => {
                    const taskName = this._getTaskNameByCode(oModel, 'WZ', e.taskCode);
                    lines.push(`  ${i + 1}. ${taskName} - ${e.durationHrs} hrs`);
                });
            }
            
            MessageBox.confirm(
                `Create ${totalEntries} entries?\n\n${lines.join('\n')}`,
                {
                    title: "Confirm Creation",
                    onClose: (sAction) => {
                        if (sAction === MessageBox.Action.OK) {
                            this._submitCreateTMEntries(aMaterialEntries, aTimeEntriesAZ, aTimeEntriesFZ, aTimeEntriesWZ, oModel);
                        }
                    }
                }
            );
        },

        /**
         * Get task name by code from suggestions
         * @private
         */
        _getTaskNameByCode(oModel, sType, sCode) {
            if (!sCode) return 'N/A';
            
            const aSuggestions = oModel.getProperty(`/taskSuggestions${sType}`) || [];
            const oTask = aSuggestions.find(t => t.code === sCode);
            return oTask ? oTask.name : sCode;
        },

        /**
         * Submit all Time & Material entries to backend
         * @private
         */
        async _submitCreateTMEntries(aMaterialEntries, aTimeEntriesAZ, aTimeEntriesFZ, aTimeEntriesWZ, oModel) {
            try {
                sap.ui.core.BusyIndicator.show(0);
                
                const activityId = oModel.getProperty("/activityId");
                const activityCode = oModel.getProperty("/activityExternalId");
                const orgLevelId = oModel.getProperty("/orgLevelId");
                const plannedStartDate = oModel.getProperty("/plannedStartDate");
                
                let successCount = 0;
                let errorCount = 0;
                
                // Combine all time entries with their type info, then sort by date and type
                const allTimeEntries = [
                    ...aTimeEntriesAZ.map(e => ({ ...e, typeOrder: 1, timeType: 'AZ' })),
                    ...aTimeEntriesFZ.map(e => ({ ...e, typeOrder: 2, timeType: 'FZ' })),
                    ...aTimeEntriesWZ.map(e => ({ ...e, typeOrder: 3, timeType: 'WZ' }))
                ];
                
                // Sort by date, then type order (AZ=1, FZ=2, WZ=3)
                allTimeEntries.sort((a, b) => {
                    const dateA = a.entryDate || '';
                    const dateB = b.entryDate || '';
                    if (dateA !== dateB) return dateA.localeCompare(dateB);
                    return a.typeOrder - b.typeOrder;
                });
                
                // Create Materials first
                for (const entry of aMaterialEntries) {
                    const payload = TMPayloadService.buildPayload({
                        type: "Material",
                        technicianId: entry.technicianId,
                        technicianExternalId: entry.technicianExternalId,
                        itemId: entry.itemId,
                        itemDisplay: entry.itemDisplay,
                        quantity: entry.quantity,
                        date: entry.entryDate,
                        remarks: entry.remarks,
                        chargeOption: "CHARGEABLE"
                    }, activityId, orgLevelId);
                    
                    try {
                        const response = await fetch('/api/create-material', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });
                        
                        const result = await response.json();
                        if (result.success) {
                            successCount++;
                        } else {
                            console.error('Material creation failed:', result.message);
                            errorCount++;
                        }
                    } catch (err) {
                        console.error('Error creating material:', err);
                        errorCount++;
                    }
                }
                
                // Track start times per date for sequential time calculation
                const dateStartTimes = {};
                
                // Create Time Entries sequentially
                for (const entry of allTimeEntries) {
                    const entryDate = entry.entryDate || plannedStartDate?.split('T')[0];
                    
                    // Get or initialize start time for this date
                    if (!dateStartTimes[entryDate]) {
                        // Start at 08:00 for each new date
                        dateStartTimes[entryDate] = new Date(`${entryDate}T08:00:00Z`);
                    }
                    
                    // Convert durationHrs to minutes
                    const durationMinutes = (entry.durationHrs || 0) * 60;
                    
                    const startDateTime = dateStartTimes[entryDate].toISOString();
                    const durationMs = durationMinutes * 60 * 1000;
                    const endDate = new Date(dateStartTimes[entryDate].getTime() + durationMs);
                    const endDateTime = endDate.toISOString();
                    
                    // Update start time for next entry on same date
                    dateStartTimes[entryDate] = endDate;
                    
                    const payload = TMPayloadService.buildPayload({
                        type: "Time Effort",
                        technicianId: entry.technicianId,
                        technicianExternalId: entry.technicianExternalId,
                        taskCode: entry.taskCode,
                        startDateTime: startDateTime,
                        endDateTime: endDateTime,
                        duration: durationMinutes,
                        remarks: entry.remarks,
                        chargeOption: "CHARGEABLE"
                    }, activityId, orgLevelId);
                    
                    try {
                        const response = await fetch('/api/create-time-effort', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });
                        
                        const result = await response.json();
                        if (result.success) {
                            successCount++;
                        } else {
                            console.error('Time effort creation failed:', result.message);
                            errorCount++;
                        }
                    } catch (err) {
                        console.error('Error creating time effort:', err);
                        errorCount++;
                    }
                }
                
                sap.ui.core.BusyIndicator.hide();
                
                // Clear entries
                oModel.setProperty("/materialEntries", []);
                oModel.setProperty("/timeEntriesAZ", []);
                oModel.setProperty("/timeEntriesFZ", []);
                oModel.setProperty("/timeEntriesWZ", []);
                
                // Refresh T&M Reports
                await this._refreshTMReportsAfterCreate(activityId);
                
                // Show result
                if (errorCount === 0) {
                    MessageBox.success(
                        `Successfully created ${successCount} entries.`,
                        {
                            title: "Success",
                            onClose: () => {
                                TMDialogService.closeTMCreationDialog();
                            }
                        }
                    );
                } else {
                    MessageBox.warning(
                        `Created ${successCount} entries with ${errorCount} errors.`,
                        { title: "Partial Success" }
                    );
                }
                
            } catch (error) {
                sap.ui.core.BusyIndicator.hide();
                console.error('TMDialogMixin: Error submitting T&M entries:', error);
                MessageBox.error(
                    `Error creating entries: ${error.message}`,
                    { title: "Error" }
                );
            }
        }
    };
});