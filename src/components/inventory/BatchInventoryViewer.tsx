/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Batches & Physical Inventory Viewer
 * Full batch tracking, FEFO monitoring, cost vs selling prices, Group-Wise Stock Valuation Reports
 */

import React, { useState, useMemo, useEffect } from 'react';
import { usePharmacy } from '../../context/PharmacyContext';
import { Batch } from '../../types/pharmacy';
import { calculateGroupWiseInventoryReport } from '../../utils/intelligentProfitCalculator';
import {
  Boxes,
  Search,
  AlertTriangle,
  Clock,
  ArrowUpDown,
  Edit,
  Archive,
  CheckCircle2,
  X,
  Layers,
  BarChart3,
  Printer,
  DollarSign,
  TrendingUp,
  Tag,
  FileSpreadsheet,
} from 'lucide-react';

export const BatchInventoryViewer: React.FC = () => {
  const {
    batches,
    medicines,
    suppliers,
    groups,
    updateBatch,
    transferToVault,
    systemStats,
    showToast,
    askConfirm,
    currencySymbol,
    formatCurrency,
  } = usePharmacy();

  const [activeTab, setActiveTab] = useState<'batches' | 'group_report'>('batches');
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('All');
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');
  const [expiryFilter, setExpiryFilter] = useState<'all' | '30' | '60' | '90'>('all');
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const rowRefs = React.useRef<{ [key: number]: HTMLTableRowElement | null }>({});

  // Edit price modal
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [newSellingPrice, setNewSellingPrice] = useState<number>(0);

  // Group color badge helper
  const getGroupBadgeClass = (groupName?: string) => {
    const g = (groupName || 'General').toLowerCase();
    if (g.includes('cardiac')) return 'bg-rose-950/80 text-rose-300 border-rose-800/60';
    if (g.includes('herbal')) return 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60';
    if (g.includes('skin')) return 'bg-amber-950/80 text-amber-300 border-amber-800/60';
    if (g.includes('antibiotic')) return 'bg-purple-950/80 text-purple-300 border-purple-800/60';
    if (g.includes('antidiabetic')) return 'bg-teal-950/80 text-teal-300 border-teal-800/60';
    if (g.includes('gastro')) return 'bg-indigo-950/80 text-indigo-300 border-indigo-800/60';
    if (g.includes('respiratory')) return 'bg-cyan-950/80 text-cyan-300 border-cyan-800/60';
    if (g.includes('ophthalmology')) return 'bg-yellow-950/80 text-yellow-300 border-yellow-800/60';
    return 'bg-blue-950/80 text-blue-300 border-blue-800/60';
  };

  const enrichedBatches = useMemo(() => {
    const now = new Date().getTime();
    const dayMs = 24 * 60 * 60 * 1000;

    return batches.map((b) => {
      const med = medicines.find((m) => m.MedicineID === b.MedicineID);
      const supp = suppliers.find((s) => s.SupplierID === b.SupplierID);
      const expTime = new Date(b.ExpiryDate).getTime();
      const diffDays = Math.ceil((expTime - now) / dayMs);
      const effectiveGroup = b.Group || med?.Group || 'General';

      return {
        ...b,
        medicine: med,
        supplier: supp,
        group: effectiveGroup,
        diffDays,
        marginPercent:
          b.SellingPrice > 0 ? Math.round(((b.SellingPrice - b.CostPrice) / b.SellingPrice) * 1000) / 10 : 0,
      };
    });
  }, [batches, medicines, suppliers]);

  // Group-wise inventory report calculation
  const groupInventoryReport = useMemo(() => {
    return calculateGroupWiseInventoryReport(medicines, batches, suppliers);
  }, [medicines, batches, suppliers]);

  const filteredBatches = useMemo(() => {
    return enrichedBatches.filter((b) => {
      const q = search.toLowerCase();
      const matchesSearch =
        b.BatchNumber.toLowerCase().includes(q) ||
        (b.medicine?.TradeName || '').toLowerCase().includes(q) ||
        (b.medicine?.GenericName || '').toLowerCase().includes(q) ||
        (b.medicine?.RackNo || '').toLowerCase().includes(q) ||
        (b.supplier?.Name || '').toLowerCase().includes(q) ||
        b.group.toLowerCase().includes(q);

      const matchesGroup = selectedGroup === 'All' || b.group === selectedGroup;

      let matchesStock = true;
      if (stockFilter === 'in_stock') matchesStock = b.CurrentStock > 0;
      else if (stockFilter === 'out_of_stock') matchesStock = b.CurrentStock === 0;
      else if (stockFilter === 'low_stock') {
        const reorder = b.medicine?.ReorderLevel || 20;
        matchesStock = b.CurrentStock > 0 && b.CurrentStock <= reorder;
      }

      let matchesExpiry = true;
      if (expiryFilter === '30') matchesExpiry = b.diffDays <= 30;
      else if (expiryFilter === '60') matchesExpiry = b.diffDays <= 60;
      else if (expiryFilter === '90') matchesExpiry = b.diffDays <= 90;

      return matchesSearch && matchesGroup && matchesStock && matchesExpiry;
    });
  }, [enrichedBatches, search, selectedGroup, stockFilter, expiryFilter]);

  // Auto-highlight first matching batch row when typing so user can immediately press Down Arrow or Enter
  useEffect(() => {
    if (search.trim().length > 0 && filteredBatches.length > 0) {
      setSelectedIndex(0);
    } else {
      setSelectedIndex(-1);
    }
  }, [search, selectedGroup, stockFilter, expiryFilter, filteredBatches.length]);

  // Keyboard navigation for batch search input
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (filteredBatches.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => {
        const next = prev < filteredBatches.length - 1 ? prev + 1 : 0;
        rowRefs.current[next]?.scrollIntoView({ block: 'nearest' });
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => {
        const next = prev > 0 ? prev - 1 : filteredBatches.length - 1;
        rowRefs.current[next]?.scrollIntoView({ block: 'nearest' });
        return next;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const targetBatch =
        selectedIndex >= 0 && selectedIndex < filteredBatches.length
          ? filteredBatches[selectedIndex]
          : filteredBatches[0];
      if (targetBatch) {
        handleOpenEditPrice(targetBatch);
      }
    } else if (e.key === 'Escape') {
      if (search) {
        setSearch('');
        setSelectedIndex(-1);
      }
    }
  };

  const handleOpenEditPrice = (batch: Batch) => {
    setEditingBatch(batch);
    setNewSellingPrice(batch.SellingPrice);
  };

  const handleSavePrice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBatch) return;

    if (newSellingPrice < editingBatch.CostPrice) {
      askConfirm({
        title: 'Price Guardrail Warning',
        message: `Warning: The new Selling Price (${formatCurrency(newSellingPrice)}) is lower than Cost Price (${formatCurrency(editingBatch.CostPrice)}). Selling below cost price triggers profit margin protection alerts. Are you sure you wish to override?`,
        confirmLabel: 'Override Price',
        cancelLabel: 'Keep Existing',
        isDestructive: true,
        onConfirm: () => {
          updateBatch(editingBatch.BatchID, { SellingPrice: newSellingPrice });
          showToast(`Updated Batch ${editingBatch.BatchNumber} selling price to ${formatCurrency(newSellingPrice)}`, 'warning', 'Price Guardrail Override');
          setEditingBatch(null);
        },
      });
      return;
    }

    updateBatch(editingBatch.BatchID, { SellingPrice: newSellingPrice });
    showToast(`Updated Batch ${editingBatch.BatchNumber} selling price to ${formatCurrency(newSellingPrice)}`, 'success', 'Price Updated');
    setEditingBatch(null);
  };

  // Aggregate totals
  const totalCostValuation = useMemo(() => {
    return batches.reduce((sum, b) => sum + (b.CurrentStock > 0 ? b.CurrentStock * b.CostPrice : 0), 0);
  }, [batches]);

  const totalRetailValuation = useMemo(() => {
    return batches.reduce((sum, b) => sum + (b.CurrentStock > 0 ? b.CurrentStock * b.SellingPrice : 0), 0);
  }, [batches]);

  const totalPotentialProfit = totalRetailValuation - totalCostValuation;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-900 select-none">
      {/* Title Bar & High-Level KPIs */}
      <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Boxes className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white tracking-tight">
              Physical Stock Inventory & Group Valuation Matrix
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Active batch register · Synchronized with medicine profile groups and real-time active MRP revaluations.
          </p>
        </div>

        {/* Aggregate KPI Badges */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <div className="text-slate-400 bg-slate-900 px-3 py-1.5 rounded border border-slate-800">
            Stock Units: <strong className="text-white">{systemStats.totalStockUnits}</strong>
          </div>
          <div className="text-slate-400 bg-slate-900 px-3 py-1.5 rounded border border-slate-800">
            Cost Value: <strong className="text-slate-200">{formatCurrency(totalCostValuation)}</strong>
          </div>
          <div className="text-slate-400 bg-slate-900 px-3 py-1.5 rounded border border-slate-800">
            Retail Value (Active MRP): <strong className="text-emerald-400">{formatCurrency(totalRetailValuation)}</strong>
          </div>
          <div className="text-slate-400 bg-emerald-950/60 px-3 py-1.5 rounded border border-emerald-800/50">
            Unrealized Margin: <strong className="text-emerald-300">+{formatCurrency(totalPotentialProfit)}</strong>
          </div>
        </div>
      </div>

      {/* View Mode Switcher & Filters */}
      <div className="p-3 bg-slate-900/95 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* View Tabs */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded border border-slate-800">
          <button
            onClick={() => setActiveTab('batches')}
            className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeTab === 'batches'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>Batches Matrix ({filteredBatches.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('group_report')}
            className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeTab === 'group_report'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Group-Wise Inventory Valuation ({groupInventoryReport.length} Groups)</span>
          </button>
        </div>

        {/* Group Selector Pill Filters */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded border border-slate-800">
          <span className="text-[10px] font-semibold text-slate-500 uppercase px-1.5">Group:</span>
          {['All', 'General', 'Cardiac', 'Herbal', 'Skin'].map((grp) => (
            <button
              key={grp}
              onClick={() => setSelectedGroup(grp)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                selectedGroup === grp
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {grp}
            </button>
          ))}
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-[11px] text-slate-300 rounded px-1.5 py-0.5 focus:outline-hidden"
          >
            <option value="All">All Groups</option>
            {groups.map((g) => (
              <option key={g} value={g}>
                {g} Group
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="relative min-w-[280px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search batch, trade name, group... (↓/↑ to navigate, Enter to edit)"
            className="w-full pl-8 pr-8 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500"
          />
          {search && (
            <button
              onClick={() => {
                setSearch('');
                setSelectedIndex(-1);
                searchInputRef.current?.focus();
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 rounded"
              title="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* VIEW 1: BATCHES MATRIX */}
      {activeTab === 'batches' && (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="bg-slate-950 border border-slate-800 rounded overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                  <th className="p-3">Batch & Medicine</th>
                  <th className="p-3">Group Division</th>
                  <th className="p-3">Rack</th>
                  <th className="p-3">Expiry Date</th>
                  <th className="p-3">Supplier</th>
                  <th className="p-3 text-right">Cost Price</th>
                  <th className="p-3 text-right">Active MRP</th>
                  <th className="p-3 text-right">Margin %</th>
                  <th className="p-3 text-center">Available Stock</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 font-mono">
                {filteredBatches.map((b, idx) => {
                  const isExpiringSoon = b.diffDays <= 45;
                  const isOut = b.CurrentStock === 0;
                  const isSelected = idx === selectedIndex;

                  return (
                    <tr
                      key={b.BatchID}
                      ref={(el) => { rowRefs.current[idx] = el; }}
                      onClick={() => setSelectedIndex(idx)}
                      className={`transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-950/80 ring-2 ring-emerald-500/50'
                          : 'hover:bg-slate-900/60'
                      }`}
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          {isSelected && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                          )}
                          <span className="font-bold text-slate-100">{b.BatchNumber}</span>
                          <span className="text-[10px] text-slate-400 font-sans font-medium">
                            [{b.medicine?.TradeName}]
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-sans truncate max-w-xs mt-0.5">
                          {b.medicine?.GenericName}
                        </div>
                      </td>

                      <td className="p-3 font-sans">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${getGroupBadgeClass(b.group)}`}>
                          <Layers className="w-2.5 h-2.5" />
                          {b.group}
                        </span>
                      </td>

                      <td className="p-3 font-sans">
                        <span className="text-emerald-400 font-mono bg-emerald-950/60 border border-emerald-800/40 px-1.5 py-0.5 rounded text-[11px]">
                          {b.medicine?.RackNo || 'RACK-A1'}
                        </span>
                      </td>

                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <span className={isExpiringSoon ? 'text-amber-400 font-bold' : 'text-slate-300'}>
                            {b.ExpiryDate}
                          </span>
                          {isExpiringSoon && (
                            <span className="text-[9px] px-1.5 py-0.2 bg-amber-950/80 border border-amber-800/60 text-amber-300 rounded font-sans uppercase">
                              {b.diffDays}d
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-3 font-sans text-slate-400 truncate max-w-[140px]">
                        {b.supplier?.Name || '—'}
                      </td>

                      <td className="p-3 text-right text-slate-300 font-semibold">
                        {formatCurrency(b.CostPrice)}
                      </td>

                      <td className="p-3 text-right">
                        <span className="text-emerald-400 font-bold text-sm">
                          {formatCurrency(b.SellingPrice)}
                        </span>
                      </td>

                      <td className="p-3 text-right">
                        <span className={`font-semibold ${b.marginPercent >= 25 ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {b.marginPercent.toFixed(1)}%
                        </span>
                      </td>

                      <td className="p-3 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded text-xs font-bold ${
                          isOut ? 'bg-slate-800 text-slate-500' : 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                        }`}>
                          {b.CurrentStock} {b.medicine?.Unit || 'Units'}
                        </span>
                      </td>

                      <td className="p-3 text-right font-sans">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEditPrice(b)}
                            className="p-1 text-slate-400 hover:text-emerald-400 bg-slate-900 hover:bg-slate-800 rounded border border-slate-800"
                            title="Adjust Selling Price"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: GROUP-WISE INVENTORY & VALUATION REPORT */}
      {activeTab === 'group_report' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Header Summary */}
          <div className="flex items-center justify-between bg-slate-950 p-4 rounded border border-slate-800">
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                Group-Wise Stock Valuation & Inventory Audit Summary
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Physical quantities, purchase cost values, active retail MRP values, and gross margin breakdown per supplier group.
              </p>
            </div>

            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium flex items-center gap-1.5 border border-slate-700"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Group Valuation Report</span>
            </button>
          </div>

          {/* Group Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {groupInventoryReport.map((grp) => (
              <div
                key={grp.groupName}
                className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3 relative overflow-hidden"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded text-xs font-bold border ${getGroupBadgeClass(grp.groupName)}`}>
                      {grp.groupName} Group
                    </span>
                  </div>
                  <span className="font-mono text-xs text-slate-400 font-semibold">
                    {grp.totalMedicines} SKU · {grp.totalBatches} Batches
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-900 p-2.5 rounded border border-slate-850">
                    <div className="text-[10px] text-slate-400 uppercase">Physical Stock</div>
                    <div className="font-mono font-bold text-white text-sm mt-0.5">
                      {grp.totalStockUnits} Units
                    </div>
                  </div>

                  <div className="bg-slate-900 p-2.5 rounded border border-slate-850">
                    <div className="text-[10px] text-slate-400 uppercase">Gross Margin</div>
                    <div className="font-mono font-bold text-emerald-400 text-sm mt-0.5">
                      {grp.marginPercent.toFixed(1)}%
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs pt-1 border-t border-slate-850">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-400">Total Cost Valuation:</span>
                    <span className="font-mono font-semibold">{formatCurrency(grp.totalCostValuation)}</span>
                  </div>

                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-400">Total Retail Value (MRP):</span>
                    <span className="font-mono font-bold text-emerald-400">{formatCurrency(grp.totalRetailValuation)}</span>
                  </div>

                  <div className="flex items-center justify-between text-emerald-400 pt-1 border-t border-slate-900">
                    <span className="font-semibold">Potential Margin / Gain:</span>
                    <span className="font-mono font-bold">+{formatCurrency(grp.potentialProfit)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-850">
                  <div>
                    Low Stock: <strong className={grp.lowStockItemsCount > 0 ? 'text-rose-400' : 'text-slate-300'}>{grp.lowStockItemsCount}</strong>
                  </div>
                  <div>
                    ≤60d Expiry: <strong className={grp.expiringIn60DaysCount > 0 ? 'text-amber-400' : 'text-slate-300'}>{grp.expiringIn60DaysCount}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EDIT PRICE MODAL */}
      {editingBatch && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-slate-950 border border-slate-700 rounded-lg shadow-2xl max-w-sm w-full overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900">
              <h3 className="font-semibold text-white text-sm">
                Adjust Batch MRP: {editingBatch.BatchNumber}
              </h3>
              <button
                onClick={() => setEditingBatch(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePrice} className="p-4 space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Batch Purchase Cost</label>
                <div className="font-mono text-slate-300 p-2 bg-slate-900 rounded border border-slate-800">
                  {formatCurrency(editingBatch.CostPrice)}
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Selling Price / MRP ({currencySymbol})</label>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  required
                  value={newSellingPrice}
                  onChange={(e) => setNewSellingPrice(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white font-mono font-bold text-sm focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingBatch(null)}
                  className="px-3 py-1.5 rounded text-slate-400 hover:text-white bg-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-sm"
                >
                  Save Price
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
