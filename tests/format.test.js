const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// round() lives in the browser controller; load just that function for testing.
const source = fs.readFileSync(new URL('../js/app.js', `file://${__filename}`), 'utf8');
const start = source.indexOf('function round(');
const end = source.indexOf('\nfunction ', start + 10);
const context = {};
vm.createContext(context);
vm.runInContext(source.slice(start, end) + '\nthis.round = round;', context);
const round = context.round;

test('whole numbers keep their trailing zeros when no decimals are shown', () => {
  assert.equal(round(2000, 0), '2000');
  assert.equal(round(6000, 0), '6000');
  assert.equal(round(1200, 0), '1200');
  assert.equal(round(10, 0), '10');
  assert.equal(round(100, 0), '100');
  assert.equal(round(0, 0), '0');
});

test('decimals are still trimmed without damaging the integer part', () => {
  assert.equal(round(100, 4), '100');
  assert.equal(round(2.7, 4), '2.7');
  assert.equal(round(0.5, 4), '0.5');
  assert.equal(round(1528.3, 0), '1528');
  assert.equal(round(0, 4), '0');
  assert.equal(round(8.1, 4), '8.1');
});

test('non-finite values still format as the existing placeholder', () => {
  assert.equal(round(NaN), '0');
  assert.equal(round(Infinity), '0');
});
