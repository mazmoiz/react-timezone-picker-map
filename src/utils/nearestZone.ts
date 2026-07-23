import { CANONICAL_TIME_ZONES, ZONE_COORDINATES } from '../data/zoneCoordinates';
import type { IanaTimeZoneName } from '../types';
import type { GeoPoint } from './geometry';

const EARTH_RADIUS_KM = 6371;

// Used to prefer a zone's true canonical entry over its rule-aliases (which share its
// exact coordinate, see zoneCoordinates.ts) when a tie-break is needed below.
const CANONICAL_ZONE_SET = new Set<string>(CANONICAL_TIME_ZONES);

/** Standard great-circle (haversine) distance between two lat/lon points, in km. */
export function haversineDistanceKm(a: GeoPoint, b: GeoPoint): number {
  const toRadians = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Given a list of zone names (typically an already-resolved offset bucket's
 * `timeZones`) and a geographic point, returns whichever zone's reference coordinate
 * (see src/data/zoneCoordinates.ts) is closest to that point — or `null` if none of
 * the candidates have a known coordinate (e.g. an empty list, or a list containing
 * only 'UTC').
 *
 * Note: a zone that's a pure rule-alias of another (e.g. Europe/Oslo -> Europe/Berlin,
 * sharing identical DST history) inherits its target's coordinate, since IANA's public
 * data doesn't track a separate one for it — see zoneCoordinates.ts's header comment.
 * When that produces an exact distance tie between an alias and its canonical target
 * (or between several aliases of the same target), the canonical zone wins — see the
 * tie-break below — so e.g. hovering the UK/Ireland offset resolves to Europe/London
 * rather than arbitrarily to Europe/Guernsey.
 */
export function findNearestZone(
  zones: readonly IanaTimeZoneName[],
  point: GeoPoint,
): IanaTimeZoneName | null {
  let nearestZone: IanaTimeZoneName | null = null;
  let smallestDistance = Infinity;

  for (const zone of zones) {
    const coordinate = ZONE_COORDINATES[zone];
    if (!coordinate) continue;
    const distance = haversineDistanceKm(point, coordinate);

    const isStrictlyCloser = distance < smallestDistance;
    // Exact tie: prefer the canonical zone over an alias sharing its coordinate,
    // regardless of iteration/alphabetical order. (If neither tied zone is canonical —
    // currently unreachable, since no two canonical zones share a coordinate today —
    // this is a no-op and first-in-order silently wins, same as before.)
    const isCanonicalTieBreak =
      distance === smallestDistance &&
      nearestZone !== null &&
      CANONICAL_ZONE_SET.has(zone) &&
      !CANONICAL_ZONE_SET.has(nearestZone);

    if (isStrictlyCloser || isCanonicalTieBreak) {
      smallestDistance = distance;
      nearestZone = zone;
    }
  }

  return nearestZone;
}
