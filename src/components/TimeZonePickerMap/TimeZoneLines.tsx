import { useCallback, useMemo, useState } from 'react';
import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react';
import type { TimeZoneSelection } from '../../types';
import {
  LEFT_GUTTER_WIDTH,
  MAP_HEIGHT,
  MAX_LINE_SNAP_DISTANCE,
  TOTAL_WIDTH,
  clientPointToViewBoxPoint,
  invertPoint,
  offsetMinutesToX,
  resolveNearestOffset,
} from '../../utils/geometry';
import { ZONE_COORDINATES } from '../../data/zoneCoordinates';
import type { CountryBoundary } from '../../data/countries';
import { findNearestZone, haversineDistanceKm } from '../../utils/nearestZone';
import { countryMatchesTimeZones, findCountryAtPoint } from '../../utils/countryHitTest';

/**
 * General plausibility cap on `nearestTimeZone`: it's only reported if the winning
 * candidate's real reference coordinate is within this distance of the actual
 * hover/click position — otherwise `nearestTimeZone` is `null`, even though the bucket
 * (offset/label/timeZones) may still resolve normally. Without this, a busy bucket
 * whose zones are geographically far apart along the same fixed-longitude line (e.g.
 * UTC+5:30's Asia/Kolkata vs Asia/Colombo) would keep reporting whichever one is
 * merely *less far*, however implausible — e.g. "Colombo" while hovering near
 * Antarctica, since it's still closer than Kolkata even there. Sized generously above
 * the largest realistic single-zone country span (e.g. Argentina, Western Australia).
 *
 * Also used, as a special case, to gate whole-bucket acceptance when only one offset
 * line is visible (a restricted `enabledTimeZones` collapsing to a single bucket) —
 * MAX_LINE_SNAP_DISTANCE can't do that job there since a real zone's landmass commonly
 * sits far from its own line (see below).
 */
const MAX_ZONE_HOVER_DISTANCE_KM = 3000;

export interface TimeZoneLinesProps {
  lineColor: string;
  highlightColor: string;
  buckets: readonly TimeZoneSelection[];
  onSelect?: (selection: TimeZoneSelection) => void;
  onHover?: (selection: TimeZoneSelection | null) => void;
  /**
   * Internal-only: carries the full geometry-bearing CountryBoundary (unlike the
   * public onCountryHover, which only gets the small {id, name} shape) so
   * TimeZonePickerMap can render CountryHighlight without re-deriving it.
   */
  onCountryChange?: (country: CountryBoundary | null) => void;
}

const FOCUS_TARGET_WIDTH = 8;
const HOVER_STROKE_WIDTH = 2;

/**
 * Renders the vertical UTC-offset lines plus two decoupled interaction layers:
 *
 * - Pointer interaction is "nearest-line-wins": one full-bleed transparent overlay
 *   rect resolves any click/hover to whichever line is closest, rather than giving
 *   each line its own narrow hit-band (which would shrink below a usable touch
 *   target on small screens). See src/utils/geometry.ts `resolveNearestOffset`.
 * - Keyboard/AT interaction stays as discrete, individually-focusable targets (one
 *   per line) since keyboard users tab between distinct stops and don't need
 *   touch-sized targets.
 */
