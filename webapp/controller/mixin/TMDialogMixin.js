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
                if (report.type === "Expense" && report.fullData?.type) {
                    report.expenseTypeDisplayText = ExpenseTypeService.getExpenseTypeDisplayTextById(report.fullData.type);
                }
                
                // Mileage: type from UDF
                if (report.type === "Mileage") {
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
         * Toggle Edit Mode for T&M Entry
         */
        onToggleEditMode(oEvent) {
            const oButton = oEvent.getSource();
            const oContext = oButton.getBindingContext("dialog");

            if (!oContext) return;

            const sPath = oContext.getPath();
            const oModel = this._tmReportsDialog.getModel("dialog");
            const bCurrentEditMode = oModel.getProperty(sPath + "/editMode") || false;
            const sType = oModel.getProperty(sPath + "/type");
            const oEntry = oContext.getObject();

            if (bCurrentEditMode) {
                // Exiting edit mode -> Send for Approval
                const editedValues = TMEditService.getEditedValues(sType, oModel, sPath);
                const payload = TMEditService.buildUpdatePayload(sType, oEntry.id, editedValues);
                const jsonString = TMEditService.formatPayloadJSON(payload);

                MessageBox.information(jsonString, {
                    title: `Updated ${sType} Entry Data`,
                    contentWidth: "500px",
                    styleClass: "sapUiSizeCompact"
                });

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
            const oContext = oEvent.getSource().getBindingContext("dialog");
            if (!oContext) return;

            const oModel = this._tmReportsDialog.getModel("dialog");
            const newDuration = oEvent.getParameter("value");
            TMEditService.handleDurationChange(oModel, oContext.getPath(), "Time Effort", newDuration);
        },

        /**
         * Handle mileage duration change in edit mode
         */
        onEditMileageDurationChange(oEvent) {
            const oContext = oEvent.getSource().getBindingContext("dialog");
            if (!oContext) return;

            const oModel = this._tmReportsDialog.getModel("dialog");
            const newDuration = oEvent.getParameter("value");
            TMEditService.handleDurationChange(oModel, oContext.getPath(), "Mileage", newDuration);
        },

        /* ========================================
         * T&M CREATION DIALOG METHODS
         * ======================================== */

        /**
         * Add new T&M Report - Opens unified creation dialog
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
         * Show entry JSON in dialog
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
         * Handle travel duration change for Mileage
         */
        onTravelDurationChange(oEvent) {
            const oContext = oEvent.getSource().getBindingContext("createTM");
            if (!oContext) return;

            const oModel = this._tmCreateDialog.getModel("createTM");
            const iDuration = oEvent.getParameter("value");
            DateTimeService.handleDurationChange(oModel, oContext.getPath(), iDuration, "travelStartDateTime", "travelEndDateTime");
        },

        /**
         * Handle travel start datetime change for Mileage
         */
        onTravelStartDateTimeChange(oEvent) {
            const oContext = oEvent.getSource().getBindingContext("createTM");
            if (!oContext) return;

            const oModel = this._tmCreateDialog.getModel("createTM");
            DateTimeService.handleStartDateTimeChange(oModel, oContext.getPath(), "travelStartDateTime", "travelDuration", "travelEndDateTime", 30);
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
        }
    };
});