import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import type { CountryBoundary } from '../../data/countries';

export interface CountryHighlightProps {
  country: CountryBoundary | null;
  fillColor: string;
  borderColor: string;
}

const style: CSSProperties = { pointerEvents: 'none' };

function ringToPathD(ring: readonly (readonly [number, number])[]): string {
  return `M${ring.map(([x, y]) => `${x},${y}`).join('L')}Z`;
}

function polygonsToPathD(polygons: CountryBoundary['polygons']): string {
  return polygons.map((rings) => rings.map(ringToPathD).join('')).join('');
}

/**
 * Renders a border+fill outline for whichever single country is currently
 * hovered/tapped (see src/utils/countryHitTest.ts) — `null` when nothing is hovered,
 * or when the hovered country's own zones don't match the currently-resolved offset
 * bucket (so this never shows a country alongside a contradictory timezone result).
 */
export function CountryHighlight({ country, fillColor, borderColor }: CountryHighlightProps) {
  // Recomputed only when the hovered country actually changes, not on every
  // pointermove — TimeZoneLines/TimeZonePickerMap only update this prop on change.
  const d = useMemo(() => (country ? polygonsToPathD(country.polygons) : null), [country]);

  if (!d) return null;

  return (
    <path
      data-testid="country-highlight"
      d={d}
      fill={fillColor}
      stroke={borderColor}
      strokeWidth={2}
      strokeLinejoin="round"
      style={style}
      aria-hidden="true"
    />
  );
}
