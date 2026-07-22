import { useCallback, useMemo } from 'react';
import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react';
import type { TimeZoneSelection } from '../../types';
import {
  MAP_HEIGHT,
  TOTAL_WIDTH,
  clientPointToViewBoxPoint,
  invertPoint,
  offsetMinutesToX,
  resolveNearestOffset,
} from '../../utils/geometry';
import { findNearestZone } from '../../utils/nearestZone';

export interface TimeZoneLinesProps {
  lineColor: string;
  buckets: readonly TimeZoneSelection[];
  onSelect?: (selection: TimeZoneSelection) => void;
  onHover?: (selection: TimeZoneSelection | null) => void;
}

const FOCUS_TARGET_WIDTH = 8;

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
export function TimeZoneLines({ lineColor, buckets, onSelect, onHover }: TimeZoneLinesProps) {
  const bucketsByOffset = useMemo(
    () => new Map(buckets.map((bucket) => [bucket.offsetMinutes, bucket])),
    [buckets],
  );

  // Only ever snap to a currently-rendered line — if some offsets are hidden (see
  // `showEmptyTimeZoneLines`), a click near one of those should resolve to the
  // nearest *visible* line instead of silently doing nothing.
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
      const nearestTimeZone = findNearestZone(bucket.timeZones, invertPoint(x, y));
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
      onHover?.(bucket);
    },
    [onHover, resolveBucketFromClientPoint],
  );

  const handleOverlayPointerLeave = useCallback(() => {
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
        return (
          <line
            key={bucket.offsetMinutes}
            x1={x}
            x2={x}
            y1={0}
            y2={MAP_HEIGHT}
            stroke={lineColor}
            strokeWidth={1}
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
            onFocus={() => onHover?.(bucket)}
            onBlur={() => onHover?.(null)}
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
