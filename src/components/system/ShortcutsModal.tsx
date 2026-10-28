/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * POS Keyboard Navigation Shortcuts Modal
 */

import React from 'react';
import { Keyboard, X } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Ctrl + F', desc: 'Find New Medicine Item for Add (Focus Search Bar)' },
    { key: '↓ / ↑', desc: 'Navigate dynamic medicine search dropdown' },
    { key: 'Enter', desc: 'Select highlighted medicine -> Open Quantity & Discount window' },
    { key: 'Enter (Child Window)', desc: 'From Quantity: Press Enter to immediately Confirm & Add' },
    { key: 'Ctrl + C', desc: 'Jump to Current Cart/Chart to adjust Qty, Discount, or Delete' },
    { key: 'Alt + T', desc: 'Post / Tender Sale (Alt+t or Alt+T)' },
    { key: 'Alt + P', desc: 'Direct Thermal Print to Configured Printer (Alt+p or Alt+P)' },
    { key: 'Alt + N', desc: 'Open New Sale (Clear Cart & Focus Search)' },
    { key: 'F1 / Esc', desc: 'Jump back to Medicine Search bar' },
    { key: 'F2', desc: 'Focus Additional Bill Discount' },
    { key: 'F3', desc: 'Select Customer' },
    { key: 'Barcode Scanner', desc: 'Auto-scans barcode & adds FEFO batch to cart' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs select-none">
      <div className="bg-slate-950 border border-slate-700 rounded-lg shadow-2xl max-w-sm w-full overflow-hidden text-xs">
        <div className="flex justify-between items-center p-3.5 border-b border-slate-800 bg-slate-900">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-emerald-400" />
            <h3 className="font-semibold text-white">Keyboard Navigation Shortcuts</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-2">
          {shortcuts.map((s, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800"
            >
              <kbd className="px-2 py-0.5 rounded bg-slate-950 border border-slate-700 font-mono font-bold text-emerald-400 text-[11px] shadow-xs">
                {s.key}
              </kbd>
              <span className="text-slate-300 text-[11px] text-right font-medium">
                {s.desc}
              </span>
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-slate-800 bg-slate-900 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
