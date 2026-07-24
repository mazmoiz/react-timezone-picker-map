import { describe, expect, it } from 'vitest';
import { COUNTRY_BOUNDARIES } from '../data/countries';
import { DEGREES_PER_PIXEL, EQUATOR_Y, MAP_WIDTH } from './geometry';
import { countryMatchesTimeZones, findCountryAtPoint } from './countryHitTest';

/** Converts real lon/lat into the same "core" space COUNTRY_BOUNDARIES is stored in. */
function geoToCorePoint(lon: number, lat: number) {
  return {
    x: MAP_WIDTH / 2 + lon / DEGREES_PER_PIXEL,
    y: EQUATOR_Y - lat / DEGREES_PER_PIXEL,
  };
}

function findByName(name: string) {
  const country = COUNTRY_BOUNDARIES.find((c) => c.name === name);
  if (!country) throw new Error(`Test fixture problem: ${name} not found in COUNTRY_BOUNDARIES`);
  return country;
}

describe('findCountryAtPoint', () => {
  it('resolves a point clearly inside France', () => {
    const { x, y } = geoToCorePoint(2.35, 46.5); // central France, well away from any border
    expect(findCountryAtPoint(x, y)?.name).toBe('France');
  });

  it('resolves a point clearly inside Argentina', () => {
    const { x, y } = geoToCorePoint(-64, -34); // interior Pampas region
    expect(findCountryAtPoint(x, y)?.name).toBe('Argentina');
  });

  it('resolves a point clearly inside Chile', () => {
    const { x, y } = geoToCorePoint(-70.6, -33.4); // Santiago area
    expect(findCountryAtPoint(x, y)?.name).toBe('Chile');
  });

  it('returns null for a point in open ocean', () => {
    const { x, y } = geoToCorePoint(-150, 0); // mid-Pacific
    expect(findCountryAtPoint(x, y)).toBeNull();
  });

  it('excludes Antarctica entirely, even though it has real IANA zone membership', () => {
    // Antarctica genuinely has functioning IANA zone data (dedicated Antarctica/*
    // research-station zones, plus a couple of pure aliases to supply-nation zones)
    // and would otherwise highlight like any real country — it's deliberately
    // excluded from COUNTRY_BOUNDARIES since it has no permanent civilian population
    // and isn't a meaningful "pick your country" target. Antarctica/* zones remain
    // fully selectable via the map's offset lines as normal; only this
    // country-highlight feature ignores it.
    expect(COUNTRY_BOUNDARIES.find((c) => c.name === 'Antarctica')).toBeUndefined();

    const { x, y } = geoToCorePoint(0, -80); // deep in Antarctica's interior
    expect(findCountryAtPoint(x, y)).toBeNull();
  });

  describe('antimeridian-crossing countries (e.g. Russia, Fiji)', () => {
    // Russia's territory crosses the antimeridian (±180° longitude). A naive
    // per-point projection with no clipping would draw one long, wrong straight edge
    // connecting the far right of the map to the far left for its ring — which would
    // both render incorrectly AND make any point along that phantom band (e.g. open
    // ocean at a similar latitude, far from Russia) incorrectly test as "inside
    // Russia". scripts/generate-world-map.mjs uses d3-geo's proper clipping stream
    // (projection.stream()) specifically to avoid this.

    it('resolves a point in European/Western Russia', () => {
      const { x, y } = geoToCorePoint(45, 55); // west of the Urals
      expect(findCountryAtPoint(x, y)?.name).toBe('Russia');
    });

    it('resolves a point in Far Eastern Russia, on the far side of the antimeridian split', () => {
      const { x, y } = geoToCorePoint(-174, 66); // Chukotka, east of 180°
      expect(findCountryAtPoint(x, y)?.name).toBe('Russia');
    });

    it('does not resolve open ocean at Russia’s latitude, far from its actual territory, to Russia', () => {
      // This exact point would have fallen inside the old bogus full-width band bug.
      const { x, y } = geoToCorePoint(-30, 60); // mid North Atlantic
      expect(findCountryAtPoint(x, y)?.name).not.toBe('Russia');
    });

    it('never produces a single ring spanning an implausible fraction of the map width', () => {
      // Structural invariant, checked across all 173 countries rather than guessing
      // exact coordinates for tiny antimeridian-crossing islands (e.g. Fiji, whose
      // landmass is only a few pixels wide at this map's resolution, too fragile to
      // reliably hit via an approximate lon/lat conversion). The old bug produced a
      // ring spanning the full ~1600px core width (e.g. Russia); a real country's
      // single (already antimeridian-split) ring should never come close to that.
      // (Antarctica, which legitimately spans the full map width by wrapping around
      // the bottom edge, would otherwise need an exception here — it's excluded from
      // COUNTRY_BOUNDARIES entirely, see the test above, so none needed.)
      for (const country of COUNTRY_BOUNDARIES) {
        for (const rings of country.polygons) {
          for (const ring of rings) {
            const xs = ring.map(([x]) => x);
            const span = Math.max(...xs) - Math.min(...xs);
            expect(span, `${country.name}'s ring spans ${span}px`).toBeLessThan(1000);
          }
        }
      }
    });
  });
});

describe('countryMatchesTimeZones', () => {
  it('matches when the country has a zone in the resolved bucket', () => {
    const spain = findByName('Spain');
    expect(countryMatchesTimeZones(spain, ['Europe/Madrid', 'Europe/Andorra'])).toBe(true);
  });

  it('does not match when none of the country’s zones are in the resolved bucket', () => {
    // The exact "Spain resolves closer to the UTC+0 line than its actual UTC+1" case
    // this check exists for: Spain's own zones (Europe/Madrid etc.) are absent from a
    // bucket that only has UK/Portugal-side zones.
    const spain = findByName('Spain');
    expect(countryMatchesTimeZones(spain, ['Europe/London', 'Europe/Lisbon'])).toBe(false);
  });

  it('matches a shared-zone country against its actual (different-country) canonical zone', () => {
    // Benin has no IANA zone of its own — it shares Africa/Lagos (Nigeria) — this
    // should still count as a match, since that's genuinely Benin's real zone.
    const benin = findByName('Benin');
    expect(countryMatchesTimeZones(benin, ['Africa/Lagos'])).toBe(true);
  });
});
