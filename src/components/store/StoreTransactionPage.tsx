/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Store Transaction History Page (Page 5 of every Regional Store)
 * Displays all Store In, Store Out, and Store Inter-Change (Outbound & Inbound) records
 */

import React, { useState, useMemo } from 'react';
import { usePharmacy } from '../../context/PharmacyContext';
import {
  WarehouseStore,
  StoreTransaction,
  StoreTransactionType,
} from '../../types/pharmacy';
import {
  Search,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  Eye,
  Printer,
  Download,
  X,
  UserCheck,
  ReceiptText,
  Calendar,
} from 'lucide-react';

interface StoreTransactionPageProps {
  store: WarehouseStore;
}

export const StoreTransactionPage: React.FC<StoreTransactionPageProps> = ({ store }) => {
  const {
    stores,
    storeTransactions,
    groups,
    formatCurrency,
    showToast,
    recordLogisticsSyncExport,
  } = usePharmacy();

  const [scopeMode, setScopeMode] = useState<'current_store' | 'all_active'>('current_store');
  const [typeFilter, setTypeFilter] = useState<'ALL' | StoreTransactionType>('ALL');
  const [groupFilter, setGroupFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTx, setSelectedTx] = useState<StoreTransaction | null>(null);

  const activeStoreIds = useMemo(
    () => new Set(stores.filter((s) => s.IsActive).map((s) => s.StoreID)),
    [stores]
  );

  // Scoped transactions: for current store (includes both StoreID === store.StoreID and TargetStoreID === store.StoreID)
  const scopedTransactions = useMemo(() => {
    return storeTransactions.filter((tx) => {
      if (scopeMode === 'current_store') {
        return tx.StoreID === store.StoreID || tx.TargetStoreID === store.StoreID;
      }
      return (
        activeStoreIds.has(tx.StoreID) ||
        (tx.TargetStoreID ? activeStoreIds.has(tx.TargetStoreID) : false)
      );
    });
  }, [storeTransactions, scopeMode, store.StoreID, activeStoreIds]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return scopedTransactions.filter((tx) => {
      if (typeFilter !== 'ALL' && tx.Type !== typeFilter) return false;
      if (groupFilter !== 'All') {
        const matchGroup =
          (tx.Group || '').toLowerCase() === groupFilter.toLowerCase() ||
          tx.Items.some((it) => (it.Group || '').toLowerCase() === groupFilter.toLowerCase());
        if (!matchGroup) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchHeader =
          tx.InvoiceNumber.toLowerCase().includes(q) ||
          tx.SenderName.toLowerCase().includes(q) ||
          tx.ReceiverName.toLowerCase().includes(q) ||
          tx.StoreName.toLowerCase().includes(q) ||
          (tx.TargetStoreName || '').toLowerCase().includes(q) ||
          (tx.SupplierName || '').toLowerCase().includes(q) ||
          (tx.Notes || '').toLowerCase().includes(q);
        const matchItems = tx.Items.some(
          (i) =>
            i.TradeName.toLowerCase().includes(q) ||
            i.GenericName.toLowerCase().includes(q) ||
            i.BatchNumber.toLowerCase().includes(q)
        );
        if (!matchHeader && !matchItems) return false;
      }
      return true;
    });
  }, [scopedTransactions, typeFilter, groupFilter, searchQuery]);

  // KPIs
  const metrics = useMemo(() => {
    let storeInVal = 0;
    let storeOutVal = 0;
    let interchangeVal = 0;
    let totalUnitsMoved = 0;

    filteredTransactions.forEach((tx) => {
      totalUnitsMoved += tx.TotalUnits;
      if (tx.Type === 'STORE_IN') storeInVal += tx.NetAmount;
      else if (tx.Type === 'STORE_OUT') storeOutVal += tx.NetAmount;
      else interchangeVal += tx.NetAmount;
    });

    return {
      count: filteredTransactions.length,
      storeInVal,
      storeOutVal,
      interchangeVal,
      totalUnitsMoved,
    };
  }, [filteredTransactions]);

  const handleExportTransactionsCsv = () => {
    const headers = [
      'InvoiceNumber',
      'Type',
      'Date',
      'SourceStore',
      'TargetOrChannel',
      'SenderName',
      'ReceiverName',
      'TotalUnits',
      'NetValuation',
      'CreatedBy',
    ];
    const rows = filteredTransactions.map((tx) => {
      const channel =
        tx.Type === 'STORE_INTERCHANGE'
          ? tx.TargetStoreName || ''
          : tx.CounterSyncMode === 'MAIN_COUNTER'
          ? 'Main Pharmacy POS Counter'
          : tx.SupplierName || 'External Logistics';
      return [
        `"${tx.InvoiceNumber}"`,
        `"${tx.Type}"`,
        `"${tx.CreatedAt}"`,
        `"${tx.StoreName}"`,
        `"${channel}"`,
        `"${tx.SenderName}"`,
        `"${tx.ReceiverName}"`,
        tx.TotalUnits,
        tx.NetAmount.toFixed(2),
        `"${tx.CreatedBy}"`,
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `store_transactions_${store.Code.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    recordLogisticsSyncExport(
      'CSV',
      `Exported ${filteredTransactions.length} store transaction vouchers (${store.ShortName})`
    );
    showToast(
      `Exported ${filteredTransactions.length} transaction records to CSV.`,
      'success',
      'Ledger Exported'
    );
  };

  const renderTypeLabel = (tx: StoreTransaction) => {
    if (tx.Type === 'STORE_IN') {
      return (
        <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold whitespace-nowrap">
          <ArrowDownToLine className="w-3.5 h-3.5" />
          <span>Store In</span>
        </span>
      );
    }
    if (tx.Type === 'STORE_OUT') {
      return (
        <span className="inline-flex items-center gap-1 text-amber-400 font-semibold whitespace-nowrap">
          <ArrowUpFromLine className="w-3.5 h-3.5" />
          <span>Store Out</span>
        </span>
      );
    }
    const isInboundToCurrent =
      scopeMode === 'current_store' && tx.TargetStoreID === store.StoreID;
    return (
      <span className="inline-flex items-center gap-1 text-sky-400 font-semibold whitespace-nowrap">
        <ArrowLeftRight className="w-3.5 h-3.5" />
        <span>{isInboundToCurrent ? 'Inter-Change (In)' : 'Inter-Change'}</span>
      </span>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-900 overflow-hidden select-none">
      {/* KPI Summary Strip */}
      <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 shrink-0">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
            <span className="text-[11px] text-slate-400 block">Recorded Vouchers</span>
            <div className="mt-1 flex items-baseline justify-between font-mono tabular-nums">
              <span className="text-lg font-bold text-white">{metrics.count}</span>
              <span className="text-xs text-slate-300">{metrics.totalUnitsMoved} units moved</span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
            <span className="text-[11px] text-slate-400 block">Store In Volume</span>
            <div className="mt-1 font-mono tabular-nums text-lg font-bold text-emerald-400">
              {formatCurrency(metrics.storeInVal)}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
            <span className="text-[11px] text-slate-400 block">Store Out Dispatch</span>
            <div className="mt-1 font-mono tabular-nums text-lg font-bold text-amber-400">
              {formatCurrency(metrics.storeOutVal)}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
            <span className="text-[11px] text-slate-400 block">Store Inter-Change</span>
            <div className="mt-1 font-mono tabular-nums text-lg font-bold text-sky-400">
              {formatCurrency(metrics.interchangeVal)}
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="p-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
        {/* Segmented Type Filter */}
        <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg">
          {(
            [
              { id: 'ALL', label: 'All History' },
              { id: 'STORE_IN', label: 'Store In' },
              { id: 'STORE_OUT', label: 'Store Out' },
              { id: 'STORE_INTERCHANGE', label: 'Inter-Change' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTypeFilter(tab.id)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                typeFilter === tab.id
                  ? 'bg-emerald-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search + Group + Store Scope + Export */}
        <div className="flex flex-wrap items-center gap-2 flex-1 justify-end min-w-[280px]">
          <div className="relative flex-1 max-w-md min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search voucher #, sender, receiver, medicine, batch..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-7 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-2 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="All">All Groups</option>
            {groups.map((g) => (
              <option key={g} value={g}>
                {g} Group
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1 p-0.5 bg-slate-950 border border-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setScopeMode('current_store')}
              className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap cursor-pointer ${
                scopeMode === 'current_store'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {store.ShortName} Only
            </button>
            <button
              type="button"
              onClick={() => setScopeMode('all_active')}
              className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap cursor-pointer ${
                scopeMode === 'all_active'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Active Stores
            </button>
          </div>

          <button
            type="button"
            onClick={handleExportTransactionsCsv}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Transaction Ledger Table */}
      <div className="flex-1 overflow-y-auto p-3">
        {filteredTransactions.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
            <ReceiptText className="w-10 h-10 text-slate-600 mb-2" />
            <h4 className="text-sm font-bold text-white">No Store Transactions Found</h4>
            <p className="text-xs text-slate-500 max-w-md mt-1">
              Transactions recorded in Store In, Store Out, and Store Inter-Change appear here automatically with full sender/receiver accountability.
            </p>
          </div>
        ) : (
          <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 border-b border-slate-800 text-[11px] font-semibold text-slate-400">
                  <th className="py-2.5 px-3">Auto Invoice #</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Date & Time</th>
                  <th className="py-2.5 px-3">Store Routing / Channel</th>
                  <th className="py-2.5 px-3">Sender → Receiver</th>
                  <th className="py-2.5 px-3 text-right">Items / Units</th>
                  <th className="py-2.5 px-3 text-right">Net Valuation</th>
                  <th className="py-2.5 px-3 text-center">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredTransactions.map((tx) => {
                  const dateObj = new Date(tx.CreatedAt);
                  return (
                    <tr
                      key={tx.TransactionID}
                      onClick={() => setSelectedTx(tx)}
                      className="hover:bg-slate-900/70 transition-colors cursor-pointer"
                    >
                      <td className="py-2.5 px-3 font-mono tabular-nums font-bold text-white">
                        {tx.InvoiceNumber}
                      </td>
                      <td className="py-2.5 px-3">{renderTypeLabel(tx)}</td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-300 text-[11px]">
                        <div>{dateObj.toLocaleDateString()}</div>
                        <div className="text-slate-500">
                          {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="text-slate-200 font-medium">{tx.StoreName}</div>
                        <div className="text-[11px] text-slate-400">
                          {tx.Type === 'STORE_INTERCHANGE'
                            ? `→ ${tx.TargetStoreName}`
                            : tx.CounterSyncMode === 'MAIN_COUNTER'
                            ? tx.Type === 'STORE_IN'
                              ? 'From Main POS Counter'
                              : '→ Main POS Counter'
                            : tx.SupplierName || 'External Consignment'}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="text-slate-200">
                          <span className="text-slate-400">From:</span> {tx.SenderName}
                        </div>
                        <div className="text-[11px] text-sky-300">
                          <span className="text-slate-400">To:</span> {tx.ReceiverName}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        <div className="font-bold text-white">{tx.TotalUnits} units</div>
                        <div className="text-[11px] text-slate-500">
                          {tx.Items.length} batch{tx.Items.length !== 1 ? 'es' : ''}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-emerald-400">
                        {formatCurrency(tx.NetAmount)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTx(tx);
                          }}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-medium inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                        >
                          <Eye className="w-3 h-3 text-emerald-400" />
                          <span>Voucher</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Voucher Inspection & Print Modal */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-700 rounded-xl max-w-3xl w-full max-h-[88vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ReceiptText className="w-4 h-4 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-bold text-white font-mono">
                    {selectedTx.InvoiceNumber}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Recorded by {selectedTx.CreatedBy} ({selectedTx.CreatedByRole}) ·{' '}
                    {new Date(selectedTx.CreatedAt).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Voucher</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTx(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              {/* Chain of Custody Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-900 border border-slate-800 rounded-lg">
                <div className="space-y-1">
                  <div className="text-slate-400 text-[11px]">Warehouse Routing</div>
                  <div className="font-semibold text-white">{selectedTx.StoreName}</div>
                  {selectedTx.TargetStoreName && (
                    <div className="text-sky-400 font-medium">
                      Destination: {selectedTx.TargetStoreName}
                    </div>
                  )}
                  {selectedTx.SupplierName && (
                    <div className="text-slate-300">Consignor: {selectedTx.SupplierName}</div>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="text-slate-400 text-[11px] flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Chain of Custody</span>
                  </div>
                  <div className="text-white">
                    <span className="text-slate-400">Sender:</span>{' '}
                    <strong>{selectedTx.SenderName}</strong>
                  </div>
                  <div className="text-white">
                    <span className="text-slate-400">Receiver:</span>{' '}
                    <strong>{selectedTx.ReceiverName}</strong>
                  </div>
                </div>
              </div>

              {selectedTx.Notes && (
                <div className="p-2.5 bg-slate-900/60 border border-slate-800 rounded text-slate-300">
                  <span className="text-slate-400">Remarks:</span> {selectedTx.Notes}
                </div>
              )}

              {/* Line Items Table */}
              <div className="border border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 text-[11px]">
                    <tr>
                      <th className="py-2 px-3">#</th>
                      <th className="py-2 px-3">Medicine</th>
                      <th className="py-2 px-3">Group</th>
                      <th className="py-2 px-3">Batch & Expiry</th>
                      <th className="py-2 px-3 text-right">Qty</th>
                      <th className="py-2 px-3 text-right">Unit Cost</th>
                      <th className="py-2 px-3 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
                    {selectedTx.Items.map((it, idx) => (
                      <tr key={it.ItemID}>
                        <td className="py-2 px-3 font-sans text-slate-500">{idx + 1}</td>
                        <td className="py-2 px-3 font-sans">
                          <div className="font-semibold text-white">{it.TradeName}</div>
                          <div className="text-[11px] text-slate-400">{it.SupplierName}</div>
                        </td>
                        <td className="py-2 px-3 font-sans text-sky-400">{it.Group}</td>
                        <td className="py-2 px-3 text-slate-300">
                          {it.BatchNumber} · <span className="text-slate-500">{it.ExpiryDate}</span>
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-white">{it.Quantity}</td>
                        <td className="py-2 px-3 text-right text-slate-300">
                          {formatCurrency(it.CostPrice)}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-400">
                          {formatCurrency(it.TotalCost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Financial Footer */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-3.5 bg-slate-900 border border-slate-800 rounded-lg font-mono tabular-nums">
                <div className="flex items-center gap-4 text-slate-400">
                  <span>
                    Gross TP: <strong className="text-white">{formatCurrency(selectedTx.TotalTP)}</strong>
                  </span>
                  <span>
                    VAT: <strong className="text-slate-300">+{formatCurrency(selectedTx.TotalVAT)}</strong>
                  </span>
                  <span>
                    Discount:{' '}
                    <strong className="text-emerald-400">
                      -{formatCurrency(selectedTx.TotalDiscount)}
                    </strong>
                  </span>
                </div>
                <div className="text-sm font-bold text-emerald-400">
                  Net Voucher Valuation: {formatCurrency(selectedTx.NetAmount)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
