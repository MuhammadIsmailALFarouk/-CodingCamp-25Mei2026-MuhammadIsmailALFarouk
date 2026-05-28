# Implementation Plan: Expense & Visual Budget

## Overview

Implement a fully client-side SPA using HTML, CSS, and Vanilla JavaScript. The app is delivered as three files: `index.html`, `css/style.css`, and `js/app.js`. Implementation proceeds in layers — HTML structure first, then CSS theming, then the JS storage/state/validation core, then business logic and rendering, then event wiring, and finally integration and property-based tests.

---

## Tasks

- [x] 1. Scaffold project structure and HTML skeleton
  - Create `index.html` with the full semantic HTML structure: `<header>`, `<main>`, all `<section>` elements, `<ul id="transaction-list">`, `<canvas id="spending-chart">`, and the global `#notification` div as specified in the design
  - Add the Chart.js v4 CDN `<script>` tag and the `<script src="js/app.js">` tag at the bottom of `<body>`
  - Create `css/style.css` as an empty file and link it from `index.html`
  - Create `js/app.js` as an empty file
  - _Requirements: TC-4_

- [x] 2. Implement CSS theming and base styles
  - [x] 2.1 Define CSS custom properties and theme variables
    - Write `:root` with light-theme variables (`--bg`, `--text`, `--card`, etc.) and `[data-theme="dark"]` overrides as specified in the design
    - Add `transition` on `body` background/color for smooth theme switch within 100 ms
    - Add `.over-limit` class styles (distinct visual indicator for over-budget items)
    - _Requirements: 10.2, 9.3, 9.4_

  - [x] 2.2 Style layout, form, list, and chart sections
    - Style all sections, the transaction list (scrollable), sort buttons with active-state marker, and the chart placeholder
    - Ensure the balance display is prominent at the top
    - _Requirements: 2.2, 3.1, 8.4_

- [x] 3. Implement constants, state, and storage layer in `js/app.js`
  - [x] 3.1 Define constants and in-memory state object
    - Write `STORAGE_KEYS`, `DEFAULT_CATEGORIES`, `MAX_CUSTOM_CATEGORIES`, `AMOUNT_MIN`, `AMOUNT_MAX` constants
    - Define the `state` object: `{ transactions, categories, limits, theme, activeSort, activeMonth }`
    - _Requirements: 1.2, 6.7, TC-1_

  - [x] 3.2 Implement the storage layer (`storageGet`, `storageSet`, `storageRemove`, `isStorageAvailable`)
    - Wrap every `localStorage` call in `try/catch`; return `{ ok: boolean, data?, error? }` from each function
    - Handle `QuotaExceededError` and `SecurityError` explicitly
    - _Requirements: 1.7, 2.4, 5.4, 6.8, 9.2, 10.3, 10.6_

  - [ ]* 3.3 Write property test for transaction round-trip through localStorage (Property 4)
    - **Property 4: Transaction addition round-trip through localStorage**
    - **Validates: Requirements 5.1, 5.2, 5.3**
    - Use fast-check: generate a valid transaction, serialise via `JSON.stringify`, deserialise via `JSON.parse`, assert `name`, `amount`, `category`, `date` fields match
    - Tag: `// Feature: expense-visual-budget, Property 4: Transaction addition round-trip through localStorage`

