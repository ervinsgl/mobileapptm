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

This application provides a mobile-optimized interface for viewing and managing FSM activities with organizational level filtering. It integrates seamlessly with FSM Mobile through External Apps and Workflows.

**Key Features:**
- ✅ Progressive disclosure UI (Organization → Activities → Details)
- ✅ Organization level selection dropdown
- ✅ Activity selection dropdown with filtering
- ✅ Auto-loads activity data from FSM Mobile context
- ✅ Displays activity details and service call information
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
│   FSM Mobile    │  (Opens External App with activityId)
└────────┬────────┘
         │ URL: https://app.cfapps.../activityId=123
         ▼
┌─────────────────┐
│  SAP BTP (CF)   │  (Cloud Foundry App)
│  ┌───────────┐  │
│  │ UI5 App   │  │  (Frontend - Progressive UI)
│  │ (webapp/) │  │  1. Organization Level Selection
│  │           │  │  2. Activity Selection  
│  │           │  │  3. Activity Details
│  └─────┬─────┘  │
│        │         │
│  ┌─────▼─────┐  │
│  │ Express   │  │  (Backend - index.js)
│  │ Server    │  │
│  └─────┬─────┘  │
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
│                 │  - Activities by Service Call
│                 │  - Activity Details
└─────────────────┘
```

---

## ✨ Features

### UI Components

| Component | Description |
|-----------|-------------|
| **Service Order Panel** | Expandable panel showing Service Order details (ID, External ID, Subject, Business Partner, Responsible, Dates) |
| **Organization Level** | Dropdown to select organizational level for filtering |
| **Product Groups** | Activities grouped by Product Description and SO Item ID |
| **Activity Cards** | Card view with Address, Responsible, Org Level, Service Product |
| **T&M Summary Box** | Shows count of Time Effort, Material, Expense, Mileage reports |
| **T&M Reports Dialog** | Detailed view of all T&M entries with expandable panels |

### Lookup Services

The app resolves FSM IDs to human-readable names:

| Service | Resolves | Example |
|---------|----------|---------|
| **TimeTaskService** | Task ID → Name | `3010642C...` → `AZ - Arbeitszeit` |
| **ItemService** | Item ID/ExternalId → Name | `MATNR001` → `MATNR001 - Schrauben M8` |
| **ExpenseTypeService** | Expense Type ID → Name | `6DC882E6...` → `Z40000039 - Aktivierungs-/Einsatzpauschale` |
| **UdfMetaService** | UDF Meta ID → ExternalId | `EB1C5C15...` → `Z_Mileage_MatID` |

### T&M Report Types

| Type | Key Fields |
|------|------------|
| **Time Effort** | Duration, Start/End, Task, Charge Option, UDF Values |
| **Material** | Quantity, Item, Date, Remarks |
| **Expense** | External/Internal Amount, Expense Type, Date |
| **Mileage** | Distance, Route, Mileage Type, Driver, Private Car |

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

### 6. Create FSM User Defined Field (UDF)

#### 6.1 Create Custom Field Definition
Navigate to: **FSM Admin → Company → Custom Objects → Custom Field Definitions**

1. **Click "Create" and configure:**
   - **Name:** `Z_externalAppLink`
   - **External ID:** `Z_externalAppLink`
   - **Description:** `Service Confirmation App`
   - **Object Type:** `Activity`
   - **Type:** `String`
   - **Classification Level:** `INTERNAL`
   - **Mandatory:** Unchecked
   - **Preserved:** Checked (to retain data during sync)

2. **Click "Save"**

#### 6.2 Add UDF to Mobile Screen Configuration
Navigate to: **FSM Admin → Companies → [Your Company] → Screen Configurations**

1. **Select:** `Activity Mobile` (or your custom activity screen)
2. **Click the pencil icon** to edit
3. **In the Fields section:**
   - Find or drag `udfMeta.Z_externalAppLink` to desired position
4. **Configure field settings (Basic settings tab):**
   - **Label/Translation:** `Service Confirmation App` (or your preferred label)
   - **Description:** `Service Confirmation App`
   - **Name:** `Z_externalAppLink`
   - **Default value:** `Default` (leave empty)
5. **Configure Advanced settings:**
   - **Visible expression:** Leave empty (always visible) or add condition
   - **Editable expression:** `false` (read-only, populated by Business Rule)
   - **Required expression:** Leave empty (not mandatory)
6. **Click "Save"**

> **Note:** The UDF will display as plain text with the full URL. SAP FSM mobile does not support clickable hyperlinks with custom text in UDF fields.

---

### 7. Configure FSM Business Rule

Navigate to: **FSM Admin → Company → Business Rules → Create**

#### 7.1 Business Rule Header Configuration
1. **Create new Business Rule:**
   - **Code:** `Z_GenerateExternalAppLink` (use your naming convention)
   - **Name:** `Generate External App Link (10.112025)`
   - **Type:** `Three - new transaction behavior of business rule actions`
   - **Enabled:** ✓ Checked
   - **Technical Contact:** `[your-email@company.com]`

#### 7.2 Trigger Configuration
**Trigger on:**
- **Event:** `FSM Event`
- **FSM Event:** `ActivityCreatedEvent`, `ActivityReleasedEvent`

**Variables:**
| Variable Name | Variable Type | Object      | Object Version | CoreSQL WHERE Clause |
|--------------|---------------|-------------|----------------|---------------------|
| fsmEvent     | Object        | -           | -              | -                   |
| activity     | Object        | Activity    | 43             | `activity.id=${fsmEvent.activityId}` |
| servicecall  | Object        | ServiceCall | 27             | `servicecall.id=${activity.object.objectId}` |

**Conditions:**
```
${servicecall.typeName} == 'External App Testing'
```
> This ensures the BR only triggers for specific service call types

#### 7.3 Execute Action Configuration
**Action #1: Update Object**
- **Action:** `Update Object`
- **Execution Count:** `1`
- **Object Id:** `${activity.id}`
- **Object Type:** `Activity`
- **Soft Update:** Unchecked

**Fields to Update:**

| Name | Value |
|------|-------|
| udf_Z_externalAppLink | `${"https://mobileappsc-delightful-tiger-mv.cfapps.eu10.hana.ondemand.com/?activityId=" + activity.id}` |

> **Alternative with additional parameters:**
> ```
> ${"https://mobileappsc-delightful-tiger-mv.cfapps.eu10.hana.ondemand.com/?activityId=" + activity.id + "Service Confirmation App[/xurl]"}
> ```

#### 7.4 Save and Validate
1. **Click "Save"**
2. **Click "Validate"** to check for syntax errors
3. **Click "Execute"** to test with existing activity (optional)

---

### 7.5 Expected Result

**On Activity Creation:**
- When a new Activity is created with Service Call type = "External App Testing"
- The Business Rule automatically populates `udf_Z_externalAppLink`
- The UDF contains: `https://mobileappsc-delightful-tiger-mv.cfapps.eu10.hana.ondemand.com/?activityId=A98EA0FBFAB24F13B663A0EFB39A0DE5`

