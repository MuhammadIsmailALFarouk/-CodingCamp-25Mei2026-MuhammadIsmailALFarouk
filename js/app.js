// js/app.js — Expense & Visual Budget application logic

// === Constants ===

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

// === State ===

const state = {
  transactions: [],   // Transaction[]
  categories: [],     // string[]  (default + custom)
  limits: {},         // { [category: string]: number }
  theme: 'light',     // 'light' | 'dark'
  activeSort: null,   // SortKey | null
  activeMonth: null,  // 'YYYY-MM' | null
};

// === Storage Layer ===
// All functions return { ok: boolean, data?, error? }
// Every localStorage call is wrapped in try/catch.
// QuotaExceededError and SecurityError are handled explicitly.

/**
 * Retrieve and JSON-parse a value from localStorage.
 * @param {string} key
 * @returns {{ ok: true, data: * } | { ok: false, error: string }}
 */
function storageGet(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      return { ok: true, data: null };
    }
    const data = JSON.parse(raw);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * JSON-stringify and write a value to localStorage.
 * Handles QuotaExceededError and SecurityError explicitly.
 * @param {string} key
 * @param {*} value
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
function storageSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return { ok: true };
  } catch (e) {
    // Handle quota and security errors explicitly
    if (
      e instanceof DOMException &&
      (e.name === 'QuotaExceededError' ||
        e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        e.name === 'SecurityError')
    ) {
      return { ok: false, error: e.message };
    }
    return { ok: false, error: e.message };
  }
}

/**
 * Remove a key from localStorage.
 * @param {string} key
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
function storageRemove(key) {
  try {
    localStorage.removeItem(key);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Test whether localStorage is accessible by writing, reading, and removing a
 * sentinel key. Returns { ok: true } if storage is available, or
 * { ok: false, error } if any step throws (e.g. SecurityError in private mode).
 * @returns {{ ok: boolean, error?: string }}
 */