- [x] 4. Implement validation functions
  - [x] 4.1 Implement `validateTransaction`, `validateAmount`, and `validateCategoryName`
    - `validateTransaction({ name, amount, category })` → `{ valid, errors[] }`: reject empty/whitespace name, invalid amount, empty category
    - `validateAmount(value)` → `{ valid, error? }`: accept only numbers in [0.01, 999,999,999.99]
    - `validateCategoryName(name, existingCategories)` → `{ valid, error? }`: reject empty/whitespace, duplicates (case-insensitive), names > 50 chars
    - _Requirements: 1.4, 1.5, 6.5, 6.6, 9.6_

  - [ ]* 4.2 Write property test for invalid inputs always rejected (Property 3)
    - **Property 3: Whitespace-only or invalid inputs are always rejected**
    - **Validates: Requirements 1.4, 1.5**
    - Use fast-check: generate whitespace-only names and out-of-range amounts; assert `validateTransaction` returns `valid: false` and transaction list is unchanged
    - Tag: `// Feature: expense-visual-budget, Property 3: Whitespace-only or invalid inputs are always rejected`

  - [ ]* 4.3 Write property test for custom category name uniqueness (Property 8)
    - **Property 8: Custom category name uniqueness (case-insensitive)**
    - **Validates: Requirements 6.6**
    - Use fast-check: generate a list of category names; attempt to add a duplicate in any case variant; assert `validateCategoryName` returns `valid: false` and list is unchanged
    - Tag: `// Feature: expense-visual-budget, Property 8: Custom category name uniqueness (case-insensitive)`

- [ ] 5. Implement business logic / computation functions
  - [ ] 5.1 Implement `computeBalance` and `computeCategoryTotals`
    - `computeBalance(transactions)` → sum of all `amount` fields; return `0` for empty list
    - `computeCategoryTotals(transactions)` → `{ [category]: number }` map; exclude zero-amount categories
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.8_

  - [ ]* 5.2 Write property test for balance equals sum of amounts (Property 1)
    - **Property 1: Balance equals sum of all transaction amounts**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
    - Use fast-check: generate arbitrary `Transaction[]`; assert `computeBalance` equals `array.reduce((s, t) => s + t.amount, 0)`
    - Tag: `// Feature: expense-visual-budget, Property 1: Balance equals sum of all transaction amounts`

  - [ ]* 5.3 Write property test for chart segments reflect category totals (Property 6)
    - **Property 6: Chart segments reflect category totals proportionally**
    - **Validates: Requirements 4.1, 4.8**
    - Use fast-check: generate arbitrary `Transaction[]`; assert `computeCategoryTotals` result keys exactly match categories with positive totals
    - Tag: `// Feature: expense-visual-budget, Property 6: Chart segments reflect category totals proportionally`

  - [ ] 5.4 Implement `applySort` and `applyMonthFilter`
    - `applySort(transactions, sortKey)` → new sorted array (does not mutate); support `amount-asc`, `amount-desc`, `category-az`, `category-za`
    - `applyMonthFilter(transactions, monthStr)` → array filtered to `'YYYY-MM'`; return all transactions when `monthStr` is null
    - _Requirements: 7.2, 7.5, 8.1, 8.2, 8.5_

  - [ ]* 5.5 Write property test for sort stability — sorted list is a permutation (Property 10)
    - **Property 10: Sort stability — sorted list is a permutation of the original**
    - **Validates: Requirements 8.2**
    - Use fast-check: generate a `Transaction[]` and a sort key; assert sorted result contains exactly the same `id` set as the original
    - Tag: `// Feature: expense-visual-budget, Property 10: Sort stability — sorted list is a permutation of the original`

  - [ ]* 5.6 Write property test for monthly filter correctness (Property 7)
    - **Property 7: Monthly filter returns only transactions in the selected month**
    - **Validates: Requirements 7.2, 7.5**
    - Use fast-check: generate `Transaction[]` with random ISO dates and a random `'YYYY-MM'`; assert `applyMonthFilter` returns exactly the matching subset
    - Tag: `// Feature: expense-visual-budget, Property 7: Monthly filter returns only transactions in the selected month`

  - [ ] 5.7 Implement `isOverLimit`
    - `isOverLimit(category, totals, limits)` → `boolean`; return `false` when no limit is set for the category
    - _Requirements: 9.3, 9.4, 9.5, 9.7_

  - [ ]* 5.8 Write property test for spending limit alert consistency (Property 9)
    - **Property 9: Spending limit alert consistency**
    - **Validates: Requirements 9.3, 9.4, 9.5, 9.7**
    - Use fast-check: generate transactions and a limit; assert `isOverLimit` returns `true` iff category total ≥ limit
    - Tag: `// Feature: expense-visual-budget, Property 9: Spending limit alert consistency`

