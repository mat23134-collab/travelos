import { create } from 'zustand';

/**
 * sidePanelStore — ephemeral open/closed state for the trip companion drawer.
 *
 * Not persisted (unlike onboardingStore): open/closed is transient UI. Any
 * component can open the panel to a specific module without prop-drilling:
 *   const open = useSidePanel((s) => s.openPanel);
 *   <button onClick={() => open('documents')} />
 */

export type PanelModule = 'base' | 'documents' | 'discover';

interface SidePanelState {
  open: boolean;
  module: PanelModule;
  openPanel: (module?: PanelModule) => void;
  closePanel: () => void;
  toggle: (module?: PanelModule) => void;
}

export const useSidePanel = create<SidePanelState>((set) => ({
  open: false,
  module: 'documents',
  openPanel: (module) => set((s) => ({ open: true, module: module ?? s.module })),
  closePanel: () => set({ open: false }),
  toggle: (module) => set((s) => ({ open: !s.open, module: module ?? s.module })),
}));
