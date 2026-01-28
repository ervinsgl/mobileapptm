/**
 * index.js - Backend Server
 * 
 * Express.js server for the Service Confirmation application.
 * Handles FSM Mobile web container integration and proxies requests to SAP FSM APIs.
 * 
 * Key Responsibilities:
 * 1. Web Container Entry Point - Receives POST from FSM Mobile with context
 * 2. Static File Serving - Serves the UI5 frontend from /webapp
 * 3. REST API Proxy - Authenticated requests to FSM APIs
 * 4. Type Configuration - Manage expense/mileage type IDs
 * 
 * API Routes:
 * - POST /web-container-access-point - FSM Mobile entry point
 * - GET  /web-container-context      - Frontend retrieves stored context
 * - POST /api/get-activity-by-id     - Get single activity
 * - POST /api/get-activities-by-service-call - Get service call composite tree
 * - GET  /api/get-organization-levels-full   - Full org hierarchy
 * - POST /api/get-user-org-level     - Resolve user's org level
 * - POST /api/get-reported-items     - T&M reports for activity
 * - GET  /api/get-time-tasks         - Task lookup data
 * - GET  /api/get-items              - Item lookup data
 * - GET  /api/get-expense-types      - Expense type lookup data
 * - GET  /api/get-type-config        - Get type configuration
 * - POST /api/save-type-config       - Save type configuration
 * - POST /api/add-expense-type       - Add expense type ID
 * - POST /api/remove-expense-type    - Remove expense type ID
 * - POST /api/add-mileage-type       - Add mileage type ID
 * - POST /api/remove-mileage-type    - Remove mileage type ID
 * - POST /api/reset-type-config      - Reset to defaults
 * 
 * @file index.js
 * @requires express
 * @requires ./utils/FSMService
 * @requires ./TypeConfigStore
 */

const express = require('express');
const path = require('path');
const FSMService = require('./utils/FSMService');
const TypeConfigStore = require('./TypeConfigStore');

const app = express();

// ===========================
// FSM WEB CONTAINER CONTEXT STORAGE
// ===========================
// Stores context from FSM Mobile web container POST request
let mobileAppContext = undefined;

