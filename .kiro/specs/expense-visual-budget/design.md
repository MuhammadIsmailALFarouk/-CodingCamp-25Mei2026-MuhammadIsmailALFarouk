# Design Document: Expense & Visual Budget

## Overview

Expense & Visual Budget is a fully client-side single-page application (SPA) built with HTML, CSS, and Vanilla JavaScript. It enables users to record personal expenses, visualise spending by category via a live pie chart, manage custom categories, set per-category spending limits, filter by month, sort transactions, and toggle between dark and light themes — all without a backend. All state is persisted in the browser's `localStorage`.

The application is delivered as a single HTML file (`index.html`) with one external CSS file (`css/style.css`) and one external JavaScript file (`js/app.js`). [Chart.js v4](https://www.chartjs.org/docs/latest/) is loaded from a CDN for the pie chart component.

### Key Design Goals

- **Zero dependencies beyond Chart.js** — no frameworks, no build step.
- **Single source of truth** — `localStorage` is the canonical store; the in-memory state is always derived from it on load and kept in sync on every mutation.
- **Immediate UI feedback** — every mutation (add, delete, sort, theme change) updates the DOM synchronously within the browser's rendering cycle, well inside the 200 ms / 100 ms SLA requirements.
- **Graceful degradation** — all `localStorage` calls are wrapped in `try/catch`; failures surface as user-visible notifications without crashing the app.

---

## Architecture

The application follows a simple **event-driven MVC-lite** pattern inside a single JavaScript module:

```
┌─────────────────────────────────────────────────────────┐
│                        index.html                        │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  Input_Form  │  │Transaction_  │  │  Chart canvas │  │
│  │  (HTML form) │  │  List (ul)   │  │  (Chart.js)   │  │
│  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘  │
│         │                 │                  │           │
│  ───────┴─────────────────┴──────────────────┴────────── │
│                     js/app.js                            │
│  ┌──────────────────────────────────────────────────┐    │
│  │  State  { transactions[], categories[], limits,  │    │
│  │           theme, activeSort, activeMonth }        │    │
│  ├──────────────────────────────────────────────────┤    │
│  │  Storage  (localStorage wrapper with try/catch)  │    │
│  ├──────────────────────────────────────────────────┤    │
│  │  Render   (pure DOM-update functions)            │    │
│  ├──────────────────────────────────────────────────┤    │
│  │  Handlers (event listeners → mutate state →      │    │
│  │            persist → render)                     │    │
│  └──────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Action
    │
    ▼
Event Handler
    │  validate input
    ▼
Mutate in-memory State
    │
    ▼
Persist to localStorage  ──► on failure: show notification, rollback state
    │
    ▼
Re-render affected UI regions (balance, list, chart, alerts)
```

All rendering functions are **idempotent** — they fully rebuild their target DOM region from the current state, so there is no risk of stale UI.

---

## Components and Interfaces

### 1. HTML Structure (`index.html`)

```
<body data-theme="light|dark">
  <header>
    <h1>Expense & Visual Budget</h1>
    <button id="theme-toggle">🌙 / ☀️</button>
  </header>

  <main>
    <!-- Balance -->
    <section id="balance-section">
      <span id="balance-display">$0.00</span>
    </section>

    <!-- Input Form -->
    <section id="form-section">
      <form id="transaction-form">
        <input id="item-name" type="text" placeholder="Item name" />
        <input id="item-amount" type="number" step="0.01" min="0.01" />
        <select id="item-category">
          <option>Food</option>
          <option>Transport</option>
          <option>Fun</option>
          <!-- custom categories appended here -->
        </select>
        <button type="submit">Add</button>
      </form>
      <div id="form-errors" aria-live="polite"></div>
    </section>

    <!-- Custom Category -->
    <section id="custom-category-section">
      <input id="custom-cat-input" type="text" maxlength="50" />
      <button id="custom-cat-btn">Add Category</button>
      <div id="custom-cat-error" aria-live="polite"></div>
    </section>

    <!-- Spending Limits -->
    <section id="limits-section">
      <select id="limit-category-select"></select>
      <input id="limit-amount-input" type="number" step="0.01" min="0.01" />
      <button id="limit-save-btn">Set Limit</button>
      <div id="limit-error" aria-live="polite"></div>
    </section>

    <!-- Monthly Summary -->
    <section id="monthly-section">
      <input id="month-picker" type="month" />
      <button id="month-clear-btn">Show All</button>
      <div id="monthly-error" aria-live="polite"></div>
    </section>

    <!-- Sort Controls -->
    <section id="sort-section">
      <button data-sort="amount-asc">Amount ↑</button>
      <button data-sort="amount-desc">Amount ↓</button>
      <button data-sort="category-az">Category A–Z</button>
      <button data-sort="category-za">Category Z–A</button>
    </section>

    <!-- Transaction List -->
    <ul id="transaction-list" aria-label="Transaction list"></ul>

    <!-- Chart -->
    <section id="chart-section">
      <canvas id="spending-chart"></canvas>
      <p id="chart-placeholder" hidden>No data to display</p>
    </section>
  </main>

  <!-- Global notification -->
  <div id="notification" role="alert" aria-live="assertive" hidden></div>

  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"></script>
  <script src="js/app.js"></script>
</body>
```

### 2. JavaScript Module (`js/app.js`)

The file is structured into clearly separated sections:

#### 2.1 Constants

```js
const STORAGE_KEYS = {
  TRANSACTIONS: 'evb_transactions',
  CATEGORIES:   'evb_categories',
  LIMITS:       'evb_limits',
  THEME:        'evb_theme',
};
const DEFAULT_CATEGORIES = ['Food', 'Transport', 'Fun'];
const MAX_CUSTOM_CATEGORIES = 50;
const AMOUNT_MIN = 0.01;
const AMOUNT_MAX = 999_999_999.99;
```

#### 2.2 In-Memory State

```js
const state = {
  transactions: [],   // Transaction[]
  categories: [],     // string[]  (default + custom)
  limits: {},         // { [category: string]: number }
  theme: 'light',     // 'light' | 'dark'
  activeSort: null,   // SortKey | null
  activeMonth: null,  // 'YYYY-MM' | null
};
```

#### 2.3 Storage Layer

```js
// All functions return { ok: boolean, data?, error? }
function storageGet(key) { ... }
function storageSet(key, value) { ... }
function storageRemove(key) { ... }
function isStorageAvailable() { ... }
```

Every call is wrapped in `try/catch`. On `QuotaExceededError` or `SecurityError`, the function returns `{ ok: false, error }`.

#### 2.4 Validation

```js
function validateTransaction({ name, amount, category }) { ... }
// returns { valid: boolean, errors: string[] }

function validateAmount(value) { ... }
// returns { valid: boolean, error?: string }

function validateCategoryName(name, existingCategories) { ... }
// returns { valid: boolean, error?: string }
```

#### 2.5 Business Logic / Computations

```js
function computeBalance(transactions) { ... }
// returns number

function computeCategoryTotals(transactions) { ... }
// returns { [category: string]: number }

function applySort(transactions, sortKey) { ... }
// returns Transaction[] (new sorted array, does not mutate)

function applyMonthFilter(transactions, monthStr) { ... }
// returns Transaction[] filtered to the given 'YYYY-MM'

function isOverLimit(category, totals, limits) { ... }
// returns boolean
```

#### 2.6 Render Functions

```js
function renderBalance(transactions) { ... }
function renderTransactionList(transactions, limits, totals) { ... }
function renderChart(transactions) { ... }
function renderCategorySelectors(categories) { ... }
function renderSortControls(activeSort) { ... }
function renderTheme(theme) { ... }
function showNotification(message, type) { ... }  // type: 'error' | 'info'
function clearNotification() { ... }
```

Each render function reads from `state` and writes to the DOM. They are called after every state mutation.

#### 2.7 Event Handlers

```js
function handleFormSubmit(event) { ... }
function handleDeleteTransaction(id) { ... }
function handleAddCustomCategory() { ... }
function handleSetSpendingLimit() { ... }
function handleMonthChange() { ... }
function handleMonthClear() { ... }
function handleSortClick(sortKey) { ... }
function handleThemeToggle() { ... }
```

#### 2.8 Initialisation

```js
function init() {
  // 1. Load theme → apply before any render
  // 2. Load transactions, categories, limits from localStorage
  // 3. Populate state
  // 4. Render all UI regions
  // 5. Attach event listeners
}
document.addEventListener('DOMContentLoaded', init);
```

### 3. CSS (`css/style.css`)

- CSS custom properties (variables) drive theming:
  ```css
  :root { --bg: #fff; --text: #111; --card: #f5f5f5; ... }
  [data-theme="dark"] { --bg: #1a1a2e; --text: #eee; --card: #16213e; ... }
  ```
- `data-theme` attribute on `<body>` is toggled by `renderTheme()`.
- `.over-limit` class applied to transaction list items and chart segments when spending exceeds the limit.
- Transition on `body` background/color for smooth theme switch within 100 ms.

---

## Data Models

### Transaction

```js
/**
 * @typedef {Object} Transaction
 * @property {string} id         - UUID (crypto.randomUUID() or Date.now() fallback)
 * @property {string} name       - Item name (non-empty, trimmed)
 * @property {number} amount     - Positive number, 0.01–999,999,999.99
 * @property {string} category   - Category label
 * @property {string} date       - ISO 8601 date string (new Date().toISOString())
 */
```

### Category

Categories are stored as a plain `string[]` in `localStorage` under `evb_categories`. The default categories (`Food`, `Transport`, `Fun`) are never written to storage — they are merged at runtime:

```js
state.categories = [...DEFAULT_CATEGORIES, ...loadedCustomCategories];
```

### Spending Limits

```js
/**
 * @typedef {Object} LimitsMap
 * { [categoryName: string]: number }
 * Stored as JSON under evb_limits.
 */
```

### Theme

A single string `'light'` or `'dark'` stored under `evb_theme`.

### localStorage Schema

| Key | Type | Description |
|---|---|---|
| `evb_transactions` | `Transaction[]` (JSON) | All recorded transactions |
| `evb_categories` | `string[]` (JSON) | Custom category names only |
| `evb_limits` | `LimitsMap` (JSON) | Per-category spending limits |
| `evb_theme` | `string` | `'light'` or `'dark'` |

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Balance equals sum of all transaction amounts

*For any* list of transactions, the displayed balance SHALL equal the arithmetic sum of all transaction amounts in that list.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

---

### Property 2: Adding a valid transaction grows the list by exactly one

*For any* existing transaction list and any valid transaction input (non-empty name, amount in [0.01, 999,999,999.99], non-empty category), adding the transaction SHALL result in the transaction list length increasing by exactly one and the new transaction appearing in the list.

**Validates: Requirements 1.3**

---

### Property 3: Whitespace-only or invalid inputs are always rejected

*For any* input where the name is empty or whitespace-only, or the amount is zero, negative, non-numeric, or outside [0.01, 999,999,999.99], the transaction list SHALL remain unchanged after a submission attempt.

**Validates: Requirements 1.4, 1.5**

---

### Property 4: Transaction addition round-trip through localStorage

*For any* valid transaction that is successfully added, serialising the transaction list to `localStorage` and then deserialising it SHALL produce a list containing a transaction with the same `name`, `amount`, `category`, and `date` fields.

**Validates: Requirements 5.1, 5.2, 5.3**

---

### Property 5: Deleting a transaction removes it from the list

*For any* transaction list containing at least one transaction, deleting a transaction by its `id` SHALL result in a list that no longer contains that `id` and whose length is exactly one less than before.

**Validates: Requirements 2.3**

---

### Property 6: Chart segments reflect category totals proportionally

*For any* non-empty transaction list, the set of category labels rendered in the chart SHALL exactly match the set of categories that have a positive total amount, and each segment's proportional size SHALL equal that category's total divided by the overall total.

**Validates: Requirements 4.1, 4.8**

---

### Property 7: Monthly filter returns only transactions in the selected month

*For any* transaction list and any selected month/year, the filtered result SHALL contain only transactions whose `date` field falls within that calendar month, and SHALL contain all such transactions.

**Validates: Requirements 7.2, 7.5**

---

### Property 8: Custom category name uniqueness (case-insensitive)

*For any* set of existing categories (default + custom), attempting to add a category whose name matches any existing category name (case-insensitively) SHALL be rejected and the category list SHALL remain unchanged.

**Validates: Requirements 6.6**

---

### Property 9: Spending limit alert consistency

*For any* category and any transaction list, the over-limit visual indicator SHALL be applied to all transactions in that category if and only if the sum of their amounts is greater than or equal to the category's spending limit.

**Validates: Requirements 9.3, 9.4, 9.5, 9.7**

---

### Property 10: Sort stability — sorted list is a permutation of the original

*For any* transaction list and any sort key, the sorted result SHALL contain exactly the same transactions as the original list (same `id` set), only in a different order.

**Validates: Requirements 8.2**

---

## Error Handling

### localStorage Failures

All `localStorage` operations are wrapped in a `StorageService` with `try/catch`:

```js
function storageSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
```

**On write failure (add transaction, delete, save category, save limit, save theme):**
- State mutation is rolled back (the in-memory state is not updated).
- A user-visible error notification is shown via `showNotification()`.
- The UI is not updated to reflect the failed operation.

**On read failure / malformed data (app init):**
- The app initialises with empty state (`transactions: []`, default categories, no limits).
- An error notification is shown describing the storage failure.
- The app remains fully functional for the current session (in-memory only).

### Input Validation Failures

- Validation errors are displayed inline in `#form-errors` or the relevant error `<div>`.
- `aria-live="polite"` ensures screen readers announce errors.
- No state mutation occurs on validation failure.

### Chart Rendering

- If `transactions` is empty, the `<canvas>` is hidden and `#chart-placeholder` is shown.
- The Chart.js instance is created once on init and updated via `chart.data = ...` + `chart.update()` on every state change, avoiding memory leaks from repeated instantiation.

---

## Testing Strategy

### Unit Tests

Unit tests cover pure functions with no DOM or storage dependencies:

| Function | What to test |
|---|---|
| `computeBalance(transactions)` | Empty list → 0; single item; multiple items; floating-point precision |
| `computeCategoryTotals(transactions)` | Grouping correctness; zero-amount exclusion |
| `validateTransaction(input)` | All valid/invalid combinations per requirement |
| `validateAmount(value)` | Boundary values: 0, 0.01, 999999999.99, 1000000000 |
| `validateCategoryName(name, existing)` | Empty, whitespace, duplicate (case-insensitive), valid |
| `applySort(transactions, key)` | Each of the four sort keys; empty list; single item |
| `applyMonthFilter(transactions, month)` | Matching, non-matching, boundary dates |
| `isOverLimit(category, totals, limits)` | At limit, below limit, above limit, no limit set |

### Property-Based Tests

Property-based testing is applied using [fast-check](https://fast-check.io/) (a well-maintained JavaScript PBT library). Each property test runs a minimum of **100 iterations**.

Each test is tagged with a comment in the format:
`// Feature: expense-visual-budget, Property N: <property_text>`

| Property | Test description |
|---|---|
| **Property 1** | Generate arbitrary `Transaction[]`, assert `computeBalance` equals `array.reduce((s, t) => s + t.amount, 0)` |
| **Property 2** | Generate a valid transaction and an existing list; assert list length increases by 1 and new item is present |
| **Property 3** | Generate invalid inputs (whitespace names, bad amounts); assert `validateTransaction` returns `valid: false` and list is unchanged |
| **Property 4** | Generate a valid transaction; add it; serialise/deserialise via `JSON.stringify`/`JSON.parse`; assert fields match |
| **Property 5** | Generate a non-empty list; pick a random transaction; delete it; assert it is absent and length decreased by 1 |
| **Property 6** | Generate arbitrary `Transaction[]`; assert chart category set equals categories with positive totals |
| **Property 7** | Generate `Transaction[]` with random dates and a random month; assert filter returns exactly the matching subset |
| **Property 8** | Generate a list of category names; attempt to add a duplicate (any case variant); assert rejection and list unchanged |
| **Property 9** | Generate transactions and a limit; assert over-limit indicator is applied iff sum ≥ limit |
| **Property 10** | Generate a `Transaction[]` and a sort key; assert sorted result is a permutation (same `id` set) |

### Integration / Smoke Tests

- **Smoke**: App loads without errors in a browser with `localStorage` available.
- **Smoke**: App loads without errors when `localStorage` is unavailable (private mode simulation).
- **Integration**: Full add → persist → reload → verify cycle using a real `localStorage` mock.
- **Integration**: Theme persists across simulated page reloads.
