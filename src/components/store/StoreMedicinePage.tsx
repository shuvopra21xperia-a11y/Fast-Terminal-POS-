/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Stored Medicine Inventory with Interactive Hierarchical Supplier Tree -> Group
 * Serves both:
 * 1) Store-Medicine Page (single_store scope inside a regional warehouse)
 * 2) Consolidated Stored Medicine Report (all_active_stores scope in Report Dashboard)
 */

import React, { useState, useMemo } from 'react';
import { usePharmacy } from '../../context/PharmacyContext';
import { StoreStockItem, WarehouseStore } from '../../types/pharmacy';
import {
  FolderTree,
  Building2,
  Phone,
  Search,
  ChevronRight,
  ChevronDown,
  Layers,
  Boxes,
  Calendar,
  Download,
  Printer,
  Warehouse,
  X,
  AlertTriangle,
} from 'lucide-react';

interface StoreMedicinePageProps {
  scope: 'single_store' | 'all_active_stores';
  store?: WarehouseStore;
}

export const StoreMedicinePage: React.FC<StoreMedicinePageProps> = ({ scope, store }) => {
  const {
    stores,
    storeStocks,
    suppliers,
    groups,
    formatCurrency,
    showToast,
    recordLogisticsSyncExport,
  } = usePharmacy();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string>('All');
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>('ALL_ACTIVE');
  const [expiryFilter, setExpiryFilter] = useState<'all' | 'near90' | 'healthy'>('all');
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const [expandedSuppliers, setExpandedSuppliers] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    suppliers.forEach((s) => {
      initial[s.SupplierID] = true;
    });
    return initial;
  });

  const activeStores = useMemo(() => stores.filter((s) => s.IsActive), [stores]);
  const activeStoreIds = useMemo(
    () => new Set(activeStores.map((s) => s.StoreID)),
    [activeStores]
  );

  const storeMap = useMemo(() => {
    const map = new Map<string, WarehouseStore>();
    stores.forEach((s) => map.set(s.StoreID, s));
    return map;
  }, [stores]);

  // Base stock items scoped to either the single store or all active stores
  const scopedStockItems = useMemo(() => {
    return storeStocks.filter((st) => {
      if (st.Quantity <= 0) return false;
      if (scope === 'single_store') {
        return store ? st.StoreID === store.StoreID : false;
      }
      // Consolidated Report: only active stores (or specific active store filter)
      if (!activeStoreIds.has(st.StoreID)) return false;
      if (selectedStoreFilter !== 'ALL_ACTIVE' && st.StoreID !== selectedStoreFilter) {
        return false;
      }
      return true;
    });
  }, [storeStocks, scope, store, activeStoreIds, selectedStoreFilter]);

  // Build Hierarchical Supplier Tree -> Therapeutic Group
  const supplierTree = useMemo(() => {
    return suppliers.map((sup) => {
      const supItems = scopedStockItems.filter((item) => item.SupplierID === sup.SupplierID);
      const totalUnits = supItems.reduce((sum, i) => sum + i.Quantity, 0);
      const totalCostValuation = supItems.reduce((sum, i) => sum + i.Quantity * i.CostPrice, 0);
      const totalRetailValuation = supItems.reduce((sum, i) => sum + i.Quantity * i.MRP, 0);

      const groupMap = new Map<string, StoreStockItem[]>();
      supItems.forEach((item) => {
        const grp = item.Group || 'General';
        if (!groupMap.has(grp)) groupMap.set(grp, []);
        groupMap.get(grp)!.push(item);
      });

      const groupNodes = Array.from(groupMap.entries())
        .map(([groupName, grpItems]) => ({
          groupName,
          batchCount: grpItems.length,
          totalUnits: grpItems.reduce((s, i) => s + i.Quantity, 0),
          totalValuation: grpItems.reduce((s, i) => s + i.Quantity * i.CostPrice, 0),
        }))
        .sort((a, b) => b.totalUnits - a.totalUnits);

      return {
        supplier: sup,
        batchCount: supItems.length,
        totalUnits,
        totalCostValuation: Math.round(totalCostValuation * 100) / 100,
        totalRetailValuation: Math.round(totalRetailValuation * 100) / 100,
        groups: groupNodes,
      };
    });
  }, [suppliers, scopedStockItems]);

  // KPIs
  const summaryStats = useMemo(() => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    let totalUnits = 0;
    let costValue = 0;
    let retailValue = 0;
    let nearExpiryBatches = 0;

    scopedStockItems.forEach((st) => {
      totalUnits += st.Quantity;
      costValue += st.Quantity * st.CostPrice;
      retailValue += st.Quantity * st.MRP;
      const days = Math.ceil((new Date(st.ExpiryDate).getTime() - now) / dayMs);
      if (days <= 90) nearExpiryBatches += 1;
    });

    return {
      batchCount: scopedStockItems.length,
      totalUnits,
      costValue: Math.round(costValue * 100) / 100,
      retailValue: Math.round(retailValue * 100) / 100,
      nearExpiryBatches,
    };
  }, [scopedStockItems]);

  // Filtered table rows
  const displayedItems = useMemo(() => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    return scopedStockItems.filter((item) => {
      if (selectedSupplierId && item.SupplierID !== selectedSupplierId) return false;
      if (
        selectedGroup !== 'All' &&
        (item.Group || 'General').toLowerCase() !== selectedGroup.toLowerCase()
      ) {
        return false;
      }

      if (expiryFilter !== 'all') {
        const days = Math.ceil((new Date(item.ExpiryDate).getTime() - now) / dayMs);
        if (expiryFilter === 'near90' && days > 90) return false;
        if (expiryFilter === 'healthy' && days <= 90) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const storeName = storeMap.get(item.StoreID)?.ShortName.toLowerCase() || '';
        const match =
          item.TradeName.toLowerCase().includes(q) ||
          item.GenericName.toLowerCase().includes(q) ||
          item.BatchNumber.toLowerCase().includes(q) ||
          item.SupplierName.toLowerCase().includes(q) ||
          item.Group.toLowerCase().includes(q) ||
          item.RackLocation.toLowerCase().includes(q) ||
          storeName.includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [scopedStockItems, selectedSupplierId, selectedGroup, expiryFilter, searchQuery, storeMap]);

  const toggleExpand = (supplierId: string) => {
    setExpandedSuppliers((prev) => ({ ...prev, [supplierId]: !prev[supplierId] }));
  };

  const handleExportCsv = () => {
    const headers = [
      'Store',
      'Supplier',
      'Group',
      'TradeName',
      'GenericName',
      'BatchNumber',
      'ExpiryDate',
      'RackLocation',
      'Quantity',
      'UnitCost',
      'MRP',
      'TotalCostValue',
    ];
    const rows = displayedItems.map((it) => {
      const stObj = storeMap.get(it.StoreID);
      return [
        `"${stObj?.ShortName || it.StoreID}"`,
        `"${it.SupplierName}"`,
        `"${it.Group}"`,
        `"${it.TradeName}"`,
        `"${it.GenericName}"`,
        `"${it.BatchNumber}"`,
        `"${it.ExpiryDate}"`,
        `"${it.RackLocation}"`,
        it.Quantity,
        it.CostPrice.toFixed(2),
        it.MRP.toFixed(2),
        (it.Quantity * it.CostPrice).toFixed(2),
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pharmacore_stored_medicine_supplier_tree_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    recordLogisticsSyncExport(
      'CSV',
      `Exported ${displayedItems.length} stored medicine records with Supplier Tree & Group`
    );
    showToast(
      `Exported ${displayedItems.length} stored medicine rows to CSV.`,
      'success',
      'CSV Report Downloaded'
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-900 overflow-hidden select-none">
      {/* Top KPI Summary Row */}
      <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 shrink-0">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
            <span className="text-[11px] text-slate-400 block">Stored Medicine Batches</span>
            <div className="mt-1 flex items-baseline justify-between font-mono tabular-nums">
              <span className="text-lg font-bold text-white">{summaryStats.batchCount}</span>
              <span className="text-xs text-emerald-400 font-semibold">
                {summaryStats.totalUnits.toLocaleString()} units
              </span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
            <span className="text-[11px] text-slate-400 block">Warehouse Cost Valuation</span>
            <div className="mt-1 font-mono tabular-nums text-lg font-bold text-emerald-400">
              {formatCurrency(summaryStats.costValue)}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
            <span className="text-[11px] text-slate-400 block">Retail MRP Valuation</span>
            <div className="mt-1 font-mono tabular-nums text-lg font-bold text-white">
              {formatCurrency(summaryStats.retailValue)}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 block">Near-Expiry (≤ 90d)</span>
              <span
                className={`mt-1 block font-mono tabular-nums text-lg font-bold ${
                  summaryStats.nearExpiryBatches > 0 ? 'text-amber-400' : 'text-slate-300'
                }`}
              >
                {summaryStats.nearExpiryBatches} batches
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleExportCsv}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-xs font-medium flex items-center gap-1 whitespace-nowrap cursor-pointer"
                title="Export Stored Medicine Report as CSV"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>CSV</span>
              </button>
              <button
                type="button"
                onClick={() => setIsPrintModalOpen(true)}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-xs font-medium flex items-center gap-1 whitespace-nowrap cursor-pointer"
                title="Open Printable Supplier Tree Report"
              >
                <Printer className="w-3.5 h-3.5 text-sky-400" />
                <span>Print</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Split View: Left Hierarchical Supplier Tree -> Group | Right Stored Medicine Grid */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* LEFT PANEL: SUPPLIER TREE WITH GROUP */}
        <aside className="w-80 bg-slate-950 border-r border-slate-800 flex flex-col shrink-0 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderTree className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold text-white">Supplier Tree · Group</h3>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-400">
              {suppliers.length} suppliers
            </span>
          </div>

          <div className="p-2 border-b border-slate-800/80">
            <button
              type="button"
              onClick={() => {
                setSelectedSupplierId(null);
                setSelectedGroup('All');
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs font-medium transition-colors cursor-pointer ${
                selectedSupplierId === null && selectedGroup === 'All'
                  ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40'
                  : 'text-slate-300 hover:bg-slate-900 border border-transparent'
              }`}
            >
              <span className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>All Stored Medicines</span>
              </span>
              <span className="font-mono tabular-nums text-[11px] text-slate-300">
                {summaryStats.totalUnits} units
              </span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {supplierTree.map((node) => {
              const isSelectedSupplier = selectedSupplierId === node.supplier.SupplierID;
              const isExpanded = !!expandedSuppliers[node.supplier.SupplierID];
              const hasStock = node.batchCount > 0;

              return (
                <div
                  key={node.supplier.SupplierID}
                  className={`rounded-lg border transition-colors ${
                    isSelectedSupplier
                      ? 'bg-slate-900 border-emerald-500/50'
                      : 'bg-slate-950 border-slate-800/90 hover:border-slate-700'
                  }`}
                >
                  <div className="p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSupplierId(node.supplier.SupplierID);
                          setSelectedGroup('All');
                        }}
                        className="flex-1 flex items-center gap-2 text-left min-w-0 cursor-pointer"
                      >
                        <Building2
                          className={`w-4 h-4 shrink-0 ${
                            hasStock ? 'text-emerald-400' : 'text-slate-600'
                          }`}
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-white truncate">
                            {node.supplier.Name}
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1 truncate">
                            <Phone className="w-2.5 h-2.5 text-slate-500" />
                            <span>{node.supplier.Phone}</span>
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleExpand(node.supplier.SupplierID)}
                        className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
                        title={isExpanded ? 'Collapse groups' : 'Expand groups'}
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    <div className="mt-1.5 pt-1.5 border-t border-slate-800/70 flex items-center justify-between text-[11px] font-mono tabular-nums">
                      <span className={hasStock ? 'text-slate-300' : 'text-slate-600'}>
                        {node.batchCount} batches · {node.totalUnits}u
                      </span>
                      <span className={hasStock ? 'text-emerald-400 font-semibold' : 'text-slate-600'}>
                        {formatCurrency(node.totalCostValuation)}
                      </span>
                    </div>
                  </div>

                  {/* Child Group Nodes */}
                  {isExpanded && node.groups.length > 0 && (
                    <div className="px-2.5 py-1.5 bg-slate-900/50 border-t border-slate-800/70 space-y-1">
                      {node.groups.map((grp) => {
                        const isActiveGrp =
                          isSelectedSupplier &&
                          selectedGroup.toLowerCase() === grp.groupName.toLowerCase();
                        return (
                          <button
                            key={grp.groupName}
                            type="button"
                            onClick={() => {
                              setSelectedSupplierId(node.supplier.SupplierID);
                              setSelectedGroup(grp.groupName);
                            }}
                            className={`w-full flex items-center justify-between px-2 py-1 rounded text-[11px] transition-colors cursor-pointer ${
                              isActiveGrp
                                ? 'bg-emerald-950/80 text-emerald-300 font-semibold border border-emerald-700/50'
                                : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
                            }`}
                          >
                            <span className="truncate">↳ {grp.groupName} Group</span>
                            <span className="font-mono tabular-nums text-[10px] text-slate-300 shrink-0 ml-2">
                              {grp.totalUnits}u · {formatCurrency(grp.totalValuation)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        {/* RIGHT PANEL: FILTERABLE STORED MEDICINE TABLE */}
        <section className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Search & Filter Toolbar */}
          <div className="p-3 bg-slate-900 border-b border-slate-800 space-y-2 shrink-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex-1 min-w-[220px] relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search stored medicine, generic, batch, supplier, or rack..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {scope === 'all_active_stores' && (
                <select
                  value={selectedStoreFilter}
                  onChange={(e) => setSelectedStoreFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="ALL_ACTIVE">
                    All Active Stores ({activeStores.length})
                  </option>
                  {activeStores.map((s) => (
                    <option key={s.StoreID} value={s.StoreID}>
                      {s.ShortName} ({s.Code})
                    </option>
                  ))}
                </select>
              )}

              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="All">All Groups</option>
                {groups.map((g) => (
                  <option key={g} value={g}>
                    {g} Group
                  </option>
                ))}
              </select>

              <select
                value={expiryFilter}
                onChange={(e) => setExpiryFilter(e.target.value as any)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="all">All Expiry Dates</option>
                <option value="near90">Near Expiry (≤ 90 Days)</option>
                <option value="healthy">Healthy Shelf Life (&gt; 90 Days)</option>
              </select>
            </div>

            {/* Active Breadcrumb Trail (Clean Unboxed Metadata with Separators) */}
            <div className="flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-2 flex-wrap">
                <span>Scope:</span>
                <strong className="text-slate-200">
                  {scope === 'single_store'
                    ? store?.Name
                    : selectedStoreFilter === 'ALL_ACTIVE'
                    ? `All Active Warehouses (${activeStores.length})`
                    : storeMap.get(selectedStoreFilter)?.Name}
                </strong>
                <span aria-hidden="true">·</span>
                <span>Supplier:</span>
                <strong className="text-emerald-400">
                  {selectedSupplierId
                    ? suppliers.find((s) => s.SupplierID === selectedSupplierId)?.Name
                    : 'All Suppliers'}
                </strong>
                <span aria-hidden="true">·</span>
                <span>Group:</span>
                <strong className="text-sky-400">{selectedGroup}</strong>
                {(selectedSupplierId || selectedGroup !== 'All' || searchQuery) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSupplierId(null);
                      setSelectedGroup('All');
                      setSearchQuery('');
                      setExpiryFilter('all');
                    }}
                    className="ml-2 text-amber-400 hover:underline cursor-pointer"
                  >
                    Reset filters
                  </button>
                )}
              </div>

              <span className="font-mono tabular-nums text-[11px]">
                Showing {displayedItems.length} batch{displayedItems.length !== 1 ? 'es' : ''}
              </span>
            </div>
          </div>

          {/* Stored Medicine Table */}
          <div className="flex-1 overflow-y-auto p-3">
            {displayedItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
                <Boxes className="w-10 h-10 text-slate-600 mb-2" />
                <h4 className="text-sm font-bold text-white">No Stored Medicines Match Filters</h4>
                <p className="text-xs text-slate-500 max-w-md mt-1">
                  Adjust the Supplier Tree selection, therapeutic group filter, or receive new batches via the Store In tab.
                </p>
              </div>
            ) : (
              <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900 border-b border-slate-800 text-[11px] font-semibold text-slate-400">
                      <th className="py-2.5 px-3">Medicine & Generic</th>
                      {scope === 'all_active_stores' && (
                        <th className="py-2.5 px-3">Store & Bay</th>
                      )}
                      {scope === 'single_store' && <th className="py-2.5 px-3">Bay / Rack</th>}
                      <th className="py-2.5 px-3">Supplier · Group</th>
                      <th className="py-2.5 px-3">Batch & Expiry</th>
                      <th className="py-2.5 px-3 text-right">Stored Qty</th>
                      <th className="py-2.5 px-3 text-right">Unit Cost</th>
                      <th className="py-2.5 px-3 text-right">MRP</th>
                      <th className="py-2.5 px-3 text-right">Cost Valuation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {displayedItems.map((item) => {
                      const stInfo = storeMap.get(item.StoreID);
                      const daysToExpiry = Math.ceil(
                        (new Date(item.ExpiryDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
                      );
                      const isNearExpiry = daysToExpiry <= 90;

                      return (
                        <tr key={item.StoreStockID} className="hover:bg-slate-900/70 transition-colors">
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-white">{item.TradeName}</div>
                            <div className="text-[11px] text-slate-400">{item.GenericName}</div>
                          </td>

                          {scope === 'all_active_stores' ? (
                            <td className="py-2.5 px-3">
                              <div className="text-slate-200 font-medium flex items-center gap-1.5">
                                <Warehouse className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                <span>{stInfo?.ShortName || item.StoreID}</span>
                              </div>
                              <div className="text-[11px] font-mono text-slate-500">
                                {item.RackLocation}
                              </div>
                            </td>
                          ) : (
                            <td className="py-2.5 px-3 font-mono text-slate-300">
                              {item.RackLocation}
                            </td>
                          )}

                          <td className="py-2.5 px-3">
                            <div className="text-slate-200 font-medium">{item.SupplierName}</div>
                            <div className="text-[11px] text-sky-400">{item.Group} Group</div>
                          </td>

                          <td className="py-2.5 px-3 font-mono tabular-nums">
                            <div className="text-white font-medium">{item.BatchNumber}</div>
                            <div
                              className={`text-[11px] flex items-center gap-1 ${
                                isNearExpiry ? 'text-amber-400 font-semibold' : 'text-slate-400'
                              }`}
                            >
                              {isNearExpiry && <AlertTriangle className="w-3 h-3" />}
                              <Calendar className="w-3 h-3 text-slate-500" />
                              <span>{item.ExpiryDate}</span>
                            </div>
                          </td>

                          <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-white">
                            {item.Quantity} <span className="text-[10px] font-normal text-slate-400">{item.Unit}</span>
                          </td>

                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-300">
                            {formatCurrency(item.CostPrice)}
                          </td>

                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-300">
                            {formatCurrency(item.MRP)}
                          </td>

                          <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-emerald-400">
                            {formatCurrency(item.Quantity * item.CostPrice)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Iframe-Safe Printable Report Preview Modal */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-700 rounded-xl max-w-4xl w-full max-h-[88vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">
                  Stored Medicine Supplier Tree & Group Report
                </h3>
                <p className="text-[11px] text-slate-400">
                  Generated {new Date().toLocaleString()} · {displayedItems.length} batches ({summaryStats.totalUnits} units)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Now</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              {supplierTree
                .filter((n) => n.batchCount > 0)
                .filter((n) => !selectedSupplierId || n.supplier.SupplierID === selectedSupplierId)
                .map((node) => (
                  <div
                    key={node.supplier.SupplierID}
                    className="border border-slate-800 rounded-lg overflow-hidden"
                  >
                    <div className="px-3.5 py-2 bg-slate-900 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-white">{node.supplier.Name}</span>
                        <span className="text-slate-400 ml-2">· {node.supplier.Phone}</span>
                      </div>
                      <span className="font-mono tabular-nums text-emerald-400 font-bold">
                        {node.totalUnits} units · {formatCurrency(node.totalCostValuation)}
                      </span>
                    </div>

                    <div className="p-3 space-y-2 bg-slate-950">
                      {node.groups
                        .filter(
                          (g) =>
                            selectedGroup === 'All' ||
                            g.groupName.toLowerCase() === selectedGroup.toLowerCase()
                        )
                        .map((grp) => {
                          const grpRows = displayedItems.filter(
                            (i) =>
                              i.SupplierID === node.supplier.SupplierID &&
                              (i.Group || 'General') === grp.groupName
                          );
                          if (grpRows.length === 0) return null;
                          return (
                            <div key={grp.groupName} className="space-y-1">
                              <div className="text-[11px] font-semibold text-sky-400 flex justify-between">
                                <span>Group: {grp.groupName}</span>
                                <span className="font-mono tabular-nums">
                                  Subtotal: {formatCurrency(grp.totalValuation)}
                                </span>
                              </div>
                              <table className="w-full text-left text-[11px] border border-slate-800">
                                <thead className="bg-slate-900/80 text-slate-400">
                                  <tr>
                                    <th className="py-1 px-2">Medicine</th>
                                    <th className="py-1 px-2">Store / Rack</th>
                                    <th className="py-1 px-2">Batch & Exp</th>
                                    <th className="py-1 px-2 text-right">Qty</th>
                                    <th className="py-1 px-2 text-right">Cost</th>
                                    <th className="py-1 px-2 text-right">Valuation</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
                                  {grpRows.map((r) => (
                                    <tr key={r.StoreStockID}>
                                      <td className="py-1 px-2 font-sans text-white">{r.TradeName}</td>
                                      <td className="py-1 px-2 text-slate-400">
                                        {storeMap.get(r.StoreID)?.ShortName} · {r.RackLocation}
                                      </td>
                                      <td className="py-1 px-2 text-slate-300">
                                        {r.BatchNumber} ({r.ExpiryDate})
                                      </td>
                                      <td className="py-1 px-2 text-right text-white">{r.Quantity}</td>
                                      <td className="py-1 px-2 text-right text-slate-300">
                                        {formatCurrency(r.CostPrice)}
                                      </td>
                                      <td className="py-1 px-2 text-right text-emerald-400">
                                        {formatCurrency(r.Quantity * r.CostPrice)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
