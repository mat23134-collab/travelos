'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { BankItem } from '@/hooks/useAttractionBank';
import type { SwapTarget } from '@/components/DayTimeline';

type Tab = 'all' | 'ai' | 'manual';

interface AttractionsBankProps {
  items: BankItem[];
  loading: boolean;
  pendingSlot: SwapTarget | null;
  onAddManual: (name: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onSchedule: (item: BankItem) => void;
  onCancelPending: () => void;
}

const SLOT_LABEL: Record<'morning' | 'afternoon' | 'evening', string> = {
  morning: 'הבוקר',
  afternoon: 'אחה"צ',
  evening: 'הערב',
};

export function AttractionsBank({ items, loading, pendingSlot, onAddManual, onRemove, onSchedule, onCancelPending }: AttractionsBankProps) {
  const [tab, setTab] = useState<Tab>('all');
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const filtered = items.filter((item) => {
    if (tab === 'ai') return item.source === 'ai';
    if (tab === 'manual') return item.source === 'manual';
    return true;
  });

  const handleAdd = async () => {
    const name = draft.trim();
    if (!name || submitting) return;
    setSubmitting(true);
    try {
      await onAddManual(name);
      setDraft('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
      {/* Header */}
      <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
        <div className="flex items-center justify-between">
          <div className="text-[13px] font-bold text-[#222]">🗂️ בנק אטרקציות</div>
          <span className="text-[11px] text-[#888]">{items.length} מקומות</span>
        </div>
        <div className="flex items-center gap-1.5 mt-2">
          <TabBtn active={tab === 'all'} onClick={() => setTab('all')}>הכל</TabBtn>
          <TabBtn active={tab === 'ai'} onClick={() => setTab('ai')}>המלצות AI</TabBtn>
          <TabBtn active={tab === 'manual'} onClick={() => setTab('manual')}>הוספתם ידנית</TabBtn>
        </div>
      </div>

      {/* Pending-slot banner */}
      <AnimatePresence>
        {pendingSlot && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-2.5 flex items-center justify-between gap-2" style={{ background: 'rgba(90,173,165,0.12)', borderBottom: '1px solid rgba(90,173,165,0.25)' }}>
              <span className="text-[12px] font-semibold" style={{ color: '#3a8a82' }}>
                בחרו מקום שיחליף את &quot;{pendingSlot.currentName}&quot; ({SLOT_LABEL[pendingSlot.slot]})
              </span>
              <button type="button" onClick={onCancelPending} className="text-[11px] font-bold flex-shrink-0" style={{ color: '#888' }}>
                ביטול
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Item list */}
      <div className="max-h-[340px] overflow-y-auto divide-y" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
        {loading && items.length === 0 && (
          <div className="px-4 py-6 text-center text-[12px] text-[#888]">טוען מקומות…</div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="px-4 py-6 text-center text-[12px] text-[#888]">
            {tab === 'manual' ? 'עוד לא הוספתם מקומות בעצמכם' : 'אין מקומות זמינים כרגע'}
          </div>
        )}
        {filtered.map((item) => (
          <BankItemCard
            key={item.id}
            item={item}
            pending={!!pendingSlot}
            onRemove={() => onRemove(item.id)}
            onSchedule={() => onSchedule(item)}
          />
        ))}
      </div>

      {/* Manual add */}
      <div className="px-4 py-3 border-t flex items-center gap-2" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
          placeholder="הוסיפו מקום בעצמכם…"
          className="flex-1 text-[12px] px-3 py-2 rounded-xl border outline-none"
          style={{ borderColor: 'rgba(0,0,0,0.12)' }}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!draft.trim() || submitting}
          className="text-[12px] font-bold px-3 py-2 rounded-xl disabled:opacity-40"
          style={{ background: '#5aada5', color: 'white' }}
        >
          הוספה
        </button>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[11px] font-bold px-2.5 py-1 rounded-full transition-colors"
      style={active
        ? { background: '#5aada5', color: 'white' }
        : { background: '#f2f2f2', color: '#888' }}
    >
      {children}
    </button>
  );
}

function BankItemCard({ item, pending, onRemove, onSchedule }: { item: BankItem; pending: boolean; onRemove: () => void; onSchedule: () => void }) {
  return (
    <div className="px-4 py-3 flex items-center gap-3">
      <span className="w-9 h-9 rounded-full flex items-center justify-center text-[15px] flex-shrink-0" style={{ background: '#e8f4f2', border: '1px solid rgba(90,173,165,0.25)' }}>
        {item.category_emoji ?? '📍'}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[12.5px] font-bold text-[#222] truncate">{item.name}</span>
          <span
            className="text-[8px] font-black px-1.5 py-0.5 rounded-full flex-shrink-0 uppercase tracking-wide"
            style={item.source === 'ai'
              ? { background: 'rgba(90,173,165,0.15)', color: '#3a8a82' }
              : { background: 'rgba(197,145,42,0.15)', color: '#b8860b' }}
          >
            {item.source === 'ai' ? 'AI' : 'שלכם'}
          </span>
        </div>
        {item.description && (
          <p className="text-[11px] text-[#888] mt-0.5 line-clamp-1">{item.description}</p>
        )}
      </div>
      {pending ? (
        <button
          type="button"
          onClick={onSchedule}
          className="text-[11px] font-bold px-2.5 py-1.5 rounded-xl flex-shrink-0"
          style={{ background: '#5aada5', color: 'white' }}
        >
          שיבוץ →
        </button>
      ) : (
        <button
          type="button"
          onClick={onRemove}
          aria-label="הסרה מהבנק"
          className="text-[14px] flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full"
          style={{ color: '#bbb' }}
        >
          ✕
        </button>
      )}
    </div>
  );
}
