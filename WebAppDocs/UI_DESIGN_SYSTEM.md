# UI Design System

## Theme Overview

Dark espresso / warm cream aesthetic. Default mode is `.dark` with a light mode as alternative. Defined in `AppTheme` struct (`Helpers/AppConstants.swift`).

- `UIUserInterfaceStyle: Light` in Info.plist (system-level), overridden at runtime
- `window.overrideUserInterfaceStyle = (AppTheme.currentMode == .dark ? .dark : .light)`

## Color Palette

### Dark Mode (Default)

| Token | Hex | Usage |
|-------|-----|-------|
| `background` | `#2B241E` | Main background |
| `backgroundLight` | `#332A23` | Secondary background |
| `backgroundIvory` | `#1F1A16` | Tertiary background |
| `primaryBrown` | `#EDE1D1` | Primary text, nav bar tint |
| `primaryBrownLight` | `#D8C6B4` | Secondary text |
| `secondaryBrown` | `#C99152` | Accent elements |
| `secondaryTan` | `#A97845` | Secondary accent |
| `cardBackground` | `#362D25` | Card surface |
| `cardBackgroundAlt` | `#40342B` | Alternative card surface (chips, inputs) |
| `textPrimary` | `#F4E9DA` | Primary text |
| `textSecondary` | `#CBB9A7` | Secondary text |
| `textMuted` | `#9B8778` | Muted text |
| `expense` | `#C7745A` | Expense indicators (soft coral) |
| `expenseLight` | `#E09A82` | Light expense |
| `income` | `#8CA37D` | Income indicators (soft sage) |
| `incomeLight` | `#B2C5A6` | Light income |
| `border` | `#4C4036` | Borders, dividers |
| `accent` | `#C99152` | Selected states, primary accent |
| `accentSecondary` | `#A97845` | Secondary accent |
| `warning` | `#C49A5A` | Warning/pending indicators |
| `shadow` | `#120E0B` | Shadow color |

### Light Mode

Warm cream tones: background `#F6EFE3`, card `#FFF9F1`, text `#4A332C`. All other tokens shift accordingly.

### Semantic Colors

| Token | Dark Mode | Light Mode |
|-------|-----------|------------|
| `buttonSurface` | `cardBackgroundAlt` | `primaryBrown` |
| `buttonContent` | `textPrimary` | white |
| `pillContent` | `accent` | white |

## Typography

System font (San Francisco). No custom fonts.

| Token | Size | Weight | Usage |
|-------|------|--------|-------|
| `headingLarge` | 28 | Bold | Large titles |
| `headingMedium` | 22 | Semibold | Screen titles |
| `sectionHeader` | 18 | Semibold | Section headers |
| `body` | 16 | Regular | Body text |
| `bodyMedium` | 16 | Medium | Important body |
| `bodyBold` | 16 | Semibold | Bold body |
| `caption` | 14 | Regular | Captions |
| `captionMedium` | 14 | Medium | Important captions |
| `captionBold` | 14 | Semibold | Bold captions |
| `small` | 12 | Regular | Small text |
| `buttonLarge` | 17 | Semibold | Primary buttons |
| `buttonMedium` | 15 | Semibold | Secondary buttons |
| `buttonSmall` | 13 | Medium | Small buttons |

## Spacing

| Token | Value | Usage |
|-------|-------|-------|
| `tiny` | 4 | Minimal spacing |
| `small` | 8 | Tight spacing |
| `medium` | 12 | Default spacing |
| `large` | 16 | Section/group spacing |
| `extraLarge` | 20 | Wide spacing |
| `section` | 24 | Between sections |
| `largeSection` | 32 | Major section breaks |
| `cardPadding` | 16 | Card content padding |
| `screenPadding` | 20 | Screen edge padding |

## Corner Radius

| Token | Value | Usage |
|-------|-------|-------|
| `small` | 8 | Small elements |
| `medium` | 12 | Input fields |
| `large` | 16 | Cards, containers |
| `extraLarge` | 20 | Large containers |
| `button` | 12 | Buttons |
| `card` | 16 | Card surfaces |
| `pill` | 20 | Pill/chip shapes |

