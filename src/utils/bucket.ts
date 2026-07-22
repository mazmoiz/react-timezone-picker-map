import { STANDARD_OFFSET_MINUTES } from '../data/standardOffsets';
import { UTC_OFFSET_MINUTES } from '../data/utcOffsets';
import type { IanaTimeZoneName, TimeZoneSelection } from '../types';
import { offsetMinutesToX, resolveNearestOffset } from './geometry';

/** Formats a UTC offset in minutes as e.g. "UTC-12", "UTC+0", "UTC+5:30", "UTC+12:45". */
export function formatUtcOffsetLabel(offsetMinutes: number): string {
  const sign = offsetMinutes < 0 ? '-' : '+';
  const absMinutes = Math.abs(offsetMinutes);
  const hours = Math.floor(absMinutes / 60);
  const minutes = absMinutes % 60;
  return minutes === 0
    ? `UTC${sign}${hours}`
    : `UTC${sign}${hours}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Places every enabled IANA zone into the canonical UTC-offset bucket matching its
 * standard (non-DST) offset — not its currently-observed offset. This is deliberate:
 * the map's lines sit at fixed, true-longitude positions, and a zone's *current*
 * offset shifts by an hour during its own DST period, which would otherwise make a
 * zone (e.g. America/Los_Angeles in summer) appear under a line positioned at some
 * other zone's true longitude (e.g. Denver's). Bucketing by standard offset keeps
 * every zone at its real geographic position year-round.
 *
 * Returns one entry per canonical offset, always — a bucket with no matching enabled
 * zone still exists, just with an empty `timeZones` array, so the visual grid stays
 * stable regardless of `enabledZones`.
 */
export function buildTimeZoneBuckets(
  enabledZones: readonly IanaTimeZoneName[],
): TimeZoneSelection[] {
  const zonesByOffset = new Map<number, IanaTimeZoneName[]>();
  for (const offset of UTC_OFFSET_MINUTES) zonesByOffset.set(offset, []);

  for (const zone of enabledZones) {
    const standardOffset = STANDARD_OFFSET_MINUTES[zone];
    // Should be unreachable in practice (UTC_OFFSET_MINUTES is derived from these same
    // zones' standard offsets), but snap to the nearest canonical offset rather than
    // silently dropping the zone if a future tzdata change introduces a new offset.
    const canonicalOffset = zonesByOffset.has(standardOffset)
      ? standardOffset
      : resolveNearestOffset(offsetMinutesToX(standardOffset));
    zonesByOffset.get(canonicalOffset)?.push(zone);
  }

  return UTC_OFFSET_MINUTES.map((offsetMinutes) => ({
    offsetMinutes,
    label: formatUtcOffsetLabel(offsetMinutes),
    timeZones: zonesByOffset.get(offsetMinutes) ?? [],
    // Buckets have no cursor position to measure "nearest" from — TimeZoneLines
    // attaches the real value per-interaction before invoking onSelect/onHover.
    nearestTimeZone: null,
  }));
}
