import { useCallback, useMemo, useState } from 'react';
import { IANA_TIME_ZONES } from '../../data/timezones';
import type { CountryBoundary } from '../../data/countries';
import type { TimeZonePickerMapProps } from '../../types';
import { buildTimeZoneBuckets } from '../../utils/bucket';
import { LEFT_GUTTER_WIDTH, MAP_HEIGHT, TOTAL_WIDTH } from '../../utils/geometry';
import { Background } from './Background';
import { Continents } from './Continents';
import { CountryHighlight } from './CountryHighlight';
import { TimeZoneLines } from './TimeZoneLines';

const DEFAULT_CONTINENT_COLOR = '#55717D';
const DEFAULT_BACKGROUND_COLOR = '#fff';
const DEFAULT_LINE_COLOR = '#9AA5B1';
const DEFAULT_LINE_HIGHLIGHT_COLOR = '#696a6c';
const DEFAULT_COUNTRY_HIGHLIGHT_FILL_COLOR = 'rgba(37, 99, 235, 0.25)';
const DEFAULT_COUNTRY_HIGHLIGHT_BORDER_COLOR = '#2563EB';

export function TimeZonePickerMap({
  width = '100%',
  height = '100%',
  className,
  style,
  continentColor = DEFAULT_CONTINENT_COLOR,
  backgroundColor = DEFAULT_BACKGROUND_COLOR,
  timeZoneLineColor = DEFAULT_LINE_COLOR,
  timeZoneLineHighlightColor = DEFAULT_LINE_HIGHLIGHT_COLOR,
  countryHighlightFillColor = DEFAULT_COUNTRY_HIGHLIGHT_FILL_COLOR,
  countryHighlightBorderColor = DEFAULT_COUNTRY_HIGHLIGHT_BORDER_COLOR,
  enabledTimeZones = IANA_TIME_ZONES,
  onTimeZoneSelect,
  onTimeZoneHover,
  onCountryHover,
}: TimeZonePickerMapProps) {
  const buckets = useMemo(() => buildTimeZoneBuckets(enabledTimeZones), [enabledTimeZones]);

  // Owned here (rather than inside TimeZoneLines) since CountryHighlight must render
  // above Continents, outside TimeZoneLines — mirrors TimeZoneLines' own
  // "local state drives the visual, decoupled from the public callback payload"
  // pattern (see its `hoveredOffset`), just relocated one level up.
  const [hoveredCountry, setHoveredCountry] = useState<CountryBoundary | null>(null);
  const handleCountryChange = useCallback(
    (country: CountryBoundary | null) => {
      setHoveredCountry(country);
      onCountryHover?.(country ? { id: country.id, name: country.name } : null);
    },
    [onCountryHover],
  );

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
        onCountryChange={handleCountryChange}
      />
      <g transform={`translate(${LEFT_GUTTER_WIDTH}, 0)`}>
        <Continents fill={continentColor} />
      </g>
      <g transform={`translate(${LEFT_GUTTER_WIDTH}, 0)`}>
        <CountryHighlight
          country={hoveredCountry}
          fillColor={countryHighlightFillColor}
          borderColor={countryHighlightBorderColor}
        />
      </g>
    </svg>
  );
}
