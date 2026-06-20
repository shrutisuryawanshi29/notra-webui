# User Flows

## 1. First-Time Setup

1. User launches app
2. `SceneDelegate` calls `SetupStateManager.nextRequiredScreen()` → `.tokenEntry`
3. App shows token entry screen
4. User pastes Notion Integration Token → taps Continue
5. Token saved to UserDefaults. `nextRequiredScreen()` → `.pagePicker`
6. Page picker loads top-level workspace pages via `POST /search`
7. User selects a page → page ID saved to UserDefaults
8. `nextRequiredScreen()` → `.databaseRoleAssignment`
9. App discovers all databases (`POST /search`, filter `object=database`) and fetches schemas
10. User assigns each database: Expense / Income / Ignore
11. `nextRequiredScreen()` → `.columnMapping` (due to known bug, shows role assignment controller again — user must navigate)
12. User maps columns: Title, Amount, Category, Date, Split Details
13. `nextRequiredScreen()` → `.dashboard`
14. App loads all transactions from Notion, populates cache, shows dashboard

## 2. Adding an Expense (Manual)

1. From Dashboard, tap FAB (floating action button)
2. `AddTransactionViewController` opens with `initialRole: .expense`
3. Dynamic form shows fields mapped from expense database columns
4. User fills in:
   - Title (required, auto-fallback: "Expense - YYYY-MM-DD" if left blank)
   - Amount (required)
   - Category (optional)
   - Date (required, defaults to today)
   - Any other mapped fields
5. Optional: toggle split expense, select people, choose split method
6. Tap "Save Transaction"
7. VM validates form → calls `TransactionInsertService.insertTransaction()` (POST /pages)
8. If split: overwrites Amount with `myShare`, writes Split Details JSON to metadata column
9. On success: cache updated via `lastCreatedPage` → `SessionCacheManager.addExpense()`
10. VC dismisses

## 3. Adding an Income

1. Same as add expense but user can toggle between Expense/Income tabs
2. Form uses income database column mapping
3. No split expense option (split only applies to expenses)
4. Save via POST /pages → `SessionCacheManager.addIncome()`

## 4. Editing a Transaction

1. Navigate to Expense List or Income List
2. Tap a transaction row → `TransactionDetailViewController`
3. Tap "Edit" button
4. `AddTransactionViewController` opens with `editingTransaction` parameter
5. VM `applyEditPrefill(columnMapping:)` pre-fills form from raw Notion properties
6. For split expenses: loads paidAmount, participants, method type, recalculates split
7. User modifies fields
8. Tap "Update Transaction"
9. Save via `TransactionInsertService.updateTransaction()` (PATCH /pages/{id})
10. On success: PATCH response parsed as `NotionPage` → `SessionCacheManager.replaceExpense()` or `replaceIncome()`

## 5. Deleting a Transaction

1. Navigate to detail view
2. Tap "Delete" → confirmation alert
3. `NotionService.trashPage(pageId:)` sends PATCH with `{"in_trash": true}`
4. On success: `SessionCacheManager.removeExpense(byPageId:)` or `removeIncome(byPageId:)`

## 6. Scanning a Receipt

1. Go to Settings → "Scan Receipt"
2. If no Gemini API key: alert prompts for key entry → saves to Keychain
3. Action sheet: Take Photo / Choose Photo / Choose PDF / Cancel
4. File picker opens (camera, photo library, or document picker)
5. App extracts text via OCR (Vision `VNRecognizeTextRequest`) or PDFKit
6. Extracted text → quality check (`ExtractionQualityEvaluator`):
   - If good quality: send as text to Gemini
   - If poor quality: send as file (image/PDF) to Gemini
7. Gemini returns structured JSON → `GeminiReceiptValidator.validate()` processes it
8. `ReceiptReviewViewController` opens with parsed results

## 7. Reviewing a Receipt

1. Review screen shows:
   - Merchant name (editable)
   - Date (editable)
   - Item list with prices, classification chips (mine/shared/ignore)
   - Summary: subtotal, tax, fees, tip, discount, total
   - Warnings/adjustments section
   - Category selector
2. User adjusts item classifications
3. User can toggle "Include tax proportionally" (default: on)
4. For shared items: select which people to split with
5. Bulk actions: "All Mine" / "All Shared" / Clear
6. Tap "Create Split Expense" or "Create 1 Expense"
7. Creates Notion page(s) via API
8. Cache updated

## 8. Splitting Receipt Items

1. In receipt review, tap an item's classification chip
2. Cycle through: Mine (person icon) → Shared (people icon) → Ignore (eye-off)
3. For Shared items, tap person chips to select who shares this item
4. "All Mine": sets all non-ignore items to mine, clears sharedWith
5. "All Shared": shows person chips below buttons; selecting applies to all non-ignore items
6. Items classified as `mine`: full price → your share
7. Items classified as `shared`: split equally among (you + selected people)

## 9. Manual Split Expense

1. In Add Transaction, toggle split expense on
2. Select people from person picker
3. Choose split method chip (Equal / Percent / Exact / Adjust)
4. Configure method-specific inputs
5. Summary shows myShare, theyOwe
6. On save: myShare goes to Notion Amount, full paidAmount + participants stored in Split Details JSON

## 10. Marking a Split as Settled

1. Go to Split Tracker
2. Filter: Pending (default)
3. Tap a person → person detail screen
4. Tap "Settle" button on a pending entry
5. PATCH request updates participant status to "settled" + adds settledAt timestamp
6. No income transaction created
7. Cache updated, entry moves to Settled filter

## 11. Viewing Dashboard

1. On launch or tap Dashboard tab
2. Hero section shows selected month's net (income − expenses)
3. Overview: month totals, income vs expense comparison
4. Monthly Status: largest expense, most used category, uncategorized count
5. Monthly Budget: per-category budget utilization cards (circular progress rings)
6. Recent Activity: last 5 transactions
7. Month selector (left/right arrows or picker) switches data
8. All data from cache — no API calls

## 12. Viewing Analytics

1. Tap "Explore" on Dashboard or Analytics tab
2. Four view modes:
   - Overview: income vs expense summary
   - Expenses: category breakdown (donut chart), daily spending bar chart
   - Income: income source breakdown
   - Trends: monthly expenses/incomes over time
3. All data from cache — no API calls

## 13. Changing Settings

1. Tap Settings tab
2. Manage Gemini API key (enter/update/delete, test key)
3. Change Gemini model (picker with 3 options)
4. Clear all data / reset setup
5. Scan Receipt button
6. View app info
