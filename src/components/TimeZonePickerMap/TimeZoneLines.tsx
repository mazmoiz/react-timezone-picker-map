import { useCallback, useMemo, useState } from 'react';
import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react';
import type { TimeZoneSelection } from '../../types';
import {
  MAP_HEIGHT,
  MAX_LINE_SNAP_DISTANCE,
  TOTAL_WIDTH,
  clientPointToViewBoxPoint,
  invertPoint,
  offsetMinutesToX,
  resolveNearestOffset,
} from '../../utils/geometry';
import { ZONE_COORDINATES } from '../../data/zoneCoordinates';
import { findNearestZone, haversineDistanceKm } from '../../utils/nearestZone';

/**
 * When only one offset line is visible (a restricted `enabledTimeZones` collapsing to
 * a single bucket), MAX_LINE_SNAP_DISTANCE can't be used to gate acceptance — see below.
 * Instead we require the pointer's real geographic position to be within this distance
 * of the resolved zone's own reference coordinate, so hovering a completely unrelated
 * continent doesn't stay "stuck" on the only visible zone. Sized generously above the
 * largest realistic single-zone country span (e.g. Argentina, Western Australia) while
 * still excluding other continents.
 */
const MAX_ZONE_HOVER_DISTANCE_KM = 3000;

export interface TimeZoneLinesProps {
  lineColor: string;
  highlightColor: string;
  buckets: readonly TimeZoneSelection[];
  onSelect?: (selection: TimeZoneSelection) => void;
  onHover?: (selection: TimeZoneSelection | null) => void;
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
  const resolveBucketFromClientPoint = useCallback(
    (
      clientX: number,
      clientY: number,
      rect: { left: number; top: number; width: number; height: number },
    ) => {
      const { x, y } = clientPointToViewBoxPoint(clientX, clientY, rect);
      const nearestOffset = resolveNearestOffset(x, visibleOffsets);
      const bucket = bucketsByOffset.get(nearestOffset);
      if (!bucket) return null;
      const point = invertPoint(x, y);
      const nearestTimeZone = findNearestZone(bucket.timeZones, point);

      // A sparse, widely-spaced set of visible lines (e.g. a restricted
      // enabledTimeZones) would otherwise make every point on the map resolve to
      // whichever line happens to be nearest, however far away — require the pointer
      // be near an actual line before accepting it.
      const nearLine = Math.abs(offsetMinutesToX(nearestOffset) - x) <= MAX_LINE_SNAP_DISTANCE;

      if (!nearLine) {
        if (visibleOffsets.length > 1) return null;
        // With only one line visible there's no other candidate offset to
        // disambiguate from, so also accept real geographic proximity to the
        // resolved zone — a real zone's landmass (e.g. Argentina under UTC-3)
        // commonly sits much further from its own line than the cap above allows.
        const nearZone =
          nearestTimeZone != null &&
          haversineDistanceKm(point, ZONE_COORDINATES[nearestTimeZone]) <=
            MAX_ZONE_HOVER_DISTANCE_KM;
        if (!nearZone) return null;
      }

      return { ...bucket, nearestTimeZone };
    },
    [bucketsByOffset, visibleOffsets],
  );

  const handleOverlayClick = useCallback(
    (event: MouseEvent<SVGRectElement>) => {
      const bucket = resolveBucketFromClientPoint(
        event.clientX,
        event.clientY,
        event.currentTarget.getBoundingClientRect(),
      );
      if (bucket) onSelect?.(bucket);
    },
    [onSelect, resolveBucketFromClientPoint],
  );

  const handleOverlayPointerMove = useCallback(
    (event: PointerEvent<SVGRectElement>) => {
      const bucket = resolveBucketFromClientPoint(
        event.clientX,
        event.clientY,
        event.currentTarget.getBoundingClientRect(),
      );
      setHoveredOffset(bucket?.offsetMinutes ?? null);
      onHover?.(bucket);
    },
    [onHover, resolveBucketFromClientPoint],
  );

  const handleOverlayPointerLeave = useCallback(() => {
    setHoveredOffset(null);
    onHover?.(null);
  }, [onHover]);

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
