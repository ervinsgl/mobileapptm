/**
 * TMTableMixin.js
 * 
 * Mixin for T&M table view handlers.
 * Handles filtering, sorting, edit selected, and save all operations.
 * 
 * @file TMTableMixin.js
 * @module mobileappsc/controller/mixin/TMTableMixin
 */
sap.ui.define([
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/Sorter"
], (MessageToast, MessageBox, Filter, FilterOperator, Sorter) => {
    "use strict";

    return {

        /* ========================================
         * T&M DYNAMIC TIME EFFORTS (LEGACY)
         * ======================================== */

        onAddTimeEffortFZ(oEvent) {
            this._addTimeEffort(oEvent, "FZ", "timeEffortsFZ");
        },

        onAddTimeEffortWZ(oEvent) {
            this._addTimeEffort(oEvent, "WZ", "timeEffortsWZ");
        },

        onAddTimeEffortAZ(oEvent) {
            this._addTimeEffort(oEvent, "AZ", "timeEffortsAZ");
        },

        onRemoveTimeEffortFZ(oEvent) {
            this._removeTimeEffort(oEvent, "timeEffortsFZ");
        },

        onRemoveTimeEffortWZ(oEvent) {
            this._removeTimeEffort(oEvent, "timeEffortsWZ");
        },

        onRemoveTimeEffortAZ(oEvent) {
            this._removeTimeEffort(oEvent, "timeEffortsAZ");
        },

        _addTimeEffort(oEvent, sType, sArrayProperty) {
            const oButton = oEvent.getSource();
            const oContext = oButton.getBindingContext("createTM");
            
            if (!oContext) {
                MessageToast.show(this._getText("msgEntryContextNotAvailable"));
                return;
            }
            
            const sPath = oContext.getPath();
            const oModel = this._tmCreateDialog.getModel("createTM");
            const oEntry = oModel.getProperty(sPath);
            
            const aTimeEfforts = oEntry[sArrayProperty] || [];
            
            const newTimeEffort = {
                id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                type: sType,
                taskCode: "",
                taskDisplay: "",
                duration: 30,
                technicianId: oEntry.technicianId || "",
                technicianExternalId: oEntry.technicianExternalId || "",
                technicianDisplay: oEntry.technicianDisplay || "",
                remarks: ""
            };
            
            aTimeEfforts.push(newTimeEffort);
            oModel.setProperty(sPath + "/" + sArrayProperty, aTimeEfforts);
            
            MessageToast.show(this._getText("msgTimeEffortAdded", [sType]));
        },

        _removeTimeEffort(oEvent, sArrayProperty) {
            const oButton = oEvent.getSource();
            const oContext = oButton.getBindingContext("createTM");
            
            if (!oContext) {
                MessageToast.show(this._getText("msgEntryContextNotAvailable"));
                return;
            }
            
            const sPath = oContext.getPath();
            const oModel = this._tmCreateDialog.getModel("createTM");
            
            const match = sPath.match(/(\/entries\/\d+)\/(\w+)\/(\d+)/);
            if (match) {
                const sEntryPath = match[1];
                const sProperty = match[2];
                const iIndex = parseInt(match[3]);
                
                const aTimeEfforts = oModel.getProperty(sEntryPath + "/" + sProperty) || [];
                aTimeEfforts.splice(iIndex, 1);
                oModel.setProperty(sEntryPath + "/" + sProperty, aTimeEfforts);
                
                MessageToast.show(this._getText("msgTimeEffortRemoved"));
            }
        },

        /* ========================================
         * HELPER: GET TABLE FROM TOOLBAR
         * ======================================== */

        /**
         * Get the Table from a toolbar control (handles ScrollContainer wrapper)
         * Navigation: Control â†’ Toolbar â†’ Panel â†’ Content â†’ [ScrollContainer â†’] Table
         * @private
         */
        _getTableFromToolbarControl(oControl) {
            const oToolbar = oControl.getParent();
            const oPanel = oToolbar ? oToolbar.getParent() : null;
            
            if (!oPanel || !oPanel.getContent) return null;
            
            const aContent = oPanel.getContent();
            // Handle ScrollContainer wrapper - table may be direct child or inside ScrollContainer
            let oTable = aContent && aContent.length > 0 ? aContent[0] : null;
            if (oTable && oTable.getContent && !oTable.getBinding("items")) {
                // It's a ScrollContainer, get its content
                const aScrollContent = oTable.getContent();
                oTable = aScrollContent && aScrollContent.length > 0 ? aScrollContent[0] : null;
            }
            
            return oTable;
        },

        /**
         * Get activity path from a toolbar control
         * @private
         */
        _getActivityPathFromToolbarControl(oControl) {
            // Navigate up to find activity context
            let oParent = oControl;
            while (oParent) {
                const oContext = oParent.getBindingContext?.("view");
                if (oContext) {
                    const sPath = oContext.getPath();
                    if (sPath && sPath.includes("/activities/")) {
                        return sPath;
                    }
                }
                oParent = oParent.getParent?.();
            }
            return null;
        },

        /**
         * Get the edit mode property name based on table contents
         * @private
         */
        _getEditModeProperty(oTable) {
            const oBinding = oTable.getBinding("rows") || oTable.getBinding("items");
            if (!oBinding) return "tmEditMode";
            
            const aContexts = oBinding.getContexts();
            if (aContexts.length > 0) {
                const firstItem = aContexts[0].getObject();
                const type = firstItem?.type;
                
                if (type === "Expense" || type === "Expense Report") {
                    return "expenseEditMode";
                } else if (type === "Mileage") {
                    return "mileageEditMode";
                }
            }
            return "tmEditMode";
        },

        /* ========================================
         * TABLE FILTER HANDLER
         * ======================================== */

        /**
         * Handle T&M type filter change
         */
        onTMTypeFilterChange(oEvent) {
            const sKey = oEvent.getParameter("item").getKey();
            const oButton = oEvent.getSource();
            
            const oTable = this._getTableFromToolbarControl(oButton);
            if (!oTable || !oTable.getBinding) return;
            
            const oBinding = oTable.getBinding("rows") || oTable.getBinding("items");
            if (!oBinding) return;
            
            // Build filters
            const aFilters = [];
            if (sKey === "Time Effort") {
                aFilters.push(new Filter("type", FilterOperator.EQ, "Time Effort"));
            } else if (sKey === "Material") {
                aFilters.push(new Filter("type", FilterOperator.EQ, "Material"));
            } else {
                // ALL - exclude Expense and Mileage
                aFilters.push(new Filter("type", FilterOperator.NE, "Expense"));
                aFilters.push(new Filter("type", FilterOperator.NE, "Mileage"));
            }
            
            oBinding.filter(aFilters);
        },

        /* ========================================
         * TABLE SORT HANDLER
         * ======================================== */

        /**
         * Handle T&M sort change
         */
        onTMSortChange(oEvent) {
            const sKey = oEvent.getParameter("selectedItem").getKey();
            const oSelect = oEvent.getSource();
            
            const oTable = this._getTableFromToolbarControl(oSelect);
            if (!oTable || !oTable.getBinding) return;
            
            const oBinding = oTable.getBinding("rows") || oTable.getBinding("items");
            if (!oBinding) return;
            
            // Parse key: "fieldName-direction"
            const [sPath, sDirection] = sKey.split("-");
            const bDescending = sDirection === "desc";
            
            // Create sorter
            const oSorter = new Sorter(sPath, bDescending);
            oBinding.sort(oSorter);
        },

        /* ========================================
         * EDIT SELECTED HANDLER
         * ======================================== */

        /**
         * Enable edit mode for selected T&M entries
         */
        onEditSelectedTM(oEvent) {
            const oButton = oEvent.getSource();
            
            const oTable = this._getTableFromToolbarControl(oButton);
            if (!oTable) return;
            
            const oModel = this.getView().getModel("view");
            const oBinding = oTable.getBinding("rows") || oTable.getBinding("items");
            if (!oBinding) return;
            
            // Get all contexts from binding and find selected ones
            const aContexts = oBinding.getContexts();
            let editCount = 0;
            
            aContexts.forEach(oContext => {
                const oData = oContext.getObject();
                if (oData.selected) {
                    const sPath = oContext.getPath();
                    
                    // Store original values for cancel functionality
                    oModel.setProperty(sPath + "/originalValues", {
                        duration: oData.duration,
                        durationMinutes: oData.durationMinutes,
                        durationHrs: oData.durationHrs,
                        travelDuration: oData.travelDuration,
                        travelDurationMinutes: oData.travelDurationMinutes,
                        distance: oData.distance,
                        distanceValue: oData.distanceValue,
                        quantity: oData.quantity,
                        remarks: oData.remarks,
                        remarksText: oData.remarksText,
                        externalAmountValue: oData.externalAmountValue,
                        internalAmountValue: oData.internalAmountValue,
                        entryDateFormatted: oData.entryDateFormatted
                    });
                    
                    oModel.setProperty(sPath + "/editMode", true);
                    oModel.setProperty(sPath + "/selected", false);
                    editCount++;
                }
            });
            
            if (editCount === 0) {
                MessageToast.show(this._getText("msgSelectEntriesToEdit"));
                return;
            }
            
            // Set activity-level edit mode flag based on table type
            const sActivityPath = this._getActivityPathFromToolbarControl(oButton);
            const sEditModeProp = this._getEditModeProperty(oTable);
            if (sActivityPath) {
                oModel.setProperty(sActivityPath + "/" + sEditModeProp, true);
            }
            
            MessageToast.show(this._getText("msgEntriesInEditMode", [editCount]));
        },

        /* ========================================
         * END EDIT HANDLER
         * ======================================== */

        /**
         * End edit mode for all entries (cancel)
         */
        onEndEditTM(oEvent) {
            const oButton = oEvent.getSource();
            
            const oTable = this._getTableFromToolbarControl(oButton);
            if (!oTable) return;
            
            const oModel = this.getView().getModel("view");
            const oBinding = oTable.getBinding("rows") || oTable.getBinding("items");
            if (!oBinding) return;
            
            const aContexts = oBinding.getContexts();
            let cancelCount = 0;
            
            aContexts.forEach(oContext => {
                const oData = oContext.getObject();
                if (oData.editMode) {
                    const sPath = oContext.getPath();
                    
                    // Restore original values
                    const originalValues = oData.originalValues;
                    if (originalValues) {
                        oModel.setProperty(sPath + "/duration", originalValues.duration);
                        oModel.setProperty(sPath + "/durationMinutes", originalValues.durationMinutes);
                        oModel.setProperty(sPath + "/durationHrs", originalValues.durationHrs);
                        oModel.setProperty(sPath + "/travelDuration", originalValues.travelDuration);
                        oModel.setProperty(sPath + "/travelDurationMinutes", originalValues.travelDurationMinutes);
                        oModel.setProperty(sPath + "/distance", originalValues.distance);
                        oModel.setProperty(sPath + "/distanceValue", originalValues.distanceValue);
                        oModel.setProperty(sPath + "/quantity", originalValues.quantity);
                        oModel.setProperty(sPath + "/remarks", originalValues.remarks);
                        oModel.setProperty(sPath + "/remarksText", originalValues.remarksText);
                        oModel.setProperty(sPath + "/externalAmountValue", originalValues.externalAmountValue);
                        oModel.setProperty(sPath + "/internalAmountValue", originalValues.internalAmountValue);
                        oModel.setProperty(sPath + "/entryDateFormatted", originalValues.entryDateFormatted);
                    }
                    
                    oModel.setProperty(sPath + "/editMode", false);
                    cancelCount++;
                }
            });
            
            // Clear activity-level edit mode based on table type
            const sActivityPath = this._getActivityPathFromToolbarControl(oButton);
            const sEditModeProp = this._getEditModeProperty(oTable);
            if (sActivityPath) {
                oModel.setProperty(sActivityPath + "/" + sEditModeProp, false);
            }
            
            if (cancelCount > 0) {
                MessageToast.show(this._getText("msgEditsCancelled", [cancelCount]));
            }
        },

        /* ========================================
         * SAVE ALL T&M HANDLER
         * ======================================== */

        /**
         * Save all edited T&M entries
         */
        onSaveAllTM(oEvent) {
            const oButton = oEvent.getSource();
            
            const oTable = this._getTableFromToolbarControl(oButton);
            if (!oTable) return;
            
            const oModel = this.getView().getModel("view");
            const oBinding = oTable.getBinding("rows") || oTable.getBinding("items");
            if (!oBinding) return;
            
            const aContexts = oBinding.getContexts();
            const aEditedReports = [];
            
            aContexts.forEach(oContext => {
                const oData = oContext.getObject();
                if (oData.editMode) {
                    aEditedReports.push({
                        ...oData,
                        _path: oContext.getPath()
                    });
                }
            });
            
            if (aEditedReports.length === 0) {
                MessageToast.show(this._getText("msgNoEntriesInEditMode"));
                return;
            }
            
            // Get activity path and edit mode property for later
            const sActivityPath = this._getActivityPathFromToolbarControl(oButton);
            const sEditModeProp = this._getEditModeProperty(oTable);
            
            // Build preview with user-friendly descriptions
            const lines = [];
            aEditedReports.forEach((report, i) => {
                let description = '';
                switch (report.type) {
                    case 'Time Effort':
                        description = report.taskDisplayText || report.taskCode || 'Time Entry';
                        break;
                    case 'Material':
                        description = report.itemDisplayText || 'Material';
                        break;
                    case 'Expense':
                    case 'Expense Report':
                        description = report.expenseTypeDisplayText || 'Expense';
                        break;
                    case 'Mileage':
                        description = report.mileageTypeDisplayText || report.itemDisplayText || 'Mileage';
                        break;
                    default:
                        description = report.type;
                }
                lines.push(`${i + 1}. ${report.type}: ${description}`);
            });
            
            MessageBox.confirm(
                this._getText("msgConfirmSaveEntries", [aEditedReports.length, lines.join('\n')]),
                {
                    title: this._getText("msgConfirmSaveEntriesTitle"),
                    onClose: (sAction) => {
                        if (sAction === MessageBox.Action.OK) {
                            this._executeSaveAllTM(oModel, aEditedReports, sActivityPath, sEditModeProp);
                        }
                    }
                }
            );
        },

        /**
         * Execute save all T&M entries
         * @private
         */
        async _executeSaveAllTM(oModel, aEditedReports, sActivityPath, sEditModeProp) {
            try {
                sap.ui.core.BusyIndicator.show(0);
                
                let successCount = 0;
                let errorCount = 0;
                
                for (const report of aEditedReports) {
                    try {
                        let endpoint, payload;
                        
                        switch (report.type) {
                            case "Time Effort":
                                endpoint = `/api/update-time-effort/${report.id}`;
                                const durationMinutes = report.durationMinutes || Math.round((report.durationHrs || 0) * 60);
                                payload = { ...report.fullData, remarks: report.remarksText || report.remarks };
                                if (payload.startDateTime) {
                                    const startDate = new Date(payload.startDateTime);
                                    const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
                                    payload.endDateTime = endDate.toISOString().replace(/\.\d{3}Z$/, 'Z');
                                }
                                if (report.entryDateFormatted && payload.startDateTime) {
                                    const originalTime = payload.startDateTime.split('T')[1];
                                    payload.startDateTime = `${report.entryDateFormatted}T${originalTime}`;
                                    const startDate = new Date(payload.startDateTime);
                                    const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
                                    payload.endDateTime = endDate.toISOString().replace(/\.\d{3}Z$/, 'Z');
                                }
                                break;
                                
                            case "Material":
                                endpoint = `/api/update-material/${report.id}`;
                                payload = { ...report.fullData, quantity: report.quantity, remarks: report.remarksText || report.remarks };
                                if (report.entryDateFormatted) {
                                    payload.date = report.entryDateFormatted;
                                }
                                break;
                                
                            case "Expense":
                            case "Expense Report":
                                endpoint = `/api/update-expense/${report.id}`;
                                payload = {
                                    ...report.fullData,
                                    externalAmount: { amount: report.externalAmountValue, currency: report.currency || 'EUR' },
                                    internalAmount: { amount: report.internalAmountValue, currency: report.currency || 'EUR' },
                                    remarks: report.remarksText || report.remarks
                                };
                                break;
                                
                            case "Mileage":
                                endpoint = `/api/update-mileage/${report.id}`;
                                payload = { ...report.fullData, distance: report.distanceValue, remarks: report.remarksText || report.remarks };
                                if (payload.travelStartDateTime) {
                                    const startDate = new Date(payload.travelStartDateTime);
                                    const endDate = new Date(startDate.getTime() + (report.travelDurationMinutes || 0) * 60 * 1000);
                                    payload.travelEndDateTime = endDate.toISOString().replace(/\.\d{3}Z$/, 'Z');
                                }
                                break;
                                
                            default:
                                console.warn(`Unknown type: ${report.type}`);
                                errorCount++;
                                continue;
                        }
                        
                        const response = await fetch(endpoint, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });
                        
                        const result = await response.json();
                        
                        if (result.success) {
                            successCount++;
                            // Clear edit mode
                            oModel.setProperty(report._path + "/editMode", false);
                        } else {
                            errorCount++;
                            console.error(`Failed to update ${report.type}:`, result.message);
                        }
                    } catch (err) {
                        errorCount++;
                        console.error(`Error updating ${report.type}:`, err);
                    }
                }
                
                if (errorCount === 0) {
                    MessageToast.show(this._getText("msgEntriesSaved", [successCount]));
                    // Clear activity-level edit mode based on table type
                    if (sActivityPath && sEditModeProp) {
                        oModel.setProperty(sActivityPath + "/" + sEditModeProp, false);
                    }
                } else {
                    MessageBox.warning(this._getText("msgPartialSaveSuccess", [successCount, errorCount]));
                }
                
            } catch (error) {
                console.error("Error in save all:", error);
                MessageBox.error(this._getText("msgError", [error.message]));
            } finally {
                sap.ui.core.BusyIndicator.hide();
            }
        }

    };
});