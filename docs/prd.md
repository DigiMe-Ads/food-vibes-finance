# Requirements Document

## 1. Application Overview

### 1.1 Application Name
Restaurant Project Finance Dashboard

### 1.2 Application Description
A web-based financial management application designed to track and monitor all finances during the construction, setup, and pre-opening stages of a restaurant project. The system records investments and expenses, calculates available balance in real-time, and provides comprehensive financial reporting.

## 2. Users and Usage Scenarios

### 2.1 Target Users
- Restaurant project administrators
- Finance managers
- Project stakeholders

### 2.2 Core Usage Scenarios
- Recording initial and additional investments into the restaurant project
- Logging daily expenses across various categories (construction, equipment, permits, etc.)
- Monitoring available balance and budget utilisation in real-time
- Generating financial reports for decision-making
- Tracking spending patterns by category and time period
- Managing expense documentation (receipts/invoices)

## 3. Page Structure and Functional Description

### 3.1 Page Structure

```
Restaurant Project Finance Dashboard
├── Dashboard (Home)
├── Expenses
├── Investments
├── Categories
├── Reports
├── Settings
└── Logout
```

### 3.2 Navigation

**Left Sidebar Navigation**
- Dashboard
- Expenses
- Investments
- Categories
- Reports
- Settings
- Logout (positioned at bottom)

**Mobile Navigation**
- Convert sidebar to mobile-appropriate navigation pattern

### 3.3 Dashboard Page

**3.3.1 KPI Cards Section**

Four prominent cards displaying:

1. **Total Investment Card**
  - Display total invested amount
  - Supporting text: Initial: LKR X, Further: LKR X

2. **Total Spent Card**
  - Display total expenses
  - Sub-text showing today's spending

3. **Available Balance Card**
  - Display: Total Investment - Total Expenses
  - Show over-budget warning if negative

4. **Budget Utilised % Card**
  - Display percentage with progress bar
  - Color coding:
    - 0-69%: Normal
    - 70-84%: Attention
    - 85-99%: Warning
    - 100%+: Over Budget

**3.3.2 Quick Actions**
- \"+ Add Expense\" button (opens modal)
- \"+ Add Investment\" button (opens modal)

**3.3.3 Financial Summary Section**

Display:
- Initial Investment
- Further Investments
- Total Investment
- Total Expenses
- Available Balance

**3.3.4 Charts Section**

1. **Spending Over Time Chart**
  - Line or bar chart
  - View options: Daily, Weekly, Monthly
  - Date range filters: Last 7 Days, Last 30 Days, This Month, Custom Range

2. **Expenses by Category Chart**
  - Donut chart
  - Display amount and percentage per category
  - Clicking category filters Expenses page

3. **Funding/Investment History Chart**
  - Timeline or chart showing investment dates and amounts

**3.3.5 Recent Expenses Table**
- Display latest 10 expenses
- Columns: Date, Description, Category, Supplier/Payee, Amount
- \"View All Expenses\" link

### 3.4 Expenses Page

**3.4.1 Add Expense Function**

Form fields:
- Date (required, default: today)
- Expense Item/Description (required)
- Category (required, dropdown)
- Supplier/Paid To (optional)
- Amount (required, numeric/currency)
- Payment Method (required): Cash, Bank Transfer, Credit Card, Debit Card, Cheque, Other
- Reference/Invoice Number (optional)
- Notes (optional)
- Receipt/Invoice file upload (optional, accept: PDF, JPG, JPEG, PNG)

Buttons:
- Save Expense
- Save & Add Another

**3.4.2 Expense List**

Table columns:
- Date
- Expense ID
- Description
- Category
- Supplier
- Payment Method
- Reference
- Amount
- Actions (View, Edit, Delete)

Features:
- Pagination
- Sorting by Date, Amount, Category

**3.4.3 Search and Filter**

Search by:
- Description
- Supplier
- Reference Number

Filter by:
- Date Range
- Category
- Supplier
- Payment Method
- Min/Max Amount

Buttons:
- Apply Filters
- Clear Filters

When filtered, display: \"X Expenses | LKR X.XX\"

**3.4.4 View/Edit/Delete Expense**
- View: Display all expense details and attached receipt/invoice
- Edit: Open form with existing data, allow modification
- Delete: Show confirmation dialog before deletion