// Middleware
app.use((req, res, next) => {
    res.removeHeader('X-Frame-Options');
    next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.enable('trust proxy');

// ===========================
// FSM WEB CONTAINER ENTRY POINT
// ===========================
// FSM Mobile sends POST request with context when opening web container
// iOS: Content-Type: application/json
// Android: Content-Type: application/x-www-form-urlencoded
// Configure this URL in FSM Admin > Web Containers

app.post("/web-container-access-point", (req, res) => {
    // Store context in memory (for frontend Session Context panel and cloudId)
    mobileAppContext = req.body || {};
    
    // Redirect to app root (frontend will fetch context via GET)
    const redirectUrl = req.protocol + '://' + req.get('host');
    res.redirect(redirectUrl);
});

// GET endpoint for frontend to retrieve stored context
app.get("/web-container-context", (req, res) => {
    if (mobileAppContext === undefined) {
        return res.status(404).json({ 
            message: 'Context from mobile web container is not available.',
            hint: 'Open this app from FSM Mobile web container, not directly in browser.'
        });
    }
    
    // Return context (for Session Context panel and cloudId)
    return res.json(mobileAppContext);
});

// Also handle POST to root "/" in case FSM sends there
app.post("/", (req, res) => {
    mobileAppContext = req.body || {};
    const redirectUrl = req.protocol + '://' + req.get('host');
    res.redirect(redirectUrl);
});

// Serve static files (Fiori app) - serve from webapp folder
app.use(express.static(path.join(__dirname, 'webapp')));

// ===========================
// API ROUTES
// ===========================

// Get Activity by ID
app.post("/api/get-activity-by-id", async (req, res) => {
    const { activityId } = req.body;

    if (!activityId) {
        return res.status(400).json({ message: 'Activity ID is required' });
    }

    try {
        const data = await FSMService.getActivityById(activityId);
        res.json(data);
    } catch (error) {
        console.error("Error fetching activity by ID:", error.message);
        res.status(error.response?.status || 500).json({
            message: error.response?.data?.message || 'Activity not found',
            error: error.response?.data || error.message
        });
    }
});

// Get Activity by Code
app.post("/api/get-activity-by-code", async (req, res) => {
    const { activityCode } = req.body;

    if (!activityCode) {
        return res.status(400).json({ message: 'Activity Code is required' });
    }

    try {
        const data = await FSMService.getActivityByCode(activityCode);
        res.json(data);
    } catch (error) {
        console.error("Error fetching activity by code:", error.message);
        res.status(error.response?.status || 500).json({
            message: error.response?.data?.message || 'Activity not found',
            error: error.response?.data || error.message
        });
    }
});

// Get Activities by Service Call ID (Composite Tree)
app.post("/api/get-activities-by-service-call", async (req, res) => {
    const { serviceCallId } = req.body;

    if (!serviceCallId) {
        return res.status(400).json({ message: 'Service Call ID is required' });
    }

    try {
        // Return the COMPLETE composite-tree response
        const data = await FSMService.getActivitiesForServiceCall(serviceCallId);
        res.json(data);
    } catch (error) {
        console.error("Error fetching activities by service call:", error.message);
        res.status(error.response?.status || 500).json({
            message: error.response?.data?.message || 'Failed to fetch activities',
            error: error.response?.data || error.message
        });
    }
});

// Update Activity
app.put("/api/update-activity", async (req, res) => {
    const { activityId, startDateTime, endDateTime, remarks, status } = req.body;

    if (!activityId) {
        return res.status(400).json({ message: 'Activity ID is required' });
    }

    try {
        const updatePayload = { activity: {} };
        if (startDateTime) updatePayload.activity.startDateTime = startDateTime;
        if (endDateTime) updatePayload.activity.endDateTime = endDateTime;
        if (remarks) updatePayload.activity.remarks = remarks;
        if (status) updatePayload.activity.status = status;

        const data = await FSMService.updateActivity(activityId, updatePayload);
        res.json(data);
    } catch (error) {
        console.error("Error updating activity:", error.message);
        res.status(error.response?.status || 500).json({
            message: error.response?.data?.message || 'Failed to update activity',
            error: error.response?.data || error.message
        });
    }
});

// Get Reported Items (T&M) for Activity
app.post("/api/get-reported-items", async (req, res) => {
    const { activityId } = req.body;

    if (!activityId) {
        return res.status(400).json({ message: 'Activity ID is required' });
    }

    try {
        // Fetch all 4 types in parallel
        const [timeEfforts, materials, expenses, mileages] = await Promise.all([
            FSMService.getTimeEffortsForActivity(activityId),
            FSMService.getMaterialsForActivity(activityId),
            FSMService.getExpensesForActivity(activityId),
            FSMService.getMileagesForActivity(activityId)
        ]);

        const allItems = [
            ...timeEfforts,
            ...materials,
            ...expenses,
            ...mileages
        ];

        res.json({
            items: allItems,     // Full data including all fields
            count: allItems.length,
            breakdown: {
                timeEfforts: timeEfforts.length,
                materials: materials.length,
                expenses: expenses.length,
                mileages: mileages.length
            }
        });

    } catch (error) {
        console.error("Error fetching reported items:", error.message);
        res.status(error.response?.status || 500).json({
            message: error.response?.data?.message || 'Failed to fetch reported items',
            error: error.response?.data || error.message
        });
    }
});

// Create Expense Report
app.post("/api/create-expense", async (req, res) => {
    const expenseData = req.body;

    if (!expenseData || !expenseData.object) {
        return res.status(400).json({ message: 'Expense data is required' });
    }

    try {
        const result = await FSMService.createExpense(expenseData);
        
        res.json({
            success: true,
            data: result,
            message: 'Expense created successfully'
        });

    } catch (error) {
        console.error("Error creating expense:", error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            message: error.response?.data?.message || 'Failed to create expense',
            error: error.response?.data || error.message
        });
    }
});

// Update Expense Report
app.patch("/api/update-expense/:id", async (req, res) => {
    const expenseId = req.params.id;
    const expenseData = req.body;

    if (!expenseId) {
        return res.status(400).json({ message: 'Expense ID is required' });
    }

    try {
        const result = await FSMService.updateExpense(expenseId, expenseData);
        
        res.json({
            success: true,
            data: result,
            message: 'Expense updated successfully'
        });

    } catch (error) {
        console.error("Error updating expense:", error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            message: error.response?.data?.message || 'Failed to update expense',
            error: error.response?.data || error.message
        });
    }
});

