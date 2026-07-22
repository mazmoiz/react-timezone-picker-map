import { useMemo } from 'react';
import { IANA_TIME_ZONES } from '../../data/timezones';
import type { TimeZonePickerMapProps } from '../../types';
import { buildTimeZoneBuckets } from '../../utils/bucket';
import { LEFT_GUTTER_WIDTH, MAP_HEIGHT, TOTAL_WIDTH } from '../../utils/geometry';
import { Background } from './Background';
import { Continents } from './Continents';
import { TimeZoneLines } from './TimeZoneLines';
import { UtcLabels } from './UtcLabels';

const DEFAULT_CONTINENT_COLOR = '#55717D';
const DEFAULT_BACKGROUND_COLOR = '#fff';
const DEFAULT_LINE_COLOR = '#9AA5B1';
const DEFAULT_LABEL_COLOR = '#37474F';

export function TimeZonePickerMap({
  width = '100%',
  height = '100%',
  className,
  style,
  continentColor = DEFAULT_CONTINENT_COLOR,
  backgroundColor = DEFAULT_BACKGROUND_COLOR,
  timeZoneLineColor = DEFAULT_LINE_COLOR,
  utcLabelColor = DEFAULT_LABEL_COLOR,
  showTimeZoneLines = true,
  showUtcLabels = true,
  showEmptyTimeZoneLines = false,
  enabledTimeZones = IANA_TIME_ZONES,
  onTimeZoneSelect,
  onTimeZoneHover,
}: TimeZonePickerMapProps) {
  const buckets = useMemo(() => buildTimeZoneBuckets(enabledTimeZones), [enabledTimeZones]);

  // Lines/labels for offsets with no matching enabled zone are hidden by default so
  // restricting `enabledTimeZones` visually trims the grid to what's selectable.
  const visibleBuckets = useMemo(
    () =>
      showEmptyTimeZoneLines ? buckets : buckets.filter((bucket) => bucket.timeZones.length > 0),
    [buckets, showEmptyTimeZoneLines],
  );

  return (
    <svg
      className={className}
      style={style}
      width={width}
      height={height}
      viewBox={`0 0 ${TOTAL_WIDTH} ${MAP_HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg"
    >
      <Background fill={backgroundColor} width={TOTAL_WIDTH} />
      {showTimeZoneLines && (
        <TimeZoneLines
          lineColor={timeZoneLineColor}
          buckets={visibleBuckets}
          onSelect={onTimeZoneSelect}
          onHover={onTimeZoneHover}
        />
      )}
      <g transform={`translate(${LEFT_GUTTER_WIDTH}, 0)`}>
        <Continents fill={continentColor} />
      </g>
      {showUtcLabels && <UtcLabels color={utcLabelColor} buckets={visibleBuckets} />}
    </svg>
  );
}
