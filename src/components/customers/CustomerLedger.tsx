/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Module B: Customer Management & Due Collection Ledger
 * Features:
 * - Interactive Search Bar with live dropdown & keyboard navigation (ArrowDown/Up + Enter to open customer profile)
 * - Clickable Customer Names with instant drill-down to all data & history
 * - Clear, responsive summary dashboard for quick insights
 * - Comprehensive customer modal (date-wise sales receipts, searchable by receipt # and medicine name, medicine buy history, due collections history, printable statement)
 * - Due collections & payment receipt generation
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { usePharmacy } from '../../context/PharmacyContext';
import { Customer, DueCollection } from '../../types/pharmacy';
import { CustomerSummaryDashboard } from './CustomerSummaryDashboard';
import { CustomerDetailModal } from './CustomerDetailModal';
import {
  Users,
  Search,
  Plus,
  DollarSign,
  Receipt,
  Printer,
  CheckCircle2,
  X,
  CreditCard,
  Banknote,
  Smartphone,
  ExternalLink,
  Phone,
  MapPin,
  Award,
  ArrowDown,
  ArrowUp,
  CornerDownLeft,
  FileText,
  AlertTriangle,
} from 'lucide-react';

export const CustomerLedger: React.FC = () => {
  const {
    customers,
    sales,
    medicines,
    addCustomer,
    updateCustomer,
    recordDueCollection,
    dueCollections,
    currentUser,
    formatCurrency,
    showToast,
  } = usePharmacy();

  // Active customer history modal
  const [selectedCustomerForDetail, setSelectedCustomerForDetail] = useState<Customer | null>(null);

  // Search and keyboard navigation state
  const [search, setSearch] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchDropdownRef = useRef<HTMLDivElement>(null);

  // Filter states
  const [statusFilter, setStatusFilter] = useState<'all' | 'due' | 'settled'>('all');

  // New Customer modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');

  // Collect Due modal
  const [collectingCust, setCollectingCust] = useState<Customer | null>(null);
  const [collectAmount, setCollectAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Bank Transfer' | 'MFS'>('Cash');
  const [collectNotes, setCollectNotes] = useState('');

  // Printed collection receipt modal
  const [printedCollection, setPrintedCollection] = useState<DueCollection | null>(null);

  // Filtered customers matching search and filter
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      // Status filter
      if (statusFilter === 'due' && c.TotalDue <= 0) return false;
      if (statusFilter === 'settled' && c.TotalDue > 0) return false;

      // Search term
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        c.Name.toLowerCase().includes(q) ||
        c.CustomerID.toLowerCase().includes(q) ||
        c.Phone.toLowerCase().includes(q) ||
        c.Address.toLowerCase().includes(q)
      );
    });
  }, [customers, search, statusFilter]);

  // Autocomplete dropdown matches
  const searchDropdownMatches = useMemo(() => {
    if (!search.trim()) {
      return customers.slice(0, 5); // show first 5 on focus
    }
    const q = search.toLowerCase();
    return customers.filter(
      (c) =>
        c.Name.toLowerCase().includes(q) ||
        c.CustomerID.toLowerCase().includes(q) ||
        c.Phone.toLowerCase().includes(q) ||
        c.Address.toLowerCase().includes(q)
    );
  }, [customers, search]);

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
      const targetCustomer =
        highlightedIndex >= 0 && highlightedIndex < searchDropdownMatches.length
          ? searchDropdownMatches[highlightedIndex]
          : searchDropdownMatches[0];

      if (targetCustomer) {
        handleOpenCustomerDetail(targetCustomer);
        setIsSearchFocused(false);
      }
    } else if (e.key === 'Escape') {
      setIsSearchFocused(false);
      setHighlightedIndex(-1);
    }
  };

  const handleOpenCustomerDetail = (customer: Customer) => {
    const fresh = customers.find((c) => c.CustomerID === customer.CustomerID) || customer;
    setSelectedCustomerForDetail(fresh);
    setIsSearchFocused(false);
  };

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    addCustomer({
      Name: newName.trim(),
      Phone: newPhone.trim() || 'N/A',
      Address: newAddress.trim() || 'Retail Customer',
    });

    showToast(`Customer ${newName.trim()} registered successfully.`, 'success', 'Profile Created');
    setNewName('');
    setNewPhone('');
    setNewAddress('');
    setIsAddModalOpen(false);
  };

  const handleOpenCollect = (cust: Customer) => {
    setCollectingCust(cust);
    setCollectAmount(cust.TotalDue);
    setPaymentMethod('Cash');
    setCollectNotes(`Payment towards outstanding balance of ${formatCurrency(cust.TotalDue)}`);
  };

  const handleProcessCollection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectingCust || collectAmount <= 0) return;

    const coll = recordDueCollection({
      EntityType: 'Customer',
      EntityID: collectingCust.CustomerID,
      EntityName: collectingCust.Name,
      Amount: collectAmount,
      PaymentMethod: paymentMethod,
      ReceivedBy: currentUser?.FullName || 'Chief Pharmacist',
      Notes: collectNotes,
    });

    showToast(
      `Received payment of ${formatCurrency(collectAmount)} from ${collectingCust.Name}.`,
      'success',
      'Due Payment Collected'
    );

    // If modal is currently open for this customer, update its balance
    if (selectedCustomerForDetail && selectedCustomerForDetail.CustomerID === collectingCust.CustomerID) {
      setSelectedCustomerForDetail((prev) =>
        prev ? { ...prev, TotalDue: Math.max(0, prev.TotalDue - collectAmount) } : null
      );
    }

    setPrintedCollection(coll);
    setCollectingCust(null);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-900 select-none">
      {/* Title Bar */}
      <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white tracking-tight">
              Customer Management & Due Collection Ledger
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Module B · Customer credit balances, cash/digital due settlement, and sale dispensing receipts.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>New Customer Profile</span>
        </button>
      </div>

      {/* Summary Dashboard for Quick Insights */}
      <CustomerSummaryDashboard
        customers={customers}
        sales={sales}
        dueCollections={dueCollections}
        formatCurrency={formatCurrency}
        selectedFilter={statusFilter}
        onSelectFilter={setStatusFilter}
        onOpenCustomer={handleOpenCustomerDetail}
      />

      {/* Filter and Search Bar with Keyboard Navigation */}
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
            placeholder="Search customers by Name, Phone, ID, or Address... (↓ / ↑ to navigate, Enter to open)"
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

          {/* Autocomplete Dropdown */}
          {isSearchFocused && searchDropdownMatches.length > 0 && (
            <div
              ref={searchDropdownRef}
              className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-slate-950 border border-slate-700 rounded-lg shadow-2xl overflow-hidden max-h-80 overflow-y-auto"
            >
              <div className="p-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                <span className="font-semibold text-slate-300">
                  Quick Select Customer ({searchDropdownMatches.length} matching)
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  Press [↓ / ↑] to select · [Enter] to open all data & history
                </span>
              </div>

              <div className="divide-y divide-slate-850">
                {searchDropdownMatches.map((c, idx) => {
                  const isHighlighted = idx === highlightedIndex;
                  const hasDue = c.TotalDue > 0;

                  return (
                    <div
                      key={c.CustomerID}
                      onClick={() => handleOpenCustomerDetail(c)}
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
                          <Users className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                            <span className="truncate">{c.Name}</span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-850 text-slate-400">
                              {c.CustomerID}
                            </span>
                            {c.LoyaltyPoints > 0 && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] bg-purple-950 text-purple-300 border border-purple-800/40">
                                {c.LoyaltyPoints} pts
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5 truncate">
                            <span className="font-mono">{c.Phone}</span>
                            <span>·</span>
                            <span className="truncate max-w-[200px]">{c.Address}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 text-right">
                        <div>
                          <div className="text-[10px] text-slate-500 uppercase">Due Balance</div>
                          <div
                            className={`font-mono font-bold text-xs ${
                              hasDue ? 'text-amber-400' : 'text-slate-400'
                            }`}
                          >
                            {formatCurrency(c.TotalDue)}
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
            <span>Click any Customer Name to open their receipts, buy history & payment ledger</span>
          </span>
        </div>
      </div>

      {/* Main Customers Data Table */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                <th className="p-3">Customer Profile (Clickable Name)</th>
                <th className="p-3">Contact Phone</th>
                <th className="p-3">Address</th>
                <th className="p-3 text-right">Loyalty Points</th>
                <th className="p-3 text-right">Current Due Balance</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    <Users className="w-8 h-8 mx-auto text-slate-600 mb-2 opacity-50" />
                    <p className="text-sm font-medium text-slate-400">No customers found matching criteria.</p>
                    <p className="text-xs text-slate-600 mt-1">Try modifying the search term or status filter.</p>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c) => {
                  const hasDue = c.TotalDue > 0;
                  const customerReceipts = sales.filter(
                    (s) =>
                      s.CustomerID === c.CustomerID ||
                      (s.CustomerName && s.CustomerName.toLowerCase() === c.Name.toLowerCase())
                  );

                  return (
                    <tr
                      key={c.CustomerID}
                      className="hover:bg-slate-900/60 transition-colors group/row"
                    >
                      {/* Clickable Customer Name */}
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => handleOpenCustomerDetail(c)}
                          className="text-left group/btn flex items-center gap-1.5 focus:outline-hidden"
                          title="Click to view all data and history for this customer"
                        >
                          <span className="font-semibold text-emerald-400 group-hover/btn:text-emerald-300 group-hover/btn:underline text-sm transition-colors cursor-pointer flex items-center gap-1.5">
                            <span>{c.Name}</span>
                            <ExternalLink className="w-3.5 h-3.5 text-emerald-500/70 group-hover/btn:text-emerald-300 transition-colors" />
                          </span>
                        </button>
                        <div className="flex items-center gap-2 text-slate-500 text-[10px] font-mono mt-0.5">
                          <span>ID: {c.CustomerID}</span>
                          <span>·</span>
                          <span>{customerReceipts.length} receipts dispensed</span>
                        </div>
                      </td>

                      <td className="p-3 font-mono text-slate-300">
                        <div className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-500" />
                          <span>{c.Phone}</span>
                        </div>
                      </td>

                      <td className="p-3 text-slate-400 max-w-xs truncate" title={c.Address}>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                          <span className="truncate">{c.Address}</span>
                        </div>
                      </td>

                      <td className="p-3 text-right font-mono text-purple-400 font-semibold">
                        <span className="bg-purple-950/60 text-purple-300 border border-purple-800/40 px-2 py-0.5 rounded font-bold">
                          {c.LoyaltyPoints} pts
                        </span>
                      </td>

                      <td className="p-3 text-right font-mono">
                        <span
                          className={`text-sm font-bold ${
                            hasDue ? 'text-amber-400' : 'text-slate-400'
                          }`}
                        >
                          {formatCurrency(c.TotalDue)}
                        </span>
                      </td>

                      {/* Action buttons */}
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenCustomerDetail(c)}
                            className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-xs flex items-center gap-1 transition-colors"
                            title="View complete date-wise receipts and payment history"
                          >
                            <FileText className="w-3.5 h-3.5 text-emerald-400" />
                            <span>All History</span>
                          </button>

                          {hasDue ? (
                            <button
                              type="button"
                              onClick={() => handleOpenCollect(c)}
                              className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-1 shadow-sm transition-colors"
                              title="Collect outstanding balance"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                              <span>Collect Due</span>
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

      {/* Customer All Data & History Modal */}
      {selectedCustomerForDetail && (
        <CustomerDetailModal
          customer={selectedCustomerForDetail}
          onClose={() => setSelectedCustomerForDetail(null)}
          sales={sales}
          dueCollections={dueCollections}
          medicines={medicines}
          formatCurrency={formatCurrency}
          onOpenCollect={(c) => {
            handleOpenCollect(c);
          }}
        />
      )}

      {/* Collect Due Modal */}
      {collectingCust && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-slate-950 border border-slate-700 rounded-lg shadow-2xl max-w-md w-full overflow-hidden text-xs">
            <div className="flex justify-between items-center p-4 border-b border-slate-800 bg-slate-900">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <h3 className="font-semibold text-white text-sm">
                  Receive Due Payment: {collectingCust.Name}
                </h3>
              </div>
              <button
                onClick={() => setCollectingCust(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleProcessCollection} className="p-4 space-y-3">
              <div className="bg-slate-900 p-2.5 rounded border border-slate-800 text-slate-300 flex justify-between items-center font-mono">
                <span>Total Outstanding Due:</span>
                <span className="font-bold text-amber-400 text-sm">
                  {formatCurrency(collectingCust.TotalDue)}
                </span>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Payment Amount ($) *</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max={collectingCust.TotalDue}
                  required
                  value={collectAmount}
                  onChange={(e) => setCollectAmount(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white font-mono text-sm font-semibold focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('Cash')}
                    className={`p-2 rounded text-center border transition-colors ${
                      paymentMethod === 'Cash'
                        ? 'bg-emerald-600/30 border-emerald-500 text-white font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('Bank Transfer')}
                    className={`p-2 rounded text-center border transition-colors ${
                      paymentMethod === 'Bank Transfer'
                        ? 'bg-emerald-600/30 border-emerald-500 text-white font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Bank
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('MFS')}
                    className={`p-2 rounded text-center border transition-colors ${
                      paymentMethod === 'MFS'
                        ? 'bg-emerald-600/30 border-emerald-500 text-white font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    MFS / Digital
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Notes / Voucher Reference</label>
                <input
                  type="text"
                  value={collectNotes}
                  onChange={(e) => setCollectNotes(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCollectingCust(null)}
                  className="px-3 py-1.5 rounded bg-slate-900 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-sm"
                >
                  Record Payment & Print Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-slate-950 border border-slate-700 rounded-lg shadow-2xl max-w-md w-full overflow-hidden text-xs">
            <div className="flex justify-between items-center p-4 border-b border-slate-800 bg-slate-900">
              <h3 className="font-semibold text-white text-sm">Add New Customer</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="p-4 space-y-3">
              <div>
                <label className="block text-slate-400 mb-1">Customer Full Name *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Dr. Kamal Hossain"
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Mobile Number</label>
                <input
                  type="text"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+880 1711-000000"
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white font-mono focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Address / Note</label>
                <textarea
                  rows={2}
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  placeholder="Street Address, City"
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
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printed Collection Receipt Modal */}
      {printedCollection && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-slate-950 border border-slate-700 rounded-lg shadow-2xl max-w-sm w-full overflow-hidden text-xs">
            <div className="p-3 border-b border-slate-800 bg-slate-900 flex justify-between items-center">
              <span className="font-semibold text-white">Payment Receipt Voucher</span>
              <button
                onClick={() => setPrintedCollection(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-white text-black font-mono text-[11px] space-y-2">
              <div className="text-center pb-2 border-b border-neutral-300">
                <h3 className="font-bold text-xs uppercase">FATEMA PHARMACY & HEALTHCARE</h3>
                <p className="text-[10px] text-neutral-600">Official Customer Due Payment Receipt</p>
              </div>

              <div className="space-y-1 text-[10px]">
                <div className="flex justify-between">
                  <span>Voucher No:</span>
                  <span className="font-bold">{printedCollection.CollectionID}</span>
                </div>
                <div className="flex justify-between">
                  <span>Customer:</span>
                  <span className="font-bold">{printedCollection.EntityName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span>{new Date(printedCollection.CollectionDate).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Received By:</span>
                  <span>{printedCollection.ReceivedBy}</span>
                </div>
                <div className="flex justify-between">
                  <span>Method:</span>
                  <span>{printedCollection.PaymentMethod}</span>
                </div>
                <div className="flex justify-between font-bold text-xs pt-1 border-t border-neutral-300">
                  <span>Amount Received:</span>
                  <span>{formatCurrency(printedCollection.Amount)}</span>
                </div>
              </div>

              <div className="pt-2 text-[9px] text-center text-neutral-500 italic">
                Thank you. Transaction stored securely in SQL Server.
              </div>
            </div>

            <div className="p-3 border-t border-slate-800 bg-slate-900 flex justify-end gap-2">
              <button
                onClick={() => setPrintedCollection(null)}
                className="px-3 py-1 bg-slate-800 text-slate-300 rounded"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded flex items-center gap-1"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
