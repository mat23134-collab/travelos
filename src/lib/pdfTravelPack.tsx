'use client';

/**
 * pdfTravelPack — Sarto "Editorial Light" PDF travel pack.
 *
 * Produces a real, text-selectable, offline PDF (cover → day-by-day with a
 * schematic day-map + photos → where-to-eat → packing/local tips) using
 * @react-pdf/renderer. Generated entirely client-side and downloaded as a
 * Blob, mirroring the dependency-light UX of icsExport / kmlExport.
 *
 * Maps are drawn schematically from each activity's lat/long (no Mapbox token
 * required); photos are fetched via the existing /api/photos endpoint and
 * embedded as data URLs, with a styled placeholder when a photo is missing.
 */

import {
  Document, Page, View, Text, Image, StyleSheet,
  Svg, Rect, Line, Circle, pdf,
} from '@react-pdf/renderer';
import type { Activity, DiningSpot, DayPlan, Itinerary, TravelerProfile } from '@/lib/types';

// ── palette ────────────────────────────────────────────────────────────────
const PAPER = '#fbf9f4';
const WINE = '#9e363a';
const WINEDK = '#7d2b2f';
const INK = '#1f2937';
const MUTED = '#6b7280';
const FAINT = '#9ca3af';
const RULE = '#d8d2c4';
const TINT = '#f3eee2';
const MAPBG = '#f1ece0';
const MAPGRID = '#e6dfce';
const MAPPARK = '#e6efe4';
const MAPWATER = '#e3ecf1';
const ROUTE = '#c98a8d';
const PHOTOBG = '#e9e3d6';

const SERIF = 'Times-Roman';
const SERIF_B = 'Times-Bold';
const SERIF_I = 'Times-Italic';
const SANS = 'Helvetica';
const SANS_B = 'Helvetica-Bold';

const PAGE_PAD_X = 44;
const CONTENT = 595.28 - PAGE_PAD_X * 2; // A4 width minus horizontal padding
const MAP_H = 120;
const THUMB_W = 92;
const THUMB_H = 68;