**On Activity Released:**
- When a new Activity is released with Service Call type = "External App Testing"
- The Business Rule automatically populates `udf_Z_externalAppLink`
- The UDF contains: `https://mobileappsc-delightful-tiger-mv.cfapps.eu10.hana.ondemand.com/?activityId=A98EA0FBFAB24F13B663A0EFB39A0DE5`

**On FSM Mobile:**
- Technician opens the Activity
- Sees field labeled "Service Confirmation App"
- Field displays the full URL (not clickable with custom text)
- Technician must copy/paste URL or long-press to open

---

### 7.6 Limitations & Workarounds

**Current Limitation:**
SAP FSM UDF fields of type "String" display as plain text only. BB Code formats like `[xurl=URL]text[/xurl]` and HTML anchor tags `<a href="">` are **not supported** in mobile UDF fields.

**Alternative Solutions:**

1. **Service Workflow with External App Launch:**
   - Navigate to: Admin → Company → Service Workflow
   - Add workflow step with "Launch External App" action
   - Configure custom button text and URL with activity parameters

2. **HTML Report with Clickable Link:**
   - Use Business Rule action "Build HTML Report"
   - Create HTML template with proper anchor tag: `<a href="${activity.udfMeta.Z_externalAppLink}">Open Service Confirmation</a>`
   - Attach report to activity

