/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Consolidated Live Stock Dashboard ("Live Stock")
 * - Shows EVERY catalog medicine organized with an interactive Supplier Tree -> Group explorer
 * - Real-time balance breakdown across Pharmacy Counter + Store-1 + Store-2 + Store-3 + Total Balance
 * - Shows exact stored locations & rack codes so staff immediately see which medicine is in which store
 * - Respects Individual Store ON/OFF governance from Settings and RBAC boundaries for Salesmen
 */

import React, { useState, useMemo } from 'react';
import { usePharmacy } from '../../context/PharmacyContext';
import { Batch, Medicine, StoreStockItem, Supplier, WarehouseStore } from '../../types/pharmacy';
import {
  Layers,
  FolderTree,
  Building2,
  Search,
  ChevronRight,
  ChevronDown,
  Boxes,
  Pill,
  Warehouse,
  ShoppingCart,
  Download,
  Printer,
  Settings,
  X,
  AlertTriangle,
  CheckCircle2,
  ArrowRightLeft,
} from 'lucide-react';

interface LiveStockDashboardProps {
  onBackToPos: () => void;
  onOpenStore: () => void;
  onOpenStoreSettings: () => void;
}

type LocationFilter =
  | 'ALL'
  | 'PHARMACY'
  | 'STR-01'
  | 'STR-02'
  | 'STR-03'
  | 'COUNTER_LOW_IN_STORES'
  | 'OUT_OF_STOCK';

interface EnrichedLiveMedicineRow {
  medicine: Medicine;
  supplier: Supplier | undefined;
  supplierName: string;
  groupName: string;
  piecesPerPack: number;
  packMrp: number;
  pieceMrp: number;
  pharmacyPackBalance: number;
  pharmacyPieceBalance: number;
  pharmacyBatches: Batch[];
  storeBalancesByStoreId: Record<
    string,
    {
      packQty: number;
      pieceQty: number;
      racks: string[];
      batches: StoreStockItem[];
    }
  >;
  activeStoresPackTotal: number;
  activeStoresPieceTotal: number;
  totalPackBalance: number;
  totalPieceBalance: number;
  storedLocationLabels: string[];
  isCounterLowWithStoreBackup: boolean;
}