const s = StyleSheet.create({
  page: { backgroundColor: PAPER, paddingTop: 54, paddingBottom: 46, paddingHorizontal: PAGE_PAD_X, fontFamily: SERIF, color: INK },
  kicker: { fontFamily: SANS_B, fontSize: 8.5, color: WINE, letterSpacing: 2 },
  title: { fontFamily: SERIF_B, fontSize: 34, color: WINEDK, marginTop: 10 },
  subtitle: { fontFamily: SANS, fontSize: 10.5, color: MUTED, marginTop: 4 },
  overview: { fontFamily: SERIF_I, fontSize: 11, color: INK, lineHeight: 1.55, marginTop: 14 },
  rule: { borderBottomWidth: 0.6, borderBottomColor: RULE, marginVertical: 14 },
  budgetRow: { flexDirection: 'row', borderTopWidth: 0.6, borderTopColor: RULE, borderBottomWidth: 0.6, borderBottomColor: RULE, paddingVertical: 8, marginTop: 16 },
  budgetCell: { paddingRight: 10 },
  budLabel: { fontFamily: SANS_B, fontSize: 7, color: WINE, letterSpacing: 1.2 },
  budVal: { fontFamily: SERIF, fontSize: 11, color: INK, marginTop: 3 },
  budInc: { fontFamily: SERIF, fontSize: 8.5, color: MUTED, marginTop: 3, lineHeight: 1.3 },

  dayTitle: { fontFamily: SERIF_B, fontSize: 17, color: INK, marginTop: 4 },
  dayTheme: { fontFamily: SERIF_I, fontSize: 12, color: WINE, marginTop: 2 },
  dayDate: { fontFamily: SANS, fontSize: 8.5, color: FAINT, letterSpacing: 1, marginTop: 3 },
  wineRule: { borderBottomWidth: 1, borderBottomColor: WINE, marginTop: 8, marginBottom: 10 },

  noteBox: { backgroundColor: TINT, paddingVertical: 7, paddingHorizontal: 10, marginBottom: 14 },
  noteText: { fontSize: 8.5, lineHeight: 1.45 },

  slotRow: { flexDirection: 'row', marginBottom: 13 },
  thumb: { width: THUMB_W, height: THUMB_H, marginRight: 12 },
  thumbImg: { width: THUMB_W, height: THUMB_H, objectFit: 'cover', borderWidth: 0.6, borderColor: RULE },
  thumbPh: { width: THUMB_W, height: THUMB_H, backgroundColor: PHOTOBG, borderWidth: 0.6, borderColor: RULE, alignItems: 'center', justifyContent: 'center' },
  phText: { fontFamily: SANS_B, fontSize: 6.5, color: FAINT, letterSpacing: 1 },
  slotBody: { flex: 1 },
  slotLbl: { fontFamily: SANS_B, fontSize: 8, color: WINE, letterSpacing: 1.5 },
  slotTime: { fontFamily: SANS, fontSize: 8, color: FAINT },
  aName: { fontFamily: SERIF_B, fontSize: 12, color: INK, marginTop: 3 },
  aMeta: { fontFamily: SANS, fontSize: 8, color: MUTED, marginTop: 2 },
  aDesc: { fontFamily: SERIF, fontSize: 9.5, color: INK, lineHeight: 1.4, marginTop: 4 },
  aWhy: { fontFamily: SERIF_I, fontSize: 9, color: MUTED, lineHeight: 1.35, marginTop: 5, paddingLeft: 10 },

  eatHead: { fontFamily: SANS_B, fontSize: 8, color: WINE, letterSpacing: 1.5, marginTop: 8, marginBottom: 8 },
  meal: { fontFamily: SERIF, fontSize: 9.5, color: INK, marginBottom: 2, lineHeight: 1.35 },
  mealTry: { fontFamily: SERIF_I, fontSize: 9, color: MUTED, marginBottom: 5 },

  sect: { fontFamily: SERIF_B, fontSize: 13, color: WINEDK, marginTop: 6 },
  bullet: { flexDirection: 'row', marginBottom: 4 },
  bulletDot: { width: 10, fontFamily: SERIF, fontSize: 9.5, color: WINE },
  bulletText: { flex: 1, fontFamily: SERIF, fontSize: 9.5, color: INK, lineHeight: 1.4 },

  footer: { position: 'absolute', bottom: 26, left: PAGE_PAD_X, right: PAGE_PAD_X, borderTopWidth: 0.6, borderTopColor: RULE, paddingTop: 6, flexDirection: 'row', justifyContent: 'space-between' },
  footText: { fontFamily: SANS, fontSize: 7.5, color: FAINT, letterSpacing: 0.5 },

  // map overlay text
  mapWrap: { position: 'relative', height: MAP_H, marginBottom: 14 },
  mapTag: { position: 'absolute', top: 6, left: 8, fontFamily: SANS_B, fontSize: 7.5, color: WINE },
  mapLegend: { position: 'absolute', top: 7, right: 8, fontFamily: SANS, fontSize: 6.5, color: MUTED },
  pinNum: { position: 'absolute', fontFamily: SANS_B, fontSize: 8, color: '#ffffff', width: 16, textAlign: 'center' },
  pinLbl: { position: 'absolute', fontFamily: SANS, fontSize: 7, color: INK },
});

const PINSETS: Array<Array<[number, number]>> = [
  [[0.15, 0.62], [0.5, 0.32], [0.82, 0.6]],
  [[0.2, 0.36], [0.55, 0.7], [0.8, 0.42]],
  [[0.18, 0.56], [0.48, 0.26], [0.83, 0.62]],
];

function shortName(name: string): string {
  return name.split(' — ')[0].split(' (')[0].split(':')[0].trim();
}

type Pin = { x: number; y: number; label: string };