- [ ] 6. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Implement render functions
  - [ ] 7.1 Implement `renderBalance` and `renderCategorySelectors`
    - `renderBalance(transactions)`: update `#balance-display` with formatted currency sum
    - `renderCategorySelectors(categories)`: rebuild `<select>` options in `#item-category` and `#limit-category-select` from `state.categories`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 6.2, 6.4_

  - [ ] 7.2 Implement `renderTransactionList`
    - Build `<li>` elements for each transaction showing name, amount, category, date, and a delete button
    - Apply `.over-limit` class to items whose category total meets or exceeds its limit
    - Show empty-state message when list is empty
    - Apply current `state.activeSort` and `state.activeMonth` before rendering
    - _Requirements: 2.1, 2.2, 2.5, 8.3, 9.3_

  - [ ] 7.3 Implement `renderChart`
    - Create Chart.js pie chart instance once on init; update `chart.data` and call `chart.update()` on subsequent renders
    - Show `#chart-placeholder` and hide `<canvas>` when no transactions exist
    - Apply `.over-limit` styling to segments whose category is over limit
    - Include legend with category name, unique colour, and percentage share
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.8, 9.4_

  - [ ] 7.4 Implement `renderSortControls` and `renderTheme`
    - `renderSortControls(activeSort)`: highlight the active sort button with a distinct visual marker
    - `renderTheme(theme)`: set `document.body.dataset.theme` to `'light'` or `'dark'`
    - _Requirements: 8.4, 10.2_

  - [ ] 7.5 Implement `showNotification` and `clearNotification`
    - `showNotification(message, type)`: show `#notification` with the message; `type` is `'error'` or `'info'`
    - `clearNotification()`: hide `#notification`
    - _Requirements: 1.7, 2.4, 5.4, 6.8_

- [ ] 8. Implement event handlers and `init`
  - [ ] 8.1 Implement `handleFormSubmit` and `handleDeleteTransaction`
    - `handleFormSubmit`: validate input → mutate state → persist → rollback + notify on storage failure → re-render balance, list, chart
    - `handleDeleteTransaction(id)`: remove from state → persist → rollback + notify on failure → re-render balance, list, chart
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 1.7, 2.3, 2.4, 3.2, 3.3, 4.2, 4.3_

  - [ ]* 8.2 Write property test for adding a valid transaction grows list by one (Property 2)
    - **Property 2: Adding a valid transaction grows the list by exactly one**
    - **Validates: Requirements 1.3**
    - Use fast-check: generate a valid transaction and an existing list; call `handleFormSubmit` logic (or the state-mutation path); assert list length increases by 1 and new item is present
    - Tag: `// Feature: expense-visual-budget, Property 2: Adding a valid transaction grows the list by exactly one`

  - [ ]* 8.3 Write property test for deleting a transaction removes it from the list (Property 5)
    - **Property 5: Deleting a transaction removes it from the list**
    - **Validates: Requirements 2.3**
    - Use fast-check: generate a non-empty list; pick a random transaction; call `handleDeleteTransaction` logic; assert the `id` is absent and length decreased by 1
    - Tag: `// Feature: expense-visual-budget, Property 5: Deleting a transaction removes it from the list`

  - [ ] 8.4 Implement `handleAddCustomCategory` and `handleSetSpendingLimit`
    - `handleAddCustomCategory`: validate name → check duplicate/limit → mutate state → persist → rollback + notify on failure → re-render selectors
    - `handleSetSpendingLimit`: validate amount → mutate state → persist → rollback + notify on failure → re-render list and chart (apply/remove `.over-limit`)
    - _Requirements: 6.1, 6.2, 6.3, 6.5, 6.6, 6.7, 6.8, 9.1, 9.2, 9.5, 9.6_

  - [ ] 8.5 Implement `handleMonthChange`, `handleMonthClear`, `handleSortClick`, and `handleThemeToggle`
    - `handleMonthChange`: set `state.activeMonth` → re-render list and chart
    - `handleMonthClear`: clear `state.activeMonth` → re-render list and chart
    - `handleSortClick(sortKey)`: set `state.activeSort` → re-render list and sort controls
    - `handleThemeToggle`: toggle `state.theme` → persist → re-render theme
    - _Requirements: 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 8.1, 8.2, 8.3, 8.4, 8.5, 10.1, 10.2, 10.3_

  - [ ] 8.6 Implement `init` and attach all event listeners
    - Load theme first (apply before any render), then load transactions/categories/limits from localStorage
    - Populate `state`, render all UI regions, attach all event listeners
    - Handle localStorage unavailability and malformed data gracefully; show error notification and initialise with empty state
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 10.4, 10.5, 10.6_

