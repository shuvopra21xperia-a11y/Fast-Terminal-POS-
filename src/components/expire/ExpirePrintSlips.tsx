/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ExpireReturnTransaction, ExpireInInvoice, CashPaymentRecord } from '../../types/pharmacy';
import { usePharmacy } from '../../context/PharmacyContext';
import { Printer, X, CheckCircle2, ArrowRightLeft, Banknote, ShieldAlert, FileText } from 'lucide-react';

interface ExpireOutInvoiceSlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  outInvoice: ExpireReturnTransaction | null;
}

export const ExpireOutInvoiceSlipModal: React.FC<ExpireOutInvoiceSlipModalProps> = ({
  isOpen,
  onClose,
  outInvoice,
}) => {
  const { receiptSettings, formatCurrency } = usePharmacy();

  if (!isOpen || !outInvoice) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Top toolbar */}
        <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-500/10 border border-amber-500/30 rounded text-amber-400">
              <FileText className="w-4 h-4" />
            </div>
            <span className="text-sm font-bold text-white">
              Expired Medicine Out-Invoice / Return Debit Note
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Slip
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Print Slip Document */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-950/60 font-mono text-slate-200">
          <div className="bg-white text-slate-900 p-6 rounded-lg shadow-sm border border-slate-300 max-w-xl mx-auto print:m-0 print:p-0 print:border-none print:shadow-none print:text-black">
            {/* Header */}
            <div className="text-center border-b border-dashed border-slate-400 pb-3 mb-3">
              <h1 className="text-base font-bold uppercase tracking-wider">
                {receiptSettings.pharmacyName || 'PHARMACORE PHARMACY'}
              </h1>
              <p className="text-[11px] text-slate-600">
                {receiptSettings.address} • Tel: {receiptSettings.phone}
              </p>
              <div className="inline-block px-2.5 py-0.5 mt-1.5 bg-amber-100 border border-amber-300 rounded text-[11px] font-bold text-amber-900 tracking-wide">
                EXPIRED MEDICINE OUT-INVOICE
              </div>
            </div>

            {/* Voucher Meta */}
            <div className="grid grid-cols-2 text-[11px] gap-2 pb-3 border-b border-dashed border-slate-300">
              <div>
                <p>
                  <strong>Out-Invoice #:</strong> {outInvoice.VoucherNumber}
                </p>
                <p>
                  <strong>Date:</strong> {new Date(outInvoice.TransactionDate).toLocaleString()}
                </p>
                <p>
                  <strong>Status:</strong>{' '}
                  <span className="font-bold text-amber-800 uppercase">{outInvoice.Status}</span>
                </p>
                {outInvoice.ReconciliationType && (
                  <p>
                    <strong>Settlement:</strong> {outInvoice.ReconciliationType}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p>
                  <strong>Supplier:</strong> {outInvoice.SupplierName}
                </p>
                <p>
                  <strong>Phone:</strong> {outInvoice.SupplierPhone || 'N/A'}
                </p>
                <p>
                  <strong>Representative:</strong> {outInvoice.RepresentativeName || 'Rep'} ({outInvoice.RepresentativePhone || 'N/A'})
                </p>
                <p>
                  <strong>Pharmacist / Salesman:</strong> {outInvoice.SalesmanName}
                </p>
              </div>
            </div>

            {/* Strict Isolation Notice */}
            <div className="my-2 p-1.5 bg-slate-100 border border-slate-200 rounded text-[10px] text-slate-600 text-center italic">
              * Quarantined Vault Return: Transferred directly from Expire Vault to Supplier *
            </div>

            {/* Items Table */}
            <table className="w-full text-[11px] text-left border-collapse mb-4">
              <thead>
                <tr className="border-b border-slate-800 text-slate-700 font-bold">
                  <th className="py-1">#</th>
                  <th className="py-1">Medicine & Generic</th>
                  <th className="py-1">Batch</th>
                  <th className="py-1 text-center">Exp Date</th>
                  <th className="py-1 text-right">Qty</th>
                  <th className="py-1 text-right">Unit Cost</th>
                  <th className="py-1 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {outInvoice.Items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-1">{idx + 1}</td>
                    <td className="py-1">
                      <div className="font-bold">{item.TradeName}</div>
                      <div className="text-[10px] text-slate-500">{item.GenericName}</div>
                    </td>
                    <td className="py-1 font-mono">{item.BatchNumber}</td>
                    <td className="py-1 text-center text-[10px]">{item.ExpiryDate}</td>
                    <td className="py-1 text-right font-bold">{item.Quantity}</td>
                    <td className="py-1 text-right">{formatCurrency(item.CostPrice)}</td>
                    <td className="py-1 text-right font-bold">{formatCurrency(item.TotalCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Summary Totals */}
            <div className="border-t-2 border-slate-800 pt-2 flex justify-between items-center text-xs">
              <span className="font-bold">
                Total Items: {outInvoice.Items.length} (Qty: {outInvoice.TotalQuantity} units)
              </span>
              <div className="text-right">
                <span className="text-[10px] text-slate-600 mr-2">Total Return Value:</span>
                <span className="text-base font-extrabold">{formatCurrency(outInvoice.TotalAmount)}</span>
              </div>
            </div>

            {/* Balance details if partial */}
            {(outInvoice.PaidAmount || 0) > 0 && (
              <div className="mt-1 text-right text-[11px] text-emerald-700">
                <span>Cash Refund Received: <strong>{formatCurrency(outInvoice.PaidAmount || 0)}</strong></span>
                <span className="ml-3">Remaining Due: <strong>{formatCurrency(outInvoice.DueBalance || 0)}</strong></span>
              </div>
            )}

            {/* Notes */}
            {outInvoice.Notes && (
              <p className="mt-3 text-[10px] text-slate-600 border-t border-slate-200 pt-1">
                <strong>Remarks:</strong> {outInvoice.Notes}
              </p>
            )}

            {/* Signature Blocks */}
            <div className="grid grid-cols-2 gap-8 pt-10 text-[10px] text-center border-t border-dashed border-slate-300 mt-6">
              <div>
                <div className="border-b border-slate-400 w-3/4 mx-auto mb-1"></div>
                <p className="font-bold text-slate-800">Dispensed By (Pharmacist)</p>
                <p className="text-slate-500">{receiptSettings.pharmacyName}</p>
              </div>
              <div>
                <div className="border-b border-slate-400 w-3/4 mx-auto mb-1"></div>
                <p className="font-bold text-slate-800">Received By (Supplier Representative)</p>
                <p className="text-slate-500">{outInvoice.SupplierName}</p>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center text-[9px] text-slate-400 mt-5">
              PharmaCore Desktop POS • Verified Electronic Audit Record #{outInvoice.TransactionID}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ExpireInInvoiceSlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  inInvoice: ExpireInInvoice | null;
}

export const ExpireInInvoiceSlipModal: React.FC<ExpireInInvoiceSlipModalProps> = ({
  isOpen,
  onClose,
  inInvoice,
}) => {
  const { receiptSettings, formatCurrency } = usePharmacy();

  if (!isOpen || !inInvoice) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Top toolbar */}
        <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded text-emerald-400">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <span className="text-sm font-bold text-white">
              Expire In-Invoice / Fresh Stock Replacement Slip
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Slip
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Print Slip Document */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-950/60 font-mono text-slate-200">
          <div className="bg-white text-slate-900 p-6 rounded-lg shadow-sm border border-slate-300 max-w-xl mx-auto print:m-0 print:p-0 print:border-none print:shadow-none print:text-black">
            {/* Header */}
            <div className="text-center border-b border-dashed border-slate-400 pb-3 mb-3">
              <h1 className="text-base font-bold uppercase tracking-wider">
                {receiptSettings.pharmacyName || 'PHARMACORE PHARMACY'}
              </h1>
              <p className="text-[11px] text-slate-600">
                {receiptSettings.address} • Tel: {receiptSettings.phone}
              </p>
              <div className="inline-block px-2.5 py-0.5 mt-1.5 bg-emerald-100 border border-emerald-300 rounded text-[11px] font-bold text-emerald-900 tracking-wide">
                EXPIRE IN-INVOICE (GOOD MEDICINE EXCHANGE)
              </div>
            </div>

            {/* Voucher Meta */}
            <div className="grid grid-cols-2 text-[11px] gap-2 pb-3 border-b border-dashed border-slate-300">
              <div>
                <p>
                  <strong>In-Invoice #:</strong> {inInvoice.InInvoiceNumber}
                </p>
                <p>
                  <strong>Linked Out-Invoice #:</strong>{' '}
                  <span className="font-bold text-amber-800">{inInvoice.OutInvoiceNumber || 'Direct Exchange'}</span>
                </p>
                <p>
                  <strong>Date Received:</strong> {new Date(inInvoice.ReceivedDate).toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <p>
                  <strong>Supplier:</strong> {inInvoice.SupplierName}
                </p>
                <p>
                  <strong>Phone:</strong> {inInvoice.SupplierPhone || 'N/A'}
                </p>
                <p>
                  <strong>Received By:</strong> {inInvoice.ReceivedBy}
                </p>
              </div>
            </div>

            {/* Auto Stock Update Banner */}
            <div className="my-2 p-1.5 bg-emerald-50 border border-emerald-200 rounded text-[10px] text-emerald-800 text-center font-bold">
              ✓ Active Stock Automatically Updated: Fresh Batches Posted to Inventory
            </div>

            {/* Items Table */}
            <table className="w-full text-[11px] text-left border-collapse mb-4">
              <thead>
                <tr className="border-b border-slate-800 text-slate-700 font-bold">
                  <th className="py-1">#</th>
                  <th className="py-1">Good Replacement Medicine</th>
                  <th className="py-1">New Batch</th>
                  <th className="py-1 text-center">New Expiry</th>
                  <th className="py-1 text-right">Qty</th>
                  <th className="py-1 text-right">Cost Price</th>
                  <th className="py-1 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {inInvoice.Items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-1">{idx + 1}</td>
                    <td className="py-1">
                      <div className="font-bold">{item.TradeName}</div>
                      <div className="text-[10px] text-slate-500">{item.GenericName}</div>
                    </td>
                    <td className="py-1 font-mono font-bold text-emerald-700">{item.BatchNumber}</td>
                    <td className="py-1 text-center text-[10px] text-emerald-700 font-bold">{item.ExpiryDate}</td>
                    <td className="py-1 text-right font-bold">{item.Quantity}</td>
                    <td className="py-1 text-right">{formatCurrency(item.CostPrice)}</td>
                    <td className="py-1 text-right font-bold">{formatCurrency(item.TotalCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Summary Totals */}
            <div className="border-t-2 border-slate-800 pt-2 flex justify-between items-center text-xs">
              <span className="font-bold">
                Total Fresh Batches: {inInvoice.Items.length} ({inInvoice.TotalQuantity} units added to stock)
              </span>
              <div className="text-right">
                <span className="text-[10px] text-slate-600 mr-2">Total Replacement Value:</span>
                <span className="text-base font-extrabold text-emerald-900">{formatCurrency(inInvoice.TotalAmount)}</span>
              </div>
            </div>

            {/* Notes */}
            {inInvoice.Notes && (
              <p className="mt-3 text-[10px] text-slate-600 border-t border-slate-200 pt-1">
                <strong>Remarks:</strong> {inInvoice.Notes}
              </p>
            )}

            {/* Signature Blocks */}
            <div className="grid grid-cols-2 gap-8 pt-10 text-[10px] text-center border-t border-dashed border-slate-300 mt-6">
              <div>
                <div className="border-b border-slate-400 w-3/4 mx-auto mb-1"></div>
                <p className="font-bold text-slate-800">Verified & Stocked By</p>
                <p className="text-slate-500">{inInvoice.ReceivedBy}</p>
              </div>
              <div>
                <div className="border-b border-slate-400 w-3/4 mx-auto mb-1"></div>
                <p className="font-bold text-slate-800">Delivered By (Supplier)</p>
                <p className="text-slate-500">{inInvoice.SupplierName}</p>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center text-[9px] text-slate-400 mt-5">
              PharmaCore Desktop POS • Verified Electronic Stock Audit Record #{inInvoice.InInvoiceID}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface CashRefundSlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  outInvoice: ExpireReturnTransaction | null;
  paymentRecord: CashPaymentRecord | null;
}

export const CashRefundSlipModal: React.FC<CashRefundSlipModalProps> = ({
  isOpen,
  onClose,
  outInvoice,
  paymentRecord,
}) => {
  const { receiptSettings, formatCurrency } = usePharmacy();

  if (!isOpen || !outInvoice || !paymentRecord) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Top toolbar */}
        <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-green-500/10 border border-green-500/30 rounded text-green-400">
              <Banknote className="w-4 h-4" />
            </div>
            <span className="text-sm font-bold text-white">
              Supplier Cash Refund Money Receipt
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Receipt
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Print Slip Document */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-950/60 font-mono text-slate-200">
          <div className="bg-white text-slate-900 p-6 rounded-lg shadow-sm border border-slate-300 max-w-md mx-auto print:m-0 print:p-0 print:border-none print:shadow-none print:text-black">
            {/* Header */}
            <div className="text-center border-b border-dashed border-slate-400 pb-3 mb-3">
              <h1 className="text-base font-bold uppercase tracking-wider">
                {receiptSettings.pharmacyName || 'PHARMACORE PHARMACY'}
              </h1>
              <p className="text-[11px] text-slate-600">
                {receiptSettings.address} • Tel: {receiptSettings.phone}
              </p>
              <div className="inline-block px-2.5 py-0.5 mt-1.5 bg-green-100 border border-green-300 rounded text-[11px] font-bold text-green-900 tracking-wide">
                EXPIRE OUT-INVOICE CASH REFUND RECEIPT
              </div>
            </div>

            {/* Receipt Meta */}
            <div className="space-y-1.5 text-[11px] pb-3 border-b border-dashed border-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-600">Receipt Ref:</span>
                <span className="font-mono font-bold">{paymentRecord.PaymentID}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Linked Out-Invoice #:</span>
                <span className="font-mono font-bold text-amber-800">{outInvoice.VoucherNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Supplier Name:</span>
                <span className="font-bold">{outInvoice.SupplierName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Payment Date:</span>
                <span>{new Date(paymentRecord.Date).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Payment Method:</span>
                <span className="font-bold text-slate-800">{paymentRecord.PaymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Received By:</span>
                <span>{paymentRecord.ReceivedBy}</span>
              </div>
            </div>

            {/* Amount Box */}
            <div className="my-4 p-3 bg-green-50 border border-green-200 rounded-lg text-center">
              <div className="text-[10px] text-green-700 font-bold uppercase tracking-wider">
                Cash Refund Amount Received
              </div>
              <div className="text-2xl font-black text-green-800 mt-1">
                {formatCurrency(paymentRecord.Amount)}
              </div>
            </div>

            {/* Breakdown */}
            <div className="space-y-1 text-[11px] border-t border-slate-200 pt-2">
              <div className="flex justify-between text-slate-600">
                <span>Total Out-Invoice Value:</span>
                <span>{formatCurrency(outInvoice.TotalAmount)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Total Cash Refunded to Date:</span>
                <span>{formatCurrency(outInvoice.PaidAmount || paymentRecord.Amount)}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-dashed border-slate-300">
                <span>Remaining Due on Out-Invoice:</span>
                <span className={outInvoice.DueBalance === 0 ? 'text-green-700' : 'text-amber-800'}>
                  {formatCurrency(outInvoice.DueBalance || 0)}
                  {outInvoice.DueBalance === 0 ? ' (Fully Settled)' : ''}
                </span>
              </div>
            </div>

            {/* Notes */}
            {paymentRecord.ReferenceNote && (
              <p className="mt-3 text-[10px] text-slate-500 italic">
                Note: {paymentRecord.ReferenceNote}
              </p>
            )}

            {/* Signature Blocks */}
            <div className="grid grid-cols-2 gap-6 pt-8 text-[10px] text-center border-t border-dashed border-slate-300 mt-5">
              <div>
                <div className="border-b border-slate-400 w-3/4 mx-auto mb-1"></div>
                <p className="font-bold text-slate-800">Cash Received By</p>
                <p className="text-slate-500">{paymentRecord.ReceivedBy}</p>
              </div>
              <div>
                <div className="border-b border-slate-400 w-3/4 mx-auto mb-1"></div>
                <p className="font-bold text-slate-800">Paid By (Supplier)</p>
                <p className="text-slate-500">{outInvoice.SupplierName}</p>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center text-[9px] text-slate-400 mt-5">
              PharmaCore Desktop POS • Verified Cash Transaction Logged to Financial Ledger
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