/** Build pin positions: normalize real coords when all present, else fallback. */
function dayPins(day: DayPlan, dayIndex: number): Pin[] {
  const slots = (['morning', 'afternoon', 'evening'] as const)
    .map((k) => day[k])
    .filter((a): a is Activity => !!a);
  const labels = slots.map((a) => shortName(a.name));
  const haveCoords = slots.length > 0 && slots.every(
    (a) => typeof a.latitude === 'number' && typeof a.longitude === 'number' && !(a.latitude === 0 && a.longitude === 0),
  );

  const px = (nx: number) => 8 + nx * (CONTENT - 16);
  const py = (ny: number) => 8 + ny * (MAP_H - 16);

  if (haveCoords) {
    const lats = slots.map((a) => a.latitude as number);
    const lons = slots.map((a) => a.longitude as number);
    const minLa = Math.min(...lats), maxLa = Math.max(...lats);
    const minLo = Math.min(...lons), maxLo = Math.max(...lons);
    const spanLa = maxLa - minLa || 1, spanLo = maxLo - minLo || 1;
    return slots.map((a, i) => ({
      x: px(0.12 + 0.76 * (((a.longitude as number) - minLo) / spanLo)),
      // invert lat so north is up
      y: py(0.12 + 0.76 * (1 - ((a.latitude as number) - minLa) / spanLa)),
      label: labels[i],
    }));
  }

  const set = PINSETS[dayIndex % PINSETS.length];
  return labels.slice(0, 3).map((label, i) => ({ x: px(set[i][0]), y: py(set[i][1]), label }));
}

function DayMap({ pins }: { pins: Pin[] }) {
  const grid = (() => {
    const lines: React.ReactNode[] = [];
    for (let i = 1; i < 7; i++) lines.push(<Line key={`v${i}`} x1={(CONTENT * i) / 7} y1={0} x2={(CONTENT * i) / 7} y2={MAP_H} stroke={MAPGRID} strokeWidth={0.4} />);
    for (let j = 1; j < 4; j++) lines.push(<Line key={`h${j}`} x1={0} y1={(MAP_H * j) / 4} x2={CONTENT} y2={(MAP_H * j) / 4} stroke={MAPGRID} strokeWidth={0.4} />);
    return lines;
  })();
  return (
    <View style={s.mapWrap}>
      <Svg width={CONTENT} height={MAP_H} style={{ position: 'absolute', top: 0, left: 0 }}>
        <Rect x={0} y={0} width={CONTENT} height={MAP_H} fill={MAPBG} stroke={RULE} strokeWidth={0.6} />
        <Rect x={0} y={0} width={CONTENT} height={MAP_H * 0.16} fill={MAPWATER} />
        <Rect x={CONTENT * 0.05} y={MAP_H * 0.5} width={CONTENT * 0.22} height={MAP_H * 0.4} fill={MAPPARK} />
        <Rect x={CONTENT * 0.62} y={MAP_H * 0.08} width={CONTENT * 0.3} height={MAP_H * 0.42} fill={MAPPARK} />
        {grid}
        {pins.slice(0, -1).map((p, i) => (
          <Line key={`r${i}`} x1={p.x} y1={p.y} x2={pins[i + 1].x} y2={pins[i + 1].y} stroke={ROUTE} strokeWidth={1.6} strokeDasharray="3 2" />
        ))}
        {pins.map((p, i) => (
          <Circle key={`c${i}`} cx={p.x} cy={p.y} r={8} fill={WINE} />
        ))}
      </Svg>
      <Text style={s.mapTag}>DAY MAP</Text>
      <Text style={s.mapLegend}>1 Morning   2 Afternoon   3 Evening</Text>
      {pins.map((p, i) => (
        <Text key={`n${i}`} style={[s.pinNum, { left: p.x - 8, top: p.y - 4 }]}>{i + 1}</Text>
      ))}
      {pins.map((p, i) => {
        const left = p.x < CONTENT * 0.7;
        return (
          <Text key={`l${i}`} style={[s.pinLbl, left ? { left: p.x + 12 } : { right: CONTENT - p.x + 12 }, { top: p.y - 3.5, maxWidth: 150 }]}>
            {p.label.length < 26 ? p.label : p.label.slice(0, 24) + '…'}
          </Text>
        );
      })}
    </View>
  );
}

function Thumb({ src, alt }: { src?: string | null; alt: string }) {
  if (src) return <View style={s.thumb}><Image src={src} style={s.thumbImg} /></View>;
  return <View style={s.thumb}><View style={s.thumbPh}><Text style={s.phText}>PHOTO</Text></View></View>;
}

