import type { TimeZoneSelection } from '../../types';
import { TOTAL_WIDTH, offsetMinutesToX } from '../../utils/geometry';

export interface UtcLabelsProps {
  color: string;
  buckets: readonly TimeZoneSelection[];
}

// Measured against the actual generated land bounding box (see
// scripts/generate-world-map.mjs): land spans y in [14.1, 785.9] within the
// 800-tall canvas, so these leave a couple px of clearance on each side.
const TOP_Y = 12;
const BOTTOM_Y = 796;
const FONT_SIZE = 11;
const EDGE_EPSILON = 1;

/** Two rows of UTC offset labels, one per visible bucket, positioned just outside the land bounds. */
export function UtcLabels({ color, buckets }: UtcLabelsProps) {
  return (
    <g fill={color} fontSize={FONT_SIZE} aria-hidden="true" style={{ pointerEvents: 'none' }}>
      {buckets.map(({ offsetMinutes, label }) => {
        const x = offsetMinutesToX(offsetMinutes);
        // Anchored by proximity to the true viewBox edges rather than array index —
        // `buckets` may be a filtered subset, so the first/last entry isn't
        // necessarily at x=0 / x=TOTAL_WIDTH.
        const textAnchor =
          x <= EDGE_EPSILON ? 'start' : x >= TOTAL_WIDTH - EDGE_EPSILON ? 'end' : 'middle';
        return (
          <g key={offsetMinutes}>
            <text x={x} y={TOP_Y} textAnchor={textAnchor}>
              {label}
            </text>
            <text x={x} y={BOTTOM_Y} textAnchor={textAnchor}>
              {label}
            </text>
          </g>
        );
      })}
    </g>
  );
}
