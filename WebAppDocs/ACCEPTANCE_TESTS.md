# Acceptance Tests

## Setup & Onboarding

### AT-01: First-time launch shows token entry
1. Clear all stored data (localStorage)
2. Navigate to app root
3. **Verify**: Redirected to token entry screen
4. **Verify**: No other content is shown

### AT-02: Empty token shows validation
1. On token entry screen, tap "Continue" with empty field
2. **Verify**: Error message shown (token required)

### AT-03: Valid token proceeds to page picker
1. Enter a valid Notion Integration Token
2. Tap "Continue"
3. **Verify**: Token saved to localStorage
4. **Verify**: Navigated to page picker
5. **Verify**: Top-level workspace pages are listed

### AT-04: Page selection proceeds to role assignment
1. Select a page from the list
2. **Verify**: Page ID saved to localStorage
3. **Verify**: Navigated to database role assignment
4. **Verify**: All databases under the selected page are listed with property details

### AT-05: Database role assignment
1. For each discovered database, assign a role (Expense / Income / Ignore)
2. **Verify**: At least one Expense and one Income database assigned
3. **Verify**: Navigated to column mapping

### AT-06: Column mapping
1. For the Expense database, map: Title column, Amount column, Category column, Date column
2. For metadata: map a rich_text column for Split Details (or leave unmapped)
3. **Verify**: Mappings saved to localStorage
4. **Verify**: Navigated to Dashboard

### AT-07: Setup persistence on relaunch
1. Complete full setup
2. Close and reopen app
3. **Verify**: Dashboard loads directly (no setup screens)

### AT-08: Reset setup
1. In Settings, tap "Reset Setup"
2. **Verify**: All stored data cleared
3. **Verify**: Navigated to token entry screen

## Dashboard

### AT-09: Dashboard loads with cached data
1. Complete setup with data
2. **Verify**: Dashboard shows Hero section with balance
3. **Verify**: Overview shows income/expense totals
4. **Verify**: Recent Activity shows last 5 transactions
5. **Verify**: No loading spinners (data from cache)

### AT-10: Month selection
1. On Dashboard, tap month selector
2. Select a different month
3. **Verify**: All sections update to reflect selected month data
4. **Verify**: Balance, totals, recent transactions all update

### AT-11: Budget section
1. If budget database is configured, verify budget cards appear
2. **Verify**: Each card shows category name, spent amount, budget amount, circular progress
3. **Verify**: Over-budget cards are visually distinct (pct > 1.0)

## Transactions (Expenses & Income)

### AT-12: Expense list loads
1. Navigate to Expenses
2. **Verify**: Transactions grouped by date (newest first)
3. **Verify**: Each section shows date header and total
4. **Verify**: Each transaction shows title, amount, category

### AT-13: Income list loads
1. Navigate to Income
2. **Verify**: Same layout as expenses
3. **Verify**: Income transactions shown correctly

### AT-14: Filter transactions
1. On Expense list, tap filter icon
2. Add a filter: category equals "Groceries"
3. Apply filter
4. **Verify**: Only groceries transactions shown
5. **Verify**: Filtered total shown in summary bar
6. Clear filter
7. **Verify**: All transactions shown again

### AT-15: Date range filter
1. On Expense list, open filter panel
2. Set a date range (From / To)
3. Apply
4. **Verify**: Only transactions within date range shown

## Add/Edit Transaction

### AT-16: Add expense
1. Tap FAB on Dashboard
2. Fill in: Title, Amount, Category, Date
3. Tap "Save Transaction"
4. **Verify**: Notion API called (POST /pages)
5. **Verify**: Page created in Notion
6. **Verify**: Cache updated
7. **Verify**: Dismissed back to Dashboard
8. **Verify**: New expense appears in Dashboard and Expense list

### AT-17: Add income
1. Tap FAB, switch to Income tab
2. Fill in fields
3. Save
4. **Verify**: Income created in Notion and cache

### AT-18: Add transaction with relation fields
1. Add expense with a relation category
2. Verify relation picker shows options from target database
3. Select a category
4. Save
5. **Verify**: Relation saved correctly in Notion

### AT-19: Edit expense
1. Navigate to Expense list
2. Tap a transaction → detail view
3. Tap "Edit"
4. Modify title, amount
5. Tap "Update Transaction"
6. **Verify**: PATCH called (PATCH /pages/{id})
7. **Verify**: Cache updated (`replaceExpense`)
8. **Verify**: Updated values shown in list

### AT-20: Edit split expense
1. Navigate to a split expense
2. Tap Edit
3. **Verify**: Split state restored: method, participants, paidAmount, myShare
4. Modify split method or amount
5. Save
6. **Verify**: Amount overwritten with new myShare
7. **Verify**: Split Details JSON updated

