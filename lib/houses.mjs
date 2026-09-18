import { DEG, wrap, delta } from './engine.mjs';
export const HOUSE_SYSTEMS = [
  { value: 'placidus', label: 'プラシーダス' },
  { value: 'campanus', label: 'キャンパナス' },
  { value: 'koch', label: 'コッホ' },
  { value: 'regiomontanus', label: 'レギオモンタナス' },
  { value: 'porphyry', label: 'ポーフィリー' },
  { value: 'equal', label: 'イコール / ASC起点' },
  { value: 'whole', label: 'ホールサイン' },
];
const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unavailable = (message) => ({
  cusps: [],
  centres: [],
  available: false,
  message,
});
const finish = (cusps) => ({
  cusps,
  centres: cusps.map((c, i) => wrap(c + delta(cusps[(i + 1) % 12], c) / 2)),
  available: true,
  message: '',
});

const unit = (v) => {
  const n = Math.hypot(...v);
  return v.map((x) => x / n);
};
const equatorial = (ra, dec, eps) => [
  Math.cos(dec) * Math.cos(ra),
  Math.cos(dec) * Math.sin(ra) * Math.cos(eps) + Math.sin(dec) * Math.sin(eps),
  -Math.cos(dec) * Math.sin(ra) * Math.sin(eps) + Math.sin(dec) * Math.cos(eps),
];
const latitudeOf = (f) =>
  f.latitude ??
  Math.asin(
    Math.max(
      -1,
      Math.min(
        1,
        dot(f.zenith, [0, Math.sin(f.eps * DEG), Math.cos(f.eps * DEG)]),
      ),
    ),
  ) / DEG;
function regioBasis(f, i) {
  const q = equatorial((f.lst + 90 + i * 30) * DEG, 0, f.eps * DEG);
  const d = dot(q, f.north);
  return unit(q.map((v, j) => v - d * f.north[j]));
}
function kochBasis(f, i) {
  const eps = f.eps * DEG;
  const phi = latitudeOf(f) * DEG;
  const dec = Math.asin(Math.sin(f.mc * DEG) * Math.sin(eps));
  const arc =
    Math.acos(Math.max(-1, Math.min(1, -Math.tan(phi) * Math.tan(dec)))) / DEG;
  if (i === 3 || i === 9) {
    const axis = equatorial(0, Math.PI / 2, eps);
    const q = equatorial(f.lst * DEG, 0, eps).map(
      (v) => v * (i === 9 ? 1 : -1),
    );
    return [axis, q];
  }
  const shifts = [
    0,
    arc / 3,
    (2 * arc) / 3,
    0,
    (-2 * arc) / 3,
    -arc / 3,
    0,
    arc / 3,
    (2 * arc) / 3,
    0,
    (-2 * arc) / 3,
    -arc / 3,
  ];
  const ra = (f.lst + shifts[i]) * DEG;
  const north = equatorial(ra + Math.PI, Math.PI / 2 - phi, eps);
  const east = equatorial(ra + Math.PI / 2, 0, eps);
  return [north, east.map((v) => v * (i >= 4 && i <= 8 ? -1 : 1))];
}
function planeCusp(axis, q) {
  const n = cross(axis, q);
  const v = [-n[1], n[0], 0];
  if (Math.hypot(...v) < 1e-10) return null;
  if (dot(v, q) < 0) {
    v[0] *= -1;
    v[1] *= -1;
  }
  return wrap(Math.atan2(v[1], v[0]) / DEG);
}
function semicircle(axis, q, cusp) {
  const l = cusp * DEG;
  const point = [Math.cos(l), Math.sin(l), 0];
  const at = Math.atan2(dot(point, q), dot(point, axis));
  const angles = Array.from({ length: 129 }, (_, k) => (k * Math.PI) / 128);
  angles[Math.max(1, Math.min(127, Math.round((at * 128) / Math.PI)))] = at;
  angles.sort((a, b) => a - b);
  return angles.map((a) =>
    axis.map((v, j) => v * Math.cos(a) + q[j] * Math.sin(a)),
  );
}

