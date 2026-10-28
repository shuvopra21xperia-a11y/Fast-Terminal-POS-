/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { usePharmacy } from '../../context/PharmacyContext';
import { ExpireReturnTransaction, CashPaymentRecord } from '../../types/pharmacy';
import {
  Banknote,
  Search,
  CheckCircle2,
  Calendar,
  Building2,
  Phone,
  User,
  Clock,
  Printer,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  FileText,
} from 'lucide-react';
import { CashRefundSlipModal } from './ExpirePrintSlips';

interface DirectCashRefundPageProps {
  initialInvoiceNumber?: string;
  onNavigateToVaultTree: () => void;
  onNavigateToTransactions: () => void;
}

export const DirectCashRefundPage: React.FC<DirectCashRefundPageProps> = ({
  initialInvoiceNumber,
  onNavigateToVaultTree,
  onNavigateToTransactions,
}) => {
  const {
    expireTransactions,
    addCashToOutInvoice,
    currentUser,
    formatCurrency,
    showToast,
  } = usePharmacy();

  // Search input for invoice number
  const [searchInvoiceInput, setSearchInvoiceInput] = useState(initialInvoiceNumber || '');
  const [activeInvoiceNumber, setActiveInvoiceNumber] = useState(initialInvoiceNumber || '');

  // Form state
  const [cashAmount, setCashAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Bank Transfer' | 'MFS' | 'Cheque'>('Cash');
  const [referenceNotes, setReferenceNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Generated slip modal
  const [slipModalOpen, setSlipModalOpen] = useState(false);
  const [lastPaymentRecord, setLastPaymentRecord] = useState<CashPaymentRecord | null>(null);

  // Find target Out-Invoice
  const activeOutInvoice = useMemo(() => {
    if (!activeInvoiceNumber.trim()) {
      // Default to first pending out-invoice
      return expireTransactions.find((t) => t.Status !== 'Settled') || expireTransactions[0] || null;
    }
    const clean = activeInvoiceNumber.trim().toUpperCase();
    return (
      expireTransactions.find(
        (t) =>
          t.VoucherNumber.toUpperCase() === clean ||
          t.TransactionID.toUpperCase() === clean ||
          t.VoucherNumber.toUpperCase().includes(clean)
      ) || null
    );
  }, [expireTransactions, activeInvoiceNumber]);

  // Pre-fill cash amount with remaining due balance whenever active invoice changes
  useEffect(() => {
    if (activeOutInvoice) {
      const remaining =
        activeOutInvoice.DueBalance !== undefined
          ? activeOutInvoice.DueBalance
          : activeOutInvoice.TotalAmount - (activeOutInvoice.PaidAmount || 0);
      setCashAmount(Math.max(0, remaining));
      setReferenceNotes(`Cash settlement received from ${activeOutInvoice.SupplierName}`);
      setError(null);
    }
  }, [activeOutInvoice]);

  // Suggestions for quick selection
  const matchingInvoiceSuggestions = useMemo(() => {
    if (!searchInvoiceInput.trim()) return [];
    const q = searchInvoiceInput.toLowerCase().trim();
    return expireTransactions.filter(
      (t) =>
        t.VoucherNumber.toLowerCase().includes(q) ||
        t.SupplierName.toLowerCase().includes(q) ||
        t.TransactionID.toLowerCase().includes(q)
    );
  }, [expireTransactions, searchInvoiceInput]);

  // Handle direct cash payment
  const handleAddCash = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOutInvoice) {
      setError('Please open an Out-Invoice first.');
      return;
    }

    if (cashAmount <= 0) {
      setError('Cash amount must be greater than zero.');
      return;
    }

    const currentDue =
      activeOutInvoice.DueBalance !== undefined
        ? activeOutInvoice.DueBalance
        : activeOutInvoice.TotalAmount - (activeOutInvoice.PaidAmount || 0);

    if (cashAmount > currentDue + 0.01) {
      setError(`Amount cannot exceed remaining due balance (${formatCurrency(currentDue)}).`);
      return;
    }

    const res = addCashToOutInvoice(activeOutInvoice.VoucherNumber, {
      amount: cashAmount,
      paymentMethod,
      notes: referenceNotes,
    });

    if (res.success && res.updatedInvoice) {
      const createdRecord: CashPaymentRecord = {
        PaymentID: `CSH-${Date.now()}`,
        Amount: cashAmount,
        PaymentMethod: paymentMethod,
        Date: new Date().toISOString(),
        ReceivedBy: currentUser?.FullName || 'Pharmacist',
        ReferenceNote: referenceNotes,
      };

      setLastPaymentRecord(createdRecord);
      setSlipModalOpen(true);
      showToast(
        `Added cash refund of ${formatCurrency(cashAmount)} directly against Out-Invoice #${activeOutInvoice.VoucherNumber}. Financial ledger updated.`,
        'success',
        'Cash Refund Logged'
      );
    } else {
      setError(res.error || 'Failed to record cash payment.');
    }
  };

  const currentDue = activeOutInvoice
    ? activeOutInvoice.DueBalance !== undefined
      ? activeOutInvoice.DueBalance
      : activeOutInvoice.TotalAmount - (activeOutInvoice.PaidAmount || 0)
    : 0;

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-900 overflow-hidden">
      {/* Top Banner */}
      <div className="px-5 py-2.5 bg-green-950/40 border-b border-green-500/30 flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center gap-2 text-green-200">
          <Banknote className="w-4 h-4 text-green-400 shrink-0" />
          <span>
            <strong>Direct Cash Back Against Out-Invoice:</strong> Search or open any Out-Invoice by
            invoice number and post cash received directly to the pharmacy's financial ledger.
          </span>
        </div>
        <button
          onClick={onNavigateToTransactions}
          className="text-xs text-green-300 hover:text-white underline font-medium"
        >
          View All Transactions
        </button>
      </div>

      {/* Main Search & Workspace */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center">
        <div className="w-full max-w-4xl space-y-6">
          {/* Search Box to Open Out-Invoice by Number */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Open Out-Invoice by Invoice Number
            </label>
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={searchInvoiceInput}
                  onChange={(e) => setSearchInvoiceInput(e.target.value)}
                  placeholder="Type Out-Invoice number (e.g. RET-2026-0102, EXP-OUT-2026-0101) or supplier name..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-green-500 font-mono shadow-inner"
                />
              </div>
              <button
                type="button"
                onClick={() => setActiveInvoiceNumber(searchInvoiceInput)}
                className="px-5 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs font-bold transition-colors shadow-md"
              >
                Open Invoice
              </button>
            </div>

            {/* Suggestions list */}
            {matchingInvoiceSuggestions.length > 0 && searchInvoiceInput && (
              <div className="mt-3 pt-3 border-t border-slate-800/80">
                <p className="text-[11px] text-slate-400 mb-1.5 font-medium">Quick Matches:</p>
                <div className="flex flex-wrap gap-2">
                  {matchingInvoiceSuggestions.slice(0, 5).map((t) => (
                    <button
                      key={t.TransactionID}
                      onClick={() => {
                        setSearchInvoiceInput(t.VoucherNumber);
                        setActiveInvoiceNumber(t.VoucherNumber);
                      }}
                      className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-xs font-mono text-slate-300 flex items-center gap-1.5 transition-colors"
                    >
                      <strong className="text-amber-400">{t.VoucherNumber}</strong>
                      <span className="text-slate-400">({t.SupplierName})</span>
                      <span className="text-emerald-400 font-bold">{formatCurrency(t.TotalAmount)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Active Out-Invoice Information Card */}
          {activeOutInvoice ? (
            <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              {/* Card Header */}
              <div className="p-5 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-white font-mono">
                        {activeOutInvoice.VoucherNumber}
                      </h3>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          activeOutInvoice.Status === 'Settled'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : activeOutInvoice.Status === 'PartiallySettled'
                            ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        }`}
                      >
                        {activeOutInvoice.Status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                      <span>Issued: {new Date(activeOutInvoice.TransactionDate).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>Supplier: <strong className="text-slate-200">{activeOutInvoice.SupplierName}</strong></span>
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[11px] text-slate-400 uppercase font-semibold block">
                    Remaining Due Balance
                  </span>
                  <span
                    className={`text-2xl font-black font-mono ${
                      currentDue <= 0 ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {formatCurrency(currentDue)}
                  </span>
                </div>
              </div>

              {/* Grid: Financial Stats & Returned Medicines Table */}
              <div className="p-5 grid grid-cols-3 gap-4 border-b border-slate-800 bg-slate-900/40">
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <p className="text-[11px] text-slate-400 uppercase font-semibold">Total Invoice Value</p>
                  <p className="text-lg font-bold text-white font-mono mt-0.5">
                    {formatCurrency(activeOutInvoice.TotalAmount)}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {activeOutInvoice.TotalQuantity} units quarantined
                  </p>
                </div>

                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <p className="text-[11px] text-slate-400 uppercase font-semibold">Cash Refunded to Date</p>
                  <p className="text-lg font-bold text-emerald-400 font-mono mt-0.5">
                    {formatCurrency(activeOutInvoice.PaidAmount || 0)}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Credited to cash flow
                  </p>
                </div>

                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <p className="text-[11px] text-slate-400 uppercase font-semibold">Settlement Method</p>
                  <p className="text-lg font-bold text-sky-400 font-mono mt-0.5">
                    {activeOutInvoice.ReconciliationType || 'Pending'}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {activeOutInvoice.LinkedInInvoiceNumber
                      ? `Exchanged: ${activeOutInvoice.LinkedInInvoiceNumber}`
                      : 'Cash back against out-invoice'}
                  </p>
                </div>
              </div>

              {/* Returned Items Mini Table */}
              <div className="p-5 border-b border-slate-800 space-y-2">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Medicines Quarantined on this Out-Invoice
                </h4>
                <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/40">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-950 text-[10px] text-slate-400 uppercase border-b border-slate-800">
                        <th className="py-2 px-3">Medicine</th>
                        <th className="py-2 px-3">Batch</th>
                        <th className="py-2 px-3 text-center">Expiry</th>
                        <th className="py-2 px-3 text-right">Qty</th>
                        <th className="py-2 px-3 text-right">Unit Cost</th>
                        <th className="py-2 px-3 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {activeOutInvoice.Items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/40">
                          <td className="py-2 px-3 font-sans font-bold text-white">
                            {item.TradeName}
                          </td>
                          <td className="py-2 px-3 text-amber-300">{item.BatchNumber}</td>
                          <td className="py-2 px-3 text-center text-slate-400">{item.ExpiryDate}</td>
                          <td className="py-2 px-3 text-right font-bold text-white">{item.Quantity}</td>
                          <td className="py-2 px-3 text-right text-slate-300">{formatCurrency(item.CostPrice)}</td>
                          <td className="py-2 px-3 text-right font-bold text-amber-300">
                            {formatCurrency(item.TotalCost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Payment History if already paid */}
              {activeOutInvoice.CashReceipts && activeOutInvoice.CashReceipts.length > 0 && (
                <div className="p-5 border-b border-slate-800 space-y-2 bg-slate-950/40">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Previous Cash Receipt History
                  </h4>
                  <div className="space-y-1.5">
                    {activeOutInvoice.CashReceipts.map((rcpt) => (
                      <div
                        key={rcpt.PaymentID}
                        className="p-2 bg-slate-900 rounded-lg border border-slate-800 text-xs flex items-center justify-between"
                      >
                        <div>
                          <span className="font-mono text-emerald-400 font-bold mr-2">
                            {formatCurrency(rcpt.Amount)}
                          </span>
                          <span className="text-slate-400">
                            via {rcpt.PaymentMethod} • Received by {rcpt.ReceivedBy}
                          </span>
                        </div>
                        <span className="text-slate-500 font-mono text-[11px]">
                          {new Date(rcpt.Date).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add Cash Directly Form */}
              <div className="p-6 bg-slate-950">
                <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
                  <Banknote className="w-4 h-4 text-green-400" />
                  <span>Add Cash Directly Against this Out-Invoice</span>
                </h4>

                {error && (
                  <div className="mb-4 p-3 bg-red-950/50 border border-red-800/80 rounded-lg text-xs text-red-200 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {currentDue <= 0 ? (
                  <div className="p-4 bg-emerald-950/30 border border-emerald-500/40 rounded-xl text-center space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                    <p className="text-sm font-bold text-white">This Out-Invoice is Fully Settled</p>
                    <p className="text-xs text-slate-400">
                      All ৳ {activeOutInvoice.TotalAmount.toFixed(2)} has been reconciled and logged to the ledger.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleAddCash} className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      {/* Cash Amount */}
                      <div className="col-span-1">
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          Cash Amount to Add (৳)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            max={currentDue}
                            value={cashAmount}
                            onChange={(e) => setCashAmount(parseFloat(e.target.value) || 0)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-base font-mono font-bold text-green-400 focus:outline-none focus:border-green-500 shadow-inner"
                          />
                        </div>
                        <div className="flex gap-1.5 mt-1.5">
                          <button
                            type="button"
                            onClick={() => setCashAmount(currentDue)}
                            className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] font-mono"
                          >
                            Full Due
                          </button>
                          <button
                            type="button"
                            onClick={() => setCashAmount(Math.round((currentDue / 2) * 100) / 100)}
                            className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] font-mono"
                          >
                            50% Partial
                          </button>
                        </div>
                      </div>

                      {/* Payment Method */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          Payment Method
                        </label>
                        <select
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value as any)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-green-500"
                        >
                          <option value="Cash">Cash (Counter Cash Register)</option>
                          <option value="Bank Transfer">Bank Wire / Electronic Deposit</option>
                          <option value="MFS">MFS (bKash / Nagad / Rocket)</option>
                          <option value="Cheque">Bank Cheque</option>
                        </select>
                      </div>

                      {/* Received By */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          Received By
                        </label>
                        <input
                          type="text"
                          disabled
                          value={currentUser?.FullName || 'Pharmacist'}
                          className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-400"
                        />
                      </div>
                    </div>

                    {/* Reference / Remarks */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Cash Voucher Reference / Cheque # / Notes
                      </label>
                      <input
                        type="text"
                        value={referenceNotes}
                        onChange={(e) => setReferenceNotes(e.target.value)}
                        placeholder="e.g. Received counter cash from Mr. Asad, square rep..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-green-500"
                      />
                    </div>

                    {/* Submission button */}
                    <div className="pt-2 flex items-center justify-between border-t border-slate-800">
                      <span className="text-xs text-slate-400">
                        Automatically writes to Due Collection ledger & updates Out-Invoice balance
                      </span>

                      <button
                        type="submit"
                        className="px-6 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-green-900/40 transition-colors"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Add Cash Directly Against Out-Invoice ({formatCurrency(cashAmount)})</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 bg-slate-950 border border-slate-800 rounded-2xl text-center text-slate-400">
              <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-white">Out-Invoice Not Found</p>
              <p className="text-xs text-slate-400 mt-1">
                Enter a valid Out-Invoice number in the search box above.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Cash Slip Modal */}
      <CashRefundSlipModal
        isOpen={slipModalOpen}
        onClose={() => setSlipModalOpen(false)}
        outInvoice={activeOutInvoice}
        paymentRecord={lastPaymentRecord}
      />
    </div>
  );
};