function isStorageAvailable() {
  const TEST_KEY = '__evb_storage_test__';
  try {
    localStorage.setItem(TEST_KEY, '1');
    const val = localStorage.getItem(TEST_KEY);
    localStorage.removeItem(TEST_KEY);
    if (val !== '1') {
      return { ok: false, error: 'localStorage read-back mismatch' };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// === VALIDATION ===

/**
 * Validate a transaction input object.
 * @param {{ name: string, amount: *, category: string }} param0
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateTransaction({ name, amount, category }) {
  const errors = [];

  // Validate name: must be non-empty after trimming
  if (!name || name.trim() === '') {
    errors.push('Item name is required');
  }

  // Validate amount via validateAmount
  const amountResult = validateAmount(amount);
  if (!amountResult.valid) {
    errors.push(amountResult.error);
  }

  // Validate category: must be non-empty/falsy
  if (!category) {
    errors.push('Category is required');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a monetary amount value.
 * Accepts only numbers in the range [AMOUNT_MIN, AMOUNT_MAX].
 * @param {*} value
 * @returns {{ valid: boolean, error?: string }}
 */
function validateAmount(value) {
  // Reject null, undefined, or empty string
  if (value === null || value === undefined || value === '') {
    return { valid: false, error: 'Amount is required' };
  }

  // Parse as float and check for NaN / non-finite
  const num = parseFloat(value);
  if (isNaN(num) || !isFinite(num)) {
    return { valid: false, error: 'Amount must be a number' };
  }

  // Check range
  if (num < AMOUNT_MIN || num > AMOUNT_MAX) {
    return { valid: false, error: `Amount must be between ${AMOUNT_MIN} and ${AMOUNT_MAX}` };
  }

  return { valid: true };
}

/**
 * Validate a custom category name against existing categories.
 * Rejects empty/whitespace names, names longer than 50 characters,
 * and names that already exist (case-insensitive).
 * @param {string} name
 * @param {string[]} existingCategories
 * @returns {{ valid: boolean, error?: string }}
 */
function validateCategoryName(name, existingCategories) {
  // Reject empty or whitespace-only names
  const trimmed = (name || '').trim();
  if (trimmed === '') {
    return { valid: false, error: 'Category name is required' };
  }

  // Reject names longer than 50 characters
  if (trimmed.length > 50) {
    return { valid: false, error: 'Category name must be 50 characters or fewer' };
  }

  // Reject duplicates (case-insensitive)
  const lowerTrimmed = trimmed.toLowerCase();
  const isDuplicate = existingCategories.some(
    (cat) => cat.toLowerCase() === lowerTrimmed
  );
  if (isDuplicate) {
    return { valid: false, error: 'Category already exists' };
  }

  return { valid: true };
}

// === Chart Instance ===

/** @type {import('chart.js').Chart|null} */
let chartInstance = null;

// === Business Logic / Computations ===

/**
 * Compute the total balance as the arithmetic sum of all transaction amounts.
 * Returns 0 for an empty list.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4
 *
 * @param {Transaction[]} transactions
 * @returns {number}
 */
function computeBalance(transactions) {
  if (!transactions || transactions.length === 0) {
    return 0;
  }
  return transactions.reduce((sum, t) => sum + t.amount, 0);
}

/**
 * Compute per-category spending totals from a list of transactions.
 * Categories with a total of zero are excluded from the result.
 *
 * Validates: Requirements 4.1, 4.8
 *
 * @param {Transaction[]} transactions
 * @returns {{ [category: string]: number }}
 */
function computeCategoryTotals(transactions) {
  if (!transactions || transactions.length === 0) {
    return {};
  }

  const totals = {};

  for (const t of transactions) {
    if (totals[t.category] === undefined) {
      totals[t.category] = 0;
    }
    totals[t.category] += t.amount;
  }

  // Exclude categories whose total is zero
  for (const category of Object.keys(totals)) {
    if (totals[category] === 0) {
      delete totals[category];
    }
  }

  return totals;
}

/**
 * Determine whether a category's spending has met or exceeded its limit.
 *
 * Returns `false` when no limit is set for the category (i.e. the category key
 * is absent from `limits` or its value is not a finite positive number), so
 * callers never need to guard against a missing limit themselves.
 *
 * The indicator is applied when total >= limit (Requirements 9.3, 9.4, 9.7)
 * and removed when total < limit (Requirement 9.5).
 *
 * Validates: Requirements 9.3, 9.4, 9.5, 9.7
 *
 * @param {string} category - The category name to check.
 * @param {{ [category: string]: number }} totals - Per-category spending totals
 *   (as returned by `computeCategoryTotals`).
 * @param {{ [category: string]: number }} limits - Per-category spending limits.
 * @returns {boolean} `true` if the category total is >= its limit; `false` otherwise.
 */
function isOverLimit(category, totals, limits) {
  // No limit set for this category → never over limit
  const limit = limits[category];
  if (limit === undefined || limit === null || !isFinite(limit) || limit <= 0) {
    return false;
  }

  // No spending recorded for this category → not over limit
  const total = totals[category];
  if (total === undefined || total === null) {
    return false;
  }

  return total >= limit;
}

/**
 * Return a new array of transactions sorted by the given sort key.
 * Does NOT mutate the original array.
 *
 * Supported sort keys:
 *   'amount-asc'   — lowest amount first
 *   'amount-desc'  — highest amount first
 *   'category-az'  — category name A → Z (case-insensitive)
 *   'category-za'  — category name Z → A (case-insensitive)
 *
 * @param {Transaction[]} transactions
 * @param {'amount-asc'|'amount-desc'|'category-az'|'category-za'} sortKey
 * @returns {Transaction[]}
 */
function applySort(transactions, sortKey) {
  const copy = [...transactions];

  switch (sortKey) {
    case 'amount-asc':
      copy.sort((a, b) => a.amount - b.amount);
      break;
    case 'amount-desc':
      copy.sort((a, b) => b.amount - a.amount);
      break;
    case 'category-az':
      copy.sort((a, b) =>
        a.category.toLowerCase().localeCompare(b.category.toLowerCase())
      );
      break;
    case 'category-za':
      copy.sort((a, b) =>
        b.category.toLowerCase().localeCompare(a.category.toLowerCase())
      );
      break;
    default:
      // Unknown sort key — return unsorted copy
      break;
  }

  return copy;
}

/**
 * Return a new array containing only the transactions whose `date` field
 * falls within the given calendar month.
 *
 * When `monthStr` is null (or falsy), all transactions are returned unchanged.
 *
 * @param {Transaction[]} transactions
 * @param {string|null} monthStr  - Month in 'YYYY-MM' format, or null to show all
 * @returns {Transaction[]}
 */
function applyMonthFilter(transactions, monthStr) {
  if (!monthStr) {
    return transactions;
  }

  return transactions.filter((t) => {
    // t.date is an ISO 8601 string, e.g. "2025-06-15T10:30:00.000Z"
    // Slice the first 7 characters to get 'YYYY-MM' for comparison
    return t.date.slice(0, 7) === monthStr;
  });
}

// === Render Functions ===

/**
 * Update the #balance-display element with the formatted currency sum of all
 * transaction amounts.
 *
 * Uses `computeBalance` to calculate the total, then formats it as a USD
 * currency string (e.g. "$1,234.56"). Displays "$0.00" when the list is empty.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4
 *
 * @param {Transaction[]} transactions
 */
function renderBalance(transactions) {
  const balanceDisplay = document.getElementById('balance-display');
  if (!balanceDisplay) return;

  const total = computeBalance(transactions);

  // Format as USD currency with 2 decimal places
  balanceDisplay.textContent = total.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Rebuild the <option> elements in both category <select> elements from the
 * provided categories array.
 *
 * Targets:
 *   - #item-category  (transaction input form)
 *   - #limit-category-select  (spending limits section)
 *
 * The existing options are fully replaced on each call so the selectors always
 * reflect the current state.categories (default + custom).
 *
 * Validates: Requirements 6.2, 6.4
 *
 * @param {string[]} categories - Full list of category names (default + custom)
 */
function renderCategorySelectors(categories) {
  const selectors = [
    document.getElementById('item-category'),
    document.getElementById('limit-category-select'),
  ];

  for (const select of selectors) {
    if (!select) continue;

    // Preserve the currently selected value so it survives a rebuild
    const previousValue = select.value;

    // Clear all existing options
    select.innerHTML = '';

    // Append one <option> per category
    for (const category of categories) {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      select.appendChild(option);
    }

    // Restore the previously selected value if it still exists in the new list
    if (categories.includes(previousValue)) {
      select.value = previousValue;
    }
  }
}

/**
 * Highlight the active sort button with a distinct visual marker.
 *
 * Iterates over every button in #sort-section that carries a [data-sort]
 * attribute, removes the 'active' class from all of them, then re-applies it
 * to the button whose data-sort value matches `activeSort`.  When `activeSort`
 * is null (no sort selected) no button is highlighted.
 *
 * Validates: Requirements 8.4
 *
 * @param {string|null} activeSort - The currently active sort key, or null.
 */
function renderSortControls(activeSort) {
  const buttons = document.querySelectorAll('#sort-section [data-sort]');
  buttons.forEach((btn) => {
    if (btn.dataset.sort === activeSort) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

/**
 * Apply the given theme to the document by setting data-theme on <body>.
 *
 * Accepts 'light' or 'dark'.  Any other value is silently coerced to 'light'
 * so the DOM is never left in an undefined theme state.
 *
 * Validates: Requirements 10.2
 *
 * @param {'light'|'dark'} theme
 */
function renderTheme(theme) {
  document.body.dataset.theme = theme === 'dark' ? 'dark' : 'light';
}

/**
 * Show the global notification banner with the given message and type.
 *
 * The `#notification` element uses `role="alert"` and `aria-live="assertive"`
 * so screen readers announce the message immediately. Visibility is controlled
 * via the `hidden` attribute (present = hidden, absent = visible).
 *
 * @param {string} message - The notification text to display.
 * @param {'error'|'info'} type - Visual style: 'error' for failure messages,
 *   'info' for informational messages.
 *
 * Validates: Requirements 1.7, 2.4, 5.4, 6.8
 */
function showNotification(message, type) {
  const el = document.getElementById('notification');
  if (!el) return;

  // Set the message text
  el.textContent = message;

  // Remove any previously applied type classes and apply the new one
  el.classList.remove('notification--error', 'notification--info');
  el.classList.add(`notification--${type}`);

  // Make the element visible by removing the hidden attribute
  el.removeAttribute('hidden');
}

/**
 * Hide the global notification banner.
 *
 * Restores the `hidden` attribute so the element is removed from the
 * accessibility tree and not visible to sighted users.
 *
 * Validates: Requirements 1.7, 2.4, 5.4, 6.8
 */
function clearNotification() {
  const el = document.getElementById('notification');
  if (!el) return;

  el.setAttribute('hidden', '');
  el.textContent = '';
  el.classList.remove('notification--error', 'notification--info');
}

// === Render Functions ===

/**
 * Render the transaction list into `#transaction-list`.
 *
 * Steps:
 *  1. Apply the active month filter (state.activeMonth).
 *  2. Apply the active sort (state.activeSort).
 *  3. Compute category totals for the filtered+sorted set to evaluate over-limit.
 *  4. Build <li> elements; apply `.over-limit` where appropriate.
 *  5. Show an empty-state message when no transactions match.
 *
 * Validates: Requirements 2.1, 2.2, 2.5, 8.3, 9.3
 *
 * @param {Transaction[]} transactions - Full transaction list from state.
 * @param {{ [category: string]: number }} limits - Per-category spending limits.
 */
function renderTransactionList(transactions, limits) {
  const ul = document.getElementById('transaction-list');
  if (!ul) return;

  // 1. Filter by active month
  let visible = applyMonthFilter(transactions, state.activeMonth);

  // 2. Sort by active sort key
  if (state.activeSort) {
    visible = applySort(visible, state.activeSort);
  }

  // 3. Compute category totals for the visible (filtered) set
  const totals = computeCategoryTotals(visible);

  // 4. Clear existing content
  ul.innerHTML = '';

  // 5. Empty-state message
  if (visible.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty-state';
    li.textContent = 'No transactions yet.';
    ul.appendChild(li);
    return;
  }

  // 6. Build one <li> per transaction
  for (const t of visible) {
    const li = document.createElement('li');
    li.dataset.id = t.id;

    // Apply over-limit class when the category total meets or exceeds its limit
    if (isOverLimit(t.category, totals, limits)) {
      li.classList.add('over-limit');
    }

    // Format amount as currency
    const formattedAmount = '$' + t.amount.toFixed(2);

    // Format date as a readable local date string
    const formattedDate = new Date(t.date).toLocaleDateString();

    li.innerHTML =
      '<span class="t-name">' + escapeHtml(t.name) + '</span>' +
      '<span class="t-amount">' + formattedAmount + '</span>' +
      '<span class="t-category">' + escapeHtml(t.category) + '</span>' +
      '<span class="t-date">' + formattedDate + '</span>' +
      '<button class="delete-btn" data-id="' + t.id + '" aria-label="Delete ' + escapeHtml(t.name) + '">Delete</button>';

    ul.appendChild(li);
  }
}

/**
 * Escape special HTML characters to prevent XSS when inserting user-supplied
 * strings via innerHTML.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// === Render Functions ===

/**
 * A fixed palette of distinct colours for chart segments.
 * Cycles if there are more categories than colours.
 */
const CHART_COLOURS = [
  '#4a90e2', // blue
  '#e67e22', // orange
  '#2ecc71', // green
  '#9b59b6', // purple
  '#e74c3c', // red
  '#1abc9c', // teal
  '#f39c12', // yellow
  '#3498db', // light blue
  '#e91e63', // pink
  '#00bcd4', // cyan
];

/**
 * Render (or update) the Chart.js pie chart from the current transaction list.
 *
 * Behaviour:
 * - When `transactions` is empty: hide `<canvas>`, show `#chart-placeholder`.
 * - When `transactions` is non-empty: show `<canvas>`, hide `#chart-placeholder`.
 *   - On first call, create a new Chart.js instance.
 *   - On subsequent calls, update `chart.data` in-place and call `chart.update()`.
 * - Segments whose category is over its spending limit receive a thick
 *   over-limit border colour to match the `.over-limit` visual indicator.
 * - The legend shows each category name with its unique colour and percentage
 *   share of total spending.
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.8, 9.4
 *
 * @param {Transaction[]} transactions - The (already filtered/sorted) list to visualise.
 */
function renderChart(transactions) {
  const canvas      = document.getElementById('spending-chart');
  const placeholder = document.getElementById('chart-placeholder');

  // Compute category totals (excludes zero-amount categories — Req 4.8)
  const totals = computeCategoryTotals(transactions);
  const categories = Object.keys(totals);

  // --- Empty state (Req 4.5) ---
  if (categories.length === 0) {
    canvas.hidden      = true;
    placeholder.hidden = false;

    // Destroy any existing chart so it doesn't linger in memory
    if (chartInstance !== null) {
      chartInstance.destroy();
      chartInstance = null;
    }
    return;
  }

  // --- Non-empty state ---
  canvas.hidden      = false;
  placeholder.hidden = true;

  const total  = categories.reduce((sum, cat) => sum + totals[cat], 0);
  const values = categories.map((cat) => totals[cat]);

  // Assign colours, cycling through the palette
  const backgroundColors = categories.map(
    (_, i) => CHART_COLOURS[i % CHART_COLOURS.length]
  );

  // Over-limit border: use a thick orange-red border for over-budget segments (Req 9.4)
  const OVER_LIMIT_BORDER = '#e65100';
  const DEFAULT_BORDER    = '#ffffff';
  const borderColors = categories.map((cat) =>
    isOverLimit(cat, totals, state.limits) ? OVER_LIMIT_BORDER : DEFAULT_BORDER
  );
  const borderWidths = categories.map((cat) =>
    isOverLimit(cat, totals, state.limits) ? 4 : 2
  );

  // Build chart data
  const chartData = {
    labels: categories,
    datasets: [
      {
        data:             values,
        backgroundColor:  backgroundColors,
        borderColor:      borderColors,
        borderWidth:      borderWidths,
        hoverOffset:      8,
      },
    ],
  };

  if (chartInstance === null) {
    // --- First render: create the Chart.js instance ---
    const ctx = canvas.getContext('2d');
    chartInstance = new Chart(ctx, {
      type: 'pie',
      data: chartData,
      options: {
        responsive: true,
        plugins: {
          // Legend: category name + unique colour + percentage share (Req 4.6)
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              /**
               * Custom label generator that appends the percentage share to
               * each category name, e.g. "Food — 42.3%".
               */
              generateLabels(chart) {
                const dataset = chart.data.datasets[0];
                const dataTotal = chart.data.datasets[0].data.reduce(
                  (s, v) => s + v,
                  0
                );
                return chart.data.labels.map((label, i) => {
                  const value      = dataset.data[i];
                  const pct        = dataTotal > 0
                    ? ((value / dataTotal) * 100).toFixed(1)
                    : '0.0';
                  const fillColor  = dataset.backgroundColor[i];
                  const strokeColor = dataset.borderColor[i];
                  return {
                    text:             `${label} — ${pct}%`,
                    fillStyle:        fillColor,
                    strokeStyle:      strokeColor,
                    lineWidth:        dataset.borderWidth[i] ?? 2,
                    hidden:           false,
                    index:            i,
                  };
                });
              },
            },
          },
          // Tooltip: show category, amount, and percentage
          tooltip: {
            callbacks: {
              label(context) {
                const value    = context.parsed;
                const dataTotal = context.dataset.data.reduce((s, v) => s + v, 0);
                const pct      = dataTotal > 0
                  ? ((value / dataTotal) * 100).toFixed(1)
                  : '0.0';
                return ` $${value.toFixed(2)} (${pct}%)`;
              },
            },
          },
        },
      },
    });
  } else {
    // --- Subsequent renders: update in-place (Req 4.2, 4.3) ---
    chartInstance.data.labels                          = chartData.labels;
    chartInstance.data.datasets[0].data               = chartData.datasets[0].data;
    chartInstance.data.datasets[0].backgroundColor    = chartData.datasets[0].backgroundColor;
    chartInstance.data.datasets[0].borderColor        = chartData.datasets[0].borderColor;
    chartInstance.data.datasets[0].borderWidth        = chartData.datasets[0].borderWidth;
    chartInstance.update();
  }
}
