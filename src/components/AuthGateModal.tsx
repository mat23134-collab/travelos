'use client';

import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

const NIGHT_2 = '#0f1c2e';
const REDLINE = '#e2543c';
const MUTED = 'rgba(255,255,255,0.55)';

interface Props {
  open: boolean;
  onCancel: () => void;
  title?: string;
  message?: string;
}

/**
 * Shared "please sign in" gate — same look as the homepage's auth gate.
 * Used anywhere an action (creating a trip, editing a trip, etc.) requires
 * an authenticated session.
 */
export function AuthGateModal({
  open,
  onCancel,
  title = 'Sign in to continue',
  message = 'Please log in or create a free account to continue.',
}: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="auth-gate-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center px-4"
          style={{ background: 'rgba(7,12,22,0.88)', backdropFilter: 'blur(10px)' }}
        >
          <motion.div
            key="auth-gate-modal"
            initial={{ opacity: 0, scale: 0.93, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: 24 }}
            transition={{ type: 'spring', stiffness: 340, damping: 26 }}
            className="w-full max-w-md rounded-3xl p-8"
            style={{
              background: NIGHT_2,
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 48px 100px rgba(0,0,0,0.60)',
            }}
          >
            <h3 className="text-xl font-black mb-2 text-white" style={{ letterSpacing: '-0.025em' }}>
              {title}
            </h3>
            <p className="text-sm mb-7" style={{ color: MUTED }}>
              {message}
            </p>
            <div className="flex gap-3">
              <Link
                href="/auth"
                className="flex-1 text-center px-4 py-3 rounded-xl text-sm font-bold text-white"
                style={{ background: REDLINE }}
              >
                Log In / Sign Up
              </Link>
              <button
                type="button"
                className="px-4 py-3 rounded-xl text-sm font-semibold text-white transition-colors hover-border-subtle"
                style={{ border: '1px solid rgba(255,255,255,0.12)' }}
                onClick={onCancel}
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
