import { useMemo, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { IANA_TIME_ZONES, TimeZonePickerMap } from '@lib';
import type { IanaTimeZoneName, TimeZoneSelection } from '@lib';
import { Tooltip } from './Tooltip';

const RESTRICTED_ZONES = [
  'America/New_York',
  'America/Los_Angeles',
  'America/St_Johns',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Kolkata',
  'Asia/Kathmandu',
  'Asia/Tokyo',
  'Australia/Eucla'
] as const;

export function App() {
  const [continentColor, setContinentColor] = useState('#55717D');
  const [backgroundColor, setBackgroundColor] = useState('#f8f9fa');
  const [timeZoneLineColor, setTimeZoneLineColor] = useState('#bababa');
  const [timeZoneLineHighlightColor, setTimeZoneLineHighlightColor] = useState('#7599a9');
  const [selectedZones, setSelectedZones] = useState<IanaTimeZoneName[]>([]);
  const [presetLabel, setPresetLabel] = useState('All');
  const [zoneFilter, setZoneFilter] = useState('');
  const [selected, setSelected] = useState<TimeZoneSelection | null>(null);
  const [hovered, setHovered] = useState<TimeZoneSelection | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  const handleMapAreaMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setMousePos({ x: event.clientX - rect.left, y: event.clientY - rect.top });
  };

  const toggleZone = (zone: IanaTimeZoneName) => {
    setPresetLabel('Custom');
    setSelectedZones((zones) =>
      zones.includes(zone) ? zones.filter((z) => z !== zone) : [...zones, zone],
    );
  };

  const filteredZones = useMemo(() => {
    const query = zoneFilter.trim().toLowerCase();
    if (!query) return IANA_TIME_ZONES;
    return IANA_TIME_ZONES.filter((zone) => zone.toLowerCase().includes(query));
  }, [zoneFilter]);

  const enabledTimeZones = selectedZones.length > 0 ? selectedZones : IANA_TIME_ZONES;

  const continents = useMemo(() => {
    const names = new Set<string>();
    for (const zone of IANA_TIME_ZONES) {
      const [continent] = zone.split('/');
      if (continent !== zone) names.add(continent);
    }
    return Array.from(names).sort();
  }, []);

  const selectContinent = (continent: string) => {
    setPresetLabel(continent);
    setSelectedZones(
      IANA_TIME_ZONES.filter((zone) => zone.startsWith(`${continent}/`)),
    );
  };

  const panelBoxStyle = {
    padding: '16px 20px',
    background: '#f8f9fa',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
  } as const;

  return (
    <div
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        padding: 24,
        //width: "100%",
        margin: '0 auto',
        color: '#1f2937',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 800,
            margin: 0,
            background: 'linear-gradient(90deg, #7599a9, #2c6a99)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          react-timezone-picker-map
        </h1>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}><IconLink
          href="https://www.npmjs.com/package/@mazmoiz/react-timezone-picker-map"
          label="View on npm"
          icon={<NpmIcon />}
          background="#cb3837"
        />
          <IconLink
            href="https://github.com/mazmoiz/react-timezone-picker-map"
            label="View on GitHub"
            icon={<GitHubIcon />}
            background="#24292e"
          /></div>

      </div>
      <p style={{ marginTop: 0, marginBottom: 20, color: '#6b7280', fontSize: 14 }}>
        Demo application demostrating all the features.
      </p>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        {/* Left panel — input props */}
        <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={panelBoxStyle}>
            <ControlGroup title="Colors">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <ColorField
                  label="Continents"
                  value={continentColor}
                  onChange={setContinentColor}
                />
                <ColorField
                  label="Background"
                  value={backgroundColor}
                  onChange={setBackgroundColor}
                />
                <ColorField
                  label="Offset lines"
                  value={timeZoneLineColor}
                  onChange={setTimeZoneLineColor}
                />
                <ColorField
                  label="Offset line highlight"
                  value={timeZoneLineHighlightColor}
                  onChange={setTimeZoneLineHighlightColor}
                />
              </div>
            </ControlGroup>
          </div>

          <div style={panelBoxStyle}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 8,
                marginBottom: 10,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                  color: '#9ca3af',
                }}
              >
                Zones — {selectedZones.length > 0 ? selectedZones.length : 'all'} enabled
              </span>
              <TextButton
                onClick={() => {
                  setPresetLabel('All');
                  setSelectedZones([]);
                }}
                tone="reset"
              >
                Reset
              </TextButton>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              <TextButton
                onClick={() => {
                  setPresetLabel('Offset Showcase');
                  setSelectedZones(RESTRICTED_ZONES.slice());
                }}
              >
                Offset showcase ({RESTRICTED_ZONES.length})
              </TextButton>
              {continents.map((continent) => (
                <TextButton key={continent} onClick={() => selectContinent(continent)}>
                  {continent}
                </TextButton>
              ))}
            </div>

            <input
              type="text"
              value={zoneFilter}
              onChange={(e) => setZoneFilter(e.target.value)}
              placeholder={'Filter zones, e.g. "America" or "Kolkata"…'}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '8px 10px',
                marginBottom: 10,
                fontSize: 13,
                border: '1px solid #d1d5db',
                borderRadius: 8,
              }}
            />

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                maxHeight: 260,
                overflowY: 'auto',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                padding: 10,
                background: '#fff',
              }}
            >
              {filteredZones.length === 0 && (
                <span style={{ fontSize: 13, color: '#9ca3af' }}>
                  No zones match “{zoneFilter}”.
                </span>
              )}
              {filteredZones.map((zone) => (
                <Checkbox
                  key={zone}
                  label={zone}
                  checked={selectedZones.includes(zone)}
                  onChange={() => toggleZone(zone)}
                />
              ))}
            </div>

            <p style={{ fontSize: 12, color: '#9ca3af', margin: '8px 0 0' }}>
              Selecting zones restricts <code>enabledTimeZones</code> — pick one and watch it
              appear on the map. Leave nothing selected to enable every zone.
            </p>
          </div>
        </div>

        {/* Middle panel — the map */}
        <div style={{ flex: 1, minWidth: 0, justifyItems: 'center' }}>
          <div
            style={{ width: '100%', position: 'relative' }}
            onMouseMove={handleMapAreaMouseMove}
            onMouseLeave={() => setMousePos(null)}
          >
            <h3 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 6px', color: '#374151' }}>
              {presetLabel.toUpperCase()} TIMEZONES
            </h3>
            <div style={panelBoxStyle}>

              <TimeZonePickerMap
                continentColor={continentColor}
                backgroundColor={backgroundColor}
                timeZoneLineColor={timeZoneLineColor}
                timeZoneLineHighlightColor={timeZoneLineHighlightColor}
                enabledTimeZones={enabledTimeZones}
                height="auto"
                onTimeZoneSelect={setSelected}
                onTimeZoneHover={setHovered}
              />

            </div>

            {hovered && mousePos && <Tooltip selection={hovered} x={mousePos.x} y={mousePos.y} />}
          </div>
        </div>

        {/* Right panel — hovered/selected values */}
        <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <JsonPanel title="Hovered" value={hovered} />
          <JsonPanel title="Selected" value={selected} />
        </div>
      </div>
    </div>
  );
}