// Create Mileage Report
app.post("/api/create-mileage", async (req, res) => {
    const mileageData = req.body;

    if (!mileageData || !mileageData.object) {
        return res.status(400).json({ message: 'Mileage data is required' });
    }

    try {
        const result = await FSMService.createMileage(mileageData);
        
        res.json({
            success: true,
            data: result,
            message: 'Mileage created successfully'
        });

    } catch (error) {
        console.error("Error creating mileage:", error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            message: error.response?.data?.message || 'Failed to create mileage',
            error: error.response?.data || error.message
        });
    }
});

// Update Mileage Report
app.patch("/api/update-mileage/:id", async (req, res) => {
    const mileageId = req.params.id;
    const mileageData = req.body;

    if (!mileageId) {
        return res.status(400).json({ message: 'Mileage ID is required' });
    }

    try {
        const result = await FSMService.updateMileage(mileageId, mileageData);
        
        res.json({
            success: true,
            data: result,
            message: 'Mileage updated successfully'
        });

    } catch (error) {
        console.error("Error updating mileage:", error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            message: error.response?.data?.message || 'Failed to update mileage',
            error: error.response?.data || error.message
        });
    }
});

// Create Material
app.post("/api/create-material", async (req, res) => {
    const materialData = req.body;

    if (!materialData || !materialData.object) {
        return res.status(400).json({ message: 'Material data is required' });
    }

    try {
        const result = await FSMService.createMaterial(materialData);
        
        res.json({
            success: true,
            data: result,
            message: 'Material created successfully'
        });

    } catch (error) {
        console.error("Error creating material:", error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            message: error.response?.data?.message || 'Failed to create material',
            error: error.response?.data || error.message
        });
    }
});

// Create TimeEffort
app.post("/api/create-time-effort", async (req, res) => {
    const timeEffortData = req.body;

    if (!timeEffortData || !timeEffortData.object) {
        return res.status(400).json({ message: 'TimeEffort data is required' });
    }

    try {
        const result = await FSMService.createTimeEffort(timeEffortData);
        
        res.json({
            success: true,
            data: result,
            message: 'TimeEffort created successfully'
        });

    } catch (error) {
        console.error("Error creating time effort:", error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            message: error.response?.data?.message || 'Failed to create time effort',
            error: error.response?.data || error.message
        });
    }
});

// Update Material
app.patch("/api/update-material/:id", async (req, res) => {
    const materialId = req.params.id;
    const materialData = req.body;

    if (!materialId) {
        return res.status(400).json({ message: 'Material ID is required' });
    }

    try {
        const result = await FSMService.updateMaterial(materialId, materialData);
        
        res.json({
            success: true,
            data: result,
            message: 'Material updated successfully'
        });

    } catch (error) {
        console.error("Error updating material:", error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            message: error.response?.data?.message || 'Failed to update material',
            error: error.response?.data || error.message
        });
    }
});

// Update TimeEffort
app.patch("/api/update-time-effort/:id", async (req, res) => {
    const timeEffortId = req.params.id;
    const timeEffortData = req.body;

    if (!timeEffortId) {
        return res.status(400).json({ message: 'TimeEffort ID is required' });
    }

    try {
        const result = await FSMService.updateTimeEffort(timeEffortId, timeEffortData);
        
        res.json({
            success: true,
            data: result,
            message: 'TimeEffort updated successfully'
        });

    } catch (error) {
        console.error("Error updating time effort:", error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            message: error.response?.data?.message || 'Failed to update time effort',
            error: error.response?.data || error.message
        });
    }
});

