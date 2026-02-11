/**
 * TMGridTableMixin.js
 * 
 * Mixin for handling sap.ui.table.Table (Grid Table) operations.
 * Provides filtering and export functionality for T&M reports.
 * 
 * @file TMGridTableMixin.js
 * @module mobileappsc/controller/mixin/TMGridTableMixin
 */
sap.ui.define([
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], (Filter, FilterOperator, MessageToast, MessageBox) => {
    "use strict";

    return {

        /**
         * Initialize Grid Table state.
         */
        _initGridTableState() {
            // Placeholder for future grid-specific state
        },

        /**
         * Quick type filter change handler.
         * Navigates from the activity panel to show different T&M type tables.
         */
        onGridTypeFilterChange(oEvent) {
            const selectedKey = oEvent.getParameter("item").getKey();
            const oSource = oEvent.getSource();
            
            // Navigate up to find the activity context
            const oToolbar = oSource.getParent();
            const oPanel = oToolbar.getParent();
            
            // Find which panel type this is
            const aPanelContent = oPanel.getContent();
            let oTable = null;
            
            for (const ctrl of aPanelContent) {
                if (ctrl.isA && ctrl.isA("sap.ui.table.Table")) {
                    oTable = ctrl;
                    break;
                }
            }
            
            if (!oTable) {
                console.warn("TMGridTableMixin: Could not find table");
                return;
            }
            
            const oBinding = oTable.getBinding("rows");
            if (!oBinding) return;
            
            // Determine which panel we're in based on title
            const panelTitle = oToolbar.getContent()[1].getText();
            
            let baseFilters = [];
            if (panelTitle.includes("Time") || panelTitle.includes("Material")) {
                // Time & Material table - base filter excludes Expense and Mileage
                baseFilters = [
                    new Filter("type", FilterOperator.NE, "Expense"),
                    new Filter("type", FilterOperator.NE, "Mileage")
                ];
            } else if (panelTitle.includes("Expense")) {
                baseFilters = [new Filter("type", FilterOperator.EQ, "Expense")];
            } else if (panelTitle.includes("Mileage")) {
                baseFilters = [new Filter("type", FilterOperator.EQ, "Mileage")];
            }
            
            if (selectedKey === "ALL") {
                oBinding.filter(baseFilters);
            } else {
                oBinding.filter([new Filter("type", FilterOperator.EQ, selectedKey)]);
            }
            
            MessageToast.show(selectedKey === "ALL" ? this._getText("msgShowingAll") : this._getText("msgFiltered", [selectedKey]));
        },

        /**
         * Export all T&M reports to Excel.
         */
        onExportToExcel(oEvent) {
            const oContext = oEvent.getSource().getBindingContext("view");
            
            if (!oContext) {
                MessageToast.show(this._getText("msgCannotDetermineDataSource"));
                return;
            }
            
            const model = this.getView().getModel("view");
            const path = oContext.getPath();
            const data = model.getProperty(path + "/tmReports") || [];
            
            if (data.length === 0) {
                MessageToast.show(this._getText("msgNoDataToExport"));
                return;
            }

            const exportData = data.map(report => ({
                type: report.type,
                description: report.type === 'Time Effort' ? report.taskDisplayText :
                             report.type === 'Material' ? report.itemDisplayText :
                             report.type === 'Expense' ? report.expenseTypeDisplayText :
                             report.routeText || 'N/A',
                technician: report.createPersonDisplayText || 'N/A',
                time: report.type === 'Time Effort' ? report.durationMinutes : '',
                quantity: report.type === 'Material' ? report.quantity : '',
                extAmount: report.type === 'Expense' ? report.externalAmountText : '',
                intAmount: report.type === 'Expense' ? report.internalAmountText : '',
                distance: report.type === 'Mileage' ? report.distanceText : '',
                travelDuration: report.type === 'Mileage' ? report.travelDurationText : '',
                date: report.startDateTime ? report.startDateTime.substring(0, 10) : '',
                remarks: report.remarksText || '',
                decision: report.decisionRemarks || '',
                charge: report.chargeOption || '',
                status: report.decisionStatus || ''
            }));

            const columns = [
                { label: "Type", property: "type" },
                { label: "Description", property: "description" },
                { label: "Technician", property: "technician" },
                { label: "Time (min)", property: "time" },
                { label: "Quantity", property: "quantity" },
                { label: "Ext. Amount", property: "extAmount" },
                { label: "Int. Amount", property: "intAmount" },
                { label: "Distance", property: "distance" },
                { label: "Travel Duration", property: "travelDuration" },
                { label: "Date", property: "date" },
                { label: "Status", property: "status" },
                { label: "Decision", property: "decision" },
                { label: "Remarks", property: "remarks" },
                { label: "Charge", property: "charge" }
            ];

            const settings = {
                workbook: { columns: columns },
                dataSource: exportData,
                fileName: `TM_Reports_${new Date().toISOString().slice(0,10)}.xlsx`
            };

            sap.ui.require(["sap/ui/export/Spreadsheet"], (Spreadsheet) => {
                const sheet = new Spreadsheet(settings);
                sheet.build()
                    .then(() => MessageToast.show(this._getText("msgExportComplete")))
                    .catch((error) => MessageBox.error(this._getText("msgExportFailed", [error.message])))
                    .finally(() => sheet.destroy());
            }, (error) => {
                MessageBox.error(this._getText("msgExportLibraryNotAvailable"));
            });
        }
    };
});