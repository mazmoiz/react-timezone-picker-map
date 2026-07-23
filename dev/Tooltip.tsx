import type { CSSProperties } from 'react';
import type { TimeZoneSelection } from '@lib';

export interface TooltipProps {
  selection: TimeZoneSelection;
  /** Position relative to the tooltip's positioned ancestor, in px. */
  x: number;
  y: number;
}

/** "America/Sao_Paulo" -> "Sao Paulo" */
function formatZoneName(zone: string): string {
  const city = zone.split('/').pop() ?? zone;
  return city.replace(/_/g, ' ');
}

const cardStyle: CSSProperties = {
  position: 'absolute',
  transform: 'translate(-50%, calc(-100% - 12px))',
  background: '#1f2937',
  color: '#fff',
  padding: '8px 12px',
  borderRadius: 10,
  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
  fontSize: 13,
  lineHeight: 1.4,
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
  zIndex: 20,
};

/**
 * A small rounded-corner tooltip that follows the cursor while hovering the map,
 * showing the offset and (when available) the geographically nearest zone. Demo-only
 * pattern — not part of the published package, but a reasonable starting point for a
 * consumer building their own tooltip on top of `onTimeZoneHover`.
 */
export function Tooltip({ selection, x, y }: TooltipProps) {
  const { label, nearestTimeZone, timeZones } = selection;
  const otherCount = timeZones.length - (nearestTimeZone ? 1 : 0);

  return (
    <div style={{ ...cardStyle, left: x, top: y }}>
      <div style={{ fontWeight: 600 }}>{label}</div>
      {nearestTimeZone ? (
        <div>{formatZoneName(nearestTimeZone)}</div>
      ) : (
        <div>
          {timeZones.length} time zone{timeZones.length === 1 ? '' : 's'}
        </div>
      )}
      {nearestTimeZone && otherCount > 0 && (
        <div style={{ opacity: 0.7, fontSize: 11 }}>+{otherCount} more at this offset</div>
      )}
    </div>
  );
}
