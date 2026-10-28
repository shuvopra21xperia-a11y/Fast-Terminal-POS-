/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Windows Desktop-grade Floating Toast Notification Stack
 */

import React from 'react';
import { usePharmacy } from '../../context/PharmacyContext';
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  X,
} from 'lucide-react';
import { ToastMessage } from '../../types/pharmacy';

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = usePharmacy();

  if (!toasts || toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}> = ({ toast, onDismiss }) => {
  const getIconAndStyle = () => {
    switch (toast.type) {
      case 'success':
        return {
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
          borderColor: 'border-emerald-500/40',
          bgGradient: 'from-emerald-950/95 to-slate-900/95',
          titleColor: 'text-emerald-300',
        };
      case 'error':
        return {
          icon: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />,
          borderColor: 'border-rose-500/50',
          bgGradient: 'from-rose-950/95 to-slate-900/95',
          titleColor: 'text-rose-300',
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
          borderColor: 'border-amber-500/50',
          bgGradient: 'from-amber-950/95 to-slate-900/95',
          titleColor: 'text-amber-300',
        };
      case 'info':
      default:
        return {
          icon: <Info className="w-5 h-5 text-sky-400 shrink-0" />,
          borderColor: 'border-sky-500/40',
          bgGradient: 'from-sky-950/95 to-slate-900/95',
          titleColor: 'text-sky-300',
        };
    }
  };

  const style = getIconAndStyle();

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-lg border ${style.borderColor} bg-gradient-to-r ${style.bgGradient} backdrop-blur-md shadow-2xl shadow-black/60 text-slate-100 transition-all transform animate-in fade-in slide-in-from-bottom-2 duration-200`}
    >
      <div className="pt-0.5">{style.icon}</div>
      <div className="flex-1 min-w-0">
        {toast.title && (
          <h4 className={`text-xs font-bold leading-tight mb-0.5 ${style.titleColor}`}>
            {toast.title}
          </h4>
        )}
        <p className="text-xs text-slate-200 leading-snug whitespace-pre-line break-words">
          {toast.message}
        </p>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-slate-400 hover:text-white p-1 rounded hover:bg-white/10 transition-colors shrink-0"
        title="Dismiss notification"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