export function TimeZoneLines({
  lineColor,
  highlightColor,
  buckets,
  onSelect,
  onHover,
  onCountryChange,
}: TimeZoneLinesProps) {
  // Tracked locally (not lifted, matching how selection/hover state already works in this
  // tree) purely to drive the visual highlight — `onHover` still carries the same payload
  // out to the consumer as before.
  const [hoveredOffset, setHoveredOffset] = useState<number | null>(null);

  const bucketsByOffset = useMemo(
    () => new Map(buckets.map((bucket) => [bucket.offsetMinutes, bucket])),
    [buckets],
  );

  // Only ever snap to a currently-rendered line — offsets with no matching enabled
  // zone are hidden, so a click near one of those should resolve to the nearest
  // *visible* line instead of silently doing nothing.
  const visibleOffsets = useMemo(() => buckets.map((bucket) => bucket.offsetMinutes), [buckets]);

  // Resolves the bucket under the pointer (x/offset-based, as before) and, since a
  // pointer event has a real position, refines it with the geographically nearest
  // zone within that bucket (see src/utils/nearestZone.ts) — the precise-selection
  // piece keyboard activation can't provide (no cursor position to measure from).
  // Also resolves whichever country (if any) is under the same point and is
  // consistent with the resolved bucket (see src/utils/countryHitTest.ts) — computed
  // here, from the same point conversion, rather than as a separate pass.
  const resolveFromClientPoint = useCallback(
    (
      clientX: number,
      clientY: number,
      rect: { left: number; top: number; width: number; height: number },
    ): { bucket: TimeZoneSelection | null; country: CountryBoundary | null } => {
      const { x, y } = clientPointToViewBoxPoint(clientX, clientY, rect);
      const nearestOffset = resolveNearestOffset(x, visibleOffsets);
      const rawBucket = bucketsByOffset.get(nearestOffset);
      if (!rawBucket) return { bucket: null, country: null };
      const point = invertPoint(x, y);
      const rawNearestZone = findNearestZone(rawBucket.timeZones, point);
      // The winning candidate can still be implausibly far (e.g. the only two zones
      // in a bucket sit on opposite sides of the globe along the same offset line) —
      // cap it unconditionally, before any bucket/line acceptance logic below, so a
      // specific "nearest city" guess never outlives its own plausibility.
      const nearestTimeZone =
        rawNearestZone != null &&
        haversineDistanceKm(point, ZONE_COORDINATES[rawNearestZone]) <= MAX_ZONE_HOVER_DISTANCE_KM
          ? rawNearestZone
          : null;

      // A sparse, widely-spaced set of visible lines (e.g. a restricted
      // enabledTimeZones) would otherwise make every point on the map resolve to
      // whichever line happens to be nearest, however far away — require the pointer
      // be near an actual line before accepting it.
      const nearLine = Math.abs(offsetMinutesToX(nearestOffset) - x) <= MAX_LINE_SNAP_DISTANCE;

      if (!nearLine) {
        if (visibleOffsets.length > 1) return { bucket: null, country: null };
        // With only one line visible there's no other candidate offset to
        // disambiguate from, so also accept real geographic proximity to the
        // resolved zone — a real zone's landmass (e.g. Argentina under UTC-3)
        // commonly sits much further from its own line than the cap above allows.
        // nearestTimeZone was already capped by that same distance test above, so
        // "is there a plausible candidate" collapses to just: is there one at all.
        if (nearestTimeZone == null) return { bucket: null, country: null };
      }

      const bucket = { ...rawBucket, nearestTimeZone };

      const hitCountry = findCountryAtPoint(x - LEFT_GUTTER_WIDTH, y);
      const country =
        hitCountry && countryMatchesTimeZones(hitCountry, bucket.timeZones) ? hitCountry : null;

      return { bucket, country };
    },
    [bucketsByOffset, visibleOffsets],
  );

  const handleOverlayClick = useCallback(
    (event: MouseEvent<SVGRectElement>) => {
      const { bucket, country } = resolveFromClientPoint(
        event.clientX,
        event.clientY,
        event.currentTarget.getBoundingClientRect(),
      );
      if (bucket) onSelect?.(bucket);
      // Fired on click too (not just pointermove) so touch taps — which often don't
      // fire a preceding pointermove — still get country-highlight parity.
      onCountryChange?.(country);
    },
    [onSelect, onCountryChange, resolveFromClientPoint],
  );

  const handleOverlayPointerMove = useCallback(
    (event: PointerEvent<SVGRectElement>) => {
      const { bucket, country } = resolveFromClientPoint(
        event.clientX,
        event.clientY,
        event.currentTarget.getBoundingClientRect(),
      );
      setHoveredOffset(bucket?.offsetMinutes ?? null);
      onHover?.(bucket);
      onCountryChange?.(country);
    },
    [onHover, onCountryChange, resolveFromClientPoint],
  );

  const handleOverlayPointerLeave = useCallback(() => {
    setHoveredOffset(null);
    onHover?.(null);
    onCountryChange?.(null);
  }, [onHover, onCountryChange]);

  const handleLineKeyDown = useCallback(
    (event: KeyboardEvent<SVGGElement>, bucket: TimeZoneSelection) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onSelect?.(bucket);
      }
    },
    [onSelect],
  );

  return (
    <g>
      {buckets.map((bucket) => {
        const x = offsetMinutesToX(bucket.offsetMinutes);
        const isHovered = bucket.offsetMinutes === hoveredOffset;
        return (
          <line
            key={bucket.offsetMinutes}
            x1={x}
            x2={x}
            y1={0}
            y2={MAP_HEIGHT}
            stroke={isHovered ? highlightColor : lineColor}
            strokeWidth={isHovered ? HOVER_STROKE_WIDTH : 1}
            pointerEvents="none"
            aria-hidden="true"
          />
        );
      })}

      <rect
        data-testid="tz-lines-overlay"
        x={0}
        y={0}
        width={TOTAL_WIDTH}
        height={MAP_HEIGHT}
        fill="transparent"
        aria-hidden="true"
        style={{ cursor: 'pointer', touchAction: 'manipulation' }}
        onClick={handleOverlayClick}
        onPointerMove={handleOverlayPointerMove}
        onPointerLeave={handleOverlayPointerLeave}
      />

      {buckets.map((bucket) => {
        const x = offsetMinutesToX(bucket.offsetMinutes);
        const zoneCount = bucket.timeZones.length;
        return (
          <g
            key={`focus-${bucket.offsetMinutes}`}
            role="button"
            tabIndex={0}
            aria-label={`${bucket.label}, ${zoneCount} time zone${zoneCount === 1 ? '' : 's'}`}
            onKeyDown={(event) => handleLineKeyDown(event, bucket)}
            onFocus={() => {
              setHoveredOffset(bucket.offsetMinutes);
              onHover?.(bucket);
            }}
            onBlur={() => {
              setHoveredOffset(null);
              onHover?.(null);
            }}
          >
            <rect
              x={x - FOCUS_TARGET_WIDTH / 2}
              y={0}
              width={FOCUS_TARGET_WIDTH}
              height={MAP_HEIGHT}
              fill="transparent"
              pointerEvents="none"
            />
          </g>
        );
      })}
    </g>
  );
}
