/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { usePharmacy } from '../../context/PharmacyContext';
import { ExpireVaultItem, Supplier, SupplierCallStatus } from '../../types/pharmacy';
import {
  FolderTree,
  Building2,
  Phone,
  Calendar,
  AlertTriangle,
  Search,
  CheckSquare,
  Square,
  FileText,
  Clock,
  ArrowRight,
  ChevronRight,
  ChevronDown,
  Layers,
  Sparkles,
  ShieldCheck,
  User,
  Plus,
  RefreshCw,
  Eye,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { SupplierCallModal } from './SupplierCallModal';

interface VaultSupplierTreePageProps {
  onNavigateToOutInvoice: (supplierId: string, preselectedVaultIds?: string[]) => void;
  onNavigateToFastAdjust: () => void;
}

export const VaultSupplierTreePage: React.FC<VaultSupplierTreePageProps> = ({
  onNavigateToOutInvoice,
  onNavigateToFastAdjust,
}) => {
  const {
    expireVault,
    suppliers,
    groups,
    formatCurrency,
    showToast,
  } = usePharmacy();

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string>('All');
  const [callStatusFilter, setCallStatusFilter] = useState<'all' | SupplierCallStatus>('all');

  // Supplier Tree expanded nodes
  const [expandedSuppliers, setExpandedSuppliers] = useState<Record<string, boolean>>({
    'SUP-001': true,
    'SUP-002': true,
    'SUP-003': true,
    'SUP-004': true,
  });

  // Selected items for bulk Out-Invoice
  const [selectedVaultIds, setSelectedVaultIds] = useState<string[]>([]);

  // Supplier call modal
  const [callModalSupplier, setCallModalSupplier] = useState<Supplier | null>(null);

  // 1. Filter only items that are currently kept in the vault (InVault)
  const waitingVaultItems = useMemo(() => {
    return expireVault.filter((item) => item.ReturnStatus === 'InVault');
  }, [expireVault]);

  // 2. Build the Hierarchical Supplier Tree:
  // Supplier -> Groups -> Items
  const supplierTreeData = useMemo(() => {
    return suppliers.map((sup) => {
      const supVaultItems = waitingVaultItems.filter((item) => item.SupplierID === sup.SupplierID);
      const totalUnits = supVaultItems.reduce((sum, item) => sum + item.Quantity, 0);
      const totalCostValue = supVaultItems.reduce((sum, item) => sum + item.CostPrice * item.Quantity, 0);

      // Determine predominant call status for this supplier
      let overallCallStatus: SupplierCallStatus = 'NotCalled';
      const scheduledItem = supVaultItems.find((i) => i.CallStatus === 'ScheduledVisit');
      const awaitingItem = supVaultItems.find((i) => i.CallStatus === 'AwaitingArrival');
      const calledItem = supVaultItems.find((i) => i.CallStatus === 'Called');

      if (awaitingItem) overallCallStatus = 'AwaitingArrival';
      else if (scheduledItem) overallCallStatus = 'ScheduledVisit';
      else if (calledItem) overallCallStatus = 'Called';

      // Group sub-tree
      const groupMap = new Map<string, ExpireVaultItem[]>();
      supVaultItems.forEach((item) => {
        const grp = item.Group || 'General';
        if (!groupMap.has(grp)) groupMap.set(grp, []);
        groupMap.get(grp)!.push(item);
      });

      const groupNodes = Array.from(groupMap.entries()).map(([grpName, items]) => ({
        groupName: grpName,
        itemCount: items.length,
        totalUnits: items.reduce((s, i) => s + i.Quantity, 0),
        totalValue: items.reduce((s, i) => s + i.CostPrice * i.Quantity, 0),
        items,
      }));

      return {
        supplier: sup,
        totalItems: supVaultItems.length,
        totalUnits,
        totalCostValue: Math.round(totalCostValue * 100) / 100,
        callStatus: overallCallStatus,
        lastCalledAt: supVaultItems[0]?.LastCalledAt || null,
        callNotes: supVaultItems[0]?.CallNotes || null,
        groups: groupNodes,
        vaultItems: supVaultItems,
      };
    });
  }, [suppliers, waitingVaultItems]);

  // Overall KPIs
  const totalWaitingUnits = useMemo(() => {
    return waitingVaultItems.reduce((sum, i) => sum + i.Quantity, 0);
  }, [waitingVaultItems]);

  const totalWaitingValue = useMemo(() => {
    return waitingVaultItems.reduce((sum, i) => sum + i.CostPrice * i.Quantity, 0);
  }, [waitingVaultItems]);

  const suppliersWithStockCount = useMemo(() => {
    const ids = new Set(waitingVaultItems.map((i) => i.SupplierID));
    return ids.size;
  }, [waitingVaultItems]);

  // 3. Filtered items for display in the main table
  const displayedItems = useMemo(() => {
    return waitingVaultItems.filter((item) => {
      // Tree filter
      if (selectedSupplierId && item.SupplierID !== selectedSupplierId) return false;

      // Group filter
      if (selectedGroup !== 'All' && (item.Group || 'General').toLowerCase() !== selectedGroup.toLowerCase()) {
        return false;
      }

      // Call status filter
      if (callStatusFilter !== 'all') {
        const itemCallStatus = item.CallStatus || 'NotCalled';
        if (itemCallStatus !== callStatusFilter) return false;
      }

      // Search query: trade name, generic, batch, supplier, barcode, rack
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = item.TradeName.toLowerCase().includes(q);
        const matchGen = item.GenericName.toLowerCase().includes(q);
        const matchBatch = item.BatchNumber.toLowerCase().includes(q);
        const matchSup = item.SupplierName.toLowerCase().includes(q);
        const matchNotes = item.Notes?.toLowerCase().includes(q) || false;
        if (!matchName && !matchGen && !matchBatch && !matchSup && !matchNotes) {
          return false;
        }
      }

      return true;
    });
  }, [waitingVaultItems, selectedSupplierId, selectedGroup, callStatusFilter, searchQuery]);

  const [vaultItemHighlightIndex, setVaultItemHighlightIndex] = useState<number>(0);
  const vaultRowRefs = useRef<{ [key: number]: HTMLTableRowElement | null }>({});

  useEffect(() => {
    setVaultItemHighlightIndex(0);
  }, [searchQuery, selectedSupplierId, selectedGroup, callStatusFilter]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (displayedItems.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setVaultItemHighlightIndex((prev) => {
        const next = prev < displayedItems.length - 1 ? prev + 1 : 0;
        vaultRowRefs.current[next]?.scrollIntoView({ block: 'nearest' });
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setVaultItemHighlightIndex((prev) => {
        const next = prev > 0 ? prev - 1 : displayedItems.length - 1;
        vaultRowRefs.current[next]?.scrollIntoView({ block: 'nearest' });
        return next;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = displayedItems[vaultItemHighlightIndex] || displayedItems[0];
      if (target) {
        handleToggleSelectItem(target.VaultID);
      }
    } else if (e.key === 'Escape') {
      setSearchQuery('');
    }
  };

  // Tree toggle
  const toggleSupplierExpand = (supplierId: string) => {
    setExpandedSuppliers((prev) => ({
      ...prev,
      [supplierId]: !prev[supplierId],
    }));
  };

  // Multi-select handlers
  const handleToggleSelectAll = () => {
    if (selectedVaultIds.length === displayedItems.length && displayedItems.length > 0) {
      setSelectedVaultIds([]);
    } else {
      setSelectedVaultIds(displayedItems.map((i) => i.VaultID));
    }
  };

  const handleToggleSelectItem = (vaultId: string) => {
    setSelectedVaultIds((prev) =>
      prev.includes(vaultId) ? prev.filter((id) => id !== vaultId) : [...prev, vaultId]
    );
  };

  // Bulk Out-Invoice action
  const handleBulkOutInvoice = () => {
    if (selectedVaultIds.length === 0) {
      showToast('Select at least one waiting item to create an Out-Invoice.', 'warning');
      return;
    }

    // Check if all selected items belong to the same supplier
    const selectedItems = waitingVaultItems.filter((i) => selectedVaultIds.includes(i.VaultID));
    const supplierIds = Array.from(new Set(selectedItems.map((i) => i.SupplierID)));

    if (supplierIds.length > 1) {
      showToast(
        'An Expire Out-Invoice must be issued to a single supplier. Please select items from the same supplier.',
        'warning',
        'Multiple Suppliers Selected'
      );
      return;
    }

    const targetSupplierId = supplierIds[0];
    onNavigateToOutInvoice(targetSupplierId, selectedVaultIds);
  };

  // Quick single-supplier out-invoice action
  const handleCreateOutInvoiceForSupplier = (supplierId: string) => {
    const supItems = waitingVaultItems.filter((i) => i.SupplierID === supplierId);
    if (supItems.length === 0) {
      showToast('No expired items waiting in vault for this supplier.', 'info');
      return;
    }
    onNavigateToOutInvoice(supplierId);
  };

  const getCallBadge = (status?: SupplierCallStatus) => {
    switch (status) {
      case 'ScheduledVisit':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
            <Calendar className="w-3 h-3 text-amber-400" />
            Visit Scheduled
          </span>
        );
      case 'Called':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40">
            <Phone className="w-3 h-3 text-sky-400" />
            Called
          </span>
        );
      case 'AwaitingArrival':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
            <Clock className="w-3 h-3 text-purple-400" />
            Awaiting Arrival
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
            <AlertCircle className="w-3 h-3 text-slate-500" />
            Not Called
          </span>
        );
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-900 overflow-hidden">
      {/* Top Metric Cards */}
      <div className="p-4 bg-slate-950/80 border-b border-slate-800 shrink-0">
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Waiting in Vault
              </p>
              <p className="text-xl font-bold text-white">
                {waitingVaultItems.length} <span className="text-xs font-normal text-slate-400">batches ({totalWaitingUnits} units)</span>
              </p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Vault Stock Valuation
              </p>
              <p className="text-xl font-bold text-emerald-400">
                {formatCurrency(totalWaitingValue)}
              </p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Suppliers with Stock
              </p>
              <p className="text-xl font-bold text-white">
                {suppliersWithStockCount} <span className="text-xs font-normal text-slate-400">pharma companies</span>
              </p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Quarantine Actions
              </p>
              <p className="text-xs text-slate-300 mt-1">
                Move more expired stock to vault
              </p>
            </div>
            <button
              onClick={onNavigateToFastAdjust}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Send to Vault
            </button>
          </div>
        </div>
      </div>

      {/* Main Split Layout: Left Supplier Tree | Right Waiting Items */}
      <div className="flex-1 flex overflow-hidden">
        {/* =========================================================================
            LEFT PANEL: HIERARCHICAL SUPPLIER TREE
            ========================================================================= */}
        <aside className="w-80 bg-slate-950 border-r border-slate-800 flex flex-col shrink-0 overflow-hidden">
          {/* Tree Header */}
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950">
            <div className="flex items-center gap-2">
              <FolderTree className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Supplier Tree
              </h3>
            </div>
            <span className="text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono">
              {suppliers.length}
            </span>
          </div>

          {/* Quick tree filter: All Suppliers Root Node */}
          <div className="p-2 border-b border-slate-800/80">
            <button
              onClick={() => setSelectedSupplierId(null)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                selectedSupplierId === null
                  ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40'
                  : 'text-slate-300 hover:bg-slate-900'
              }`}
            >
              <span className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>All Suppliers in Vault</span>
              </span>
              <span className="font-mono text-[11px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">
                {waitingVaultItems.length}
              </span>
            </button>
          </div>

          {/* Scrollable Tree Nodes */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {supplierTreeData.map((node) => {
              const isSelected = selectedSupplierId === node.supplier.SupplierID;
              const isExpanded = expandedSuppliers[node.supplier.SupplierID] || false;
              const hasWaiting = node.totalItems > 0;

              return (
                <div
                  key={node.supplier.SupplierID}
                  className={`rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-slate-900 border-emerald-500/50 shadow-md'
                      : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  {/* Supplier Node Bar */}
                  <div className="p-2.5 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <div
                        onClick={() => setSelectedSupplierId(node.supplier.SupplierID)}
                        className="flex-1 flex items-center gap-2 cursor-pointer select-none"
                      >
                        <Building2
                          className={`w-4 h-4 shrink-0 ${
                            hasWaiting ? 'text-amber-400' : 'text-slate-500'
                          }`}
                        />
                        <div className="truncate">
                          <p className="text-xs font-bold text-white truncate">
                            {node.supplier.Name}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-500" />
                            {node.supplier.Phone}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => toggleSupplierExpand(node.supplier.SupplierID)}
                        className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {/* Badge & Value row */}
                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/60">
                      <div className="flex items-center gap-1.5">
                        {getCallBadge(node.callStatus)}
                      </div>
                      <div className="text-right font-mono">
                        <span className={`font-bold ${hasWaiting ? 'text-amber-300' : 'text-slate-500'}`}>
                          {node.totalItems} items
                        </span>
                        <span className="text-slate-400 text-[10px] ml-1">
                          ({formatCurrency(node.totalCostValue)})
                        </span>
                      </div>
                    </div>

                    {/* Quick Action Buttons on Tree Node */}
                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCallModalSupplier(node.supplier);
                        }}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-sky-300 rounded text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors"
                      >
                        <Phone className="w-3 h-3 text-sky-400" />
                        Call Supplier
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCreateOutInvoiceForSupplier(node.supplier.SupplierID);
                        }}
                        disabled={!hasWaiting}
                        className={`px-2 py-1 rounded text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors ${
                          hasWaiting
                            ? 'bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 border border-amber-500/40'
                            : 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed'
                        }`}
                      >
                        <FileText className="w-3 h-3 text-amber-400" />
                        Out-Invoice
                      </button>
                    </div>
                  </div>

                  {/* Expandable Group & Item Nodes */}
                  {isExpanded && node.groups.length > 0 && (
                    <div className="bg-slate-950/80 px-2.5 py-1.5 border-t border-slate-800/60 space-y-1">
                      {node.groups.map((grp) => (
                        <div
                          key={grp.groupName}
                          onClick={() => {
                            setSelectedSupplierId(node.supplier.SupplierID);
                            setSelectedGroup(grp.groupName);
                          }}
                          className={`flex items-center justify-between px-2 py-1 rounded text-[11px] cursor-pointer transition-colors ${
                            selectedSupplierId === node.supplier.SupplierID && selectedGroup === grp.groupName
                              ? 'bg-emerald-950/60 text-emerald-300 font-semibold border border-emerald-800/60'
                              : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                          }`}
                        >
                          <span className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
                            <span>{grp.groupName} Group</span>
                          </span>
                          <span className="font-mono text-[10px] bg-slate-900 px-1 rounded text-slate-300">
                            {grp.itemCount} ({formatCurrency(grp.totalValue)})
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        {/* =========================================================================
            RIGHT MAIN PANEL: SEARCH & WAITING MEDICINES IN VAULT
            ========================================================================= */}
        <section className="flex-1 flex flex-col overflow-hidden">
          {/* Filter & Search Bar */}
          <div className="p-4 bg-slate-900 border-b border-slate-800 space-y-3 shrink-0">
            <div className="flex items-center gap-3">
              {/* Search input */}
              <div className="flex-1 relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Find medicine waiting in vault... (↓/↑ to navigate, Enter to select)"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 shadow-inner"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-white"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Call status filter */}
              <select
                value={callStatusFilter}
                onChange={(e) => setCallStatusFilter(e.target.value as any)}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
              >
                <option value="all">All Call Statuses</option>
                <option value="NotCalled">Not Called</option>
                <option value="Called">Called (Informed)</option>
                <option value="ScheduledVisit">Scheduled Visit</option>
                <option value="AwaitingArrival">Awaiting Arrival</option>
              </select>

              {/* Group filter */}
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
              >
                <option value="All">All Groups</option>
                {groups.map((g) => (
                  <option key={g} value={g}>
                    {g} Group
                  </option>
                ))}
              </select>
            </div>

            {/* Active Filter Indicators & Batch select header */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-medium">Viewing:</span>
                {selectedSupplierId ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-semibold">
                    <Building2 className="w-3.5 h-3.5" />
                    {suppliers.find((s) => s.SupplierID === selectedSupplierId)?.Name}
                    <button
                      onClick={() => setSelectedSupplierId(null)}
                      className="ml-1 text-slate-400 hover:text-white"
                    >
                      ×
                    </button>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-xs">
                    All Suppliers
                  </span>
                )}

                {selectedGroup !== 'All' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 rounded-lg text-xs font-semibold">
                    {selectedGroup} Group
                    <button
                      onClick={() => setSelectedGroup('All')}
                      className="ml-1 text-slate-400 hover:text-white"
                    >
                      ×
                    </button>
                  </span>
                )}

                <span className="text-slate-500 text-[11px]">
                  ({displayedItems.length} matching batch{displayedItems.length !== 1 ? 'es' : ''})
                </span>
              </div>

              {/* Multi-select control */}
              {displayedItems.length > 0 && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleToggleSelectAll}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                  >
                    {selectedVaultIds.length === displayedItems.length ? (
                      <CheckSquare className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-500" />
                    )}
                    <span>
                      {selectedVaultIds.length === displayedItems.length
                        ? 'Deselect All'
                        : `Select All (${displayedItems.length})`}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Table of Expired Medicines Waiting in Vault */}
          <div className="flex-1 overflow-y-auto p-4">
            {displayedItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
                <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/60 mb-3">
                  <ShieldCheck className="w-10 h-10 text-emerald-400" />
                </div>
                <h4 className="text-base font-bold text-white mb-1">
                  No Expired Stock Waiting in Vault
                </h4>
                <p className="text-xs text-slate-400 max-w-md mb-4">
                  {searchQuery || selectedSupplierId || selectedGroup !== 'All'
                    ? 'No vault items match the active filters or search terms. Try clearing filters.'
                    : 'All expired medicines in the vault have either been out-invoiced, exchanged for good medicines, or settled in cash.'}
                </p>
                <div className="flex items-center gap-3">
                  {(searchQuery || selectedSupplierId || selectedGroup !== 'All') && (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedSupplierId(null);
                        setSelectedGroup('All');
                        setCallStatusFilter('all');
                      }}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold"
                    >
                      Reset All Filters
                    </button>
                  )}
                  <button
                    onClick={onNavigateToFastAdjust}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-lg shadow-emerald-900/30"
                  >
                    <Plus className="w-4 h-4" />
                    Transfer Near-Expiry Stock to Vault
                  </button>
                </div>
              </div>
            ) : (
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/50 shadow-sm">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-3 w-10 text-center">
                        <button onClick={handleToggleSelectAll}>
                          {selectedVaultIds.length === displayedItems.length ? (
                            <CheckSquare className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-600" />
                          )}
                        </button>
                      </th>
                      <th className="py-3 px-3">Medicine & Generic</th>
                      <th className="py-3 px-3">Batch & Expiry</th>
                      <th className="py-3 px-3">Supplier & Rep</th>
                      <th className="py-3 px-3">Call Status</th>
                      <th className="py-3 px-3 text-right">In Vault</th>
                      <th className="py-3 px-3 text-right">Unit Cost</th>
                      <th className="py-3 px-3 text-right">Total (৳)</th>
                      <th className="py-3 px-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {displayedItems.map((item, idx) => {
                      const isSelected = selectedVaultIds.includes(item.VaultID);
                      const isHighlighted = idx === vaultItemHighlightIndex;
                      const lineTotal = item.CostPrice * item.Quantity;
                      const supp = suppliers.find((s) => s.SupplierID === item.SupplierID);

                      return (
                        <tr
                          key={item.VaultID}
                          ref={(el) => { vaultRowRefs.current[idx] = el; }}
                          onClick={() => setVaultItemHighlightIndex(idx)}
                          className={`transition-colors cursor-pointer ${
                            isHighlighted
                              ? 'bg-emerald-950/70 ring-1 ring-emerald-500/70 text-white'
                              : isSelected
                              ? 'bg-emerald-950/20 hover:bg-emerald-950/30'
                              : 'hover:bg-slate-900/70'
                          }`}
                        >
                          <td className="py-3 px-3 text-center">
                            <button onClick={() => handleToggleSelectItem(item.VaultID)}>
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-600 hover:text-slate-400" />
                              )}
                            </button>
                          </td>

                          {/* Medicine Name & Generic */}
                          <td className="py-3 px-3">
                            <div className="font-bold text-white flex items-center gap-1.5">
                              <span>{item.TradeName}</span>
                              <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-800 text-slate-300 font-normal">
                                {item.Group || 'General'}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 italic">
                              {item.GenericName}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              ID: {item.VaultID} • Quarantined {new Date(item.TransferDate).toLocaleDateString()}
                            </div>
                          </td>

                          {/* Batch & Expiry */}
                          <td className="py-3 px-3 font-mono">
                            <div className="text-amber-300 font-bold">{item.BatchNumber}</div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <Calendar className="w-3 h-3 text-slate-500" />
                              {item.ExpiryDate || 'Expired'}
                            </div>
                          </td>

                          {/* Supplier & Rep */}
                          <td className="py-3 px-3">
                            <div className="font-semibold text-slate-200">
                              {item.SupplierName}
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3 text-slate-500" />
                              {item.SupplierPhone || supp?.Phone || 'N/A'}
                            </div>
                            {item.SupplierRepresentative && (
                              <div className="text-[10px] text-slate-500">
                                Rep: {item.SupplierRepresentative}
                              </div>
                            )}
                          </td>

                          {/* Call Status */}
                          <td className="py-3 px-3">
                            <div>{getCallBadge(item.CallStatus)}</div>
                            {item.LastCalledAt && (
                              <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-500" />
                                {new Date(item.LastCalledAt).toLocaleDateString()}
                              </div>
                            )}
                            {item.CallNotes && (
                              <div className="text-[10px] text-slate-400 truncate max-w-[140px] italic">
                                "{item.CallNotes}"
                              </div>
                            )}
                          </td>

                          {/* In Vault Quantity */}
                          <td className="py-3 px-3 text-right font-mono font-bold text-white text-sm">
                            {item.Quantity}
                          </td>

                          {/* Unit Cost */}
                          <td className="py-3 px-3 text-right font-mono text-slate-300">
                            {formatCurrency(item.CostPrice)}
                          </td>

                          {/* Line Total */}
                          <td className="py-3 px-3 text-right font-mono font-bold text-amber-300">
                            {formatCurrency(lineTotal)}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => {
                                  onNavigateToOutInvoice(item.SupplierID, [item.VaultID]);
                                }}
                                title="Create Out-Invoice for this item"
                                className="px-2.5 py-1 bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>Out-Invoice</span>
                              </button>

                              {supp && (
                                <button
                                  onClick={() => setCallModalSupplier(supp)}
                                  title="Log Phone Call to Supplier"
                                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-lg transition-colors"
                                >
                                  <Phone className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Sticky Bottom Multi-Select Action Bar */}
          {selectedVaultIds.length > 0 && (
            <div className="p-3 bg-slate-950 border-t border-emerald-500/30 flex items-center justify-between shrink-0 shadow-xl">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-xs text-white">
                  <strong>{selectedVaultIds.length}</strong> batch
                  {selectedVaultIds.length !== 1 ? 'es' : ''} selected from vault
                </span>
                <span className="text-xs text-slate-400">
                  Total return value:{' '}
                  <strong className="text-emerald-400 font-mono">
                    {formatCurrency(
                      waitingVaultItems
                        .filter((i) => selectedVaultIds.includes(i.VaultID))
                        .reduce((sum, i) => sum + i.CostPrice * i.Quantity, 0)
                    )}
                  </strong>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedVaultIds([])}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium"
                >
                  Clear Selection
                </button>
                <button
                  onClick={handleBulkOutInvoice}
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-lg shadow-amber-900/30 transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  <span>Generate Expire Out-Invoice for Selected ({selectedVaultIds.length})</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Supplier Call Modal */}
      <SupplierCallModal
        isOpen={!!callModalSupplier}
        onClose={() => setCallModalSupplier(null)}
        supplier={callModalSupplier}
      />
    </div>
  );
};
