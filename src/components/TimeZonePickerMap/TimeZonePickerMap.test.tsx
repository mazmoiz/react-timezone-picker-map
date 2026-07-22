import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UTC_OFFSET_MINUTES } from '../../data/utcOffsets';
import {
  DEGREES_PER_PIXEL,
  EQUATOR_Y,
  MAP_WIDTH,
  MAP_HEIGHT,
  TOTAL_WIDTH,
  offsetMinutesToX,
} from '../../utils/geometry';
import { TimeZonePickerMap } from './TimeZonePickerMap';

const TEST_ZONES = ['America/New_York', 'Asia/Kolkata', 'Pacific/Kiritimati'] as const;

/** Inverse of geometry.ts's invertPoint, for constructing test click positions. */
function geoToViewBoxPoint(lon: number, lat: number) {
  return {
    x: MAP_WIDTH / 2 + lon / DEGREES_PER_PIXEL,
    y: EQUATOR_Y - lat / DEGREES_PER_PIXEL,
  };
}

beforeEach(() => {
  // jsdom has no layout engine, so getBoundingClientRect() is all-zero by default.
  // Stub it to a 1:1 mapping onto viewBox units so clientX can be used directly.
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    width: TOTAL_WIDTH,
    height: MAP_HEIGHT,
    right: TOTAL_WIDTH,
    bottom: MAP_HEIGHT,
    toJSON: () => {},
  });
});