// Create Time & Material (combined: 1 Material + multiple TimeEfforts)
app.post("/api/create-time-material", async (req, res) => {
    const { material, timeEffortsFZ, timeEffortsWZ, timeEffortsAZ } = req.body;

    if (!material || !material.object) {
        return res.status(400).json({ message: 'Material data is required' });
    }

    const results = {
        material: null,
        timeEfforts: [],
        errors: []
    };

    try {
        // 1. Create Material first
        results.material = await FSMService.createMaterial(material);

        // 2. Create all TimeEfforts in order: AZ first, then FZ, then WZ
        const allTimeEfforts = [
            ...(timeEffortsAZ || []),
            ...(timeEffortsFZ || []),
            ...(timeEffortsWZ || [])
        ];

        for (const timeEffort of allTimeEfforts) {
            try {
                const teResult = await FSMService.createTimeEffort(timeEffort);
                results.timeEfforts.push({ success: true, data: teResult });
            } catch (teError) {
                results.errors.push({
                    type: 'TimeEffort',
                    task: timeEffort.task?.code,
                    error: teError.response?.data?.message || teError.message
                });
            }
        }

        const hasErrors = results.errors.length > 0;
        
        res.json({
            success: !hasErrors,
            partialSuccess: hasErrors && results.timeEfforts.length > 0,
            data: results,
            message: hasErrors 
                ? `Created with ${results.errors.length} error(s)` 
                : 'Time & Material created successfully'
        });

    } catch (error) {
        console.error("Error creating Time & Material:", error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            message: error.response?.data?.message || 'Failed to create Time & Material',
            error: error.response?.data || error.message,
            partialResults: results
        });
    }
});

// Get all Persons (Technicians)
app.post("/api/get-persons", async (req, res) => {
    try {
        const persons = await FSMService.getPersons();
        res.json({ persons });

    } catch (error) {
        console.error("Error fetching persons:", error.message);
        res.status(error.response?.status || 500).json({
            message: error.response?.data?.message || 'Failed to fetch persons',
            error: error.response?.data || error.message
        });
    }
});

// Get Person by ID
app.post("/api/get-person-by-id", async (req, res) => {
    const { personId } = req.body;

    if (!personId) {
        return res.status(400).json({ message: 'Person ID is required' });
    }

    try {
        const person = await FSMService.getPersonById(personId);

        if (person) {
            res.json({ person });
        } else {
            res.status(404).json({ message: 'Person not found' });
        }

    } catch (error) {
        console.error("Error fetching person by ID:", error.message);
        res.status(error.response?.status || 500).json({
            message: error.response?.data?.message || 'Failed to fetch person',
            error: error.response?.data || error.message
        });
    }
});

// Get Person by External ID
app.post("/api/get-person-by-external-id", async (req, res) => {
    const { externalId } = req.body;

    if (!externalId) {
        return res.status(400).json({ message: 'External ID is required' });
    }

    try {
        const person = await FSMService.getPersonByExternalId(externalId);

        if (person) {
            res.json({ person });
        } else {
            res.status(404).json({ message: 'Person not found' });
        }

    } catch (error) {
        console.error("Error fetching person by external ID:", error.message);
        res.status(error.response?.status || 500).json({
            message: error.response?.data?.message || 'Failed to fetch person',
            error: error.response?.data || error.message
        });
    }
});

// Get Business Partner by External ID
app.post("/api/get-business-partner-by-external-id", async (req, res) => {
    const { externalId } = req.body;

    if (!externalId) {
        return res.status(400).json({ message: 'External ID is required' });
    }

    try {
        const businessPartner = await FSMService.getBusinessPartnerByExternalId(externalId);

        if (businessPartner) {
            res.json({ businessPartner });
        } else {
            res.status(404).json({ message: 'Business Partner not found' });
        }

    } catch (error) {
        console.error("Error fetching business partner by external ID:", error.message);
        res.status(error.response?.status || 500).json({
            message: error.response?.data?.message || 'Failed to fetch business partner',
            error: error.response?.data || error.message
        });
    }
});

// Get Organization Level by ID (returns full hierarchy with all sublevels)
app.get("/api/get-organization-levels-full", async (req, res) => {
    try {
        const data = await FSMService.getOrganizationLevels();
        res.json(data);

    } catch (error) {
        console.error("Error fetching organization levels:", error.message);
        res.status(error.response?.status || 500).json({
            message: error.response?.data?.message || 'Failed to fetch organization levels',
            error: error.response?.data || error.message
        });
    }
});

