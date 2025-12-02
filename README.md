# FSM Mobile Integration App

A SAP Fiori mobile application for SAP Field Service Management (FSM), designed to be opened from FSM Mobile as an External App or Workflow. Features progressive disclosure UI with organization level selection and activity management.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Setup & Deployment](#setup--deployment)
- [How It Works](#how-it-works)
- [Project Structure](#project-structure)
- [Development Guide](#development-guide)
- [API Reference](#api-reference)
- [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

This application provides a mobile-optimized interface for viewing and managing FSM activities with T&M (Time & Materials) reporting. It integrates seamlessly with FSM Mobile through Web Container integration.

**Key Features:**
- ✅ Progressive disclosure UI (Service Order → Product Groups → Activities → T&M Reports)
- ✅ Organization level selection dropdown
- ✅ Activities grouped by Product Description
- ✅ Auto-loads activity data from FSM Mobile web container context
- ✅ T&M Reports viewing and creation (Time Effort, Material, Expense, Mileage)
- ✅ Session context display (User, Account, Company)
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
│  │ (webapp/) │  │  1. Service Order Panel
│  │           │  │  2. Organization Level Selection
│  │           │  │  3. Product Groups → Activities
│  │           │  │  4. T&M Reports Dialog
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
│                 │  - Organization Levels
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
| **Session Context Panel** | Shows connection status, User, Account, Company, Language (visible when opened from FSM Mobile) |
| **Service Order Panel** | Expandable panel showing Service Order details (ID, External ID, Subject, Business Partner, Responsible, Dates) |
| **Organization Level** | Dropdown to select organizational level for filtering |
| **Product Groups** | Activities grouped by Product Description and SO Item ID |
| **Activity Panels** | Expandable panels with Address, Responsible, Org Level, Service Product, T&M Summary |
| **T&M Summary** | Shows count of Time Effort, Material, Expense, Mileage reports per activity |
| **T&M Reports Dialog** | Detailed view of all T&M entries with expandable panels and Edit/Approval buttons |
| **T&M Creation Dialog** | Create new T&M entries (Time Effort, Material, Expense, Mileage) |

### Lookup Services

The app resolves FSM IDs to human-readable names:

| Service | Resolves | Example |
|---------|----------|---------|
| **PersonService** | Person ID/ExternalId → Name | `A1B2C3D4...` → `Max Mustermann (ZZ00094912)` |
| **TimeTaskService** | Task ID → Name | `3010642C...` → `AZ - Arbeitszeit` |
| **ItemService** | Item ID/ExternalId → Name | `MATNR001` → `MATNR001 - Schrauben M8` |
| **ExpenseTypeService** | Expense Type ID → Name | `6DC882E6...` → `Z40000039 - Aktivierungs-/Einsatzpauschale` |
| **UdfMetaService** | UDF Meta ID → ExternalId | `EB1C5C15...` → `Z_Mileage_MatID` |
| **OrganizationService** | Org Level ID → Name | `2B6F7485...` → `2130_MPA_TEAM1` |
| **BusinessPartnerService** | BP ExternalId → Name | `55003748` → `Company Name (55003748)` |
| **ApprovalService** | Object ID → Decision Status | `F1E2D3C4...` → `Approved` |

### T&M Report Types

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
2. **npm** - Version 9+
3. **Cloud Foundry CLI** - `cf` command line tool
4. **SAP BTP Account** - Cloud Foundry space with quota
5. **FSM Instance** - Access to SAP Field Service Management

### SAP BTP Services:
- **Destination Service** - Bound to the application
- **Destination Configuration** - FSM_S4E destination configured
---

## 🚀 Setup & Deployment

### 1. Clone & Install
```bash
git clone 
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
  account: tuev-nord_t1
  company: TUEV-NORD_S4E
  URL.headers.X-Account-ID: 94854
  URL.headers.X-Company-ID: 109220
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
   - **Name:** `Service Confirmation App`
   - **External ID:** `Z_ServiceConfirmationApp`
   - **URL:** `https://mobileappsc-xxx.cfapps.eu10.hana.ondemand.com`
   - **Object Types:** `Activity` (select the object types this app handles)
   - **Active:** ✓ Checked

2. **Click "Save"**

#### 6.2 Web Container Context
When opened from FSM Mobile, the web container automatically POSTs context data:
- `cloudId` - The Activity ID (used to load the correct activity)
- `objectType` - The object type (e.g., "ACTIVITY")
- `userName` - Current user's name
- `cloudAccount` - FSM account name
- `companyName` - FSM company name
- `language` - User's language preference

#### 6.3 Add to Mobile Screen Configuration
Navigate to: **FSM Admin → Companies → [Your Company] → Screen Configurations**

1. **Select:** `Activity Mobile` (or your custom activity screen)
2. **Click the pencil icon** to edit
3. **Add Web Container button** to the activity screen
4. **Configure button settings:**
   - **Label:** `Service Confirmation`
   - **Web Container:** Select `Z_ServiceConfirmationApp`
5. **Click "Save"**

---

### 7. Expected Result

**On FSM Mobile:**
- Technician opens an Activity
- Sees "Service Confirmation" button
- Taps the button → Web Container opens the app
- App automatically loads the activity data via `cloudId`
- Session Context panel shows user/account/company info

---

## 🔄 How It Works

### User Flow:

1. **Technician opens FSM Mobile** → Navigates to an Activity
2. **Taps "Service Confirmation" button** → FSM Mobile opens web container
3. **Web container POSTs context** → App receives cloudId, userName, account, company
4. **App loads activity data** → Uses cloudId to fetch activity and service call
5. **Session Context panel appears** → Shows user/account/company info
6. **Service Order panel loads** → Shows service call details (collapsed by default)
7. **Organization levels load** → Dropdown populated from FSM API
8. **User selects organization** → Product Groups appear with activities
9. **User expands activity** → Views activity details and T&M summary
10. **User views/creates T&M** → Opens T&M Reports or Creation dialog

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
7. Makes API calls → Fetches activity, service call, T&M data
8. Token cached → Reused for 55 minutes (with 5min buffer)
```

---

## 📁 Project Structure
```
mobileappsc/
├── controller/
│   ├── App.controller.js                # Root controller
│   └── View1.controller.js              # Main controller (~1560 lines)
│
├── view/
│   ├── App.view.xml                     # Root view
│   ├── View1.view.xml                   # Main view
│   └── fragments/
│       ├── WebContainerContext.fragment.xml  # Session Context panel
│       ├── ServiceCall.fragment.xml          # Service Order panel
│       ├── OrganizationLevel.fragment.xml    # Organization dropdown
│       ├── ProductGroups.fragment.xml        # Activity panels by product
│       ├── TMReportsDialog.fragment.xml      # T&M Reports dialog (35KB)
│       └── TMCreateDialog.fragment.xml       # T&M Creation dialog (56KB)
│
├── utils/                               # Frontend services
│   ├── formatter.js                     # Date/number formatting
│   ├── URLHelper.js                     # Web container context handling
│   ├── ActivityService.js               # Activity data management
│   ├── ServiceOrderService.js           # Service order/composite tree
│   ├── ProductGroupService.js           # Activity grouping by product
│   ├── OrganizationService.js           # Organization level management
│   ├── PersonService.js                 # Person ID/name lookup
│   ├── BusinessPartnerService.js        # Business partner lookup
│   ├── TimeTaskService.js               # Time task ID lookup
│   ├── ItemService.js                   # Item ID/ExternalId lookup
│   ├── ExpenseTypeService.js            # Expense type ID lookup
│   ├── UdfMetaService.js                # UDF Meta ID lookup
│   ├── ApprovalService.js               # Approval status lookup
│   ├── ReportedItemsData.js             # T&M data fetching
│   ├── TMDataService.js                 # T&M data management
│   ├── TMDialogService.js               # T&M dialog management (18KB)
│   ├── TMCreationService.js             # T&M entry creation (16KB)
│   ├── TMEditService.js                 # T&M entry editing
│   ├── DestinationService.js            # BTP Destination handling
│   ├── FSMService.js                    # FSM API integration (~920 lines)
│   └── TokenCache.js                    # OAuth token caching
│
├── model/
│   └── models.js                        # Device model
│
├── css/
│   └── style.css                        # Custom styles (15KB)
│
├── index.html                           # App entry point
├── manifest.json                        # UI5 app descriptor
├── Component.js                         # UI5 Component
│
├── index.js                             # Express server (~490 lines)
├── package.json                         # Node.js dependencies
├── manifest.yaml                        # Cloud Foundry deployment
└── README.md                            # This file
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

#### Organization
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/get-organizational-levels` | Fetch organization levels (dropdown) |
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
| **Org Level Service v1** | `/cloud-org-level-service/api/v1/levels` | Organization hierarchy |

### Key Files Explained:

#### **Backend:**

- **`index.js`** - Express server (~490 lines) that:
  - Handles web container context (POST/GET)
  - Serves static UI5 files from project root
  - Provides REST API endpoints for all data operations
  - Proxies requests to FSM API via BTP Destination Service

- **`utils/FSMService.js`** - FSM API integration (~920 lines):
  - All FSM API calls (Data API, Query API, Service Management, Org Levels)
  - Authentication via Destination Service
  - Token caching for performance

- **`utils/DestinationService.js`** - BTP Destination handling:
  - Reads VCAP_SERVICES for credentials
  - Fetches destination configuration from BTP

#### **Frontend:**

- **`controller/View1.controller.js`** - Main controller (~1560 lines):
  - Web container context handling
  - Progressive disclosure state management
  - T&M Reports and Creation dialog orchestration
  - Lookup service coordination

- **`utils/TMDialogService.js`** - T&M dialog management (18KB):
  - Opens/closes T&M Reports and Creation dialogs
  - Manages dialog models and data binding

- **`utils/TMCreationService.js`** - T&M entry creation (16KB):
  - Entry templates for all T&M types
  - Validation and save logic

- **`view/fragments/`** - UI fragments:
  - `WebContainerContext.fragment.xml` - Session info panel
  - `ProductGroups.fragment.xml` - Activity panels with T&M summary
  - `TMReportsDialog.fragment.xml` - View existing T&M entries
  - `TMCreateDialog.fragment.xml` - Create new T&M entries

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

1. **Create frontend service** (`utils/YourService.js`):
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

2. **Add backend method** (`utils/FSMService.js`):
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

4. **Import and load in controller** (`controller/View1.controller.js`):
```javascript
// Add to imports
"mobileappsc/utils/YourService"

// Add to onInit
this._loadYourData();
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
| Empty organization dropdown | FSM API credentials invalid | Verify FSM_S4E destination configuration |
| No activities shown | No EXECUTION/CLOSED activities | Check activity execution stages in FSM |
| T&M shows IDs instead of names | Lookup service not loaded | Check console for fetch errors |
| Dialog shows "No data" | API timeout | Refresh and try again |
| "Context not available" message | Web container context lost | Re-open app from FSM Mobile |

### Debug Console Logs

The app logs detailed information to browser console:
- `FSM WEB CONTAINER:` - Web container context received
- `SERVICE ORDER:` - Service call data
- `PRODUCT GROUP:` - Activity grouping
- `PersonService:` - Person/technician lookups
- `ReportedItemsData:` - T&M fetching
- `TMDialogService:` - Dialog operations
- `Backend:` - Server-side operations

### Backend Logs

Server-side logs (visible via `cf logs`):
- `FSM WEB CONTAINER: POST Request Received` - Context from mobile
- `FSM WEB CONTAINER: Context requested` - Frontend fetching context
- `FSMService:` - API calls to FSM
- `Backend:` - Data processing and responses

---

## 📝 Application Details

|                                    |                                                          |
|------------------------------------|----------------------------------------------------------|
| **App Name**                       | FSM Mobile Integration - Service Confirmation            |
| **Module Name**                    | mobileappsc                                              |
| **Framework**                      | SAP UI5 (Fiori) + Node.js Express                        |
| **UI5 Theme**                      | sap_horizon                                              |
| **UI5 Version**                    | Latest (loaded from CDN)                                 |
| **Deployment Platform**            | SAP Business Technology Platform (Cloud Foundry)         |
| **Node.js Version**                | 18+                                                      |

---

## 🚀 Current Status

### ✅ Implemented:
- Web container integration (receives context from FSM Mobile)
- Session Context panel (User, Account, Company, Language)
- Service Order panel (expandable, collapsed by default)
- Organization level selection
- Activities grouped by Product Description
- Activity panels with key fields (Address, Responsible, Org Level, Service Product)
- T&M Summary with type breakdown per activity
- T&M Reports Dialog with:
  - Activity details header (Planned Start/End, Duration, Quantity, UoM)
  - Expandable T&M Entry panels
  - Human-readable headers (e.g., "T&M Entry - Mileage - Z40000008 - gefahrene Kilometer")
  - All T&M fields with resolved names (Technician, Task, Item, etc.)
  - Approval status display
  - Edit T&M Entry button
- T&M Creation Dialog with:
  - Entry type selection (Time Effort, Material, Expense, Mileage)
  - Dynamic entry panels with type-specific fields
  - Technician search with suggestions (4000+ records)
  - Task dropdown with category filtering (AZ, FZ, WZ)
  - Save and Send for Approval workflow
- Lookup services for ID resolution (Person, Task, Item, ExpenseType, UdfMeta, Approval)
- Authentication via BTP Destination Service

### 🔄 In Progress:
- T&M entry submission to FSM API

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