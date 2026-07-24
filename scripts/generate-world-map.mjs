// Regenerates src/components/TimeZonePickerMap/Continents.tsx from real geographic
// data (Natural Earth land boundaries, public domain, via the `world-atlas` npm
// package). Run manually via `npm run generate:worldmap` and review the diff — this
// is NOT run automatically as part of `build`/CI, same rationale as
// generate-timezones.mjs.
//
// Why: the previous continent art was traced from an AI-generated image and was not
// a true equirectangular projection, so the timezone lines (which assume longitude
// maps linearly to x) didn't align with it. This script derives the map directly from
// real lon/lat data with an actual `d3.geoEquirectangular()` projection, so alignment
// is guaranteed by construction instead of approximated.
import { readFileSync, writeFileSync } from 'node:fs';
import { geoEquirectangular, geoPath, geoStream } from 'd3-geo';
import { feature } from 'topojson-client';
import worldCountries from 'world-countries';

const MAP_WIDTH = 1600;
const MAP_HEIGHT = 800;

const landTopology = JSON.parse(
  readFileSync(new URL('../node_modules/world-atlas/land-110m.json', import.meta.url)),
);
const landFeature = feature(landTopology, landTopology.objects.land);

const projection = geoEquirectangular().fitSize([MAP_WIDTH, MAP_HEIGHT], landFeature);
const path = geoPath(projection);
const d = path(landFeature);

// Provable alignment check: our line-position formula (offsetMinutesToX, defined in
// src/utils/geometry.ts) assumes x = ((lon + 180) / 360) * MAP_WIDTH within the core
// -180..180 range. Confirm that matches this exact projection for several longitudes
// before writing anything, so a future MAP_WIDTH/MAP_HEIGHT change here can't silently
// desync from geometry.ts without this script failing loudly.
function offsetMinutesToXCore(offsetMinutes) {
  return ((offsetMinutes + 720) / 1440) * MAP_WIDTH;
}
const testLongitudes = [-180, -74, 0, 77.2, 139.7, 180];
for (const lon of testLongitudes) {
  const [expectedX] = projection([lon, 0]);
  const actualX = offsetMinutesToXCore(lon * 4);
  if (Math.abs(expectedX - actualX) > 0.01) {
    throw new Error(
      `Alignment check failed for lon=${lon}: projection gives x=${expectedX}, ` +
        `offsetMinutesToX formula gives x=${actualX}. Did MAP_WIDTH change without ` +
        `updating this script (or vice versa)?`,
    );
  }
}
console.log(`Alignment check passed for longitudes: ${testLongitudes.join(', ')}`);

// The inverse projection (pixel -> lon/lat, used for precise hover/click zone lookup,
// see src/utils/geometry.ts `invertPoint`) relies on both axes sharing one linear
// degrees-per-pixel scale, and on EQUATOR_Y (below) being the y where latitude 0 falls.
// Confirm both empirically rather than assuming — verified linear across all samples.
const DEGREES_PER_PIXEL = 360 / MAP_WIDTH;
const EQUATOR_Y = projection.translate()[1];
const testLatSamples = [100, 300, 500, 700];
let prevY = null;
let prevLat = null;
for (const y of testLatSamples) {
  const [, lat] = projection.invert([MAP_WIDTH / 2, y]);
  const expectedLat = (EQUATOR_Y - y) * DEGREES_PER_PIXEL;
  if (Math.abs(lat - expectedLat) > 0.01) {
    throw new Error(
      `Latitude inversion check failed at y=${y}: projection gives lat=${lat}, ` +
        `formula gives lat=${expectedLat}.`,
    );
  }
  if (prevY !== null) {
    const slope = (lat - prevLat) / (y - prevY);
    if (Math.abs(slope + DEGREES_PER_PIXEL) > 1e-6) {
      throw new Error(
        `Latitude-vs-y slope (${slope}) no longer matches -DEGREES_PER_PIXEL ` +
          `(${-DEGREES_PER_PIXEL}) — the map projection may no longer be purely linear.`,
      );
    }
  }
  prevY = y;
  prevLat = lat;
}
console.log(
  `Latitude inversion check passed (EQUATOR_Y=${EQUATOR_Y}, DEGREES_PER_PIXEL=${DEGREES_PER_PIXEL}).`,
);