describe('TimeZonePickerMap', () => {
  it('selects the exact bucket when clicking on its line (whole-hour offset)', () => {
    const onTimeZoneSelect = vi.fn();
    const { container } = render(
      <TimeZonePickerMap enabledTimeZones={TEST_ZONES} onTimeZoneSelect={onTimeZoneSelect} />,
    );
    const overlay = container.querySelector('[data-testid="tz-lines-overlay"]')!;
    // America/New_York's standard (non-DST, EST) offset.
    fireEvent.click(overlay, { clientX: offsetMinutesToX(-300) });

    expect(onTimeZoneSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        offsetMinutes: -300,
        label: 'UTC-5',
        timeZones: ['America/New_York'],
      }),
    );
  });

  it('selects the exact bucket for a fractional offset', () => {
    const onTimeZoneSelect = vi.fn();
    const { container } = render(
      <TimeZonePickerMap enabledTimeZones={TEST_ZONES} onTimeZoneSelect={onTimeZoneSelect} />,
    );
    const overlay = container.querySelector('[data-testid="tz-lines-overlay"]')!;
    fireEvent.click(overlay, { clientX: offsetMinutesToX(330) });

    expect(onTimeZoneSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        offsetMinutes: 330,
        label: 'UTC+5:30',
        timeZones: ['Asia/Kolkata'],
      }),
    );
  });

  it('selects the exact bucket for an offset beyond +12', () => {
    const onTimeZoneSelect = vi.fn();
    const { container } = render(
      <TimeZonePickerMap enabledTimeZones={TEST_ZONES} onTimeZoneSelect={onTimeZoneSelect} />,
    );
    const overlay = container.querySelector('[data-testid="tz-lines-overlay"]')!;
    fireEvent.click(overlay, { clientX: offsetMinutesToX(840) });

    expect(onTimeZoneSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        offsetMinutes: 840,
        label: 'UTC+14',
        timeZones: ['Pacific/Kiritimati'],
      }),
    );
  });

  it('reports hover, including clearing it on pointer leave', () => {
    const onTimeZoneHover = vi.fn();
    const { container } = render(
      <TimeZonePickerMap enabledTimeZones={TEST_ZONES} onTimeZoneHover={onTimeZoneHover} />,
    );
    const overlay = container.querySelector('[data-testid="tz-lines-overlay"]')!;
    // jsdom has no PointerEvent implementation. React derives onPointerMove from a
    // native 'pointermove' listener (clientX comes through on a plain MouseEvent typed
    // as one), but onPointerLeave is derived synthetically from 'pointerout' plus a
    // relatedTarget outside the element — so that's what needs to be dispatched here.
    fireEvent(
      overlay,
      new MouseEvent('pointermove', { clientX: offsetMinutesToX(330), bubbles: true }),
    );
    expect(onTimeZoneHover).toHaveBeenLastCalledWith(
      expect.objectContaining({ offsetMinutes: 330 }),
    );

    fireEvent(
      overlay,
      new MouseEvent('pointerout', {
        bubbles: true,
        relatedTarget: document.body,
      } as MouseEventInit),
    );
    expect(onTimeZoneHover).toHaveBeenLastCalledWith(null);
  });

  it('activates the matching line via keyboard (Enter) on its focusable target, with no nearestTimeZone', () => {
    const onTimeZoneSelect = vi.fn();
    render(<TimeZonePickerMap enabledTimeZones={TEST_ZONES} onTimeZoneSelect={onTimeZoneSelect} />);

    const button = screen.getByRole('button', { name: /UTC\+5:30/ });
    fireEvent.keyDown(button, { key: 'Enter' });

    // Keyboard activation has no cursor position, so there's nothing to measure
    // geographic proximity from.
    expect(onTimeZoneSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        offsetMinutes: 330,
        timeZones: ['Asia/Kolkata'],
        nearestTimeZone: null,
      }),
    );
  });

  it('resolves nearestTimeZone to whichever zone in the bucket is geographically closest to the exact position', () => {
    // Buenos Aires and Cayenne share the same UTC-3 standard offset bucket but sit
    // ~4,500km apart — this is the exact scenario reported: hovering a busy line
    // should be able to distinguish which zone the cursor is actually over.
    const zones = ['America/Buenos_Aires', 'America/Cayenne'] as const;
    const onTimeZoneSelect = vi.fn();
    const { container } = render(
      <TimeZonePickerMap enabledTimeZones={zones} onTimeZoneSelect={onTimeZoneSelect} />,
    );
    const overlay = container.querySelector('[data-testid="tz-lines-overlay"]')!;

    const nearBuenosAires = geoToViewBoxPoint(-58.45, -34.6);
    fireEvent.click(overlay, { clientX: nearBuenosAires.x, clientY: nearBuenosAires.y });
    expect(onTimeZoneSelect).toHaveBeenLastCalledWith(
      expect.objectContaining({
        offsetMinutes: -180,
        timeZones: expect.arrayContaining(['America/Buenos_Aires', 'America/Cayenne']),
        nearestTimeZone: 'America/Buenos_Aires',
      }),
    );

    const nearCayenne = geoToViewBoxPoint(-52.33, 4.93);
    fireEvent.click(overlay, { clientX: nearCayenne.x, clientY: nearCayenne.y });
    expect(onTimeZoneSelect).toHaveBeenLastCalledWith(
      expect.objectContaining({ offsetMinutes: -180, nearestTimeZone: 'America/Cayenne' }),
    );
  });

  it('omits the interactive lines subtree entirely when showTimeZoneLines is false', () => {
    const { container } = render(<TimeZonePickerMap showTimeZoneLines={false} />);
    expect(container.querySelector('[data-testid="tz-lines-overlay"]')).toBeNull();
    expect(container.querySelectorAll('svg line').length).toBe(0);
    expect(screen.queryAllByRole('button').length).toBe(0);
  });

  it('omits UTC labels when showUtcLabels is false', () => {
    const { container } = render(<TimeZonePickerMap showUtcLabels={false} />);
    expect(container.querySelectorAll('svg text').length).toBe(0);
  });

  it('hides lines/labels/buttons for offsets with no matching enabled zone by default', () => {
    const { container } = render(<TimeZonePickerMap enabledTimeZones={TEST_ZONES} />);
    // Only 3 of the ~37 canonical offsets have a matching zone in TEST_ZONES.
    expect(container.querySelectorAll('svg line').length).toBe(3);
    expect(screen.queryAllByRole('button').length).toBe(3);
    expect(container.querySelectorAll('svg text').length).toBe(3 * 2); // top + bottom row
  });

  it('resolves a click near a hidden line to the nearest visible one instead of nothing', () => {
    const onTimeZoneSelect = vi.fn();
    const { container } = render(
      <TimeZonePickerMap enabledTimeZones={TEST_ZONES} onTimeZoneSelect={onTimeZoneSelect} />,
    );
    const overlay = container.querySelector('[data-testid="tz-lines-overlay"]')!;
    // UTC+5 (300) has no enabled zone and is hidden; nearest visible is UTC+5:30 (330).
    fireEvent.click(overlay, { clientX: offsetMinutesToX(300) });

    expect(onTimeZoneSelect).toHaveBeenCalledWith(
      expect.objectContaining({ offsetMinutes: 330, timeZones: ['Asia/Kolkata'] }),
    );
  });

  it('renders the full grid regardless of enabledTimeZones when showEmptyTimeZoneLines is true', () => {
    const { container } = render(
      <TimeZonePickerMap enabledTimeZones={TEST_ZONES} showEmptyTimeZoneLines />,
    );
    expect(container.querySelectorAll('svg line').length).toBe(UTC_OFFSET_MINUTES.length);
    expect(screen.queryAllByRole('button').length).toBe(UTC_OFFSET_MINUTES.length);
    expect(container.querySelectorAll('svg text').length).toBe(UTC_OFFSET_MINUTES.length * 2);
  });

  it('applies custom continentColor and backgroundColor', () => {
    const { container } = render(
      <TimeZonePickerMap continentColor="rebeccapurple" backgroundColor="cornsilk" />,
    );
    expect(container.querySelector('g[fill="rebeccapurple"]')).not.toBeNull();
    expect(container.querySelector('rect[fill="cornsilk"]')).not.toBeNull();
  });
});
