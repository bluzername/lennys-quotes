import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMatchExpression, tokenize } from '../src/db/fts-query.js';

test('tokenize separates quoted phrases from words', () => {
  assert.deepEqual(tokenize('"product market fit" hiring, growth!'), {
    phrases: ['product market fit'],
    words: ['hiring', 'growth']
  });
});

test('buildMatchExpression quotes every term so FTS operators are literal', () => {
  assert.equal(buildMatchExpression('AND OR NOT foo:bar'), '"AND" "OR" "NOT" "foo" "bar"');
  assert.equal(buildMatchExpression('a "b c"', 'any'), '"b c" OR "a"');
  assert.equal(buildMatchExpression('   '), null);
});

test('buildMatchExpression keeps apostrophes and hyphens inside words', () => {
  assert.equal(buildMatchExpression("don't product-market"), `"don't" "product-market"`);
});