const component = `import type { CSSProperties } from 'react';

export interface ContinentsProps {
  fill: string;
}

const style: CSSProperties = { pointerEvents: 'none' };

/**
 * Real-world land boundaries (Natural Earth, public domain, via the \`world-atlas\`
 * npm package), projected with an actual d3 equirectangular projection fit to
 * MAP_WIDTH x MAP_HEIGHT (see scripts/generate-world-map.mjs) — this guarantees the
 * timezone lines in geometry.ts (which assume longitude maps linearly to x) line up
 * correctly, unlike the original AI-traced artwork this replaced.
 */
export function Continents({ fill }: ContinentsProps) {
  return (
    <g fill={fill} style={style} aria-hidden="true">
      <path d="${d}" />
    </g>
  );
}
`;

const continentsFile = new URL(
  '../src/components/TimeZonePickerMap/Continents.tsx',
  import.meta.url,
);
writeFileSync(continentsFile, component);
console.log(`Wrote Continents.tsx (${d.length} chars of path data)`);
console.log(
  `MAP_WIDTH/MAP_HEIGHT used: ${MAP_WIDTH}x${MAP_HEIGHT}; EQUATOR_Y=${EQUATOR_Y} — ` +
    `keep src/utils/geometry.ts in sync.`,
);

// Kept in sync with scripts/generate-timezones.mjs's own copy of this table — see
// that script for why legacy/modern aliasing is needed at all.
const LEGACY_TO_MODERN = {
  'Asia/Calcutta': 'Asia/Kolkata',
  'Asia/Katmandu': 'Asia/Kathmandu',
  'Asia/Rangoon': 'Asia/Yangon',
  'Asia/Saigon': 'Asia/Ho_Chi_Minh',
  'America/Godthab': 'America/Nuuk',
  'Europe/Kiev': 'Europe/Kyiv',
};

// Each canonical zone's reference lat/lon, from IANA's zone1970.tab (public domain),
// used for precise hover/click zone lookup within an already-resolved offset bucket
// (see src/utils/nearestZone.ts). Regenerated alongside the map since both come from
// real-world geographic data.
async function fetchTzdataFile(name) {
  const response = await fetch(`https://data.iana.org/time-zones/data/${name}`);
  if (!response.ok) throw new Error(`Failed to fetch ${name}: HTTP ${response.status}`);
  return response.text();
}

const zone1970Text = await fetchTzdataFile('zone1970.tab');
// zone1970.tab only lists ~312 "canonical" zones (one per distinct rule set) — many of
// our 419 Intl-recognized zone names (e.g. Europe/Oslo, America/Buenos_Aires) are
// aliases ("Link" directives) for one of those, sharing identical rules/coordinates.
// tzdata.zi (same public-domain source) is the consolidated file listing every such
// alias, as lines `L <target> <alias>` — used below to resolve aliases to a coordinate.
const tzdataZiText = await fetchTzdataFile('tzdata.zi');
const aliasToTarget = {};
for (const line of tzdataZiText.split('\n')) {
  if (!line.startsWith('L')) continue;
  const [, target, alias] = line.trim().split(/\s+/);
  if (target && alias) aliasToTarget[alias] = target;
}

function parseIso6709Part(token, degreeDigits) {
  const sign = token[0] === '-' ? -1 : 1;
  const digits = token.slice(1);
  const degrees = Number(digits.slice(0, degreeDigits));
  const minutes = Number(digits.slice(degreeDigits, degreeDigits + 2));
  const seconds = digits.length > degreeDigits + 2 ? Number(digits.slice(degreeDigits + 2)) : 0;
  return sign * (degrees + minutes / 60 + seconds / 3600);
}

function parseCoordinate(coord) {
  // Either `±DDMM±DDDMM` (11 chars) or `±DDMMSS±DDDMMSS` (15 chars) — latitude first.
  const latLength = coord.length === 15 ? 7 : 5;
  const lat = parseIso6709Part(coord.slice(0, latLength), 2);
  const lon = parseIso6709Part(coord.slice(latLength), 3);
  return { lat, lon };
}