function Slot({ label, activity, photo }: { label: string; activity: Activity; photo?: string | null }) {
  const meta = [activity.neighborhood, activity.duration, activity.estimatedCost].filter(Boolean).join('   ·   ');
  const time = activity.startTime && activity.endTime ? `${activity.startTime} – ${activity.endTime}` : '';
  return (
    <View style={s.slotRow} wrap={false}>
      <Thumb src={photo} alt={activity.name} />
      <View style={s.slotBody}>
        <Text>
          <Text style={s.slotLbl}>{label}</Text>
          {time ? <Text style={s.slotTime}>{`   ${time}`}</Text> : null}
        </Text>
        <Text style={s.aName}>{activity.name}</Text>
        {meta ? <Text style={s.aMeta}>{meta}</Text> : null}
        {activity.description ? <Text style={s.aDesc}>{activity.description}</Text> : null}
        {activity.whyThis ? <Text style={s.aWhy}>{`— “${activity.whyThis}”`}</Text> : null}
      </View>
    </View>
  );
}

function Meal({ label, spot }: { label: string; spot: DiningSpot }) {
  const sub = [spot.cuisine, spot.priceRange].filter(Boolean).join(' · ');
  return (
    <View>
      <Text style={s.meal}>
        <Text style={{ fontFamily: SANS_B, fontSize: 7.5, color: WINE }}>{label}  </Text>
        <Text style={{ fontFamily: SERIF_B }}>{spot.name}</Text>
        {sub ? <Text style={{ color: MUTED, fontSize: 8.5 }}>{`  · ${sub}`}</Text> : null}
      </Text>
      {spot.mustTry ? <Text style={s.mealTry}>{`Try: ${spot.mustTry}`}</Text> : null}
    </View>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={s.bullet} wrap={false}>
      <Text style={s.bulletDot}>•</Text>
      <Text style={s.bulletText}>{text}</Text>
    </View>
  );
}

export type TravelPackMedia = { hero?: string | null; photos?: Record<string, string | null> };

export function TravelPackDocument({ itinerary, profile, media }: { itinerary: Itinerary; profile?: TravelerProfile | null; media?: TravelPackMedia }) {
  const days = itinerary.days ?? [];
  const hotel = itinerary.basecamp?.type === 'booked'
    ? itinerary.basecamp.booked?.name
    : itinerary.basecamp?.recommendations?.[0]?.name;
  const sub = [
    `${itinerary.totalDays}-day trip`,
    hotel ? `staying at ${hotel}` : null,
    profile?.groupType ? `${profile.groupType}, ${profile.pace ?? ''} pace`.trim() : null,
  ].filter(Boolean).join('  ·  ');
  const b = itinerary.budgetSummary;
  const photos = media?.photos ?? {};

  return (
    <Document title={`Sarto · ${itinerary.destination} itinerary`} author="Sarto">
      <Page size="A4" style={s.page}>
        <Text style={s.kicker}>SARTO  ·  ITINERARY</Text>
        <Text style={s.title}>{itinerary.destination}</Text>
        <Text style={s.subtitle}>{sub}</Text>
        <View style={{ marginTop: 12 }}>
          <Thumb src={media?.hero} alt={`${itinerary.destination} cover`} />
        </View>
        {itinerary.strategicOverview ? <Text style={s.overview}>{itinerary.strategicOverview}</Text> : null}
        {b ? (
          <View style={s.budgetRow}>
            <View style={[s.budgetCell, { width: '24%' }]}>
              <Text style={s.budLabel}>DAILY AVERAGE</Text>
              <Text style={s.budVal}>{b.dailyAverage ?? '—'}</Text>
            </View>
            <View style={[s.budgetCell, { width: '24%' }]}>
              <Text style={s.budLabel}>TRIP ESTIMATE</Text>
              <Text style={s.budVal}>{b.totalEstimate ?? '—'}</Text>
            </View>
            <View style={[s.budgetCell, { width: '52%' }]}>
              <Text style={s.budLabel}>INCLUDES</Text>
              <Text style={s.budInc}>{b.includes ?? ''}</Text>
            </View>
          </View>
        ) : null}

        {days.map((day, di) => (
          <View key={day.day} style={{ marginTop: 22 }}>
            <View wrap={false}>
              <Text style={s.dayTitle}>{`Day ${day.day}`}</Text>
              <Text style={s.dayTheme}>{day.theme ?? ''}</Text>
              {day.date ? <Text style={s.dayDate}>{day.date.toUpperCase()}</Text> : null}
              <View style={s.wineRule} />
              <DayMap pins={dayPins(day, di)} />
            </View>
            {day.transportTip ? (
              <View style={s.noteBox}>
                <Text style={s.noteText}>
                  <Text style={{ fontFamily: SANS_B, fontSize: 7.5, color: WINE }}>GETTING AROUND  </Text>
                  <Text style={{ color: MUTED }}>{day.transportTip}</Text>
                </Text>
              </View>
            ) : null}
            {day.morning ? <Slot label="MORNING" activity={day.morning} photo={photos[`${di}-morning`]} /> : null}
            {day.afternoon ? <Slot label="AFTERNOON" activity={day.afternoon} photo={photos[`${di}-afternoon`]} /> : null}
            {day.evening ? <Slot label="EVENING" activity={day.evening} photo={photos[`${di}-evening`]} /> : null}
            {(day.breakfast || day.lunch || day.dinner) ? (
              <View>
                <View style={s.rule} />
                <Text style={s.eatHead}>WHERE TO EAT</Text>
                {day.breakfast ? <Meal label="BREAKFAST" spot={day.breakfast} /> : null}
                {day.lunch ? <Meal label="LUNCH" spot={day.lunch} /> : null}
                {day.dinner ? <Meal label="DINNER" spot={day.dinner} /> : null}
              </View>
            ) : null}
          </View>
        ))}

        {itinerary.packingTips?.length ? (
          <View style={{ marginTop: 24 }} wrap={false}>
            <Text style={s.sect}>Packing list</Text>
            <View style={s.rule} />
            {itinerary.packingTips.map((t, i) => <Bullet key={i} text={t} />)}
          </View>
        ) : null}
        {itinerary.bestLocalTips?.length ? (
          <View style={{ marginTop: 18 }} wrap={false}>
            <Text style={s.sect}>Local tips</Text>
            <View style={s.rule} />
            {itinerary.bestLocalTips.map((t, i) => <Bullet key={i} text={t} />)}
          </View>
        ) : null}

        <View style={s.footer} fixed>
          <Text style={s.footText}>{`SARTO  ·  ${itinerary.destination.toUpperCase()} ITINERARY`}</Text>
          <Text style={s.footText} render={({ pageNumber }) => `${pageNumber}`} />
        </View>
      </Page>
    </Document>
  );
}