// Independently implement the geometric definitions. Swiss Ephemeris is used only
// as an external reference in fixtures, never as distributed runtime code.
export function houseCusps(f, system = 'equal') {
  if (system === 'equal' || system === 'whole') {
    const start = system === 'whole' ? Math.floor(f.asc / 30) * 30 : f.asc;
    return finish(Array.from({ length: 12 }, (_, i) => wrap(start + i * 30)));
  }
  if (system === 'porphyry') {
    // Trisect the ecliptic quadrants. At polar latitudes retain the ASC and
    // choose the meridian intersection that orders the quadrants consistently.
    let mc = f.mc;
    if (wrap(f.asc - mc) > 180) mc = wrap(mc + 180);
    const anchors = [f.asc, wrap(mc + 180), wrap(f.asc + 180), mc];
    return finish(
      anchors.flatMap((a, i) =>
        Array.from({ length: 3 }, (_, j) =>
          wrap(a + (wrap(anchors[(i + 1) % 4] - a) * j) / 3),
        ),
      ),
    );
  }
  if (system === 'regiomontanus' || system === 'koch') {
    if (
      system === 'koch' &&
      Math.abs(latitudeOf(f)) >= 90 - Math.abs(f.eps) - 1e-7
    )
      return unavailable(
        'この緯度ではコッホを計算できません。別の方式を選んでください。',
      );
    const cusps = Array.from({ length: 12 }, (_, i) => {
      const [axis, q] =
        system === 'koch' ? kochBasis(f, i) : [f.north, regioBasis(f, i)];
      return planeCusp(axis, q);
    });
    if (cusps.some((c) => c === null || !Number.isFinite(c)))
      return unavailable(
        'この地点・日時ではハウスの境界が一意に定まりません。別の方式を選んでください。',
      );
    return finish(cusps);
  }
  if (system === 'campanus') {
    // Divide the prime vertical from east towards the nadir. Each house plane
    // contains the north/south horizon axis and one of these 30-degree divisions.
    const cusps = [];
    for (let i = 0; i < 12; i++) {
      const a = -i * 30 * DEG;
      const q = f.east.map(
        (x, j) => x * Math.cos(a) + f.zenith[j] * Math.sin(a),
      );
      const normal = cross(f.north, q);
      const v = [-normal[1], normal[0], 0];
      const length = Math.hypot(v[0], v[1]);
      if (length < 1e-10)
        return unavailable(
          'この地点・日時ではキャンパナスの境界が一意に定まりません。日時を変えるか、イコールを選んでください。',
        );
      if (dot(v, q) < 0) {
        v[0] *= -1;
        v[1] *= -1;
      }
      cusps.push(wrap(Math.atan2(v[1], v[0]) / DEG));
    }
    return finish(cusps);
  }
  if (system !== 'placidus') return unavailable('ハウス方式を選んでください。');
  const eps = f.eps * DEG;
  const pole = [0, Math.sin(eps), Math.cos(eps)];
  const latitude =
    f.latitude ??
    Math.asin(Math.max(-1, Math.min(1, dot(f.zenith, pole)))) / DEG;
  if (Math.abs(latitude) >= 90 - Math.abs(f.eps) - 1e-7)
    return unavailable(
      'この緯度ではプラシーダスを計算できません。キャンパナスまたはイコールを選んでください。',
    );
  const tanPhi = Math.tan(latitude * DEG);
  const mc = f.mc;
  const asc = mc + wrap(f.asc - mc);
  const ic = mc + 180;
  // For each ecliptic point, trisect its own semi-diurnal / semi-nocturnal arc.
  function residual(lon, fraction, below) {
    const l = lon * DEG;
    const ra = Math.atan2(Math.sin(l) * Math.cos(eps), Math.cos(l)) / DEG;
    const dec = Math.asin(Math.sin(eps) * Math.sin(l));
    const cosH = -tanPhi * Math.tan(dec);
    if (Math.abs(cosH) > 1) return NaN;
    const semiDay = Math.acos(cosH) / DEG;
    const target = below
      ? semiDay + (180 - semiDay) * fraction
      : semiDay * fraction;
    return delta(ra, f.lst + target);
  }
  function solve(lo, hi, fraction, below) {
    let flo = residual(lo, fraction, below);
    let fhi = residual(hi, fraction, below);
    if (!Number.isFinite(flo + fhi) || flo * fhi > 0) return null;
    for (let i = 0; i < 48; i++) {
      const mid = (lo + hi) / 2;
      const fm = residual(mid, fraction, below);
      if (!Number.isFinite(fm)) return null;
      if (flo * fm <= 0) {
        hi = mid;
        fhi = fm;
      } else {
        lo = mid;
        flo = fm;
      }
    }
    return wrap((lo + hi) / 2);
  }
  const h11 = solve(mc, asc, 1 / 3, false);
  const h12 = solve(mc, asc, 2 / 3, false);
  const h2 = solve(asc, ic, 1 / 3, true);
  const h3 = solve(asc, ic, 2 / 3, true);
  if ([h11, h12, h2, h3].some((x) => x === null))
    return unavailable(
      'この地点・日時ではプラシーダスの解を確定できません。別の方式を選んでください。',
    );
  return finish([
    f.asc,
    h2,
    h3,
    wrap(mc + 180),
    wrap(h11 + 180),
    wrap(h12 + 180),
    wrap(f.asc + 180),
    wrap(h2 + 180),
    wrap(h3 + 180),
    mc,
    h11,
    h12,
  ]);
}

