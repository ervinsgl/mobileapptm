sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/Item",
    "sap/ui/core/Fragment",
    "mobileappsc/utils/formatter",
    "mobileappsc/utils/ActivityService",
    "mobileappsc/utils/ServiceOrderService",
    "mobileappsc/utils/ProductGroupService",
    "mobileappsc/utils/URLHelper",
    "mobileappsc/utils/OrganizationService",
    "mobileappsc/utils/ReportedItemsData",
    "mobileappsc/utils/TimeTaskService",
    "mobileappsc/utils/ItemService",
    "mobileappsc/utils/ExpenseTypeService",
    "mobileappsc/utils/UdfMetaService",
    "mobileappsc/utils/ApprovalService",
    "mobileappsc/utils/TMDialogService",
    "mobileappsc/utils/TMCreationService",
    "mobileappsc/utils/TMDataService",
    "mobileappsc/utils/PersonService",
    "mobileappsc/utils/BusinessPartnerService"
], (Controller, JSONModel, MessageToast, MessageBox, Item, Fragment, formatter, ActivityService, ServiceOrderService, ProductGroupService, URLHelper, OrganizationService, ReportedItemsData, TimeTaskService, ItemService, ExpenseTypeService, UdfMetaService, ApprovalService, TMDialogService, TMCreationService, TMDataService, PersonService, BusinessPartnerService) => {
    "use strict";

    return Controller.extend("mobileappsc.controller.View1", {

        formatter: formatter,

        onInit() {
            TMDialogService.init(this);
            
            this._initializeModel();
            this._loadOrganizationLevels();
            this._loadOrganizationalHierarchy(); // Load full hierarchy for org level lookups
            this._loadTimeTasks(); // Load time tasks for lookup
            this._loadItems(); // Load items for lookup
            this._loadExpenseTypes(); // Load expense types for lookup
            // Persons will be loaded on-demand when needed
            this._loadActivityFromURL();
        },

        _initializeModel() {
            const viewModel = new JSONModel({
                busy: false,
                organizationLevelsLoading: false,

                serviceCall: {
                    id: null,
                    externalId: null,
                    subject: null,
                    businessPartnerExternalId: null,
                    responsibleExternalId: null,
                    earliestStartDateTime: null,
                    dueDateTime: null
                },

                organizationLevels: [],
                selectedOrganizationLevel: {
                    key: null,
                    text: "Please select organization level"
                },

                productGroups: [],

                organizationSelected: false
            });

            this.getView().setModel(viewModel, "view");
        },

        async _loadOrganizationLevels() {
            const viewModel = this.getView().getModel("view");
            viewModel.setProperty("/organizationLevelsLoading", true);

            try {
                const levels = await OrganizationService.fetchOrganizationalLevels();
                const transformedLevels = OrganizationService.transformLevelsForDropdown(levels);

                viewModel.setProperty("/organizationLevels", transformedLevels);

                setTimeout(() => {
                    this._populateOrganizationLevelComboBox(transformedLevels);
                }, 100);

            } catch (error) {
                console.error("Failed to load organization levels:", error);
                MessageToast.show("Failed to load organization levels");
            } finally {
                viewModel.setProperty("/organizationLevelsLoading", false);
            }
        },

        async _loadOrganizationalHierarchy() {
            try {
                console.log('Loading full organizational hierarchy...');
                await OrganizationService.loadOrganizationalHierarchy();
                console.log('Organizational hierarchy loaded successfully');
            } catch (error) {
                console.error("Failed to load organizational hierarchy:", error);
                // Non-blocking - app continues without org level name resolution
            }
        },

        /**
         * Load Time Tasks for lookup (runs in background)
         * Used to resolve Task IDs to human-readable names in T&M reports
         */
        async _loadTimeTasks() {
            try {
                console.log('Loading time tasks for lookup...');
                await TimeTaskService.fetchTimeTasks();
                console.log('Time tasks loaded successfully');
            } catch (error) {
                console.error("Failed to load time tasks:", error);
                // Non-blocking - app continues without task name resolution
            }
        },

        /**
         * Load Items for lookup (runs in background)
         * Used to resolve Item IDs to human-readable names in T&M reports and activities
         */
        async _loadItems() {
            try {
                console.log('Loading items for lookup...');
                await ItemService.fetchItems();
                console.log('Items loaded successfully');
            } catch (error) {
                console.error("Failed to load items:", error);
                // Non-blocking - app continues without item name resolution
            }
        },

        /**
         * Load Expense Types for lookup (runs in background)
         * Used to resolve Expense Type IDs to human-readable names in T&M reports
         */
        async _loadExpenseTypes() {
            try {
                console.log('Loading expense types for lookup...');
                await ExpenseTypeService.fetchExpenseTypes();
                console.log('Expense types loaded successfully');
            } catch (error) {
                console.error("Failed to load expense types:", error);
                // Non-blocking - app continues without expense type name resolution
            }
        },

        /**
         * Load Persons for lookup (runs in background)
         * Used to resolve Person IDs/externalIds to readable names
         */
        _populateOrganizationLevelComboBox(levels) {
            const comboBox = this.byId("organizationLevelComboBox");
            if (!comboBox) return;

            comboBox.removeAllItems();

            levels.forEach(level => {
                const item = new Item({
                    key: level.key,
                    text: level.text
                });
                comboBox.addItem(item);
            });
        },

        async onOrganizationLevelChange(oEvent) {
            const selectedItem = oEvent.getParameter("selectedItem");
            if (!selectedItem) return;

            const selectedKey = selectedItem.getKey();
            const model = this.getView().getModel("view");
            const organizationLevels = model.getProperty("/organizationLevels");
            const selectedLevel = organizationLevels.find(level => level.key === selectedKey);

            if (selectedLevel) {
                model.setProperty("/selectedOrganizationLevel", selectedLevel);
                model.setProperty("/organizationSelected", true);

                MessageToast.show(`Loading activities for: ${selectedLevel.text}`);

                await this._initializeActivityPanels();

                this._restoreOrganizationLevelSelection(organizationLevels, selectedLevel.key);
            } else {
                console.warn("Selected level not found for key:", selectedKey);
            }
        },

        _restoreOrganizationLevelSelection(organizationLevels, selectedKey) {
            setTimeout(() => {
                this._populateOrganizationLevelComboBox(organizationLevels);
                const comboBox = this.byId("organizationLevelComboBox");
                if (comboBox) {
                    comboBox.setSelectedKey(selectedKey);
                }
            }, 100);
        },

        async _initializeActivityPanels() {
            const model = this.getView().getModel("view");
            model.setProperty("/busy", true);

            try {
                this._resetActivityData();

                const currentActivityId = this._getCurrentActivityId();
                if (currentActivityId) {
                    await this._loadActivity(currentActivityId);
                }

            } catch (error) {
                console.error("Error initializing activity panels:", error);
                MessageBox.error("Failed to load activities for selected organization");
            } finally {
                model.setProperty("/busy", false);
            }
        },

        _resetActivityData() {
            const model = this.getView().getModel("view");
            model.setProperty("/productGroups", []);
        },

        async _loadActivity(activityId) {
            console.log('Loading activity:', activityId);

            const viewModel = this.getView().getModel("view");
            viewModel.setProperty("/busy", true);

            try {
                const response = await ActivityService.fetchActivityById(activityId);
                const activity = ActivityService.extractActivityData(response);

                const serviceCall = ActivityService.extractServiceCallData(activity);

                if (serviceCall) {
                    viewModel.setProperty("/serviceCall", serviceCall);
                    await this._loadServiceCallActivities(serviceCall.id);
                }

                MessageToast.show("Activity loaded: " + activity.subject);

            } catch (error) {
                console.error("Load activity error:", error);
                MessageBox.error("Failed to load activity: " + error.message);
            } finally {
                viewModel.setProperty("/busy", false);
            }
        },

        async _loadServiceCallActivities(serviceCallId) {
            console.log('Loading service call activities:', serviceCallId);

            try {
                const compositeData = await ServiceOrderService.fetchServiceCallById(serviceCallId);
                const serviceOrderData = ServiceOrderService.extractServiceOrderData(compositeData);
                const allActivities = ServiceOrderService.extractActivitiesFromCompositeTree(compositeData);

                // Filter EXECUTION and CLOSED activities
                const filteredActivities = allActivities.filter(activity =>
                    activity.executionStage === "EXECUTION" || activity.executionStage === "CLOSED"
                );

                console.log('Filtered activities (EXECUTION + CLOSED):', filteredActivities.length);

                const productGroups = ProductGroupService.groupActivitiesByProduct(
                    filteredActivities,
                    serviceOrderData.externalId
                );

                // Prepare data WITHOUT auto-loading T&M
                const optimizedGroups = productGroups.map(group => ({
                    ...group,
                    expanded: true,
                    activityCount: group.activities.length,
                    activities: group.activities.map(activity => this._prepareActivityDataOptimized(activity))
                }));

                const viewModel = this.getView().getModel("view");

                if (serviceOrderData) {
                    // Preload and enrich with responsible person name
                    if (serviceOrderData.responsibleExternalId && serviceOrderData.responsibleExternalId !== 'N/A') {
                        await PersonService.preloadPersonsByExternalId([serviceOrderData.responsibleExternalId]);
                        serviceOrderData.responsibleDisplayText = PersonService.getPersonDisplayTextByExternalId(serviceOrderData.responsibleExternalId);
                    } else {
                        serviceOrderData.responsibleDisplayText = serviceOrderData.responsibleExternalId;
                    }
                    
                    // Preload and enrich with business partner name
                    if (serviceOrderData.businessPartnerExternalId && serviceOrderData.businessPartnerExternalId !== 'N/A') {
                        await BusinessPartnerService.preloadBusinessPartnersByExternalId([serviceOrderData.businessPartnerExternalId]);
                        serviceOrderData.businessPartnerDisplayText = BusinessPartnerService.getBusinessPartnerDisplayTextByExternalId(serviceOrderData.businessPartnerExternalId);
                    } else {
                        serviceOrderData.businessPartnerDisplayText = serviceOrderData.businessPartnerExternalId;
                    }
                    
                    viewModel.setProperty("/serviceCall", serviceOrderData);
                }

                // Set data first (fast UI load)
                viewModel.setProperty("/productGroups", optimizedGroups);

                // THEN batch load T&M reports in background
                this._batchLoadTMReports(optimizedGroups);

            } catch (error) {
                console.error("Load activities error:", error);
            }
        },

        /**
         * Batch load T&M reports for all activities
         */
        async _batchLoadTMReports(productGroups) {
            console.log('Starting batch T&M loading...');

            // Collect all activity IDs with paths
            const allActivities = [];

            productGroups.forEach((group, groupIndex) => {
                group.activities.forEach((activity, activityIndex) => {
                    allActivities.push({
                        id: activity.id,
                        code: activity.code,
                        path: `/productGroups/${groupIndex}/activities/${activityIndex}`
                    });
                });
            });

            console.log(`Batch loading T&M for ${allActivities.length} activities`);

            const model = this.getView().getModel("view");
            
            // Use TMDataService for batch loading with enrichment
            await this._batchLoadWithEnrichment(allActivities, model);

            console.log('Batch T&M loading completed');
            model.refresh(true);
        },

        /**
         * Batch load with enrichment
         */
        async _batchLoadWithEnrichment(activities, model) {
            const chunkSize = 10;

            for (let i = 0; i < activities.length; i += chunkSize) {
                const chunk = activities.slice(i, i + chunkSize);

                // Set loading state
                chunk.forEach(activity => {
                    TMDataService.setLoadingState(model, activity.path, true);
                });

                // Load in parallel with enrichment
                const promises = chunk.map(activity =>
                    this._loadAndEnrichSingleActivity(activity.id, activity.path, model)
                );

                try {
                    await Promise.allSettled(promises);
                } catch (error) {
                    console.error('Error in batch loading chunk:', error);
                }

                // Delay between chunks
                if (i + chunkSize < activities.length) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
        },

        /**
         * Load and enrich T&M for single activity
         */
        async _loadAndEnrichSingleActivity(activityId, activityPath, model) {
            try {
                const tmData = await TMDataService.loadTMReports(activityId);
                
                // Enrich reports with lookup data
                await this._enrichTMReports(tmData.reports);
                
                // Update model
                TMDataService.updateActivityWithTMData(model, activityPath, tmData);

            } catch (error) {
                console.error(`Error loading T&M for activity ${activityId}:`, error);
                TMDataService.setErrorState(model, activityPath);
            }
        },

        /**
         * Pre-calculate all display values to avoid expression bindings
         */
        _prepareActivityDataOptimized(activity) {
            const isClosed = activity.executionStage === 'CLOSED';
            const fullActivity = activity.fullActivity || {};

            // Extract UDF values for Quantity and UoM
            const quantity = this._getUdfValue(fullActivity, 'Z_Quantity') || 'N/A';
            const quantityUoM = this._getUdfValue(fullActivity, 'Z_QuantityUoM') || 'N/A';
            const formattedQuantity = quantity !== 'N/A' && quantityUoM !== 'N/A'
                ? `${quantity} ${quantityUoM}`
                : quantity;

            return {
                // Original data
                id: activity.id,
                code: activity.code,
                subject: activity.subject,
                status: activity.status,
                type: activity.type,
                executionStage: activity.executionStage,
                plannedStartDate: activity.plannedStartDate,
                plannedEndDate: activity.plannedEndDate,

                // Pre-calculated flags
                isClosed: isClosed,
                isReadOnly: isClosed,

                // T&M Reports flags
                tmReportsLoaded: false,
                tmReportsLoading: false,
                tmReportsCount: 0,

                // T&M Type counts
                tmTimeEffortCount: 0,
                tmMaterialCount: 0,
                tmExpenseCount: 0,
                tmMileageCount: 0,

                // Details expansion flag
                detailsExpanded: false,

                // Pre-calculated CSS classes
                textClass: isClosed ? 'closedActivityText' : '',

                // Pre-calculated status state
                statusState: this._getStatusState(activity),
                stageState: isClosed ? 'None' : 'Information',

                // Flattened and pre-formatted fields
                externalId: fullActivity.externalId || 'N/A',
                orgLevelId: fullActivity.orgLevelIds?.[0] || 'N/A',
                orgLevelDisplayText: fullActivity.orgLevelIds?.[0] 
                    ? OrganizationService.getOrgLevelDisplayTextById(fullActivity.orgLevelIds[0])
                    : 'N/A',
                responsibleId: fullActivity.responsibles?.[0]?.externalId || 'N/A',
                responsibleDisplayText: fullActivity.responsibles?.[0]?.externalId 
                    ? PersonService.getPersonDisplayTextByExternalId(fullActivity.responsibles[0].externalId)
                    : 'N/A',
                serviceProductId: fullActivity.serviceProduct?.externalId || 'N/A',
                // Resolve service product name from ItemService
                serviceProductDisplayText: fullActivity.serviceProduct?.externalId 
                    ? ItemService.getItemDisplayTextByExternalId(fullActivity.serviceProduct.externalId)
                    : 'N/A',
                plannedDuration: fullActivity.plannedDurationInMinutes || 0,

                // Quantity fields
                quantity: quantity,
                quantityUoM: quantityUoM,
                formattedQuantity: formattedQuantity,

                // Address fields
                addressStreet: fullActivity.address?.street || '',
                addressStreetNumber: fullActivity.address?.streetNumber || '',
                addressCity: fullActivity.address?.city || '',
                addressFull: this._formatAddress(fullActivity.address),

                // Formatted dates
                formattedStartDate: this.formatter.formatDateTime(activity.plannedStartDate),
                formattedEndDate: this.formatter.formatDateTime(activity.plannedEndDate),
                formattedDuration: (fullActivity.plannedDurationInMinutes || 0) + ' min',

                // Keep full activity for edge cases
                fullActivity: fullActivity
            };
        },

        /**
         * Helper method to extract UDF values
         */
        _getUdfValue(activity, udfExternalId) {
            if (!activity.udfValues || !Array.isArray(activity.udfValues)) {
                return null;
            }

            const udfValue = activity.udfValues.find(udf =>
                udf.udfMeta && udf.udfMeta.externalId === udfExternalId
            );

            return udfValue ? udfValue.value : null;
        },

        /**
         * Helper method to extract UDF value by externalId from T&M report udfValues array
         * T&M reports have udfValues with {meta: "ID", value: "..."} structure
         * Uses UdfMetaService cache to resolve meta ID to externalId
         * @param {Array} udfValues - Array of UDF value objects with {meta, value}
         * @param {string} targetExternalId - The externalId to search for (e.g., "Z_Mileage_MatID")
         * @returns {string|null} The UDF value or null if not found
         */
        _getUdfValueByExternalId(udfValues, targetExternalId) {
            if (!udfValues || !Array.isArray(udfValues) || !targetExternalId) {
                return null;
            }

            for (const udf of udfValues) {
                if (udf.meta) {
                    // Get the externalId from cached UdfMetaService
                    const externalId = UdfMetaService.getExternalIdById(udf.meta);
                    if (externalId === targetExternalId) {
                        return udf.value;
                    }
                }
            }

            return null;
        },

        /**
         * Build entry header text for T&M report based on type
         * Format: "T&M Entry - {type} - {type-specific value}"
         * @param {object} report - T&M report object
         * @returns {string} Formatted header text
         */
        _buildEntryHeaderText(report) {
            const baseText = `T&M Entry - ${report.type}`;
            let typeSpecificText = '';

            switch (report.type) {
                case 'Time Effort':
                    typeSpecificText = report.taskDisplayText && report.taskDisplayText !== 'N/A' 
                        ? report.taskDisplayText 
                        : '';
                    break;
                case 'Material':
                    typeSpecificText = report.itemDisplayText && report.itemDisplayText !== 'N/A' 
                        ? report.itemDisplayText 
                        : '';
                    break;
                case 'Expense':
                    typeSpecificText = report.expenseTypeDisplayText && report.expenseTypeDisplayText !== 'N/A' 
                        ? report.expenseTypeDisplayText 
                        : '';
                    break;
                case 'Mileage':
                    typeSpecificText = report.mileageTypeDisplayText && report.mileageTypeDisplayText !== 'N/A' 
                        ? report.mileageTypeDisplayText 
                        : '';
                    break;
                default:
                    typeSpecificText = '';
            }

            return typeSpecificText ? `${baseText} - ${typeSpecificText}` : baseText;
        },

        /**
         * Calculate status state based on execution stage and status
         */
        _getStatusState(activity) {
            if (activity.executionStage === 'CLOSED') {
                return 'None';
            }

            switch (activity.status) {
                case 'OPEN':
                    return 'Warning';
                case 'COMPLETED':
                    return 'Success';
                default:
                    return 'None';
            }
        },

        /**
         * Format address into single string
         */
        _formatAddress(address) {
            if (!address) {
                return 'N/A';
            }

            const parts = [];

            if (address.street) {
                parts.push(address.street);
            }
            if (address.streetNumber) {
                parts.push(address.streetNumber);
            }
            if (address.city) {
                parts.push(address.city);
            }

            return parts.length > 0 ? parts.join(' ') : 'N/A';
        },

        _clearAllDropdowns() {
            const orgComboBox = this.byId("organizationLevelComboBox");
            if (orgComboBox) {
                orgComboBox.setSelectedKey("");
                orgComboBox.removeAllItems();
            }
        },

        _loadActivityFromURL() {
            if (URLHelper.hasActivityId()) {
                const activityId = URLHelper.getActivityId();
                this._loadActivity(activityId);
            }
        },

        _getCurrentActivityId() {
            return URLHelper.hasActivityId() ? URLHelper.getActivityId() : null;
        },

        onRefresh() {
            const model = this.getView().getModel("view");

            model.setProperty("/organizationSelected", false);
            this._resetActivityData();

            this._clearAllDropdowns();

            this._loadOrganizationLevels();

            MessageToast.show("View refreshed");
        },

        onProductPanelExpand(oEvent) {
            const expanded = oEvent.getParameter("expand");
            const panel = oEvent.getSource();
            const bindingContext = panel.getBindingContext("view");

            if (bindingContext) {
                const productPath = bindingContext.getPath();
                const model = this.getView().getModel("view");
                model.setProperty(productPath + "/expanded", expanded);
            }
        },

        /**
         * Toggle T&M Reports for an activity (OLD METHOD - Keep for backward compatibility)
         */
        async onToggleTMReports(oEvent) {
            const oIcon = oEvent.getSource();
            const oContext = oIcon.getBindingContext("view");

            if (!oContext) {
                return;
            }

            const sPath = oContext.getPath();
            const oModel = this.getView().getModel("view");
            const oActivity = oContext.getObject();

            // Toggle expanded state
            const bCurrentState = oModel.getProperty(sPath + "/tmReportsExpanded");
            const bNewState = !bCurrentState;

            oModel.setProperty(sPath + "/tmReportsExpanded", bNewState);
            oModel.setProperty(sPath + "/tmIconClass", bNewState ? 'expandIcon expandIconRotated' : 'expandIcon');

            // If expanding and reports not loaded yet, fetch them
            if (bNewState && !oModel.getProperty(sPath + "/tmReportsLoaded")) {
                await this._loadTMReports(sPath, oActivity.id);
            }
        },

        /**
         * Load T&M Reports for an activity with type counts
         */
        async _loadTMReports(activityPath, activityId) {
            const oModel = this.getView().getModel("view");

            oModel.setProperty(activityPath + "/tmReportsLoading", true);

            try {
                const reports = await ReportedItemsData.getReportedItems(activityId);

                // Calculate counts by type
                const timeEffortCount = reports.filter(r => r.type === "Time Effort").length;
                const materialCount = reports.filter(r => r.type === "Material").length;
                const expenseCount = reports.filter(r => r.type === "Expense").length;
                const mileageCount = reports.filter(r => r.type === "Mileage").length;

                oModel.setProperty(activityPath + "/tmReports", reports);
                oModel.setProperty(activityPath + "/tmReportsCount", reports.length);
                oModel.setProperty(activityPath + "/tmReportsLoaded", true);

                // Set type counts
                oModel.setProperty(activityPath + "/tmTimeEffortCount", timeEffortCount);
                oModel.setProperty(activityPath + "/tmMaterialCount", materialCount);
                oModel.setProperty(activityPath + "/tmExpenseCount", expenseCount);
                oModel.setProperty(activityPath + "/tmMileageCount", mileageCount);

                if (reports.length > 0) {
                    MessageToast.show(`Loaded ${reports.length} T&M report(s)`);
                }

            } catch (error) {
                console.error("Error loading T&M reports:", error);
                MessageToast.show("Failed to load T&M reports: " + error.message);
                oModel.setProperty(activityPath + "/tmReports", []);
                oModel.setProperty(activityPath + "/tmReportsCount", 0);
            } finally {
                oModel.setProperty(activityPath + "/tmReportsLoading", false);
            }
        },

        /* ========================================
         * METHODS FOR SIMPLIFIED T&M UI
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
         * View T&M Reports (opens dialog or shows summary)
         */
        async onViewTMReports(oEvent) {
            const oButton = oEvent.getSource();
            const oContext = oButton.getBindingContext("view");

            if (!oContext) return;

            const oActivity = oContext.getObject();

            try {
                // Load fresh data if not loaded
                let reports = oActivity.tmReports;
                
                if (!oActivity.tmReportsLoaded || !reports || reports.length === 0) {
                    console.log('Loading fresh T&M data for activity:', oActivity.code);
                    const tmData = await TMDataService.loadTMReports(oActivity.id);
                    reports = tmData.reports;
                }

                // Enrich reports with lookup data
                await this._enrichTMReports(reports);

                // Open dialog using service
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
            // Pre-load UDF Meta for all reports
            await UdfMetaService.preloadUdfMetaForReports(reports);

            // Pre-load Approval statuses for all reports
            await ApprovalService.preloadStatusesForReports(reports);

            // Collect all person IDs for batch preloading
            const personIds = reports
                .map(r => r.createPerson)
                .filter(id => id && id !== 'N/A');

            // Preload all persons in batch
            if (personIds.length > 0) {
                await PersonService.preloadPersonsById(personIds);
            }

            // Enrich each report
            reports.forEach(report => {
                // Technician: resolve person name from createPerson (ID)
                if (report.createPerson) {
                    report.createPersonDisplayText = PersonService.getPersonDisplayTextById(report.createPerson);
                } else {
                    report.createPersonDisplayText = 'N/A';
                }
                
                // Time Effort: resolve task name
                if (report.type === "Time Effort" && report.task) {
                    report.taskDisplayText = TimeTaskService.getTaskDisplayTextById(report.task);
                }
                
                // Material: resolve item name
                if (report.type === "Material" && report.fullData?.item) {
                    report.itemDisplayText = ItemService.getItemDisplayTextById(report.fullData.item);
                }
                
                // Expense: resolve expense type name
                if (report.type === "Expense" && report.fullData?.type) {
                    report.expenseTypeDisplayText = ExpenseTypeService.getExpenseTypeDisplayTextById(report.fullData.type);
                }
                
                // Mileage: resolve mileage type from UDF
                if (report.type === "Mileage") {
                    const mileageTypeValue = this._getUdfValueByExternalId(report.udfValues, "Z_Mileage_MatID");
                    if (mileageTypeValue) {
                        report.mileageTypeDisplayText = ItemService.getItemDisplayTextByExternalId(mileageTypeValue);
                    } else {
                        report.mileageTypeDisplayText = 'N/A';
                    }
                }
                
                // Format UDF values
                if (report.udfValues && report.udfValues.length > 0) {
                    report.udfValuesText = UdfMetaService.formatUdfValuesForDisplay(report.udfValues);
                }

                // Add approval status
                const approvalStatus = ApprovalService.getStatusById(report.id);
                report.decisionStatus = approvalStatus;
                report.decisionStatusText = ApprovalService.getStatusDisplayText(approvalStatus);
                report.decisionStatusState = ApprovalService.getStatusState(approvalStatus);

                // Build entry header text
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
         * Toggle Approval Button text
         */
        onToggleApprovalButton(oEvent) {
            const oButton = oEvent.getSource();
            const oContext = oButton.getBindingContext("dialog");

            if (!oContext) {
                return;
            }

            const sPath = oContext.getPath();
            const oModel = this._tmReportsDialog.getModel("dialog");
            const bCurrentState = oModel.getProperty(sPath + "/approvalButtonPressed");

            // Toggle the state
            oModel.setProperty(sPath + "/approvalButtonPressed", !bCurrentState);

            // Show feedback
            const sNewText = !bCurrentState ? "Send for Approval" : "Request Approval";
            MessageToast.show(`Button changed to: ${sNewText}`);
        },

        /**
         * Add new T&M Report - Opens unified creation dialog
         */
        async onAddTMReport(oEvent) {
            const oButton = oEvent.getSource();
            const oContext = oButton.getBindingContext("view");

            // Extract activity data
            const activityData = TMDialogService.extractActivityData(oContext, this._tmReportsDialog);

            if (!activityData.activityCode) {
                MessageToast.show("Activity information not available");
                return;
            }

            // Open creation dialog
            await TMDialogService.openTMCreationDialog(activityData);
        },

        /* ========================================
         * T&M CREATION DIALOG METHODS
         * ======================================== */

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
         * Cancel T&M Creation Dialog
         */
        onCancelCreateTM() {
            TMDialogService.closeTMCreationDialog();
        },

        /**
         * Save all T&M entries
         */
        async onSaveAllTMEntries() {
            const oModel = this._tmCreateDialog.getModel("createTM");
            const aEntries = oModel.getProperty("/entries");
            const activityCode = oModel.getProperty("/activityCode");

            try {
                const result = await TMCreationService.saveAllEntries(aEntries, activityCode);
                MessageToast.show(`Saved ${result.savedCount} T&M entry(ies)`);
                TMDialogService.closeTMCreationDialog();
                // TODO: Refresh T&M Reports
            } catch (error) {
                MessageBox.error(error.message);
            }
        }
    });
});