### AT-21: Delete transaction
1. Navigate to detail view
2. Tap "Delete"
3. Confirm deletion
4. **Verify**: PATCH with `in_trash: true` sent
5. **Verify**: Transaction removed from cache and list

### AT-22: Deep link add-expense
1. Navigate to `notra://add-expense?title=Test&amount=25.50&date=2026-06-15&notes=test`
2. **Verify**: Add Transaction screen opens with pre-filled fields
3. **Verify**: Role set to Expense

### AT-23: Deep link add-income
1. Navigate to `notra://add-income?title=Salary&amount=5000`
2. **Verify**: Add Transaction screen opens with Income role

## Receipt Scanning

### AT-24: Gemini key setup
1. Go to Settings → Scan Receipt
2. **Verify**: If no key stored, alert prompts for Gemini API key
3. Enter a valid key
4. **Verify**: Key stored (Keychain equivalent)
5. **Verify**: File picker appears after key entry

### AT-25: Scan image receipt
1. Scan a receipt image
2. **Verify**: OCR text extracted
3. **Verify**: Gemini API called with extracted text
4. **Verify**: Review screen shows parsed items, merchant, totals

### AT-26: Scan PDF receipt
1. Scan a PDF receipt
2. **Verify**: PDF text extracted via PDFKit
3. **Verify**: Gemini API called
4. **Verify**: Review screen shows parsed data

### AT-27: OCR quality fallback
1. Scan a low-quality image (poor OCR)
2. **Verify**: OCR text quality check fails
3. **Verify**: Image file sent directly to Gemini instead

### AT-28: Empty receipt handling
1. Scan a blank/empty image
2. **Verify**: Warning shown about no items detected
3. **Verify**: Option to enter items manually

### AT-29: Gemini error handling
1. Use an invalid Gemini API key
2. **Verify**: Error message shown (invalid API key)
3. **Verify**: Options: Try Again, Enter Manually, Cancel
4. Clear Key → Key setup prompt

### AT-30: Large file rejection
1. Attempt to scan a file > 20MB
2. **Verify**: Error message: file too large

## Receipt Review

### AT-31: Item classification
1. In receipt review, tap classification chip on an item
2. **Verify**: Cycles through Mine → Shared → Ignore
3. **Verify**: Visual state changes accordingly

### AT-32: Shared item person selection
1. Set an item to Shared
2. **Verify**: Person selection chips appear below the item
3. Select a person
4. **Verify**: Person chip shows selected state

### AT-33: Bulk All Mine
1. Tap "All Mine"
2. **Verify**: All non-ignore items set to Mine
3. **Verify**: All sharedWith arrays cleared
4. **Verify**: No person chips visible

### AT-34: Bulk All Shared
1. Tap "All Shared"
2. **Verify**: Person chips appear below buttons
3. Select people by tapping chips
4. **Verify**: Chips show selected state (✓ prefix)
5. **Verify**: All non-ignore items set to Shared with selected people

### AT-35: Bulk Clear
1. Apply "All Shared" with selections
2. Tap "Clear"
3. **Verify**: All items reset to Mine
4. **Verify**: Person chips hidden
5. **Verify**: Bulk mode reset to none

### AT-36: Create personal expense (no shared items)
1. Review receipt, set all items to Mine
2. Select category
3. Tap "Create 1 Expense"
4. **Verify**: One Notion page created (no split metadata)
5. **Verify**: Title = merchant name
6. **Verify**: Amount = sum of all item prices
7. **Verify**: Cache updated

### AT-37: Create split expense (shared items)
1. Review receipt, set some items to Shared with people
2. Tap "Create Split Expense"
3. **Verify**: One Notion page created
4. **Verify**: Title = "<Merchant> Receipt"
5. **Verify**: Amount = myShare (not total)
6. **Verify**: Split Details JSON stored in metadata column
7. **Verify**: Participants included in JSON
8. **Verify**: Items included in JSON

### AT-38: Validation — no items
1. Set all items to Ignore
2. Attempt to create
3. **Verify**: Error: no items to create

### AT-39: Validation — shared items without people
1. Set items to Shared but don't select people
2. Attempt to create
3. **Verify**: Error: select at least one person

### AT-40: Merchant display guard
1. Review receipt with merchant="Walmart" and platform="Walmart"
2. **Verify**: Display shows "Walmart" (not "Walmart via Walmart")
3. Different merchant + platform: display shows "Merchant via Platform"

## Split Expenses

### AT-41: Manual equal split
1. Add an expense of $100
2. Enable split, select 1 person (Sandy)
3. Choose "Equal" method
4. **Verify**: myShare = $50, theyOwe = $50, Sandy owes $50
5. Save
6. **Verify**: Notion Amount = $50
7. **Verify**: Split Details JSON has paidAmount=$100, myShare=$50, participants=[Sandy: $50]

