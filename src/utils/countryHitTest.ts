import { COUNTRY_BOUNDARIES, COUNTRY_TIME_ZONES } from '../data/countries';
import type { CountryBoundary } from '../data/countries';
import type { IanaTimeZoneName } from '../types';

/**
 * Returns whichever country's boundary contains the given point (in "core" viewBox
 * units — i.e. `viewBoxX - LEFT_GUTTER_WIDTH`, `viewBoxY`, matching the same
 * pre-gutter convention `src/utils/geometry.ts`'s `invertPoint` uses), or `null` if
 * the point isn't inside any country (e.g. open ocean).
 *
 * A cheap bounding-box check rejects the vast majority of the ~174 candidates before
 * the exact point-in-polygon test runs, so this is safe to call on every pointermove.
 */
export function findCountryAtPoint(coreX: number, coreY: number): CountryBoundary | null {
  for (const country of COUNTRY_BOUNDARIES) {
    const [minX, minY, maxX, maxY] = country.bbox;
    if (coreX < minX || coreX > maxX || coreY < minY || coreY > maxY) continue;
    if (pointInPolygons(coreX, coreY, country.polygons)) return country;
  }
  return null;
}

/**
 * Whether the given country is genuinely consistent with the offset bucket the
 * pointer resolved to — i.e. at least one of the country's own real IANA zones (see
 * src/data/countries.ts's COUNTRY_TIME_ZONES, derived from IANA's zone1970.tab) is
 * among the zones in that bucket.
 *
 * This exists because a country's real geographic position and its administrative
 * UTC offset can diverge (e.g. Spain sits closer to the UTC+0 band than its actual
 * UTC+1) — without this check, hovering such a country could report/highlight it
 * alongside a resolved offset that isn't actually its own, which would read as
 * contradictory or broken. Countries with no known IANA zone (e.g. a few disputed
 * territories absent from COUNTRY_TIME_ZONES) never pass this check.
 */
export function countryMatchesTimeZones(
  country: CountryBoundary,
  bucketTimeZones: readonly IanaTimeZoneName[],
): boolean {
  const countryZones = COUNTRY_TIME_ZONES[country.id];
  if (!countryZones) return false;
  // COUNTRY_TIME_ZONES is generated from the same IANA source as IANA_TIME_ZONES, so
  // its entries are always valid IanaTimeZoneName values, just not typed as such
  // (Record<string, readonly string[]>) since that data file has no reason to depend
  // on src/types.ts.
  const bucketZoneSet = new Set<string>(bucketTimeZones);
  return countryZones.some((zone) => bucketZoneSet.has(zone));
}

// Standard even-odd ray-casting point-in-polygon test. A country's `polygons` is an
// array of disjoint polygons (more than one for multi-island territories, e.g.
// Indonesia/Japan/Philippines — any one containing the point is a match), and each
// polygon is itself an array of rings: the first is its outer boundary, any further
// ones are holes (e.g. Lesotho inside South Africa). Crossings from every ring of one
// polygon must be accumulated together — not tested ring-by-ring independently — for
// the even-odd rule to correctly subtract holes.
function pointInPolygons(
  x: number,
  y: number,
  polygons: readonly (readonly (readonly [number, number])[])[][],
): boolean {
  for (const rings of polygons) {
    let inside = false;
    for (const ring of rings) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
        if (intersects) inside = !inside;
      }
    }
    if (inside) return true;
  }
  return false;
}
