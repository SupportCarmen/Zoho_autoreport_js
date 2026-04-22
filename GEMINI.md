# Zoho Discord Reporter

A Node.js automation tool that captures Zoho Desk dashboards, downloads reports, processes them into a master Excel file with PivotTables, and sends the results to a Discord channel via Webhook.

## Project Overview

*   **Purpose:** Automate daily reporting from Zoho Desk to Discord.
*   **Technologies:**
    *   **Node.js**: Core runtime.
    *   **Playwright**: Web automation and dashboard screenshots.
    *   **SheetJS (xlsx)**: Basic Excel file manipulation.
    *   **VBScript + Microsoft Excel**: Used for advanced Excel features (PivotTables) not easily handled by Node.js libraries.
    *   **Axios & Discord Webhooks**: For sending notifications and files to Discord.
*   **Architecture:**
    *   `index.js`: Main entry point and orchestration logic.
    *   `config.js`: Centralized configuration (URLs, folders, reports).
    *   `excel.js`: Data cleaning, merging, and PivotTable generation via VBScript.
    *   `discord.js`: Discord notification logic.
    *   `session.json`: Stores Zoho session state to minimize login attempts.

## Workflow

1.  **Authentication:** Logs into Zoho Desk (or uses a saved session from `session.json`).
2.  **Dashboard Capture:** Navigates to a specific dashboard URL and takes 4 screenshots at different scroll points.
3.  **Report Retrieval:** Downloads "OpenAll" and "TicketToday" reports in XLS format.
4.  **Excel Processing:**
    *   Cleans raw data (removes headers/footers).
    *   Merges data into a single workbook.
    *   Generates 4 PivotTables in a new sheet using a temporary VBScript executed via `cscript`.
5.  **Notification:** Uploads screenshots and the final Excel report to Discord.

## Building and Running

### Prerequisites
*   **Node.js**: Installed on the system.
*   **Microsoft Excel**: **Mandatory** on the host machine (Windows) for PivotTable generation.
*   **Chromium**: Required by Playwright.

### Setup
1.  **Install dependencies:**
    ```bash
    npm install
    ```
2.  **Install Playwright browser:**
    ```bash
    npx playwright install chromium
    ```
3.  **Environment Variables:** Create a `.env` file in the root directory:
    ```env
    ZOHO_EMAIL=your_email@example.com
    ZOHO_PASSWORD=your_password
    ```
4.  **Discord Webhook:** The webhook URL is currently hardcoded in `config.js`. Update it there if necessary.

### Execution
Run the reporter:
```bash
npm start
```

## Development Conventions

*   **Timezone:** All timestamps are formatted for `Asia/Bangkok`.
*   **File Storage:**
    *   Screenshots: `~/Downloads/captureReport`
    *   Raw Reports: `~/Downloads/report`
    *   Master Files: `~/Downloads/All`
*   **Excel Manipulation:** Standard data cleaning is done in Node.js, but any visual or structural changes (like PivotTables) are delegated to VBScript to leverage native Excel capabilities.
*   **Session Management:** Uses Playwright's `storageState` to persist login cookies for 24 hours.

## Key Files

*   `index.js`: Orchestrates the entire process.
*   `config.js`: Contains URLs and file path configurations.
*   `excel.js`: Contains the `updateMaster` function and VBScript template.
*   `discord.js`: Handles file uploads to Discord.
*   `วิธีใช้งาน.txt`: Original Thai documentation for setup instructions.
