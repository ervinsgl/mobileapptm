/**
 * TechnicianMixin.js
 * 
 * Mixin containing technician, item, and expense type selection handlers.
 * Mixed into View1.controller.js to handle lookup field interactions
 * in the T&M Creation Dialog.
 * 
 * Sections:
 * - Technician Search (live change, suggestion select)
 * - Task Selection
 * - Item Search (live change, suggestion select)
 * - Expense Type Selection
 * 
 * @file TechnicianMixin.js
 * @module mobileappsc/controller/mixin/TechnicianMixin
 */
sap.ui.define([
    "mobileappsc/utils/services/TechnicianService",
    "mobileappsc/utils/services/ItemService"
], (TechnicianService, ItemService) => {
    "use strict";

    return {

        /* ========================================
         * TECHNICIAN SEARCH HANDLERS
         * ======================================== */

        /**
         * Handle technician live change (as user types)
         */
        onTechnicianLiveChange(oEvent) {
            const sValue = oEvent.getParameter("value") || "";
            const aSuggestions = TechnicianService.searchTechnicians(sValue);
            
            const oModel = this._tmCreateDialog.getModel("createTM");
            oModel.setProperty("/technicianSuggestions", aSuggestions);
            
            console.log('TechnicianLiveChange:', sValue, '- Found:', aSuggestions.length, 'results');
        },

        /**
         * Handle technician search/filter in ComboBox
         */
        onTechnicianSearch(oEvent) {
            const sValue = oEvent.getParameter("value") || "";
            const aSuggestions = TechnicianService.searchTechnicians(sValue);
            
            const oModel = this._tmCreateDialog.getModel("createTM");
            oModel.setProperty("/technicianSuggestions", aSuggestions);
            
            console.log('TechnicianSearch:', sValue, '- Found:', aSuggestions.length, 'results');
        },

        /**
         * Handle technician suggestion selection from Input
         */
        onTechnicianSuggestionSelect(oEvent) {
            const oSelectedItem = oEvent.getParameter("selectedItem");
            const oInput = oEvent.getSource();
            const oContext = oInput.getBindingContext("createTM");
            
            if (!oContext) {
                console.warn('TechnicianSuggestionSelect: No binding context found');
                return;
            }
            
            const sPath = oContext.getPath();
            const oModel = this._tmCreateDialog.getModel("createTM");
            
            if (oSelectedItem) {
                const oItemContext = oSelectedItem.getBindingContext("createTM");
                if (oItemContext) {
                    const oTechnician = oItemContext.getObject();
                    
                    oModel.setProperty(sPath + "/technicianId", oTechnician.id);
                    oModel.setProperty(sPath + "/technicianExternalId", oTechnician.externalId);
                    oModel.setProperty(sPath + "/technicianDisplay", oTechnician.displayText);
                    
                    console.log('TechnicianSuggestionSelect: Selected', oTechnician.displayText, 'ID:', oTechnician.id, 'ExtID:', oTechnician.externalId);
                }
            }
        },

        /**
         * Handle technician selection from ComboBox
         */
        onTechnicianSelect(oEvent) {
            const oSelectedItem = oEvent.getParameter("selectedItem");
            const oComboBox = oEvent.getSource();
            const oContext = oComboBox.getBindingContext("createTM");
            
            if (!oContext) {
                console.warn('TechnicianSelect: No binding context found');
                return;
            }
            
            const sPath = oContext.getPath();
            const oModel = this._tmCreateDialog.getModel("createTM");
            
            if (oSelectedItem) {
                const oItemContext = oSelectedItem.getBindingContext("createTM");
                if (oItemContext) {
                    const oTechnician = oItemContext.getObject();
                    
                    oModel.setProperty(sPath + "/technicianId", oTechnician.id);
                    oModel.setProperty(sPath + "/technicianExternalId", oTechnician.externalId);
                    oModel.setProperty(sPath + "/technicianDisplay", oTechnician.displayText);
                    
                    console.log('TechnicianSelect: Selected', oTechnician.displayText, 'ID:', oTechnician.id, 'ExtID:', oTechnician.externalId);
                }
            } else {
                oModel.setProperty(sPath + "/technicianId", "");
                oModel.setProperty(sPath + "/technicianExternalId", "");
                oModel.setProperty(sPath + "/technicianDisplay", "");
            }
        },

        /**
         * Handle technician ComboBox change (manual input)
         */
        onTechnicianChange(oEvent) {
            const sValue = oEvent.getParameter("value") || "";
            const oComboBox = oEvent.getSource();
            const oContext = oComboBox.getBindingContext("createTM");
            
            if (!oContext) return;
            
            const sPath = oContext.getPath();
            const oModel = this._tmCreateDialog.getModel("createTM");
            
            if (sValue && !oComboBox.getSelectedItem()) {
                const technicians = TechnicianService.searchTechnicians(sValue);
                if (technicians.length === 1) {
                    const tech = technicians[0];
                    oModel.setProperty(sPath + "/technicianId", tech.id);
                    oModel.setProperty(sPath + "/technicianExternalId", tech.externalId);
                    oModel.setProperty(sPath + "/technicianDisplay", tech.displayText);
                    oComboBox.setValue(tech.displayText);
                    console.log('TechnicianChange: Auto-selected', tech.displayText, 'ExtID:', tech.externalId);
                } else if (technicians.length === 0) {
                    oModel.setProperty(sPath + "/technicianId", "");
                    oModel.setProperty(sPath + "/technicianExternalId", "");
                    console.log('TechnicianChange: No match found for', sValue);
                }
            }
        },

        /* ========================================
         * TASK SELECTION HANDLERS
         * ======================================== */

        /**
         * Handle task selection from Select dropdown
         */
        onTaskSelect(oEvent) {
            const oSelectedItem = oEvent.getParameter("selectedItem");
            const oSelect = oEvent.getSource();
            const oContext = oSelect.getBindingContext("createTM");
            
            if (!oContext) {
                console.warn('TaskSelect: No binding context found');
                return;
            }
            
            const sPath = oContext.getPath();
            const oModel = this._tmCreateDialog.getModel("createTM");
            
            if (oSelectedItem) {
                const oItemContext = oSelectedItem.getBindingContext("createTM");
                if (oItemContext) {
                    const oTask = oItemContext.getObject();
                    const sBinding = oSelect.getBindingPath("selectedKey");
                    
                    if (sBinding) {
                        const sDisplayPath = sBinding.replace("Code", "Display");
                        oModel.setProperty(sPath + "/" + sDisplayPath, oTask.name);
                        
                        console.log('TaskSelect: Selected', oTask.name, 'Code:', oTask.code, 'Path:', sPath + "/" + sBinding);
                    }
                }
            }
        },

        /* ========================================
         * ITEM SEARCH HANDLERS
         * ======================================== */

        /**
         * Handle item live change for filtering suggestions
         */
        onItemLiveChange(oEvent) {
            const sValue = oEvent.getParameter("value");
            const aFilteredItems = ItemService.filterBySearch(sValue);
            
            const oModel = this._tmCreateDialog.getModel("createTM");
            oModel.setProperty("/itemSuggestions", aFilteredItems);
            
            console.log('ItemLiveChange: Found', aFilteredItems.length, 'items for:', sValue);
        },

        /**
         * Handle item suggestion selection
         */
        onItemSuggestionSelect(oEvent) {
            const oSelectedItem = oEvent.getParameter("selectedItem");
            const oContext = oEvent.getSource().getBindingContext("createTM");
            
            if (!oContext) {
                console.warn('ItemSuggestionSelect: No binding context found');
                return;
            }
            
            const sPath = oContext.getPath();
            const oModel = this._tmCreateDialog.getModel("createTM");
            
            if (oSelectedItem) {
                const oItemContext = oSelectedItem.getBindingContext("createTM");
                if (oItemContext) {
                    const oItem = oItemContext.getObject();
                    
                    oModel.setProperty(sPath + "/itemId", oItem.id);
                    oModel.setProperty(sPath + "/itemDisplay", oItem.displayText);
                    
                    console.log('ItemSuggestionSelect: Selected', oItem.displayText, 'ID:', oItem.id);
                }
            }
        },

        /* ========================================
         * EXPENSE TYPE HANDLERS
         * ======================================== */

        /**
         * Handle expense type selection from Select dropdown
         */
        onExpenseTypeChange(oEvent) {
            const oSelect = oEvent.getSource();
            const oSelectedItem = oSelect.getSelectedItem();
            const oContext = oSelect.getBindingContext("createTM");
            
            if (!oContext) {
                console.warn('ExpenseTypeChange: No binding context found');
                return;
            }
            
            const sPath = oContext.getPath();
            const oModel = this._tmCreateDialog.getModel("createTM");
            
            if (oSelectedItem) {
                const sKey = oSelectedItem.getKey();
                const sText = oSelectedItem.getText();
                
                oModel.setProperty(sPath + "/expenseTypeId", sKey);
                oModel.setProperty(sPath + "/expenseTypeDisplay", sText);
                
                console.log('ExpenseTypeChange: Selected', sText, 'ID:', sKey);
            }
        }
    };
});