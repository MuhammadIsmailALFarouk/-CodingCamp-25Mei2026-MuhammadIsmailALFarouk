/**
 * tests/unit.test.js
 * Unit tests for pure functions in js/utils.js
 *
 * Tasks: 10.1 – 10.7
 */

import { describe, it, expect } from 'vitest';
import {
  computeBalance,
  computeCategoryTotals,
  validateTransaction,
  validateAmount,
  validateCategoryName,
  applySort,
  applyMonthFilter,
  isOverLimit,
  AMOUNT_MIN,
  AMOUNT_MAX,
} from '../js/utils.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTx(overrides = {}) {
  return {
    id: overrides.id ?? 'test-id',
    name: overrides.name ?? 'Coffee',
    amount: overrides.amount ?? 5.0,
    category: overrides.category ?? 'Food',
    date: overrides.date ?? '2025-06-15T10:00:00.000Z',
  };
}

// ---------------------------------------------------------------------------
// Task 10.1 — computeBalance
// Requirements: 3.1, 3.4
// ---------------------------------------------------------------------------

describe('computeBalance', () => {
  it('returns 0 for an empty list', () => {
    expect(computeBalance([])).toBe(0);
  });

  it('returns 0 for null/undefined', () => {
    expect(computeBalance(null)).toBe(0);
    expect(computeBalance(undefined)).toBe(0);
  });

  it('returns the amount for a single transaction', () => {
    expect(computeBalance([makeTx({ amount: 42.5 })])).toBe(42.5);
  });

  it('sums multiple transactions correctly', () => {
    const txs = [
      makeTx({ amount: 10 }),
      makeTx({ amount: 20 }),
      makeTx({ amount: 30 }),
    ];
    expect(computeBalance(txs)).toBe(60);
  });

  it('handles floating-point amounts without catastrophic error', () => {
    const txs = [
      makeTx({ amount: 0.1 }),
      makeTx({ amount: 0.2 }),
    ];
    // 0.1 + 0.2 in JS is 0.30000000000000004 — we accept that JS float behaviour
    expect(computeBalance(txs)).toBeCloseTo(0.3, 10);
  });

  it('handles large amounts near AMOUNT_MAX', () => {
    const txs = [
      makeTx({ amount: AMOUNT_MAX }),
      makeTx({ amount: AMOUNT_MAX }),
    ];
    expect(computeBalance(txs)).toBeCloseTo(AMOUNT_MAX * 2, 2);
  });
});

// ---------------------------------------------------------------------------
// Task 10.2 — computeCategoryTotals
// Requirements: 4.1, 4.8
// ---------------------------------------------------------------------------

describe('computeCategoryTotals', () => {
  it('returns {} for an empty list', () => {
    expect(computeCategoryTotals([])).toEqual({});
  });

  it('returns {} for null/undefined', () => {
    expect(computeCategoryTotals(null)).toEqual({});
    expect(computeCategoryTotals(undefined)).toEqual({});
  });

  it('groups transactions by category correctly', () => {
    const txs = [
      makeTx({ category: 'Food', amount: 10 }),
      makeTx({ category: 'Food', amount: 5 }),
      makeTx({ category: 'Transport', amount: 20 }),
    ];
    expect(computeCategoryTotals(txs)).toEqual({ Food: 15, Transport: 20 });
  });

  it('excludes categories whose total is zero', () => {
    // A transaction with amount 0 should result in that category being excluded
    const txs = [
      makeTx({ category: 'Food', amount: 0 }),
      makeTx({ category: 'Transport', amount: 10 }),
    ];
    const totals = computeCategoryTotals(txs);
    expect(totals).not.toHaveProperty('Food');
    expect(totals).toHaveProperty('Transport', 10);
  });

  it('handles a single transaction', () => {
    const txs = [makeTx({ category: 'Fun', amount: 7.5 })];
    expect(computeCategoryTotals(txs)).toEqual({ Fun: 7.5 });
  });

  it('handles multiple categories each with one transaction', () => {
    const txs = [
      makeTx({ category: 'A', amount: 1 }),
      makeTx({ category: 'B', amount: 2 }),
      makeTx({ category: 'C', amount: 3 }),
    ];
    expect(computeCategoryTotals(txs)).toEqual({ A: 1, B: 2, C: 3 });
  });
});

