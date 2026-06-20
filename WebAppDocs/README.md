# Notra — Web Application Documentation

Notra is a Notion-powered personal finance tracker. The iOS app (Swift/UIKit, MVVM, programmatic UI) syncs transactions from Notion databases and provides expense/income tracking, receipt scanning via Gemini AI, multi-person split expenses, budgeting, and analytics.

## Goal

Build a web application that replicates **every feature** of the iOS Notra app. This folder contains the full specification extracted from the iOS codebase.

## How to Use These Docs

| File | What it covers |
|------|---------------|
| `PRODUCT_SPEC.md` | Complete feature catalog with behaviors |
| `USER_FLOWS.md` | Step-by-step user journeys |
| `DATA_MODEL.md` | All data models, JSON examples, Split Details v1/v2 |
| `NOTION_SCHEMA.md` | Required Notion database schemas and column mapping |
| `API_AND_SERVICES.md` | Notion API usage, Gemini API, caching, error handling |
| `RECEIPT_SCANNING_SPEC.md` | OCR → Gemini → Review → Save pipeline |
| `SPLIT_EXPENSE_SPEC.md` | Split logic: equal/percent/exact/HHS, settlement |
| `UI_DESIGN_SYSTEM.md` | Dark espresso theme, cards, typography, layout |
| `WEB_APP_REQUIREMENTS.md` | Tech stack, routes, components, limitations |
| `ACCEPTANCE_TESTS.md` | Functional acceptance tests for all features |
| `MIGRATION_NOTES.md` | v1/v2 Split Details compat, stable person IDs |

## Key Constraints

- **No snake_case decoding**: All Notion API responses use snake_case keys but the app manually maps every key via `CodingKeys`. The web app must do the same.
- **Date-only strings**: Notion date properties return `"2026-05-15"`. The app parses these with `DateComponents(hour: 12)` to avoid timezone day-shift. ISO8601 formatters shift to the previous day in local timezone.
- **Number parsing**: Strip commas before converting to numbers. Exception: deep link amounts replace comma with dot (European decimal support).
- **Split Details JSON**: Rich text column stores a JSON blob. Two versions exist (v1 and v2). See `DATA_MODEL.md`.
- **PATCH returns full page**: Notion PATCH on pages returns the updated page object, which must be parsed to update local cache.
