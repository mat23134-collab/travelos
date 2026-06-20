import assert from 'node:assert/strict';
import { budgetToUsd } from './currency';

// Range with the marker between the two numbers; non-money numbers untouched.
assert.equal(
  budgetToUsd('סביבות 4,500₪–6,000 לשלושה אנשים למשך 5 ימים'),
  'סביבות $1,200–$1,600 לשלושה אנשים למשך 5 ימים',
);

// Per-person daily band.
assert.equal(budgetToUsd('בערך 300₪–400/אדם ליום'), 'בערך $80–$110/אדם ליום');

// Single amount, marker after.
assert.equal(budgetToUsd('כ-1,000₪'), 'כ-$270');

// No shekel marker → unchanged.
assert.equal(budgetToUsd('5 ימים, 3 אנשים'), '5 ימים, 3 אנשים');

// Empty / nullish.
assert.equal(budgetToUsd(''), '');
assert.equal(budgetToUsd(null), '');

console.log('✓ currency.budgetToUsd: all assertions passed');
