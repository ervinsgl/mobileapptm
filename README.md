# T&M Journal - FSM Mobile Integration App

A SAP Fiori mobile application for SAP Field Service Management (FSM), designed to be opened from FSM Mobile as an External App or Workflow. Features T&M (Time & Materials) reporting with automatic organization level resolution and context-aware activity highlighting.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Setup & Deployment](#setup--deployment)
- [How It Works](#how-it-works)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Development Guide](#development-guide)
- [Troubleshooting](#troubleshooting)
- [Application Details](#application-details)
- [Current Status](#current-status)
- [Security Notes](#security-notes)

---

## 🎯 Overview

This application provides a mobile-optimized interface for viewing and managing FSM activities with T&M (Time & Materials) reporting. It integrates seamlessly with FSM Mobile through Web Container integration.

**Key Features:**
- ✅ Progressive disclosure UI (Service Order → Product Groups → Activities → T&M Reports)
- ✅ Organization level auto-resolution from logged-in user
- ✅ Activities grouped by Product Description
- ✅ Auto-loads activity data from FSM Mobile web container context
- ✅ Context activity highlighting (light blue SAP Fiori styling)
- ✅ T&M Reports viewing and creation:
  - **Time & Material Report** - For standard service products (Material + Time entries)
  - **Expense Report** - For expense service products (Z40000001, Z40000007, Z50000000)
  - **Mileage Report** - For mileage service products (Z40000038, Z40000008)
- ✅ Session context display (User, Account, Company, Organization)
- ✅ Mobile-first responsive design
- ✅ Secure authentication via SAP BTP Destination Service
- ✅ Direct FSM API integration

**Technology Stack:**
- **Frontend:** SAP UI5 (Fiori)
- **Backend:** Node.js + Express
- **Deployment:** SAP Business Technology Platform (Cloud Foundry)
- **Authentication:** OAuth 2.0 via BTP Destination Service

---

## 🏗️ Architecture
```
┌─────────────────┐
│   FSM Mobile    │  (Opens Web Container with cloudId)
└────────┬────────┘
         │ POST: context (cloudId, userName, cloudAccount, companyName)
         ▼
┌─────────────────┐
│  SAP BTP (CF)   │  (Cloud Foundry App)
│  ┌───────────┐  │
│  │ UI5 App   │  │  (Frontend - Progressive UI)
│  │           │  │  1. T&M Journal Page (Service Order header)
│  │           │  │  2. Organization Level (auto-resolved)
│  │           │  │  3. Product Groups → Activities
│  │           │  │  4. T&M Reports Dialog (view/edit)
│  │           │  │  5. T&M Creation Dialog (create new)
│  └─────┬─────┘  │
│        │        │
│  ┌─────▼─────┐  │
│  │ Express   │  │  (Backend - index.js)
│  │ Server    │  │  - Web Container Context
│  └─────┬─────┘  │  - API Proxy
└────────┼────────┘
         │ OAuth Token
         ▼
┌─────────────────┐
│ BTP Destination │  (FSM_S4E destination)
│    Service      │
└────────┬────────┘
         │ Authenticated Request
         ▼
┌─────────────────┐
│   FSM API       │  (SAP Field Service Management)
│                 │  - User & Organization Data
│                 │  - Activities (Composite Tree)
│                 │  - T&M Reports (Time, Material, Expense, Mileage)
│                 │  - Lookup Data (Tasks, Items, Persons, etc.)
└─────────────────┘
```

---

## ✨ Features

### UI Components

| Component | Description |
|-----------|-------------|
| **Session Context Panel** | Shows User, Account, Company, Organization, Object Type (visible when opened from FSM Mobile) |
| **Service Order Panel** | Expandable panel showing Service Order details (ID, External ID, Subject, Business Partner, Responsible, Dates) |
| **Organization Level** | Auto-resolved from logged-in user (no manual selection required) |
| **Product Groups** | Activities grouped by Product Description with activity count |
| **Activity Panels** | Expandable panels with context highlighting (blue border for entry activity), Address, Responsible, Org Level, Service Product, T&M Summary |
| **T&M Summary** | Shows count of Time Effort, Material, Expense, Mileage reports per activity |
| **T&M Reports Dialog** | Detailed view of all T&M entries with expandable panels, Edit/Approval buttons, multi-line headers |
| **T&M Creation Dialog** | Create new T&M entries based on Activity Service Product type |

### Lookup Services

The app resolves FSM IDs to human-readable names:

| Service | Resolves | Example |
|---------|----------|---------|
| **PersonService** | Person ID/ExternalId → Name | `A1B2C3D4...` → `Max Mustermann (ZZ00094912)` |
| **TechnicianService** | Technician suggestions | Large dataset handling with Input suggestions |
| **TimeTaskService** | Task ID → Name | `3010642C...` → `AZ - Arbeitszeit` |
| **ItemService** | Item ID/ExternalId → Name | `MATNR001` → `MATNR001 - Schrauben M8` |
| **ExpenseTypeService** | Expense Type ID → Name | `6DC882E6...` → `Z40000039 - Aktivierungs-/Einsatzpauschale` |
| **UdfMetaService** | UDF Meta ID → ExternalId | `EB1C5C15...` → `Z_Mileage_MatID` |
| **OrganizationService** | Org Level ID → Name + User Resolution | `2B6F7485...` → `2130_MPA - Service Unit _Team1` |
| **BusinessPartnerService** | BP ExternalId → Name | `55003748` → `Company Name (55003748)` |
| **ApprovalService** | Object ID → Decision Status | `F1E2D3C4...` → `Approved` |

### T&M Entry Types (Creation)

Entry type shown depends on Activity Service Product:

| Service Product | Entry Type | Key Fields |
|-----------------|------------|------------|
| Z40000001, Z40000007, Z50000000 | **Expense Report** | Technician, Item, External/Internal Amount, Charge Option, Remarks |
| Z40000038, Z40000008 | **Mileage Report** | Technician, Item, Distance, Source, Destination, Driver, Private Car, Remarks |
| All others | **Time & Material Report** | Material section (Technician, Item, Quantity, Remarks) + Time sections (Arbeitszeit, Fahrzeit, Wartezeit with Task, Duration, Remarks) |

### T&M Report Types (Viewing)

| Type | Key Fields |
|------|------------|
| **Time Effort** | Duration, Start/End, Task, Technician, Charge Option, Remarks |
| **Material** | Quantity, Item, Date, Technician, Charge Option, Remarks |
| **Expense** | External/Internal Amount, Expense Type, Date, Technician, Remarks |
| **Mileage** | Distance, Route, Mileage Type, Date, Driver, Private Car, Technician, Remarks |

---

## ✅ Prerequisites

### Required:
1. **Node.js** - LTS version (v18+ recommended)
2. **npm** - Version 8+
3. **Cloud Foundry CLI** - `cf` command line tool
4. **SAP BTP Account** - Cloud Foundry space with quota
5. **FSM Instance** - Access to SAP Field Service Management

### SAP BTP Services:
- **Destination Service** - Instance named `mobileappsc-destination` bound to the application
- **Destination Configuration** - FSM_S4E destination configured with OAuth2 credentials

---
## 🚀 Setup & Deployment

### 1. Clone & Install
```bash
git clone <repository-url>
cd mobileappsc
npm install
```

### 2. Configure BTP Destination

Create a destination named **FSM_S4E** in SAP BTP Cockpit:
```
Name: FSM_S4E
Type: HTTP
URL: https://de.fsm.cloud.sap
Authentication: OAuth2ClientCredentials
Token Service URL: https://de.fsm.cloud.sap/api/oauth2/v1/token
Client ID: <your-fsm-client-id>
Client Secret: <your-fsm-client-secret>

Additional Properties:
  account: <your-account>
  company: <your-company>
  URL.headers.X-Account-ID: <your-account-id>
  URL.headers.X-Company-ID: <your-company-id>
  URL.headers.X-Client-ID: FSM_Extension
  URL.headers.X-Client-Version: 0.0.1
```

### 3. Create Destination Service Instance
```bash
cf create-service destination lite mobileappsc-destination
```

### 4. Deploy to Cloud Foundry
```bash
cf push
```

### 5. Get Application URL
```bash
cf app mobileappsc
```

Copy the URL (e.g., `https://mobileappsc-xxx.cfapps.eu10.hana.ondemand.com`)

### 6. Configure FSM Web Container

Navigate to: **FSM Admin → Company → Web Containers**

#### 6.1 Create Web Container
1. **Click "Create" and configure:**
   - **Name:** `T&M Journal`
   - **External ID:** `Z_TMJournal`
   - **URL:** `https://mobileappsc-xxx.cfapps.eu10.hana.ondemand.com`
   - **Object Types:** `Activity` (select the object types this app handles)
   - **Active:** ✓ Checked

2. **Click "Save"**

#### 6.2 Web Container Context
When opened from FSM Mobile, the web container automatically POSTs context data:
- `cloudId` - The Activity ID (used to load the correct activity and auto-expand it)
- `objectType` - The object type (e.g., "ACTIVITY")
- `userName` - Current user's name (used for organization level auto-resolution)
- `cloudAccount` - FSM account name
- `companyName` - FSM company name
- `language` - User's language preference

#### 6.3 Add to Mobile Screen Configuration
Navigate to: **FSM Admin → Companies → [Your Company] → Screen Configurations**

1. **Select:** `Activity Mobile` (or your custom activity screen)
2. **Click the pencil icon** to edit
3. **Add Web Container button** to the activity screen
4. **Configure button settings:**
   - **Label:** `T&M Journal`
   - **Web Container:** Select `Z_TMJournal`
5. **Click "Save"**

---

### 7. Expected Result

**On FSM Mobile:**
- Technician opens an Activity
- Sees "T&M Journal" button
- Taps the button → Web Container opens the app
- App displays "T&M Journal for Service Order: {ID}" as page title
- Session Context panel shows User, Account, Company, Organization
- Organization level auto-resolved from logged-in user
- Context activity highlighted with light blue SAP Fiori styling and auto-expanded
- Product Groups show activities filtered by user's organization level

---

## 🔄 How It Works

### User Flow:

1. **Technician opens FSM Mobile** → Navigates to an Activity
2. **Taps "T&M Journal" button** → FSM Mobile opens web container
3. **Web container POSTs context** → App receives cloudId, userName, account, company
4. **App resolves user's organization** → Fetches user data and org level assignment from FSM
5. **Session Context panel appears** → Shows User, Account, Company, Organization
6. **Service Order panel loads** → Shows service call details (collapsed by default)
7. **Product Groups load automatically** → Activities filtered by user's organization level
8. **Context activity highlighted** → Light blue SAP Fiori styling, auto-expanded
9. **User views activity details** → Address, Responsible, Org Level, Service Product, T&M Summary
10. **User views/creates T&M** → Opens T&M Reports or Creation dialog (entry type based on Service Product)

### Web Container Context:

The app receives context from FSM Mobile via POST request:
```
POST /web-container-access-point
{
  "cloudId": "9D92E0B18FDC4A27A213401FEEA89FDA",  // Activity UUID
  "objectType": "ACTIVITY",
  "userName": "Max Mustermann",
  "cloudAccount": "company_account",
  "companyName": "Company Name",
  "language": "de"
}
```

### Authentication Flow:
```
1. FSM Mobile opens web container → POSTs context to app
2. App stores context → For Session panel display and cloudId
3. App starts API calls → Reads VCAP_SERVICES for Destination credentials
4. Gets OAuth token → Calls BTP Destination Service
5. Retrieves FSM destination → Gets FSM API URL + headers
6. Gets FSM OAuth token → Authenticates with FSM
7. Resolves user org level → userName → User API → Person Query → orgLevel
8. Makes API calls → Fetches service call, activities, T&M data
9. Token cached → Reused for 55 minutes (with 5min buffer)
```

---

## 📁 Project Structure
```
mobileappsc/
│
├── # ─────────── ROOT LEVEL ───────────
├── index.js                             # Express server (~760 lines)
├── package.json                         # Node.js dependencies
├── package-lock.json                    # Dependency lock file
├── manifest.yaml                        # Cloud Foundry deployment
├── mta.yaml                             # Multi-Target Application descriptor
├── xs-app.json                          # App Router configuration
├── xs-security.json                     # Security configuration
├── ui5.yaml                             # UI5 tooling configuration
├── ui5-local.yaml                       # UI5 local development config
├── ui5-deploy.yaml                      # UI5 deployment config
├── .gitignore                           # Git ignore rules
├── README.md                            # This file
│
├── # ─────────── BACKEND SERVICES ───────────
├── utils/
│   ├── DestinationService.js            # BTP Destination handling
│   ├── FSMService.js                    # FSM API integration (~1045 lines)
│   └── TokenCache.js                    # OAuth token caching
│
└── # ─────────── FRONTEND (SAP UI5) ───────────
webapp/
│
├── # ─────────── ENTRY POINTS ───────────
├── index.html                       # App entry point
├── simple.html                      # Simple test page
├── manifest.json                    # UI5 app descriptor
├── Component.js                     # UI5 Component
├── appconfig.json                   # App configuration
├── _appGenInfo.json                 # Generator info
│
├── # ─────────── VIEWS & FRAGMENTS ───────────
├── view/
│   ├── App.view.xml                 # Root view
│   ├── View1.view.xml               # Main view (T&M Journal page)
│   └── fragments/
│       ├── WebContainerContext.fragment.xml  # Session Context panel
│       ├── ServiceCall.fragment.xml          # Service Order header panel
│       ├── ProductGroups.fragment.xml        # Activity panels with T&M tables (~360 lines)
│       └── TMCreateDialog.fragment.xml       # T&M Creation dialog (~700 lines)
│
├── # ─────────── CONTROLLERS & MIXINS ───────────
├── controller/
│   ├── App.controller.js            # Root controller
│   ├── View1.controller.js          # Main controller (~425 lines)
│   └── mixin/
│       ├── DataLoadingMixin.js      # Data loading, batch T&M loading (~525 lines)
│       ├── TechnicianMixin.js       # Technician/task selection (~160 lines)
│       ├── TMDialogMixin.js         # T&M dialog open/enrichment (~490 lines)
│       ├── TMEditMixin.js           # Individual entry edit handlers (~730 lines)
│       ├── TMExpenseMileageMixin.js # Expense & Mileage creation (~520 lines)
│       ├── TMGridTableMixin.js      # Grid table utilities (~170 lines)
│       ├── TMMaterialMixin.js       # Material entry creation (~200 lines)
│       ├── TMSaveMixin.js           # Batch save operations (~470 lines)
│       ├── TMTableMixin.js          # Table filter/sort/selection (~590 lines)
│       └── TMTimeEntryMixin.js      # Time entry creation with repeat (~390 lines)
│
├── # ─────────── FRONTEND SERVICES ───────────
├── utils/
│   ├── helpers/
│   │   ├── DateTimeService.js       # Date/time utilities
│   │   ├── ProductGroupService.js   # Activity grouping by product
│   │   ├── ReportedItemsData.js     # T&M data fetching
│   │   └── URLHelper.js             # Web container context handling
│   │
│   ├── services/
│   │   ├── ActivityService.js       # Activity data management
│   │   ├── ApprovalService.js       # Approval status lookup
│   │   ├── BusinessPartnerService.js# Business partner lookup
│   │   ├── ContextService.js        # Web container & shell context handling
│   │   ├── ExpenseTypeService.js    # Expense type ID lookup
│   │   ├── ItemService.js           # Item ID/ExternalId lookup
│   │   ├── OrganizationService.js   # Organization level + user resolution
│   │   ├── PersonService.js         # Person ID/name lookup
│   │   ├── ServiceOrderService.js   # Service order/composite tree
│   │   ├── TechnicianService.js     # Technician suggestions
│   │   ├── TimeTaskService.js       # Time task ID lookup
│   │   └── UdfMetaService.js        # UDF Meta ID lookup
│   │
│   └── tm/
│       ├── TMCreationService.js     # T&M entry creation (~19KB)
│       ├── TMDataService.js         # T&M data management
│       ├── TMDialogService.js       # T&M dialog management (~22KB)
│       ├── TMEditService.js         # T&M entry editing
│       └── TMPayloadService.js      # T&M API payload building (~21KB)
│
├── # ─────────── MODEL ───────────
├── model/
│   ├── formatter.js                 # Date/number formatting
│   └── models.js                    # Device model
│
├── # ─────────── STYLES ───────────
├── css/
│   └── style.css                    # Custom styles (~1000 lines)
│
├── # ─────────── IMAGES ───────────
├── images/
│   └── TUEV-NORD_Logo.png           # Customer logo
│
├── # ─────────── TEST ───────────
├── test/                            # Test files
│
└── # ─────────── I18N ───────────
i18n/
└── i18n.properties              # Internationalization
```

---

## 🔌 API Reference

### Backend Endpoints

#### Web Container
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/web-container-access-point` | Receive context from FSM Mobile web container |
| GET | `/web-container-context` | Retrieve stored web container context |
| POST | `/` | Alternative web container entry point |

#### Activity & Service Call
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/get-activity-by-id` | Fetch activity by ID |
| POST | `/api/get-activity-by-code` | Fetch activity by code |
| POST | `/api/get-activities-by-service-call` | Fetch composite tree for service call |
| PUT | `/api/update-activity` | Update activity |

#### User & Organization
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/get-user-org-level` | Resolve user's organization level (userName → orgLevel) |
| GET | `/api/get-organization-levels-full` | Fetch full organization hierarchy |

#### T&M Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/get-reported-items` | Fetch T&M reports for activity |
| POST | `/api/get-approval-status` | Fetch approval status for T&M entries |

#### Lookup Data
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/get-persons` | Fetch all persons (technicians) |
| POST | `/api/get-person-by-id` | Fetch person by ID |
| POST | `/api/get-person-by-external-id` | Fetch person by external ID |
| POST | `/api/get-business-partner-by-external-id` | Fetch business partner by external ID |
| GET | `/api/get-time-tasks` | Fetch time tasks for lookup |
| GET | `/api/get-items` | Fetch items for lookup |
| GET | `/api/get-expense-types` | Fetch expense types for lookup |
| POST | `/api/get-udf-meta` | Resolve UDF Meta ID to externalId |

### FSM APIs Used

| API | Endpoint | Purpose |
|-----|----------|---------|
| **Data API v4** | `/api/data/v4/Activity` | Activity CRUD |
| **Data API v4** | `/api/data/v4/TimeTask` | Time task lookup |
| **Data API v4** | `/api/data/v4/ExpenseType` | Expense type lookup |
| **Query API v1** | `/api/query/v1` | TimeEffort, Material, Expense, Mileage, Item, UdfMeta, Person, BusinessPartner, Approval queries |
| **Service Management v2** | `/api/service-management/v2/composite-tree` | Service call with activities |
| **User API** | `/api/user` | User data lookup (for org level resolution) |
| **Org Level Service v1** | `/cloud-org-level-service/api/v1/levels` | Organization hierarchy |

### Key Files Explained:

#### **Backend:**

- **`index.js`** - Express server (~520 lines) that:
  - Handles web container context (POST/GET)
  - Serves static UI5 files from project root
  - Provides REST API endpoints for all data operations
  - Proxies requests to FSM API via BTP Destination Service

- **`FSMService.js`** - FSM API integration (~880 lines):
  - All FSM API calls (Data API, Query API, Service Management, Org Levels)
  - User organization level resolution flow
  - Authentication via Destination Service
  - Token caching for performance

- **`DestinationService.js`** - BTP Destination handling:
  - Reads VCAP_SERVICES for credentials
  - Fetches destination configuration from BTP

#### **Frontend:**

- **`View1_controller.js`** - Main controller (~400 lines):
  - Web container context handling
  - Initialization and lifecycle management
  - Mixin coordination

- **`DataLoadingMixin.js`** - Data loading logic (~530 lines):
  - Service call and activity fetching
  - User organization level resolution
  - Product group population
  - Lookup service coordination

- **`TMDialogMixin.js`** - T&M dialog handlers (~615 lines):
  - T&M Reports and Creation dialog event handling
  - Entry add/remove operations
  - Save and validation logic

- **`TMDialogService.js`** - T&M dialog management (~410 lines):
  - Opens/closes T&M Reports and Creation dialogs
  - Manages dialog models and data binding

- **`TMCreationService.js`** - T&M entry creation (~470 lines):
  - Entry templates for all T&M types
  - Type-specific field initialization

- **`TMPayloadService.js`** - T&M API payloads (~390 lines):
  - Builds FSM API request payloads
  - Handles UDF field mapping

#### **UI Fragments:**

- `WebContainerContext_fragment.xml` - Session info panel with organization display
- `ServiceCall_fragment.xml` - Service Order details panel
- `ProductGroups_fragment.xml` - Activity panels with T&M summary (~11KB)
- `TMReportsDialog_fragment.xml` - View existing T&M entries (~30KB)
- `TMCreateDialog_fragment.xml` - Create new T&M entries (~32KB)

---

## 💻 Development Guide

### Local Development
```bash
npm install
npm start
# App runs on http://localhost:3000
```

**Note:** Local development requires BTP Destination Service binding. For rapid UI iteration, use SAP Business Application Studio with port forwarding on port 3003.

### Web Container Context

The app receives context from FSM Mobile via POST request:
```javascript
// POST to /web-container-access-point
{
  "cloudId": "9D92E0B18FDC4A27A213401FEEA89FDA",  // Activity UUID
  "objectType": "ACTIVITY",
  "userName": "Max Mustermann",
  "cloudAccount": "company_account",
  "companyName": "Company Name",
  "language": "de"
}
```

### Adding a New Lookup Service

1. **Create frontend service** (`YourService.js` in project root):
```javascript
sap.ui.define([], () => {
    "use strict";
    return {
        _cache: new Map(),
        
        async fetchData() {
            const response = await fetch("/api/your-endpoint");
            const data = await response.json();
            data.items.forEach(item => {
                this._cache.set(item.id, item);
            });
        },
        
        getNameById(id) {
            const item = this._cache.get(id);
            return item ? item.name : id;
        }
    };
});
```

2. **Add backend method** (`FSMService.js`):
```javascript
async getYourData() {
    return this.makeRequest('/YourEntity', { dtos: 'YourEntity.version' });
}
```

3. **Add API endpoint** (`index.js`):
```javascript
app.get("/api/your-endpoint", async (req, res) => {
    const data = await FSMService.getYourData();
    res.json({ items: data });
});
```

4. **Import and load in DataLoadingMixin** (`DataLoadingMixin.js`):
```javascript
// Add to imports
"mobileappsc/YourService"

// Add to _loadLookupData method
await YourService.fetchData();
```

---

## 🐛 Troubleshooting

### View Logs
```bash
cf logs mobileappsc --recent
```

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| 404 on app load | Static file path wrong | Verify `express.static` points to correct folder |
| Session Context not showing | Not opened from FSM Mobile | Open via web container, not direct URL |
| Organization not resolved | User not assigned to org level in FSM | Verify user's Person record has orgLevelIds assigned |
| No activities shown | No EXECUTION/CLOSED activities or wrong org level | Check activity execution stages and org level assignments in FSM |
| T&M shows IDs instead of names | Lookup service not loaded | Check console for fetch errors |
| Dialog shows "No data" | API timeout | Refresh and try again |
| "Context not available" message | Web container context lost | Re-open app from FSM Mobile |
| Entry type buttons not showing | Service Product not matching filter rules | Verify Activity's Service Product externalId |
| Activity not highlighted | cloudId doesn't match any activity | Verify web container passes correct Activity ID |

### Debug Console Logs

The app logs detailed information to browser console:

**Data Loading:**
- `View1: Attempting to auto-resolve org level for user:` - Org level resolution start
- `View1: Auto-resolved org level:` - Successful org resolution
- `View1: Could not auto-resolve org level` - Org resolution failed
- `Loading full organizational hierarchy...` - Hierarchy fetch
- `Loading time tasks/items/expense types for lookup...` - Lookup data loading

**Services:**
- `ActivityService:` - Activity data operations
- `OrganizationService:` - Organization level lookups
- `TMDialogService:` - T&M dialog operations
- `TMCreationService:` - T&M entry creation
- `URLHelper:` - Web container context parsing

**Technician Selection:**
- `TechnicianSearch:` / `TechnicianLiveChange:` - Search input
- `TechnicianSelect:` / `TechnicianSuggestionSelect:` - Selection events

### Backend Logs

Server-side logs (visible via `cf logs`):
```
FSM WEB CONTAINER: POST Request Received    - Context from mobile
FSM WEB CONTAINER: Context requested        - Frontend fetching context
Backend: Sending enhanced T&M data          - T&M reports response
Backend: Loaded X persons                   - Person data loaded
Backend: Sending full organization levels   - Org hierarchy response
```

**Error patterns to watch for:**
- `Error fetching user org level:` - User/org resolution failed
- `Error fetching reported items:` - T&M data fetch failed
- `FSMService: Error fetching...` - FSM API call failed
- `Error fetching activities by service call:` - Composite tree failed

---

## 📝 Application Details

|                                    |                                                          |
|------------------------------------|----------------------------------------------------------|
| **App Name**                       | T&M Journal (FSM Mobile Integration)                     |
| **Module Name**                    | mobileappsc                                              |
| **Framework**                      | SAP UI5 (Fiori) + Node.js Express                        |
| **UI5 Theme**                      | sap_horizon                                              |
| **UI5 Version**                    | Latest (loaded from CDN)                                 |
| **Deployment Platform**            | SAP Business Technology Platform (Cloud Foundry)         |
| **Node.js Version**                | 18+                                                      |
| **npm Version**                    | 8+                                                       |

---

## 🚀 Current Status

### ✅ Implemented:
- Web container integration (receives context from FSM Mobile)
- Session Context panel (User, Account, Company, Organization)
- Service Order panel (expandable, collapsed by default)
- Organization level auto-resolution from logged-in user (userName → User API → Person → orgLevel)
- Activities grouped by Product Description
- Context activity highlighting (light blue SAP Fiori styling, auto-expanded)
- Activity panels with key fields (Address, Responsible, Org Level, Service Product)
- T&M Summary with type breakdown per activity
- T&M Reports Dialog with:
  - Activity details header (Planned Start/End, Duration, Quantity, UoM)
  - Expandable T&M Entry panels with multi-line headers
  - Human-readable headers (e.g., "T&M Entry - Mileage - Z40000008 - gefahrene Kilometer")
  - All T&M fields with resolved names (Technician, Task, Item, etc.)
  - Approval status display
  - Edit T&M Entry button
- T&M Creation Dialog with:
  - Entry type based on Service Product:
    - **Expense Report** - Z40000001, Z40000007, Z50000000
    - **Mileage Report** - Z40000038, Z40000008
    - **Time & Material Report** - All other Service Products
  - Dynamic entry panels with type-specific fields
  - Technician search with Input suggestions (4000+ records)
  - Task dropdown with category filtering (AZ, FZ, WZ)
  - Multi-step save workflow (Save → Send for Approval → Done)
- Lookup services for ID resolution (Person, Technician, Task, Item, ExpenseType, UdfMeta, Approval, Organization)
- Authentication via BTP Destination Service
- Responsive CSS with mobile-first design (3→2→1 column layout)

### 🔄 In Progress:
- T&M entry submission to FSM API (currently shows JSON preview)

### 📋 Planned:
- T&M entry editing (update existing entries)
- Offline support

---

## 🔐 Security Notes

- OAuth tokens cached in memory (not persisted)
- Destination credentials in VCAP_SERVICES (secure)
- Web container context stored in memory (cleared on restart)
- HTTPS only (enforced by Cloud Foundry)
- No sensitive data logged (auth tokens excluded from logs)

---

## 📄 License

Internal use only - Company proprietary.

---

**Last Updated:** December 2025