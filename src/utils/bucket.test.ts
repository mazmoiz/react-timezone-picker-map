import { describe, expect, it } from 'vitest';
import { buildTimeZoneBuckets, formatUtcOffsetLabel } from './bucket';

describe('formatUtcOffsetLabel', () => {
  it('formats whole-hour offsets without minutes', () => {
    expect(formatUtcOffsetLabel(-720)).toBe('UTC-12');
    expect(formatUtcOffsetLabel(0)).toBe('UTC+0');
    expect(formatUtcOffsetLabel(300)).toBe('UTC+5');
  });

  it('formats fractional offsets with minutes', () => {
    expect(formatUtcOffsetLabel(330)).toBe('UTC+5:30');
    expect(formatUtcOffsetLabel(345)).toBe('UTC+5:45');
    expect(formatUtcOffsetLabel(765)).toBe('UTC+12:45');
    expect(formatUtcOffsetLabel(-210)).toBe('UTC-3:30');
  });
});

describe('buildTimeZoneBuckets', () => {
  it('returns one bucket per canonical offset, always', () => {
    const buckets = buildTimeZoneBuckets([]);
    expect(buckets.length).toBeGreaterThan(0);
    expect(buckets.every((bucket) => bucket.timeZones.length === 0)).toBe(true);
  });

  it('places each enabled zone into its standard (non-DST) offset bucket', () => {
    const buckets = buildTimeZoneBuckets([
      'UTC',
      'Asia/Kolkata',
      'Asia/Kathmandu',
      'America/New_York',
      'America/Los_Angeles',
    ]);
    const byOffset = new Map(buckets.map((b) => [b.offsetMinutes, b]));

    expect(byOffset.get(0)?.timeZones).toContain('UTC');
    expect(byOffset.get(330)?.timeZones).toContain('Asia/Kolkata');
    expect(byOffset.get(345)?.timeZones).toContain('Asia/Kathmandu');
    // Standard offsets (EST / PST), not whatever DST happens to be in effect today.
    expect(byOffset.get(-300)?.timeZones).toContain('America/New_York');
    expect(byOffset.get(-480)?.timeZones).toContain('America/Los_Angeles');
  });

  it('does not place a zone into an unrelated bucket', () => {
    const buckets = buildTimeZoneBuckets(['Asia/Kolkata']);
    const nonMatching = buckets.filter((b) => b.offsetMinutes !== 330);
    expect(nonMatching.every((b) => !b.timeZones.includes('Asia/Kolkata'))).toBe(true);
  });
});
