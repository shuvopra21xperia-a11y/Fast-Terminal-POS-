/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Windows Desktop-grade Confirmation Dialog Modal
 */

import React, { useEffect, useRef } from 'react';
import { usePharmacy } from '../../context/PharmacyContext';
import { AlertTriangle, HelpCircle, X } from 'lucide-react';

export const ConfirmDialog: React.FC = () => {
  const { confirmDialogState, closeConfirm } = usePharmacy();
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirmDialogState) {
      // Focus confirm button when dialog opens
      setTimeout(() => confirmButtonRef.current?.focus(), 50);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          confirmDialogState.onCancel?.();
          closeConfirm();
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [confirmDialogState, closeConfirm]);

  if (!confirmDialogState) return null;

  const {
    title,
    message,
    confirmLabel,
    confirmText,
    cancelLabel,
    cancelText,
    isDestructive,
    destructive,
    onConfirm,
    onCancel,
  } = confirmDialogState;

  const resolvedConfirmLabel = confirmText || confirmLabel || 'Confirm';
  const resolvedCancelLabel = cancelText || cancelLabel || 'Cancel';
  const resolvedDestructive = isDestructive ?? destructive ?? false;

  const handleConfirm = () => {
    onConfirm?.();
    closeConfirm();
  };

  const handleCancel = () => {
    onCancel?.();
    closeConfirm();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs select-none">
      <div className="bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Title bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950 border-b border-slate-800 text-slate-200">
          <div className="flex items-center gap-2">
            {resolvedDestructive ? (
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            ) : (
              <HelpCircle className="w-4 h-4 text-emerald-400" />
            )}
            <span className="font-semibold text-xs text-slate-100">{title}</span>
          </div>
          <button
            onClick={handleCancel}
            className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 text-sm text-slate-300 leading-relaxed whitespace-pre-line">
          {message}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 px-4 py-3 bg-slate-950/70 border-t border-slate-800/80">
          <button
            type="button"
            onClick={handleCancel}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700"
          >
            {resolvedCancelLabel}
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            onClick={handleConfirm}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold text-white shadow-md transition-all ${
              resolvedDestructive
                ? 'bg-rose-600 hover:bg-rose-500 focus:ring-2 focus:ring-rose-500'
                : 'bg-emerald-600 hover:bg-emerald-500 focus:ring-2 focus:ring-emerald-500'
            }`}
          >
            {resolvedConfirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
