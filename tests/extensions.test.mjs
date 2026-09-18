import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  ALL_ASPECTS,
  defaultAspectSettings,
  aspectEdges,
  findPatterns,
  PATTERNS,
} from '../lib/aspects.mjs';
import {
  decodeEphemeris,
  asteroidVector,
  asteroidBodies,
} from '../lib/asteroids.mjs';
import { resolveZonedTime, offsetLabel } from '../lib/timezone.mjs';
import fixtures from './asteroid-fixtures.json' with { type: 'json' };
const make = (lons) => lons.map((lon, i) => ({ id: String(i), lon, lat: 0 }));
test('minor aspects use independent orb limits and group/type switches', () => {
  const settings = defaultAspectSettings();
  const b = make([359, 29.5]);
  assert.equal(aspectEdges(b, settings).length, 0);
  const list = aspectEdges(b, settings, { major: true, minor: true });
  assert.equal(list[0].angle, 30);
  assert.equal(list[0].orb, 0.5);
  settings[30].orb = 0.4;
  assert.equal(
    aspectEdges(b, settings, { major: false, minor: true }).length,
    0,
  );
  settings[30].orb = 0.5;
  settings[30].enabled = false;
  assert.equal(
    aspectEdges(b, settings, { major: true, minor: true }).length,
    0,
  );
  settings[30].enabled = true;
  settings[45].orb = 10;
  settings[30].orb = 10;
  assert.equal(
    aspectEdges(make([0, 39]), settings, { major: true, minor: true })[0].angle,
    45,
    'nearest angle wins when orb windows overlap',
  );
});
test('six pattern topologies are detected once across role permutations and honor every edge', () => {
  const cases = {
    'grand-trine': [0, 120, 240],
    't-square': [0, 90, 180],
    yod: [0, 60, 210],
    'grand-cross': [0, 90, 180, 270],
    kite: [0, 120, 240, 180],
    rectangle: [0, 60, 180, 240],
  };
  const settings = defaultAspectSettings();
  ALL_ASPECTS.forEach((a) => (settings[a.angle].orb = 0));
  for (const p of PATTERNS) {
    const bodies = make(cases[p.id]);
    const result = findPatterns(bodies, settings, [p.id]);
    assert.equal(result.length, 1, p.id);
    assert.equal(result[0].edges.length, p.edges.length);
    assert.equal(
      findPatterns([...bodies].reverse(), settings, [p.id]).length,
      1,
    );
    bodies[0].lon += 0.01;
    assert.equal(
      findPatterns(bodies, settings, [p.id]).length,
      0,
      p.id + ' rejects a broken edge',
    );
  }
  assert.equal(
    findPatterns(make([0, 60, 210]), defaultAspectSettings(), []).length,
    0,
  );
  const settings2 = defaultAspectSettings();
  settings2[150].enabled = false;
  assert.equal(
    findPatterns(make([0, 60, 210]), settings2, ['yod']).length,
    1,
    'pattern detection independent from ordinary line switch',
  );
});
test('eight asteroid interpolations match 240 independently requested JPL reference vectors', async () => {
  const raw = await readFile('public/ephemeris/asteroids.bin');
  const data = decodeEphemeris(
    raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength),
  );
  let worst = 0;
  for (const f of fixtures.fixtures)
    for (const r of f.records) {
      const v = asteroidVector(f.id, r.time, data);
      const w = r.vector;
      const cross = [
        v[1] * w[2] - v[2] * w[1],
        v[2] * w[0] - v[0] * w[2],
        v[0] * w[1] - v[1] * w[0],
      ];
      const error =
        ((Math.asin(
          Math.min(
            1,
            Math.hypot(...cross) / Math.hypot(...v) / Math.hypot(...w),
          ),
        ) *
          180) /
          Math.PI) *
        3600;
      worst = Math.max(worst, error);
      assert.ok(error < 1, f.id + ' interpolation error ' + error);
    }
  assert.ok(worst > 0);
  const ids = fixtures.fixtures.map((f) => f.id);
  for (const t of [
    Date.UTC(1800, 0, 1),
    Date.UTC(2026, 8, 10),
    Date.UTC(2201, 0, 1) - 1,
  ])
    for (const b of asteroidBodies(ids, t, data)) {
      assert.ok(b.lon >= 0 && b.lon < 360);
      assert.ok(Math.abs(b.lat) <= 90);
      assert.ok(Number.isFinite(b.speed));
      assert.ok(b.distance > 0);
    }
  assert.throws(() => decodeEphemeris(new ArrayBuffer(8)));
  assert.throws(() => asteroidVector('Ceres', Date.UTC(1700, 0, 1), data));
});
test('birth time handles summer time, repeated/nonexistent times, fractional offsets and leap days', () => {
  assert.equal(
    resolveZonedTime('2024-07-01T12:00:00', 'America/New_York').time,
    Date.parse('2024-07-01T16:00:00Z'),
  );
  assert.equal(
    resolveZonedTime('2024-01-01T12:00:00', 'America/New_York').offset,
    -300,
  );
  assert.throws(
    () => resolveZonedTime('2024-03-10T02:30:00', 'America/New_York'),
    /存在しない/,
  );
  assert.throws(
    () => resolveZonedTime('2024-11-03T01:30:00', 'America/New_York'),
    /2回/,
  );
  const early = resolveZonedTime(
    '2024-11-03T01:30:00',
    'America/New_York',
    'earlier',
  );
  const late = resolveZonedTime(
    '2024-11-03T01:30:00',
    'America/New_York',
    'later',
  );
  assert.equal(late.time - early.time, 3600000);
  assert.equal(
    resolveZonedTime('2000-02-29T00:00:00', 'Asia/Kathmandu').offset,
    345,
  );
  assert.throws(() => resolveZonedTime('2023-02-29T00:00:00', 'Asia/Tokyo'));
  assert.equal(offsetLabel(345), 'UTC+05:45');
  assert.equal(offsetLabel(9 * 60 + 18 + 59 / 60), 'UTC+09:18:59');
});

test('lunar node axis is excluded from ordinary and compound aspects only for that pair', () => {
  const settings = defaultAspectSettings();
  const nodes = [
    { id: 'NorthNode', lon: 0, lat: 0, kind: 'point' },
    { id: 'SouthNode', lon: 180, lat: 0, kind: 'point' },
  ];
  for (const pair of [nodes, [...nodes].reverse()]) {
    assert.deepEqual(
      aspectEdges(pair, settings, { major: true, minor: true }),
      [],
    );
    assert.deepEqual(
      findPatterns([...pair, { id: 'Moon', lon: 90, lat: 0 }], settings, [
        't-square',
      ]),
      [],
    );
  }
  const bodies = [
    ...nodes,
    { id: 'Sun', lon: 180, lat: 0 },
    { id: 'Moon', lon: 90, lat: 0 },
  ];
  assert.ok(
    aspectEdges(bodies, settings).some(
      (e) => e.a === 'NorthNode' && e.b === 'Sun' && e.angle === 180,
    ),
    'other oppositions remain',
  );
  assert.ok(
    findPatterns(bodies, settings, ['t-square']).some(
      (p) => p.bodies.includes('NorthNode') && p.bodies.includes('Sun'),
    ),
    'valid point patterns remain',
  );
});
