import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expandLocationQuery, findCity, locationMatchesCity } from '../lib/cn-cities.mjs';

test('expandLocationQuery(深圳) includes Chinese + English aliases', () => {
  const out = expandLocationQuery('深圳');
  assert.deepEqual(out, ['深圳', 'Shenzhen']);
});

test('expandLocationQuery accepts comma and Chinese comma', () => {
  const out = expandLocationQuery('深圳,上海，杭州');
  assert.ok(out.includes('深圳') && out.includes('Shenzhen'));
  assert.ok(out.includes('上海') && out.includes('Shanghai'));
  assert.ok(out.includes('杭州') && out.includes('Hangzhou'));
});

test('findCity is case-insensitive and strips 市', () => {
  assert.equal(findCity('SHENZHEN')?.label, '深圳');
  assert.equal(findCity('深圳市')?.label, '深圳');
  assert.equal(findCity('Xi\'an')?.label, '西安');
});

test('locationMatchesCity hits 中国-深圳 and multi-city strings', () => {
  assert.equal(locationMatchesCity('中国-深圳', '深圳'), true);
  assert.equal(locationMatchesCity('北京/杭州', '杭州'), true);
  assert.equal(locationMatchesCity('北京/杭州', '深圳'), false);
  assert.equal(locationMatchesCity('Shenzhen, China', '深圳'), true);
  assert.equal(locationMatchesCity('', '深圳'), false);
});
