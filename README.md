# @mazmoiz/react-timezone-picker-map

An interactive React world map for picking a time zone. Click or tap anywhere on
the map and get back the real IANA time zone at that location — no dropdowns, no
searching through a long list of city names.

![Screenshot of the TimeZonePickerMap component](dev/images/component-screenshot.png)

## Features

- **Click-to-select world map** — pick a time zone visually, by clicking where a
  location actually is on the map.
- **Complete time zone coverage** — every real-world UTC offset is represented,
  including half-hour and 45-minute offsets (India, Nepal, Chatham Islands, etc.),
  not just whole hours.
- **Accurate nearest-zone detection** — clicking a busy offset line (e.g. UTC-3
  covers ~28 zones) resolves to the specific zone geographically closest to the
  cursor, not just a generic list.
- **Restrict selectable zones** — limit the picker to a specific subset of time
  zones (e.g. only the ones your app supports) via a simple prop.
- **Country highlight** — the country under the cursor/tap is outlined with a
  border, but only when doing so is actually consistent with the time zone that
  click would select — see [Good to know](#good-to-know) for why it can stay quiet
  near certain offset boundaries.
- **Fully customizable look** — colors for the continents, background, and
  offset lines (including their hover/focus highlight) are all configurable.
- **Responsive by design** — resizes freely with its container without ever
  stretching or distorting the map.
- **Geographically accurate** — built from real world map data, so the time zone
  lines always line up correctly with the landmasses beneath them.
- **TypeScript-first** — full type definitions included, ESM and CJS builds, no
  runtime dependencies beyond `react`/`react-dom`.

## Demo

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/edit/vitejs-vite-rc9m8ykm?file=src%2FApp.tsx&showSidebar=0)

## Install

```sh
npm install @mazmoiz/react-timezone-picker-map
```

`react` and `react-dom` (`^18` or `^19`) are peer dependencies.

## Usage

```tsx
import { TimeZonePickerMap } from '@mazmoiz/react-timezone-picker-map';

function App() {
  return (
    <div style={{ width: '100%', height: 500 }}>
      <TimeZonePickerMap
        onTimeZoneSelect={(selection) => {
          console.log(selection.label, selection.nearestTimeZone, selection.timeZones);
        }}
      />
    </div>
  );
}
```

### Restricting selectable time zones

```tsx
<TimeZonePickerMap
  enabledTimeZones={['America/New_York', 'Europe/London', 'Asia/Kolkata']}
  onTimeZoneSelect={(selection) => setTimeZone(selection.timeZones[0])}
/>
```

A line is only rendered if at least one enabled zone matches its offset — so the
grid visually trims down to what's actually selectable.

### Reacting to hover

```tsx
const [hovered, setHovered] = useState<TimeZoneSelection | null>(null);

<TimeZonePickerMap
  onTimeZoneHover={setHovered}
  onTimeZoneSelect={(selection) => setTimeZone(selection.timeZones[0])}
/>;

{
  hovered && (
    <p>
      {hovered.label} — {hovered.nearestTimeZone ?? `${hovered.timeZones.length} zones`}
    </p>
  );
}
```

`onTimeZoneHover` fires on mouse hover and keyboard focus, and clears back to `null`
on mouse leave/blur.

### Highlighting the country under the cursor

```tsx
<TimeZonePickerMap
  countryHighlightFillColor="#2563EB40"
  countryHighlightBorderColor="#2563EB"
  onCountryHover={(country) => setStatusText(country ? `Pointing at ${country.name}` : '')}
/>
```

