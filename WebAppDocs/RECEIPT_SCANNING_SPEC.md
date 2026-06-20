# Receipt Scanning Specification

## Overview

The receipt scanning pipeline: **File Import → OCR/Text Extraction → Gemini AI Parsing → Review → Save to Notion**.

## 1. PDF / Image Import

Entry point: Settings → Scan Receipt (not from Dashboard FAB).

The `ReceiptScanCoordinator` presents an action sheet with:

| Option | Implementation |
|--------|---------------|
| Take Photo | `UIImagePickerController` (camera) |
| Choose Photo | `UIImagePickerController` (photo library) |
| Choose PDF | `UIDocumentPickerViewController` (PDF, `asCopy: true`) |

Gemini key check: if no key exists in Keychain, an alert prompts the user to enter one before the file picker appears. Key is saved via `GeminiKeychainService`.

## 2. Text Extraction

### For Images
- Uses Vision `VNRecognizeTextRequest` to extract text from the image
- On success: extracted text → quality check → Gemini
- On failure: falls back to sending the image file directly to Gemini

### For PDFs
- Uses PDFKit to extract text from the PDF
- On success: extracted text → quality check → Gemini
- On failure: falls back to sending the PDF file directly to Gemini

### Quality Check (`ExtractionQualityEvaluator`)
- Minimum text length: 300 characters
- Minimum money values (e.g., `$10.00`): 3
- Minimum receipt keywords found: 2 (from list: "total", "subtotal", "tax", "item", "order", "qty", "delivered", "price", "quantity", "receipt", "amount")

If OCR text passes quality check → send as text to Gemini. If not → send as file (image/PDF).

## 3. Gemini JSON Parsing

### Text Mode
- Full receipt text embedded in the prompt
- Gemini instructed to return JSON only (no markdown, no code blocks)
- `responseMimeType: "application/json"` in generation config

### File Mode
- Base64-encoded file data sent as `inlineData`
- Same prompt as text mode (without embedded receipt text)
- Max file size: 20MB

### Prompt Rules
Items guidelines:
- Items must contain ONLY real purchased products
- No subtotal, tax, total, payment, delivery fee, tip, service fee, authorization, or order number as items
- Fees/taxes/tips/delivery/discounts go in summary
- Refunds, NOT CHARGED, and zero-amount adjustments go in adjustments
- CHARGED weight adjustments are real purchase items → include in items
- Use final charged prices, not original unit prices
- Item sum should match `summary.itemsSubtotal`
- Platform-specific parsing: Instacart sections, Walmart product lines

### Validator (`GeminiReceiptValidator`)
- Deduplicates items by name+price combination
- Converts charged weight adjustments from adjustments array to items
- Checks item total vs subtotal mismatch (> $0.10 difference → warning)
- Sets default classification to `.mine` for all items
- Adds warnings for empty items, subtotal mismatches

### Response JSON Structure

```json
{
  "merchant": "Walmart",
  "platform": null,
  "date": "2026-06-15",
  "orderNumber": "12345",
  "currency": "USD",
  "items": [
    {"name": "Milk 2%", "quantity": 1, "unitPrice": 4.99, "finalPrice": 4.99, "categoryHint": "Dairy", "rawText": "MILK 2%  4.99"},
    {"name": "Bread", "quantity": 1, "unitPrice": 2.99, "finalPrice": 2.99, "categoryHint": "Bakery", "rawText": "BREAD  2.99"}
  ],
  "summary": {
    "itemsSubtotal": 7.98,
    "tax": 0.64,
    "totalCharged": 8.62
  },
  "adjustments": [],
  "warnings": []
}
```

## 4. Receipt Review UI

`ReceiptReviewViewController` shows:

### Header Section
- Editable merchant name
- Editable date
- Order number (read-only)

### Items Section
- Scrollable list of items
- Each item shows: name, finalPrice, classification chip
- Classification chip toggles between: Mine (person icon) / Shared (people icon) / Ignore (eye-off icon)
- Shared items show person selection chips below
- Items are editable (tap to edit name, price, quantity)

### Bulk Assignment Actions
- "All Mine" button: sets all non-ignore items to `.mine`, clears all `sharedWith` arrays
- "All Shared" button: selects all non-ignore items as shared
  - Person chips appear below buttons
  - Selecting a person toggles them for all items
  - Changes do NOT apply until a person is selected
- "Clear" button: resets all non-ignore items to `.mine`, hides person chips, resets mode

### Summary Section
- Items subtotal
- Tax, service fee, delivery fee, tip, discount
- Total / Total Charged
- "Include tax proportionally" toggle (default: on)

### Category Section
- Category selector (from mapped expense database)
- Auto-suggested category from merchant name via `ExpenseCategorySuggestionEngine`

### Warnings Section
- Shows any warnings from Gemini processing
- Shows extraction quality indicators

## 5. Item States

| State | Behavior |
|-------|----------|
| `mine` | Item charged fully to current user |
| `shared` | Item split equally among user + selected people |
| `ignore` | Item excluded from all calculations |

Item count validation:
- `mineCount` + `sharedCount` > 0 (at least one non-ignore item)
- `hasSharedItemsWithoutPeople`: any shared item with no selected person → validation error

## 6. Apply-to-All Shared (Bulk)

`BulkAssignmentMode` enum:
- `.none` — default, no bulk mode active
- `.allMine` — all non-ignore items set to `.mine`, chips hidden, `sharedWith` cleared
- `.allShared` — person chips appear below buttons. Selecting a person toggles them in `selectedBulkSharedPersonIds`. Applying sets all non-ignore items to `.shared` with selected person IDs

Button styling:
- Unselected: `cardBackgroundAlt` / `border` / `textMuted`
- Selected: `accent` / `buttonContent` / `✓` prefix
- "Clear" always unselected

## 7. Split People

`SplitPeopleStore` singleton (UserDefaults key `notraSplitPeople`):
- `SplitPerson(id, name)` — IDs are deterministic via `stablePersonId(from:)`
- `getPeople()` — returns all people
- `addPerson(name:)` — creates person with stable ID (deduplicated)
- `load()` auto-migrates old UUID IDs to name-based IDs

## 8. Tax/Fee Allocation

When `includeTaxProportionally` is true:
- Tax and fees are added to the total paid amount
- They are distributed proportionally across all non-ignore items
- The total paid amount = sum of all item finalPrices + tax + fees

## 9. Category Handling

Category selection:
- Loaded from the expense database's mapped category column
- Supports select, multi_select, and relation category types
- For relation categories: loads options from the target database
- Auto-suggest: `ExpenseCategorySuggestionEngine` suggests category from merchant name
- Requires category selection for relation-type categories before save

## 10. Save Behavior

### No Shared Items (all mine or mixed mine+ignore)
- Creates one normal expense (no split metadata)
- Title: merchant name or "Receipt"
- Amount: sum of mine items
- Category: user-selected
- Date: user-selected or receipt date

### Has Shared Items
- Creates ONE combined expense with version 2 split metadata
- Title: `"<Merchant> Receipt"`
- Amount (Notion): `myShare` (computed from multi-person settlement)
- Split Details JSON stored in metadata column with:
  - `version: 2`
  - `split.type: "receiptMultiPerson"`
  - `split.participants[]` with each person's owed amount
  - `split.items[]` with each receipt item's name, price, assignment, sharedWith
  - `receipt.source`, `receipt.merchant`, `receipt.itemCount`, `receipt.originalTotal`
- Cache updated via `addExpense()`
- Button label: "Create Split Expense" (shared) or "Create 1 Expense" (personal-only)