**3.4.5 Receipt/Invoice Management**
- Display \"View Receipt/Invoice\" when attachment exists
- Allow preview/open of attached file
- Indicate whether expense has documentation

### 3.5 Investments Page

**3.5.1 Add Investment Function**

Form fields:
- Date (required)
- Investment Type (required): Initial Investment, Additional Investment, Owner Injection, Partner Investment, Loan/Borrowed Funds, Other Funding
- Investor/Source (optional)
- Description (optional)
- Amount (required, numeric/currency)
- Payment Method (required): Cash, Bank Transfer, Cheque, Other
- Reference (optional)
- Notes (optional)

**3.5.2 Investment Ledger**

Table columns:
- Date
- Type
- Source
- Description
- Amount
- Reference
- Actions (View, Edit, Delete)

Top summary display:
- Initial Investment
- Further Investments
- Total Investment

**3.5.3 View/Edit/Delete Investment**
- View: Display all investment details
- Edit: Open form with existing data, allow modification
- Delete: Show confirmation dialog before deletion

### 3.6 Categories Page

**3.6.1 Default Categories**
- Construction Materials
- Labour
- Electrical
- Plumbing
- Carpentry
- Painting
- Flooring
- Furniture
- Kitchen Equipment
- General Equipment
- Interior/Décor
- Signage
- Rent/Deposit
- Professional Fees
- Permits & Licences
- Transport
- Cleaning
- Marketing/Branding
- Technology/POS
- Utilities
- Miscellaneous

**3.6.2 Category Management**
- Add new category
- Edit existing category
- Disable category (do not permanently delete if transactions exist)

Category fields:
- Name (required)
- Description (optional)
- Status (Active/Disabled)

### 3.7 Reports Page

**3.7.1 Filter Options**
- From Date
- To Date
- Category
- Supplier
- Payment Method

**3.7.2 Report Types**

1. **Financial Summary Report**
  - Initial Investment
  - Further Investments
  - Total Investment
  - Total Expenses
  - Available Balance
  - Budget Utilisation %

2. **Expense Report**
  - All expenses for selected period
  - Total expenses

3. **Category Report**
  - Category name
  - Number of transactions
  - Total spent
  - Percentage of total
  - Sorted by highest spending first

4. **Daily Expense Report**
  - Select specific date
  - Show all expenses for that date
  - Display daily total

5. **Monthly Financial Summary**
  - Table format:
    - Month
    - Investment Added
    - Expenses
    - Net Movement
    - Closing Balance

**3.7.3 Export Functions**
- CSV export (respecting applied filters)
- Print (print-friendly layout respecting applied filters)

### 3.8 Settings Page

**3.8.1 Project Settings**
- Project Name
- Description
- Start Date
- Expected Completion Date
- Status: Planning, Construction, Fit-Out, Pre-Opening, Completed, On Hold
- Notes

**3.8.2 Currency Settings**
- Default currency: LKR
- Format: LKR 1,250,000.00 with thousand separators

### 3.9 Authentication

**3.9.1 Login Page**
- Username/email input
- Password input
- Login button

**3.9.2 Logout Function**
- Logout button in sidebar
- Clear session and redirect to login page

## 4. Business Rules and Logic

### 4.1 Core Financial Calculations

**4.1.1 Investment Calculations**
- Total Investment = Sum of ALL investment transactions
- Initial Investment = Sum of transactions with type \"Initial Investment\"
- Further Investments = Total Investment - Initial Investment

**4.1.2 Expense Calculations**
- Total Expenses = Sum of ALL expense transactions
- Today's Spending = Sum of expenses where date = current date

**4.1.3 Balance Calculations**
- Available Balance = Total Investment - Total Expenses
- Budget Utilisation % = (Total Expenses / Total Investment) × 100
- If Total Investment is zero, handle division-by-zero safely (display 0% or N/A)

**4.1.4 Real-time Recalculation**
- All dashboard totals must be dynamically calculated from underlying transaction records
- Never manually store calculated totals
- Any add/edit/delete of investment or expense immediately triggers recalculation

### 4.2 Project Structure

**4.2.1 Default Project**
- System creates default project: \"Restaurant Project 01\"
- All investments and expenses belong to this project
- Database structured to support multiple projects in future