- [ ] 9. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Write unit tests for pure functions
  - [ ]* 10.1 Write unit tests for `computeBalance`
    - Test: empty list → 0; single item; multiple items; floating-point precision
    - _Requirements: 3.1, 3.4_

  - [ ]* 10.2 Write unit tests for `computeCategoryTotals`
    - Test: grouping correctness; zero-amount exclusion
    - _Requirements: 4.1, 4.8_

  - [ ]* 10.3 Write unit tests for `validateTransaction` and `validateAmount`
    - Test all valid/invalid combinations; boundary values: 0, 0.01, 999999999.99, 1000000000
    - _Requirements: 1.4, 1.5_

  - [ ]* 10.4 Write unit tests for `validateCategoryName`
    - Test: empty, whitespace, duplicate (case-insensitive), valid, > 50 chars
    - _Requirements: 6.5, 6.6, 6.7_

  - [ ]* 10.5 Write unit tests for `applySort`
    - Test each of the four sort keys; empty list; single item
    - _Requirements: 8.1, 8.2_

  - [ ]* 10.6 Write unit tests for `applyMonthFilter`
    - Test: matching, non-matching, boundary dates, null month returns all
    - _Requirements: 7.2, 7.5_

  - [ ]* 10.7 Write unit tests for `isOverLimit`
    - Test: at limit, below limit, above limit, no limit set
    - _Requirements: 9.3, 9.5_

- [ ] 11. Write integration and smoke tests
  - [ ]* 11.1 Write smoke tests for app load with and without localStorage
    - Test: app loads without errors when localStorage is available
    - Test: app loads without errors when localStorage is unavailable (private mode simulation)
    - _Requirements: 5.4, 10.6_

  - [ ]* 11.2 Write integration test for full add → persist → reload → verify cycle
    - Use a real localStorage mock; add a transaction, simulate reload, verify transaction is present and balance is correct
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ]* 11.3 Write integration test for theme persistence across simulated page reloads
    - Toggle theme, simulate reload, verify theme is applied before any render
    - _Requirements: 10.3, 10.4_

- [ ] 12. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests use [fast-check](https://fast-check.io/) and run a minimum of 100 iterations each
- Unit tests complement property tests by covering specific examples and edge cases
- The Chart.js instance is created once in `renderChart` and updated in-place to avoid memory leaks
- All state mutations follow the pattern: validate → mutate state → persist → rollback on failure → re-render

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "2.2", "3.1"] },
    { "id": 2, "tasks": ["3.2"] },
    { "id": 3, "tasks": ["3.3", "4.1"] },
    { "id": 4, "tasks": ["4.2", "4.3", "5.1"] },
    { "id": 5, "tasks": ["5.2", "5.3", "5.4", "5.7"] },
    { "id": 6, "tasks": ["5.5", "5.6", "5.8"] },
    { "id": 7, "tasks": ["7.1", "7.2", "7.3", "7.4", "7.5"] },
    { "id": 8, "tasks": ["8.1", "8.4", "8.5", "8.6"] },
    { "id": 9, "tasks": ["8.2", "8.3"] },
    { "id": 10, "tasks": ["10.1", "10.2", "10.3", "10.4", "10.5", "10.6", "10.7"] },
    { "id": 11, "tasks": ["11.1", "11.2", "11.3"] }
  ]
}
```
