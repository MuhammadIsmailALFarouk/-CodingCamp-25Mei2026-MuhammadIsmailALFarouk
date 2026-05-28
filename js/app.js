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
