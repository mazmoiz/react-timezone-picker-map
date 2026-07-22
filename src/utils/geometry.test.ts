import { geoEquirectangular } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import { describe, expect, it } from 'vitest';
import landTopologyJson from 'world-atlas/land-110m.json';
import { UTC_OFFSET_MINUTES } from '../data/utcOffsets';
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  TOTAL_WIDTH,
  invertPoint,
  offsetMinutesToX,
  resolveNearestOffset,
} from './geometry';

const landTopology = landTopologyJson as unknown as Topology;

describe('geometry', () => {
  it('maps the viewBox edges to the original -12h/+12h core range, extended by any observed offset beyond it', () => {
    // x=0 is always the map's original longitude-accurate UTC-12 edge, even if no
    // real zone currently uses exactly that offset (only the nearest real line, e.g.
    // UTC-11, would actually be drawn near it). Likewise the right edge extends past
    // the original UTC+12 edge only as far as real data (e.g. UTC+14) requires.
    const leftEdgeOffset = Math.min(-720, ...UTC_OFFSET_MINUTES);
    const rightEdgeOffset = Math.max(720, ...UTC_OFFSET_MINUTES);
    expect(offsetMinutesToX(leftEdgeOffset)).toBeCloseTo(0, 5);
    expect(offsetMinutesToX(rightEdgeOffset)).toBeCloseTo(TOTAL_WIDTH, 5);
  });

  it('is monotonically increasing across the sorted canonical offsets', () => {
    const sorted = [...UTC_OFFSET_MINUTES].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      expect(offsetMinutesToX(sorted[i])).toBeGreaterThan(offsetMinutesToX(sorted[i - 1]));
    }
  });

  it('resolves the exact offset when the pointer is exactly on its line', () => {
    for (const offset of UTC_OFFSET_MINUTES) {
      expect(resolveNearestOffset(offsetMinutesToX(offset))).toBe(offset);
    }
  });

  it('resolves to whichever neighbor is closer around the midpoint between two lines', () => {
    const sorted = [...UTC_OFFSET_MINUTES].sort((a, b) => a - b);
    const [a, b] = sorted;
    const xa = offsetMinutesToX(a);
    const xb = offsetMinutesToX(b);
    const midpoint = (xa + xb) / 2;
    expect(resolveNearestOffset(midpoint - 1)).toBe(a);
    expect(resolveNearestOffset(midpoint + 1)).toBe(b);
  });

  it('only ever resolves to an offset within a restricted candidate list', () => {
    const sorted = [...UTC_OFFSET_MINUTES].sort((a, b) => a - b);
    const candidates = [sorted[0], sorted[sorted.length - 1]]; // just the two extremes
    // A click right next to (but not on) the second-smallest offset's line — which is
    // NOT a candidate — should still snap to the nearest *candidate*, not that line.
    const nearSecondSmallest = offsetMinutesToX(sorted[1]);
    const resolved = resolveNearestOffset(nearSecondSmallest, candidates);
    expect(candidates).toContain(resolved);
  });

  it('matches the actual map projection exactly (proves the lines are geographically aligned)', () => {
    // Rebuilds the same projection scripts/generate-world-map.mjs uses to draw
    // Continents.tsx and confirms offsetMinutesToX (core range, ignoring the
    // beyond-+12h gutter) agrees with it pixel-for-pixel — a regression here would
    // mean the timezone lines no longer line up with the continents.
    const landFeature = feature(landTopology, landTopology.objects.land);
    const projection = geoEquirectangular().fitSize([MAP_WIDTH, MAP_HEIGHT], landFeature);

    for (const lon of [-180, -74, 0, 77.2, 139.7, 180]) {
      const [expectedX] = projection([lon, 0])!;
      const actualX = offsetMinutesToX(lon * 4);
      expect(actualX).toBeCloseTo(expectedX, 1);
    }
  });

  it('invertPoint matches the actual map projection exactly (proves precise lat/lon lookup is aligned)', () => {
    // Same rigor as the offsetMinutesToX alignment test above, but for the inverse
    // (pixel -> lon/lat) direction used by the precise hover/click zone lookup.
    const landFeature = feature(landTopology, landTopology.objects.land);
    const projection = geoEquirectangular().fitSize([MAP_WIDTH, MAP_HEIGHT], landFeature);

    const samplePoints: Array<[number, number]> = [
      [100, 100],
      [800, 400],
      [1200, 250],
      [400, 700],
    ];
    for (const [x, y] of samplePoints) {
      const [expectedLon, expectedLat] = projection.invert!([x, y])!;
      const { lon, lat } = invertPoint(x, y);
      expect(lon).toBeCloseTo(expectedLon, 1);
      expect(lat).toBeCloseTo(expectedLat, 1);
    }
  });
});