// Unit vectors in the true ecliptic frame of date. Campanus uses great
// semicircles through the N/S horizon axis; Placidus uses semi-arc curves.
// Equal/Whole Sign are longitude sectors, extended to the ecliptic poles.
export function houseBoundaryCurves(
  f,
  system = 'equal',
  result = houseCusps(f, system),
) {
  if (!result.available) return [];
  const eps = f.eps * DEG;
  const latitude =
    f.latitude ??
    Math.asin(dot(f.zenith, [0, Math.sin(eps), Math.cos(eps)])) / DEG;
  const toEcliptic = (ra, dec) => {
    const x = Math.cos(dec) * Math.cos(ra);
    const y = Math.cos(dec) * Math.sin(ra);
    const z = Math.sin(dec);
    return [
      x,
      y * Math.cos(eps) + z * Math.sin(eps),
      -y * Math.sin(eps) + z * Math.cos(eps),
    ];
  };
  return result.cusps.map((cusp, i) => {
    if (system === 'campanus') {
      const angle = -i * 30 * DEG;
      const q = f.east.map(
        (v, j) => v * Math.cos(angle) + f.zenith[j] * Math.sin(angle),
      );
      const l = cusp * DEG;
      const point = [Math.cos(l), Math.sin(l), 0];
      const at = Math.atan2(dot(point, q), dot(point, f.north));
      const angles = Array.from({ length: 129 }, (_, k) => (k * Math.PI) / 128);
      angles[Math.max(1, Math.min(127, Math.round((at * 128) / Math.PI)))] = at;
      angles.sort((a, b) => a - b);
      return angles.map((a) =>
        f.north.map((v, j) => v * Math.cos(a) + q[j] * Math.sin(a)),
      );
    }
    if (system === 'regiomontanus')
      return semicircle(f.north, regioBasis(f, i), cusp);
    if (system === 'koch') {
      const [axis, q] = kochBasis(f, i);
      return semicircle(axis, q, cusp);
    }
    if (system === 'equal' || system === 'whole' || system === 'porphyry')
      return Array.from({ length: 129 }, (_, k) => {
        const lat = (-90 + (k * 180) / 128) * DEG;
        const l = cusp * DEG;
        return [
          Math.cos(lat) * Math.cos(l),
          Math.cos(lat) * Math.sin(l),
          Math.sin(lat),
        ];
      });
    const limit = Math.min(89.999999, 90 - Math.abs(latitude));
    const decs = Array.from(
      { length: 129 },
      (_, k) => (-limit + (2 * limit * k) / 128) * DEG,
    );
    const cuspDec = Math.asin(Math.sin(eps) * Math.sin(cusp * DEG));
    decs[
      Math.max(
        1,
        Math.min(
          127,
          Math.round(((cuspDec / DEG + limit) * 128) / (2 * limit)),
        ),
      )
    ] = cuspDec;
    decs.sort((a, b) => a - b);
    return decs.map((dec) => {
      const h =
        Math.acos(
          Math.max(-1, Math.min(1, -Math.tan(latitude * DEG) * Math.tan(dec))),
        ) / DEG;
      const n = 180 - h;
      const offsets = [
        h,
        h + n / 3,
        h + (2 * n) / 3,
        180,
        180 + n / 3,
        180 + (2 * n) / 3,
        360 - h,
        360 - (2 * h) / 3,
        360 - h / 3,
        0,
        h / 3,
        (2 * h) / 3,
      ];
      return toEcliptic((f.lst + offsets[i]) * DEG, dec);
    });
  });
}
