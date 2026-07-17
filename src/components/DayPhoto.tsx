'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

interface PhotoData {
  url: string;
  thumb: string;
  credit: string | null;
  creditUrl: string | null;
  source: 'unsplash' | 'picsum' | 'pexels';
}

/** Supported card frame ratios (width / height). */
type PhotoRatio = '3/2' | '16/9' | '1/1' | '4/5';

interface Props {
  query: string;
  alt: string;
  /**
   * Fixed pixel height. Used when `ratio` is not set (backwards-compatible
   * default). Prefer `ratio` for display cards so the frame scales with width.
   */
  height?: number;
  /**
   * Aspect ratio for the frame. When set, overrides `height` and lets the
   * image box scale proportionally with its container width.
   */
  ratio?: PhotoRatio;
  /** CSS `object-position` focal point, e.g. `'50% 30%'` to keep the top in frame. */
  focus?: string;
  dark?: boolean;
  /** Hide the photographer credit (for faint decorative backgrounds). */
  hideCredit?: boolean;
}

export function DayPhoto({
  query,
  alt,
  height = 180,
  ratio,
  focus = '50% 50%',
  dark = false,
  hideCredit = false,
}: Props) {
  const [photo, setPhoto] = useState<PhotoData | null>(null);
  const [loaded, setLoaded] = useState(false);

  // `ratio` (aspect-ratio box) takes precedence over the legacy fixed `height`.
  const frameStyle = ratio ? { aspectRatio: ratio.replace('/', ' / ') } : { height };

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/photos?q=${encodeURIComponent(query)}`)
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setPhoto(data); })
      .catch(() => {}); // silently fail — UI shows gradient fallback
    return () => { cancelled = true; };
  }, [query]);

  if (!photo) {
    return (
      <div
        className={`w-full animate-pulse ${dark ? 'bg-[#1a1d26]' : 'bg-gradient-to-br from-[#f0ede4] to-[#e5e0d5]'}`}
        style={frameStyle}
      />
    );
  }

  return (
    <div className="relative w-full overflow-hidden" style={frameStyle}>
      <Image
        src={photo.thumb || photo.url}
        alt={alt}
        fill
        sizes="(max-width: 768px) 100vw, 800px"
        style={{ objectPosition: focus }}
        className={`object-cover transition-opacity duration-700 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setLoaded(true)}
        loading="lazy"
        unoptimized={photo.source === 'picsum'} // Picsum returns dynamic URLs
      />
      {/* Gradient overlay so text above it remains readable */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

      {/* Photographer attribution (required by Unsplash & Pexels) */}
      {!hideCredit && photo.credit && (photo.source === 'unsplash' || photo.source === 'pexels') && (
        <a
          href={photo.creditUrl ?? '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-1.5 right-2 text-[9px] text-white/50 hover:text-white/80 transition-colors"
        >
          Photo: {photo.credit} / {photo.source === 'pexels' ? 'Pexels' : 'Unsplash'}
        </a>
      )}
    </div>
  );
}
