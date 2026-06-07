'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Itinerary, TravelerProfile, HotelRecommendation, Activity,
  type CityTransportGuide,
} from '@/lib/types';
import { itineraryUi, type ItineraryUiStrings } from '@/lib/tripUiCopy';
import { type SharePanelCopy } from '@/components/SharePanel';
import { type FeedbackPayload } from '@/components/FeedbackSurveyModal';
import { type SwapResult } from '@/app/api/swap/route';
import { type ItineraryMapLabels } from '@/components/ItineraryMap';
import { hasTransportContent } from '@/components/TransportCard';
import { parseTransportGuideJson } from '@/lib/transportGuideParse';
import { STEP_BACKGROUNDS } from '@/lib/stepBackgrounds';
import { useAuth } from '@/lib/auth-context';
import { formatTripDateRange } from '@/lib/formatTripDateRange';

// ─── Public interfaces ────────────────────────────────────────────────────────

export interface UseItineraryOptions {
  initialItinerary: Itinerary;
  initialProfile: TravelerProfile | null;
  initialViewMode?: 'draft' | 'final';
  initialTransportFromDb?: CityTransportGuide | null;
  initialTripSummaryUsername?: string | null;
}

export interface UseItineraryReturn {
  // Data
  itinerary: Itinerary;
  profile: TravelerProfile | null;
  ui: ItineraryUiStrings;
  displayCityTransport: CityTransportGuide | null;
  basecampMarker: { lat: number; lng: number; label: string } | null;
  tripDatesLabel: string | null;
  shareCopy: SharePanelCopy;
  mapLabels: ItineraryMapLabels;
  transportLoading: boolean;
  isAdmin: boolean;

  // View navigation
  viewMode: 'draft' | 'final';
  setViewMode: (m: 'draft' | 'final') => void;
  selectedDayIndex: number;
  setSelectedDayIndex: (i: number) => void;

  // Background
  bgIdx: number;

  // Edit banner
  editBanner: string;

  // Hotel detail popover
  expandedHotel: HotelRecommendation | null;
  setExpandedHotel: (h: HotelRecommendation | null) => void;

  // Map / mobile
  focusedNeighborhood: string | undefined;
  mobileMapOpen: boolean;
  setMobileMapOpen: (v: boolean) => void;
  handleNeighborhoodClick: (neighborhood: string) => void;
  handleMapClose: () => void;

  // Trip Story
  tripStoryOpen: boolean;
  setTripStoryOpen: (v: boolean) => void;

  // Feedback
  feedbackOpen: boolean;
  handleFeedbackDismiss: () => void;
  handleFeedbackSubmit: (p: FeedbackPayload) => Promise<boolean>;

