'use client';

/**
 * DocumentBank — per-trip document store (passports, booking PDFs, tickets).
 * Talks to /api/trip-documents (server-side, service role + ownership check);
 * the browser never touches Storage directly. Drag-and-drop or click to upload.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

type Doc = { name: string; label: string; url: string | null; size: number | null };
type Lang = 'he' | 'en';

const COPY = {
  he: {
    title: 'המסמכים של הטיול',
    hint: 'גררו לכאן דרכונים, אישורי הזמנה וכרטיסים — או לחצו לבחירה',
    formats: 'PDF או תמונה · עד 15MB',
    uploading: 'מעלה…',
    empty: 'אין עדיין מסמכים בטיול הזה.',
    signIn: 'התחברו כדי לנהל מסמכים.',
    tooBig: 'חלק מהקבצים נדחו (סוג לא נתמך או מעל 15MB).',
    del: 'מחיקה',
  },
  en: {
    title: 'Trip documents',
    hint: 'Drag passports, booking PDFs & tickets here — or click to choose',
    formats: 'PDF or image · up to 15MB',
    uploading: 'Uploading…',
    empty: 'No documents for this trip yet.',
    signIn: 'Sign in to manage documents.',
    tooBig: 'Some files were rejected (unsupported type or over 15MB).',
    del: 'Delete',
  },
} as const;

const INK = 'var(--color-ink-warm)';
const INK_MUT = 'var(--color-ink-warm-mut)';
const ACCENT = 'var(--color-terracotta)';
const BORDER = '1px solid rgba(43,38,34,0.14)';

function prettySize(bytes: number | null): string {
  if (!bytes) return '';
  const kb = bytes / 1024;
  return kb < 1024 ? `${Math.round(kb)} KB` : `${(kb / 1024).toFixed(1)} MB`;
}

function fileIcon(label: string): string {
  return /\.pdf$/i.test(label) ? '📄' : '🖼️';
}

export function DocumentBank({
  itineraryId,
  accessToken,
  lang,
}: {
  itineraryId: string | null;
  accessToken: string | null;
  lang: Lang;
}) {
  const t = COPY[lang];
  const [docs, setDocs] = useState<Doc[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready'>('idle');
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [warn, setWarn] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const auth = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;

  const refresh = useCallback(async () => {
    if (!itineraryId || !accessToken) return;
    setStatus('loading');
    try {
      const res = await fetch(`/api/trip-documents?itineraryId=${itineraryId}`, { headers: auth });
      const data = (await res.json()) as { files?: Doc[] };
      setDocs(data.files ?? []);
    } catch { /* ignore */ }
    setStatus('ready');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itineraryId, accessToken]);

  useEffect(() => { void refresh(); }, [refresh]);

  const upload = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || !itineraryId || !accessToken) return;
    setBusy(true);
    setWarn(false);
    const form = new FormData();
    form.append('itineraryId', itineraryId);
    Array.from(fileList).forEach((f) => form.append('file', f));
    try {
      const res = await fetch('/api/trip-documents', { method: 'POST', headers: auth, body: form });
      const data = (await res.json()) as { uploaded?: number; results?: { ok: boolean }[] };
      if (data.results?.some((r) => !r.ok)) setWarn(true);
    } catch { setWarn(true); }
    setBusy(false);
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itineraryId, accessToken, refresh]);

  const remove = useCallback(async (name: string) => {
    if (!itineraryId || !accessToken) return;
    await fetch('/api/trip-documents', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify({ itineraryId, name }),
    }).catch(() => {});
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itineraryId, accessToken, refresh]);

  if (!accessToken || !itineraryId) {
    return <p className="py-10 text-center text-[13px]" style={{ color: INK_MUT }}>{t.signIn}</p>;
  }

  return (
    <div>
      <h3 className="text-[15px] font-bold mb-3" style={{ color: INK }}>{t.title}</h3>

      {/* Dropzone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); void upload(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className="rounded-2xl p-6 text-center cursor-pointer transition-colors"
        style={{
          border: `2px dashed ${dragging ? ACCENT : 'rgba(43,38,34,0.22)'}`,
          background: dragging ? 'var(--color-terracotta-soft)' : 'rgba(255,255,255,0.4)',
        }}
      >
        <div className="text-2xl mb-1">{busy ? '⏳' : '📎'}</div>
        <p className="text-[13px] font-medium" style={{ color: INK }}>
          {busy ? t.uploading : t.hint}
        </p>
        <p className="text-[11px] mt-1" style={{ color: INK_MUT }}>{t.formats}</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="application/pdf,image/*"
          className="hidden"
          onChange={(e) => void upload(e.target.files)}
        />
      </div>

      {warn && (
        <p className="mt-2 text-[11.5px]" style={{ color: 'var(--color-brand)' }}>{t.tooBig}</p>
      )}

      {/* File list */}
      <div className="mt-4 flex flex-col gap-2">
        {status === 'ready' && docs.length === 0 && (
          <p className="py-6 text-center text-[12.5px]" style={{ color: INK_MUT }}>{t.empty}</p>
        )}
        {docs.map((d) => (
          <motion.div
            key={d.name}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 p-2.5 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.6)', border: BORDER }}
          >
            <span className="text-lg shrink-0">{fileIcon(d.label)}</span>
            <a
              href={d.url ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 min-w-0"
            >
              <p className="text-[13px] font-medium truncate" style={{ color: INK }}>{d.label}</p>
              {d.size ? <p className="text-[11px]" style={{ color: INK_MUT }}>{prettySize(d.size)}</p> : null}
            </a>
            <button
              onClick={() => void remove(d.name)}
              aria-label={t.del}
              className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ color: INK_MUT }}
            >
              🗑️
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