export const LiveStockDashboard: React.FC<LiveStockDashboardProps> = ({
  onBackToPos,
  onOpenStore,
  onOpenStoreSettings,
}) => {
  const {
    medicines,
    batches,
    stores,
    storeStocks,
    suppliers,
    groups,
    currentUser,
    currencySymbol,
    formatCurrency,
    receiptSettings,
    showToast,
    recordLogisticsSyncExport,
  } = usePharmacy();

  const role = currentUser?.Role || 'Salesman';
  const isAdmin = role === 'Admin';
  const isModerator = role === 'Moderator';
  const isSalesman = role === 'Salesman';

  // Active stores governed by Settings ON/OFF switches
  const activeStores = useMemo(
    () =>
      [...stores]
        .filter((s) => s.IsActive)
        .sort((a, b) => a.StoreNumber - b.StoreNumber),
    [stores]
  );

  const inactiveStoresCount = stores.length - activeStores.length;

  // Filters & view state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string>('All');
  const [locationFilter, setLocationFilter] = useState<LocationFilter>('ALL');
  const [unitView, setUnitView] = useState<'pack' | 'piece'>('pack');
  const [expandedMedicineId, setExpandedMedicineId] = useState<string | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const [expandedSuppliers, setExpandedSuppliers] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    suppliers.forEach((s) => {
      initial[s.SupplierID] = true;
    });
    return initial;
  });

  // Compute live stock across Pharmacy Counter + all active Regional Stores for EVERY medicine
  const allLiveRows = useMemo<EnrichedLiveMedicineRow[]>(() => {
    const activeCatalog = medicines.filter((m) => m.Status === 'Active');

    return activeCatalog.map((med) => {
      const sup = suppliers.find((s) => s.SupplierID === med.SupplierID);
      const supplierName = sup?.Name || 'Unassigned Supplier';
      const groupName = med.Group || 'General';

      let piecesPerPack = med.PiecesPerBox || 1;
      if (!med.PiecesPerBox) {
        if (med.Unit === 'Strip' || med.Unit === 'Box') piecesPerPack = 10;
        else piecesPerPack = 1;
      }

      // Pharmacy Counter batches
      const medCounterBatches = batches
        .filter((b) => b.MedicineID === med.MedicineID && b.CurrentStock > 0)
        .sort((a, b) => new Date(a.ExpiryDate).getTime() - new Date(b.ExpiryDate).getTime());

      const pharmacyPackBalance = medCounterBatches.reduce((sum, b) => sum + b.CurrentStock, 0);
      const pharmacyPieceBalance = pharmacyPackBalance * piecesPerPack;

      const packMrp =
        medCounterBatches[0]?.SellingPrice || med.MRP || 0;
      const pieceMrp =
        piecesPerPack > 1
          ? Math.round((packMrp / piecesPerPack) * 100) / 100
          : packMrp;

      // Per-store balances (only active stores count toward operational live balance)
      const storeBalancesByStoreId: EnrichedLiveMedicineRow['storeBalancesByStoreId'] = {};
      let activeStoresPackTotal = 0;
      const storedLocationLabels: string[] = [];

      if (pharmacyPackBalance > 0) {
        storedLocationLabels.push(`Pharmacy (${med.RackNo})`);
      }

      stores.forEach((st) => {
        const stBatches = storeStocks
          .filter(
            (item) =>
              item.StoreID === st.StoreID &&
              item.MedicineID === med.MedicineID &&
              item.Quantity > 0
          )
          .sort((a, b) => new Date(a.ExpiryDate).getTime() - new Date(b.ExpiryDate).getTime());

        const packQty = stBatches.reduce((sum, i) => sum + i.Quantity, 0);
        const pieceQty = packQty * piecesPerPack;
        const racks = Array.from(
          new Set(stBatches.map((i) => i.RackLocation).filter(Boolean))
        );

        storeBalancesByStoreId[st.StoreID] = {
          packQty,
          pieceQty,
          racks,
          batches: stBatches,
        };

        if (st.IsActive && packQty > 0) {
          activeStoresPackTotal += packQty;
          const rackSuffix = racks.length > 0 ? ` (${racks[0]})` : '';
          storedLocationLabels.push(`Store-${st.StoreNumber}${rackSuffix}`);
        }
      });

      const activeStoresPieceTotal = activeStoresPackTotal * piecesPerPack;
      const totalPackBalance = pharmacyPackBalance + activeStoresPackTotal;
      const totalPieceBalance = pharmacyPieceBalance + activeStoresPieceTotal;

      const isCounterLowWithStoreBackup =
        pharmacyPackBalance <= med.ReorderLevel && activeStoresPackTotal > 0;

      return {
        medicine: med,
        supplier: sup,
        supplierName,
        groupName,
        piecesPerPack,
        packMrp,
        pieceMrp,
        pharmacyPackBalance,
        pharmacyPieceBalance,
        pharmacyBatches: medCounterBatches,
        storeBalancesByStoreId,
        activeStoresPackTotal,
        activeStoresPieceTotal,
        totalPackBalance,
        totalPieceBalance,
        storedLocationLabels,
        isCounterLowWithStoreBackup,
      };
    });
  }, [medicines, batches, stores, storeStocks, suppliers]);

  // Build Hierarchical Supplier Tree -> Group across EVERY medicine
  const supplierTree = useMemo(() => {
    return suppliers.map((sup) => {
      const supRows = allLiveRows.filter((r) => r.medicine.SupplierID === sup.SupplierID);
      const totalSkus = supRows.length;
      const totalPackUnits = supRows.reduce((s, r) => s + r.totalPackBalance, 0);
      const totalPieceUnits = supRows.reduce((s, r) => s + r.totalPieceBalance, 0);

      const grpMap = new Map<string, EnrichedLiveMedicineRow[]>();
      supRows.forEach((row) => {
        const g = row.groupName;
        if (!grpMap.has(g)) grpMap.set(g, []);
        grpMap.get(g)!.push(row);
      });

      const groupNodes = Array.from(grpMap.entries())
        .map(([groupName, rows]) => ({
          groupName,
          skuCount: rows.length,
          packUnits: rows.reduce((s, r) => s + r.totalPackBalance, 0),
          pieceUnits: rows.reduce((s, r) => s + r.totalPieceBalance, 0),
        }))
        .sort((a, b) => b.packUnits - a.packUnits || a.groupName.localeCompare(b.groupName));

      return {
        supplier: sup,
        totalSkus,
        totalPackUnits,
        totalPieceUnits,
        groups: groupNodes,
      };
    });
  }, [suppliers, allLiveRows]);

  // Filtered rows based on Supplier Tree, Group, Location Presence, and Search Query
  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return allLiveRows
      .filter((row) => {
        if (selectedSupplierId && row.medicine.SupplierID !== selectedSupplierId) {
          return false;
        }
        if (selectedGroup !== 'All' && row.groupName !== selectedGroup) {
          return false;
        }

        if (locationFilter === 'PHARMACY' && row.pharmacyPackBalance <= 0) {
          return false;
        }
        if (
          (locationFilter === 'STR-01' ||
            locationFilter === 'STR-02' ||
            locationFilter === 'STR-03') &&
          (row.storeBalancesByStoreId[locationFilter]?.packQty || 0) <= 0
        ) {
          return false;
        }
        if (locationFilter === 'COUNTER_LOW_IN_STORES' && !row.isCounterLowWithStoreBackup) {
          return false;
        }
        if (locationFilter === 'OUT_OF_STOCK' && row.totalPackBalance > 0) {
          return false;
        }

        if (q) {
          const matchesMed =
            row.medicine.TradeName.toLowerCase().includes(q) ||
            row.medicine.GenericName.toLowerCase().includes(q) ||
            row.medicine.Barcode.toLowerCase().includes(q) ||
            row.medicine.RackNo.toLowerCase().includes(q) ||
            row.supplierName.toLowerCase().includes(q) ||
            row.groupName.toLowerCase().includes(q) ||
            row.storedLocationLabels.some((lbl) => lbl.toLowerCase().includes(q));
          if (!matchesMed) return false;
        }

        return true;
      })
      .sort((a, b) => a.medicine.TradeName.localeCompare(b.medicine.TradeName));
  }, [allLiveRows, selectedSupplierId, selectedGroup, locationFilter, searchQuery]);

  // Overall & Filtered Summary Totals
  const globalTotals = useMemo(() => {
    const usePieces = unitView === 'piece';
    let pharmacy = 0;
    const perStore: Record<string, number> = { 'STR-01': 0, 'STR-02': 0, 'STR-03': 0 };
    let total = 0;
    let retailValuation = 0;
    let stockedSkus = 0;
    let counterLowWithBackup = 0;

    allLiveRows.forEach((row) => {
      pharmacy += usePieces ? row.pharmacyPieceBalance : row.pharmacyPackBalance;
      activeStores.forEach((st) => {
        const entry = row.storeBalancesByStoreId[st.StoreID];
        if (entry) {
          perStore[st.StoreID] =
            (perStore[st.StoreID] || 0) + (usePieces ? entry.pieceQty : entry.packQty);
        }
      });
      total += usePieces ? row.totalPieceBalance : row.totalPackBalance;
      retailValuation += row.totalPackBalance * row.packMrp;
      if (row.totalPackBalance > 0) stockedSkus += 1;
      if (row.isCounterLowWithStoreBackup) counterLowWithBackup += 1;
    });

    return {
      totalSkus: allLiveRows.length,
      stockedSkus,
      outOfStockSkus: allLiveRows.length - stockedSkus,
      counterLowWithBackup,
      pharmacy,
      perStore,
      total,
      retailValuation,
    };
  }, [allLiveRows, activeStores, unitView]);

  const filteredColumnTotals = useMemo(() => {
    const usePieces = unitView === 'piece';
    let pharmacy = 0;
    const perStore: Record<string, number> = { 'STR-01': 0, 'STR-02': 0, 'STR-03': 0 };
    let total = 0;

    filteredRows.forEach((row) => {
      pharmacy += usePieces ? row.pharmacyPieceBalance : row.pharmacyPackBalance;
      activeStores.forEach((st) => {
        const entry = row.storeBalancesByStoreId[st.StoreID];
        if (entry) {
          perStore[st.StoreID] =
            (perStore[st.StoreID] || 0) + (usePieces ? entry.pieceQty : entry.packQty);
        }
      });
      total += usePieces ? row.totalPieceBalance : row.totalPackBalance;
    });

    return { pharmacy, perStore, total };
  }, [filteredRows, activeStores, unitView]);

  const toggleSupplierExpand = (supplierId: string) => {
    setExpandedSuppliers((prev) => ({
      ...prev,
      [supplierId]: !prev[supplierId],
    }));
  };

  const setAllSuppliersExpanded = (expanded: boolean) => {
    const next: Record<string, boolean> = {};
    suppliers.forEach((s) => {
      next[s.SupplierID] = expanded;
    });
    setExpandedSuppliers(next);
  };

  const handleExportCsv = () => {
    const usePieces = unitView === 'piece';
    const storeHeaders = activeStores.map((s) => `Store-${s.StoreNumber} Balance`);
    const headers = [
      'Medicine ID',
      'Trade Name',
      'Generic Name',
      'Supplier',
      'Group',
      'Unit Mode',
      'Stored Locations',
      'Pharmacy Balance',
      ...storeHeaders,
      'Total Balance',
      `MRP (${currencySymbol})`,
    ];

    const escapeCsv = (val: string | number) => {
      const str = String(val ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const lines = filteredRows.map((row) => {
      const pharmVal = usePieces ? row.pharmacyPieceBalance : row.pharmacyPackBalance;
      const storeVals = activeStores.map((s) => {
        const entry = row.storeBalancesByStoreId[s.StoreID];
        return usePieces ? entry?.pieceQty || 0 : entry?.packQty || 0;
      });
      const totVal = usePieces ? row.totalPieceBalance : row.totalPackBalance;
      const mrpVal = usePieces ? row.pieceMrp : row.packMrp;

      return [
        row.medicine.MedicineID,
        row.medicine.TradeName,
        row.medicine.GenericName,
        row.supplierName,
        row.groupName,
        usePieces ? 'Pieces' : row.medicine.Unit,
        row.storedLocationLabels.join(' | ') || 'None',
        pharmVal,
        ...storeVals,
        totVal,
        mrpVal.toFixed(2),
      ]
        .map(escapeCsv)
        .join(',');
    });

    const csvContent = [headers.map(escapeCsv).join(','), ...lines].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Live_Stock_Matrix_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    if (!isSalesman) {
      recordLogisticsSyncExport(
        'CSV',
        `Exported Live Stock Matrix (${filteredRows.length} medicines across Pharmacy & ${activeStores.length} active stores)`
      );
    }
    showToast(
      `Exported ${filteredRows.length} medicines to Live Stock CSV.`,
      'success',
      'CSV Export Ready'
    );
  };

  const selectedSupplierObj = suppliers.find((s) => s.SupplierID === selectedSupplierId);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-900 text-slate-100 select-none font-sans">
      {/* Top Workspace Header */}
      <div className="px-5 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-4 shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-emerald-400 shrink-0" />
            <h1 className="text-base font-bold text-white tracking-tight truncate">
              Live Stock · Pharmacy & Regional Stores
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-0.5 truncate">
            Real-time medicine balance across Pharmacy Counter and active child warehouses organized by Supplier Tree and Group
            {inactiveStoresCount > 0
              ? ` · ${inactiveStoresCount} offline store(s) hidden via Settings`
              : ''}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onBackToPos}
            className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Fast POS (F1)</span>
          </button>

          {(isAdmin || isModerator) && (
            <button
              type="button"
              onClick={onOpenStore}
              className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              title="Open Regional Store Dashboard to issue Store Out or Inter-Change transfers"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-sky-400" />
              <span>Store Transfer</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setIsPrintModalOpen(true)}
            className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <Printer className="w-3.5 h-3.5 text-slate-300" />
            <span>Print Sheet</span>
          </button>

          {(isAdmin || isModerator) && (
            <button
              type="button"
              onClick={onOpenStoreSettings}
              className="px-2.5 py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              title="Manage Regional Store ON/OFF Switches in Settings"
            >
              <Settings className="w-3.5 h-3.5 text-slate-400" />
              <span>Stores ({activeStores.length}/{stores.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Live Multi-Location Balance KPI Strip */}
      <div
        className="grid border-b border-slate-800 bg-slate-950/80 divide-x divide-slate-800 shrink-0"
        style={{
          gridTemplateColumns: `repeat(${3 + activeStores.length}, minmax(0, 1fr))`,
        }}
      >
        <div className="px-4 py-2.5">
          <span className="text-[11px] text-slate-400 block">Catalog Medicines</span>
          <div className="flex items-baseline justify-between gap-2 mt-0.5">
            <span className="text-lg font-bold font-mono tabular-nums text-white">
              {globalTotals.totalSkus}
            </span>
            <span className="text-[11px] text-slate-400 font-mono tabular-nums">
              {globalTotals.stockedSkus} stocked · {globalTotals.outOfStockSkus} zero
            </span>
          </div>
        </div>

        <div className="px-4 py-2.5">
          <span className="text-[11px] text-slate-400 block">Pharmacy Balance</span>
          <div className="flex items-baseline justify-between gap-2 mt-0.5">
            <span className="text-lg font-bold font-mono tabular-nums text-emerald-400">
              {globalTotals.pharmacy.toLocaleString()}
            </span>
            <span className="text-[11px] text-slate-500">
              Main POS Counter ({unitView === 'piece' ? 'pcs' : 'packs'})
            </span>
          </div>
        </div>

        {activeStores.map((st) => (
          <div key={st.StoreID} className="px-4 py-2.5">
            <span className="text-[11px] text-slate-400 block truncate">
              Store-{st.StoreNumber} Balance
            </span>
            <div className="flex items-baseline justify-between gap-2 mt-0.5">
              <span className="text-lg font-bold font-mono tabular-nums text-sky-400">
                {(globalTotals.perStore[st.StoreID] || 0).toLocaleString()}
              </span>
              <span className="text-[11px] text-slate-500 truncate">{st.Code}</span>
            </div>
          </div>
        ))}

        <div className="px-4 py-2.5">
          <span className="text-[11px] text-slate-400 block">Total Balance</span>
          <div className="flex items-baseline justify-between gap-2 mt-0.5">
            <span className="text-lg font-bold font-mono tabular-nums text-white">
              {globalTotals.total.toLocaleString()}
            </span>
            {!isSalesman ? (
              <span className="text-[11px] font-mono tabular-nums text-emerald-400">
                {formatCurrency(globalTotals.retailValuation)} MRP
              </span>
            ) : (
              <span className="text-[11px] text-slate-500">
                Pharmacy + {activeStores.length} Stores
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Split Workspace: Supplier Tree (Left) + Live Stock Matrix (Right) */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* LEFT PANE: Interactive Supplier Tree -> Group */}
        <div className="w-72 border-r border-slate-800 bg-slate-950 flex flex-col shrink-0 overflow-hidden">
          <div className="px-3.5 py-2.5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderTree className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-semibold text-slate-200">
                Supplier Tree · Group
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => setAllSuppliersExpanded(true)}
                className="text-slate-400 hover:text-white transition-colors whitespace-nowrap shrink-0"
              >
                Expand
              </button>
              <span className="text-slate-700">/</span>
              <button
                type="button"
                onClick={() => setAllSuppliersExpanded(false)}
                className="text-slate-400 hover:text-white transition-colors whitespace-nowrap shrink-0"
              >
                Collapse
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
            {/* Root All Medicines Node */}
            <button
              type="button"
              onClick={() => {
                setSelectedSupplierId(null);
                setSelectedGroup('All');
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition-colors text-left ${
                selectedSupplierId === null && selectedGroup === 'All'
                  ? 'bg-emerald-600 text-white font-semibold'
                  : 'bg-slate-900/80 text-slate-200 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <span className="truncate">All Suppliers (Every Medicine)</span>
              <span
                className={`text-[11px] font-mono tabular-nums ml-2 shrink-0 ${
                  selectedSupplierId === null && selectedGroup === 'All'
                    ? 'text-emerald-100'
                    : 'text-slate-400'
                }`}
              >
                {globalTotals.total.toLocaleString()}
              </span>
            </button>

            {/* Supplier Branches -> Group Child Nodes */}
            {supplierTree.map(({ supplier, totalSkus, totalPackUnits, totalPieceUnits, groups: supGroups }) => {
              const isExpanded = !!expandedSuppliers[supplier.SupplierID];
              const isSupSelected =
                selectedSupplierId === supplier.SupplierID && selectedGroup === 'All';
              const displaySupUnits = unitView === 'piece' ? totalPieceUnits : totalPackUnits;

              return (
                <div
                  key={supplier.SupplierID}
                  className="rounded border border-slate-800/90 bg-slate-900/40 overflow-hidden"
                >
                  <div
                    className={`flex items-center justify-between px-2.5 py-2 text-xs transition-colors ${
                      isSupSelected
                        ? 'bg-emerald-600 text-white font-semibold'
                        : 'text-slate-200 hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => toggleSupplierExpand(supplier.SupplierID)}
                        className={`p-0.5 rounded transition-colors shrink-0 ${
                          isSupSelected
                            ? 'text-white hover:bg-emerald-700'
                            : 'text-slate-400 hover:text-white hover:bg-slate-700'
                        }`}
                        title={isExpanded ? 'Collapse groups' : 'Expand groups'}
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSupplierId(supplier.SupplierID);
                          setSelectedGroup('All');
                        }}
                        className="flex-1 text-left truncate flex items-center gap-1.5"
                      >
                        <Building2
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isSupSelected ? 'text-white' : 'text-slate-400'
                          }`}
                        />
                        <span className="truncate">{supplier.Name}</span>
                      </button>
                    </div>

                    <div className="text-right shrink-0 ml-2 font-mono tabular-nums text-[10px]">
                      <span className={isSupSelected ? 'text-white font-semibold' : 'text-emerald-400'}>
                        {displaySupUnits.toLocaleString()}
                      </span>
                      <span className={isSupSelected ? 'text-emerald-100 ml-1' : 'text-slate-500 ml-1'}>
                        ({totalSkus})
                      </span>
                    </div>
                  </div>

                  {/* Child Group Nodes */}
                  {isExpanded && supGroups.length > 0 && (
                    <div className="border-t border-slate-800/70 bg-slate-950/70 py-1 px-2 space-y-0.5">
                      {supGroups.map((grp) => {
                        const isGrpSelected =
                          selectedSupplierId === supplier.SupplierID &&
                          selectedGroup === grp.groupName;
                        const grpUnits = unitView === 'piece' ? grp.pieceUnits : grp.packUnits;

                        return (
                          <button
                            key={grp.groupName}
                            type="button"
                            onClick={() => {
                              setSelectedSupplierId(supplier.SupplierID);
                              setSelectedGroup(grp.groupName);
                            }}
                            className={`w-full flex items-center justify-between pl-5 pr-2 py-1.5 rounded text-[11px] transition-colors text-left ${
                              isGrpSelected
                                ? 'bg-emerald-600/90 text-white font-semibold'
                                : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                            }`}
                          >
                            <span className="truncate">
                              {grp.groupName}{' '}
                              <span
                                className={
                                  isGrpSelected ? 'text-emerald-100' : 'text-slate-500'
                                }
                              >
                                · {grp.skuCount} med{grp.skuCount !== 1 ? 's' : ''}
                              </span>
                            </span>
                            <span
                              className={`font-mono tabular-nums ml-2 shrink-0 ${
                                isGrpSelected
                                  ? 'text-white'
                                  : grpUnits > 0
                                  ? 'text-slate-300'
                                  : 'text-rose-400'
                              }`}
                            >
                              {grpUnits.toLocaleString()}
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
        </div>

        {/* RIGHT PANE: Filter Bar & Multi-Location Live Stock Matrix */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-900">
          {/* Search, Location Filter & Unit Mode Toolbar */}
          <div className="p-3 bg-slate-950/70 border-b border-slate-800 space-y-2.5 shrink-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Search Box */}
              <div className="relative flex-1 min-w-[260px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search medicine trade name, generic molecule, barcode, rack, or store..."
                  className="w-full pl-9 pr-8 py-1.5 bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded text-xs text-white placeholder-slate-400 outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Group Dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 whitespace-nowrap">Group:</span>
                <select
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500"
                >
                  <option value="All">All Groups</option>
                  {groups.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              {/* Unit Mode Switch: Pack/Box vs Loose Pieces */}
              <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded border border-slate-800">
                <button
                  type="button"
                  onClick={() => setUnitView('pack')}
                  className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                    unitView === 'pack'
                      ? 'bg-emerald-600 text-white font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Boxes className="w-3.5 h-3.5" />
                  <span>Pack / Box</span>
                </button>
                <button
                  type="button"
                  onClick={() => setUnitView('piece')}
                  className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                    unitView === 'piece'
                      ? 'bg-emerald-600 text-white font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Pill className="w-3.5 h-3.5" />
                  <span>Loose Pieces</span>
                </button>
              </div>
            </div>

            {/* Interactive Location Presence Filter Bar */}
            <div className="flex items-center justify-between gap-2 overflow-x-auto pb-0.5">
              <div className="flex items-center gap-1 p-0.5 bg-slate-900 rounded border border-slate-800">
                <button
                  type="button"
                  onClick={() => setLocationFilter('ALL')}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                    locationFilter === 'ALL'
                      ? 'bg-slate-800 text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  All Medicines ({allLiveRows.length})
                </button>
                <button
                  type="button"
                  onClick={() => setLocationFilter('PHARMACY')}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                    locationFilter === 'PHARMACY'
                      ? 'bg-emerald-600 text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  In Pharmacy
                </button>
                {activeStores.map((st) => (
                  <button
                    key={st.StoreID}
                    type="button"
                    onClick={() => setLocationFilter(st.StoreID as LocationFilter)}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                      locationFilter === st.StoreID
                        ? 'bg-sky-600 text-white font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    In Store-{st.StoreNumber}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setLocationFilter('COUNTER_LOW_IN_STORES')}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                    locationFilter === 'COUNTER_LOW_IN_STORES'
                      ? 'bg-amber-600 text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Counter Low · In Stores ({globalTotals.counterLowWithBackup})
                </button>
                <button
                  type="button"
                  onClick={() => setLocationFilter('OUT_OF_STOCK')}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                    locationFilter === 'OUT_OF_STOCK'
                      ? 'bg-rose-600 text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Zero Stock ({globalTotals.outOfStockSkus})
                </button>
              </div>

              {/* Active Breadcrumb Reset */}
              {(selectedSupplierObj || selectedGroup !== 'All' || locationFilter !== 'ALL' || searchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSupplierId(null);
                    setSelectedGroup('All');
                    setLocationFilter('ALL');
                    setSearchQuery('');
                  }}
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-medium whitespace-nowrap shrink-0"
                >
                  Reset Filters
                </button>
              )}
            </div>
          </div>

          {/* Live Stock Data Table */}
          <div className="flex-1 overflow-auto min-h-0">
            {filteredRows.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 space-y-2">
                <Layers className="w-9 h-9 text-slate-700" />
                <p className="text-sm font-semibold text-slate-300">
                  No medicines match the current filter
                </p>
                <p className="text-xs text-slate-500 max-w-md">
                  Select "All Suppliers (Every Medicine)" on the left tree or reset the location filter to view the complete live inventory matrix.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSupplierId(null);
                    setSelectedGroup('All');
                    setLocationFilter('ALL');
                    setSearchQuery('');
                  }}
                  className="mt-1 px-3.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white transition-colors"
                >
                  Show All Medicines
                </button>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-950 text-slate-400 border-b border-slate-800 text-[11px] font-semibold">
                  <tr>
                    <th className="py-2.5 px-3 w-8 text-center"></th>
                    <th className="py-2.5 px-3">Medicine & Molecule</th>
                    <th className="py-2.5 px-3">Supplier · Group</th>
                    <th className="py-2.5 px-3">Stored In (Locations & Racks)</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">
                      Pharmacy Balance
                    </th>
                    {activeStores.map((st) => (
                      <th
                        key={st.StoreID}
                        className="py-2.5 px-3 text-right whitespace-nowrap"
                      >
                        Store-{st.StoreNumber} Balance
                      </th>
                    ))}
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">
                      Total Balance
                    </th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">
                      MRP ({unitView === 'piece' ? '/pc' : '/pack'})
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-800/70">
                  {filteredRows.map((row) => {
                    const isExpanded = expandedMedicineId === row.medicine.MedicineID;
                    const usePieces = unitView === 'piece';
                    const pharmQty = usePieces
                      ? row.pharmacyPieceBalance
                      : row.pharmacyPackBalance;
                    const totalQty = usePieces
                      ? row.totalPieceBalance
                      : row.totalPackBalance;
                    const displayMrp = usePieces ? row.pieceMrp : row.packMrp;
                    const unitLabel = usePieces ? 'pcs' : row.medicine.Unit;
                    const isPharmLow =
                      row.pharmacyPackBalance > 0 &&
                      row.pharmacyPackBalance <= row.medicine.ReorderLevel;
                    const isPharmZero = row.pharmacyPackBalance === 0;

                    return (
                      <React.Fragment key={row.medicine.MedicineID}>
                        <tr
                          onClick={() =>
                            setExpandedMedicineId(
                              isExpanded ? null : row.medicine.MedicineID
                            )
                          }
                          className={`cursor-pointer transition-colors ${
                            isExpanded
                              ? 'bg-slate-800/80'
                              : 'hover:bg-slate-800/40 bg-slate-900/40'
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center text-slate-400">
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 inline" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 inline" />
                            )}
                          </td>

                          {/* Medicine & Generic */}
                          <td className="py-2.5 px-3 min-w-[200px]">
                            <div className="font-semibold text-slate-100">
                              {row.medicine.TradeName}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              {row.medicine.GenericName} ·{' '}
                              <span className="font-mono text-slate-500">
                                {row.medicine.Unit} ({row.piecesPerPack} pcs)
                              </span>
                            </div>
                          </td>

                          {/* Supplier · Group (Unboxed metadata per Zero-Pill rule) */}
                          <td className="py-2.5 px-3 text-slate-300 min-w-[170px]">
                            <div className="truncate font-medium text-slate-200">
                              {row.supplierName}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              {row.groupName} · Barcode {row.medicine.Barcode}
                            </div>
                          </td>

                          {/* Stored In (Locations & Racks) */}
                          <td className="py-2.5 px-3 min-w-[220px]">
                            {row.storedLocationLabels.length > 0 ? (
                              <div className="text-[11px] text-slate-300 leading-relaxed">
                                {row.storedLocationLabels.join(' · ')}
                              </div>
                            ) : (
                              <span className="text-[11px] text-rose-400 font-medium">
                                Out of stock across all locations
                              </span>
                            )}
                            {row.isCounterLowWithStoreBackup && (
                              <div className="text-[10px] text-amber-400 mt-0.5 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                <span>
                                  Counter low ({row.pharmacyPackBalance} {row.medicine.Unit}) — stock ready in child store
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Pharmacy Balance */}
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                            <span
                              className={`font-semibold ${
                                isPharmZero
                                  ? 'text-rose-400'
                                  : isPharmLow
                                  ? 'text-amber-400'
                                  : 'text-emerald-400'
                              }`}
                            >
                              {pharmQty.toLocaleString()}
                            </span>
                            <span className="text-[10px] text-slate-500 ml-1">
                              {unitLabel}
                            </span>
                          </td>

                          {/* Store-1, Store-2, Store-3 Balances */}
                          {activeStores.map((st) => {
                            const stEntry = row.storeBalancesByStoreId[st.StoreID];
                            const stVal = usePieces
                              ? stEntry?.pieceQty || 0
                              : stEntry?.packQty || 0;

                            return (
                              <td
                                key={st.StoreID}
                                className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap"
                              >
                                {stVal > 0 ? (
                                  <>
                                    <span className="font-semibold text-sky-400">
                                      {stVal.toLocaleString()}
                                    </span>
                                    <span className="text-[10px] text-slate-500 ml-1">
                                      {unitLabel}
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-slate-600">0</span>
                                )}
                              </td>
                            );
                          })}

                          {/* Total Balance */}
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap bg-slate-950/30">
                            <span
                              className={`text-sm font-bold ${
                                totalQty === 0 ? 'text-rose-400' : 'text-white'
                              }`}
                            >
                              {totalQty.toLocaleString()}
                            </span>
                            <span className="text-[10px] text-slate-400 ml-1">
                              {unitLabel}
                            </span>
                          </td>

                          {/* MRP */}
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap text-slate-200">
                            {currencySymbol}
                            {displayMrp.toFixed(2)}
                          </td>
                        </tr>

                        {/* Expandable Multi-Location Batch Breakdown Drawer */}
                        {isExpanded && (
                          <tr className="bg-slate-950/90">
                            <td colSpan={6 + activeStores.length} className="p-4">
                              <div className="space-y-3">
                                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                                  <div className="text-xs text-slate-300">
                                    <strong className="text-white">
                                      {row.medicine.TradeName}
                                    </strong>{' '}
                                    · Batch & Rack Allocation Across Pharmacy and Child Stores
                                  </div>
                                  {(isAdmin || isModerator) && row.activeStoresPackTotal > 0 && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onOpenStore();
                                      }}
                                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 text-[11px] font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0"
                                    >
                                      <Warehouse className="w-3.5 h-3.5" />
                                      <span>Open Store Out (Replenish Counter)</span>
                                    </button>
                                  )}
                                </div>

                                <div
                                  className="grid gap-3"
                                  style={{
                                    gridTemplateColumns: `repeat(${1 + activeStores.length}, minmax(0, 1fr))`,
                                  }}
                                >
                                  {/* Pharmacy Counter Card */}
                                  <div className="p-3 rounded border border-slate-800 bg-slate-900/70 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-semibold text-slate-200">
                                        Pharmacy Counter
                                      </span>
                                      <span className="font-mono tabular-nums text-xs font-bold text-emerald-400">
                                        {row.pharmacyPackBalance} {row.medicine.Unit} ({row.pharmacyPieceBalance} pcs)
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-slate-400">
                                      Shelf Rack: <span className="font-mono text-slate-200">{row.medicine.RackNo}</span> · Reorder Level:{' '}
                                      <span className="font-mono text-slate-300">{row.medicine.ReorderLevel}</span>
                                    </div>
                                    {row.pharmacyBatches.length > 0 ? (
                                      <div className="divide-y divide-slate-800/80 border-t border-slate-800 pt-1.5 text-[11px]">
                                        {row.pharmacyBatches.map((b) => (
                                          <div
                                            key={b.BatchID}
                                            className="py-1 flex items-center justify-between font-mono tabular-nums"
                                          >
                                            <span className="text-slate-300">
                                              {b.BatchNumber} · Exp {b.ExpiryDate}
                                            </span>
                                            <span className="text-emerald-400 font-semibold">
                                              {b.CurrentStock} {row.medicine.Unit}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="text-[11px] text-rose-400 pt-1 border-t border-slate-800">
                                        0 stock on Pharmacy Counter
                                      </div>
                                    )}
                                  </div>

                                  {/* Active Child Stores Cards */}
                                  {activeStores.map((st) => {
                                    const stEntry = row.storeBalancesByStoreId[st.StoreID];
                                    const packQty = stEntry?.packQty || 0;
                                    const pieceQty = stEntry?.pieceQty || 0;

                                    return (
                                      <div
                                        key={st.StoreID}
                                        className="p-3 rounded border border-slate-800 bg-slate-900/70 space-y-2"
                                      >
                                        <div className="flex items-center justify-between">
                                          <span className="text-xs font-semibold text-slate-200">
                                            Store-{st.StoreNumber} ({st.Code})
                                          </span>
                                          <span
                                            className={`font-mono tabular-nums text-xs font-bold ${
                                              packQty > 0 ? 'text-sky-400' : 'text-slate-500'
                                            }`}
                                          >
                                            {packQty} {row.medicine.Unit} ({pieceQty} pcs)
                                          </span>
                                        </div>
                                        <div className="text-[11px] text-slate-400 truncate">
                                          Mgr: {st.BranchManager} · {st.ManagerPhone}
                                        </div>
                                        {stEntry && stEntry.batches.length > 0 ? (
                                          <div className="divide-y divide-slate-800/80 border-t border-slate-800 pt-1.5 text-[11px]">
                                            {stEntry.batches.map((sb) => (
                                              <div
                                                key={sb.StoreStockID}
                                                className="py-1 flex items-center justify-between font-mono tabular-nums"
                                              >
                                                <span className="text-slate-300 truncate pr-2">
                                                  {sb.BatchNumber} · {sb.RackLocation} · Exp {sb.ExpiryDate}
                                                </span>
                                                <span className="text-sky-400 font-semibold shrink-0">
                                                  {sb.Quantity} {row.medicine.Unit}
                                                </span>
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-800">
                                            Not stored in Store-{st.StoreNumber}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>

                {/* Sticky Grand Total Footer Row */}
                <tfoot className="sticky bottom-0 z-10 bg-slate-950 border-t-2 border-slate-700 text-xs font-semibold">
                  <tr>
                    <td colSpan={4} className="py-2.5 px-3 text-slate-300">
                      Filtered Selection Summary ({filteredRows.length} medicines ·{' '}
                      {unitView === 'piece' ? 'Loose Pieces' : 'Pack / Box Units'})
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-400">
                      {filteredColumnTotals.pharmacy.toLocaleString()}
                    </td>
                    {activeStores.map((st) => (
                      <td
                        key={st.StoreID}
                        className="py-2.5 px-3 text-right font-mono tabular-nums text-sky-400"
                      >
                        {(filteredColumnTotals.perStore[st.StoreID] || 0).toLocaleString()}
                      </td>
                    ))}
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-white text-sm font-bold">
                      {filteredColumnTotals.total.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3"></td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Printable Live Stock Sheet Modal */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 print-container-active">
          <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">
                  Printable Live Stock Balance Sheet
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Sheet</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-white text-slate-900">
              <div id="printable-receipt" className="max-w-4xl mx-auto space-y-4 text-slate-900">
                <div className="border-b border-slate-300 pb-3 flex justify-between items-start">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      {receiptSettings.pharmacyName} — Live Multi-Store Stock Balance
                    </h2>
                    <p className="text-xs text-slate-600">{receiptSettings.address}</p>
                  </div>
                  <div className="text-right text-xs font-mono text-slate-600">
                    <div>Generated: {new Date().toLocaleString()}</div>
                    <div>
                      Unit Basis: {unitView === 'piece' ? 'Loose Pieces' : 'Pack / Box Units'}
                    </div>
                  </div>
                </div>

                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-800 text-slate-800">
                      <th className="py-1.5 pr-2">Medicine</th>
                      <th className="py-1.5 px-2">Supplier · Group</th>
                      <th className="py-1.5 px-2">Stored Locations</th>
                      <th className="py-1.5 px-2 text-right">Pharmacy</th>
                      {activeStores.map((st) => (
                        <th key={st.StoreID} className="py-1.5 px-2 text-right">
                          Store-{st.StoreNumber}
                        </th>
                      ))}
                      <th className="py-1.5 pl-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredRows.map((row) => {
                      const usePieces = unitView === 'piece';
                      const pharmVal = usePieces
                        ? row.pharmacyPieceBalance
                        : row.pharmacyPackBalance;
                      const totVal = usePieces
                        ? row.totalPieceBalance
                        : row.totalPackBalance;

                      return (
                        <tr key={row.medicine.MedicineID}>
                          <td className="py-1.5 pr-2 font-semibold text-slate-900">
                            {row.medicine.TradeName}
                          </td>
                          <td className="py-1.5 px-2 text-slate-700">
                            {row.supplierName} · {row.groupName}
                          </td>
                          <td className="py-1.5 px-2 text-slate-600">
                            {row.storedLocationLabels.join(' · ') || 'None'}
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                            {pharmVal.toLocaleString()}
                          </td>
                          {activeStores.map((st) => {
                            const entry = row.storeBalancesByStoreId[st.StoreID];
                            const val = usePieces
                              ? entry?.pieceQty || 0
                              : entry?.packQty || 0;
                            return (
                              <td
                                key={st.StoreID}
                                className="py-1.5 px-2 text-right font-mono tabular-nums"
                              >
                                {val.toLocaleString()}
                              </td>
                            );
                          })}
                          <td className="py-1.5 pl-2 text-right font-mono tabular-nums font-bold text-slate-900">
                            {totVal.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
