import { DEG } from './engine.mjs';
import { topocentricDirection } from './observer.mjs';

export const THEMES = [
  { value: 'light', label: 'ライト' },
  { value: 'dark', label: 'ダーク' },
  { value: 'sky', label: '現地の空' },
];
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const rgb = (hex) =>
  hex
    .slice(1)
    .match(/../g)
    .map((v) => parseInt(v, 16));
const mixColor = (a, b, t) =>
  '#' +
  rgb(a)
    .map((v, i) =>
      Math.round(v + (rgb(b)[i] - v) * t)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');

// Geometric altitude of the Sun's centre, at sea level, in the chart's true-of-date frame.
export function solarPosition(chart) {
  const sun = chart.bodies.find((b) => b.id === 'Sun');
  if (!sun) return { altitude: -90, direction: [0, -1, 0] };
  const p = topocentricDirection(sun, chart.observerVector);
  const lon = p.lon * DEG;
  const lat = p.lat * DEG;
  const v = [
    Math.cos(lat) * Math.cos(lon),
    Math.cos(lat) * Math.sin(lon),
    Math.sin(lat),
  ];
  const dot = (a) => a.reduce((sum, x, i) => sum + x * v[i], 0);
  const up = clamp(dot(chart.zenith), -1, 1);
  return {
    altitude: Math.asin(up) / DEG,
    direction: [dot(chart.east), up, -dot(chart.north)],
  };
}
// Twilight boundaries: https://aa.usno.navy.mil/faq/RST_defs
// Colours and star visibility are a clear-sky visual approximation, not photometry.
const stops = [
  [-18, '#060c12', '#111b2c', '#060c12'],
  [-12, '#101b35', '#303957', '#0b1421'],
  [-6, '#243e69', '#976875', '#152536'],
  [-1, '#648aac', '#eebc98', '#263d48'],
  [6, '#65a4d4', '#c8dde4', '#45606a'],
  [25, '#54a5df', '#bedcec', '#526c73'],
];
export function skyAppearance(altitude) {
  const h = Number.isFinite(altitude) ? clamp(altitude, -90, 90) : -90;
  let i = stops.findIndex((s) => s[0] >= h);
  if (i < 0) i = stops.length - 1;
  const a = stops[Math.max(0, i - 1)];
  const b = stops[i];
  const t = a === b ? 0 : smooth(a[0], b[0], h);
  return {
    altitude: h,
    zenith: mixColor(a[1], b[1], t),
    horizon: mixColor(a[2], b[2], t),
    ground: mixColor(a[3], b[3], t),
    stars: 1 - smooth(-18, -2, h),
    light: h >= -1,
    glow: smooth(-16, -4, h) * (1 - smooth(0, 12, h)),
    phase:
      h >= -0.833
        ? '昼'
        : h >= -6
          ? '市民薄明'
          : h >= -12
            ? '航海薄明'
            : h >= -18
              ? '天文薄明'
              : '夜',
  };
}
export function themeAppearance(theme, chart) {
  const solar = solarPosition(chart);
  const sky = skyAppearance(solar.altitude);
  return {
    ...sky,
    direction: solar.direction,
    light: theme === 'light' || (theme === 'sky' && sky.light),
  };
}
const inkCache = new Map();
export function inkColor(color, light = false) {
  if (!light) return color;
  if (inkCache.has(color)) return inkCache.get(color);
  // Retain the hue while darkening pale astronomical markers on the light chart.
  const channels = rgb(color);
  const max = Math.max(...channels);
  const factor = Math.min(1, 105 / max);
  const result =
    '#' +
    channels
      .map((v) =>
        Math.round(v * factor)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('');
  inkCache.set(color, result);
  return result;
}

// Dedicated saturated inks for aspect lines; neutral marker darkening loses their differences.
const LIGHT_ASPECT_INKS = {
  '#ecd0fa': '#7b2cbf',
  '#76e1c4': '#00856a',
  '#ff917e': '#d63819',
  '#83bfff': '#1769c2',
  '#eba8c2': '#bd286b',
  '#aecf85': '#547c12',
  '#ddad73': '#ac5f00',
  '#bfacf1': '#5156b8',
  '#e3b596': '#9c4821',
  '#baa2d9': '#863d9b',
  '#b7d496': '#357b35',
  '#f4d08a': '#926400',
};
export function aspectInkColor(color, light = false) {
  return light ? (LIGHT_ASPECT_INKS[color] ?? inkColor(color, true)) : color;
}

// Saturated body inks for pale UI backgrounds; preserve each body's colour family.
const LIGHT_BODY_INKS = {
  '#ffd48a': '#a66100',
  '#e8efff': '#536ead',
  '#a2d0d9': '#007e96',
  '#efb8d3': '#bd3176',
  '#ff9079': '#ca321d',
  '#eac28f': '#a95416',
  '#d7d395': '#786b05',
  '#8ff3e4': '#008272',
  '#99b9ff': '#315ed1',
  '#c9a4eb': '#873ec2',
  '#c7dda0': '#527f19',
  '#91c9e3': '#1479a8',
  '#e0a7bf': '#b52b70',
  '#e5bd8a': '#a26405',
  '#aadacf': '#087f72',
  '#c2afe8': '#7350ba',
  '#e7a897': '#bd4829',
  '#bcbddf': '#6059ae',
  '#9ae0ce': '#008269',
  '#c7b5ed': '#8050c1',
  '#f4c184': '#a45a05',
  '#e8a9da': '#aa329b',
};
export function bodyInkColor(color, light = false) {
  return light ? (LIGHT_BODY_INKS[color] ?? inkColor(color, true)) : color;
}
