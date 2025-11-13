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

## 🎨 User Experience

### Progressive Disclosure UI Flow:

```
┌─────────────────────────────┐
│ 1. Initial Load             │
│ ┌─────────────────────────┐ │
│ │ Service Order Panel     │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ Organization Level      │ │
│ │ [Choose org level... ▼] │ │
│ │ ℹ Please select...      │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
          ⬇️ Select Organization
┌─────────────────────────────┐
│ 2. Organization Selected    │
│ ┌─────────────────────────┐ │
│ │ Service Order Panel     │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ Organization Level      │ │
│ │ [TUEV-NORD_S4E     ▼] │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ Activities - TUEV... (15)│ │
│ │ [Choose activity... ▼] │ │
│ │ ℹ Please select activity│ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
          ⬇️ Select Activity
┌─────────────────────────────┐
│ 3. Activity Selected        │
│ ┌─────────────────────────┐ │
│ │ Service Order Panel     │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ Organization Level      │ │
│ │ [TUEV-NORD_S4E     ▼] │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ Activities - TUEV... (15)│ │
│ │ [19709 - TEST APP #23▼] │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ Activity Selection      │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ Activity Details        │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

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
URL: https://de.fsm.cloud.sap/api/data/v4
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
- **FSM Event:** `ActivityCreatedEvent`

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
├── webapp/                          # Frontend (UI5 Fiori app)
│   ├── controller/
│   │   ├── App.controller.js        # Root controller
│   │   └── View1.controller.js      # Main controller (structured, enterprise-grade)
│   ├── view/
│   │   ├── App.view.xml             # Root view (router container)
│   │   ├── View1.view.xml           # Main view (progressive disclosure layout)
│   │   └── fragments/
│   │       ├── ServiceCall.fragment.xml         # Service call panel (always visible)
│   │       ├── OrganizationLevel.fragment.xml   # Organization dropdown (always visible)
│   │       ├── ActivitiesList.fragment.xml      # Activities dropdown (conditional)
│   │       ├── ActivitySelection.fragment.xml   # Activity selection (conditional)
│   │       └── ActivityDetails.fragment.xml     # Activity details (conditional)
│   ├── utils/
│   │   ├── formatter.js             # Data formatting utilities
│   │   ├── ActivityService.js       # Activity data management
│   │   ├── URLHelper.js             # URL parameter handling
│   │   └── OrganizationService.js   # Organization level management
│   ├── css/
│   │   └── style.css                # Custom styles
│   ├── index.html                   # App entry point
│   ├── manifest.json                # App descriptor (flexEnabled: true)
│   └── Component.js                 # UI5 Component (with mobile router fix)
│
├── index.js                         # Express server + FSM API integration
├── package.json                     # Node.js dependencies
├── manifest.yaml                    # Cloud Foundry deployment config
└── README.md                        # This file
```

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

### Backend Endpoints:

#### **GET /api/get-organizational-levels**

Fetch available organization levels.

**Response:**
```json
{
  "levels": [
    {
      "id": "6fcb305c-17dc-428a-8b7b-cad767938560",
      "name": "2130 - MPA Leuna GmbH",
      "shortDescription": "2130",
      "longDescription": "2130 - MPA Leuna GmbH"
    }
  ]
}
```

#### **POST /api/get-activity-by-id**

Fetch activity by ID.

**Request:**
```json
{
  "activityId": "9D92E0B18FDC4A27A213401FEEA89FDA"
}
```

**Response:**
```json
{
  "data": [{
    "activity": {
      "id": "9D92E0B18FDC4A27A213401FEEA89FDA",
      "code": "19687",
      "subject": "TEST APP #17",
      "status": "IN_PROGRESS",
      "type": "INSTALLATION"
    }
  }]
}
```

#### **POST /api/get-activities-by-service-call**

Fetch all activities for a service call.

**Request:**
```json
{
  "serviceCallId": "ABC123"
}
```

**Response:**
```json
{
  "activities": [...],
  "responsibles": [...]
}
```

---

## 💻 Development Guide

### Local Development

```bash
# Install dependencies
npm install

# Start local server
npm start

# App runs on http://localhost:3000
```

**Note:** Local development requires BTP Destination Service. Use `cf push` for testing.

### Testing in Browser

Open the app with test parameters:

```
http://localhost:3000/?activityId=YOUR_ACTIVITY_ID
```

The app will:
1. Show Service Order and Organization Level panels
2. Load organization levels automatically
3. Allow progressive navigation through organization → activities → details

### Making Changes

#### 1. **Add a new panel to the progressive disclosure:**

Edit `webapp/view/View1.view.xml` and add to the conditional containers:

```xml
<VBox id="yourNewPanelContainer" visible="{view>/yourCondition}" width="100%">
    <core:Fragment fragmentName="mobileappsc.view.fragments.YourPanel" type="XML" />
</VBox>
```

#### 2. **Add a new dropdown service:**

Create `webapp/utils/YourService.js`:

```javascript
sap.ui.define([], () => {
    "use strict";
    return {
        async fetchYourData() {
            const response = await fetch("/api/your-endpoint");
            return response.json();
        },
        transformForDropdown(data) {
            return data.map(item => ({
                key: item.id,
                text: item.name
            }));
        }
    };
});
```

#### 3. **Add controller methods following the established pattern:**

```javascript
/* ========================================
 * YOUR FEATURE MANAGEMENT
 * ======================================== */

async _loadYourData() {
    // Follow the pattern from _loadOrganizationLevels()
},

_populateYourComboBox(items) {
    // Follow the pattern from _populateOrganizationLevelComboBox()
},

async onYourSelectionChange(oEvent) {
    // Follow the pattern from onOrganizationLevelChange()
}
```

---

## 🐛 Troubleshooting

### Issue: Organization dropdown not populating

**Cause:** FSM API credentials or organizational levels API failure.

**Solution:** Check logs and verify FSM_S4E destination configuration.

### Issue: Activities dropdown shows no items

**Cause:** No activities found for the service call or organization filter.

**Solution:** Verify the service call has activities in FSM.

### Issue: Panels not showing after selection

**Cause:** Model binding issue or conditional visibility not updating.

**Solution:** Check browser console for binding errors. Verify model properties are set correctly.

### Issue: Dropdown selection gets corrupted

**Cause:** ComboBox items binding conflict.

**Solution:** Already handled with manual item population and restoration logic.

### View Logs:

```bash
cf logs mobileappsc --recent
```

---

## 🔐 Security Notes

- OAuth tokens are **cached in memory** (not persisted)
- Destination credentials stored in **VCAP_SERVICES** (secure)
- **No sensitive data** logged to console (production-clean)
- App uses **HTTPS only** (enforced by Cloud Foundry)
- Unique IDs enforced for **flexEnabled** compliance

---

## 📝 Application Details

|                                    |                                                          |
|------------------------------------|----------------------------------------------------------|
| **App Name**                       | FSM Mobile Integration                                   |
| **Module Name**                    | mobileappsc                                              |
| **Framework**                      | SAP UI5 (Fiori) + Node.js Express                        |
| **UI Design Pattern**              | Progressive Disclosure                                   |
| **UI5 Theme**                      | sap_horizon                                              |
| **UI5 Version**                    | Latest (loaded from CDN)                                 |
| **Deployment Platform**            | SAP Business Technology Platform (Cloud Foundry)         |
| **Development Platform**           | SAP Business Application Studio                          |
| **Code Quality**                   | Enterprise-grade, structured, production-ready          |

---

## 🚀 Current Features

### ✅ **Implemented:**
- Progressive disclosure UI (Organization → Activities → Details)
- Organization level selection with FSM API integration
- Activity dropdown with filtering by service call
- Conditional panel visibility based on user selections
- Clean, structured controller with enterprise coding standards
- Production-ready error handling and user feedback
- Mobile-optimized responsive design
- Dropdown corruption prevention with manual item management

### 🔄 **In Development:**
- Activity Selection panel functionality
- Activity Details panel enhancements

### 📋 **Planned:**
- Service confirmation creation
- Materials tracking
- Time entry logging
- Expense tracking

---

## 📞 Support

For issues or questions:
1. Check logs: `cf logs mobileappsc --recent`
2. Verify BTP Destination configuration
3. Test progressive disclosure flow: Organization → Activities → Details
4. Check browser console for model binding issues
5. Contact your SAP BTP administrator

---

## 📄 License

Internal use only - Company proprietary.

---

**Last Updated:** November 2025