// Recomputed the same way scripts/generate-timezones.mjs does, just for the
// "which of our zones got no coordinate" report below — kept self-contained rather
// than depending on that script having already run / re-parsing its output file.
const zones = Array.from(
  new Set(Intl.supportedValuesOf('timeZone').map((tz) => LEGACY_TO_MODERN[tz] ?? tz)),
)
  .concat('UTC')
  .sort();

const canonicalCoordinates = {};
// zone1970.tab's first column: comma-separated ISO 3166-1 alpha-2 country codes that
// use that row's canonical zone (e.g. many small West/Central African countries share
// Africa/Lagos's rules). Used below (with COUNTRY_TIME_ZONES) to check whether a
// hovered country's own zone(s) match the currently-resolved offset bucket.
const zoneCountryCodes = {};
let skippedLines = 0;
for (const line of zone1970Text.split('\n')) {
  if (!line || line.startsWith('#')) continue;
  const [countryCodes, coord, rawZoneName] = line.split('\t');
  if (!coord || !rawZoneName) {
    skippedLines++;
    continue;
  }
  const zoneName = LEGACY_TO_MODERN[rawZoneName] ?? rawZoneName;
  canonicalCoordinates[zoneName] = parseCoordinate(coord);
  if (countryCodes) zoneCountryCodes[zoneName] = countryCodes.split(',');
}

// Resolve a zone to a coordinate: direct zone1970.tab entry, or (transitively, in case
// of a chain) whatever canonical zone its Link target ultimately points to.
function resolveCoordinate(zone, depth = 0) {
  if (zone in canonicalCoordinates) return canonicalCoordinates[zone];
  if (depth > 5) return null; // guards against an unexpected alias cycle
  const target = aliasToTarget[zone];
  return target ? resolveCoordinate(target, depth + 1) : null;
}

const zoneCoordinates = {};
const canonicalZones = [];
for (const zone of zones) {
  const coordinate = resolveCoordinate(zone);
  if (coordinate) zoneCoordinates[zone] = coordinate;
  if (zone in canonicalCoordinates) canonicalZones.push(zone);
}

const unresolvedZones = zones.filter((zone) => !(zone in zoneCoordinates));
console.log(
  `Resolved coordinates for ${Object.keys(zoneCoordinates).length} of ${zones.length} zones ` +
    `(${Object.keys(canonicalCoordinates).length} direct from zone1970.tab, ` +
    `${skippedLines} unparseable zone1970.tab lines skipped).`,
);
if (unresolvedZones.length > 0) {
  console.log(
    `${unresolvedZones.length} zone(s) have no coordinate at all (expected for ` +
      `non-geographic entries like 'UTC'): ${unresolvedZones.join(', ')}`,
  );
}

const zoneCoordinatesFile = new URL('../src/data/zoneCoordinates.ts', import.meta.url);
writeFileSync(
  zoneCoordinatesFile,
  `// AUTO-GENERATED by scripts/generate-world-map.mjs — do not hand-edit.\n` +
    `// Regenerate with \`npm run generate:worldmap\` and review the diff.\n` +
    `// Source: IANA's zone1970.tab + tzdata.zi (public domain), https://data.iana.org/time-zones/data/\n` +
    `// Aliases (e.g. Europe/Oslo) are resolved to their canonical zone's coordinate.\n\n` +
    `export const ZONE_COORDINATES: Record<string, { lat: number; lon: number }> = {\n${Object.entries(
      zoneCoordinates,
    )
      .map(([zone, { lat, lon }]) => `  '${zone}': { lat: ${lat}, lon: ${lon} },`)
      .join('\n')}\n};\n\n` +
    `// Zones with their own direct zone1970.tab entry (i.e. not a pure alias of\n` +
    `// another zone via a tzdata.zi Link line). Aliases inherit their target's exact\n` +
    `// coordinate (see ZONE_COORDINATES above), so when several zones tie on\n` +
    `// haversine distance, at most one of them can appear here — used by\n` +
    `// src/utils/nearestZone.ts to prefer the real canonical zone (e.g. Europe/London)\n` +
    `// over its aliases (e.g. Europe/Guernsey) on an exact-distance tie.\n\n` +
    `export const CANONICAL_TIME_ZONES: readonly string[] = [\n${canonicalZones
      .map((zone) => `  '${zone}',`)
      .join('\n')}\n];\n`,
);
console.log(`Wrote src/data/zoneCoordinates.ts`);