// Get Time Tasks (for lookup/dropdown)
app.get("/api/get-time-tasks", async (req, res) => {
    try {
        const timeTasks = await FSMService.getTimeTasks();
        
        res.json({
            timeTasks: timeTasks,
            count: timeTasks.length
        });

    } catch (error) {
        console.error("Error fetching time tasks:", error.message);
        res.status(error.response?.status || 500).json({
            message: error.response?.data?.message || 'Failed to fetch time tasks',
            error: error.response?.data || error.message
        });
    }
});

// Get Items (for lookup/dropdown - excludes tools and Z11% items)
app.get("/api/get-items", async (req, res) => {
    try {
        const items = await FSMService.getItems();
        
        res.json({
            items: items,
            count: items.length
        });

    } catch (error) {
        console.error("Error fetching items:", error.message);
        res.status(error.response?.status || 500).json({
            message: error.response?.data?.message || 'Failed to fetch items',
            error: error.response?.data || error.message
        });
    }
});

// Get Expense Types (for lookup/dropdown)
app.get("/api/get-expense-types", async (req, res) => {
    try {
        const expenseTypes = await FSMService.getExpenseTypes();
        
        res.json({
            expenseTypes: expenseTypes,
            count: expenseTypes.length
        });

    } catch (error) {
        console.error("Error fetching expense types:", error.message);
        res.status(error.response?.status || 500).json({
            message: error.response?.data?.message || 'Failed to fetch expense types',
            error: error.response?.data || error.message
        });
    }
});

// Get UDF Meta externalId by ID
app.post("/api/get-udf-meta", async (req, res) => {
    const { udfMetaId } = req.body;

    if (!udfMetaId) {
        return res.status(400).json({ message: 'UDF Meta ID is required' });
    }

    try {
        const externalId = await FSMService.getUdfMetaById(udfMetaId);
        
        res.json({
            id: udfMetaId,
            externalId: externalId
        });

    } catch (error) {
        console.error("Error fetching UDF Meta:", error.message);
        res.status(error.response?.status || 500).json({
            message: error.response?.data?.message || 'Failed to fetch UDF Meta',
            error: error.response?.data || error.message
        });
    }
});

// Get Approval Status for T&M entries (batch)
app.post("/api/get-approval-status", async (req, res) => {
    const { objectIds } = req.body;

    if (!objectIds || !Array.isArray(objectIds) || objectIds.length === 0) {
        return res.status(400).json({ message: 'Object IDs array is required' });
    }

    try {
        const statusMap = await FSMService.getApprovalStatusBatch(objectIds);
        
        res.json({
            statuses: statusMap,
            count: Object.keys(statusMap).length
        });

    } catch (error) {
        console.error("Error fetching Approval statuses:", error.message);
        res.status(error.response?.status || 500).json({
            message: error.response?.data?.message || 'Failed to fetch Approval statuses',
            error: error.response?.data || error.message
        });
    }
});

// Get User's Organization Level by username
// Flow: username -> User API (get user ID) -> Query Person (get orgLevel)
app.post("/api/get-user-org-level", async (req, res) => {
    const { username } = req.body;

    if (!username) {
        return res.status(400).json({ message: 'Username is required' });
    }

    try {
        const userOrgLevel = await FSMService.getUserOrgLevel(username);
        
        if (!userOrgLevel) {
            return res.status(404).json({ 
                message: 'User or organization level not found',
                username: username
            });
        }

        res.json({
            success: true,
            data: userOrgLevel
        });

    } catch (error) {
        console.error("Error fetching user org level:", error.message);
        res.status(error.response?.status || 500).json({
            message: error.response?.data?.message || 'Failed to fetch user organization level',
            error: error.response?.data || error.message
        });
    }
});

// ===========================
// TYPE CONFIGURATION ENDPOINTS
// ===========================

/**
 * GET /api/get-type-config
 * Returns current type configuration (expense and mileage types)
 */
app.get("/api/get-type-config", (req, res) => {
    try {
        const config = TypeConfigStore.getConfig();
        res.json({
            success: true,
            data: config
        });
    } catch (error) {
        console.error("Error getting type config:", error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to get type configuration',
            error: error.message
        });
    }
});

