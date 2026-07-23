import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('visually highlights the hovered line and reverts it on pointer leave', () => {
    const { container } = render(<TimeZonePickerMap enabledTimeZones={TEST_ZONES} />);
    const overlay = container.querySelector('[data-testid="tz-lines-overlay"]')!;
    const hoveredLine = container.querySelector(
      `line[x1="${offsetMinutesToX(330)}"]`,
    ) as SVGLineElement;
    const otherLine = container.querySelector(
      `line[x1="${offsetMinutesToX(-300)}"]`,
    ) as SVGLineElement;

    expect(hoveredLine.getAttribute('stroke-width')).toBe('1');

    fireEvent(
      overlay,
      new MouseEvent('pointermove', { clientX: offsetMinutesToX(330), bubbles: true }),
    );
    expect(hoveredLine.getAttribute('stroke-width')).toBe('2');
    expect(hoveredLine.getAttribute('stroke')).not.toBe(otherLine.getAttribute('stroke'));
    expect(otherLine.getAttribute('stroke-width')).toBe('1');

    fireEvent(
      overlay,
      new MouseEvent('pointerout', {
        bubbles: true,
        relatedTarget: document.body,
      } as MouseEventInit),
    );
    expect(hoveredLine.getAttribute('stroke-width')).toBe('1');
  });

  it('visually highlights a line on keyboard focus and reverts it on blur', () => {
    const { container } = render(<TimeZonePickerMap enabledTimeZones={TEST_ZONES} />);
    const button = screen.getByRole('button', { name: /UTC\+5:30/ });
    const line = container.querySelector(
      `line[x1="${offsetMinutesToX(330)}"]`,
    ) as SVGLineElement;

    fireEvent.focus(button);
    expect(line.getAttribute('stroke-width')).toBe('2');

    fireEvent.blur(button);
    expect(line.getAttribute('stroke-width')).toBe('1');
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

  it('selects on the rendered line itself when only one offset is visible, even far from any zone coordinate', () => {
    // Only one offset is visible here (both zones share UTC-3), so there's no other
    // candidate offset to disambiguate against — clicking the line at a latitude far
    // from either zone's reference coordinate (e.g. the equator, vs. Buenos Aires at
    // -34.6 and Cayenne at 4.93) must still resolve, since the line itself is the
    // primary rendered hit target.
    const zones = ['America/Buenos_Aires', 'America/Cayenne'] as const;
    const onTimeZoneSelect = vi.fn();
    const { container } = render(
      <TimeZonePickerMap enabledTimeZones={zones} onTimeZoneSelect={onTimeZoneSelect} />,
    );
    const overlay = container.querySelector('[data-testid="tz-lines-overlay"]')!;

    fireEvent.click(overlay, { clientX: offsetMinutesToX(-180), clientY: EQUATOR_Y });
    expect(onTimeZoneSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        offsetMinutes: -180,
        timeZones: expect.arrayContaining(['America/Buenos_Aires', 'America/Cayenne']),
      }),
    );
  });

  it('does not select when hovering an unrelated continent with only one offset visible', () => {
    // Guards against the single-line case swinging the other way: with nothing to
    // disambiguate against, every point on the map must not collapse onto the one
    // visible zone regardless of distance — a click on a wholly unrelated continent
    // (e.g. Africa, ~7,000km from South America) should resolve to nothing.
    const zones = ['America/Buenos_Aires', 'America/Cayenne'] as const;
    const onTimeZoneSelect = vi.fn();
    const { container } = render(
      <TimeZonePickerMap enabledTimeZones={zones} onTimeZoneSelect={onTimeZoneSelect} />,
    );
    const overlay = container.querySelector('[data-testid="tz-lines-overlay"]')!;

    const inAfrica = geoToViewBoxPoint(20, 5); // e.g. Central Africa
    fireEvent.click(overlay, { clientX: inAfrica.x, clientY: inAfrica.y });
    expect(onTimeZoneSelect).not.toHaveBeenCalled();
  });

  it('never renders UTC labels (feature currently hidden)', () => {
    const { container } = render(<TimeZonePickerMap />);
    expect(container.querySelectorAll('svg text').length).toBe(0);
  });

  it('hides lines/buttons for offsets with no matching enabled zone', () => {
    const { container } = render(<TimeZonePickerMap enabledTimeZones={TEST_ZONES} />);
    // Only 3 of the ~37 canonical offsets have a matching zone in TEST_ZONES.
    expect(container.querySelectorAll('svg line').length).toBe(3);
    expect(screen.queryAllByRole('button').length).toBe(3);
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

  it('clears hover once the pointer moves far from every visible line (sparse enabledTimeZones)', () => {
    // With only a few widely-spaced zones enabled, "nearest line wins" must not degrade
    // into "whichever line happens to be closest, however far away" — otherwise the
    // reported value would never change as the pointer moves through the large gaps
    // between the few visible lines.
    const SPARSE_ZONES = ['America/Los_Angeles', 'Asia/Kolkata'] as const;
    const onTimeZoneHover = vi.fn();
    const { container } = render(
      <TimeZonePickerMap enabledTimeZones={SPARSE_ZONES} onTimeZoneHover={onTimeZoneHover} />,
    );
    const overlay = container.querySelector('[data-testid="tz-lines-overlay"]')!;

    fireEvent(
      overlay,
      new MouseEvent('pointermove', { clientX: offsetMinutesToX(-480), bubbles: true }),
    );
    expect(onTimeZoneHover).toHaveBeenLastCalledWith(
      expect.objectContaining({ offsetMinutes: -480, nearestTimeZone: 'America/Los_Angeles' }),
    );

    // Well past Los Angeles's line, still far short of Kolkata's — should resolve to
    // nothing rather than sticking to whichever of the two happens to be closer.
    fireEvent(
      overlay,
      new MouseEvent('pointermove', {
        clientX: offsetMinutesToX(-480) + 200,
        bubbles: true,
      }),
    );
    expect(onTimeZoneHover).toHaveBeenLastCalledWith(null);
  });

  it('applies custom continentColor and backgroundColor', () => {
    const { container } = render(
      <TimeZonePickerMap continentColor="rebeccapurple" backgroundColor="cornsilk" />,
    );
    expect(container.querySelector('g[fill="rebeccapurple"]')).not.toBeNull();
    expect(container.querySelector('rect[fill="cornsilk"]')).not.toBeNull();
  });
});