// Country boundaries + country-zone membership, used for the "highlight the country
// under the cursor" feature (src/utils/countryHitTest.ts). Projected with the SAME
// `projection` instance used for Continents.tsx above — this is what keeps country
// borders pixel-aligned with the landmass and offset lines. Coordinates are in "core"
// pre-LEFT_GUTTER_WIDTH space, matching Continents.tsx's own path and geometry.ts's
// invertPoint()'s `coreX` convention.
const countriesTopology = JSON.parse(
  readFileSync(new URL('../node_modules/world-atlas/countries-110m.json', import.meta.url)),
);
const countriesFeatureCollection = feature(countriesTopology, countriesTopology.objects.countries);

// Projects a raw lon/lat GeoJSON Polygon/MultiPolygon geometry into core-space
// polygons, correctly split at the antimeridian (±180° longitude) — e.g. Russia and
// Fiji's territory crosses it. A naive per-point `projection([lon, lat])` map (no
// clipping) would instead draw one long, wrong straight edge connecting the far right
// of the map to the far left for any such ring. `projection.stream()` wraps our sink
// with the projection's own preclip/clip pipeline (the same mechanism `d3.geoPath`
// itself uses to render antimeridian-crossing shapes correctly) — feeding the raw
// geometry through it via `geoStream` gives already-projected, already-split rings.
function extractProjectedPolygons(geometry) {
  const polygons = [];
  let currentPolygon = null;
  let currentRing = null;
  const sink = {
    point(x, y) {
      currentRing.push([Math.round(x), Math.round(y)]);
    },
    lineStart() {
      currentRing = [];
    },
    lineEnd() {
      currentPolygon.push(currentRing);
      currentRing = null;
    },
    polygonStart() {
      currentPolygon = [];
    },
    polygonEnd() {
      polygons.push(currentPolygon);
      currentPolygon = null;
    },
    sphere() {},
  };
  geoStream(geometry, projection.stream(sink));
  return polygons;
}

// world-atlas only gives each country a numeric ISO 3166-1 id + Natural Earth name —
// no alpha-2 code, which is what zone1970.tab's country-code column uses. `world-countries`
// (devDependency, build-time only — never shipped at runtime) provides a reliable
// numeric (ccn3) <-> alpha-2 (cca2) crosswalk instead of hand-maintaining one.
const numericToAlpha2 = {};
for (const country of worldCountries) {
  if (country.ccn3 && country.cca2) numericToAlpha2[country.ccn3] = country.cca2;
}

// Invert zoneCountryCodes (canonical zone -> alpha-2 codes) to alpha-2 -> zone names.
const alpha2ToZones = {};
for (const [zoneName, codes] of Object.entries(zoneCountryCodes)) {
  for (const code of codes) {
    (alpha2ToZones[code] ??= []).push(zoneName);
  }
}

