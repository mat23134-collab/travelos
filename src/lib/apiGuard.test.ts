// src/lib/apiGuard.test.ts
// Run: npx tsx src/lib/apiGuard.test.ts
import assert from 'node:assert/strict';
import { isAdminEmail } from './apiGuard';

assert.ok(isAdminEmail('mat23134@gmail.com'), 'exact match');
assert.ok(isAdminEmail('Mat23134@Gmail.com'), 'case-insensitive');
assert.ok(isAdminEmail('  mat23134@gmail.com  '), 'trims whitespace');
assert.ok(!isAdminEmail('someoneelse@gmail.com'), 'non-admin email rejected');
assert.ok(!isAdminEmail(null), 'null email rejected');
assert.ok(!isAdminEmail(undefined), 'undefined email rejected');
assert.ok(!isAdminEmail(''), 'empty string rejected');

console.log('✓ apiGuard tests passed');
// apiGuard.ts starts a module-level setInterval (in-memory rate-limit cleanup)
// that otherwise keeps this script's process alive indefinitely.
process.exit(0);
