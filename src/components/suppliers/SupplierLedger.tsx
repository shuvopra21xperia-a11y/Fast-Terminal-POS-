/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Module C: Supplier Management & Payable Ledger
 * Features:
 * - Interactive Search Bar with live dropdown & keyboard navigation (ArrowDown/Up + Enter to open history)
 * - Clickable Supplier Names with instant drill-down to all data & history
 * - Clear, responsive summary dashboard for quick insights
 * - Comprehensive supplier modal (date-wise invoices, searchable by invoice # and medicine name, payment history, medicines, vault returns, statement)
 * - Due payments settlement & new supplier registration
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { usePharmacy } from '../../context/PharmacyContext';
import { Supplier } from '../../types/pharmacy';
import { SupplierSummaryDashboard } from './SupplierSummaryDashboard';
import { SupplierDetailModal } from './SupplierDetailModal';
import {
  Building2,
  Search,
  Plus,
  DollarSign,
  Percent,
  CheckCircle2,
  X,
  CreditCard,
  FileText,
  CornerDownLeft,
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Phone,
  MapPin,
  Tag,
  AlertTriangle,
} from 'lucide-react';

export const SupplierLedger: React.FC = () => {
  const {
    suppliers,
    purchases,
    dueCollections,
    expireVault,
    medicines,
    batches,
    addSupplier,
    updateSupplier,
    recordDueCollection,
    currentUser,
    showToast,
    formatCurrency,
  } = usePharmacy();

  // Active supplier history modal
  const [selectedSupplierForDetail, setSelectedSupplierForDetail] = useState<Supplier | null>(null);

  // Search and keyboard navigation state
  const [search, setSearch] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchDropdownRef = useRef<HTMLDivElement>(null);

  // Filter states
  const [statusFilter, setStatusFilter] = useState<'all' | 'due' | 'settled'>('all');
  const [selectedGroup, setSelectedGroup] = useState<string>('All');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [payingSupplier, setPayingSupplier] = useState<Supplier | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<'Cash' | 'Bank Transfer' | 'MFS'>('Bank Transfer');
  const [payNotes, setPayNotes] = useState('');

  // Add Supplier Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [defaultDiscount, setDefaultDiscount] = useState<number>(3.0);
  const [groupsHandled, setGroupsHandled] = useState<string>('General');

  // Filter suppliers matching search and filters
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      // Status filter
      if (statusFilter === 'due' && s.TotalDue <= 0) return false;
      if (statusFilter === 'settled' && s.TotalDue > 0) return false;

      // Group filter
      if (selectedGroup !== 'All' && !(s.GroupsHandled || []).includes(selectedGroup)) {
        return false;
      }

      // Search term
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        s.Name.toLowerCase().includes(q) ||
        s.SupplierID.toLowerCase().includes(q) ||
        s.Phone.toLowerCase().includes(q) ||
        s.Address.toLowerCase().includes(q) ||
        (s.GroupsHandled || []).some((g) => g.toLowerCase().includes(q))
      );
    });
  }, [suppliers, search, statusFilter, selectedGroup]);

  // Autocomplete suggestions for search dropdown
  const searchDropdownMatches = useMemo(() => {
    if (!search.trim()) {
      return suppliers.slice(0, 5); // show first 5 on focus
    }
    const q = search.toLowerCase();
    return suppliers.filter(
      (s) =>
        s.Name.toLowerCase().includes(q) ||
        s.SupplierID.toLowerCase().includes(q) ||
        s.Phone.toLowerCase().includes(q) ||
        s.Address.toLowerCase().includes(q) ||
        (s.GroupsHandled || []).some((g) => g.toLowerCase().includes(q))
    );
  }, [suppliers, search]);

  // Keep highlightedIndex within bounds
  useEffect(() => {
    if (searchDropdownMatches.length === 0) {
      setHighlightedIndex(-1);
    } else if (highlightedIndex >= searchDropdownMatches.length) {
      setHighlightedIndex(searchDropdownMatches.length - 1);
    }
  }, [searchDropdownMatches.length, highlightedIndex]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        searchDropdownRef.current &&
        !searchDropdownRef.current.contains(e.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(e.target as Node)
      ) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Keyboard navigation on search input
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (searchDropdownMatches.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsSearchFocused(true);
      setHighlightedIndex((prev) => {
        const next = prev + 1;
        return next >= searchDropdownMatches.length ? 0 : next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIsSearchFocused(true);
      setHighlightedIndex((prev) => {
        const next = prev - 1;
        return next < 0 ? searchDropdownMatches.length - 1 : next;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const targetSupplier =
        highlightedIndex >= 0 && highlightedIndex < searchDropdownMatches.length
          ? searchDropdownMatches[highlightedIndex]
          : searchDropdownMatches[0];

      if (targetSupplier) {
        handleOpenSupplierDetail(targetSupplier);
        setIsSearchFocused(false);
      }
    } else if (e.key === 'Escape') {
      setIsSearchFocused(false);
      setHighlightedIndex(-1);
    }
  };

  const handleOpenSupplierDetail = (supplier: Supplier) => {
    // Look up freshest state from context
    const fresh = suppliers.find((s) => s.SupplierID === supplier.SupplierID) || supplier;
    setSelectedSupplierForDetail(fresh);
    setIsSearchFocused(false);
  };

  const handleCreateSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const grpArray = groupsHandled
      .split(',')
      .map((g) => g.trim())
      .filter(Boolean);

    addSupplier({
      Name: name.trim(),
      Phone: phone.trim() || 'N/A',
      Address: address.trim() || 'Headquarters, Dhaka',
      DefaultDiscountPercent: Number(defaultDiscount) || 0,
      GroupsHandled: grpArray.length > 0 ? grpArray : ['General'],
    });

    showToast(`Supplier ${name.trim()} added successfully.`, 'success', 'Supplier Registered');
    setName('');
    setPhone('');
    setAddress('');
    setDefaultDiscount(3.0);
    setGroupsHandled('General');
    setIsAddModalOpen(false);
  };

  const handleOpenPay = (s: Supplier) => {
    setPayingSupplier(s);
    setPayAmount(s.TotalDue);
    setPayMethod('Bank Transfer');
    setPayNotes(`Supplier invoice settlement disbursement`);
  };

  const handleConfirmPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingSupplier || payAmount <= 0) return;

    recordDueCollection({
      EntityType: 'Supplier',
      EntityID: payingSupplier.SupplierID,
      EntityName: payingSupplier.Name,
      Amount: payAmount,
      PaymentMethod: payMethod,
      ReceivedBy: currentUser?.FullName || 'Chief Pharmacist',
      Notes: payNotes,
    });

    showToast(
      `Disbursed payment of ${formatCurrency(payAmount)} to ${payingSupplier.Name}.`,
      'success',
      'Payment Recorded'
    );

    // If modal is open for this supplier, update its balance
    if (selectedSupplierForDetail && selectedSupplierForDetail.SupplierID === payingSupplier.SupplierID) {
      setSelectedSupplierForDetail((prev) =>
        prev ? { ...prev, TotalDue: Math.max(0, prev.TotalDue - payAmount) } : null
      );
    }

    setPayingSupplier(null);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-900 select-none">
      {/* Module Title Bar */}
      <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white tracking-tight">
              Supplier Management & Payable Ledger
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Module C · Pharmaceutical vendor profiles, date-wise purchase invoices, payment history, and accounts payable balances.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>New Supplier Profile</span>
          </button>
        </div>
      </div>

      {/* Summary Dashboard for Quick Insights */}
      <SupplierSummaryDashboard
        suppliers={suppliers}
        purchases={purchases}
        dueCollections={dueCollections}
        expireVault={expireVault}
        formatCurrency={formatCurrency}
        selectedFilter={statusFilter}
        onSelectFilter={setStatusFilter}
        selectedGroup={selectedGroup}
        onSelectGroup={setSelectedGroup}
        onOpenSupplier={handleOpenSupplierDetail}
      />

      {/* Filter and Search Bar with Keyboard Navigation Support */}
      <div className="p-3 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Interactive Search Bar Container */}
        <div className="relative flex-1 min-w-[320px] max-w-xl">
          <Search className="w-4 h-4 text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            ref={searchInputRef}
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setIsSearchFocused(true);
              setHighlightedIndex(0);
            }}
            onFocus={() => {
              setIsSearchFocused(true);
              if (highlightedIndex < 0 && searchDropdownMatches.length > 0) {
                setHighlightedIndex(0);
              }
            }}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search suppliers by Name, Contact, ID, or Group... (↓ / ↑ to navigate, Enter to open)"
            className="w-full pl-9 pr-28 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />

          {/* Keyboard Navigation Cue Badge */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px] text-slate-400 font-mono bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 pointer-events-none">
            <span className="flex items-center gap-0.5">
              <ArrowDown className="w-2.5 h-2.5" />
              <ArrowUp className="w-2.5 h-2.5" />
            </span>
            <span className="text-slate-600">|</span>
            <CornerDownLeft className="w-2.5 h-2.5 text-emerald-400" />
            <span>Open</span>
          </div>

          {/* Interactive Keyboard Suggestion Dropdown */}
          {isSearchFocused && searchDropdownMatches.length > 0 && (
            <div
              ref={searchDropdownRef}
              className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-slate-950 border border-slate-700 rounded-lg shadow-2xl overflow-hidden max-h-80 overflow-y-auto"
            >
              <div className="p-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                <span className="font-semibold text-slate-300">
                  Quick Select Supplier ({searchDropdownMatches.length} matching)
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  Press [↓ / ↑] to select · [Enter] to open all data
                </span>
              </div>

              <div className="divide-y divide-slate-850">
                {searchDropdownMatches.map((s, idx) => {
                  const isHighlighted = idx === highlightedIndex;
                  const hasDue = s.TotalDue > 0;

                  return (
                    <div
                      key={s.SupplierID}
                      onClick={() => handleOpenSupplierDetail(s)}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      className={`p-2.5 cursor-pointer flex items-center justify-between gap-3 transition-colors ${
                        isHighlighted
                          ? 'bg-emerald-950/60 border-l-4 border-l-emerald-500 text-white'
                          : 'hover:bg-slate-900 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
                            isHighlighted
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-900 border border-slate-800 text-slate-400'
                          }`}
                        >
                          <Building2 className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                            <span className="truncate">{s.Name}</span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-850 text-slate-400">
                              {s.SupplierID}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5 truncate">
                            <span className="font-mono">{s.Phone}</span>
                            <span>·</span>
                            <span className="truncate max-w-[200px]">{s.Address}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 text-right">
                        <div>
                          <div className="text-[10px] text-slate-500 uppercase">Payable Due</div>
                          <div
                            className={`font-mono font-bold text-xs ${
                              hasDue ? 'text-amber-400' : 'text-slate-400'
                            }`}
                          >
                            {formatCurrency(s.TotalDue)}
                          </div>
                        </div>

                        {isHighlighted && (
                          <div className="px-2 py-1 rounded bg-emerald-600 text-white font-semibold text-[10px] flex items-center gap-1 shadow-xs">
                            <CornerDownLeft className="w-3 h-3" />
                            <span>Press Enter</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Informative Guidance */}
        <div className="flex items-center gap-4 text-slate-400 text-[11px]">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
            <span>Click any Supplier Name to open his complete date-wise history</span>
          </span>
          <span className="text-slate-600">|</span>
          <span>Fallback Rule: 0% discount medicines inherit Supplier Default Discount.</span>
        </div>
      </div>

      {/* Main Suppliers Data Table */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                <th className="p-3">Company & Partner Name (Clickable)</th>
                <th className="p-3">Contact Phone</th>
                <th className="p-3">Office Address</th>
                <th className="p-3">Therapeutic Groups</th>
                <th className="p-3 text-center">Default Discount</th>
                <th className="p-3 text-right">Total Payable Due</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850">
              {filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    <Building2 className="w-8 h-8 mx-auto text-slate-600 mb-2 opacity-50" />
                    <p className="text-sm font-medium text-slate-400">No suppliers match your filter criteria.</p>
                    <p className="text-xs text-slate-600 mt-1">Try modifying the search term or status filter.</p>
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map((s) => {
                  const hasDue = s.TotalDue > 0;
                  const supplierPurchases = purchases.filter(
                    (p) => p.SupplierID === s.SupplierID || p.SupplierName.toLowerCase() === s.Name.toLowerCase()
                  );

                  return (
                    <tr
                      key={s.SupplierID}
                      className="hover:bg-slate-900/60 transition-colors group/row"
                    >
                      {/* Clickable Supplier Name */}
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => handleOpenSupplierDetail(s)}
                          className="text-left group/btn flex items-center gap-1.5 focus:outline-hidden"
                          title="Click to view all data and history for this supplier"
                        >
                          <span className="font-semibold text-emerald-400 group-hover/btn:text-emerald-300 group-hover/btn:underline text-sm transition-colors cursor-pointer flex items-center gap-1.5">
                            <span>{s.Name}</span>
                            <ExternalLink className="w-3.5 h-3.5 text-emerald-500/70 group-hover/btn:text-emerald-300 transition-colors" />
                          </span>
                        </button>
                        <div className="flex items-center gap-2 text-slate-500 text-[10px] font-mono mt-0.5">
                          <span>ID: {s.SupplierID}</span>
                          <span>·</span>
                          <span>{supplierPurchases.length} invoices on file</span>
                        </div>
                      </td>

                      <td className="p-3 font-mono text-slate-300">
                        <div className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-500" />
                          <span>{s.Phone}</span>
                        </div>
                      </td>

                      <td className="p-3 text-slate-400 max-w-xs truncate" title={s.Address}>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                          <span className="truncate">{s.Address}</span>
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="flex items-center gap-1 flex-wrap max-w-xs">
                          {(s.GroupsHandled || ['General']).slice(0, 3).map((grp) => (
                            <span
                              key={grp}
                              className="px-1.5 py-0.5 rounded text-[10px] bg-slate-850 text-slate-300 border border-slate-750"
                            >
                              {grp}
                            </span>
                          ))}
                          {(s.GroupsHandled || []).length > 3 && (
                            <span className="text-[10px] text-slate-500 font-mono">
                              +{(s.GroupsHandled || []).length - 3}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-3 text-center font-mono">
                        <span className="bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 px-2 py-0.5 rounded font-bold">
                          {s.DefaultDiscountPercent}%
                        </span>
                      </td>

                      <td className="p-3 text-right font-mono">
                        <span
                          className={`text-sm font-bold ${
                            hasDue ? 'text-amber-400' : 'text-slate-400'
                          }`}
                        >
                          {formatCurrency(s.TotalDue)}
                        </span>
                      </td>

                      {/* Action buttons */}
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenSupplierDetail(s)}
                            className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-xs flex items-center gap-1 transition-colors"
                            title="View complete date-wise invoice and payment history"
                          >
                            <FileText className="w-3.5 h-3.5 text-emerald-400" />
                            <span>All History</span>
                          </button>

                          {hasDue ? (
                            <button
                              type="button"
                              onClick={() => handleOpenPay(s)}
                              className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-1 shadow-sm transition-colors"
                              title="Disburse payment for outstanding due"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                              <span>Pay Due</span>
                            </button>
                          ) : (
                            <span className="px-2.5 py-1 text-[11px] text-emerald-400 italic font-mono bg-emerald-950/40 rounded border border-emerald-800/30">
                              Settled
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Supplier All Data & History Modal */}
      {selectedSupplierForDetail && (
        <SupplierDetailModal
          supplier={selectedSupplierForDetail}
          onClose={() => setSelectedSupplierForDetail(null)}
          purchases={purchases}
          dueCollections={dueCollections}
          expireVault={expireVault}
          medicines={medicines}
          batches={batches}
          formatCurrency={formatCurrency}
          onOpenPay={(s) => {
            handleOpenPay(s);
          }}
        />
      )}

      {/* Pay Due Modal */}
      {payingSupplier && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-slate-950 border border-slate-700 rounded-lg shadow-2xl max-w-md w-full overflow-hidden text-xs">
            <div className="flex justify-between items-center p-4 border-b border-slate-800 bg-slate-900">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <h3 className="font-semibold text-white text-sm">
                  Disburse Payment: {payingSupplier.Name}
                </h3>
              </div>
              <button
                onClick={() => setPayingSupplier(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmPayment} className="p-4 space-y-3">
              <div className="bg-slate-900 p-2.5 rounded border border-slate-800 text-slate-300 flex justify-between items-center font-mono">
                <span>Total Payable Outstanding:</span>
                <span className="font-bold text-amber-400 text-sm">
                  {formatCurrency(payingSupplier.TotalDue)}
                </span>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Disbursement Amount ($) *</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max={payingSupplier.TotalDue}
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white font-mono text-sm font-semibold focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Payment Method</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white focus:outline-hidden focus:border-emerald-500"
                >
                  <option value="Bank Transfer">Bank Wire / Account Payee Cheque</option>
                  <option value="Cash">Cash Voucher</option>
                  <option value="MFS">Corporate MFS / Digital Transfer</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Cheque / Reference Number / Bank Details</label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="e.g. Cheque #884920 City Bank Principal Branch"
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPayingSupplier(null)}
                  className="px-3 py-1.5 rounded bg-slate-900 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-sm"
                >
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Supplier Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-slate-950 border border-slate-700 rounded-lg shadow-2xl max-w-md w-full overflow-hidden text-xs">
            <div className="flex justify-between items-center p-4 border-b border-slate-800 bg-slate-900">
              <h3 className="font-semibold text-white text-sm">Add New Supplier Profile</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSupplier} className="p-4 space-y-3">
              <div>
                <label className="block text-slate-400 mb-1">Company / Supplier Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Opsonin Pharma Ltd"
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Phone Contact</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+880 2-8833000"
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white font-mono focus:outline-hidden focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Default Fallback Discount (%)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    value={defaultDiscount}
                    onChange={(e) => setDefaultDiscount(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white font-mono focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Therapeutic Groups Handled (comma separated)</label>
                <input
                  type="text"
                  value={groupsHandled}
                  onChange={(e) => setGroupsHandled(e.target.value)}
                  placeholder="e.g. General, Cardiac, Antibiotic, Herbal"
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Corporate Office Address</label>
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Road, Area, City"
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 rounded bg-slate-900 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-sm"
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