// ── photo fetching (best-effort; failures degrade to placeholders) ───────────
async function toDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const fr = new FileReader();
      fr.onloadend = () => resolve(typeof fr.result === 'string' ? fr.result : null);
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    });
  } catch { return null; }
}

async function fetchPhoto(query: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/photos?q=${encodeURIComponent(query)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { thumb?: string; url?: string };
    const src = data.thumb ?? data.url;
    return src ? await toDataUrl(src) : null;
  } catch { return null; }
}

async function gatherMedia(itinerary: Itinerary): Promise<TravelPackMedia> {
  const dest = itinerary.destination;
  const jobs: Array<Promise<void>> = [];
  const photos: Record<string, string | null> = {};
  let hero: string | null = null;

  jobs.push(fetchPhoto(`${dest} cityscape travel`).then((u) => { hero = u; }));
  (itinerary.days ?? []).forEach((day, di) => {
    (['morning', 'afternoon', 'evening'] as const).forEach((slot) => {
      const a = day[slot];
      if (!a) return;
      jobs.push(fetchPhoto(`${a.name} ${a.neighborhood ?? ''} ${dest}`).then((u) => { photos[`${di}-${slot}`] = u; }));
    });
  });
  await Promise.all(jobs);
  return { hero, photos };
}

/**
 * Builds the Editorial Light PDF and triggers a browser download.
 * Client-side only. Photos are best-effort; the document still renders if
 * the network is unavailable (placeholders are used instead).
 */
export async function downloadItineraryPDF(itinerary: Itinerary, profile?: TravelerProfile | null): Promise<void> {
  let media: TravelPackMedia = {};
  try { media = await gatherMedia(itinerary); } catch { /* placeholders */ }

  const blob = await pdf(<TravelPackDocument itinerary={itinerary} profile={profile} media={media} />).toBlob();
  const url = URL.createObjectURL(blob);
  const safeName = itinerary.destination.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'trip';
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName}-sarto-itinerary.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