/**
 * POST /api/save-type-config
 * Save full type configuration
 * Body: { expenseTypes: [...], mileageTypes: [...], modifiedBy: "username" }
 */
app.post("/api/save-type-config", (req, res) => {
    try {
        const { expenseTypes, mileageTypes, modifiedBy } = req.body;
        
        const result = TypeConfigStore.updateConfig(
            { expenseTypes, mileageTypes },
            modifiedBy
        );
        
        if (result.success) {
            res.json({
                success: true,
                data: result.config,
                message: 'Configuration saved successfully'
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Failed to save configuration'
            });
        }
    } catch (error) {
        console.error("Error saving type config:", error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to save type configuration',
            error: error.message
        });
    }
});

/**
 * POST /api/add-expense-type
 * Add a single expense type ID
 * Body: { typeId: "Z...", modifiedBy: "username" }
 */
app.post("/api/add-expense-type", (req, res) => {
    try {
        const { typeId, modifiedBy } = req.body;
        const result = TypeConfigStore.addExpenseType(typeId, modifiedBy);
        
        if (result.success) {
            res.json({
                success: true,
                data: result.config,
                message: `Added expense type: ${typeId}`
            });
        } else {
            res.status(400).json({
                success: false,
                message: result.message
            });
        }
    } catch (error) {
        console.error("Error adding expense type:", error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to add expense type',
            error: error.message
        });
    }
});

/**
 * POST /api/remove-expense-type
 * Remove a single expense type ID
 * Body: { typeId: "Z...", modifiedBy: "username" }
 */
app.post("/api/remove-expense-type", (req, res) => {
    try {
        const { typeId, modifiedBy } = req.body;
        const result = TypeConfigStore.removeExpenseType(typeId, modifiedBy);
        
        if (result.success) {
            res.json({
                success: true,
                data: result.config,
                message: `Removed expense type: ${typeId}`
            });
        } else {
            res.status(400).json({
                success: false,
                message: result.message
            });
        }
    } catch (error) {
        console.error("Error removing expense type:", error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to remove expense type',
            error: error.message
        });
    }
});

/**
 * POST /api/add-mileage-type
 * Add a single mileage type ID
 * Body: { typeId: "Z...", modifiedBy: "username" }
 */
app.post("/api/add-mileage-type", (req, res) => {
    try {
        const { typeId, modifiedBy } = req.body;
        const result = TypeConfigStore.addMileageType(typeId, modifiedBy);
        
        if (result.success) {
            res.json({
                success: true,
                data: result.config,
                message: `Added mileage type: ${typeId}`
            });
        } else {
            res.status(400).json({
                success: false,
                message: result.message
            });
        }
    } catch (error) {
        console.error("Error adding mileage type:", error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to add mileage type',
            error: error.message
        });
    }
});

/**
 * POST /api/remove-mileage-type
 * Remove a single mileage type ID
 * Body: { typeId: "Z...", modifiedBy: "username" }
 */
app.post("/api/remove-mileage-type", (req, res) => {
    try {
        const { typeId, modifiedBy } = req.body;
        const result = TypeConfigStore.removeMileageType(typeId, modifiedBy);
        
        if (result.success) {
            res.json({
                success: true,
                data: result.config,
                message: `Removed mileage type: ${typeId}`
            });
        } else {
            res.status(400).json({
                success: false,
                message: result.message
            });
        }
    } catch (error) {
        console.error("Error removing mileage type:", error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to remove mileage type',
            error: error.message
        });
    }
});

/**
 * POST /api/reset-type-config
 * Reset type configuration to defaults
 * Body: { modifiedBy: "username" }
 */
app.post("/api/reset-type-config", (req, res) => {
    try {
        const { modifiedBy } = req.body;
        const result = TypeConfigStore.resetToDefaults(modifiedBy);
        
        if (result.success) {
            res.json({
                success: true,
                data: result.config,
                message: 'Configuration reset to defaults'
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Failed to reset configuration'
            });
        }
    } catch (error) {
        console.error("Error resetting type config:", error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to reset type configuration',
            error: error.message
        });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});