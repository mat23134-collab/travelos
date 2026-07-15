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

interface Props {
  query: string;
  alt: string;
  height?: number;
  dark?: boolean;
  /** Hide the photographer credit (for faint decorative backgrounds). */
  hideCredit?: boolean;
  /** Fill the parent (which must be `position: relative`) instead of setting
   *  a fixed pixel height — for cards where a caller already controls sizing
   *  via aspect-ratio/absolute-inset CSS (e.g. destination picker tiles). */
  fill?: boolean;
}

export function DayPhoto({ query, alt, height = 180, dark = false, hideCredit = false, fill = false }: Props) {
  const [photo, setPhoto] = useState<PhotoData | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPhoto(null);
    setLoaded(false);
    fetch(`/api/photos?q=${encodeURIComponent(query)}`)
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setPhoto(data); })
      .catch(() => {}); // silently fail — UI shows gradient fallback
    return () => { cancelled = true; };
  }, [query]);

  if (!photo) {
    return (
      <div
        className={`${fill ? 'absolute inset-0 w-full h-full' : 'w-full'} animate-pulse ${dark ? 'bg-[#1a1d26]' : 'bg-gradient-to-br from-[#f0ede4] to-[#e5e0d5]'}`}
        style={fill ? undefined : { height }}
      />
    );
  }

  return (
    <div
      className={fill ? 'absolute inset-0 w-full h-full overflow-hidden' : 'relative w-full overflow-hidden'}
      style={fill ? undefined : { height }}
    >
      <Image
        src={photo.thumb || photo.url}
        alt={alt}
        fill
        sizes="(max-width: 768px) 100vw, 800px"
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
