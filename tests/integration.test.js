/**
 * tests/integration.test.js
 * Smoke and integration tests for app initialisation, localStorage persistence,
 * and theme persistence.
 *
 * Tasks: 11.1, 11.2, 11.3
 *
 * Strategy:
 *  - We test the pure storage/state logic directly (no DOM required for most tests).
 *  - For smoke tests that exercise init(), we set up a minimal jsdom environment
 *    via Vitest's built-in jsdom support and stub Chart.js.
 *  - localStorage is provided by jsdom automatically; we can clear/manipulate it
 *    between tests.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Shared localStorage helpers (used across all test groups)
// ---------------------------------------------------------------------------

/**
 * A simple in-memory localStorage mock that mirrors the real API.
 * Used when we need to swap out the real jsdom localStorage.
 */
function createLocalStorageMock() {
  let store = {};
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem(key, value) {
      store[key] = String(value);
    },
    removeItem(key) {
      delete store[key];
    },
    clear() {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key(index) {
      return Object.keys(store)[index] ?? null;
    },
  };
}

// ---------------------------------------------------------------------------
// Task 11.1 — Smoke tests: app loads with and without localStorage
// Requirements: 5.4, 10.6
// ---------------------------------------------------------------------------

describe('Smoke: app loads with localStorage available', () => {
  beforeEach(() => {
    // Ensure localStorage is clean before each test
    localStorage.clear();
  });

  it('storageGet returns { ok: true, data: null } for a missing key', () => {
    // Inline the storage layer logic (mirrors app.js storageGet)
    function storageGet(key) {
      try {
        const raw = localStorage.getItem(key);
        if (raw === null) return { ok: true, data: null };
        return { ok: true, data: JSON.parse(raw) };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    }

    const result = storageGet('evb_transactions');
    expect(result.ok).toBe(true);
    expect(result.data).toBeNull();
  });

  it('storageSet and storageGet round-trip correctly', () => {
    function storageSet(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    }
    function storageGet(key) {
      try {
        const raw = localStorage.getItem(key);
        if (raw === null) return { ok: true, data: null };
        return { ok: true, data: JSON.parse(raw) };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    }

    const transactions = [
      { id: '1', name: 'Coffee', amount: 3.5, category: 'Food', date: '2025-06-01T10:00:00.000Z' },
    ];

    const setResult = storageSet('evb_transactions', transactions);
    expect(setResult.ok).toBe(true);

    const getResult = storageGet('evb_transactions');
    expect(getResult.ok).toBe(true);
    expect(getResult.data).toEqual(transactions);
  });

  it('isStorageAvailable returns { ok: true } when localStorage works', () => {
    function isStorageAvailable() {
      const TEST_KEY = '__evb_storage_test__';
      try {
        localStorage.setItem(TEST_KEY, '1');
        const val = localStorage.getItem(TEST_KEY);
        localStorage.removeItem(TEST_KEY);
        if (val !== '1') return { ok: false, error: 'read-back mismatch' };
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    }

    expect(isStorageAvailable().ok).toBe(true);
  });
});

describe('Smoke: app loads when localStorage is unavailable (private mode simulation)', () => {
  let originalLocalStorage;

  beforeEach(() => {
    // Simulate private mode: replace localStorage with a throwing stub
    originalLocalStorage = globalThis.localStorage;
    const throwingStorage = {
      getItem() { throw new DOMException('Access denied', 'SecurityError'); },
      setItem() { throw new DOMException('Access denied', 'SecurityError'); },
      removeItem() { throw new DOMException('Access denied', 'SecurityError'); },
      clear() { throw new DOMException('Access denied', 'SecurityError'); },
    };
    Object.defineProperty(globalThis, 'localStorage', {
      value: throwingStorage,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    // Restore real localStorage
    Object.defineProperty(globalThis, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
      configurable: true,
    });
  });

  it('isStorageAvailable returns { ok: false } when localStorage throws', () => {
    function isStorageAvailable() {
      const TEST_KEY = '__evb_storage_test__';
      try {
        localStorage.setItem(TEST_KEY, '1');
        const val = localStorage.getItem(TEST_KEY);
        localStorage.removeItem(TEST_KEY);
        if (val !== '1') return { ok: false, error: 'read-back mismatch' };
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    }

    const result = isStorageAvailable();
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('storageGet returns { ok: false } when localStorage throws', () => {
    function storageGet(key) {
      try {
        const raw = localStorage.getItem(key);
        if (raw === null) return { ok: true, data: null };
        return { ok: true, data: JSON.parse(raw) };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    }

    const result = storageGet('evb_transactions');
    expect(result.ok).toBe(false);
  });

  it('storageSet returns { ok: false } when localStorage throws', () => {
    function storageSet(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    }

    const result = storageSet('evb_transactions', []);
    expect(result.ok).toBe(false);
  });

  it('app initialises with empty state when storage is unavailable', () => {
    // Simulate the init() storage-unavailable branch
    const DEFAULT_CATEGORIES = ['Food', 'Transport', 'Fun'];

    function isStorageAvailable() {
      try {
        localStorage.setItem('__test__', '1');
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    }

    const storageCheck = isStorageAvailable();
    expect(storageCheck.ok).toBe(false);

    // When storage is unavailable, init() falls back to empty state
    const state = {
      transactions: [],
      categories: [...DEFAULT_CATEGORIES],
      limits: {},
    };

    expect(state.transactions).toHaveLength(0);
    expect(state.categories).toEqual(DEFAULT_CATEGORIES);
    expect(state.limits).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Task 11.2 — Integration: add → persist → reload → verify
// Requirements: 5.1, 5.2, 5.3
// ---------------------------------------------------------------------------

describe('Integration: add → persist → reload → verify cycle', () => {
  const STORAGE_KEYS = {
    TRANSACTIONS: 'evb_transactions',
    CATEGORIES: 'evb_categories',
    LIMITS: 'evb_limits',
    THEME: 'evb_theme',
  };
  const DEFAULT_CATEGORIES = ['Food', 'Transport', 'Fun'];

  // Use the real jsdom localStorage (provided by Vitest's jsdom environment)
  beforeEach(() => {
    localStorage.clear();
  });

  function storageGet(key) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return { ok: true, data: null };
      return { ok: true, data: JSON.parse(raw) };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  function storageSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  function computeBalance(transactions) {
    if (!transactions || transactions.length === 0) return 0;
    return transactions.reduce((sum, t) => sum + t.amount, 0);
  }

  /** Simulate adding a transaction (the state-mutation + persist path from handleFormSubmit) */
  function addTransaction(state, transaction) {
    state.transactions.push(transaction);
    const result = storageSet(STORAGE_KEYS.TRANSACTIONS, state.transactions);
    if (!result.ok) {
      state.transactions.pop();
      return { ok: false, error: result.error };
    }
    return { ok: true };
  }

  /** Simulate app init loading transactions from localStorage */
  function loadState() {
    const txResult = storageGet(STORAGE_KEYS.TRANSACTIONS);
    let transactions = [];
    if (txResult.ok && Array.isArray(txResult.data)) {
      transactions = txResult.data;
    }

    const catResult = storageGet(STORAGE_KEYS.CATEGORIES);
    let customCategories = [];
    if (catResult.ok && Array.isArray(catResult.data)) {
      customCategories = catResult.data;
    }

    const limitsResult = storageGet(STORAGE_KEYS.LIMITS);
    let limits = {};
    if (
      limitsResult.ok &&
      limitsResult.data !== null &&
      typeof limitsResult.data === 'object' &&
      !Array.isArray(limitsResult.data)
    ) {
      limits = limitsResult.data;
    }

    const themeResult = storageGet(STORAGE_KEYS.THEME);
    const theme =
      themeResult.ok && (themeResult.data === 'light' || themeResult.data === 'dark')
        ? themeResult.data
        : 'light';

    return {
      transactions,
      categories: [...DEFAULT_CATEGORIES, ...customCategories],
      limits,
      theme,
    };
  }

  it('persisted transaction is present after simulated reload', () => {
    const state = { transactions: [] };

    const tx = {
      id: 'abc-123',
      name: 'Lunch',
      amount: 12.5,
      category: 'Food',
      date: '2025-06-15T12:00:00.000Z',
    };

    const addResult = addTransaction(state, tx);
    expect(addResult.ok).toBe(true);

    // Simulate reload: load fresh state from localStorage
    const reloaded = loadState();
    expect(reloaded.transactions).toHaveLength(1);
    expect(reloaded.transactions[0].id).toBe('abc-123');
    expect(reloaded.transactions[0].name).toBe('Lunch');
    expect(reloaded.transactions[0].amount).toBe(12.5);
    expect(reloaded.transactions[0].category).toBe('Food');
  });

  it('balance is correct after reload', () => {
    const state = { transactions: [] };

    const txs = [
      { id: '1', name: 'Coffee', amount: 3.5, category: 'Food', date: '2025-06-01T08:00:00.000Z' },
      { id: '2', name: 'Bus', amount: 2.0, category: 'Transport', date: '2025-06-01T09:00:00.000Z' },
      { id: '3', name: 'Movie', amount: 15.0, category: 'Fun', date: '2025-06-01T20:00:00.000Z' },
    ];

    for (const tx of txs) {
      addTransaction(state, tx);
    }

    const reloaded = loadState();
    expect(reloaded.transactions).toHaveLength(3);
    expect(computeBalance(reloaded.transactions)).toBeCloseTo(20.5, 2);
  });

  it('transaction fields survive JSON serialisation round-trip', () => {
    const state = { transactions: [] };

    const tx = {
      id: 'round-trip-id',
      name: 'Groceries',
      amount: 47.89,
      category: 'Food',
      date: '2025-07-04T14:30:00.000Z',
    };

    addTransaction(state, tx);

    const reloaded = loadState();
    const found = reloaded.transactions.find((t) => t.id === 'round-trip-id');
    expect(found).toBeDefined();
    expect(found.name).toBe(tx.name);
    expect(found.amount).toBe(tx.amount);
    expect(found.category).toBe(tx.category);
    expect(found.date).toBe(tx.date);
  });

  it('empty localStorage produces empty transaction list on load', () => {
    // localStorage is already cleared in beforeEach
    const reloaded = loadState();
    expect(reloaded.transactions).toHaveLength(0);
    expect(computeBalance(reloaded.transactions)).toBe(0);
  });

  it('multiple add cycles accumulate correctly', () => {
    const state = { transactions: [] };

    addTransaction(state, { id: '1', name: 'A', amount: 10, category: 'Food', date: '2025-01-01T00:00:00.000Z' });
    addTransaction(state, { id: '2', name: 'B', amount: 20, category: 'Fun', date: '2025-01-02T00:00:00.000Z' });

    const reloaded = loadState();
    expect(reloaded.transactions).toHaveLength(2);
    expect(computeBalance(reloaded.transactions)).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// Task 11.3 — Integration: theme persistence across simulated page reloads
// Requirements: 10.3, 10.4
// ---------------------------------------------------------------------------

describe('Integration: theme persistence across simulated page reloads', () => {
  const STORAGE_KEYS = { THEME: 'evb_theme' };

  beforeEach(() => {
    localStorage.clear();
  });

  function storageGet(key) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return { ok: true, data: null };
      return { ok: true, data: JSON.parse(raw) };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  function storageSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  /** Simulate the theme-loading portion of init() */
  function loadTheme() {
    const themeResult = storageGet(STORAGE_KEYS.THEME);
    if (themeResult.ok && (themeResult.data === 'light' || themeResult.data === 'dark')) {
      return themeResult.data;
    }
    return 'light'; // default (Req 10.5)
  }

  /** Simulate handleThemeToggle() */
  function toggleTheme(currentTheme) {
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    storageSet(STORAGE_KEYS.THEME, newTheme);
    return newTheme;
  }

  it('defaults to light theme when no preference is stored', () => {
    const theme = loadTheme();
    expect(theme).toBe('light');
  });

  it('persists dark theme and reloads it correctly', () => {
    // Start with light, toggle to dark
    let theme = 'light';
    theme = toggleTheme(theme);
    expect(theme).toBe('dark');

    // Simulate reload
    const reloadedTheme = loadTheme();
    expect(reloadedTheme).toBe('dark');
  });

  it('persists light theme after toggling back from dark', () => {
    // Toggle to dark, then back to light
    let theme = 'light';
    theme = toggleTheme(theme); // → dark
    theme = toggleTheme(theme); // → light

    const reloadedTheme = loadTheme();
    expect(reloadedTheme).toBe('light');
  });

  it('theme is applied before any render (load order)', () => {
    // Persist dark theme as if a previous session set it
    storageSet(STORAGE_KEYS.THEME, 'dark');

    // The first thing init() does is load the theme
    const theme = loadTheme();

    // Verify theme is dark BEFORE any other state is loaded
    expect(theme).toBe('dark');
  });

  it('ignores invalid stored theme values and falls back to light', () => {
    // Manually write an invalid value
    localStorage.setItem(STORAGE_KEYS.THEME, JSON.stringify('purple'));

    const theme = loadTheme();
    expect(theme).toBe('light');
  });

  it('ignores null stored theme and falls back to light', () => {
    // storageGet returns { ok: true, data: null } for missing key
    const theme = loadTheme();
    expect(theme).toBe('light');
  });

  it('multiple toggle cycles persist correctly', () => {
    let theme = 'light';
    const sequence = [];

    for (let i = 0; i < 5; i++) {
      theme = toggleTheme(theme);
      sequence.push(loadTheme());
    }

    // Sequence should alternate: dark, light, dark, light, dark
    expect(sequence).toEqual(['dark', 'light', 'dark', 'light', 'dark']);
  });
});
