import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { warnDeprecated, _resetWarnedKeysForTesting } from '../../src/utils/deprecations.js';

beforeEach(() => {
  _resetWarnedKeysForTesting();
});

test('warnDeprecated emits exactly once per key per process', () => {
  const original = console.warn;
  let calls = 0;
  console.warn = () => { calls++; };
  try {
    warnDeprecated('foo', 'foo deprecated');
    warnDeprecated('foo', 'foo deprecated again');
    warnDeprecated('bar', 'bar deprecated');
    warnDeprecated('foo', 'foo deprecated third time');
  } finally {
    console.warn = original;
  }
  assert.equal(calls, 2, 'foo emits once + bar emits once = 2 total');
});
