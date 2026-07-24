import type { CSSProperties } from 'react';
import type { IANA_TIME_ZONES } from './data/timezones';

export type IanaTimeZoneName = (typeof IANA_TIME_ZONES)[number];

/** The payload passed to `onTimeZoneSelect` / `onTimeZoneHover` for one canonical UTC-offset line. */
export interface TimeZoneSelection {
  /** One of the canonical UTC_OFFSET_MINUTES values; may be fractional (e.g. 330 = UTC+5:30). */
  readonly offsetMinutes: number;
  /** Human-readable label, e.g. "UTC-12", "UTC+0", "UTC+5:30", "UTC+12:45". */
  readonly label: string;
  /** Enabled IANA zones whose standard (non-DST) offset exactly matches this line. */
  readonly timeZones: readonly IanaTimeZoneName[];
  /**
   * Whichever zone in `timeZones` has a reference coordinate geographically closest
   * to the exact hover/click position, or `null` if the interaction had no position
   * (e.g. keyboard activation) or none of `timeZones` has a known coordinate.
   */
  readonly nearestTimeZone: IanaTimeZoneName | null;
}

/** The payload passed to `onCountryHover` for the country under the cursor/tap. */
export interface CountryInfo {
  /** ISO 3166-1 numeric country code (as a string), e.g. '724' for Spain. */
  readonly id: string;
  /** Country name (Natural Earth), e.g. 'Spain'. */
  readonly name: string;
}

export interface TimeZonePickerMapProps {
  /** Width of the map. Default `'100%'`. */
  width?: string | number;
  /** Height of the map. Default `'100%'`. */
  height?: string | number;
  /** Applied to the root `<svg>`. */
  className?: string;
  /** Applied to the root `<svg>`. */
  style?: CSSProperties;

  /** Fill color for the continents. Default `'#55717D'`. */
  continentColor?: string;
  /** Fill color for the water/background. Default `'#fff'`. */
  backgroundColor?: string;
  /** Color of the vertical UTC-offset lines. */
  timeZoneLineColor?: string;
  /** Color of a UTC-offset line while hovered or keyboard-focused. */
  timeZoneLineHighlightColor?: string;
  /** Fill color for the highlighted country under the cursor/tap. */
  countryHighlightFillColor?: string;
  /** Border color for the highlighted country under the cursor/tap. */
  countryHighlightBorderColor?: string;

  /** Subset of IANA zones the consumer wants selectable. Default: all zones. */
  enabledTimeZones?: readonly IanaTimeZoneName[];

  onTimeZoneSelect?: (selection: TimeZoneSelection) => void;
  onTimeZoneHover?: (selection: TimeZoneSelection | null) => void;
  /**
   * Fired on hover/focus and tap for whichever country is under the cursor — but only
   * when that country's own IANA zone(s) are consistent with the currently-resolved
   * offset (see the country-zone membership check in src/utils/countryHitTest.ts).
   * This can legitimately stay `null` for a country whose real timezone differs from
   * what its geographic position alone would suggest (e.g. Spain sits closer to the
   * UTC+0 band than its actual UTC+1) — see the README's "Good to know" section.
   */
  onCountryHover?: (country: CountryInfo | null) => void;
}