const countryBoundaries = [];
const countryTimeZones = {};
let skippedCountryFeatures = 0;
for (const f of countriesFeatureCollection.features) {
  // A handful of disputed/unrecognized territories (e.g. Kosovo, Somaliland, N.
  // Cyprus) have no `id` in world-atlas's data at all — no ISO code means no way to
  // resolve their zone membership, so they're excluded rather than included with
  // broken data (they'd never pass the membership check anyway).
  //
  // Antarctica ('010') is excluded deliberately, not for a data reason — it actually
  // DOES have real, functioning IANA zone membership (dedicated Antarctica/* research
  // station zones, plus a couple of pure aliases to supply-nation zones like
  // Pacific/Auckland/Asia/Riyadh — some stations just use their supply country's
  // official time). So it would highlight/report like any other country. It's
  // excluded because Antarctica has no permanent civilian population and isn't a
  // meaningful "pick your country" target for the vast majority of consumers of this
  // picker — Antarctica/* zones remain fully selectable via the map's offset lines as
  // normal; only this country-highlight feature ignores it.
  if (!f.id || !f.geometry || f.id === '010') {
    skippedCountryFeatures++;
    continue;
  }
  const polygons = extractProjectedPolygons(f.geometry);
  const allPoints = polygons.flat(2);
  const xs = allPoints.map((p) => p[0]);
  const ys = allPoints.map((p) => p[1]);
  countryBoundaries.push({
    id: String(f.id),
    name: f.properties.name,
    bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
    polygons,
  });

  const alpha2 = numericToAlpha2[String(f.id)];
  const zonesForCountry = alpha2 ? alpha2ToZones[alpha2] : undefined;
  if (zonesForCountry) countryTimeZones[String(f.id)] = zonesForCountry;
}

if (countryBoundaries.length < 150) {
  throw new Error(
    `Expected ~177 countries (minus a few unrecognized territories), got ` +
      `${countryBoundaries.length} — world-atlas's countries-110m.json shape changed?`,
  );
}
console.log(
  `Resolved ${countryBoundaries.length} country boundaries (${skippedCountryFeatures} ` +
    `skipped for missing id/geometry), ${Object.keys(countryTimeZones).length} with ` +
    `known IANA zone membership.`,
);

const countriesFile = new URL('../src/data/countries.ts', import.meta.url);
writeFileSync(
  countriesFile,
  `// AUTO-GENERATED by scripts/generate-world-map.mjs — do not hand-edit.\n` +
    `// Regenerate with \`npm run generate:worldmap\` and review the diff.\n` +
    `// Source: Natural Earth 110m admin-0 countries, via the \`world-atlas\` npm package\n` +
    `// (world-atlas/countries-110m.json), projected with the SAME\n` +
    `// d3.geoEquirectangular().fitSize(...) instance used for Continents.tsx above — this\n` +
    `// is what keeps country borders pixel-aligned with the landmass and offset lines.\n` +
    `// Coordinates are in "core" 1600x800 space (pre-LEFT_GUTTER_WIDTH), matching the\n` +
    `// space geometry.ts's invertPoint()'s \`coreX\` operates in.\n\n` +
    `export interface CountryBoundary {\n` +
    `  readonly id: string;\n` +
    `  readonly name: string;\n` +
    `  readonly bbox: readonly [number, number, number, number];\n` +
    `  readonly polygons: readonly (readonly (readonly [number, number])[])[][];\n` +
    `}\n\n` +
    `export const COUNTRY_BOUNDARIES: readonly CountryBoundary[] = [\n${countryBoundaries
      .map(
        (c) =>
          `  { id: '${c.id}', name: ${JSON.stringify(c.name)}, bbox: ${JSON.stringify(c.bbox)}, polygons: ${JSON.stringify(c.polygons)} },`,
      )
      .join('\n')}\n];\n\n` +
    `// Each country's real IANA zone(s) (by ISO 3166-1 numeric id, matching\n` +
    `// CountryBoundary.id above), derived from zone1970.tab's country-code column via a\n` +
    `// numeric<->alpha-2 crosswalk. Used by src/utils/countryHitTest.ts to only report a\n` +
    `// hovered country when it's consistent with the currently-resolved offset bucket —\n` +
    `// see the "Country-zone membership check" note in the project's implementation plan\n` +
    `// for why (e.g. Spain sits geographically closer to UTC+0 than its actual UTC+1, so\n` +
    `// this check keeps the highlight from ever contradicting the resolved offset).\n` +
    `// A country absent from this map (or absent entirely) has no known IANA zone and\n` +
    `// will never pass the membership check.\n\n` +
    `export const COUNTRY_TIME_ZONES: Record<string, readonly string[]> = {\n${Object.entries(
      countryTimeZones,
    )
      .map(([id, zoneNames]) => `  '${id}': ${JSON.stringify(zoneNames)},`)
      .join('\n')}\n};\n`,
);
console.log(`Wrote src/data/countries.ts`);
