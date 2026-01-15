const { test } = require('node:test');
const assert = require('node:assert');
const { parseWords, getMedianIndex } = require('../lib/display.js');

test('parseWords splits text on whitespace', () => {
  const words = parseWords('hello world');
  assert.deepStrictEqual(words, ['hello', 'world']);
});

test('parseWords handles multiple spaces', () => {
  const words = parseWords('hello   world');
  assert.deepStrictEqual(words, ['hello', 'world']);
});

test('parseWords handles newlines', () => {
  const words = parseWords('hello\nworld');
  assert.deepStrictEqual(words, ['hello', 'world']);
});

test('parseWords keeps punctuation attached', () => {
  const words = parseWords('hello, world!');
  assert.deepStrictEqual(words, ['hello,', 'world!']);
});

test('parseWords keeps hyphenated words together', () => {
  const words = parseWords('self-contained test');
  assert.deepStrictEqual(words, ['self-contained', 'test']);
});

test('parseWords keeps contractions together', () => {
  const words = parseWords("don't stop");
  assert.deepStrictEqual(words, ["don't", 'stop']);
});

test('getMedianIndex returns 0 for single char', () => {
  assert.strictEqual(getMedianIndex('a'), 0);
});

test('getMedianIndex returns 0 for two chars', () => {
  assert.strictEqual(getMedianIndex('ab'), 0);
});

test('getMedianIndex returns 1 for three chars', () => {
  assert.strictEqual(getMedianIndex('abc'), 1);
});

test('getMedianIndex returns 2 for five chars', () => {
  assert.strictEqual(getMedianIndex('abcde'), 2);
});

test('getMedianIndex returns 2 for six chars', () => {
  assert.strictEqual(getMedianIndex('abcdef'), 2);
});
