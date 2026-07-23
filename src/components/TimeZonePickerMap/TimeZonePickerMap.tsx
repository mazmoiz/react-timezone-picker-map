import { useMemo } from 'react';
import { IANA_TIME_ZONES } from '../../data/timezones';
import type { TimeZonePickerMapProps } from '../../types';
import { buildTimeZoneBuckets } from '../../utils/bucket';
import { LEFT_GUTTER_WIDTH, MAP_HEIGHT, TOTAL_WIDTH } from '../../utils/geometry';
import { Background } from './Background';
import { Continents } from './Continents';
import { TimeZoneLines } from './TimeZoneLines';

const DEFAULT_CONTINENT_COLOR = '#55717D';
const DEFAULT_BACKGROUND_COLOR = '#fff';
const DEFAULT_LINE_COLOR = '#9AA5B1';
const DEFAULT_LINE_HIGHLIGHT_COLOR = '#696a6c';

export function TimeZonePickerMap({
  width = '100%',
  height = '100%',
  className,
  style,
  continentColor = DEFAULT_CONTINENT_COLOR,
  backgroundColor = DEFAULT_BACKGROUND_COLOR,
  timeZoneLineColor = DEFAULT_LINE_COLOR,
  timeZoneLineHighlightColor = DEFAULT_LINE_HIGHLIGHT_COLOR,
  enabledTimeZones = IANA_TIME_ZONES,
  onTimeZoneSelect,
  onTimeZoneHover,
}: TimeZonePickerMapProps) {
  const buckets = useMemo(() => buildTimeZoneBuckets(enabledTimeZones), [enabledTimeZones]);

  // Lines for offsets with no matching enabled zone are hidden so restricting
  // `enabledTimeZones` visually trims the grid to what's actually selectable.
  const visibleBuckets = useMemo(
    () => buckets.filter((bucket) => bucket.timeZones.length > 0),
    [buckets],
  );

  return (
    <svg
      className={className}
      // `display: block` avoids the inline-element baseline gap browsers otherwise
      // leave below the <svg> (the same issue <img> has) — merged before `style` so
      // a consumer can still override it.
      style={{ display: 'block', ...style }}
      width={width}
      height={height}
      viewBox={`0 0 ${TOTAL_WIDTH} ${MAP_HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg"
    >
      <Background fill={backgroundColor} width={TOTAL_WIDTH} />
      <TimeZoneLines
        lineColor={timeZoneLineColor}
        highlightColor={timeZoneLineHighlightColor}
        buckets={visibleBuckets}
        onSelect={onTimeZoneSelect}
        onHover={onTimeZoneHover}
      />
      <g transform={`translate(${LEFT_GUTTER_WIDTH}, 0)`}>
        <Continents fill={continentColor} />
      </g>
    </svg>
  );
}