3. **Email Notification:**
   - Use Business Rule action "Send Email"
   - Include HTML formatted link in email body
   - Technician receives notification with clickable link

4. **URL Shortener:**
   - Use bit.ly or similar service
   - Store shortened URL in UDF for better readability

---

## 🔄 How It Works

### User Flow:

1. **Technician opens FSM Mobile** → Navigates to an Activity
2. **Clicks "External App" button** → FSM Mobile opens the app in Chrome Custom Tabs
3. **App loads with Service Order panel** → Shows basic service call information
4. **Organization levels load** → Dropdown populated from FSM API
5. **User selects organization** → Activities dropdown appears with filtered activities
6. **User selects activity** → Activity Selection and Activity Details panels appear
7. **User can refresh** → Resets to initial state, reloads all data

### URL Parameters:

The app receives context from FSM Mobile via URL:

```
https://app.cfapps.eu10.../
  ?activityId=9D92E0B18FDC4A27A213401FEEA89FDA    # Activity UUID
```

### Authentication Flow:

```
1. App starts → Reads VCAP_SERVICES for Destination credentials
2. Gets OAuth token → Calls BTP Destination Service
3. Retrieves FSM destination → Gets FSM API URL + credentials
4. Gets FSM OAuth token → Authenticates with FSM
5. Makes API call → Fetches organization levels and activity data
6. Token cached → Reused for 55 minutes (with 5min buffer)
```

---

## 📁 Project Structure

```
mobileappsc/
├── webapp/                              # Frontend (UI5 Fiori app)
│   ├── controller/
│   │   ├── App.controller.js            # Root controller
│   │   └── View1.controller.js          # Main controller (924 lines)
│   ├── view/
│   │   ├── App.view.xml                 # Root view
│   │   ├── View1.view.xml               # Main view
│   │   └── fragments/
│   │       ├── ServiceCall.fragment.xml         # Service Order panel (expandable)
│   │       ├── OrganizationLevel.fragment.xml   # Organization dropdown
│   │       ├── ProductGroups.fragment.xml       # Activity cards grouped by product
│   │       └── TMReportsDialog.fragment.xml     # T&M Reports dialog
│   ├── utils/
│   │   ├── formatter.js                 # Date/number formatting
│   │   ├── ActivityService.js           # Activity data management
│   │   ├── ServiceOrderService.js       # Service order/composite tree
│   │   ├── ProductGroupService.js       # Activity grouping by product
│   │   ├── OrganizationService.js       # Organization level management
│   │   ├── ReportedItemsData.js         # T&M data fetching
│   │   ├── TimeTaskService.js           # Time task ID lookup
│   │   ├── ItemService.js               # Item ID/ExternalId lookup
│   │   ├── ExpenseTypeService.js        # Expense type ID lookup
│   │   ├── UdfMetaService.js            # UDF Meta ID lookup
│   │   └── URLHelper.js                 # URL parameter handling
│   ├── css/
│   │   └── style.css                    # Custom styles (10KB)
│   ├── index.html                       # App entry point
│   ├── manifest.json                    # App descriptor
│   └── Component.js                     # UI5 Component
│
├── utils/                               # Backend utilities
│   ├── FSMService.js                    # FSM API integration (27KB)
│   ├── DestinationService.js            # BTP Destination handling
│   └── TokenCache.js                    # OAuth token caching
│
├── index.js                             # Express server (288 lines)
├── package.json                         # Node.js dependencies
├── manifest.yaml                        # Cloud Foundry deployment
└── README.md                            # This file
```

---

## 🔌 API Reference

### Backend Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/get-organizational-levels` | Fetch organization levels |
| POST | `/api/get-activity-by-id` | Fetch activity by ID |
| POST | `/api/get-activity-by-code` | Fetch activity by code |
| POST | `/api/get-activities-by-service-call` | Fetch composite tree for service call |
| PUT | `/api/update-activity` | Update activity |
| POST | `/api/get-reported-items` | Fetch T&M reports for activity |
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
| **Query API v1** | `/api/query/v1` | TimeEffort, Material, Expense, Mileage, Item, UdfMeta queries |
| **Service Management v2** | `/api/service-management/v2/composite-tree` | Service call with activities |
| **Org Level Service v1** | `/cloud-org-level-service/api/v1/levels` | Organization hierarchy |

