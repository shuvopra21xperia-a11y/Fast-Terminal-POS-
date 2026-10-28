/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { usePharmacy } from '../../context/PharmacyContext';
import { ExpireReturnTransaction, Medicine, ExpireInInvoice } from '../../types/pharmacy';
import {
  ArrowRightLeft,
  Search,
  Plus,
  Trash2,
  Check,
  Building2,
  Calendar,
  Layers,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  FileText,
  Boxes,
} from 'lucide-react';
import { ExpireInInvoiceSlipModal } from './ExpirePrintSlips';

interface InInvoiceLine {
  lineId: string;
  medicineId: string;
  tradeName: string;
  genericName: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  costPrice: number;
  sellingPrice: number;
  totalCost: number;
  group?: string;
}

interface ExpireInInvoicePageProps {
  initialOutInvoiceNumber?: string;
  onNavigateToVaultTree: () => void;
  onNavigateToTransactions: () => void;
}

export const ExpireInInvoicePage: React.FC<ExpireInInvoicePageProps> = ({
  initialOutInvoiceNumber,
  onNavigateToVaultTree,
  onNavigateToTransactions,
}) => {
  const {
    expireTransactions,
    expireInInvoices,
    medicines,
    createExpireInInvoice,
    currentUser,
    formatCurrency,
    showToast,
  } = usePharmacy();

  // Pending Out-Invoices eligible for exchange
  const pendingOutInvoices = useMemo(() => {
    return expireTransactions.filter((t) => t.Status !== 'Settled');
  }, [expireTransactions]);

  // Selected Out-Invoice being settled/exchanged
  const [selectedOutInvoiceNum, setSelectedOutInvoiceNum] = useState<string>(() => {
    if (initialOutInvoiceNumber) return initialOutInvoiceNumber;
    return pendingOutInvoices[0]?.VoucherNumber || '';
  });

  const activeOutInvoice = useMemo(() => {
    return (
      expireTransactions.find(
        (t) =>
          t.VoucherNumber.toUpperCase() === selectedOutInvoiceNum.toUpperCase() ||
          t.TransactionID.toUpperCase() === selectedOutInvoiceNum.toUpperCase()
      ) || pendingOutInvoices[0]
    );
  }, [expireTransactions, selectedOutInvoiceNum, pendingOutInvoices]);

  // Next In-Invoice number preview
  const nextInInvoiceNumber = useMemo(() => {
    return `EXP-IN-2026-${String(expireInInvoices.length + 101).padStart(4, '0')}`;
  }, [expireInInvoices.length]);

  // Replacement fresh medicine lines
  const [lines, setLines] = useState<InInvoiceLine[]>([]);
  const [inInvoiceNotes, setInInvoiceNotes] = useState('');

  // Medicine catalog search for adding fresh medicines
  const [medicineSearchQuery, setMedicineSearchQuery] = useState('');

  // Generated slip modal
  const [generatedInInvoice, setGeneratedInInvoice] = useState<ExpireInInvoice | null>(null);

  // Auto-fill lines from returned items on Out-Invoice
  const handleAutoFillFromReturnedItems = () => {
    if (!activeOutInvoice || !activeOutInvoice.Items) return;

    // Generate fresh expiry date (2 years in future)
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 2);
    const defaultFutureExpiry = futureDate.toISOString().split('T')[0];

    const prefilledLines: InInvoiceLine[] = activeOutInvoice.Items.map((item, idx) => {
      const med = medicines.find((m) => m.MedicineID === item.MedicineID);
      const randomSuffix = String.fromCharCode(65 + Math.floor(Math.random() * 26));

      return {
        lineId: `line-${Date.now()}-${idx}`,
        medicineId: item.MedicineID,
        tradeName: item.TradeName,
        genericName: item.GenericName,
        batchNumber: `${item.BatchNumber.slice(0, 3)}-26${randomSuffix}01`,
        expiryDate: defaultFutureExpiry,
        quantity: item.Quantity,
        costPrice: item.CostPrice,
        sellingPrice: med?.MRP || item.CostPrice * 1.35,
        totalCost: Math.round(item.Quantity * item.CostPrice * 100) / 100,
        group: item.Group,
      };
    });

    setLines(prefilledLines);
    showToast(
      `Populated ${prefilledLines.length} replacement lines matching returned items. Update batch # and expiry as needed.`,
      'info',
      'Auto-Filled from Out-Invoice'
    );
  };

  // Medicine search results from active catalog
  const filteredCatalogMedicines = useMemo(() => {
    if (!medicineSearchQuery.trim()) return [];
    const q = medicineSearchQuery.toLowerCase().trim();
    return medicines
      .filter(
        (m) =>
          m.Status === 'Active' &&
          (m.TradeName.toLowerCase().includes(q) ||
            m.GenericName.toLowerCase().includes(q) ||
            m.Barcode.toLowerCase().includes(q))
      )
      .slice(0, 6);
  }, [medicines, medicineSearchQuery]);

  const [catalogHighlightIndex, setCatalogHighlightIndex] = useState<number>(0);

  useEffect(() => {
    setCatalogHighlightIndex(0);
  }, [medicineSearchQuery]);

  const handleMedicineSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (filteredCatalogMedicines.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCatalogHighlightIndex((prev) =>
        prev < filteredCatalogMedicines.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCatalogHighlightIndex((prev) =>
        prev > 0 ? prev - 1 : filteredCatalogMedicines.length - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target =
        filteredCatalogMedicines[catalogHighlightIndex] || filteredCatalogMedicines[0];
      if (target) {
        handleAddMedicineLine(target);
      }
    } else if (e.key === 'Escape') {
      setMedicineSearchQuery('');
    }
  };

  // Add individual medicine line from search
  const handleAddMedicineLine = (med: Medicine) => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 2);
    const defaultFutureExpiry = futureDate.toISOString().split('T')[0];

    const newLine: InInvoiceLine = {
      lineId: `line-${Date.now()}`,
      medicineId: med.MedicineID,
      tradeName: med.TradeName,
      genericName: med.GenericName,
      batchNumber: `EX-${Date.now().toString().slice(-4)}`,
      expiryDate: defaultFutureExpiry,
      quantity: 10,
      costPrice: Math.round((med.MRP * 0.8) * 100) / 100,
      sellingPrice: med.MRP,
      totalCost: Math.round(10 * (med.MRP * 0.8) * 100) / 100,
      group: med.Group,
    };

    setLines((prev) => [...prev, newLine]);
    setMedicineSearchQuery('');
  };

  // Update line field
  const handleUpdateLine = (lineId: string, updates: Partial<InInvoiceLine>) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.lineId === lineId) {
          const merged = { ...l, ...updates };
          merged.totalCost = Math.round(merged.quantity * merged.costPrice * 100) / 100;
          return merged;
        }
        return l;
      })
    );
  };

  // Remove line
  const handleRemoveLine = (lineId: string) => {
    setLines((prev) => prev.filter((l) => l.lineId !== lineId));
  };

  // Totals
  const totalReplacementUnits = useMemo(() => {
    return lines.reduce((sum, l) => sum + l.quantity, 0);
  }, [lines]);

  const totalReplacementAmount = useMemo(() => {
    return Math.round(lines.reduce((sum, l) => sum + l.totalCost, 0) * 100) / 100;
  }, [lines]);

  const outInvoiceAmount = activeOutInvoice?.TotalAmount || 0;
  const valueDelta = Math.round((totalReplacementAmount - outInvoiceAmount) * 100) / 100;

  // Confirm In-Invoice
  const handleConfirmInInvoice = () => {
    if (!activeOutInvoice) {
      showToast('Select an Expire Out-Invoice being settled.', 'warning');
      return;
    }
    if (lines.length === 0) {
      showToast('Please add at least one fresh replacement medicine to the In-Invoice.', 'warning');
      return;
    }

    // Validate all lines have batch and expiry
    for (const l of lines) {
      if (!l.batchNumber.trim()) {
        showToast(`Please enter a valid batch number for ${l.tradeName}.`, 'warning');
        return;
      }
      if (!l.expiryDate) {
        showToast(`Please enter a valid expiry date for ${l.tradeName}.`, 'warning');
        return;
      }
      if (l.quantity <= 0) {
        showToast(`Quantity must be greater than zero for ${l.tradeName}.`, 'warning');
        return;
      }
    }

    const res = createExpireInInvoice({
      outInvoiceNumber: activeOutInvoice.VoucherNumber,
      supplierId: activeOutInvoice.SupplierID,
      notes: inInvoiceNotes || `Good medicine exchange against Out-Invoice #${activeOutInvoice.VoucherNumber}`,
      items: lines.map((l) => ({
        medicineId: l.medicineId,
        tradeName: l.tradeName,
        genericName: l.genericName,
        batchNumber: l.batchNumber,
        expiryDate: l.expiryDate,
        quantity: l.quantity,
        costPrice: l.costPrice,
        sellingPrice: l.sellingPrice,
        group: l.group,
      })),
    });

    if (res.success && res.inInvoice) {
      showToast(
        `Created Expire In-Invoice ${res.inInvoice.InInvoiceNumber}. Added ${totalReplacementUnits} fresh units directly to active inventory.`,
        'success',
        'Stock Updated & Settled'
      );
      setGeneratedInInvoice(res.inInvoice);
      setLines([]);
    } else {
      showToast(res.error || 'Failed to create Expire In-Invoice.', 'error');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-900 overflow-hidden">
      {/* Top Banner: Auto Inventory Increment Notice */}
      <div className="px-5 py-2.5 bg-emerald-950/40 border-b border-emerald-500/30 flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center gap-2 text-emerald-200">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            <strong>Automatic Inventory & Audit Integration:</strong> Confirming this Expire
            In-Invoice will immediately add fresh batches to active inventory stock counts and mark
            the Out-Invoice as <strong>Settled (Medicine Exchange)</strong>.
          </span>
        </div>
        <button
          onClick={onNavigateToTransactions}
          className="text-xs text-emerald-300 hover:text-white underline font-medium"
        >
          View All Transactions
        </button>
      </div>

      {/* Main Split Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Select Out-Invoice & Reference Information */}
        <aside className="w-96 bg-slate-950 border-r border-slate-800 flex flex-col shrink-0 overflow-hidden">
          <div className="p-4 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-emerald-400" />
              Settling Out-Invoice
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              In-Invoice #: <span className="font-mono text-emerald-300 font-bold">{nextInInvoiceNumber}</span>
            </p>
          </div>

          <div className="p-4 space-y-4 flex-1 overflow-y-auto">
            {/* Out-Invoice Picker */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Select Pending Expire Out-Invoice
              </label>
              {pendingOutInvoices.length === 0 ? (
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-400">
                  No pending Out-Invoices available.
                </div>
              ) : (
                <select
                  value={selectedOutInvoiceNum}
                  onChange={(e) => {
                    setSelectedOutInvoiceNum(e.target.value);
                    setLines([]); // Clear lines to re-sync
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono font-medium"
                >
                  {pendingOutInvoices.map((tx) => (
                    <option key={tx.TransactionID} value={tx.VoucherNumber}>
                      {tx.VoucherNumber} • {tx.SupplierName} ({formatCurrency(tx.TotalAmount)})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Out-Invoice Reference Card */}
            {activeOutInvoice && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    {activeOutInvoice.SupplierName}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    {activeOutInvoice.Status}
                  </span>
                </div>

                <div className="grid grid-cols-2 text-xs text-slate-400 gap-1 border-t border-slate-800/80 pt-2 font-mono">
                  <div>
                    <span>Total Out Qty:</span>{' '}
                    <strong className="text-white">{activeOutInvoice.TotalQuantity} pcs</strong>
                  </div>
                  <div className="text-right">
                    <span>Return Value:</span>{' '}
                    <strong className="text-amber-400 font-bold">
                      {formatCurrency(activeOutInvoice.TotalAmount)}
                    </strong>
                  </div>
                </div>

                {/* Returned Items Preview */}
                <div className="border-t border-slate-800/80 pt-2">
                  <div className="flex items-center justify-between text-[11px] mb-1.5">
                    <span className="font-semibold text-slate-300">Quarantined Stock Returned:</span>
                    <button
                      type="button"
                      onClick={handleAutoFillFromReturnedItems}
                      className="text-xs text-emerald-400 hover:text-white underline font-bold"
                    >
                      ⚡ Auto-fill Replacement Lines
                    </button>
                  </div>

                  <div className="max-h-36 overflow-y-auto space-y-1 pr-1 text-[11px]">
                    {activeOutInvoice.Items.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-1.5 bg-slate-950/60 rounded border border-slate-800/80 flex items-center justify-between text-slate-300"
                      >
                        <div className="truncate max-w-[170px]">
                          <span className="font-semibold">{item.TradeName}</span>
                          <span className="text-[10px] text-slate-500 ml-1 font-mono">({item.BatchNumber})</span>
                        </div>
                        <div className="font-mono text-slate-400">
                          {item.Quantity} pcs ({formatCurrency(item.TotalCost)})
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Catalog Medicine Search */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">
                Add Other Fresh Medicine from Catalog
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={medicineSearchQuery}
                  onChange={(e) => setMedicineSearchQuery(e.target.value)}
                  onKeyDown={handleMedicineSearchKeyDown}
                  placeholder="Search medicine catalog to receive... (↓/↑ to select, Enter to add)"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {filteredCatalogMedicines.length > 0 && (
                <div className="border border-slate-800 bg-slate-900 rounded-lg divide-y divide-slate-800 text-xs overflow-hidden shadow-lg">
                  {filteredCatalogMedicines.map((med, idx) => {
                    const isSelected = idx === catalogHighlightIndex;
                    return (
                      <div
                        key={med.MedicineID}
                        onMouseEnter={() => setCatalogHighlightIndex(idx)}
                        onClick={() => handleAddMedicineLine(med)}
                        className={`p-2 cursor-pointer flex items-center justify-between transition-colors ${
                          isSelected
                            ? 'bg-emerald-950/80 border-l-4 border-l-emerald-500 text-white'
                            : 'hover:bg-slate-800 text-slate-300'
                        }`}
                      >
                        <div>
                          <div className="font-bold flex items-center gap-1.5">
                            {isSelected && (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                            )}
                            <span className={isSelected ? 'text-white' : 'text-slate-100'}>{med.TradeName}</span>
                          </div>
                          <div className="text-[10px] text-slate-400">{med.GenericName}</div>
                        </div>
                        <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">+ Add</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* In-Invoice Remarks */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                In-Invoice Remarks
              </label>
              <textarea
                rows={2}
                value={inInvoiceNotes}
                onChange={(e) => setInInvoiceNotes(e.target.value)}
                placeholder="Batch quality inspection remarks, invoice details..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-emerald-500 resize-none"
              />
            </div>
          </div>
        </aside>

        {/* Right Main Table: Replacement Fresh Medicines */}
        <main className="flex-1 flex flex-col overflow-hidden bg-slate-900">
          {/* Header */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Fresh Replacement Medicines to Stock</span>
              </h2>
              <p className="text-xs text-slate-400">
                Enter fresh batch numbers and verified future expiry dates. These will be added into active inventory stock.
              </p>
            </div>

            {lines.length > 0 && (
              <button
                onClick={() => setLines([])}
                className="text-xs text-red-400 hover:text-red-300 font-medium"
              >
                Clear Lines
              </button>
            )}
          </div>

          {/* Table */}
          <div className="flex-1 overflow-y-auto p-4">
            {lines.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
                <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/60 mb-3 text-emerald-400">
                  <Boxes className="w-10 h-10" />
                </div>
                <h4 className="text-base font-bold text-white mb-1">
                  No Replacement Medicine Lines Added Yet
                </h4>
                <p className="text-xs text-slate-400 max-w-md mb-4">
                  Click <strong>"Auto-fill Replacement Lines"</strong> in the left panel to quickly populate lines corresponding to the returned Out-Invoice stock, or search the medicine catalog.
                </p>
                {activeOutInvoice && (
                  <button
                    onClick={handleAutoFillFromReturnedItems}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors shadow-lg shadow-emerald-900/30 flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    Auto-Fill Replacement Stock from #{activeOutInvoice.VoucherNumber}
                  </button>
                )}
              </div>
            ) : (
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60 shadow-sm">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-3">#</th>
                      <th className="py-3 px-3">Medicine & Generic</th>
                      <th className="py-3 px-3 w-32">Fresh Batch #</th>
                      <th className="py-3 px-3 w-36">Fresh Expiry Date</th>
                      <th className="py-3 px-3 text-center w-28">Quantity</th>
                      <th className="py-3 px-3 text-right w-28">Cost Price (৳)</th>
                      <th className="py-3 px-3 text-right w-28">Selling MRP (৳)</th>
                      <th className="py-3 px-3 text-right">Subtotal (৳)</th>
                      <th className="py-3 px-3 text-center w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {lines.map((line, idx) => (
                      <tr key={line.lineId} className="hover:bg-slate-900/60">
                        <td className="py-3 px-3 text-slate-500 font-mono">{idx + 1}</td>

                        <td className="py-3 px-3">
                          <div className="font-bold text-white">{line.tradeName}</div>
                          <div className="text-[11px] text-slate-400">{line.genericName}</div>
                        </td>

                        {/* Batch Number Input */}
                        <td className="py-3 px-3">
                          <input
                            type="text"
                            value={line.batchNumber}
                            onChange={(e) =>
                              handleUpdateLine(line.lineId, { batchNumber: e.target.value.toUpperCase() })
                            }
                            placeholder="NP-26A01"
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-emerald-300 font-mono font-bold focus:outline-none focus:border-emerald-500"
                          />
                        </td>

                        {/* Expiry Date Input */}
                        <td className="py-3 px-3">
                          <input
                            type="date"
                            value={line.expiryDate}
                            onChange={(e) =>
                              handleUpdateLine(line.lineId, { expiryDate: e.target.value })
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                          />
                        </td>

                        {/* Quantity */}
                        <td className="py-3 px-3 text-center">
                          <input
                            type="number"
                            min={1}
                            value={line.quantity}
                            onChange={(e) =>
                              handleUpdateLine(line.lineId, { quantity: parseInt(e.target.value) || 1 })
                            }
                            className="w-16 bg-slate-900 border border-slate-700 rounded py-1 text-center font-mono font-bold text-white text-xs focus:outline-none focus:border-emerald-500"
                          />
                        </td>

                        {/* Cost Price */}
                        <td className="py-3 px-3 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={line.costPrice}
                            onChange={(e) =>
                              handleUpdateLine(line.lineId, { costPrice: parseFloat(e.target.value) || 0 })
                            }
                            className="w-20 bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-right font-mono text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                          />
                        </td>

                        {/* Selling Price */}
                        <td className="py-3 px-3 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={line.sellingPrice}
                            onChange={(e) =>
                              handleUpdateLine(line.lineId, { sellingPrice: parseFloat(e.target.value) || 0 })
                            }
                            className="w-20 bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-right font-mono text-emerald-300 text-xs focus:outline-none focus:border-emerald-500"
                          />
                        </td>

                        {/* Subtotal */}
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400 text-sm">
                          {formatCurrency(line.totalCost)}
                        </td>

                        {/* Remove */}
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => handleRemoveLine(line.lineId)}
                            className="p-1.5 text-slate-500 hover:text-red-400 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Bottom Reconciliation & Confirmation Bar */}
          <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-[11px] text-slate-400 uppercase font-semibold">Out-Invoice Value</p>
                <p className="text-sm font-bold text-amber-400 font-mono">
                  {formatCurrency(outInvoiceAmount)}
                </p>
              </div>

              <div>
                <p className="text-[11px] text-slate-400 uppercase font-semibold">Replacement Value</p>
                <p className="text-sm font-bold text-emerald-400 font-mono">
                  {formatCurrency(totalReplacementAmount)} ({totalReplacementUnits} units)
                </p>
              </div>

              <div>
                <p className="text-[11px] text-slate-400 uppercase font-semibold">Reconciliation Delta</p>
                <p
                  className={`text-sm font-bold font-mono ${
                    valueDelta === 0
                      ? 'text-emerald-400'
                      : valueDelta > 0
                      ? 'text-sky-400'
                      : 'text-amber-400'
                  }`}
                >
                  {valueDelta === 0 ? '✓ Balanced (৳ 0.00)' : formatCurrency(valueDelta)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onNavigateToVaultTree}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmInInvoice}
                disabled={lines.length === 0}
                className={`px-6 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all shadow-lg ${
                  lines.length > 0
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30'
                    : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                }`}
              >
                <Check className="w-4 h-4" />
                <span>Confirm Expire In-Invoice & Increment Active Stock</span>
              </button>
            </div>
          </div>
        </main>
      </div>

      {/* Generated Slip Modal */}
      <ExpireInInvoiceSlipModal
        isOpen={!!generatedInInvoice}
        onClose={() => setGeneratedInInvoice(null)}
        inInvoice={generatedInInvoice}
      />
    </div>
  );
};
