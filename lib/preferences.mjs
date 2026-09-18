import { ALL_ASPECTS, PATTERNS, defaultAspectSettings } from './aspects.mjs';
import { ASTEROIDS } from './asteroids.mjs';
import { HOUSE_SYSTEMS } from './houses.mjs';
import { THEMES } from './theme.mjs';
export const PREFERENCES_STORAGE = 'celestial.preferences.v1';
export function defaultPreferences() {
  return {
    version: 1,
    dimBack: false,
    locale: 'ja',
    theme: 'dark',
    speed: 1,
    direction: 1,
    span: 30,
    houseSystem: 'equal',
    lilithType: 'true',
    orb: 6,
    pointIds: ['NorthNode', 'SouthNode', 'Vertex', 'TrueLilith'],
    asteroids: [],
    patternTypes: PATTERNS.map((p) => p.id),
    aspectSettings: defaultAspectSettings(),
    showAspects: true,
    grid: true,
    gridMode: 'grid',
    horizon: true,
    houses: false,
    houses2d: true,
    smoothPlayback: true,
    showBelowHorizon: true,
    nodeOrbit: true,
    primeVertical: true,
    trails: false,
    major: true,
    minor: false,
    compound: false,
    includePoints: true,
  };
}
// Allowlisted restoration: reject unknown schemas and replace invalid fields with defaults.
export function validatePreferences(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    value.version !== 1
  )
    return null;
  const out = defaultPreferences();
  for (const key of [
    'dimBack',
    'showAspects',
    'grid',
    'horizon',
    'houses',
    'houses2d',
    'smoothPlayback',
    'showBelowHorizon',
    'nodeOrbit',
    'primeVertical',
    'trails',
    'major',
    'minor',
    'compound',
    'includePoints',
  ])
    if (typeof value[key] === 'boolean') out[key] = value[key];
  const choices = {
    gridMode: ['grid', 'houses', 'off'],
    locale: ['ja', 'en'],
    theme: THEMES.map((t) => t.value),
    speed: [1 / 24, 1, 7, 30, 365],
    direction: [1, -1],
    span: [1, 30, 365, 3650],
    houseSystem: HOUSE_SYSTEMS.map((h) => h.value),
    lilithType: ['true', 'mean'],
  };
  for (const [key, allowed] of Object.entries(choices))
    if (allowed.includes(value[key])) out[key] = value[key];
  if (Number.isFinite(value.orb) && value.orb >= 0 && value.orb <= 10)
    out.orb = value.orb;
  const lists = {
    pointIds: out.pointIds,
    asteroids: ASTEROIDS.map((a) => a.id),
    patternTypes: PATTERNS.map((p) => p.id),
  };
  for (const [key, allowed] of Object.entries(lists))
    if (Array.isArray(value[key]))
      out[key] = [...new Set(value[key].filter((v) => allowed.includes(v)))];
  for (const a of ALL_ASPECTS) {
    const v = value.aspectSettings?.[a.angle];
    if (!v || typeof v !== 'object') continue;
    if (typeof v.enabled === 'boolean')
      out.aspectSettings[a.angle].enabled = v.enabled;
    if (Number.isFinite(v.orb) && v.orb >= 0 && v.orb <= 10)
      out.aspectSettings[a.angle].orb = v.orb;
  }
  // Migrate previously independent node visibility into one paired setting.
  const nodesVisible =
    out.pointIds.includes('NorthNode') || out.pointIds.includes('SouthNode');
  out.pointIds = out.pointIds.filter(
    (id) => id !== 'NorthNode' && id !== 'SouthNode',
  );
  if (nodesVisible) out.pointIds.unshift('NorthNode', 'SouthNode');
  if (!['grid', 'houses', 'off'].includes(value.gridMode))
    out.gridMode = out.grid ? 'grid' : 'off';
  return out;
}
