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
    "mobileappsc/utils/BusinessPartnerService",
    "mobileappsc/utils/TechnicianService",
    "mobileappsc/utils/DateTimeService",
    "mobileappsc/utils/TMPayloadService",
    "mobileappsc/utils/TMEditService"
], (Controller, JSONModel, MessageToast, MessageBox, Item, Fragment, formatter, ActivityService, ServiceOrderService, ProductGroupService, URLHelper, OrganizationService, ReportedItemsData, TimeTaskService, ItemService, ExpenseTypeService, UdfMetaService, ApprovalService, TMDialogService, TMCreationService, TMDataService, PersonService, BusinessPartnerService, TechnicianService, DateTimeService, TMPayloadService, TMEditService) => {
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
         * Used to resolve Person IDs/externalIds to human-readable names
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

            // Ã¢Å“â€¦ Extract UDF values for Quantity and UoM
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

        /**
         * Test T&M Dialog - Opens dialog with mock data for UI testing
         * Remove this button in production
         */
        async onTestTMDialog() {
            const mockActivityData = {
                activityCode: "TEST-19608",
                activitySubject: "Test Activity - UI Development",
                serviceProduct: "Z12000005 - Vorbereitung",
                serviceProductExternalId: "Z12000005",
                formattedStartDate: "11/26/2025, 9:00:00 AM",
                formattedEndDate: "11/26/2025, 5:00:00 PM",
                formattedDuration: "480 min",
                quantity: "1.0",
                quantityUoM: "EA",
                responsibleExternalId: "TEST001"
            };

            await TMDialogService.openTMCreationDialog(mockActivityData);
            MessageToast.show("Test dialog opened");
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
                // Initialize edit mode to false
                report.editMode = false;
                
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
                    
                    // Calculate travel duration in minutes
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
         * Toggle Edit Mode for T&M Entry
         * - In View mode: "Edit T&M Entry" -> enters edit mode
         * - In Edit mode: "Send for Approval" -> shows JSON and exits edit mode
         */
        onToggleEditMode(oEvent) {
            const oButton = oEvent.getSource();
            const oContext = oButton.getBindingContext("dialog");

            if (!oContext) {
                return;
            }

            const sPath = oContext.getPath();
            const oModel = this._tmReportsDialog.getModel("dialog");
            const bCurrentEditMode = oModel.getProperty(sPath + "/editMode") || false;
            const sType = oModel.getProperty(sPath + "/type");
            const oEntry = oContext.getObject();

            if (!bCurrentEditMode) {
                // Entering edit mode - use TMEditService to get edit field values
                const editValues = TMEditService.initEditMode(sType, oEntry);
                TMEditService.applyEditValues(oModel, sPath, editValues);
                
                oModel.setProperty(sPath + "/editMode", true);
                MessageToast.show("Edit mode enabled");
            } else {
                // "Send for Approval" pressed - use TMEditService
                const editedValues = TMEditService.getEditedValues(sType, oModel, sPath);
                const payload = TMEditService.buildUpdatePayload(sType, oEntry.id, editedValues);
                const displayUpdates = TMEditService.getDisplayUpdates(sType, editedValues);

                // Apply display updates
                TMEditService.applyDisplayUpdates(oModel, sPath, displayUpdates);

                // Show payload
                MessageBox.information(
                    TMEditService.formatPayloadJSON(payload),
                    {
                        title: "Send for Approval - Update Payload",
                        contentWidth: "400px"
                    }
                );

                // Exit edit mode
                oModel.setProperty(sPath + "/editMode", false);
            }
        },

        /**
         * Handle Duration change in Edit mode - recalculates End DateTime (Time Effort)
         */
        onEditDurationChange(oEvent) {
            const oContext = oEvent.getSource().getBindingContext("dialog");
            if (!oContext) return;

            const sPath = oContext.getPath();
            const oModel = this._tmReportsDialog.getModel("dialog");
            const iNewDuration = oEvent.getParameter("value");

            TMEditService.handleDurationChange(oModel, sPath, "Time Effort", iNewDuration);
        },

        /**
         * Handle Mileage Duration change in Edit mode - recalculates Travel End DateTime
         */
        onEditMileageDurationChange(oEvent) {
            const oContext = oEvent.getSource().getBindingContext("dialog");
            if (!oContext) return;

            const sPath = oContext.getPath();
            const oModel = this._tmReportsDialog.getModel("dialog");
            const iNewDuration = oEvent.getParameter("value");

            TMEditService.handleDurationChange(oModel, sPath, "Mileage", iNewDuration);
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
         * TECHNICIAN SEARCH HANDLERS
         * ======================================== */

        /**
         * Handle technician live change (as user types)
         * Updates suggestions in real-time
         */
        onTechnicianLiveChange(oEvent) {
            const sValue = oEvent.getParameter("value") || "";
            
            // Get filtered suggestions from TechnicianService
            const aSuggestions = TechnicianService.searchTechnicians(sValue);
            
            // Update the model with new suggestions
            const oModel = this._tmCreateDialog.getModel("createTM");
            oModel.setProperty("/technicianSuggestions", aSuggestions);
            
            console.log('TechnicianLiveChange:', sValue, '- Found:', aSuggestions.length, 'results');
        },

        /**
         * Handle technician search/filter in ComboBox
         * Called when user types in the technician field
         */
        onTechnicianSearch(oEvent) {
            const sValue = oEvent.getParameter("value") || "";
            const oComboBox = oEvent.getSource();
            
            // Get filtered suggestions from TechnicianService
            const aSuggestions = TechnicianService.searchTechnicians(sValue);
            
            // Update the model with new suggestions
            const oModel = this._tmCreateDialog.getModel("createTM");
            oModel.setProperty("/technicianSuggestions", aSuggestions);
            
            console.log('TechnicianSearch:', sValue, '- Found:', aSuggestions.length, 'results');
        },

        /**
         * Handle technician suggestion selection from Input
         * Called when user selects from suggestion list
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
                // Get the selected technician data from the item's binding context
                const oItemContext = oSelectedItem.getBindingContext("createTM");
                if (oItemContext) {
                    const oTechnician = oItemContext.getObject();
                    
                    // Update the entry with technician ID, externalId, and display text
                    oModel.setProperty(sPath + "/technicianId", oTechnician.id);
                    oModel.setProperty(sPath + "/technicianExternalId", oTechnician.externalId);
                    oModel.setProperty(sPath + "/technicianDisplay", oTechnician.displayText);
                    
                    console.log('TechnicianSuggestionSelect: Selected', oTechnician.displayText, 'ID:', oTechnician.id, 'ExtID:', oTechnician.externalId);
                }
            }
        },

        /**
         * Handle task selection from Select dropdown
         * Stores task code for API and display name
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
                // Get the selected task data from the item's binding context
                const oItemContext = oSelectedItem.getBindingContext("createTM");
                if (oItemContext) {
                    const oTask = oItemContext.getObject();
                    
                    // Determine which task field this is based on the Select's selectedKey binding
                    const sBinding = oSelect.getBindingPath("selectedKey");
                    
                    // For Time Effort: taskCode/taskDisplay
                    // For Time & Material: task1Code/task1Display, task2Code/task2Display, task3Code/task3Display
                    if (sBinding) {
                        const sDisplayPath = sBinding.replace("Code", "Display");
                        oModel.setProperty(sPath + "/" + sDisplayPath, oTask.name);
                        
                        console.log('TaskSelect: Selected', oTask.name, 'Code:', oTask.code, 'Path:', sPath + "/" + sBinding);
                    }
                }
            }
        },

        /**
         * Handle item live change for filtering suggestions
         * Similar to technician search - filters as user types
         */
        onItemLiveChange(oEvent) {
            const sValue = oEvent.getParameter("value");
            const oInput = oEvent.getSource();
            
            // Filter items based on search term
            const aFilteredItems = ItemService.filterBySearch(sValue);
            
            // Update suggestions in the model
            const oModel = this._tmCreateDialog.getModel("createTM");
            oModel.setProperty("/itemSuggestions", aFilteredItems);
            
            console.log('ItemLiveChange: Found', aFilteredItems.length, 'items for:', sValue);
        },

        /**
         * Handle item suggestion selection
         * Updates both itemId and itemDisplay in the entry
         */
        onItemSuggestionSelect(oEvent) {
            const oSelectedItem = oEvent.getParameter("selectedItem");
            const oInput = oEvent.getSource();
            const oContext = oInput.getBindingContext("createTM");
            
            if (!oContext) {
                console.warn('ItemSuggestionSelect: No binding context found');
                return;
            }
            
            const sPath = oContext.getPath();
            const oModel = this._tmCreateDialog.getModel("createTM");
            
            if (oSelectedItem) {
                // Get the selected item data from the item's binding context
                const oItemContext = oSelectedItem.getBindingContext("createTM");
                if (oItemContext) {
                    const oItem = oItemContext.getObject();
                    
                    // Update the entry with item ID and display text
                    oModel.setProperty(sPath + "/itemId", oItem.id);
                    oModel.setProperty(sPath + "/itemDisplay", oItem.displayText);
                    
                    console.log('ItemSuggestionSelect: Selected', oItem.displayText, 'ID:', oItem.id);
                }
            }
        },

        /**
         * Handle expense type selection from Select dropdown
         * Updates both expenseTypeId and expenseTypeDisplay in the entry
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
                
                // Update the entry with expense type ID and display text
                oModel.setProperty(sPath + "/expenseTypeId", sKey);
                oModel.setProperty(sPath + "/expenseTypeDisplay", sText);
                
                console.log('ExpenseTypeChange: Selected', sText, 'ID:', sKey);
            }
        },

        /**
         * Handle technician selection from ComboBox (legacy - keep for compatibility)
         * Updates both display text and ID in the entry
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
                // Get the selected technician data from the item's binding context
                const oItemContext = oSelectedItem.getBindingContext("createTM");
                if (oItemContext) {
                    const oTechnician = oItemContext.getObject();
                    
                    // Update the entry with technician ID, externalId, and display text
                    oModel.setProperty(sPath + "/technicianId", oTechnician.id);
                    oModel.setProperty(sPath + "/technicianExternalId", oTechnician.externalId);
                    oModel.setProperty(sPath + "/technicianDisplay", oTechnician.displayText);
                    
                    console.log('TechnicianSelect: Selected', oTechnician.displayText, 'ID:', oTechnician.id, 'ExtID:', oTechnician.externalId);
                }
            } else {
                // Clear selection
                oModel.setProperty(sPath + "/technicianId", "");
                oModel.setProperty(sPath + "/technicianExternalId", "");
                oModel.setProperty(sPath + "/technicianDisplay", "");
            }
        },

        /**
         * Handle technician ComboBox change (manual input)
         * Called when user types a value that doesn't match any suggestion
         */
        onTechnicianChange(oEvent) {
            const sValue = oEvent.getParameter("value") || "";
            const oComboBox = oEvent.getSource();
            const oContext = oComboBox.getBindingContext("createTM");
            
            if (!oContext) return;
            
            const sPath = oContext.getPath();
            const oModel = this._tmCreateDialog.getModel("createTM");
            
            // If no item selected but value entered, try to find matching technician
            if (sValue && !oComboBox.getSelectedItem()) {
                const technicians = TechnicianService.searchTechnicians(sValue);
                if (technicians.length === 1) {
                    // Auto-select if exactly one match
                    const tech = technicians[0];
                    oModel.setProperty(sPath + "/technicianId", tech.id);
                    oModel.setProperty(sPath + "/technicianExternalId", tech.externalId);
                    oModel.setProperty(sPath + "/technicianDisplay", tech.displayText);
                    oComboBox.setValue(tech.displayText);
                    console.log('TechnicianChange: Auto-selected', tech.displayText, 'ExtID:', tech.externalId);
                } else if (technicians.length === 0) {
                    // Clear ID if no match found
                    oModel.setProperty(sPath + "/technicianId", "");
                    oModel.setProperty(sPath + "/technicianExternalId", "");
                    console.log('TechnicianChange: No match found for', sValue);
                }
            }
        },

        /* ========================================
         * PER-ENTRY ACTION BUTTONS
         * ======================================== */

        /**
         * Close/Remove individual T&M entry (no save, just remove)
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

            // Show confirmation dialog
            MessageBox.confirm(
                `Close this ${oEntry.type} entry without saving?`,
                {
                    title: "Close Entry",
                    onClose: (sAction) => {
                        if (sAction === MessageBox.Action.OK) {
                            // Get current entries array
                            const aEntries = oModel.getProperty("/entries");
                            
                            // Find index of entry to remove
                            const iIndex = parseInt(sPath.split("/").pop());
                            
                            // Remove entry (no save)
                            aEntries.splice(iIndex, 1);
                            
                            // Update model
                            oModel.setProperty("/entries", aEntries);
                            
                            MessageToast.show(`${oEntry.type} entry closed`);
                        }
                    }
                }
            );
        },

        /**
         * Save individual T&M entry (Simplified: Save â†’ Show JSON â†’ Done!)
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
                    // STATE 1: Change button to "Send for Approval"
                    oModel.setProperty(sPath + "/saveButtonState", "ready");
                    oModel.setProperty(sPath + "/saveButtonText", "Send for Approval");
                    oModel.setProperty(sPath + "/saveButtonIcon", "sap-icon://paper-plane");
                    MessageToast.show("Ready to send");
                    break;

                case "ready":
                    // STATE 2: Show JSON in dialog
                    this._showEntryJSON(oEntry);
                    
                    // Update button to "Done!"
                    oModel.setProperty(sPath + "/saveButtonState", "done");
                    oModel.setProperty(sPath + "/saveButtonText", "Done!");
                    oModel.setProperty(sPath + "/saveButtonIcon", "sap-icon://accept");
                    oModel.setProperty(sPath + "/saveButtonType", "Success");
                    break;

                case "done":
                    // STATE 3: Already done
                    MessageToast.show("Entry already processed");
                    break;

                default:
                    MessageToast.show("Unknown entry state");
            }
        },

        /**
         * Helper: Show entry JSON in dialog
         * Delegates to TMPayloadService for payload building
         */
        _showEntryJSON(oEntry) {
            // Get activity context from dialog model
            const oDialogModel = this._tmCreateDialog.getModel("createTM");
            const activityId = oDialogModel.getProperty("/activityId");
            const orgLevelId = oDialogModel.getProperty("/orgLevelId");

            // Build payload using TMPayloadService
            const payload = TMPayloadService.buildPayload(oEntry, activityId, orgLevelId);
            const jsonString = TMPayloadService.formatPayloadJSON(payload);

            // Show in dialog
            MessageBox.information(
                jsonString,
                {
                    title: `${oEntry.type} Entry Data`,
                    contentWidth: "500px",
                    styleClass: "sapUiSizeCompact"
                }
            );
        },

        /* ========================================
         * DURATION / DATETIME CHANGE HANDLERS
         * Delegated to DateTimeService for business logic
         * ======================================== */

        /**
         * Handle duration change for Time Effort - updates endDateTime
         */
        onDurationChange(oEvent) {
            const oContext = oEvent.getSource().getBindingContext("createTM");
            if (!oContext) return;

            const oModel = this._tmCreateDialog.getModel("createTM");
            const iDuration = oEvent.getParameter("value");
            DateTimeService.handleDurationChange(oModel, oContext.getPath(), iDuration, "startDateTime", "endDateTime");
        },

        /**
         * Handle start datetime change for Time Effort - updates endDateTime based on duration
         */
        onStartDateTimeChange(oEvent) {
            const oContext = oEvent.getSource().getBindingContext("createTM");
            if (!oContext) return;

            const oModel = this._tmCreateDialog.getModel("createTM");
            DateTimeService.handleStartDateTimeChange(oModel, oContext.getPath(), "startDateTime", "duration", "endDateTime", 30);
        },

        /**
         * Handle travel duration change for Mileage - updates travelEndDateTime
         */
        onTravelDurationChange(oEvent) {
            const oContext = oEvent.getSource().getBindingContext("createTM");
            if (!oContext) return;

            const oModel = this._tmCreateDialog.getModel("createTM");
            const iDuration = oEvent.getParameter("value");
            DateTimeService.handleDurationChange(oModel, oContext.getPath(), iDuration, "travelStartDateTime", "travelEndDateTime");
        },

        /**
         * Handle travel start datetime change for Mileage - updates travelEndDateTime
         */
        onTravelStartDateTimeChange(oEvent) {
            const oContext = oEvent.getSource().getBindingContext("createTM");
            if (!oContext) return;

            const oModel = this._tmCreateDialog.getModel("createTM");
            DateTimeService.handleStartDateTimeChange(oModel, oContext.getPath(), "travelStartDateTime", "travelDuration", "travelEndDateTime", 30);
        },

        /**
         * Handle duration1 change for Time & Material Arbeitszeit
         */
        onDuration1Change(oEvent) {
            this._handleTimeAndMaterialDurationChange(oEvent, 1);
        },

        /**
         * Handle duration2 change for Time & Material Fahrzeit
         */
        onDuration2Change(oEvent) {
            this._handleTimeAndMaterialDurationChange(oEvent, 2);
        },

        /**
         * Handle duration3 change for Time & Material Wartezeit
         */
        onDuration3Change(oEvent) {
            this._handleTimeAndMaterialDurationChange(oEvent, 3);
        },

        /**
         * Handle start datetime change for Time & Material column 1
         */
        onStartDateTime1Change(oEvent) {
            this._handleTimeAndMaterialStartChange(oEvent, 1);
        },

        /**
         * Handle start datetime change for Time & Material column 2
         */
        onStartDateTime2Change(oEvent) {
            this._handleTimeAndMaterialStartChange(oEvent, 2);
        },

        /**
         * Handle start datetime change for Time & Material column 3
         */
        onStartDateTime3Change(oEvent) {
            this._handleTimeAndMaterialStartChange(oEvent, 3);
        },

        /**
         * Generic handler for Time & Material duration changes
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
    });
});