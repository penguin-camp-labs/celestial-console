import * as Astronomy from 'astronomy-engine';
export const DAY = 86400000;
export const MIN_TIME = Date.UTC(1800, 0, 1);
export const MAX_TIME = Date.UTC(2201, 0, 1) - 1;
export const DEG = Math.PI / 180;
export const SIGNS = [
  '牡羊座',
  '牡牛座',
  '双子座',
  '蟹座',
  '獅子座',
  '乙女座',
  '天秤座',
  '蠍座',
  '射手座',
  '山羊座',
  '水瓶座',
  '魚座',
];
export const GLYPHS = [
  '♈',
  '♉',
  '♊',
  '♋',
  '♌',
  '♍',
  '♎',
  '♏',
  '♐',
  '♑',
  '♒',
  '♓',
].map((s) => s + '\uFE0E');
export const BODIES = [
  { id: 'Sun', name: '太陽', symbol: '☉', color: '#ffd48a' },
  { id: 'Moon', name: '月', symbol: '☽', color: '#e8efff' },
  { id: 'Mercury', name: '水星', symbol: '☿', color: '#a2d0d9' },
  { id: 'Venus', name: '金星', symbol: '♀', color: '#efb8d3' },
  { id: 'Mars', name: '火星', symbol: '♂', color: '#ff9079' },
  { id: 'Jupiter', name: '木星', symbol: '♃', color: '#eac28f' },
  { id: 'Saturn', name: '土星', symbol: '♄', color: '#d7d395' },
  { id: 'Uranus', name: '天王星', symbol: '♅', color: '#8ff3e4' },
  { id: 'Neptune', name: '海王星', symbol: '♆', color: '#99b9ff' },
  { id: 'Pluto', name: '冥王星', symbol: '♇', color: '#c9a4eb' },
];
export const ORRERY_BODIES = [
  {
    id: 'Mercury',
    name: '水星',
    symbol: '☿',
    color: '#a2d0d9',
    orbit: 0.387,
    size: 3.2,
  },
  {
    id: 'Venus',
    name: '金星',
    symbol: '♀',
    color: '#efb8d3',
    orbit: 0.723,
    size: 4.6,
  },
  {
    id: 'Earth',
    name: '地球',
    symbol: '⊕',
    color: '#6fb7ef',
    orbit: 1,
    size: 4.8,
  },
  {
    id: 'Moon',
    name: '月',
    symbol: '☽',
    color: '#e8efff',
    orbit: 0.00257,
    size: 2.2,
    parent: 'Earth',
  },
  {
    id: 'Mars',
    name: '火星',
    symbol: '♂',
    color: '#ff9079',
    orbit: 1.524,
    size: 3.8,
  },
  {
    id: 'Jupiter',
    name: '木星',
    symbol: '♃',
    color: '#eac28f',
    orbit: 5.203,
    size: 8.6,
  },
  {
    id: 'Saturn',
    name: '土星',
    symbol: '♄',
    color: '#d7d395',
    orbit: 9.537,
    size: 7.4,
  },
  {
    id: 'Uranus',
    name: '天王星',
    symbol: '♅',
    color: '#8ff3e4',
    orbit: 19.191,
    size: 6.2,
  },
  {
    id: 'Neptune',
    name: '海王星',
    symbol: '♆',
    color: '#648dff',
    orbit: 30.069,
    size: 6.1,
  },
  {
    id: 'Pluto',
    name: '冥王星',
    symbol: '♇',
    color: '#c9a4eb',
    orbit: 39.482,
    size: 2.8,
  },
];
export const ASPECTS = [
  { angle: 0, name: '合', symbol: '☌', color: '#ecd0fa' },
  { angle: 60, name: 'セクスタイル', symbol: '⚹', color: '#76e1c4' },
  { angle: 90, name: 'スクエア', symbol: '□', color: '#ff917e' },
  { angle: 120, name: 'トライン', symbol: '△', color: '#83bfff' },
  { angle: 180, name: 'オポジション', symbol: '☍', color: '#eba8c2' },
];
export const wrap = (n) => ((n % 360) + 360) % 360;
export const delta = (a, b) => wrap(a - b + 180) - 180;
export const clampTime = (t) => Math.max(MIN_TIME, Math.min(MAX_TIME, t));
export function validTime(t) {
  return (
    typeof t === 'number' &&
    Number.isFinite(t) &&
    t >= MIN_TIME &&
    t <= MAX_TIME
  );
}
export function localInput(t, offset) {
  return new Date(t + offset * 60000).toISOString().slice(0, 19);
}
export function parseInput(s, offset) {
  if (
    typeof s !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(s) ||
    !Number.isFinite(offset) ||
    offset < -720 ||
    offset > 840
  )
    throw Error('日時とUTC差を確認してください。');
  const normalized = s.length === 16 ? s + ':00' : s;
  const wall = Date.parse(normalized + 'Z');
  const t = wall - offset * 60000;
  if (
    !Number.isFinite(wall) ||
    new Date(wall).toISOString().slice(0, 19) !== normalized ||
    !validTime(t)
  )
    throw Error('1800年〜2200年の有効な日時を入力してください。');
  return t;
}
export function position(id, time) {
  const e = Astronomy.Ecliptic(Astronomy.GeoVector(id, new Date(time), true));
  return {
    lon: wrap(e.elon),
    lat: e.elat,
    distance: Math.hypot(e.vec.x, e.vec.y, e.vec.z),
  };
}
export function solarSystem(time) {
  if (!validTime(time)) throw Error('計算日時が範囲外です。');
  return ORRERY_BODIES.map((body) => {
    const ecliptic = Astronomy.Ecliptic(
      Astronomy.HelioVector(body.id, new Date(time)),
    );
    const lon = wrap(ecliptic.elon);
    const lat = ecliptic.elat;
    const distance = Math.hypot(ecliptic.vec.x, ecliptic.vec.y, ecliptic.vec.z);
    const radial = Math.cos(lat * DEG) * distance;
    const result = {
      ...body,
      lon,
      lat,
      distance,
      x: Math.cos(lon * DEG) * radial,
      y: Math.sin(lat * DEG) * distance,
      z: -Math.sin(lon * DEG) * radial,
    };
    if (body.id !== 'Moon') return result;

    const moonVector = (sampleTime) => {
      const moon = Astronomy.Ecliptic(
        Astronomy.GeoVector('Moon', new Date(sampleTime), false),
      );
      const moonDistance = Math.hypot(moon.vec.x, moon.vec.y, moon.vec.z);
      const moonRadial = Math.cos(moon.elat * DEG) * moonDistance;
      return [
        Math.cos(moon.elon * DEG) * moonRadial,
        Math.sin(moon.elat * DEG) * moonDistance,
        -Math.sin(moon.elon * DEG) * moonRadial,
      ];
    };
    const before = moonVector(time - DAY * 5);
    const after = moonVector(time + DAY * 5);
    const normal = [
      before[1] * after[2] - before[2] * after[1],
      before[2] * after[0] - before[0] * after[2],
      before[0] * after[1] - before[1] * after[0],
    ];
    const normalLength = Math.hypot(...normal);
    return {
      ...result,
      parentDistance: Math.hypot(...moonVector(time)),
      orbitNormal: normal.map((value) => value / normalLength),
    };
  });
}
export function aspectsOf(bodies, orb = 6) {
  const list = [];
  for (let i = 0; i < bodies.length; i++)
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i];
      const b = bodies[j];
      const sep = Math.abs(delta(a.lon, b.lon));
      const aspect = ASPECTS.find((v) => Math.abs(sep - v.angle) <= orb);
      if (aspect) {
        const actual =
          Math.acos(
            Math.max(
              -1,
              Math.min(
                1,
                Math.sin(a.lat * DEG) * Math.sin(b.lat * DEG) +
                  Math.cos(a.lat * DEG) *
                    Math.cos(b.lat * DEG) *
                    Math.cos((a.lon - b.lon) * DEG),
              ),
            ),
          ) / DEG;
        list.push({
          ...aspect,
          a: a.id,
          b: b.id,
          orb: Math.abs(sep - aspect.angle),
          separation: sep,
          skyAngle: actual,
        });
      }
    }
  return list.sort((a, b) => a.orb - b.orb);
}
export function frame(time, latitude, longitude) {
  const astroTime = Astronomy.MakeTime(new Date(time));
  const rotation = Astronomy.CombineRotation(
    Astronomy.Rotation_EQD_EQJ(astroTime),
    Astronomy.Rotation_EQJ_ECT(astroTime),
  );
  const theta =
    wrap(Astronomy.SiderealTime(new Date(time)) * 15 + longitude) * DEG;
  const phi = latitude * DEG;
  const rot = ([x, y, z]) => {
    const v = Astronomy.RotateVector(
      rotation,
      new Astronomy.Vector(x, y, z, astroTime),
    );
    return [v.x, v.y, v.z];
  };
  const pole = rot([0, 0, 1]);
  const eps = Math.atan2(pole[1], pole[2]);
  const zenith = rot([
    Math.cos(phi) * Math.cos(theta),
    Math.cos(phi) * Math.sin(theta),
    Math.sin(phi),
  ]);
  const east = rot([-Math.sin(theta), Math.cos(theta), 0]);
  const north = rot([
    -Math.sin(phi) * Math.cos(theta),
    -Math.sin(phi) * Math.sin(theta),
    Math.cos(phi),
  ]);
  let asc = wrap(Math.atan2(-zenith[0], zenith[1]) / DEG);
  if (Math.cos(asc * DEG) * east[0] + Math.sin(asc * DEG) * east[1] < 0)
    asc = wrap(asc + 180);
  const mc = wrap(
    Math.atan2(Math.sin(theta), Math.cos(theta) * Math.cos(eps)) / DEG,
  );
  const observer = Astronomy.RotateVector(
    Astronomy.Rotation_EQJ_ECT(astroTime),
    Astronomy.ObserverVector(
      astroTime,
      new Astronomy.Observer(latitude, longitude, 0),
      false,
    ),
  );
  return {
    asc,
    mc,
    zenith,
    east,
    north,
    observerVector: [observer.x, observer.y, observer.z],
    eps: eps / DEG,
    lst: wrap(theta / DEG),
  };
}
export function calculate(
  time,
  latitude = 35.6812,
  longitude = 139.7671,
  orb = 6,
) {
  if (
    !validTime(time) ||
    !Number.isFinite(latitude) ||
    Math.abs(latitude) > 89 ||
    !Number.isFinite(longitude) ||
    Math.abs(longitude) > 180 ||
    !Number.isFinite(orb) ||
    orb < 0 ||
    orb > 10
  )
    throw Error('計算条件が範囲外です。');
  const bodies = BODIES.map((b) => {
    const p = position(b.id, time);
    const before = position(b.id, time - DAY / 2);
    const after = position(b.id, time + DAY / 2);
    return { ...b, ...p, speed: delta(after.lon, before.lon) };
  });
  return {
    bodies,
    aspects: aspectsOf(bodies, orb),
    ...frame(time, latitude, longitude),
  };
}
export function signPosition(lon) {
  const total = Math.floor(wrap(lon) * 60);
  return (
    SIGNS[Math.floor(total / 1800)] +
    ' ' +
    String(Math.floor(total / 60) % 30).padStart(2, '0') +
    '°' +
    String(total % 60).padStart(2, '0') +
    '′'
  );
}
export function validateSaved(x) {
  if (
    !x ||
    x.version !== 1 ||
    !validTime(x.time) ||
    !Number.isFinite(x.latitude) ||
    Math.abs(x.latitude) > 89 ||
    !Number.isFinite(x.longitude) ||
    Math.abs(x.longitude) > 180 ||
    !Number.isFinite(x.offset) ||
    x.offset < -720 ||
    x.offset > 840
  )
    return null;
  return {
    time: x.time,
    latitude: x.latitude,
    longitude: x.longitude,
    offset: x.offset,
  };
}
