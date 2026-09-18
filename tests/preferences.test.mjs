import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultPreferences,
  validatePreferences,
} from '../lib/preferences.mjs';
test('preferences reject unknown schemas and restore only valid fields', () => {
  for (const v of [null, [], {}, { version: 2 }])
    assert.equal(validatePreferences(v), null);
  const p = validatePreferences({
    version: 1,
    theme: 'light',
    speed: NaN,
    span: -1,
    houseSystem: 'bad',
    houses: 'yes',
    lilithType: 'mean',
    orb: 99,
    asteroids: ['Ceres', 'Ceres', 'unknown'],
    pointIds: [],
    aspectSettings: {
      0: { enabled: false, orb: 1.5 },
      60: { enabled: 'bad', orb: -3 },
    },
    time: 42,
    latitude: 89,
  });
  assert.equal(p.theme, 'light');
  assert.equal(p.speed, 1);
  assert.equal(p.span, 30);
  assert.equal(p.houseSystem, 'equal');
  assert.equal(p.houses, false);
  assert.equal(p.orb, 6);
  assert.equal(p.lilithType, 'mean');
  assert.deepEqual(p.asteroids, ['Ceres']);
  assert.deepEqual(p.pointIds, []);
  assert.deepEqual(p.aspectSettings[0], { enabled: false, orb: 1.5 });
  assert.deepEqual(p.aspectSettings[60], { enabled: true, orb: 6 });
  assert.ok(!('time' in p) && !('latitude' in p));
  const d = defaultPreferences();
  d.speed = 1 / 24;
  d.direction = -1;
  d.span = 3650;
  d.houses = true;
  d.orb = 0;
  d.minor = true;
  d.patternTypes = [];
  d.aspectSettings[150] = { enabled: false, orb: 0 };
  assert.deepEqual(validatePreferences(JSON.parse(JSON.stringify(d))), d);
});

test('sphere guide preferences preserve old grid visibility and new house mode', () => {
  assert.equal(
    validatePreferences({ version: 1, grid: false }).gridMode,
    'off',
  );
  assert.equal(
    validatePreferences({ version: 1, grid: true }).gridMode,
    'grid',
  );
  assert.equal(
    validatePreferences({ version: 1, gridMode: 'houses' }).gridMode,
    'houses',
  );
});

test('additional house choices survive saved preference round trips', () => {
  for (const houseSystem of ['koch', 'regiomontanus', 'porphyry'])
    assert.equal(
      validatePreferences(
        JSON.parse(JSON.stringify({ ...defaultPreferences(), houseSystem })),
      ).houseSystem,
      houseSystem,
    );
});
