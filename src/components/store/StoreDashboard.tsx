/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Regional Store Dashboard ("Store")
 * - Contains 3 Regional Stores (Store 1, Store 2, Store 3)
 * - Hides & disables any store switched OFF in Settings until reactivated by Administrator
 * - 5 Pages per Store: Store In, Store Out, Store Inter-Change, Store-Medicine, Store Transaction
 */

import React, { useState, useMemo, useEffect } from 'react';
import { usePharmacy } from '../../context/PharmacyContext';
import { StoreOperationWorkspace } from './StoreOperationWorkspace';
import { StoreMedicinePage } from './StoreMedicinePage';
import { StoreTransactionPage } from './StoreTransactionPage';
import { StoreReportDashboard } from './StoreReportDashboard';
import {
  Warehouse,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  Boxes,
  ReceiptText,
  FolderTree,
  Settings,
  ShieldAlert,
  PanelLeft,
  ArrowLeft,
} from 'lucide-react';

export type StoreSubPage =
  | 'store-in'
  | 'store-out'
  | 'store-interchange'
  | 'store-medicine'
  | 'store-transaction';

interface StoreDashboardProps {
  onOpenStoreSettings: () => void;
  initialView?: 'operations' | 'report';
  viewTriggerNonce?: number;
}

export const StoreDashboard: React.FC<StoreDashboardProps> = ({
  onOpenStoreSettings,
  initialView = 'operations',
  viewTriggerNonce,
}) => {
  const {
    stores,
    storeStocks,
    storeTransactions,
    currentUser,
    isSidebarCollapsed,
    toggleSidebar,
  } = usePharmacy();

  // Only stores switched ON are visible in the operational Store interface
  const activeStores = useMemo(() => stores.filter((s) => s.IsActive), [stores]);
  const inactiveStoresCount = stores.length - activeStores.length;

  const [selectedStoreId, setSelectedStoreId] = useState<string>(
    activeStores[0]?.StoreID || ''
  );
  const [activeSubPage, setActiveSubPage] = useState<StoreSubPage>('store-in');
  const [viewMode, setViewMode] = useState<'operations' | 'report'>(initialView);

  useEffect(() => {
    setViewMode(initialView);
  }, [initialView, viewTriggerNonce]);

  // Ensure selectedStoreId always points to an active store if an Admin switches one OFF
  useEffect(() => {
    if (activeStores.length === 0) {
      setSelectedStoreId('');
      return;
    }
    const stillActive = activeStores.some((s) => s.StoreID === selectedStoreId);
    if (!stillActive) {
      setSelectedStoreId(activeStores[0].StoreID);
    }
  }, [activeStores, selectedStoreId]);

  const currentStore = useMemo(
    () => activeStores.find((s) => s.StoreID === selectedStoreId) || activeStores[0] || null,
    [activeStores, selectedStoreId]
  );

  // Per-store quick unit counts
  const storeUnitCounts = useMemo(() => {
    const map = new Map<string, number>();
    storeStocks.forEach((st) => {
      if (st.Quantity > 0) {
        map.set(st.StoreID, (map.get(st.StoreID) || 0) + st.Quantity);
      }
    });
    return map;
  }, [storeStocks]);

  const currentStoreTxCount = useMemo(() => {
    if (!currentStore) return 0;
    return storeTransactions.filter(
      (tx) => tx.StoreID === currentStore.StoreID || tx.TargetStoreID === currentStore.StoreID
    ).length;
  }, [storeTransactions, currentStore]);

  // Empty/Offline State when ALL 3 regional stores are switched OFF by Administrator (unless viewing Report)
  if ((activeStores.length === 0 || !currentStore) && viewMode !== 'report') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-900 p-8 text-center select-none">
        <div className="max-w-md w-full bg-slate-950 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="w-12 h-12 rounded-xl bg-amber-950/60 border border-amber-700/50 text-amber-400 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-base font-bold text-white">
              All Regional Warehouses Switched Off
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Store 1, Store 2, and Store 3 are currently deactivated in Settings. Deactivated stores are hidden from operational view and locked against transactions to preserve inventory consistency.
            </p>
          </div>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={() => setViewMode('report')}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FolderTree className="w-3.5 h-3.5 text-emerald-400" />
              <span>Supplier Tree Report</span>
            </button>
            <button
              type="button"
              onClick={onOpenStoreSettings}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>
                {currentUser?.Role === 'Admin'
                  ? 'Reactivate Stores in Settings'
                  : 'View Store Status in Settings'}
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const subPages: {
    id: StoreSubPage;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'store-in', label: 'Store In', icon: ArrowDownToLine },
    { id: 'store-out', label: 'Store Out', icon: ArrowUpFromLine },
    { id: 'store-interchange', label: 'Store Inter-Change', icon: ArrowLeftRight },
    { id: 'store-medicine', label: 'Store-Medicine', icon: Boxes },
    { id: 'store-transaction', label: `Store Transaction (${currentStoreTxCount})`, icon: ReceiptText },
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-900 select-none">
      {/* Top Bar: Active Store Selector (Store 1, Store 2, Store 3) + Report & Settings Actions */}
      <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          {isSidebarCollapsed &&
            (activeSubPage === 'store-medicine' || activeSubPage === 'store-transaction') && (
              <button
                type="button"
                onClick={toggleSidebar}
                className="px-2.5 py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1.5 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
              >
                <PanelLeft className="w-3.5 h-3.5 text-emerald-400" />
                <span>Menu</span>
              </button>
            )}

          <div className="flex items-center gap-2 mr-1">
            <Warehouse className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-bold text-white whitespace-nowrap">Store</span>
          </div>

          {/* Active Regional Store Selector Tabs */}
          {activeStores.length > 0 && currentStore && (
            <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-lg">
              {activeStores.map((st) => {
                const isSelected = viewMode === 'operations' && st.StoreID === currentStore.StoreID;
                const units = storeUnitCounts.get(st.StoreID) || 0;
                return (
                  <button
                    key={st.StoreID}
                    type="button"
                    onClick={() => {
                      setSelectedStoreId(st.StoreID);
                      setViewMode('operations');
                    }}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 text-white font-semibold'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <span>{st.ShortName}</span>
                    <span
                      className={`font-mono tabular-nums text-[11px] ${
                        isSelected ? 'text-emerald-100' : 'text-slate-400'
                      }`}
                    >
                      · {units}u
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {currentStore && viewMode === 'operations' && (
            <span className="hidden xl:inline text-xs text-slate-400">
              {currentStore.Region} · Manager: <strong className="text-slate-200">{currentStore.BranchManager}</strong>
              {inactiveStoresCount > 0 && (
                <span className="text-amber-400 ml-2">
                  · {inactiveStoresCount} store{inactiveStoresCount > 1 ? 's' : ''} hidden (OFF)
                </span>
              )}
            </span>
          )}
        </div>

        {/* Right Quick Navigation to Consolidated Supplier Tree Report & Store Governance Settings */}
        <div className="flex items-center gap-2 shrink-0">
          {viewMode === 'report' && activeStores.length > 0 && (
            <button
              type="button"
              onClick={() => setViewMode('operations')}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-slate-400" />
              <span>Store Operations</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setViewMode((prev) => (prev === 'report' ? 'operations' : 'report'))}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer border transition-colors ${
              viewMode === 'report'
                ? 'bg-emerald-600 text-white border-emerald-500 font-semibold'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700'
            }`}
          >
            <FolderTree
              className={`w-3.5 h-3.5 ${viewMode === 'report' ? 'text-white' : 'text-emerald-400'}`}
            />
            <span>Report · Supplier Tree</span>
          </button>

          <button
            type="button"
            onClick={onOpenStoreSettings}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5 text-sky-400" />
            <span>Store ON/OFF Settings</span>
          </button>
        </div>
      </div>

      {viewMode === 'report' ? (
        <div className="flex-1 flex overflow-hidden min-h-0">
          <StoreReportDashboard onOpenStoreSettings={onOpenStoreSettings} />
        </div>
      ) : (
        currentStore && (
          <>
            {/* Second Bar: The 5 Pages inside the Selected Store */}
            <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-3 overflow-x-auto shrink-0">
              <div className="flex items-center gap-1.5">
                {subPages.map((page) => {
                  const Icon = page.icon;
                  const isCurrent = activeSubPage === page.id;
                  return (
                    <button
                      key={page.id}
                      type="button"
                      onClick={() => setActiveSubPage(page.id)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer border ${
                        isCurrent
                          ? 'bg-slate-950 text-emerald-400 border-emerald-600/60 font-semibold'
                          : 'bg-transparent text-slate-400 border-transparent hover:bg-slate-800/70 hover:text-white'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{page.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="hidden md:flex items-center gap-2 text-xs text-slate-400 whitespace-nowrap shrink-0">
                <span>Active Facility:</span>
                <strong className="text-slate-200">{currentStore.Name}</strong>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-slate-400">{currentStore.Code}</span>
              </div>
            </div>

            {/* Active Store Sub-Page Viewport */}
            <div className="flex-1 flex overflow-hidden min-h-0">
              {activeSubPage === 'store-in' && (
                <StoreOperationWorkspace
                  store={currentStore}
                  mode="STORE_IN"
                  onOpenStoreSettings={onOpenStoreSettings}
                />
              )}
              {activeSubPage === 'store-out' && (
                <StoreOperationWorkspace
                  store={currentStore}
                  mode="STORE_OUT"
                  onOpenStoreSettings={onOpenStoreSettings}
                />
              )}
              {activeSubPage === 'store-interchange' && (
                <StoreOperationWorkspace
                  store={currentStore}
                  mode="STORE_INTERCHANGE"
                  onOpenStoreSettings={onOpenStoreSettings}
                />
              )}
              {activeSubPage === 'store-medicine' && (
                <StoreMedicinePage scope="single_store" store={currentStore} />
              )}
              {activeSubPage === 'store-transaction' && (
                <StoreTransactionPage store={currentStore} />
              )}
            </div>
          </>
        )
      )}
    </div>
  );
};
