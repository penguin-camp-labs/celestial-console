import * as A from 'astronomy-engine';
import { DEG, DAY, wrap, delta } from './engine.mjs';
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
// Osculating two-body apogee, not the mean or interpolated lunar apogee.
// State is geocentric EQJ, in AU and AU/day; both Earth and Moon contribute to GM.
export function apogeeFromState(state, mu = A.MassProduct(A.Body.EMB)) {
  const r = [state.x, state.y, state.z];
  const v = [state.vx, state.vy, state.vz];
  const radius = Math.hypot(...r);
  if (
    !r.every(Number.isFinite) ||
    !v.every(Number.isFinite) ||
    !Number.isFinite(mu) ||
    mu <= 0 ||
    radius <= 0
  )
    return null;
  const vxh = cross(v, cross(r, v));
  const ecc = vxh.map((x, i) => x / mu - r[i] / radius);
  const e = Math.hypot(...ecc);
  if (!Number.isFinite(e) || e < 1e-8 || e >= 1) return null;
  return { direction: ecc.map((x) => -x / e), eccentricity: e };
}
export function trueLilithPosition(time) {
  const t = A.MakeTime(new Date(time));
  const apogee = apogeeFromState(A.GeoMoonState(t));
  if (!apogee) return null;
  const d = apogee.direction;
  const v = A.RotateVector(
    A.Rotation_EQJ_ECT(t),
    new A.Vector(d[0], d[1], d[2], t),
  );
  return {
    lon: wrap(Math.atan2(v.y, v.x) / DEG),
    lat: Math.atan2(v.z, Math.hypot(v.x, v.y)) / DEG,
  };
}
export function trueLilith(time) {
  const p = trueLilithPosition(time);
  const step = DAY / 24;
  const before = trueLilithPosition(time - step);
  const after = trueLilithPosition(time + step);
  if (!p || !before || !after) return null;
  return {
    id: 'TrueLilith',
    name: 'リリス（真位置）',
    symbol: '⚸',
    color: '#e8a9da',
    ...p,
    speed: delta(after.lon, before.lon) / ((2 * step) / DAY),
    distance: null,
    kind: 'point',
    description: '月の接触軌道の遠地点（True Lilith・近似計算）',
  };
}

// Meeus, Astronomical Algorithms (2nd ed.), chapter 47 mean lunar elements.
// Project the apsidal direction in the inclined mean lunar orbit onto the
// ecliptic, then add nutation to match the chart's true equinox of date.
export function meanLilithPosition(time) {
  const t = A.MakeTime(new Date(time));
  const T = t.tt / 36525;
  const T2 = T * T;
  const T3 = T2 * T;
  const T4 = T3 * T;
  const perigee =
    83.3532465 + 4069.0137287 * T - 0.01032 * T2 - 0.00001249172 * T3;
  const node = wrap(
    125.0445479 -
      1934.1362891 * T +
      0.0020754 * T2 +
      T3 / 467441 -
      T4 / 60616000,
  );
  const u = wrap(perigee + 180 - node) * DEG;
  const i = 5.145396 * DEG;
  return {
    lon: wrap(
      node +
        Math.atan2(Math.sin(u) * Math.cos(i), Math.cos(u)) / DEG +
        A.e_tilt(t).dpsi / 3600,
    ),
    lat: Math.asin(Math.sin(u) * Math.sin(i)) / DEG,
  };
}
export function meanLilith(time) {
  const p = meanLilithPosition(time);
  const before = meanLilithPosition(time - DAY / 2);
  const after = meanLilithPosition(time + DAY / 2);
  return {
    id: 'MeanLilith',
    name: 'リリス（平均位置）',
    symbol: '⚸',
    color: '#e8a9da',
    ...p,
    speed: delta(after.lon, before.lon),
    distance: null,
    kind: 'point',
    description: '月の平均軌道の遠地点（Mean Lilith・近似計算）',
  };
}
