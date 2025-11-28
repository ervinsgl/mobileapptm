sap.ui.define([
    "sap/m/MessageToast",
    "mobileappsc/utils/DateTimeService"
], (MessageToast, DateTimeService) => {
    "use strict";

    return {
        /**
         * Default technician data (set from activity responsible)
         */
        _defaultTechnician: null,

        /**
         * Default item data (set from activity service product)
         */
        _defaultItem: null,

        /**
         * Get today's date in yyyy-MM-dd format for API
         * Delegated to DateTimeService
         * @returns {string} Date string like "2025-10-29"
         */
        getTodayDateString() {
            return DateTimeService.getTodayDateString();
        },

        /**
         * Get current datetime in ISO format for API
         * Delegated to DateTimeService
         * @returns {string} ISO datetime string like "2025-11-28T12:30:00Z"
         */
        getNowDateTimeString() {
            return DateTimeService.getNowDateTimeString();
        },

        /**
         * Get datetime + offset minutes in ISO format
         * Delegated to DateTimeService
         * @param {number} offsetMinutes - Minutes to add (can be negative)
         * @returns {string} ISO datetime string
         */
        getDateTimeWithOffset(offsetMinutes) {
            return DateTimeService.getDateTimeWithOffset(offsetMinutes);
        },

        /**
         * Calculate end datetime from start datetime and duration
         * Delegated to DateTimeService
         */
        calculateEndDateTime(startDateTime, durationMinutes) {
            return DateTimeService.calculateEndDateTime(startDateTime, durationMinutes);
        },

        /**
         * Calculate duration in minutes between two datetimes
         * Delegated to DateTimeService
         */
        calculateDurationMinutes(startDateTime, endDateTime) {
            return DateTimeService.calculateDurationMinutes(startDateTime, endDateTime);
        },

        /**
         * Set default technician from activity responsible
         * @param {object} technician - Technician object {id, externalId, displayText}
         */
        setDefaultTechnician(technician) {
            this._defaultTechnician = technician;
            console.log('TMCreationService: Default technician set:', technician);
        },

        /**
         * Get default technician
         * @returns {object|null}
         */
        getDefaultTechnician() {
            return this._defaultTechnician;
        },

        /**
         * Clear default technician
         */
        clearDefaultTechnician() {
            this._defaultTechnician = null;
        },

        /**
         * Set default item from activity service product
         * @param {object} item - Item object {id, displayText}
         */
        setDefaultItem(item) {
            this._defaultItem = item;
            console.log('TMCreationService: Default item set:', item);
        },

        /**
         * Get default item
         * @returns {object|null}
         */
        getDefaultItem() {
            return this._defaultItem;
        },

        /**
         * Clear default item
         */
        clearDefaultItem() {
            this._defaultItem = null;
        },

        /**
         * Default expense type data
         */
        _defaultExpenseType: null,

        /**
         * Set default expense type
         * @param {object} expenseType - Expense type object {id, code, displayText}
         */
        setDefaultExpenseType(expenseType) {
            this._defaultExpenseType = expenseType;
            console.log('TMCreationService: Default expense type set:', expenseType);
        },

        /**
         * Get default expense type
         * @returns {object|null}
         */
        getDefaultExpenseType() {
            return this._defaultExpenseType;
        },

        /**
         * Clear default expense type
         */
        clearDefaultExpenseType() {
            this._defaultExpenseType = null;
        },

        /**
         * Create Time Effort entry template
         * @returns {object} Empty Time Effort entry
         */
        createTimeEffortEntry() {
            const defaultTech = this._defaultTechnician;
            return {
                type: "Time Effort",
                icon: "sap-icon://time-entry-request",
                expanded: true,
                // Button state properties
                saveButtonText: "Save",
                saveButtonIcon: "sap-icon://save",
                saveButtonType: "Emphasized",
                saveButtonState: "unsaved",
                // Technician fields
                technicianId: defaultTech ? defaultTech.id : "",
                technicianDisplay: defaultTech ? defaultTech.displayText : "",
                // Task fields (stores code for API, display shows name)
                taskCode: "",
                taskDisplay: "",
                // Duration and DateTime fields
                duration: 30, // Default 30 minutes
                startDateTime: this.getNowDateTimeString(),
                endDateTime: this.getDateTimeWithOffset(30),
                chargeOption: "",
                remarks: ""
            };
        },

        /**
         * Create Material entry template
         * @returns {object} Empty Material entry
         */
        createMaterialEntry() {
            const defaultTech = this._defaultTechnician;
            const defaultItem = this._defaultItem;
            return {
                type: "Material",
                icon: "sap-icon://product",
                expanded: true,
                // Button state properties
                saveButtonText: "Save",
                saveButtonIcon: "sap-icon://save",
                saveButtonType: "Emphasized",
                saveButtonState: "unsaved",
                // Technician fields
                technicianId: defaultTech ? defaultTech.id : "",
                technicianDisplay: defaultTech ? defaultTech.displayText : "",
                // Item fields (stores id for API, display shows externalId - name)
                itemId: defaultItem ? defaultItem.id : "",
                itemDisplay: defaultItem ? defaultItem.displayText : "",
                // Date field - defaults to today
                date: this.getTodayDateString(),
                // Other fields
                quantity: "",
                chargeOption: "",
                remarks: ""
            };
        },

        /**
         * Create Expense entry template
         * @returns {object} Empty Expense entry
         */
        createExpenseEntry() {
            const defaultTech = this._defaultTechnician;
            const defaultExpType = this._defaultExpenseType;
            return {
                type: "Expense",
                icon: "sap-icon://money-bills",
                expanded: true,
                // Button state properties
                saveButtonText: "Save",
                saveButtonIcon: "sap-icon://save",
                saveButtonType: "Emphasized",
                saveButtonState: "unsaved",
                // Technician fields
                technicianId: defaultTech ? defaultTech.id : "",
                technicianDisplay: defaultTech ? defaultTech.displayText : "",
                // Expense Type fields
                expenseTypeId: defaultExpType ? defaultExpType.id : "",
                expenseTypeDisplay: defaultExpType ? defaultExpType.displayText : "",
                // Date field - defaults to today
                date: this.getTodayDateString(),
                // Amount fields (integer values, currency is always EUR)
                externalAmountValue: 0,
                internalAmountValue: 0,
                chargeOption: "",
                remarks: ""
            };
        },

        /**
         * Create Mileage entry template
         * @returns {object} Empty Mileage entry
         */
        createMileageEntry() {
            const defaultTech = this._defaultTechnician;
            return {
                type: "Mileage",
                icon: "sap-icon://car-rental",
                expanded: true,
                // Button state properties
                saveButtonText: "Save",
                saveButtonIcon: "sap-icon://save",
                saveButtonType: "Emphasized",
                saveButtonState: "unsaved",
                // Technician fields
                technicianId: defaultTech ? defaultTech.id : "",
                technicianDisplay: defaultTech ? defaultTech.displayText : "",
                // Source and Destination fields
                source: "",
                destination: "",
                distance: 0, // Integer value, unit is always KM
                // Duration and DateTime fields for travel
                travelDuration: 30, // Default 30 minutes
                travelStartDateTime: this.getNowDateTimeString(),
                travelEndDateTime: this.getDateTimeWithOffset(30),
                // Boolean fields
                driver: false,
                privateCar: false,
                chargeOption: "",
                remarks: ""
            };
        },

        /**
         * Create Time & Material entry template (combined entry)
         * @returns {object} Empty Time & Material entry
         */
        createTimeAndMaterialEntry() {
            const defaultTech = this._defaultTechnician;
            const defaultItem = this._defaultItem;
            return {
                type: "Time & Material",
                icon: "sap-icon://checklist-item-2",
                expanded: true,
                // Button state properties
                saveButtonText: "Save",
                saveButtonIcon: "sap-icon://save",
                saveButtonType: "Emphasized",
                saveButtonState: "unsaved",
                // Technician fields
                technicianId: defaultTech ? defaultTech.id : "",
                technicianDisplay: defaultTech ? defaultTech.displayText : "",
                // Material fields (Column 1)
                date: this.getTodayDateString(),
                itemId: defaultItem ? defaultItem.id : "",
                itemDisplay: defaultItem ? defaultItem.displayText : "",
                quantity: "",
                // Time Effort 1 fields - Arbeitszeit (Column 2)
                task1Code: "",
                task1Display: "",
                duration1: 30,
                startDateTime1: this.getNowDateTimeString(),
                endDateTime1: this.getDateTimeWithOffset(30),
                // Time Effort 2 fields - Fahrzeit (Column 3)
                task2Code: "",
                task2Display: "",
                duration2: 30,
                startDateTime2: this.getNowDateTimeString(),
                endDateTime2: this.getDateTimeWithOffset(30),
                // Time Effort 3 fields - Wartezeit (Column 4)
                task3Code: "",
                task3Display: "",
                duration3: 30,
                startDateTime3: this.getNowDateTimeString(),
                endDateTime3: this.getDateTimeWithOffset(30),
                // Shared fields (Column 5)
                chargeOption: "",
                remarksTime: "",
                remarksMaterial: ""
            };
        },

        /**
         * Add entry to model
         * @param {sap.ui.model.json.JSONModel} oModel - Dialog model
         * @param {object} entry - Entry object to add
         * @param {string} entryType - Type name for toast message
         */
        addEntryToModel(oModel, entry, entryType) {
            const aEntries = oModel.getProperty("/entries");
            aEntries.push(entry);
            oModel.setProperty("/entries", aEntries);
            MessageToast.show(`${entryType} entry added`);
        },

        /**
         * Validate all entries before save
         * @param {array} entries - Array of entries to validate
         * @returns {object} Validation result {valid: boolean, errors: array}
         */
        validateEntries(entries) {
            const errors = [];

            if (!entries || entries.length === 0) {
                errors.push("No entries to save");
                return { valid: false, errors };
            }

            entries.forEach((entry, index) => {
                switch (entry.type) {
                    case "Time Effort":
                        if (!entry.task) errors.push(`Entry ${index + 1}: Task is required`);
                        if (!entry.duration) errors.push(`Entry ${index + 1}: Duration is required`);
                        break;
                    case "Material":
                        if (!entry.item) errors.push(`Entry ${index + 1}: Item is required`);
                        if (!entry.quantity) errors.push(`Entry ${index + 1}: Quantity is required`);
                        break;
                    case "Expense":
                        if (!entry.expenseType) errors.push(`Entry ${index + 1}: Expense Type is required`);
                        break;
                    case "Mileage":
                        if (!entry.distance) errors.push(`Entry ${index + 1}: Distance is required`);
                        break;
                    case "Time & Material":
                        // Material validation
                        if (!entry.item) errors.push(`Entry ${index + 1}: Item is required`);
                        if (!entry.quantity) errors.push(`Entry ${index + 1}: Quantity is required`);
                        // At least one time entry required
                        if (!entry.task1 && !entry.task2 && !entry.task3) {
                            errors.push(`Entry ${index + 1}: At least one Time Task is required`);
                        }
                        break;
                }
            });

            return {
                valid: errors.length === 0,
                errors
            };
        },

        /**
         * Save all entries (placeholder for actual FSM API call)
         * @param {array} entries - Array of entries to save
         * @param {string} activityId - Activity ID to save entries for
         * @returns {Promise} Save operation promise
         */
        async saveAllEntries(entries, activityId) {
            console.log('Saving T&M entries for activity:', activityId);
            console.log('Entries:', entries);

            // Validate entries
            const validation = this.validateEntries(entries);
            if (!validation.valid) {
                throw new Error(validation.errors.join("\n"));
            }

            // TODO: Implement actual FSM API calls
            // For each entry:
            //   - Call appropriate endpoint (TimeEffort, Material, Expense, Mileage)
            //   - Handle success/error responses

            // Placeholder for now
            return new Promise((resolve) => {
                setTimeout(() => {
                    resolve({
                        success: true,
                        savedCount: entries.length
                    });
                }, 500);
            });
        }
    };
});