### AT-42: Manual percent split
1. Add expense, enable split, select 1 person
2. Choose "Percent" method, set myPercent = 60
3. **Verify**: myShare = $60, theyOwe = $40
4. Save
5. **Verify**: Correct values in Notion and Split Details

### AT-43: Manual exact split
1. Add expense, enable split, select 1 person
2. Choose "Exact" method, enter theyOwe = $30
3. **Verify**: myShare = $70, theyOwe = $30

### AT-44: Manual HHS split
1. Add expense, enable split, select 2 people
2. Choose "Adjust" method (iPayExtra, extra=$20)
3. **Verify**: baseShare = $100/3 ≈ $33.33, myShare = $33.33 + $20 = $53.33, theyOwe ≈ $46.67

### AT-45: Multi-person split (3+ people)
1. Add expense, enable split, select 3 people
2. Choose any method
3. **Verify**: participants all get equal share of theyOwe

### AT-46: Split validation — no people selected
1. Enable split on expense, don't select any people
2. Attempt to save
3. **Verify**: Error "Select at least one person"

## Split Tracker

### AT-47: Split tracker shows all splits
1. Ensure there are split expenses in cache
2. Navigate to Split Tracker
3. **Verify**: All persons with pending/settled splits listed
4. **Verify**: Each person shows name, pending total, settled total
5. **Verify**: Default filter is Pending

### AT-48: Filter Pending / Settled / All
1. On Split Tracker, tap "Settled"
2. **Verify**: Only settled entries shown
3. Tap "All"
4. **Verify**: All entries shown

### AT-49: Person detail screen
1. Tap a person row
2. **Verify**: Header shows name, pending owed, settled, entry count
3. **Verify**: Context subtitle "Showing pending/settled/all splits"
4. **Verify**: Transaction cards show title, amount, date • category, split context

### AT-50: Mark split as settled
1. On person detail, tap "Settle" on a pending entry
2. **Verify**: PATCH sent (only Split Details column)
3. **Verify**: No income transaction created
4. **Verify**: Participant status changed to "settled"
5. **Verify**: settledAt timestamp set
6. **Verify**: Entry moves to Settled filter

### AT-51: Edit from split detail
1. On person detail, tap edit on a transaction
2. **Verify**: Add Transaction opens in edit mode with split state restored
3. Modify and save
4. **Verify**: Cache updated via replaceExpense
5. **Verify**: Detail screen reloads

### AT-52: Legacy v1 split display
1. Create a split with legacy v1 format (no participants array)
2. **Verify**: App creates fallback participants
3. **Verify**: Entry appears in Split Tracker

## Analytics

### AT-53: Overview tab
1. Navigate to Analytics
2. **Verify**: Overview tab shows income vs expense summary
3. **Verify**: Net difference displayed

### AT-54: Expenses tab — category breakdown
1. Go to Expenses tab
2. **Verify**: Donut chart shows top 6 categories + "Other"
3. **Verify**: USD hardcoded

### AT-55: Expenses tab — daily spending
1. On Expenses tab, scroll down
2. **Verify**: Bar chart shows daily spending for selected month

### AT-56: Income tab
1. Go to Income tab
2. **Verify**: Income source breakdown shown

### AT-57: Trends tab
1. Go to Trends tab
2. **Verify**: Monthly expenses and incomes shown over time

### AT-58: Zero API calls
1. Navigate through all analytics tabs
2. **Verify**: No API calls made (all data from cache)

## Settings

### AT-59: Gemini key management
1. Go to Settings
2. **Verify**: Gemini API key section
3. Enter a new key, save
4. **Verify**: Key stored
5. Delete key
6. **Verify**: Key removed

### AT-60: Gemini model selection
1. In Settings, change Gemini model
2. **Verify**: Model name persists (localStorage)
3. **Verify**: Next scan uses selected model

### AT-61: Reset setup
1. Tap "Reset Setup" in Settings
2. **Verify**: Confirmation dialog
3. Confirm
4. **Verify**: All data cleared
5. **Verify**: Redirected to setup token entry

## Caching & Performance

### AT-62: Cache persists after navigation
1. Load dashboard
2. Navigate to Expenses, then back to Dashboard
3. **Verify**: No reload / API call needed
4. **Verify**: Data still shown correctly

### AT-63: Cache updates after add
1. Add a new expense
2. Navigate to Dashboard
3. **Verify**: New expense appears in Recent Activity and totals recalculated

### AT-64: Cache updates after edit
1. Edit an existing expense
2. Navigate to list
3. **Verify**: Updated values shown

### AT-65: Cache updates after delete
1. Delete an expense
2. Navigate to list
3. **Verify**: Transaction removed from list

### AT-66: Month classification auto-defaults
1. Add transaction with date "2026-06-15"
2. **Verify**: Month Classification relation auto-set to "June 2026" (or "2026-06")
