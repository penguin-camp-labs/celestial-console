import { mkdir, writeFile, readFile } from 'node:fs/promises';
export const targets = [
  ['Ceres', 1],
  ['Pallas', 2],
  ['Juno', 3],
  ['Vesta', 4],
  ['Chiron', 2060],
  ['Pholus', 5145],
  ['Eros', 433],
  ['Psyche', 16],
];
export const common = {
  format: 'json',
  OBJ_DATA: "'YES'",
  MAKE_EPHEM: "'YES'",
  EPHEM_TYPE: "'VECTORS'",
  CENTER: "'500@399'",
  REF_PLANE: "'FRAME'",
  REF_SYSTEM: "'ICRF'",
  OUT_UNITS: "'AU-D'",
  VEC_TABLE: "'2'",
  VEC_CORR: "'LT+S'",
  TIME_TYPE: "'UT'",
  CSV_FORMAT: "'YES'",
  CAL_TYPE: "'GREGORIAN'",
};
export function rows(result) {
  const block = result?.split('$$SOE')[1]?.split('$$EOE')[0];
  if (!block) throw Error((result || 'No result').slice(-1200));
  return block
    .trim()
    .split('\n')
    .map((line) => {
      const c = line.split(',');
      return [Number(c[0]), ...c.slice(2, 8).map(Number)];
    });
}
export async function request(number, extra) {
  const response = await fetch(
    'https://ssd.jpl.nasa.gov/api/horizons.api?' +
      new URLSearchParams({
        ...common,
        COMMAND: "'" + number + ";'",
        ...extra,
      }),
    { signal: AbortSignal.timeout(240000) },
  );
  if (!response.ok) throw Error('Horizons HTTP ' + response.status);
  const data = await response.json();
  if (data.error) throw Error(data.error);
  return data.result;
}
if (process.argv[1]?.endsWith('build-asteroids.mjs')) {
  await mkdir('public/ephemeris', { recursive: true });
  const manifest = {
    source: 'NASA/JPL Horizons',
    retrieved: new Date().toISOString(),
    frame: 'ICRF equatorial',
    center: 'Earth geocenter',
    correction: 'LT+S',
    timescale: 'UT',
    stepDays: 8,
    format: 'little-endian Float32 x,y,z,vx,vy,vz in AU and AU/day',
    bodies: [],
  };
  const buffers = [];
  for (const [id, number] of targets) {
    let result;
    if (id === 'Ceres') {
      try {
        result = JSON.parse(
          await readFile('outputs/ceres-horizons.json', 'utf8'),
        ).result;
      } catch {}
    }
    result ??= await request(number, {
      START_TIME: "'1799-12-01'",
      STOP_TIME: "'2201-02-01'",
      STEP_SIZE: "'8 d'",
    });
    const points = rows(result);
    if (points.length < 18000) throw Error('Incomplete ' + id);
    for (let i = 1; i < points.length; i++)
      if (Math.abs(points[i][0] - points[i - 1][0] - 8) > 1e-6)
        throw Error('Nonuniform data');
    const buffer = Buffer.alloc(points.length * 6 * 4);
    points.forEach((p, i) =>
      p.slice(1).forEach((v, j) => {
        if (!Number.isFinite(v)) throw Error('Invalid vector');
        buffer.writeFloatLE(v, (i * 6 + j) * 4);
      }),
    );
    manifest.bodies.push({
      id,
      number,
      startJD: points[0][0],
      count: points.length,
      offset: buffers.reduce((n, b) => n + b.length, 0),
      targetHeader: result.slice(0, result.indexOf('$$SOE')).trim(),
    });
    buffers.push(buffer);
    console.log(id, points.length, 'samples');
  }
  await writeFile('public/ephemeris/asteroids.bin', Buffer.concat(buffers));
  await writeFile(
    'public/ephemeris/manifest.json',
    JSON.stringify(manifest, null, 2),
  );
  await writeFile(
    'lib/asteroid-meta.json',
    JSON.stringify({
      stepDays: manifest.stepDays,
      bodies: manifest.bodies.map(({ id, startJD, count, offset }) => ({
        id,
        startJD,
        count,
        offset,
      })),
    }),
  );
  console.log(
    'Saved',
    buffers.reduce((n, b) => n + b.length, 0),
    'bytes',
  );
}
