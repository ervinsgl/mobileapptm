/**
 * TMEditMixin.js
 * 
 * Mixin for editing and saving individual T&M entries.
 * Handles close, save, update confirmations and submissions.
 * 
 * @file TMEditMixin.js
 * @module mobileappsc/controller/mixin/TMEditMixin
 */
sap.ui.define([
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "mobileappsc/utils/tm/TMCreationService",
    "mobileappsc/utils/tm/TMDataService",
    "mobileappsc/utils/tm/TMPayloadService",
    "mobileappsc/utils/tm/TMEditService",
    "mobileappsc/utils/helpers/DateTimeService",
    "mobileappsc/utils/services/TimeTaskService",
    "mobileappsc/utils/services/ItemService",
    "mobileappsc/utils/services/ExpenseTypeService"
], (MessageToast, MessageBox, TMCreationService, TMDataService, TMPayloadService, TMEditService, DateTimeService, TimeTaskService, ItemService, ExpenseTypeService) => {
    "use strict";

    return {

        /* ========================================
         * ENTRY CLOSE/SAVE HANDLERS
         * ======================================== */

        /**
         * Close individual entry (remove from dialog)
         */
        onCloseEntry(oEvent) {
            const oButton = oEvent.getSource();
            const oContext = oButton.getBindingContext("createTM");
            
            if (!oContext) {
                MessageToast.show("Entry context not available");
                return;
            }
            
            const sPath = oContext.getPath();
            const oModel = this._tmCreateDialog.getModel("createTM");
            const aEntries = oModel.getProperty("/entries") || [];
            
            // Extract index from path (e.g., "/entries/0" -> 0)
            const match = sPath.match(/\/entries\/(\d+)/);
            if (match) {
                const iIndex = parseInt(match[1]);
                aEntries.splice(iIndex, 1);
                oModel.setProperty("/entries", aEntries);
                MessageToast.show("Entry removed");
            }
        },

        /**
         * Save individual entry to FSM
         */
        onSaveEntry(oEvent) {
            const oButton = oEvent.getSource();
            const oContext = oButton.getBindingContext("createTM");
            
            if (!oContext) {
                MessageToast.show("Entry context not available");
                return;
            }
            
            const sPath = oContext.getPath();
            const oModel = this._tmCreateDialog.getModel("createTM");
            const oEntry = oModel.getProperty(sPath);
            
            // Determine entry type and show appropriate confirmation
            switch (oEntry.type) {
                case "Expense":
                    if (oEntry.id && oEntry.id.startsWith && !oEntry.id.startsWith("temp_")) {
                        // Existing entry - update
                        this._showExpenseUpdateConfirmation(oEntry, sPath, oModel);
                    } else {
                        // New entry - create
                        this._showExpenseConfirmation(oEntry, sPath, oModel);
                    }
                    break;
                case "Mileage":
                    if (oEntry.id && oEntry.id.startsWith && !oEntry.id.startsWith("temp_")) {
                        this._showMileageUpdateConfirmation(oEntry, sPath, oModel);
                    } else {
                        this._showMileageConfirmation(oEntry, sPath, oModel);
                    }
                    break;
                case "Material":
                    if (oEntry.id && oEntry.id.startsWith && !oEntry.id.startsWith("temp_")) {
                        this._showMaterialUpdateConfirmation(oEntry, sPath, oModel);
                    } else {
                        MessageToast.show("Material creation - use Save All");
                    }
                    break;
                case "Time Effort":
                    if (oEntry.id && oEntry.id.startsWith && !oEntry.id.startsWith("temp_")) {
                        this._showTimeEffortUpdateConfirmation(oEntry, sPath, oModel);
                    } else {
                        MessageToast.show("Time Effort creation - use Time & Material");
                    }
                    break;
                case "Time & Material":
                    this._showTimeAndMaterialConfirmation(oEntry, sPath, oModel);
                    break;
                default:
                    MessageToast.show(`Save not implemented for type: ${oEntry.type}`);
            }
        },

        /* ========================================
         * EXPENSE ENTRY HANDLERS
         * ======================================== */

        _showExpenseConfirmation(oEntry, sPath, oModel) {
            const activityId = oModel.getProperty("/activityId");
            const activityCode = oModel.getProperty("/activityCode") || oModel.getProperty("/activityExternalId");
            const orgLevelId = oModel.getProperty("/orgLevelId");
            
            const payload = TMPayloadService.buildPayload(oEntry, activityId, orgLevelId);
            const previewText = this._formatExpensePreview(oEntry, payload);
            
            MessageBox.confirm(
                `Create Expense Entry?\n\n${previewText}`,
                {
                    title: "Confirm Expense Creation",
                    onClose: (sAction) => {
                        if (sAction === MessageBox.Action.OK) {
                            this._submitExpenseToFSM(payload, oEntry, sPath, oModel, activityCode);
                        }
                    }
                }
            );
        },

        _formatExpensePreview(oEntry, payload) {
            const lines = [];
            lines.push(`Type: ${oEntry.expenseTypeDisplay || 'N/A'}`);
            lines.push(`External Amount: ${oEntry.externalAmountValue || 0} EUR`);
            lines.push(`Internal Amount: ${oEntry.internalAmountValue || 0} EUR`);
            lines.push(`Technician: ${oEntry.technicianDisplay || 'N/A'}`);
            lines.push(`Date: ${payload.date || 'N/A'}`);
            if (oEntry.remarks) {
                lines.push(`Remarks: ${oEntry.remarks}`);
            }
            return lines.join('\n');
        },

        async _submitExpenseToFSM(payload, oEntry, sPath, oModel, activityCode) {
            try {
                sap.ui.core.BusyIndicator.show(0);
                
                const response = await fetch('/api/create-expense', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                const result = await response.json();
                
                if (result.success) {
                    MessageToast.show("Expense entry created successfully");
                    
                    // Remove entry from dialog
                    const aEntries = oModel.getProperty("/entries") || [];
                    const match = sPath.match(/\/entries\/(\d+)/);
                    if (match) {
                        const iIndex = parseInt(match[1]);
                        aEntries.splice(iIndex, 1);
                        oModel.setProperty("/entries", aEntries);
                    }
                    
                    // Refresh T&M reports
                    const activityId = oModel.getProperty("/activityId");
                    if (activityId) {
                        await this._refreshTMReportsAfterCreate(activityId);
                    }
                } else {
                    MessageBox.error(`Failed to create expense: ${result.message || 'Unknown error'}`);
                }
            } catch (error) {
                console.error("Error creating expense:", error);
                MessageBox.error(`Error: ${error.message}`);
            } finally {
                sap.ui.core.BusyIndicator.hide();
            }
        },

        _showExpenseUpdateConfirmation(oEntry, sPath, oModel) {
            const activityId = oModel.getProperty("/activityId");
            const orgLevelId = oModel.getProperty("/orgLevelId");
            
            const payload = TMPayloadService.buildPayload(oEntry, activityId, orgLevelId);
            const previewText = this._formatExpenseUpdatePreview(oEntry, payload);
            
            MessageBox.confirm(
                `Update Expense Entry?\n\n${previewText}`,
                {
                    title: "Confirm Expense Update",
                    onClose: (sAction) => {
                        if (sAction === MessageBox.Action.OK) {
                            this._submitExpenseUpdate(oEntry.id, payload, sPath, oModel);
                        }
                    }
                }
            );
        },

        _formatExpenseUpdatePreview(oEntry, payload) {
            const lines = [];
            lines.push(`ID: ${oEntry.id}`);
            lines.push(`Type: ${oEntry.expenseTypeDisplay || 'N/A'}`);
            lines.push(`External Amount: ${oEntry.externalAmountValue || 0} EUR`);
            lines.push(`Internal Amount: ${oEntry.internalAmountValue || 0} EUR`);
            if (oEntry.remarks) {
                lines.push(`Remarks: ${oEntry.remarks}`);
            }
            return lines.join('\n');
        },

        async _submitExpenseUpdate(expenseId, payload, sPath, oModel) {
            try {
                sap.ui.core.BusyIndicator.show(0);
                
                const response = await fetch(`/api/update-expense/${expenseId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                const result = await response.json();
                
                if (result.success) {
                    MessageToast.show("Expense updated successfully");
                    oModel.setProperty(sPath + "/editMode", false);
                    
                    const activityId = oModel.getProperty("/activityId");
                    if (activityId) {
                        await this._refreshTMReportsAfterCreate(activityId);
                    }
                } else {
                    MessageBox.error(`Failed to update expense: ${result.message || 'Unknown error'}`);
                }
            } catch (error) {
                console.error("Error updating expense:", error);
                MessageBox.error(`Error: ${error.message}`);
            } finally {
                sap.ui.core.BusyIndicator.hide();
            }
        },

        /* ========================================
         * MILEAGE ENTRY HANDLERS
         * ======================================== */

        _showMileageUpdateConfirmation(oEntry, sPath, oModel) {
            const activityId = oModel.getProperty("/activityId");
            const orgLevelId = oModel.getProperty("/orgLevelId");
            
            // Recalculate duration from travelDuration
            const durationMinutes = oEntry.travelDuration || 0;
            
            // Build payload with updated duration
            const payload = {
                ...oEntry.fullData,
                distance: oEntry.distance,
                remarks: oEntry.remarks
            };
            
            // Update travel end time based on new duration
            if (payload.travelStartDateTime) {
                const startDate = new Date(payload.travelStartDateTime);
                const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
                payload.travelEndDateTime = endDate.toISOString().replace(/\.\d{3}Z$/, 'Z');
            }
            
            const previewText = this._formatMileageUpdatePreview(oEntry, payload, durationMinutes);
            
            MessageBox.confirm(
                `Update Mileage Entry?\n\n${previewText}`,
                {
                    title: "Confirm Mileage Update",
                    onClose: (sAction) => {
                        if (sAction === MessageBox.Action.OK) {
                            this._submitMileageUpdate(oEntry.id, payload, sPath, oModel);
                        }
                    }
                }
            );
        },

        _formatMileageUpdatePreview(oEntry, payload, durationMinutes) {
            const lines = [];
            lines.push(`ID: ${oEntry.id}`);
            lines.push(`Distance: ${oEntry.distance || 0} KM`);
            lines.push(`Duration: ${durationMinutes} min`);
            if (oEntry.remarks) {
                lines.push(`Remarks: ${oEntry.remarks}`);
            }
            return lines.join('\n');
        },

        async _submitMileageUpdate(mileageId, payload, sPath, oModel) {
            try {
                sap.ui.core.BusyIndicator.show(0);
                
                const response = await fetch(`/api/update-mileage/${mileageId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                const result = await response.json();
                
                if (result.success) {
                    MessageToast.show("Mileage updated successfully");
                    oModel.setProperty(sPath + "/editMode", false);
                    
                    const activityId = oModel.getProperty("/activityId");
                    if (activityId) {
                        await this._refreshTMReportsAfterCreate(activityId);
                    }
                } else {
                    MessageBox.error(`Failed to update mileage: ${result.message || 'Unknown error'}`);
                }
            } catch (error) {
                console.error("Error updating mileage:", error);
                MessageBox.error(`Error: ${error.message}`);
            } finally {
                sap.ui.core.BusyIndicator.hide();
            }
        },

        /* ========================================
         * MATERIAL ENTRY HANDLERS
         * ======================================== */

        _showMaterialUpdateConfirmation(oEntry, sPath, oModel) {
            const payload = {
                ...oEntry.fullData,
                quantity: oEntry.quantity,
                remarks: oEntry.remarks
            };
            
            // Update date if changed
            if (oEntry.entryDateFormatted) {
                payload.date = oEntry.entryDateFormatted;
            }
            
            const previewText = this._formatMaterialUpdatePreview(oEntry, payload);
            
            MessageBox.confirm(
                `Update Material Entry?\n\n${previewText}`,
                {
                    title: "Confirm Material Update",
                    onClose: (sAction) => {
                        if (sAction === MessageBox.Action.OK) {
                            this._submitMaterialUpdate(oEntry.id, payload, sPath, oModel);
                        }
                    }
                }
            );
        },

        _formatMaterialUpdatePreview(oEntry, payload) {
            const lines = [];
            lines.push(`ID: ${oEntry.id}`);
            lines.push(`Item: ${oEntry.itemDisplayText || 'N/A'}`);
            lines.push(`Quantity: ${oEntry.quantity || 0}`);
            lines.push(`Date: ${oEntry.entryDateFormatted || 'N/A'}`);
            if (oEntry.remarks) {
                lines.push(`Remarks: ${oEntry.remarks}`);
            }
            return lines.join('\n');
        },

        async _submitMaterialUpdate(materialId, payload, sPath, oModel) {
            try {
                sap.ui.core.BusyIndicator.show(0);
                
                const response = await fetch(`/api/update-material/${materialId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                const result = await response.json();
                
                if (result.success) {
                    MessageToast.show("Material updated successfully");
                    oModel.setProperty(sPath + "/editMode", false);
                    
                    const activityId = oModel.getProperty("/activityId");
                    if (activityId) {
                        await this._refreshTMReportsAfterCreate(activityId);
                    }
                } else {
                    MessageBox.error(`Failed to update material: ${result.message || 'Unknown error'}`);
                }
            } catch (error) {
                console.error("Error updating material:", error);
                MessageBox.error(`Error: ${error.message}`);
            } finally {
                sap.ui.core.BusyIndicator.hide();
            }
        },

        /* ========================================
         * TIME EFFORT ENTRY HANDLERS
         * ======================================== */

        _showTimeEffortUpdateConfirmation(oEntry, sPath, oModel) {
            // Get duration from durationHrs (in hours) -> convert to minutes
            const durationMinutes = Math.round((oEntry.durationHrs || 0) * 60);
            
            // Build updated payload
            const payload = {
                ...oEntry.fullData,
                remarks: oEntry.remarks
            };
            
            // Update start/end times based on new duration
            if (payload.startDateTime) {
                const startDate = new Date(payload.startDateTime);
                const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
                payload.endDateTime = endDate.toISOString().replace(/\.\d{3}Z$/, 'Z');
            }
            
            // Update date if changed
            if (oEntry.entryDateFormatted && payload.startDateTime) {
                const originalTime = payload.startDateTime.split('T')[1];
                payload.startDateTime = `${oEntry.entryDateFormatted}T${originalTime}`;
                const startDate = new Date(payload.startDateTime);
                const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
                payload.endDateTime = endDate.toISOString().replace(/\.\d{3}Z$/, 'Z');
            }
            
            const previewText = this._formatTimeEffortUpdatePreview(oEntry, payload, durationMinutes);
            
            MessageBox.confirm(
                `Update Time Effort Entry?\n\n${previewText}`,
                {
                    title: "Confirm Time Effort Update",
                    onClose: (sAction) => {
                        if (sAction === MessageBox.Action.OK) {
                            this._submitTimeEffortUpdate(oEntry.id, payload, sPath, oModel);
                        }
                    }
                }
            );
        },

        _formatTimeEffortUpdatePreview(oEntry, payload, durationMinutes) {
            const lines = [];
            lines.push(`ID: ${oEntry.id}`);
            lines.push(`Task: ${oEntry.taskDisplayText || 'N/A'}`);
            lines.push(`Duration: ${durationMinutes} min (${(durationMinutes / 60).toFixed(2)} hrs)`);
            lines.push(`Date: ${oEntry.entryDateFormatted || 'N/A'}`);
            if (oEntry.remarks) {
                lines.push(`Remarks: ${oEntry.remarks}`);
            }
            return lines.join('\n');
        },

        async _submitTimeEffortUpdate(timeEffortId, payload, sPath, oModel) {
            try {
                sap.ui.core.BusyIndicator.show(0);
                
                const response = await fetch(`/api/update-time-effort/${timeEffortId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                const result = await response.json();
                
                if (result.success) {
                    MessageToast.show("Time Effort updated successfully");
                    oModel.setProperty(sPath + "/editMode", false);
                    
                    const activityId = oModel.getProperty("/activityId");
                    if (activityId) {
                        await this._refreshTMReportsAfterCreate(activityId);
                    }
                } else {
                    MessageBox.error(`Failed to update time effort: ${result.message || 'Unknown error'}`);
                }
            } catch (error) {
                console.error("Error updating time effort:", error);
                MessageBox.error(`Error: ${error.message}`);
            } finally {
                sap.ui.core.BusyIndicator.hide();
            }
        },

        /* ========================================
         * MILEAGE CREATION HANDLERS
         * ======================================== */

        _showMileageConfirmation(oEntry, sPath, oModel) {
            const activityId = oModel.getProperty("/activityId");
            const activityCode = oModel.getProperty("/activityCode") || oModel.getProperty("/activityExternalId");
            const orgLevelId = oModel.getProperty("/orgLevelId");
            
            const payload = TMPayloadService.buildPayload(oEntry, activityId, orgLevelId);
            const previewText = this._formatMileagePreview(oEntry, payload);
            
            MessageBox.confirm(
                `Create Mileage Entry?\n\n${previewText}`,
                {
                    title: "Confirm Mileage Creation",
                    onClose: (sAction) => {
                        if (sAction === MessageBox.Action.OK) {
                            this._submitMileageToFSM(payload, oEntry, sPath, oModel, activityCode);
                        }
                    }
                }
            );
        },

        _formatMileagePreview(oEntry, payload) {
            const lines = [];
            lines.push(`Type: ${oEntry.itemDisplay || 'N/A'}`);
            lines.push(`Distance: ${oEntry.distance || 0} KM`);
            lines.push(`Duration: ${oEntry.travelDuration || 0} min`);
            lines.push(`Technician: ${oEntry.technicianDisplay || 'N/A'}`);
            if (oEntry.remarks) {
                lines.push(`Remarks: ${oEntry.remarks}`);
            }
            return lines.join('\n');
        },

        async _submitMileageToFSM(payload, oEntry, sPath, oModel, activityCode) {
            try {
                sap.ui.core.BusyIndicator.show(0);
                
                const response = await fetch('/api/create-mileage', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                const result = await response.json();
                
                if (result.success) {
                    MessageToast.show("Mileage entry created successfully");
                    
                    // Remove entry from dialog
                    const aEntries = oModel.getProperty("/entries") || [];
                    const match = sPath.match(/\/entries\/(\d+)/);
                    if (match) {
                        const iIndex = parseInt(match[1]);
                        aEntries.splice(iIndex, 1);
                        oModel.setProperty("/entries", aEntries);
                    }
                    
                    // Refresh T&M reports
                    const activityId = oModel.getProperty("/activityId");
                    if (activityId) {
                        await this._refreshTMReportsAfterCreate(activityId);
                    }
                } else {
                    MessageBox.error(`Failed to create mileage: ${result.message || 'Unknown error'}`);
                }
            } catch (error) {
                console.error("Error creating mileage:", error);
                MessageBox.error(`Error: ${error.message}`);
            } finally {
                sap.ui.core.BusyIndicator.hide();
            }
        },

        /* ========================================
         * TIME & MATERIAL CREATION HANDLERS
         * ======================================== */

        _showTimeAndMaterialConfirmation(oEntry, sPath, oModel) {
            const activityId = oModel.getProperty("/activityId");
            const activityCode = oModel.getProperty("/activityCode") || oModel.getProperty("/activityExternalId");
            const orgLevelId = oModel.getProperty("/orgLevelId");
            
            // Validate tasks are selected
            const validation = this._validateTimeAndMaterialTasks(oEntry);
            if (!validation.valid) {
                MessageBox.warning(validation.message);
                return;
            }
            
            const payload = TMPayloadService.buildTMPayload(oEntry, activityId, orgLevelId);
            const previewText = this._formatTimeAndMaterialPreview(oEntry, payload);
            
            MessageBox.confirm(
                `Create Time & Material Entries?\n\n${previewText}`,
                {
                    title: "Confirm T&M Creation",
                    onClose: (sAction) => {
                        if (sAction === MessageBox.Action.OK) {
                            this._submitTimeAndMaterialToFSM(payload, oEntry, sPath, oModel, activityCode);
                        }
                    }
                }
            );
        },

        _validateTimeAndMaterialTasks(oEntry) {
            const errors = [];
            
            if (oEntry.timeEffortsFZ?.length > 0) {
                const missingFZ = oEntry.timeEffortsFZ.some(te => !te.taskCode);
                if (missingFZ) errors.push("Fahrzeit (FZ) entries need a task");
            }
            
            if (oEntry.timeEffortsWZ?.length > 0) {
                const missingWZ = oEntry.timeEffortsWZ.some(te => !te.taskCode);
                if (missingWZ) errors.push("Wartezeit (WZ) entries need a task");
            }
            
            if (oEntry.timeEffortsAZ?.length > 0) {
                const missingAZ = oEntry.timeEffortsAZ.some(te => !te.taskCode);
                if (missingAZ) errors.push("Arbeitszeit (AZ) entries need a task");
            }
            
            if (errors.length > 0) {
                return { valid: false, message: errors.join('\n') };
            }
            
            return { valid: true };
        },

        _formatTimeAndMaterialPreview(oEntry, payload) {
            const lines = [];
            
            // Material
            lines.push(`Material: ${oEntry.itemDisplay || 'N/A'}`);
            lines.push(`  Qty: ${oEntry.quantity || 0}`);
            
            // Time efforts
            const fzCount = payload.timeEffortsFZ?.length || 0;
            const wzCount = payload.timeEffortsWZ?.length || 0;
            const azCount = payload.timeEffortsAZ?.length || 0;
            
            if (fzCount > 0) lines.push(`Fahrzeit (FZ): ${fzCount} entries`);
            if (wzCount > 0) lines.push(`Wartezeit (WZ): ${wzCount} entries`);
            if (azCount > 0) lines.push(`Arbeitszeit (AZ): ${azCount} entries`);
            
            lines.push(`\nTechnician: ${oEntry.technicianDisplay || 'N/A'}`);
            
            return lines.join('\n');
        },

        async _submitTimeAndMaterialToFSM(payload, oEntry, sPath, oModel, activityCode) {
            try {
                sap.ui.core.BusyIndicator.show(0);
                
                let successCount = 0;
                let errorCount = 0;
                
                // 1. Create Material
                if (payload.material) {
                    const matResponse = await fetch('/api/create-material', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload.material)
                    });
                    const matResult = await matResponse.json();
                    if (matResult.success) successCount++; else errorCount++;
                }
                
                // 2. Create Time Efforts (FZ)
                for (const te of (payload.timeEffortsFZ || [])) {
                    const teResponse = await fetch('/api/create-time-effort', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(te)
                    });
                    const teResult = await teResponse.json();
                    if (teResult.success) successCount++; else errorCount++;
                }
                
                // 3. Create Time Efforts (WZ)
                for (const te of (payload.timeEffortsWZ || [])) {
                    const teResponse = await fetch('/api/create-time-effort', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(te)
                    });
                    const teResult = await teResponse.json();
                    if (teResult.success) successCount++; else errorCount++;
                }
                
                // 4. Create Time Efforts (AZ)
                for (const te of (payload.timeEffortsAZ || [])) {
                    const teResponse = await fetch('/api/create-time-effort', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(te)
                    });
                    const teResult = await teResponse.json();
                    if (teResult.success) successCount++; else errorCount++;
                }
                
                if (errorCount === 0) {
                    MessageToast.show(`${successCount} entries created successfully`);
                    
                    // Remove entry from dialog
                    const aEntries = oModel.getProperty("/entries") || [];
                    const match = sPath.match(/\/entries\/(\d+)/);
                    if (match) {
                        const iIndex = parseInt(match[1]);
                        aEntries.splice(iIndex, 1);
                        oModel.setProperty("/entries", aEntries);
                    }
                } else {
                    MessageBox.warning(`Created ${successCount} entries, ${errorCount} failed`);
                }
                
                // Refresh T&M reports
                const activityId = oModel.getProperty("/activityId");
                if (activityId) {
                    await this._refreshTMReportsAfterCreate(activityId);
                }
                
            } catch (error) {
                console.error("Error creating T&M:", error);
                MessageBox.error(`Error: ${error.message}`);
            } finally {
                sap.ui.core.BusyIndicator.hide();
            }
        }

    };
});