### Key Files Explained:

#### **Backend:**

- **`index.js`** - Express server that:
  - Serves static UI5 files
  - Provides REST API endpoints for activities and organization levels
  - Handles FSM API authentication via BTP Destination Service
  - Caches OAuth tokens for performance

#### **Frontend:**

- **`webapp/controller/View1.controller.js`** - Main controller (enterprise-grade):
  - Structured with clear sections (Lifecycle, Model, Organization, Activity, etc.)
  - Manages progressive disclosure state
  - Handles dropdown population and selection events
  - Clean error handling and user feedback

- **`webapp/utils/OrganizationService.js`** - Organization management:
  - Fetches organizational levels from FSM API
  - Transforms data for dropdown display
  - Handles duplicate detection

- **`webapp/view/View1.view.xml`** - Main view with conditional panels:
  - Uses VBox containers for conditional visibility
  - Progressive disclosure UI pattern
  - Responsive design for mobile

---

## 🔌 API Reference

### Backend Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/get-organizational-levels` | Fetch organization levels |
| POST | `/api/get-activity-by-id` | Fetch activity by ID |
| POST | `/api/get-activity-by-code` | Fetch activity by code |
| POST | `/api/get-activities-by-service-call` | Fetch composite tree for service call |
| PUT | `/api/update-activity` | Update activity |
| POST | `/api/get-reported-items` | Fetch T&M reports for activity |
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
| **Query API v1** | `/api/query/v1` | TimeEffort, Material, Expense, Mileage, Item, UdfMeta queries |
| **Service Management v2** | `/api/service-management/v2/composite-tree` | Service call with activities |
| **Org Level Service v1** | `/cloud-org-level-service/api/v1/levels` | Organization hierarchy |

---

## 💻 Development Guide

### Local Development

```bash
npm install
npm start
# App runs on http://localhost:3000
```

**Note:** Local development requires BTP Destination Service binding. Use `cf push` for full testing.

### URL Parameters

The app receives context from FSM Mobile via URL:

```
https://app.cfapps.eu10.../
  ?activityId=9D92E0B18FDC4A27A213401FEEA89FDA
```

### Adding a New Lookup Service

1. **Create frontend service** (`webapp/utils/YourService.js`):
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

4. **Import and load in controller** (`View1.controller.js`):
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
| Empty organization dropdown | FSM API credentials invalid | Verify FSM_S4E destination |
| No activities shown | No EXECUTION/CLOSED activities | Check activity execution stages |
| T&M shows IDs instead of names | Lookup service not loaded | Check console for fetch errors |
| Dialog shows "No data" | API timeout | Refresh and try again |

### Debug Console Logs

The app logs detailed information to browser console:
- `SERVICE ORDER:` - Service call data
- `PRODUCT GROUP:` - Activity grouping
- `ReportedItemsData:` - T&M fetching
- `Backend:` - Server-side operations

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
- Service Order panel (expandable, collapsed by default)
- Organization level selection
- Activities grouped by Product Description
- Activity cards with key fields (Address, Responsible, Org Level, Service Product)
- T&M Summary with type breakdown
- T&M Reports Dialog with:
  - Activity details header (Planned Start/End, Duration, Quantity, UoM)
  - Expandable T&M Entry panels
  - Human-readable headers (e.g., "T&M Entry - Mileage - Z40000008 - gefahrene Kilometer")
  - All T&M fields with resolved names
- Lookup services for ID resolution

### 📋 Planned:
- T&M report creation

---

## 🔐 Security Notes

- OAuth tokens cached in memory (not persisted)
- Destination credentials in VCAP_SERVICES (secure)
- HTTPS only (enforced by Cloud Foundry)
- No sensitive data logged

---

## 📄 License

Internal use only - Company proprietary.

---

**Last Updated:** November 2025