import { describe, expect, it } from 'vitest';
import { findNearestZone, haversineDistanceKm } from './nearestZone';

describe('haversineDistanceKm', () => {
  it('returns 0 for identical points', () => {
    expect(haversineDistanceKm({ lat: 10, lon: 20 }, { lat: 10, lon: 20 })).toBe(0);
  });

  it('returns a plausible real-world distance (Buenos Aires to Cayenne)', () => {
    const buenosAires = { lat: -34.6, lon: -58.45 };
    const cayenne = { lat: 4.93, lon: -52.33 };
    const distance = haversineDistanceKm(buenosAires, cayenne);
    // Real great-circle distance is ~4460km — just check it's in a sane ballpark.
    expect(distance).toBeGreaterThan(4000);
    expect(distance).toBeLessThan(5000);
  });
});

describe('findNearestZone', () => {
  it('picks the geographically closest zone among real candidates', () => {
    // All three are in the UTC-3 standard-offset bucket in the real data.
    const zones = ['America/Buenos_Aires', 'America/Cayenne', 'Antarctica/Rothera'] as const;
    // A point right next to Buenos Aires should resolve to it, not the much further
    // Cayenne or Antarctic candidates.
    expect(findNearestZone(zones, { lat: -34.5, lon: -58.4 })).toBe('America/Buenos_Aires');
    // A point right next to Cayenne should resolve to it instead.
    expect(findNearestZone(zones, { lat: 5, lon: -52.3 })).toBe('America/Cayenne');
  });

  it('returns null when no candidate has a known coordinate', () => {
    expect(findNearestZone(['UTC'], { lat: 0, lon: 0 })).toBeNull();
    expect(findNearestZone([], { lat: 0, lon: 0 })).toBeNull();
  });

  it('prefers the canonical zone over its coordinate-sharing aliases on an exact tie', () => {
    // Europe/Guernsey, Europe/Isle_of_Man, and Europe/Jersey are pure IANA Link
    // aliases of Europe/London and inherit its exact coordinate — alphabetically
    // 'Guernsey' sorts before 'London', so a naive first-wins tie-break would always
    // pick an alias over the real canonical city.
    const zones = [
      'Europe/Guernsey',
      'Europe/Isle_of_Man',
      'Europe/Jersey',
      'Europe/London',
    ] as const;
    expect(findNearestZone(zones, { lat: 51.5, lon: -0.1 })).toBe('Europe/London');
    // Order-independence: still correct even if the canonical zone is encountered
    // first — proves this is a principled tie-break, not a coincidence of array order.
    expect(findNearestZone([...zones].reverse(), { lat: 51.5, lon: -0.1 })).toBe(
      'Europe/London',
    );
  });
});