**4.2.2 Project Status Flow**
- Planning → Construction → Fit-Out → Pre-Opening → Completed
- On Hold status available at any stage

### 4.3 Category Management Rules

- Active categories appear in expense form dropdown
- Disabled categories do not appear in dropdown but remain linked to historical expenses
- Cannot permanently delete category if transactions exist
- Disabling category does not affect existing expense records

### 4.4 Data Validation Rules

**4.4.1 Amount Validation**
- Amount cannot be negative
- Must be numeric/currency format
- Use DECIMAL/NUMERIC data type (not float)

**4.4.2 Required Field Validation**
- Expense: Date, Description, Category, Amount, Payment Method
- Investment: Date, Investment Type, Amount, Payment Method

**4.4.3 Date Validation**
- Reject invalid dates
- Date cannot be in future (configurable)

**4.4.4 File Upload Validation**
- Accept only: PDF, JPG, JPEG, PNG
- Validate file type and size

**4.4.5 Category Validation**
- Selected category must exist and be active
- Historical records retain disabled category references

### 4.5 Deletion Rules

- Show confirmation dialog before deleting expense or investment
- After deletion, immediately recalculate all financial figures
- Deletion triggers activity log entry

### 4.6 Activity Logging

Log following actions:
- Expense Created/Edited/Deleted
- Investment Created/Edited/Deleted

Log fields:
- User
- Action
- Record Type
- Record ID
- Previous Value
- New Value
- Date & Time

### 4.7 Chart Interaction Logic

**4.7.1 Expenses by Category Chart**
- Clicking category segment filters Expenses page to show only that category
- Filter persists until cleared

**4.7.2 Spending Over Time Chart**
- Switching view (Daily/Weekly/Monthly) reloads chart data
- Date range filter applies to chart data

## 5. Exceptions and Edge Cases

| Scenario | Handling |
|----------|----------|
| Total Investment is zero | Display Available Balance as 0, Budget Utilisation as 0% or N/A |
| Total Expenses exceed Total Investment | Available Balance shows negative value with over-budget warning, Budget Utilisation shows >100% in red |
| No expenses recorded | Display \"No expenses recorded yet\" message, charts show empty state |
| No investments recorded | Display \"No investments recorded yet\" message, all financial totals show 0 |
| Category disabled with existing expenses | Historical expenses retain category reference, category not available in new expense dropdown |
| File upload fails | Display error message, allow retry, expense can be saved without attachment |
| Invalid date entered | Display validation error, prevent form submission |
| Negative amount entered | Display validation error, prevent form submission |
| Delete expense with receipt | Delete both expense record and associated file |
| Edit expense and change category | Update expense record, recalculate category totals |
| Filter returns no results | Display \"No results found\" message |
| Export with no data | Generate empty report with headers |
| Concurrent edits | Last save wins, log both actions |

## 6. Acceptance Criteria

1. User logs into the system
2. User adds an initial investment of LKR 1,000,000 on 01 August 2026
3. User adds an expense of LKR 50,000 for Construction Materials on 02 August 2026
4. Dashboard displays: Total Investment LKR 1,000,000, Total Spent LKR 50,000, Available Balance LKR 950,000, Budget Utilised 5%
5. User views Expenses page and confirms the expense is listed correctly
6. User generates Financial Summary Report and verifies all figures match dashboard
7. User adds additional investment of LKR 500,000 on 10 August 2026
8. Dashboard updates to show: Total Investment LKR 1,500,000, Available Balance LKR 1,450,000

## 7. Features Not Included in This Version

- Multi-project management (database structured for future support, but UI limited to single default project)
- User role management (Administrator, Finance Manager, Data Entry User, Viewer)
- Multi-user access control
- Budget planning and forecasting
- Supplier management module
- Payment scheduling and reminders
- Bank account reconciliation
- Tax calculation and reporting
- Invoice generation
- Purchase order management
- Approval workflows
- Email notifications
- Mobile application
- API integrations with accounting software
- Multi-currency support
- Automated data backup
- Advanced analytics and predictive insights
- Expense approval process
- Recurring expense templates
- Bulk import/export of transactions
- Custom report builder
- Dashboard customization
- File size limits, resolution requirements, or compression settings for uploads
- Browser compatibility specifications
- Performance benchmarks or loading speed requirements
- Social features (sharing, commenting, collaboration)
- Multi-device synchronization
- Offline mode

