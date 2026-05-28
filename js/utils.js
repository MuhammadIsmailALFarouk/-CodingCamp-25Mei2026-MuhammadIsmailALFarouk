/**
 * js/utils.js — Pure utility functions for Expense & Visual Budget.
 *
 * This ES module exports all pure (side-effect-free) functions so they can be
 * imported by the Vitest test suite without requiring a DOM or localStorage.
 * app.js (a plain browser script) keeps its own copies of these functions so
 * it does not need to use ES module imports.
 */

// === Constants ===

export const DEFAULT_CATEGORIES = ['Food', 'Transport', 'Fun'];
export const MAX_CUSTOM_CATEGORIES = 50;
export const AMOUNT_MIN = 0.01;
export const AMOUNT_MAX = 999_999_999.99;

// === Validation ===

/**
 * Validate a transaction input object.
 * @param {{ name: string, amount: *, category: string }} param0
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateTransaction({ name, amount, category }) {
  const errors = [];

  if (!name || name.trim() === '') {
    errors.push('Item name is required');
  }

  const amountResult = validateAmount(amount);
  if (!amountResult.valid) {
    errors.push(amountResult.error);
  }

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
export function validateAmount(value) {
  if (value === null || value === undefined || value === '') {
    return { valid: false, error: 'Amount is required' };
  }

  const num = parseFloat(value);
  if (isNaN(num) || !isFinite(num)) {
    return { valid: false, error: 'Amount must be a number' };
  }

  if (num < AMOUNT_MIN || num > AMOUNT_MAX) {
    return {
      valid: false,
      error: `Amount must be between ${AMOUNT_MIN} and ${AMOUNT_MAX}`,
    };
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
export function validateCategoryName(name, existingCategories) {
  const trimmed = (name || '').trim();
  if (trimmed === '') {
    return { valid: false, error: 'Category name is required' };
  }

  if (trimmed.length > 50) {
    return { valid: false, error: 'Category name must be 50 characters or fewer' };
  }

  const lowerTrimmed = trimmed.toLowerCase();
  const isDuplicate = existingCategories.some(
    (cat) => cat.toLowerCase() === lowerTrimmed
  );
  if (isDuplicate) {
    return { valid: false, error: 'Category already exists' };
  }

  return { valid: true };
}

// === Business Logic / Computations ===

/**
 * Compute the total balance as the arithmetic sum of all transaction amounts.
 * Returns 0 for an empty list.
 * @param {Array<{amount: number}>} transactions
 * @returns {number}
 */
export function computeBalance(transactions) {
  if (!transactions || transactions.length === 0) {
    return 0;
  }
  return transactions.reduce((sum, t) => sum + t.amount, 0);
}

/**
 * Compute per-category spending totals from a list of transactions.
 * Categories with a total of zero are excluded from the result.
 * @param {Array<{category: string, amount: number}>} transactions
 * @returns {{ [category: string]: number }}
 */
export function computeCategoryTotals(transactions) {
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

  for (const category of Object.keys(totals)) {
    if (totals[category] === 0) {
      delete totals[category];
    }
  }

  return totals;
}

/**
 * Return a new array of transactions sorted by the given sort key.
 * Does NOT mutate the original array.
 * @param {Array} transactions
 * @param {'amount-asc'|'amount-desc'|'category-az'|'category-za'} sortKey
 * @returns {Array}
 */
export function applySort(transactions, sortKey) {
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
      break;
  }

  return copy;
}

/**
 * Return a new array containing only the transactions whose `date` field
 * falls within the given calendar month.
 * When `monthStr` is null (or falsy), all transactions are returned unchanged.
 * @param {Array<{date: string}>} transactions
 * @param {string|null} monthStr  - Month in 'YYYY-MM' format, or null to show all
 * @returns {Array}
 */
export function applyMonthFilter(transactions, monthStr) {
  if (!monthStr) {
    return transactions;
  }

  return transactions.filter((t) => t.date.slice(0, 7) === monthStr);
}

/**
 * Determine whether a category's spending has met or exceeded its limit.
 * Returns false when no limit is set for the category.
 * @param {string} category
 * @param {{ [category: string]: number }} totals
 * @param {{ [category: string]: number }} limits
 * @returns {boolean}
 */
export function isOverLimit(category, totals, limits) {
  const limit = limits[category];
  if (limit === undefined || limit === null || !isFinite(limit) || limit <= 0) {
    return false;
  }

  const total = totals[category];
  if (total === undefined || total === null) {
    return false;
  }

  return total >= limit;
}
