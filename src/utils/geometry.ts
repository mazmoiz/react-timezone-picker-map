import { UTC_OFFSET_MINUTES } from '../data/utcOffsets';

/**
 * Dimensions of the generated map art (see scripts/generate-world-map.mjs) — a clean
 * 2:1 canvas matching equirectangular's natural 360deg:180deg aspect ratio. Keep in
 * sync with the MAP_WIDTH/MAP_HEIGHT constants in that script.
 */
export const MAP_WIDTH = 1600;
export const MAP_HEIGHT = 800;

/**
 * The y-coordinate (within the core MAP_WIDTH x MAP_HEIGHT canvas) where latitude 0
 * falls. NOT MAP_HEIGHT / 2 — land isn't symmetric around the equator (more northern-
 * hemisphere landmass, Antarctica, etc.), so this can only be read off the actual
 * generation-time projection, not derived from MAP_WIDTH/MAP_HEIGHT. Verified/generated
 * by scripts/generate-world-map.mjs (`projection.translate()[1]`) — keep in sync.
 */
export const EQUATOR_Y = 385.8780666666667;

/**
 * Degrees of longitude (or, equivalently, latitude — verified empirically that both
 * axes share this exact scale) per pixel of the core map canvas.
 */
export const DEGREES_PER_PIXEL = 360 / MAP_WIDTH;

const PX_PER_HOUR = MAP_WIDTH / 24;
const CORE_MIN_MINUTES = -720;
const CORE_MAX_MINUTES = 720;

const observedMinMinutes = Math.min(...UTC_OFFSET_MINUTES);
const observedMaxMinutes = Math.max(...UTC_OFFSET_MINUTES);

/**
 * Extra water-only width added on each side to host canonical offsets that fall
 * outside the original longitude-accurate -12h..+12h span (e.g. +12:45/+13/+14).
 * Zero today on the left since no real IANA zone currently sits below -12h.
 */
export const LEFT_GUTTER_WIDTH =
  Math.max(0, (CORE_MIN_MINUTES - observedMinMinutes) / 60) * PX_PER_HOUR;
export const RIGHT_GUTTER_WIDTH =
  Math.max(0, (observedMaxMinutes - CORE_MAX_MINUTES) / 60) * PX_PER_HOUR;

/** Total rendered viewBox width: left gutter + the original map width + right gutter. */
export const TOTAL_WIDTH = LEFT_GUTTER_WIDTH + MAP_WIDTH + RIGHT_GUTTER_WIDTH;

/** x-position (in viewBox units) of the vertical line for a given UTC offset. */
export function offsetMinutesToX(offsetMinutes: number): number {
  return (
    LEFT_GUTTER_WIDTH +
    ((offsetMinutes - CORE_MIN_MINUTES) / (CORE_MAX_MINUTES - CORE_MIN_MINUTES)) * MAP_WIDTH
  );
}

/**
 * Given an x-coordinate already normalized into viewBox units, returns whichever
 * offset in `candidateOffsets` has the closest line. This is the primitive behind
 * "nearest-line-wins" pointer interaction (see TimeZoneLines.tsx) — precision scales
 * with rendered pixel size instead of requiring a precise hit on a fixed band.
 *
 * `candidateOffsets` defaults to every canonical offset (today's behavior), but
 * callers that hide some lines (e.g. `showEmptyTimeZoneLines={false}`) should pass
 * only the currently-visible offsets, so a click near a hidden line snaps to the
 * nearest *visible* one instead of resolving to a bucket with nothing rendered.
 */
export function resolveNearestOffset(
  x: number,
  candidateOffsets: readonly number[] = UTC_OFFSET_MINUTES,
): number {
  let nearestOffset = candidateOffsets[0] ?? NaN;
  let smallestDistance = Infinity;
  for (const offset of candidateOffsets) {
    const distance = Math.abs(offsetMinutesToX(offset) - x);
    if (distance < smallestDistance) {
      smallestDistance = distance;
      nearestOffset = offset;
    }
  }
  return nearestOffset;
}

export interface ViewBoxPoint {
  x: number;
  y: number;
}

/**
 * Converts a pointer event's client coordinates into viewBox units, given the bounding
 * rect of an SVG element whose own geometry spans the full viewBox (e.g. the full-bleed
 * overlay `<rect>` in TimeZoneLines.tsx). Note this deliberately does NOT need any
 * `preserveAspectRatio` letterbox-margin correction: an SVG child element positioned
 * in viewBox units already reports its *content-only* box from `getBoundingClientRect`
 * — the browser's own viewBox-to-viewport transform excludes the letterbox margins,
 * verified empirically (see PR discussion) rather than assumed.
 */
export function clientPointToViewBoxPoint(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): ViewBoxPoint {
  if (rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
  return {
    x: ((clientX - rect.left) / rect.width) * TOTAL_WIDTH,
    y: ((clientY - rect.top) / rect.height) * MAP_HEIGHT,
  };
}

export interface GeoPoint {
  lon: number;
  lat: number;
}

/**
 * Converts a point in viewBox units back into real (longitude, latitude), the inverse
 * of the map's equirectangular projection. Used to find which zone is geographically
 * closest to a hover/click position (see src/utils/nearestZone.ts) — verified
 * empirically against the actual generation-time projection (see
 * scripts/generate-world-map.mjs), not assumed.
 */
export function invertPoint(viewBoxX: number, viewBoxY: number): GeoPoint {
  const coreX = viewBoxX - LEFT_GUTTER_WIDTH;
  return {
    lon: (coreX - MAP_WIDTH / 2) * DEGREES_PER_PIXEL,
    lat: (EQUATOR_Y - viewBoxY) * DEGREES_PER_PIXEL,
  };
}
