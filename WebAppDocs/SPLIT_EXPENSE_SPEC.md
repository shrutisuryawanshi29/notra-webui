# Split Expense Specification

## Overview

Split expenses allow an expense to be divided among multiple people, tracked in Notion via a rich_text column containing a JSON blob (Split Details). The iOS app supports four split methods for manual entry and one for receipt scans. Split tracking shows pending/settled status per person.

## Split Methods (Manual Entry)

All manual splits use the centralized `calculateManualSplit()` function in `AddTransactionViewModel.swift`. A single `ManualSplitResult` is computed and cached as `lastManualSplitResult`.

### 1. Equal Split

| Field | Value |
|-------|-------|
| Enum | `.equal` |
| Type string | `"manualEqual"` |
| Formula | `eachShare = paid / (1 + selectedCount)` |
| myShare | `eachShare` |
| theyOwe | `paid - myShare` |
| Inputs | None |

### 2. Percent Split

| Field | Value |
|-------|-------|
| Enum | `.percent` |
| Type string | `"manualPercent"` |
| Entry modes | `myPercent` or `theirPercent` |
| myShare formula | `paid * myPercent / 100` (myPercent mode) |
| theyOwe formula | `paid * theirPercent / 100` (theirPercent mode) |
| Inputs | `{ entryMode, myPercent, theirPercent }` |

### 3. Custom / Exact Amount

| Field | Value |
|-------|-------|
| Enum | `.customAmount` |
| Type string | `"manualCustom"` |
| Entry modes | `theyOwe` or `myShare` |
| theyOwe mode | `myShare = paid - customAmount` |
| myShare mode | `theyOwe = paid - customAmount` |
| Validation | Amount cannot exceed `paidAmount` |
| Inputs | `{ entryMode, customAmount }` |

### 4. HHS (Adjustment / "Half-Half-Something")

| Field | Value |
|-------|-------|
| Enum | `.hhs` |
| Type string | `"manualHHS"` |
| Entry modes | `iPayExtra` or `extraTheyPay` |
| Base share | `paid / (1 + selectedCount)` |
| myShare (iPayExtra) | `baseShare + extraAmount` |
| theyOwe (extraTheyPay) | `baseShare + extraAmount` |
| Validation | Result cannot exceed paidAmount |
| Inputs | `{ entryMode, extraAmount, baseShare }` |

### Multi-Person Participant Calculation

For all methods, when participants are selected:
- `participantOwes[personId] = theyOwe / selectedCount` (distributed equally among selected people)

### Receipt Multi-Person

| Field | Value |
|-------|-------|
| Type string | `"receiptMultiPerson"` |
| Mine items | Full price goes to myShare |
| Shared items | Split equally among `1 + sharedWith.count` participants |
| Tax/Fees | Proportional if `includeTaxProportionally` |
| Source | `buildMultiPersonSplitMetadataJSON()` in receipt review |

## paidAmount vs myShare

- **paidAmount**: The full transaction amount (what was actually paid)
- **myShare**: Your portion of the split (what you're responsible for)
- **theyOwe**: `paidAmount - myShare` (the total owed by all other participants)

## Notion Amount Must Be myShare

When saving a split expense:
1. VM calls `recalculateSplit()` → `calculateManualSplit()` → stores `lastManualSplitResult`
2. The Notion Amount field is **overwritten** with `splitResult.myShare`
3. The Split Details JSON stores `paidAmount`, `myShare`, `theyOwe`, participants, inputs

This means:
- The Notion page's Amount column shows your share only
- The full paid amount lives in the Split Details JSON
- For non-split transactions, Amount = full amount (no Split Details)

## Split Details JSON (Version 2)

The JSON stored in the rich_text metadata column:

```json
{
  "version": 2,
  "split": {
    "enabled": true,
    "paidAmount": 100.00,
    "myShare": 40.00,
    "theyOwe": 60.00,
    "type": "manualEqual",
    "status": "pending",
    "participants": [
      {"id": "sandy", "name": "Sandy", "owes": 30.00, "status": "pending", "settledAt": null},
      {"id": "alex", "name": "Alex", "owes": 30.00, "status": "pending", "settledAt": null}
    ],
    "inputs": {}
  }
}
```

## Participant Status

- Each participant has `status`: `"pending"` or `"settled"`
- **Settlement** (marking as settled): Only PATCHes the participant status in Split Details JSON — **no income transaction is created**
- Settlement flow:
  1. `SplitTrackerViewModel.updateSettlementStatus()` builds updated participants array
  2. Calls `SplitMetadata.buildUpdatedJSON()` to serialize with new status
  3. PATCHes the metadata column only (not the whole transaction)
  4. Updates cache via `replaceExpense()`
- Settlement timestamp stored in `settledAt` (ISO8601 string)

## Edit Prefill Behavior

When editing a split expense:

**Phase A**: All form fields pre-filled from `rawProperties`

**Phase B** (split-specific):
1. Resolves metadata column (mapped name first, then 7 fallback names)
2. Sets `isSplitExpense = true`, `paidAmountForSplit = split.paidAmount`
3. **Overwrites** Amount field with `split.paidAmount` (not `myShare`)
4. Loads `selectedSplitPersonIds` from `split.participants` for all v2 types
5. Sets `splitMethodType` via `SplitMethodType.fromLegacy()`
6. Sets `splitMethod` via `SplitMethod(from:)`
7. Loads method-specific inputs from `split.inputs`
8. Calls `recalculateSplit()` to sync summary labels

## Legacy Support (Version 1)

v1 split metadata (2-person only, no participants array):

```json
{
  "version": 1,
  "split": {
    "enabled": true,
    "paidAmount": 100.00,
    "myShare": 50.00,
    "theyOwe": 50.00,
    "type": "half",
    "status": "pending",
    "splitWith": "Sandy",
    "inputs": {}
  }
}
```

The `extractSplitMetadata()` parser:
- Creates fallback participants for v1 (using `stablePersonId(from: splitWith)`)
- Supports both v1 and v2 key orders (JSON objects are unordered)
- Legacy type strings mapped: `"half"`, `"50/50"`, `"Split Equally"` → splitEqually

## Split Subtitle Display

The `multiPersonSubtitle` computed property shows:
- All pending: `"Sandy owes $30.00"` / `"2 people owe $40.00"` (≤2 / 3+ people)
- All settled: `"Sandy settled $30.00"` / `"2 people settled $40.00"`
- Mixed: `"Pending $20.00 • Settled $30.00"`
- Status nil → treated as pending

## JSON Serialization Gotcha

When building updated Split Details JSON (`SplitMetadata.buildUpdatedJSON()`), the struct fields `SplitInputs`, `[SplitItem]`, and `ReceiptScanMetadata` must be manually converted to `[String: Any]` dictionaries before passing to `JSONSerialization`. Passing Swift Codable structs as `Any` causes a `__SwiftValue` crash.
