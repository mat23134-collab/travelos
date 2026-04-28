'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

interface PhotoData {
  url: string;
  thumb: string;
  credit: string | null;
  creditUrl: string | null;
  source: 'unsplash' | 'picsum';
}

interface Props {
  query: string;
  alt: string;
  height?: number;
  dark?: boolean;
}

export function DayPhoto({ query, alt, height = 180, dark = false }: Props) {
  const [photo, setPhoto] = useState<PhotoData | null>(null);
  const [loaded, setLoaded] = useState(false);

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
        style={{ height }}
      />
    );
  }

  return (
    <div className="relative w-full overflow-hidden" style={{ height }}>
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

      {/* Unsplash credit (required by their guidelines) */}
      {photo.source === 'unsplash' && photo.credit && (
        <a
          href={photo.creditUrl ?? '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-1.5 right-2 text-[9px] text-white/50 hover:text-white/80 transition-colors"
        >
          Photo: {photo.credit} / Unsplash
        </a>
      )}
    </div>
  );
}