## 8. Sample Data

### 8.1 Project
- Name: Restaurant Project 01
- Description: New restaurant construction and setup
- Start Date: 01 August 2026
- Expected Completion Date: 30 November 2026
- Status: Construction

### 8.2 Investments

1. Date: 01 August 2026, Type: Initial Investment, Amount: LKR 1,000,000
2. Date: 10 August 2026, Type: Additional Investment, Amount: LKR 500,000
3. Date: 15 August 2026, Type: Owner Injection, Amount: LKR 250,000

Total Investment: LKR 1,750,000

### 8.3 Expenses (15-20 transactions)

Sample expenses across categories:
- Construction Materials: LKR 150,000
- Labour: LKR 200,000
- Electrical: LKR 80,000
- Plumbing: LKR 60,000
- Furniture: LKR 120,000
- Kitchen Equipment: LKR 250,000
- Interior/Décor: LKR 90,000
- Professional Fees: LKR 50,000
- Transport: LKR 30,000
- Technology/POS: LKR 70,000

Total Expenses: LKR 1,100,000
Available Balance: LKR 650,000
Budget Utilisation: 62.86%

### 8.4 Verification
- Dashboard calculations must reconcile correctly with sample data
- All reports must reflect accurate totals
- Charts must display sample data appropriately

## 9. Database Structure

### 9.1 Tables

**projects**
- id
- name
- description
- start_date
- expected_completion_date
- status
- notes
- created_at
- updated_at

**investments**
- id
- project_id (foreign key to projects)
- date
- investment_type
- source
- description
- amount (DECIMAL/NUMERIC)
- payment_method
- reference
- notes
- created_by
- created_at
- updated_at

**expenses**
- id
- project_id (foreign key to projects)
- date
- description
- category_id (foreign key to categories)
- supplier
- amount (DECIMAL/NUMERIC)
- payment_method
- reference
- notes
- attachment
- created_by
- created_at
- updated_at

**categories**
- id
- name
- description
- is_active
- created_at
- updated_at

**activity_logs**
- id
- user_id
- action
- record_type
- record_id
- previous_value
- new_value
- created_at

### 9.2 Relationships
- projects → investments (one-to-many)
- projects → expenses (one-to-many)
- categories → expenses (one-to-many)
- Use proper foreign key constraints

### 9.3 Data Type Requirements
- Use DECIMAL or NUMERIC for all financial values (not float)
- Ensure precision for financial calculations

## 10. UX Requirements

### 10.1 Speed and Efficiency
- User can add expense in under 30 seconds
- After saving expense: display success confirmation, show updated calculations, return to logical screen
- Provide \"Save & Add Another\" option for batch entry

### 10.2 Mobile Optimization
- Add Expense button prominent on mobile
- Mobile-friendly form layouts
- Easy amount entry on mobile keyboards
- Mobile-appropriate date picker
- Receipt photo upload from mobile camera

### 10.3 Visual Feedback
- Success confirmation after save
- Loading indicators during calculations
- Clear error messages with guidance
- Confirmation dialogs before destructive actions

## 11. Design Direction

### 11.1 Overall Style
- Premium modern financial dashboard aesthetic
- Fintech/accounting management feel
- Clean and professional

### 11.2 Color Scheme
- Clean light background
- Dark navy/charcoal sidebar
- White dashboard cards
- Color coding:
  - Green: healthy/available balance
  - Amber: attention needed
  - Red: warning/over budget

### 11.3 Typography and Layout
- Professional typography
- Strong number hierarchy
- Rounded cards with subtle shadows
- Generous spacing
- Minimal gradients and animation
- Professional icons
- Responsive tables

### 11.4 Currency Display
- Format: LKR 1,250,000.00
- Thousand separators
- Two decimal places
- Consistent formatting across all displays

## 12. Key Questions Answered by Version 1

1. How much did we initially invest?
2. How much additional money have we invested?
3. What is our total investment?
4. How much have we spent?
5. How much money is currently available?
6. What have we spent the money on?
7. When was the money spent?
8. Which categories are consuming the most money?
9. What investments were added and when?
10. Are we approaching or exceeding available project funds?