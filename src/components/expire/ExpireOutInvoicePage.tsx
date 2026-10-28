/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { usePharmacy } from '../../context/PharmacyContext';
import { Supplier, ExpireVaultItem, ExpireReturnTransaction } from '../../types/pharmacy';
import {
  FileText,
  Building2,
  Phone,
  User,
  Search,
  Plus,
  Trash2,
  Check,
  AlertTriangle,
  Lock,
  Calendar,
  Layers,
  ArrowRight,
  ShieldAlert,
  AlertCircle,
  Printer,
} from 'lucide-react';
import { ExpireOutInvoiceSlipModal } from './ExpirePrintSlips';

interface OutInvoiceLine {
  vaultId: string;
  medicineId: string;
  tradeName: string;
  genericName: string;
  batchNumber: string;
  expiryDate: string;
  maxAvailable: number;
  returnQty: number;
  costPrice: number;
  totalCost: number;
  group?: string;
}

interface ExpireOutInvoicePageProps {
  initialSupplierId?: string;
  initialVaultIds?: string[];
  onNavigateToVaultTree: () => void;
  onNavigateToCashRefund: (invoiceNumber: string) => void;
  onNavigateToInInvoice: (invoiceNumber: string) => void;
}

export const ExpireOutInvoicePage: React.FC<ExpireOutInvoicePageProps> = ({
  initialSupplierId,
  initialVaultIds,
  onNavigateToVaultTree,
  onNavigateToCashRefund,
  onNavigateToInInvoice,
}) => {
  const {
    suppliers,
    expireVault,
    expireTransactions,
    createExpireOutInvoice,
    currentUser,
    users,
    formatCurrency,
    showToast,
  } = usePharmacy();

  // Selected supplier
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(
    initialSupplierId || suppliers[0]?.SupplierID || ''
  );

  const activeSupplier = useMemo(() => {
    return suppliers.find((s) => s.SupplierID === selectedSupplierId) || suppliers[0];
  }, [suppliers, selectedSupplierId]);

  // Representative contact
  const [representativeName, setRepresentativeName] = useState('Mr. Representative');
  const [representativePhone, setRepresentativePhone] = useState(activeSupplier?.Phone || '');
  const [salesmanId, setSalesmanId] = useState(currentUser?.UserID || users[0]?.UserID || 'USR-001');
  const [notes, setNotes] = useState('Supplier representative return dispatch');
  const [group, setReturnGroup] = useState('All Groups');

  // Next invoice number preview
  const nextInvoiceNumber = useMemo(() => {
    return `EXP-OUT-2026-${String(expireTransactions.length + 101).padStart(4, '0')}`;
  }, [expireTransactions.length]);

  // Lines being added to out-invoice
  const [lines, setLines] = useState<OutInvoiceLine[]>([]);

  // Search among items waiting in the vault for the selected supplier
  const [vaultSearchQuery, setVaultSearchQuery] = useState('');

  // Generated slip modal
  const [generatedOutInvoice, setGeneratedOutInvoice] = useState<ExpireReturnTransaction | null>(null);

  // Sync phone when supplier changes
  useEffect(() => {
    if (activeSupplier) {
      setRepresentativePhone(activeSupplier.Phone || '');
    }
  }, [activeSupplier]);

  // 1. STRICT ISOLATION: Get items waiting in vault ONLY for this supplier!
  const eligibleVaultItems = useMemo(() => {
    return expireVault.filter(
      (v) => v.ReturnStatus === 'InVault' && v.SupplierID === selectedSupplierId
    );
  }, [expireVault, selectedSupplierId]);

  // Pre-load initial vault IDs if provided
  useEffect(() => {
    if (initialVaultIds && initialVaultIds.length > 0) {
      const preloaded: OutInvoiceLine[] = [];
      for (const vId of initialVaultIds) {
        const item = expireVault.find((v) => v.VaultID === vId && v.ReturnStatus === 'InVault');
        if (item) {
          preloaded.push({
            vaultId: item.VaultID,
            medicineId: item.MedicineID,
            tradeName: item.TradeName,
            genericName: item.GenericName,
            batchNumber: item.BatchNumber,
            expiryDate: item.ExpiryDate || 'Expired',
            maxAvailable: item.Quantity,
            returnQty: item.Quantity,
            costPrice: item.CostPrice,
            totalCost: Math.round(item.Quantity * item.CostPrice * 100) / 100,
            group: item.Group,
          });
        }
      }
      if (preloaded.length > 0) {
        setLines(preloaded);
      }
    }
  }, [initialVaultIds, expireVault]);

  // Filter eligible vault items by search query
  const searchResultsInVault = useMemo(() => {
    if (!vaultSearchQuery.trim()) return eligibleVaultItems;
    const q = vaultSearchQuery.toLowerCase().trim();
    return eligibleVaultItems.filter(
      (v) =>
        v.TradeName.toLowerCase().includes(q) ||
        v.GenericName.toLowerCase().includes(q) ||
        v.BatchNumber.toLowerCase().includes(q)
    );
  }, [eligibleVaultItems, vaultSearchQuery]);

  const [vaultHighlightIndex, setVaultHighlightIndex] = useState<number>(0);
  const vaultItemRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  useEffect(() => {
    setVaultHighlightIndex(0);
  }, [vaultSearchQuery]);

  const handleVaultSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (searchResultsInVault.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setVaultHighlightIndex((prev) => {
        const next = prev < searchResultsInVault.length - 1 ? prev + 1 : 0;
        vaultItemRefs.current[next]?.scrollIntoView({ block: 'nearest' });
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setVaultHighlightIndex((prev) => {
        const next = prev > 0 ? prev - 1 : searchResultsInVault.length - 1;
        vaultItemRefs.current[next]?.scrollIntoView({ block: 'nearest' });
        return next;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target =
        searchResultsInVault[vaultHighlightIndex] || searchResultsInVault[0];
      if (target) {
        handleAddVaultItemToLines(target);
      }
    } else if (e.key === 'Escape') {
      setVaultSearchQuery('');
    }
  };

  // Add vault item to lines
  const handleAddVaultItemToLines = (vItem: ExpireVaultItem) => {
    // Check if already in lines
    const existing = lines.find((l) => l.vaultId === vItem.VaultID);
    if (existing) {
      showToast(`${vItem.TradeName} is already added to the Out-Invoice list.`, 'info');
      return;
    }

    const newLine: OutInvoiceLine = {
      vaultId: vItem.VaultID,
      medicineId: vItem.MedicineID,
      tradeName: vItem.TradeName,
      genericName: vItem.GenericName,
      batchNumber: vItem.BatchNumber,
      expiryDate: vItem.ExpiryDate || 'Expired',
      maxAvailable: vItem.Quantity,
      returnQty: vItem.Quantity, // Default to full available in vault
      costPrice: vItem.CostPrice,
      totalCost: Math.round(vItem.Quantity * vItem.CostPrice * 100) / 100,
      group: vItem.Group,
    };

    setLines((prev) => [...prev, newLine]);
    setVaultSearchQuery('');
  };

  // Change line quantity
  const handleUpdateLineQty = (vaultId: string, newQty: number) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.vaultId === vaultId) {
          const clamped = Math.max(1, Math.min(newQty, l.maxAvailable));
          return {
            ...l,
            returnQty: clamped,
            totalCost: Math.round(clamped * l.costPrice * 100) / 100,
          };
        }
        return l;
      })
    );
  };

  // Remove line
  const handleRemoveLine = (vaultId: string) => {
    setLines((prev) => prev.filter((l) => l.vaultId !== vaultId));
  };

  // Add all eligible vault items for this supplier
  const handleAddAllVaultItems = () => {
    const unadded = eligibleVaultItems.filter((v) => !lines.some((l) => l.vaultId === v.VaultID));
    if (unadded.length === 0) {
      showToast('All waiting vault items for this supplier are already in the list.', 'info');
      return;
    }
    const newLines = unadded.map((v) => ({
      vaultId: v.VaultID,
      medicineId: v.MedicineID,
      tradeName: v.TradeName,
      genericName: v.GenericName,
      batchNumber: v.BatchNumber,
      expiryDate: v.ExpiryDate || 'Expired',
      maxAvailable: v.Quantity,
      returnQty: v.Quantity,
      costPrice: v.CostPrice,
      totalCost: Math.round(v.Quantity * v.CostPrice * 100) / 100,
      group: v.Group,
    }));
    setLines((prev) => [...prev, ...newLines]);
    showToast(`Added ${newLines.length} vault items to the Out-Invoice list.`, 'success');
  };

  // Calculate totals
  const totalReturnUnits = useMemo(() => {
    return lines.reduce((sum, l) => sum + l.returnQty, 0);
  }, [lines]);

  const totalOutInvoiceAmount = useMemo(() => {
    return Math.round(lines.reduce((sum, l) => sum + l.totalCost, 0) * 100) / 100;
  }, [lines]);

  // Submit and create Out-Invoice
  const handleConfirmOutInvoice = () => {
    if (lines.length === 0) {
      showToast('Please add at least one vault item to create an Expire Out-Invoice.', 'warning');
      return;
    }

    const payload = {
      supplierId: selectedSupplierId,
      group,
      representativeName,
      representativePhone,
      salesmanId,
      salesmanName: users.find((u) => u.UserID === salesmanId)?.FullName || currentUser?.FullName,
      notes,
      items: lines.map((l) => ({
        vaultId: l.vaultId,
        quantity: l.returnQty,
      })),
    };

    const res = createExpireOutInvoice(payload);

    if (res.success && res.outInvoice) {
      showToast(
        `Created Expire Out-Invoice ${res.outInvoice.VoucherNumber} for ${activeSupplier.Name} (${formatCurrency(totalOutInvoiceAmount)}).`,
        'success',
        'Out-Invoice Issued'
      );
      setGeneratedOutInvoice(res.outInvoice);
      setLines([]);
    } else {
      showToast(res.error || 'Failed to create Expire Out-Invoice.', 'error');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-900 overflow-hidden">
      {/* Top Banner: Strict Vault Quarantine Notice */}
      <div className="px-5 py-2.5 bg-amber-950/40 border-b border-amber-500/30 flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center gap-2 text-amber-200">
          <Lock className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong>Strict Vault Isolation Active:</strong> Only expired stock kept in the Expire
            Vault for <strong>{activeSupplier?.Name}</strong> can be added to this Out-Invoice.
            General inventory medicines are strictly blocked.
          </span>
        </div>
        <button
          onClick={onNavigateToVaultTree}
          className="text-xs text-amber-300 hover:text-white underline font-medium"
        >
          View Vault Waiting Tree
        </button>
      </div>

      {/* Main Workspace Frame */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Form: Supplier & Item Picker from Vault */}
        <div className="w-96 bg-slate-950 border-r border-slate-800 flex flex-col shrink-0 overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-400" />
              Supplier & Vault Selection
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Out-Invoice #: <span className="font-mono text-amber-300 font-bold">{nextInvoiceNumber}</span>
            </p>
          </div>

          <div className="p-4 space-y-4 flex-1 overflow-y-auto">
            {/* Supplier Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Target Supplier
              </label>
              <select
                value={selectedSupplierId}
                onChange={(e) => {
                  setSelectedSupplierId(e.target.value);
                  setLines([]); // Clear lines when changing supplier to prevent cross-supplier mixing
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-medium"
              >
                {suppliers.map((s) => (
                  <option key={s.SupplierID} value={s.SupplierID}>
                    {s.Name} ({s.SupplierID})
                  </option>
                ))}
              </select>
            </div>

            {/* Rep Name & Phone */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Representative Name
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={representativeName}
                    onChange={(e) => setRepresentativeName(e.target.value)}
                    placeholder="Mr. Asad / Tanvir"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-2 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Rep Phone
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={representativePhone}
                    onChange={(e) => setRepresentativePhone(e.target.value)}
                    placeholder="+880..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-2 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* Salesman & Group */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Salesman / Pharmacist
                </label>
                <select
                  value={salesmanId}
                  onChange={(e) => setSalesmanId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  {users.map((u) => (
                    <option key={u.UserID} value={u.UserID}>
                      {u.FullName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Classification Group
                </label>
                <select
                  value={group}
                  onChange={(e) => setReturnGroup(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="All Groups">All Groups</option>
                  <option value="General">General</option>
                  <option value="Cardiac">Cardiac</option>
                  <option value="Antibiotic">Antibiotic</option>
                  <option value="Gastroenterology">Gastroenterology</option>
                  <option value="Skin">Skin</option>
                </select>
              </div>
            </div>

            {/* Vault Item Picker Section */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Pick from Vault ({eligibleVaultItems.length} available)</span>
                </label>
                {eligibleVaultItems.length > 0 && (
                  <button
                    type="button"
                    onClick={handleAddAllVaultItems}
                    className="text-[11px] text-amber-400 hover:text-white underline font-medium"
                  >
                    Add All
                  </button>
                )}
              </div>

              {/* Search inside vault for this supplier */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={vaultSearchQuery}
                  onChange={(e) => setVaultSearchQuery(e.target.value)}
                  onKeyDown={handleVaultSearchKeyDown}
                  placeholder={`Search ${activeSupplier?.Name || 'supplier'} vault stock... (↓/↑ to select, Enter to add)`}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* List of eligible vault items */}
              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                {searchResultsInVault.length === 0 ? (
                  <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg text-center text-xs text-slate-500">
                    No waiting items in vault for this supplier.
                  </div>
                ) : (
                  searchResultsInVault.map((item, idx) => {
                    const isAdded = lines.some((l) => l.vaultId === item.VaultID);
                    const isSelected = idx === vaultHighlightIndex;

                    return (
                      <div
                        key={item.VaultID}
                        ref={(el) => { vaultItemRefs.current[idx] = el; }}
                        onMouseEnter={() => setVaultHighlightIndex(idx)}
                        onClick={() => !isAdded && handleAddVaultItemToLines(item)}
                        className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                          isAdded
                            ? 'bg-amber-950/20 border-amber-800/40 opacity-60'
                            : isSelected
                            ? 'bg-amber-950/70 border-amber-500 ring-1 ring-amber-500/50 text-white shadow-md'
                            : 'bg-slate-900 border-slate-800 hover:border-amber-500/50 hover:bg-slate-850'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white truncate max-w-[190px]">
                            {item.TradeName}
                          </span>
                          <span className="font-mono text-emerald-400 font-bold">
                            {formatCurrency(item.CostPrice)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                          <span className="font-mono text-amber-300">Batch: {item.BatchNumber}</span>
                          <span>In Vault: <strong className="text-white">{item.Quantity} units</strong></span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 mt-0.5">
                          <span>Exp: {item.ExpiryDate || 'Expired'}</span>
                          <span className="text-amber-400 font-medium">
                            {isAdded ? '✓ Added to lines' : '+ Click to Add'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Out-Invoice Remarks
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Remarks, representative receipt acknowledgement, reason..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-amber-500 resize-none"
              />
            </div>
          </div>
        </div>

        {/* Right Panel: Active Out-Invoice Items Table & Execution */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-900">
          {/* Header Bar */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Out-Invoice Line Items</span>
                <span className="text-xs font-normal text-slate-400">
                  (Returning to {activeSupplier?.Name})
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Only items currently kept in vault are listed below. Adjust return quantities if returning partially.
              </p>
            </div>

            {lines.length > 0 && (
              <button
                onClick={() => setLines([])}
                className="text-xs text-red-400 hover:text-red-300 font-medium"
              >
                Clear All Lines
              </button>
            )}
          </div>

          {/* Lines Table */}
          <div className="flex-1 overflow-y-auto p-4">
            {lines.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
                <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/60 mb-3 text-amber-400">
                  <FileText className="w-10 h-10" />
                </div>
                <h4 className="text-base font-bold text-white mb-1">
                  No Vault Items Added to Out-Invoice Yet
                </h4>
                <p className="text-xs text-slate-400 max-w-md mb-4">
                  Select medicines from the left panel's <strong>"Pick from Vault"</strong> list.
                  Remember: only stock already quarantined in the Expire Vault is eligible for out-invoicing.
                </p>
                {eligibleVaultItems.length > 0 && (
                  <button
                    onClick={handleAddAllVaultItems}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition-colors shadow-lg shadow-amber-900/30"
                  >
                    Add All {eligibleVaultItems.length} Waiting Vault Items for {activeSupplier?.Name}
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
                      <th className="py-3 px-3">Batch & Expiry</th>
                      <th className="py-3 px-3 text-center">Available in Vault</th>
                      <th className="py-3 px-3 text-center w-36">Return Quantity</th>
                      <th className="py-3 px-3 text-right">Unit Cost</th>
                      <th className="py-3 px-3 text-right">Subtotal (৳)</th>
                      <th className="py-3 px-3 text-center w-12">Remove</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {lines.map((line, idx) => (
                      <tr key={line.vaultId} className="hover:bg-slate-900/60">
                        <td className="py-3 px-3 text-slate-500 font-mono">{idx + 1}</td>

                        <td className="py-3 px-3">
                          <div className="font-bold text-white">{line.tradeName}</div>
                          <div className="text-[11px] text-slate-400">{line.genericName}</div>
                        </td>

                        <td className="py-3 px-3 font-mono">
                          <div className="text-amber-300 font-bold">{line.batchNumber}</div>
                          <div className="text-[10px] text-slate-400">Exp: {line.expiryDate}</div>
                        </td>

                        <td className="py-3 px-3 text-center font-mono">
                          <span className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-300 font-bold">
                            {line.maxAvailable} units
                          </span>
                        </td>

                        {/* Return Quantity input */}
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleUpdateLineQty(line.vaultId, line.returnQty - 1)}
                              className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center justify-center text-xs"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min={1}
                              max={line.maxAvailable}
                              value={line.returnQty}
                              onChange={(e) =>
                                handleUpdateLineQty(line.vaultId, parseInt(e.target.value) || 1)
                              }
                              className="w-16 bg-slate-900 border border-slate-700 rounded py-1 text-center font-mono font-bold text-white text-xs focus:outline-none focus:border-amber-500"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateLineQty(line.vaultId, line.returnQty + 1)}
                              className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center justify-center text-xs"
                            >
                              +
                            </button>
                          </div>
                        </td>

                        <td className="py-3 px-3 text-right font-mono text-slate-300">
                          {formatCurrency(line.costPrice)}
                        </td>

                        <td className="py-3 px-3 text-right font-mono font-bold text-amber-300 text-sm">
                          {formatCurrency(line.totalCost)}
                        </td>

                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => handleRemoveLine(line.vaultId)}
                            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded transition-colors"
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

          {/* Bottom Summary Bar & Confirmation */}
          <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-[11px] text-slate-400 uppercase font-semibold">Total Lines</p>
                <p className="text-base font-bold text-white">{lines.length} items</p>
              </div>

              <div>
                <p className="text-[11px] text-slate-400 uppercase font-semibold">Total Quantity</p>
                <p className="text-base font-bold text-white font-mono">{totalReturnUnits} units</p>
              </div>

              <div>
                <p className="text-[11px] text-slate-400 uppercase font-semibold">
                  Total Out-Invoice Value
                </p>
                <p className="text-xl font-extrabold text-amber-400 font-mono">
                  {formatCurrency(totalOutInvoiceAmount)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onNavigateToVaultTree}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
              >
                Cancel / Return to Vault Tree
              </button>

              <button
                type="button"
                onClick={handleConfirmOutInvoice}
                disabled={lines.length === 0}
                className={`px-6 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all shadow-lg ${
                  lines.length > 0
                    ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/30'
                    : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                }`}
              >
                <Check className="w-4 h-4" />
                <span>Confirm & Generate Expire Out-Invoice</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Generated Slip Modal */}
      <ExpireOutInvoiceSlipModal
        isOpen={!!generatedOutInvoice}
        onClose={() => setGeneratedOutInvoice(null)}
        outInvoice={generatedOutInvoice}
      />
    </div>
  );
};
