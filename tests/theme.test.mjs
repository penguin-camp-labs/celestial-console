import test from 'node:test';
import assert from 'node:assert/strict';
import * as A from 'astronomy-engine';
import { calculate } from '../lib/engine.mjs';
import {
  solarPosition,
  skyAppearance,
  themeAppearance,
  inkColor,
} from '../lib/theme.mjs';

test('solar altitude agrees with the independent equatorial-to-horizon path', () => {
  for (const [iso, lat, lon] of [
    ['2026-03-20T03:00:00Z', 35.68, 139.77],
    ['2026-06-21T12:00:00Z', 78, 15],
    ['2026-12-21T12:00:00Z', 78, 15],
    ['1900-02-04T21:15:00Z', -33.86, 151.21],
    ['2150-09-14T00:00:00Z', 0, -150],
  ]) {
    const date = new Date(iso);
    const observer = new A.Observer(lat, lon, 0);
    const equ = A.Equator('Sun', date, observer, true, true);
    const reference = A.Horizon(date, observer, equ.ra, equ.dec);
    const actual = solarPosition(calculate(+date, lat, lon));
    assert.ok(
      Math.abs(actual.altitude - reference.altitude) < 0.002,
      `${iso}: ${actual.altitude} vs ${reference.altitude}`,
    );
    assert.ok(Math.abs(Math.hypot(...actual.direction) - 1) < 1e-10);
  }
});
test('sky follows longitude and polar seasons, not a fixed clock schedule', () => {
  const t = Date.parse('2026-03-20T12:00:00Z');
  assert.ok(solarPosition(calculate(t, 0, 0)).altitude > 85);
  assert.ok(solarPosition(calculate(t, 0, 180)).altitude < -85);
  assert.equal(
    themeAppearance(
      'sky',
      calculate(Date.parse('2026-06-21T00:00:00Z'), 78, 15),
    ).phase,
    '昼',
  );
  assert.notEqual(
    themeAppearance(
      'sky',
      calculate(Date.parse('2026-12-21T12:00:00Z'), 78, 15),
    ).phase,
    '昼',
  );
});
test('twilight colours and fixed-star visibility change continuously at each boundary', () => {
  assert.equal(skyAppearance(-30).stars, 1);
  assert.equal(skyAppearance(10).stars, 0);
  let previous = 1;
  for (let h = -90; h <= 90; h += 0.25) {
    const sky = skyAppearance(h);
    assert.ok(sky.stars <= previous + 1e-10);
    previous = sky.stars;
    for (const key of ['zenith', 'horizon', 'ground'])
      assert.match(sky[key], /^#[0-9a-f]{6}$/);
  }
  for (const h of [-18, -12, -6, -1, 6, 25]) {
    const before = skyAppearance(h - 0.0001);
    const after = skyAppearance(h + 0.0001);
    for (const key of ['zenith', 'horizon', 'ground'])
      assert.equal(before[key], after[key]);
  }
});
test('manual themes ignore solar daylight while marker hues remain distinguishable', () => {
  const day = calculate(Date.parse('2026-03-20T12:00:00Z'), 0, 0);
  const night = calculate(Date.parse('2026-03-20T00:00:00Z'), 0, 0);
  assert.equal(themeAppearance('dark', day).light, false);
  assert.equal(themeAppearance('light', night).light, true);
  assert.equal(inkColor('#f4d08a', false), '#f4d08a');
  assert.notEqual(inkColor('#f4d08a', true), inkColor('#83bfff', true));
});
