/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Supplier, SupplierCallStatus } from '../../types/pharmacy';
import { usePharmacy } from '../../context/PharmacyContext';
import { Phone, Calendar, User, FileText, Check, X, Clock, AlertCircle } from 'lucide-react';

interface SupplierCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier: Supplier | null;
  onSuccess?: () => void;
}

export const SupplierCallModal: React.FC<SupplierCallModalProps> = ({
  isOpen,
  onClose,
  supplier,
  onSuccess,
}) => {
  const { logSupplierCall, showToast, currentUser } = usePharmacy();

  const [repName, setRepName] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<SupplierCallStatus>('Called');
  const [scheduledDate, setScheduledDate] = useState('');
  const [callNotes, setCallNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (supplier) {
      setPhone(supplier.Phone || '');
      setRepName('Mr. Representative');
      setStatus('Called');
      // Set default scheduled date to tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setScheduledDate(tomorrow.toISOString().split('T')[0]);
      setCallNotes(`Informed supplier about expired medicines quarantined in vault. Requested visit for exchange or cash settlement.`);
      setError(null);
    }
  }, [supplier]);

  if (!isOpen || !supplier) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!callNotes.trim()) {
      setError('Please enter call notes or outcome summary.');
      return;
    }

    const res = logSupplierCall(supplier.SupplierID, {
      representativeName: repName.trim() || 'Representative',
      phone: phone.trim() || supplier.Phone,
      notes: callNotes.trim(),
      scheduledVisitDate: scheduledDate ? scheduledDate : undefined,
      status,
    });

    if (res.success) {
      showToast(
        `Logged call to ${supplier.Name} (${status}). Waiting items updated.`,
        'success',
        'Call Logged'
      );
      if (onSuccess) onSuccess();
      onClose();
    } else {
      setError('Failed to log call.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Log Call to Supplier
              </h2>
              <p className="text-xs text-slate-400">
                {supplier.Name} • ID: {supplier.SupplierID}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-950/50 border border-red-800/80 rounded-lg text-xs text-red-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Representative Contact
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={repName}
                  onChange={(e) => setRepName(e.target.value)}
                  placeholder="e.g. Mr. Tanvir / Asad"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Phone Number
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+880 1712-..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Call Status / Outcome
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as SupplierCallStatus)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="Called">Called (Informed Supplier)</option>
                <option value="ScheduledVisit">Scheduled Visit (Date Agreed)</option>
                <option value="AwaitingArrival">Awaiting Arrival (Rep En Route)</option>
                <option value="NotCalled">Not Called (Reset Status)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Scheduled Visit Date
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Call Conversation Notes & Agreement
            </label>
            <textarea
              rows={3}
              value={callNotes}
              onChange={(e) => setCallNotes(e.target.value)}
              placeholder="e.g. Spoke with territory officer. He will arrive Wednesday at 11 AM with fresh replacement batches..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-white focus:outline-none focus:border-emerald-500 resize-none"
            />
          </div>

          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              Logged By: <strong className="text-slate-300">{currentUser?.FullName || 'Pharmacist'}</strong>
            </span>
            <span>Real-time Audit Trail will be updated</span>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 shadow-lg shadow-emerald-900/30"
            >
              <Check className="w-4 h-4" />
              Save Supplier Call Log
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
