import { ZONE_COORDINATES } from '../data/zoneCoordinates';
import type { IanaTimeZoneName } from '../types';
import type { GeoPoint } from './geometry';

const EARTH_RADIUS_KM = 6371;

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
    if (distance < smallestDistance) {
      smallestDistance = distance;
      nearestZone = zone;
    }
  }

  return nearestZone;
}