// ---------------------------------------------------------------------------
// Task 10.3 — validateTransaction and validateAmount
// Requirements: 1.4, 1.5
// ---------------------------------------------------------------------------

describe('validateAmount', () => {
  it('rejects null', () => {
    expect(validateAmount(null).valid).toBe(false);
  });

  it('rejects undefined', () => {
    expect(validateAmount(undefined).valid).toBe(false);
  });

  it('rejects empty string', () => {
    expect(validateAmount('').valid).toBe(false);
  });

  it('rejects zero', () => {
    expect(validateAmount(0).valid).toBe(false);
  });

  it('rejects negative numbers', () => {
    expect(validateAmount(-1).valid).toBe(false);
    expect(validateAmount(-0.01).valid).toBe(false);
  });

  it('rejects non-numeric strings', () => {
    expect(validateAmount('abc').valid).toBe(false);
    expect(validateAmount('12abc').valid).toBe(false);
  });

  it('rejects Infinity', () => {
    expect(validateAmount(Infinity).valid).toBe(false);
  });

  it('rejects NaN', () => {
    expect(validateAmount(NaN).valid).toBe(false);
  });

  it('rejects amount below AMOUNT_MIN (0.001)', () => {
    expect(validateAmount(0.001).valid).toBe(false);
  });

  it('accepts AMOUNT_MIN (0.01)', () => {
    expect(validateAmount(AMOUNT_MIN).valid).toBe(true);
  });

  it('accepts AMOUNT_MAX (999999999.99)', () => {
    expect(validateAmount(AMOUNT_MAX).valid).toBe(true);
  });

  it('rejects amount above AMOUNT_MAX (1000000000)', () => {
    expect(validateAmount(1_000_000_000).valid).toBe(false);
  });

  it('accepts a typical mid-range amount', () => {
    expect(validateAmount(25.5).valid).toBe(true);
  });

  it('accepts a numeric string', () => {
    expect(validateAmount('9.99').valid).toBe(true);
  });
});

