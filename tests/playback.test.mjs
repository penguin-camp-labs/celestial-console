import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate, DAY, delta, frame } from '../lib/engine.mjs';
import {
  PlaybackInterpolator,
  interpolateChart,
  phaseBetween,
} from '../lib/playback.mjs';
const chart = (time, latitude = 35.68, longitude = 139.7) => ({
  ...calculate(time, latitude, longitude),
  time,
  latitude,
  longitude,
});
test('playback phase interpolation handles wraparound, retrograde and more than a full turn', () => {
  assert.ok(Math.abs(delta(phaseBetween(359, 1, 0.5, 2), 0)) < 1e-10);
  assert.equal(phaseBetween(1, 359, 0.5, -2), 0);
  assert.equal(phaseBetween(10, 110, 0.5, 460), 240);
  assert.equal(phaseBetween(110, 10, 0.5, -460), 240);
});
test('render samples advance continuously between 10 Hz updates and stop at the calculated date', () => {
  const a = chart(Date.UTC(2026, 8, 10));
  const b = chart(a.time + DAY * 0.1);
  const c = chart(a.time + DAY * 0.2);
  const p = new PlaybackInterpolator();
  assert.equal(p.sample(a, 0, true).time, a.time);
  assert.equal(p.sample(b, 100, true).time, a.time);
  const times = [125, 150, 175, 200].map((t) => p.sample(b, t, true).time);
  for (let i = 0; i < times.length; i++)
    assert.ok(Math.abs(times[i] - (a.time + DAY * 0.025 * (i + 1))) < 1);
  assert.equal(p.sample(c, 200, true).time, b.time, 'new samples do not jump');
  const middle = p.sample(c, 250, true);
  assert.ok(middle.time > b.time && middle.time < c.time);
  const exactFrame = frame(middle.time, a.latitude, a.longitude);
  assert.equal(middle.asc, exactFrame.asc);
  assert.ok(
    middle.bodies.every(
      (b) => Number.isFinite(b.lon) && Number.isFinite(b.lat),
    ),
  );
  assert.equal(
    p.sample(c, 9999, true).time,
    c.time,
    'no extrapolation during stalls',
  );
  assert.equal(
    p.sample(c, 10000, false),
    c,
    'pause returns the exact calculated chart',
  );
});
test('reverse playback and configuration changes reset safely without extra ephemeris samples', () => {
  const a = chart(Date.UTC(2026, 8, 10));
  const b = chart(a.time - DAY);
  const p = new PlaybackInterpolator();
  p.sample(a, 0, true);
  p.sample(b, 100, true);
  assert.equal(p.sample(b, 150, true).time, a.time - DAY / 2);
  const relocated = chart(b.time, -33.8, 151.2);
  assert.equal(p.sample(relocated, 160, true), relocated);
  assert.equal(p.sample(a, 170, false), a);
  const midpoint = interpolateChart(a, b, 0.5);
  assert.equal(midpoint.time, a.time - DAY / 2);
});