  // Activity mutations
  persistAndSet: (next: Itinerary) => void;
  handleSlotSwap: (
    dayIndex: number,
    slot: 'morning' | 'afternoon' | 'evening',
    request?: string,
  ) => Promise<void>;
  handleCommitActivitySwap: (
    dayIndex: number,
    slot: 'morning' | 'afternoon' | 'evening',
    replacementActivity: Activity,
    proposalSummary: string,
    diningField?: 'breakfast' | 'lunch' | 'dinner',
  ) => Promise<void>;
  handleQuickEditUpdate: (updated: Itinerary, summary: string) => void;
  handleDraftUpdate: (updated: Itinerary) => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useItinerary({
  initialItinerary,
  initialProfile,
  initialViewMode = 'draft',
  initialTransportFromDb = null,
}: UseItineraryOptions): UseItineraryReturn {
  const { session } = useAuth();

  const [itinerary, setItinerary] = useState<Itinerary>(initialItinerary);
  const [profile] = useState<TravelerProfile | null>(initialProfile);
  const [viewMode, setViewMode] = useState<'draft' | 'final'>(initialViewMode);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(-1);
  const [liveTransportFromDb, setLiveTransportFromDb] = useState<CityTransportGuide | null>(
    initialTransportFromDb ?? null,
  );
  const [transportLoading, setTransportLoading] = useState(false);
  const [editBanner, setEditBanner] = useState('');
  const [expandedHotel, setExpandedHotel] = useState<HotelRecommendation | null>(null);
  const [focusedNeighborhood, setFocusedNeighborhood] = useState<string | undefined>();
  const [mobileMapOpen, setMobileMapOpen] = useState(false);
  const [tripStoryOpen, setTripStoryOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const scoutPostedRef = useRef(false);

  useEffect(() => {
    scoutPostedRef.current = false;
  }, [itinerary.destination]);

  // Sync when props change (client-side navigation reuses instance)
  useEffect(() => {
    setItinerary(initialItinerary);
    setViewMode(initialViewMode ?? 'draft');
    setSelectedDayIndex(-1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialItinerary]);

  // Background slideshow
  const [bgIdx, setBgIdx] = useState(() => {
    const dest = (initialItinerary.destination ?? '').trim().toLowerCase();
    const match = STEP_BACKGROUNDS.findIndex((b) => b.city.toLowerCase() === dest);
    return match >= 0 ? match : 0;
  });
  useEffect(() => {
    const t = setInterval(() => setBgIdx((i) => (i + 1) % STEP_BACKGROUNDS.length), 8000);
    return () => clearInterval(t);
  }, []);

  // Transport sync
  useEffect(() => {
    setLiveTransportFromDb(initialTransportFromDb ?? null);
  }, [initialTransportFromDb]);

  const displayCityTransport = useMemo(() => {
    if (liveTransportFromDb && hasTransportContent(liveTransportFromDb)) return liveTransportFromDb;
    return itinerary.cityTransport ?? null;
  }, [liveTransportFromDb, itinerary.cityTransport]);

  const transportDataReady = useMemo(
    () => hasTransportContent(displayCityTransport),
    [displayCityTransport],
  );

  useEffect(() => {
    const city = itinerary.destination?.trim();
    if (!city || transportDataReady) { setTransportLoading(false); return; }
    setTransportLoading(true);
    let cancelled = false;

    const poll = async (): Promise<boolean> => {
      try {
        const res = await fetch(`/api/transportation?city=${encodeURIComponent(city)}`);
        const body = (await res.json()) as { guide?: unknown };
        const parsed = parseTransportGuideJson(body.guide ?? null);
        if (!cancelled && parsed && hasTransportContent(parsed)) {
          setLiveTransportFromDb(parsed);
          setTransportLoading(false);
          return true;
        }
      } catch { /* ignore */ }
      return false;
    };

    void (async () => {
      if (await poll()) return;
      if (cancelled) return;
      if (!scoutPostedRef.current) {
        scoutPostedRef.current = true;
        try {
          await fetch('/api/transportation/scout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ city, tripDays: itinerary.totalDays }),
          });
        } catch { /* ignore */ }
      }
      for (let i = 0; i < 20 && !cancelled; i++) {
        await new Promise<void>((r) => setTimeout(r, 2500));
        if (await poll()) return;
      }
      if (!cancelled) setTransportLoading(false);
    })();

    return () => { cancelled = true; };
  }, [itinerary.destination, itinerary.totalDays, transportDataReady]);

  const ui = useMemo(
    () => itineraryUi(profile?.tripLanguage === 'he' ? 'he' : 'en'),
    [profile?.tripLanguage],
  );

  const showBanner = useCallback((msg: string) => {
    setEditBanner(msg);
    setTimeout(() => setEditBanner(''), 5000);
  }, []);

  // Feedback
  const feedbackKey = useMemo(() => {
    const id = itinerary._id ?? (itinerary.destination ?? '').trim().toLowerCase();
    return id ? `sarto_feedback_${id}` : null;
  }, [itinerary._id, itinerary.destination]);

  useEffect(() => {
    if (!feedbackKey || typeof window === 'undefined') return;
    try { if (window.localStorage.getItem(feedbackKey)) return; } catch { /* ignore */ }
    const delay = 40_000 + Math.floor(Math.random() * 10_000);
    const t = setTimeout(() => setFeedbackOpen(true), delay);
    return () => clearTimeout(t);
  }, [feedbackKey]);

  const markFeedbackSeen = useCallback(() => {
    if (!feedbackKey) return;
    try { window.localStorage.setItem(feedbackKey, String(Date.now())); } catch { /* ignore */ }
  }, [feedbackKey]);

  const handleFeedbackDismiss = useCallback(() => {
    setFeedbackOpen(false);
    markFeedbackSeen();
  }, [markFeedbackSeen]);

  const handleFeedbackSubmit = useCallback(async (payload: FeedbackPayload): Promise<boolean> => {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          itineraryId: itinerary._id ?? null,
          destination: itinerary.destination ?? null,
          ...payload,
        }),
      });
      if (!res.ok) return false;
      markFeedbackSeen();
      setTimeout(() => setFeedbackOpen(false), 2200);
      return true;
    } catch { return false; }
  }, [markFeedbackSeen, session, itinerary._id, itinerary.destination]);

  // Derived
  const basecampMarker = useMemo(() => {
    if (profile?.hotelLat != null && profile?.hotelLng != null &&
        Number.isFinite(profile.hotelLat) && Number.isFinite(profile.hotelLng)) {
      return {
        lat: profile.hotelLat,
        lng: profile.hotelLng,
        label: profile.hotelAddress || profile.hotelBooked || 'Base Camp',
      };
    }
    return null;
  }, [profile]);

  const tripDatesLabel = useMemo(
    () => formatTripDateRange(profile?.startDate, profile?.endDate, ui.lang === 'he' ? 'he-IL' : 'en-US'),
    [profile?.startDate, profile?.endDate, ui.lang],
  );

  const mapLabels = useMemo((): ItineraryMapLabels => ({
    mapDistanceTool: ui.mapDistanceTool,
    mapSelectMoreHint: ui.mapSelectMoreHint,
    mapComputingRoutes: ui.mapComputingRoutes,
    mapBetween: ui.mapBetween,
    mapDirect: ui.mapDirect,
    mapWalking: ui.mapWalking,
    mapDriving: ui.mapDriving,
    mapNa: ui.mapNa,
    mapOpenGoogleTransit: ui.mapOpenGoogleTransit,
    mapClearSelection: ui.mapClearSelection,
    cityTransportGoogleRoutesDoc: ui.cityTransportGoogleRoutesDoc,
    cityTransportGoogleRoutesDocUrl: ui.cityTransportGoogleRoutesDocUrl,
  }), [ui]);

  const shareCopy = useMemo((): SharePanelCopy => ({
    openButton: ui.shareOpenButton,
    panelTitle: ui.sharePanelTitle(ui.audienceTitle(profile?.groupType)),
    whatsapp: ui.shareWhatsApp,
    whatsappSub: ui.shareWhatsAppSub(profile?.groupType),
    copyLink: ui.shareCopyLinkCta(profile?.groupType),
    copyLinkCopied: ui.shareLinkCopied,
    copyLinkSub: ui.shareCopyLinkSub,
    pdf: ui.sharePdf,
    pdfSub: ui.sharePdfSub,
    travelOsTitle: ui.shareTravelOsTitle,
    travelOsBody: ui.shareTravelOsBody,
    travelOsHint: ui.shareTravelOsHint,
  }), [ui, profile?.groupType]);

  const isAdmin = useMemo(() => {
    if (typeof document === 'undefined') return false;
    return document.cookie.split(';').some((c) => c.trim() === 'travelos_admin_ui=1');
  }, []);

  const sessionPersist = initialViewMode !== 'final';

  const persistAndSet = useCallback((updated: Itinerary) => {
    setItinerary(updated);
    if (sessionPersist) {
      try { sessionStorage.setItem('travelos_itinerary', JSON.stringify(updated)); } catch { /* ignore */ }
    }
  }, [sessionPersist]);

  const handleNeighborhoodClick = useCallback((neighborhood: string) => {
    setFocusedNeighborhood(neighborhood);
    setMobileMapOpen(true);
  }, []);

  const handleMapClose = useCallback(() => {
    setMobileMapOpen(false);
    setFocusedNeighborhood(undefined);
  }, []);

  const handleSlotSwap = useCallback(async (
    dayIndex: number,
    slot: 'morning' | 'afternoon' | 'evening',
    request?: string,
  ) => {
    const swapHeaders: HeadersInit = { 'Content-Type': 'application/json' };
    if (session?.access_token) swapHeaders.Authorization = `Bearer ${session.access_token}`;
    const res = await fetch('/api/swap', {
      method: 'POST',
      headers: swapHeaders,
      body: JSON.stringify({
        itinerary,
        itinerary_id: itinerary._id ?? undefined,
        dayIndex,
        slot,
        request: request?.trim() || `Suggest a better ${slot} activity`,
      }),
    });
    const data: SwapResult & { error?: string } = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Swap failed');
    const updatedDays = itinerary.days.map((day, i) =>
      i !== dayIndex ? day : { ...day, [slot]: data.activity },
    );
    persistAndSet({ ...itinerary, days: updatedDays });
    showBanner(data.summary);
  }, [itinerary, persistAndSet, showBanner]);

  const handleCommitActivitySwap = useCallback(async (
    dayIndex: number,
    slot: 'morning' | 'afternoon' | 'evening',
    replacementActivity: Activity,
    proposalSummary: string,
    diningField?: 'breakfast' | 'lunch' | 'dinner',
  ) => {
    const commitHeaders: HeadersInit = { 'Content-Type': 'application/json' };
    if (session?.access_token) commitHeaders.Authorization = `Bearer ${session.access_token}`;
    const res = await fetch('/api/swap', {
      method: 'POST',
      headers: commitHeaders,
      body: JSON.stringify({
        itinerary,
        itinerary_id: itinerary._id ?? undefined,
        dayIndex,
        slot,
        replacementActivity,
        proposalSummary: proposalSummary.trim() || undefined,
      }),
    });
    const data: SwapResult & { error?: string } = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Swap failed');
    const updatedDays = itinerary.days.map((day, i) => {
      if (i !== dayIndex) return day;
      const updatedDay = { ...day, [slot]: data.activity };
      if (diningField) (updatedDay as Record<string, unknown>)[diningField] = undefined;
      return updatedDay;
    });
    persistAndSet({ ...itinerary, days: updatedDays });
    showBanner(data.summary);
  }, [itinerary, persistAndSet, showBanner]);

  const handleQuickEditUpdate = useCallback((updated: Itinerary, summary: string) => {
    persistAndSet(updated);
    showBanner(summary);
  }, [persistAndSet, showBanner]);

  const handleDraftUpdate = useCallback((updated: Itinerary) => {
    persistAndSet(updated);
  }, [persistAndSet]);

  return {
    itinerary, profile, ui, displayCityTransport, basecampMarker,
    tripDatesLabel, shareCopy, mapLabels, transportLoading, isAdmin,
    viewMode, setViewMode, selectedDayIndex, setSelectedDayIndex,
    bgIdx, editBanner, expandedHotel, setExpandedHotel,
    focusedNeighborhood, mobileMapOpen, setMobileMapOpen, handleNeighborhoodClick, handleMapClose,
    tripStoryOpen, setTripStoryOpen,
    feedbackOpen, handleFeedbackDismiss, handleFeedbackSubmit,
    persistAndSet, handleSlotSwap, handleCommitActivitySwap,
    handleQuickEditUpdate, handleDraftUpdate,
  };
}
