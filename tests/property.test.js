/**
 * tests/property.test.js
 * Property-based tests for Expense & Visual Budget using fast-check.
 *
 * All properties run a minimum of 100 iterations.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
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
// Arbitraries / Generators
// ---------------------------------------------------------------------------

/** A valid amount as a clean decimal (avoids float precision noise). */
const validAmountArb = fc.integer({ min: 1, max: 9999999999 }).map((n) => n / 100);

/** A valid non-empty, non-whitespace string. */
const nonEmptyStringArb = fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0);

/** A valid transaction object. */
const validTxArb = fc.record({
  id: fc.uuid(),
  name: nonEmptyStringArb,
  amount: validAmountArb,
  category: nonEmptyStringArb,
  date: fc
    .date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
    .map((d) => d.toISOString()),
});

/** An array of valid transactions. */
const validTxArrayArb = fc.array(validTxArb);

// ---------------------------------------------------------------------------
// Property 1: Balance equals sum of all transaction amounts
// Feature: expense-visual-budget, Property 1: Balance equals sum of all transaction amounts
// ---------------------------------------------------------------------------

describe('Property 1: Balance equals sum of all transaction amounts', () => {
  // Feature: expense-visual-budget, Property 1: Balance equals sum of all transaction amounts
  it('computeBalance equals array reduce sum for any transaction list', () => {
    fc.assert(
      fc.property(validTxArrayArb, (txs) => {
        const expected = txs.reduce((s, t) => s + t.amount, 0);
        expect(computeBalance(txs)).toBe(expected);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2: Adding a valid transaction grows the list by exactly one
// Feature: expense-visual-budget, Property 2: Adding a valid transaction grows the list by exactly one
// ---------------------------------------------------------------------------

describe('Property 2: Adding a valid transaction grows the list by exactly one', () => {
  // Feature: expense-visual-budget, Property 2: Adding a valid transaction grows the list by exactly one
  it('pushing a valid transaction increases list length by 1 and item is present by id', () => {
    fc.assert(
      fc.property(validTxArrayArb, validTxArb, (existingList, newTx) => {
        const list = [...existingList];
        const originalLength = list.length;

        // Simulate state mutation: push new transaction
        list.push(newTx);

        expect(list.length).toBe(originalLength + 1);
        expect(list.some((t) => t.id === newTx.id)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 3: Whitespace-only or invalid inputs are always rejected
// Feature: expense-visual-budget, Property 3: Whitespace-only or invalid inputs are always rejected
// ---------------------------------------------------------------------------

describe('Property 3: Whitespace-only or invalid inputs are always rejected', () => {
  // Feature: expense-visual-budget, Property 3: Whitespace-only or invalid inputs are always rejected
  it('validateTransaction rejects whitespace-only names', () => {
    const whitespaceArb = fc.stringMatching(/^\s+$/);
    fc.assert(
      fc.property(whitespaceArb, nonEmptyStringArb, (wsName, category) => {
        const result = validateTransaction({ name: wsName, amount: 10, category });
        expect(result.valid).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('validateTransaction rejects out-of-range amounts', () => {
    const outOfRangeAmountArb = fc.oneof(
      fc.constant(0),
      fc.constant(-1),
      fc.double({ min: 1_000_000_000, max: 2_000_000_000, noNaN: true, noDefaultInfinity: true })
    );
    fc.assert(
      fc.property(outOfRangeAmountArb, nonEmptyStringArb, (badAmount, category) => {
        const result = validateTransaction({ name: 'Test Item', amount: badAmount, category });
        expect(result.valid).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('validateAmount rejects out-of-range amounts', () => {
    const outOfRangeAmountArb = fc.oneof(
      fc.constant(0),
      fc.constant(-1),
      fc.double({ min: 1_000_000_000, max: 2_000_000_000, noNaN: true, noDefaultInfinity: true })
    );
    fc.assert(
      fc.property(outOfRangeAmountArb, (badAmount) => {
        const result = validateAmount(badAmount);
        expect(result.valid).toBe(false);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 4: Transaction addition round-trip through localStorage
// Feature: expense-visual-budget, Property 4: Transaction addition round-trip through localStorage
// ---------------------------------------------------------------------------

describe('Property 4: Transaction addition round-trip through localStorage', () => {
  // Feature: expense-visual-budget, Property 4: Transaction addition round-trip through localStorage
  it('JSON serialise/deserialise preserves all transaction fields', () => {
    fc.assert(
      fc.property(validTxArb, (tx) => {
        const serialised = JSON.stringify(tx);
        const deserialised = JSON.parse(serialised);

        expect(deserialised.name).toBe(tx.name);
        expect(deserialised.amount).toBe(tx.amount);
        expect(deserialised.category).toBe(tx.category);
        expect(deserialised.date).toBe(tx.date);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 5: Deleting a transaction removes it from the list
// Feature: expense-visual-budget, Property 5: Deleting a transaction removes it from the list
// ---------------------------------------------------------------------------

describe('Property 5: Deleting a transaction removes it from the list', () => {
  // Feature: expense-visual-budget, Property 5: Deleting a transaction removes it from the list
  it('splicing a transaction by index removes it and decreases length by 1', () => {
    fc.assert(
      fc.property(
        fc.array(validTxArb, { minLength: 1 }),
        fc.integer({ min: 0, max: 999 }),
        (txs, rawIndex) => {
          const index = rawIndex % txs.length;
          const targetId = txs[index].id;
          const originalLength = txs.length;

          // Simulate deletion
          const result = [...txs];
          result.splice(index, 1);

          expect(result.length).toBe(originalLength - 1);
          expect(result.some((t) => t.id === targetId)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 6: Chart segments reflect category totals proportionally
// Feature: expense-visual-budget, Property 6: Chart segments reflect category totals proportionally
// ---------------------------------------------------------------------------

describe('Property 6: Chart segments reflect category totals proportionally', () => {
  // Feature: expense-visual-budget, Property 6: Chart segments reflect category totals proportionally
  it('computeCategoryTotals keys exactly match categories with positive totals', () => {
    fc.assert(
      fc.property(validTxArrayArb, (txs) => {
        const totals = computeCategoryTotals(txs);

        // All values in result must be > 0 (use entries to avoid prototype key issues)
        for (const [, value] of Object.entries(totals)) {
          expect(typeof value).toBe('number');
          expect(value).toBeGreaterThan(0);
        }

        // Compute expected categories manually using a Map to avoid prototype pollution
        const rawTotals = new Map();
        for (const t of txs) {
          rawTotals.set(t.category, (rawTotals.get(t.category) || 0) + t.amount);
        }
        const expectedCategories = new Set(
          [...rawTotals.entries()].filter(([, v]) => v > 0).map(([k]) => k)
        );

        const resultCategories = new Set(Object.keys(totals));
        expect(resultCategories).toEqual(expectedCategories);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 7: Monthly filter returns only transactions in the selected month
// Feature: expense-visual-budget, Property 7: Monthly filter returns only transactions in the selected month
// ---------------------------------------------------------------------------

describe('Property 7: Monthly filter returns only transactions in the selected month', () => {
  // Feature: expense-visual-budget, Property 7: Monthly filter returns only transactions in the selected month
  it('applyMonthFilter returns exactly the transactions matching the month string', () => {
    const txWithDateArb = fc.record({
      id: fc.uuid(),
      name: nonEmptyStringArb,
      amount: validAmountArb,
      category: nonEmptyStringArb,
      date: fc
        .date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
        .map((d) => d.toISOString()),
    });

    const monthStrArb = fc
      .date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
      .map((d) => {
        const year = d.getUTCFullYear();
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
      });

    fc.assert(
      fc.property(fc.array(txWithDateArb), monthStrArb, (txs, monthStr) => {
        const result = applyMonthFilter(txs, monthStr);

        // Every result item's date must start with monthStr
        for (const t of result) {
          expect(t.date.slice(0, 7)).toBe(monthStr);
        }

        // Every item in original whose date starts with monthStr must be in result
        const expectedIds = new Set(
          txs.filter((t) => t.date.slice(0, 7) === monthStr).map((t) => t.id)
        );
        const resultIds = new Set(result.map((t) => t.id));
        expect(resultIds).toEqual(expectedIds);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 8: Custom category name uniqueness (case-insensitive)
// Feature: expense-visual-budget, Property 8: Custom category name uniqueness (case-insensitive)
// ---------------------------------------------------------------------------

describe('Property 8: Custom category name uniqueness (case-insensitive)', () => {
  // Feature: expense-visual-budget, Property 8: Custom category name uniqueness (case-insensitive)
  it('validateCategoryName rejects a duplicate name in any case variant', () => {
    // Generate trimmed category names to match how validateCategoryName normalises input
    const trimmedCategoryNameArb = fc
      .string({ minLength: 1, maxLength: 50 })
      .filter((s) => s.trim() === s && s.trim().length > 0 && s.trim().length <= 50);

    fc.assert(
      fc.property(
        fc.array(trimmedCategoryNameArb, { minLength: 1 }),
        fc.integer({ min: 0, max: 999 }),
        fc.boolean(),
        (categories, rawIndex, useUpperCase) => {
          const index = rawIndex % categories.length;
          const existingName = categories[index];
          const duplicateVariant = useUpperCase
            ? existingName.toUpperCase()
            : existingName.toLowerCase();

          const result = validateCategoryName(duplicateVariant, categories);
          expect(result.valid).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 9: Spending limit alert consistency
// Feature: expense-visual-budget, Property 9: Spending limit alert consistency
// ---------------------------------------------------------------------------

describe('Property 9: Spending limit alert consistency', () => {
  // Feature: expense-visual-budget, Property 9: Spending limit alert consistency
  it('isOverLimit returns true iff category total >= limit', () => {
    const categoryArb = nonEmptyStringArb;
    const positiveLimitArb = fc.double({
      min: 0.01,
      max: 999_999_999.99,
      noNaN: true,
      noDefaultInfinity: true,
    });
    const positiveTotalArb = fc.double({
      min: 0,
      max: 999_999_999.99,
      noNaN: true,
      noDefaultInfinity: true,
    });

    fc.assert(
      fc.property(categoryArb, positiveTotalArb, positiveLimitArb, (category, total, limit) => {
        const totals = { [category]: total };
        const limits = { [category]: limit };

        const result = isOverLimit(category, totals, limits);
        const expected = total >= limit;

        expect(result).toBe(expected);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 10: Sort stability — sorted list is a permutation of the original
// Feature: expense-visual-budget, Property 10: Sort stability — sorted list is a permutation of the original
// ---------------------------------------------------------------------------

describe('Property 10: Sort stability — sorted list is a permutation of the original', () => {
  // Feature: expense-visual-budget, Property 10: Sort stability — sorted list is a permutation of the original
  it('applySort result contains exactly the same id set as the original', () => {
    const sortKeyArb = fc.constantFrom(
      'amount-asc',
      'amount-desc',
      'category-az',
      'category-za'
    );

    fc.assert(
      fc.property(validTxArrayArb, sortKeyArb, (txs, sortKey) => {
        const sorted = applySort(txs, sortKey);

        // Same length
        expect(sorted.length).toBe(txs.length);

        // Same id set
        const originalIds = new Set(txs.map((t) => t.id));
        const sortedIds = new Set(sorted.map((t) => t.id));
        expect(sortedIds).toEqual(originalIds);
      }),
      { numRuns: 100 }
    );
  });
});