## Shadows

| Style | Opacity | Radius | Offset |
|-------|---------|--------|--------|
| Default | 0.06 | 8 | (0, 2) |
| Soft | 0.05 | 10 | (0, 3) |
| Card | 0.08 | 12 | (0, 4) |

## Buttons

### Primary Button (`applyPrimaryButtonStyle`)
- Background: `buttonSurface` (dark: `#40342B`, light: `#6B4638`)
- Text: `buttonContent` (dark: `#F4E9DA`, light: white)
- Font: `buttonLarge` (17, Semibold)
- Corner radius: 12
- Padding: (14, 24)

### Secondary Button (`applySecondaryButtonStyle`)
- Background: `secondaryTan` (`#A97845` dark / `#E8C9A6` light)
- Text: `primaryBrown` (`#EDE1D1` dark / `#6B4638` light)
- Font: `buttonMedium` (15, Semibold)
- Corner radius: 12
- Padding: (12, 20)

### Expense Button (`applyExpenseButtonStyle`)
- Background: `expense` (`#C7745A`)
- Text: white
- Font: `buttonLarge` (17, Semibold)

### Income Button (`applyIncomeButtonStyle`)
- Background: `income` (`#8CA37D`)
- Text: `textPrimary`
- Font: `buttonLarge` (17, Semibold)

## Chips / Pills

| State | Background | Text |
|-------|-----------|------|
| Unselected | `cardBackgroundAlt` | `textMuted` |
| Selected | `accent` | `buttonContent` |
| Mine chip | `expenseLight` | white |
| Shared chip | `incomeLight` | `textPrimary` |
| Selected shared | `accent` + `✓` prefix | `buttonContent` |
| Pending chip (warning) | `warning` / `expense` | white |
| Settled chip (income) | `income` | `textPrimary` |

## Navigation Bar

- Background: `background`
- Title: `headingMedium` (22, Semibold), `textPrimary`
- Large title: `headingLargeRounded` (28, Bold), `textPrimary`
- Tint: `primaryBrown`
- Shadow: clear
- Configured via `AppTheme.styleNavigationBar()`

## Tab Bar

- Background: `cardBackground`
- Unselected icon/text: `textMuted`
- Selected icon/text: `primaryBrown`
- Configured via `AppTheme.styleTabBar()`

## Dashboard Layout

Hierarchy (top to bottom):
1. **Hero** — Large balance, full-width, accent background
2. **Overview** — Income/Expense comparison bar
3. **Monthly Status** — 2-column stats grid
4. **Monthly Budget** — 2-column card grid, circular progress rings
5. **Recent Activity** — List with compact cards
6. **Quick Checks** — Status indicators
7. **Explore** — Link to Analytics

`sectionSpacing = 28` between sections. FAB in bottom-right corner.

## Receipt Review Layout

1. **Header** — Merchant name (editable), date, order number
2. **Items** — Card list with classification chips and person selectors
3. **Bulk Actions** — Button row (All Mine, All Shared, Clear)
4. **Summary** — Subtotal, tax, fees, tips, discount, total
5. **Category** — Selector
6. **Create button** — Primary action at bottom

## Split Tracker Layout

1. **Filter chips** — Pending / Settled / All (horizontal scrollable)
2. **Person list** — Grouped cards, each showing name, pending total, settled total
3. **Person detail** (push):
   - Header: name, pending owed, settled, entry count
   - Context subtitle: "Showing pending/settled/all splits" (16pt bottom margin)
   - Transaction cards: title + amount top row, date • category, split context
   - Compact Pending chip (warning/gold) + Settle button (income/green, right-aligned)

## Mobile-First Web Guidance

- Use the dark espresso color palette as CSS custom properties
- Cards on dashboard: 2-column grid on wider screens, single column on mobile
- Receipt review: horizontal scroll for items on mobile, grid on desktop
- Split method selection: 2x2 chip grid
- Person selection: horizontal scrollable chips
- Bottom sheet style for add/edit forms on mobile
- Navigation: hamburger or bottom tab bar for mobile, sidebar for desktop
- All filter panels: slide-in drawer or modal on mobile