`countryHighlightFillColor` uses an 8-digit hex value — the trailing `40` is an alpha
channel (~25% opacity) — so the fill stays translucent instead of hiding the map
underneath. See [Good to know](#good-to-know) for why `onCountryHover` can legitimately
stay `null` even while hovering a landmass, near certain offset boundaries.

### Customizing colors

```tsx
<TimeZonePickerMap
  continentColor="#334155"
  backgroundColor="#0f172a"
  timeZoneLineColor="#475569"
  timeZoneLineHighlightColor="#38bdf8"
/>
```

A quick dark-theme example — every fill/line/highlight color is a separate prop, so
restyling the whole map is a handful of hex values, not a theming system to learn.

## Props

| Prop                          | Type                                             | Default        | Description                                                              |
| ----------------------------- | ------------------------------------------------ | -------------- | ------------------------------------------------------------------------ |
| `width`                       | `string \| number`                               | `'100%'`       | Width of the map (applied to the root `<svg>`).                          |
| `height`                      | `string \| number`                               | `'100%'`       | Height of the map (applied to the root `<svg>`).                        |
| `className`                   | `string`                                         | —              | Applied to the root `<svg>`.                                             |
| `style`                       | `CSSProperties`                                  | —              | Applied to the root `<svg>`.                                             |
| `continentColor`              | `string`                                         | `'#55717D'`    | Fill color for the continents.                                           |
| `backgroundColor`             | `string`                                         | `'#fff'`       | Fill color for the water/background.                                     |
| `timeZoneLineColor`           | `string`                                         | `'#9AA5B1'`    | Color of the vertical UTC-offset lines.                                  |
| `timeZoneLineHighlightColor`  | `string`                                         | `'#2563EB'`    | Color of a UTC-offset line while hovered or keyboard-focused.            |
| `countryHighlightFillColor`   | `string`                                         | `'rgba(37, 99, 235, 0.25)'` | Fill color for the highlighted country under the cursor/tap. |
| `countryHighlightBorderColor` | `string`                                         | `'#2563EB'`    | Border color for the highlighted country under the cursor/tap.           |
| `enabledTimeZones`            | `readonly IanaTimeZoneName[]`                    | all IANA zones | Subset of zones the consumer wants selectable.                           |
| `onTimeZoneSelect`            | `(selection: TimeZoneSelection) => void`         | —              | Fired on click/tap or Enter/Space on a focused line.                     |
| `onTimeZoneHover`             | `(selection: TimeZoneSelection \| null) => void` | —              | Fired on hover/focus (`selection`) and on leave/blur (`null`).           |
| `onCountryHover`              | `(country: CountryInfo \| null) => void`         | —              | Fired on hover/tap for the country under the cursor — see below.         |

`TimeZoneSelection` shape:

```ts
interface TimeZoneSelection {
  offsetMinutes: number; // e.g. 330 for UTC+5:30
  label: string; // "UTC-12" .. "UTC+14", e.g. "UTC+5:30", "UTC+12:45"
  timeZones: readonly string[]; // enabled IANA zones whose standard offset is this
  nearestTimeZone: string | null; // whichever of timeZones is geographically closest
  // to the exact hover/click position; null for keyboard activation (no cursor
  // position) or if none of timeZones has a known coordinate.
}
```

`CountryInfo` shape:

```ts
interface CountryInfo {
  id: string; // ISO 3166-1 numeric code (as a string), e.g. '724' for Spain
  name: string; // e.g. 'Spain'
}
```

## Good to know

- **Zones are grouped by their standard (non-DST) offset**, so a zone always sits
  at its true geographic position year-round — it doesn't jump lines when
  daylight saving time shifts its current offset.
- **A few zones (Chatham Islands, Tonga, Samoa, Kiribati) sit beyond UTC+12** and
  are shown in a small extended strip past the map's right edge.
- The map resizes freely with its container without ever stretching or distorting
  — extra space is simply left blank rather than warping the continents.
- **The country highlight is timezone-aware by design and will not appear for every
  landmass under the cursor.** It only appears when the hovered country's own real
  IANA zone is consistent with the offset that click would actually select —
  otherwise it stays quiet rather than showing a country next to a contradictory
  result. Concretely: **Spain** is administratively UTC+1 (`Europe/Madrid`) but sits
  geographically closer to the UTC+0 band, so on a default (unrestricted) map,
  hovering mainland Spain resolves to the UTC+0 line — the highlight correctly does
  not appear there, rather than showing "Spain" next to a UK/Portugal-side result.
  This is a property of offset-line-based picking in general, not something the
  highlight introduces — it's just newly *visible* now that there's a country name to
  compare against.
- **Countries that share a zone with a neighbor still highlight normally** — this is
  the common case, not the exception above. Many small countries have no IANA zone of
  their own and inherit a bigger neighbor's rules (e.g. Benin and Cameroon both use
  `Africa/Lagos`, Nigeria's zone); hovering them still correctly highlights and
  reports, since that inherited zone genuinely is their real one.
- **`onCountryHover`/the highlight respect `enabledTimeZones`** — a country whose
  zone(s) are entirely excluded by a restricted `enabledTimeZones` will never
  highlight, consistent with how offset lines already hide when nothing on them is
  selectable.
- **Antarctica is deliberately excluded from the country highlight.** It does have
  real IANA zone data (dedicated `Antarctica/*` research-station zones, some of which
  are themselves aliases of a supply nation's zone, e.g. McMurdo Station uses
  Auckland's time) and would otherwise highlight like any real country — it's left
  out because it has no permanent civilian population and isn't a meaningful "pick
  your country" target for most consumers of this picker. `Antarctica/*` zones remain
  fully selectable via the map's offset lines as normal; only the country highlight
  ignores it.

## License

MIT
