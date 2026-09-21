import test from 'node:test';
import assert from 'node:assert/strict';
import * as A from 'astronomy-engine';
import {
  calculate,
  position,
  frame,
  aspectsOf,
  wrap,
  delta,
  parseInput,
  localInput,
  validateSaved,
  solarSystem,
  MIN_TIME,
  MAX_TIME,
} from '../lib/engine.mjs';
import { spherePoint, morphPoint } from '../lib/geometry.mjs';
test('time input round trips across UTC offsets, leap days and year boundaries', () => {
  for (const offset of [-720, -210, 0, 330, 345, 540, 765, 840])
    for (const s of [
      '2000-02-29T23:59:59',
      '2024-12-31T23:59:59',
      '1900-03-01T00:00:00',
    ])
      assert.equal(localInput(parseInput(s, offset), offset), s);
  for (const bad of [
    '2023-02-29T12:00',
    '2024-02-30T12:00',
    '2024-13-01T00:00',
    '2024-01-01T24:00',
    '<script>',
    '1799-01-01T00:00',
  ])
    assert.throws(() => parseInput(bad, 0));
  assert.throws(() => parseInput('2024-01-01T00:00', 841));
});
test('ephemeris produces finite coordinates for every body across supported centuries', () => {
  for (const time of [
    MIN_TIME,
    Date.UTC(1900, 0, 1),
    Date.UTC(2000, 0, 1),
    Date.UTC(2026, 8, 10),
    MAX_TIME,
  ]) {
    const c = calculate(time);
    assert.equal(c.bodies.length, 10);
    for (const b of c.bodies) {
      assert.ok(b.lon >= 0 && b.lon < 360);
      assert.ok(Math.abs(b.lat) <= 90);
      assert.ok(b.distance > 0);
      assert.ok(Number.isFinite(b.speed));
    }
  }
});
test('solar system model returns heliocentric positions with Earth at about one AU', () => {
  const bodies = solarSystem(Date.parse('2026-09-21T00:00:00Z'));
  assert.equal(bodies.length, 9);
  const earth = bodies.find((body) => body.id === 'Earth');
  assert.ok(earth);
  assert.ok(Math.abs(earth.distance - 1) < 0.02);
  for (const body of bodies) {
    assert.ok(Number.isFinite(body.x));
    assert.ok(Number.isFinite(body.y));
    assert.ok(Number.isFinite(body.z));
    assert.ok(body.distance > 0);
  }
});
test('known equinox and total solar eclipse are geometrically consistent', () => {
  const eq = position('Sun', Date.parse('2024-03-20T03:06:00Z'));
  assert.ok(Math.abs(delta(eq.lon, 0)) < 0.02);
  const eclipse = Date.parse('2024-04-08T18:17:00Z');
  assert.ok(
    Math.abs(
      delta(position('Sun', eclipse).lon, position('Moon', eclipse).lon),
    ) < 0.15,
  );
});
test('ASC is on the geometric eastern horizon, also in southern and high latitudes', () => {
  for (const latitude of [-89, -66, -33.8, 0, 35.68, 66, 89])
    for (const longitude of [-180, 0, 139.7, 180]) {
      const time = Date.parse('2026-09-10T11:00:00Z');
      const c = frame(time, latitude, longitude);
      const r = (c.asc * Math.PI) / 180;
      const t = A.MakeTime(new Date(time));
      const ect = new A.Vector(Math.cos(r), Math.sin(r), 0, t);
      const eq = A.RotateVector(
        A.CombineRotation(A.Rotation_ECT_EQJ(t), A.Rotation_EQJ_EQD(t)),
        ect,
      );
      const ra = wrap((Math.atan2(eq.y, eq.x) * 180) / Math.PI) / 15;
      const dec = (Math.asin(eq.z) * 180) / Math.PI;
      const h = A.Horizon(t, new A.Observer(latitude, longitude, 0), ra, dec);
      assert.ok(Math.abs(h.altitude) < 0.00001, 'ASC altitude ' + h.altitude);
      assert.ok(h.azimuth >= 0 && h.azimuth <= 180, 'ASC must rise in east');
    }
});
test('aspects handle wraparound and distinguish zodiac longitude from angular distance', () => {
  const list = aspectsOf(
    [
      { id: 'a', lon: 359, lat: 10 },
      { id: 'b', lon: 1, lat: -10 },
    ],
    3,
  );
  assert.equal(list.length, 1);
  assert.equal(list[0].angle, 0);
  assert.equal(list[0].orb, 2);
  assert.ok(list[0].skyAngle > 20);
  assert.equal(
    aspectsOf(
      [
        { id: 'a', lon: 0, lat: 0 },
        { id: 'b', lon: 90, lat: 0 },
      ],
      0,
    )[0].angle,
    90,
  );
  assert.equal(
    aspectsOf(
      [
        { id: 'a', lon: 0, lat: 0 },
        { id: 'b', lon: 92, lat: 0 },
      ],
      1,
    ).length,
    0,
  );
});
test('3D to 2D morph preserves longitude and produces a flat chart at its endpoint', () => {
  for (const lon of [0, 1, 90, 180, 359])
    for (const lat of [-20, 0, 20]) {
      assert.ok(Math.abs(Math.hypot(...spherePoint(lon, lat)) - 218) < 1e-9);
      assert.ok(Math.abs(morphPoint(lon, lat, 1)[1]) < 1e-12);
      assert.ok(Math.abs(Math.hypot(...morphPoint(lon, lat, 1)) - 191) < 1e-9);
      assert.ok(
        Math.abs(
          delta(
            wrap(
              (Math.atan2(
                -morphPoint(lon, lat, 0.5)[2],
                morphPoint(lon, lat, 0.5)[0],
              ) *
                180) /
                Math.PI,
            ),
            lon,
          ),
        ) < 1e-9,
      );
      assert.ok(
        Math.hypot(
          ...morphPoint(lon, lat, 0.50001).map(
            (v, i) => v - morphPoint(lon, lat, 0.5)[i],
          ),
        ) < 0.01,
      );
    }
});
test('local storage validates input and drops unknown fields', () => {
  const saved = {
    version: 1,
    time: Date.now(),
    latitude: 35,
    longitude: 139,
    offset: 540,
  };
  assert.deepEqual(validateSaved({ ...saved, secret: 'ignored' }), {
    time: saved.time,
    latitude: 35,
    longitude: 139,
    offset: 540,
  });
  for (const bad of [
    null,
    {},
    { ...saved, time: NaN },
    { ...saved, latitude: 90 },
    { ...saved, longitude: 181 },
    { ...saved, offset: 900 },
    { ...saved, version: 2 },
  ])
    assert.equal(validateSaved(bad), null);
});