function IconLink({
  href,
  label,
  icon,
  background,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  background: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 32,
        height: 32,
        borderRadius: 8,
        background,
        color: '#fff',
        boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
      }}
    >
      {icon}
    </a>
  );
}

function NpmIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M0 7.334v8.332h6.666V17.5h4v-1.834H24V7.334zm6.666 6.667H4.334V9.5h2.332zm5.667 0h-1.5V9.5h1.5zM17.5 9.5h1.5v4.5h-2.833V9.5z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.6.11.793-.26.793-.577v-2.017c-3.338.726-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.84 1.237 1.84 1.237 1.07 1.834 2.809 1.304 3.495.997.108-.775.42-1.304.762-1.604-2.665-.303-5.466-1.332-5.466-5.93 0-1.31.469-2.381 1.236-3.221-.124-.303-.536-1.523.117-3.176 0 0 1.008-.322 3.301 1.23A11.5 11.5 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.655 1.653.243 2.873.12 3.176.77.84 1.235 1.911 1.235 3.221 0 4.61-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

function ControlGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          color: '#9ca3af',
        }}
      >
        {title}
      </span>
      {children}
    </div>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 14,
        cursor: 'pointer',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ margin: 0, flexShrink: 0, cursor: 'pointer' }}
      />
      <span style={{ overflowWrap: 'anywhere' }}>{label}</span>
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 14,
        cursor: 'pointer',
      }}
    >
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ margin: 0, width: 28, height: 28, padding: 0, border: 'none', cursor: 'pointer' }}
      />
      {label}
    </label>
  );
}

function TextButton({
  children,
  onClick,
  tone = 'default',
}: {
  children: ReactNode;
  onClick: () => void;
  tone?: 'default' | 'reset';
}) {
  const isReset = tone === 'reset';
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontSize: 12,
        fontWeight: 500,
        color: isReset ? '#b91c1c' : '#374151',
        background: isReset ? '#fef2f2' : '#fff',
        border: `1px solid ${isReset ? '#fecaca' : '#d1d5db'}`,
        borderRadius: 6,
        padding: '4px 10px',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function JsonPanel({ title, value }: { title: string; value: unknown }) {
  return (
    <div>
      <h3 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 6px', color: '#374151' }}>
        {title}
      </h3>
      <pre
        style={{
          // Fixed height (not min-height) — this updates on every pointermove while
          // hovering the map, so a size that tracked content would constantly resize
          // the panel and cause layout jank.
          height: 220,
          margin: 0,
          padding: 12,
          background: '#f8f9fa',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          fontSize: 12,
          lineHeight: 1.5,
          color: '#374151',
          overflow: 'auto',
          boxSizing: 'border-box',
        }}
      >
        {value ? JSON.stringify(value, null, 2) : 'none'}
      </pre>
    </div>
  );
}