describe('validateTransaction', () => {
  it('accepts a fully valid transaction', () => {
    const result = validateTransaction({ name: 'Coffee', amount: 3.5, category: 'Food' });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects empty name', () => {
    const result = validateTransaction({ name: '', amount: 3.5, category: 'Food' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /name/i.test(e))).toBe(true);
  });

  it('rejects whitespace-only name', () => {
    const result = validateTransaction({ name: '   ', amount: 3.5, category: 'Food' });
    expect(result.valid).toBe(false);
  });

  it('rejects invalid amount (zero)', () => {
    const result = validateTransaction({ name: 'Coffee', amount: 0, category: 'Food' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /amount/i.test(e))).toBe(true);
  });

  it('rejects invalid amount (negative)', () => {
    const result = validateTransaction({ name: 'Coffee', amount: -5, category: 'Food' });
    expect(result.valid).toBe(false);
  });

  it('rejects missing category (falsy)', () => {
    const result = validateTransaction({ name: 'Coffee', amount: 3.5, category: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /category/i.test(e))).toBe(true);
  });

  it('accumulates multiple errors', () => {
    const result = validateTransaction({ name: '', amount: 0, category: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('accepts boundary amount AMOUNT_MIN', () => {
    const result = validateTransaction({ name: 'Item', amount: AMOUNT_MIN, category: 'Fun' });
    expect(result.valid).toBe(true);
  });

  it('accepts boundary amount AMOUNT_MAX', () => {
    const result = validateTransaction({ name: 'Item', amount: AMOUNT_MAX, category: 'Fun' });
    expect(result.valid).toBe(true);
  });

  it('rejects amount 1000000000 (above AMOUNT_MAX)', () => {
    const result = validateTransaction({ name: 'Item', amount: 1_000_000_000, category: 'Fun' });
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Task 10.4 — validateCategoryName
// Requirements: 6.5, 6.6, 6.7
// ---------------------------------------------------------------------------

describe('validateCategoryName', () => {
  const existing = ['Food', 'Transport', 'Fun'];

  it('rejects empty string', () => {
    expect(validateCategoryName('', existing).valid).toBe(false);
  });

  it('rejects whitespace-only string', () => {
    expect(validateCategoryName('   ', existing).valid).toBe(false);
  });

  it('rejects null/undefined gracefully', () => {
    expect(validateCategoryName(null, existing).valid).toBe(false);
    expect(validateCategoryName(undefined, existing).valid).toBe(false);
  });

  it('rejects a name that already exists (exact match)', () => {
    expect(validateCategoryName('Food', existing).valid).toBe(false);
  });

  it('rejects a duplicate name case-insensitively (uppercase)', () => {
    expect(validateCategoryName('FOOD', existing).valid).toBe(false);
  });

  it('rejects a duplicate name case-insensitively (mixed case)', () => {
    expect(validateCategoryName('fOoD', existing).valid).toBe(false);
  });

  it('accepts a valid new name', () => {
    expect(validateCategoryName('Entertainment', existing).valid).toBe(true);
  });

  it('rejects a name longer than 50 characters', () => {
    const longName = 'A'.repeat(51);
    expect(validateCategoryName(longName, existing).valid).toBe(false);
  });

  it('accepts a name of exactly 50 characters', () => {
    const name50 = 'A'.repeat(50);
    expect(validateCategoryName(name50, existing).valid).toBe(true);
  });

  it('accepts a name of 1 character', () => {
    expect(validateCategoryName('X', existing).valid).toBe(true);
  });

  it('returns an error message for duplicates', () => {
    const result = validateCategoryName('food', existing);
    expect(result.error).toBeTruthy();
  });

  it('returns an error message for empty name', () => {
    const result = validateCategoryName('', existing);
    expect(result.error).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Task 10.5 — applySort
// Requirements: 8.1, 8.2
// ---------------------------------------------------------------------------

describe('applySort', () => {
  const txs = [
    makeTx({ id: '1', amount: 30, category: 'Transport' }),
    makeTx({ id: '2', amount: 10, category: 'Food' }),
    makeTx({ id: '3', amount: 20, category: 'Fun' }),
  ];

  it('returns an empty array unchanged', () => {
    expect(applySort([], 'amount-asc')).toEqual([]);
  });

  it('returns a single-item array unchanged', () => {
    const single = [makeTx({ id: 'x', amount: 5, category: 'Food' })];
    expect(applySort(single, 'amount-asc')).toEqual(single);
  });

  it('does not mutate the original array', () => {
    const original = [...txs];
    applySort(txs, 'amount-asc');
    expect(txs).toEqual(original);
  });

  it('sorts amount-asc: lowest first', () => {
    const sorted = applySort(txs, 'amount-asc');
    expect(sorted.map((t) => t.amount)).toEqual([10, 20, 30]);
  });

  it('sorts amount-desc: highest first', () => {
    const sorted = applySort(txs, 'amount-desc');
    expect(sorted.map((t) => t.amount)).toEqual([30, 20, 10]);
  });

  it('sorts category-az: A to Z', () => {
    const sorted = applySort(txs, 'category-az');
    expect(sorted.map((t) => t.category)).toEqual(['Food', 'Fun', 'Transport']);
  });

  it('sorts category-za: Z to A', () => {
    const sorted = applySort(txs, 'category-za');
    expect(sorted.map((t) => t.category)).toEqual(['Transport', 'Fun', 'Food']);
  });

  it('returns unsorted copy for unknown sort key', () => {
    const sorted = applySort(txs, 'unknown-key');
    expect(sorted).toEqual(txs);
    expect(sorted).not.toBe(txs); // still a new array
  });

  it('category sort is case-insensitive', () => {
    const mixed = [
      makeTx({ id: 'a', category: 'zebra' }),
      makeTx({ id: 'b', category: 'Apple' }),
      makeTx({ id: 'c', category: 'mango' }),
    ];
    const sorted = applySort(mixed, 'category-az');
    expect(sorted.map((t) => t.category)).toEqual(['Apple', 'mango', 'zebra']);
  });
});

// ---------------------------------------------------------------------------
// Task 10.6 — applyMonthFilter
// Requirements: 7.2, 7.5
// ---------------------------------------------------------------------------

describe('applyMonthFilter', () => {
  const txs = [
    makeTx({ id: '1', date: '2025-01-15T10:00:00.000Z' }),
    makeTx({ id: '2', date: '2025-01-31T23:59:59.999Z' }),
    makeTx({ id: '3', date: '2025-02-01T00:00:00.000Z' }),
    makeTx({ id: '4', date: '2025-06-15T10:00:00.000Z' }),
  ];

  it('returns all transactions when monthStr is null', () => {
    expect(applyMonthFilter(txs, null)).toEqual(txs);
  });

  it('returns all transactions when monthStr is empty string', () => {
    expect(applyMonthFilter(txs, '')).toEqual(txs);
  });

  it('returns all transactions when monthStr is undefined', () => {
    expect(applyMonthFilter(txs, undefined)).toEqual(txs);
  });

  it('returns only transactions in the matching month', () => {
    const result = applyMonthFilter(txs, '2025-01');
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.id)).toEqual(['1', '2']);
  });

  it('returns empty array when no transactions match the month', () => {
    const result = applyMonthFilter(txs, '2024-12');
    expect(result).toHaveLength(0);
  });

  it('includes the first day of the month (boundary)', () => {
    const result = applyMonthFilter(txs, '2025-02');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('3');
  });

  it('includes the last day of the month (boundary)', () => {
    const result = applyMonthFilter(txs, '2025-01');
    expect(result.map((t) => t.id)).toContain('2');
  });

  it('returns empty array for an empty transaction list', () => {
    expect(applyMonthFilter([], '2025-01')).toEqual([]);
  });

  it('does not include transactions from adjacent months', () => {
    const result = applyMonthFilter(txs, '2025-06');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('4');
  });
});

// ---------------------------------------------------------------------------
// Task 10.7 — isOverLimit
// Requirements: 9.3, 9.5
// ---------------------------------------------------------------------------

describe('isOverLimit', () => {
  it('returns false when no limit is set for the category', () => {
    expect(isOverLimit('Food', { Food: 100 }, {})).toBe(false);
  });

  it('returns false when limit is undefined', () => {
    expect(isOverLimit('Food', { Food: 100 }, { Transport: 50 })).toBe(false);
  });

  it('returns false when total is below the limit', () => {
    expect(isOverLimit('Food', { Food: 49.99 }, { Food: 50 })).toBe(false);
  });

  it('returns true when total equals the limit (at limit)', () => {
    expect(isOverLimit('Food', { Food: 50 }, { Food: 50 })).toBe(true);
  });

  it('returns true when total exceeds the limit', () => {
    expect(isOverLimit('Food', { Food: 75 }, { Food: 50 })).toBe(true);
  });

  it('returns false when there is no spending for the category', () => {
    expect(isOverLimit('Food', {}, { Food: 50 })).toBe(false);
  });

  it('returns false when total is null', () => {
    expect(isOverLimit('Food', { Food: null }, { Food: 50 })).toBe(false);
  });

  it('returns false when limit is zero (invalid limit)', () => {
    expect(isOverLimit('Food', { Food: 100 }, { Food: 0 })).toBe(false);
  });

  it('returns false when limit is negative (invalid limit)', () => {
    expect(isOverLimit('Food', { Food: 100 }, { Food: -10 })).toBe(false);
  });

  it('returns false when limit is Infinity (non-finite)', () => {
    expect(isOverLimit('Food', { Food: 100 }, { Food: Infinity })).toBe(false);
  });

  it('handles multiple categories independently', () => {
    const totals = { Food: 60, Transport: 30 };
    const limits = { Food: 50, Transport: 50 };
    expect(isOverLimit('Food', totals, limits)).toBe(true);
    expect(isOverLimit('Transport', totals, limits)).toBe(false);
  });
});
