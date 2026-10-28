/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Enterprise Left Navigation Panel with Role-Based Access Control (RBAC)
 * Organized by Pharmacy Operational Workflow:
 * 1) Catalog & Warehouse (Medicine Profile -> Batch & Inventory)
 * 2) POS & Receivables (Fast POS Terminal -> Sale Ledger & Receipts)
 * 3) Analytics & Live Stock (Executive Analytics -> Live Stock)
 * Pinned Footer: Settings (Regional Stores, POS, Printer, Llama 3 AI, SQL Server & Backup, RBAC)
 */

import React from 'react';
import { usePharmacy } from '../context/PharmacyContext';
import {
  ShoppingCart,
  Pill,
  Boxes,
  Truck,
  AlertTriangle,
  Users,
  Building2,
  Lock,
  LayoutDashboard,
  ReceiptText,
  MessageSquareWarning,
  TrendingUp,
  SlidersHorizontal,
  Warehouse,
  Settings,
  Layers,
  ClipboardList,
} from 'lucide-react';

export type NavTab =
  | 'medicines'
  | 'adjustments'
  | 'purchases'
  | 'reorder'
  | 'suppliers'
  | 'store'
  | 'storeReport'
  | 'expire'
  | 'batches'
  | 'pos'
  | 'customers'
  | 'salesLedger'
  | 'analytics'
  | 'profit'
  | 'complaints'
  | 'liveStock'
  | 'ai'
  | 'database'
  | 'settings';

interface NavigationSidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
}

interface NavItemConfig {
  id: NavTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeCount?: number | string;
  badgeTone?: 'alert' | 'neutral' | 'shortcut';
}

export const NavigationSidebar: React.FC<NavigationSidebarProps> = ({
  activeTab,
  onSelectTab,
}) => {
  const {
    currentUser,
    systemStats,
    complaints,
    stores,
    storeStocks,
    formatCurrency,
    isSidebarCollapsed,
    reorderLists,
  } = usePharmacy();

  const role = currentUser?.Role || 'Salesman';
  const isAdmin = role === 'Admin';
  const isModerator = role === 'Moderator';

  const pendingComplaintsCount = complaints.filter(
    (c) => c.Status === 'Pending / Under Review' || c.Status === 'Investigating'
  ).length;

  const activeStoresCount = stores.filter((s) => s.IsActive).length;
  const totalStoresCount = stores.length;
  const activeStoreIds = new Set(stores.filter((s) => s.IsActive).map((s) => s.StoreID));
  const activeStoreStockUnits = storeStocks.reduce(
    (sum, s) => (activeStoreIds.has(s.StoreID) && s.Quantity > 0 ? sum + s.Quantity : sum),
    0
  );
  const totalCombinedLiveUnits = systemStats.totalStockUnits + activeStoreStockUnits;

  // Role permissions check:
  // Admin: full access to all modules and Settings (Stores ON/OFF, Llama 3 AI, SQL Server & Backup)
  // Moderator (Branch Manager): POS, Live Stock, Purchase Dashboard, Reorder System, Store (incl. Supplier Tree Report), and Settings (read-only)
  // Salesman: Fast POS Terminal and Live Stock (read-only multi-store balances)
  const isTabAllowed = (tabId: NavTab): boolean => {
    if (isAdmin) return true;
    if (isModerator) {
      return (
        tabId === 'pos' ||
        tabId === 'liveStock' ||
        tabId === 'purchases' ||
        tabId === 'reorder' ||
        tabId === 'store' ||
        tabId === 'storeReport' ||
        tabId === 'settings'
      );
    }
    return tabId === 'pos' || tabId === 'liveStock';
  };

  // Exact professional sequence grouped into cohesive enterprise sections
  const navSections: {
    id: string;
    heading: string;
    dividerAbove?: boolean;
    items: NavItemConfig[];
  }[] = [
    {
      id: 'catalog-warehouse',
      heading: 'Catalog & Warehouse',
      items: [
        {
          id: 'medicines',
          label: 'Medicine Profile',
          icon: Pill,
          badgeCount: systemStats.totalActiveMedicines,
        },
        {
          id: 'adjustments',
          label: 'Medicine Adjustment',
          icon: SlidersHorizontal,
        },
        {
          id: 'purchases',
          label: 'Purchase Dashboard',
          icon: Truck,
        },
        {
          id: 'reorder',
          label: 'Reorder System',
          icon: ClipboardList,
          badgeCount: reorderLists.length > 0 ? reorderLists.length : undefined,
          badgeTone: 'neutral',
        },
        {
          id: 'suppliers',
          label: 'Supplier & Ledger',
          icon: Building2,
        },
        {
          id: 'store',
          label: 'Store',
          icon: Warehouse,
          badgeCount: `${activeStoresCount}/${totalStoresCount}`,
          badgeTone: activeStoresCount === 0 ? 'alert' : 'neutral',
        },
        {
          id: 'expire',
          label: 'Expire Vault & Return',
          icon: AlertTriangle,
          badgeCount:
            systemStats.expiringIn30DaysCount > 0
              ? systemStats.expiringIn30DaysCount
              : undefined,
          badgeTone: 'alert',
        },
        {
          id: 'batches',
          label: 'Batch & Inventory',
          icon: Boxes,
          badgeCount: systemStats.totalStockUnits,
        },
      ],
    },
    {
      id: 'pos-receivables',
      heading: 'POS & Receivables',
      items: [
        {
          id: 'pos',
          label: 'Fast POS Terminal',
          icon: ShoppingCart,
          badgeCount: 'F1',
          badgeTone: 'shortcut',
        },
        {
          id: 'customers',
          label: 'Customer & Due',
          icon: Users,
        },
        {
          id: 'salesLedger',
          label: 'Sale Ledger & Receipts',
          icon: ReceiptText,
        },
      ],
    },
    {
      id: 'executive-live',
      heading: 'Analytics & Live Stock',
      dividerAbove: true,
      items: [
        {
          id: 'analytics',
          label: 'Executive Analytics',
          icon: LayoutDashboard,
        },
        {
          id: 'profit',
          label: 'Profit & Margin',
          icon: TrendingUp,
        },
        {
          id: 'complaints',
          label: 'Complain Box & Coaching',
          icon: MessageSquareWarning,
          badgeCount: pendingComplaintsCount > 0 ? pendingComplaintsCount : undefined,
          badgeTone: 'alert',
        },
        {
          id: 'liveStock',
          label: 'Live Stock',
          icon: Layers,
          badgeCount: totalCombinedLiveUnits,
        },
      ],
    },
  ];

  const isSettingsAccessible = isTabAllowed('settings');
  const isSettingsCurrent = activeTab === 'settings';

  return (
    <aside
      className={`app-sidebar ${
        isSidebarCollapsed
          ? 'w-0 -mr-px overflow-hidden opacity-0 pointer-events-none border-none'
          : 'w-64 opacity-100'
      } bg-slate-950 border-r border-slate-800 flex flex-col justify-between shrink-0 select-none transition-opacity duration-150 ease-out z-20`}
    >
      {/* Scrollable Structured Navigation Sections */}
      <div className="flex-1 overflow-y-auto min-h-0 px-2.5 py-2.5 space-y-2.5">
        {navSections.map((section) => (
          <div
            key={section.id}
            className={
              section.dividerAbove ? 'pt-2.5 border-t border-slate-800/90' : undefined
            }
          >
            <div className="px-2.5 pb-1 text-[11px] font-semibold text-slate-500">
              {section.heading}
            </div>

            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isAccessible = isTabAllowed(item.id);
                const isCurrent =
                  activeTab === item.id ||
                  (item.id === 'store' && activeTab === 'storeReport');

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (isAccessible) {
                        onSelectTab(item.id);
                      }
                    }}
                    disabled={!isAccessible}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors text-left ${
                      !isAccessible
                        ? 'text-slate-600 opacity-50 cursor-not-allowed'
                        : isCurrent
                        ? 'bg-emerald-600 text-white font-semibold cursor-pointer'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          !isAccessible
                            ? 'text-slate-700'
                            : isCurrent
                            ? 'text-white'
                            : 'text-slate-400'
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {!isAccessible && (
                        <span
                          title={
                            isModerator
                              ? 'Moderator restricted (POS, Live Stock, Purchase, Store & Settings only)'
                              : 'Salesman restricted (Fast POS & Live Stock only)'
                          }
                          className="text-slate-600"
                        >
                          <Lock className="w-3 h-3" />
                        </span>
                      )}

                      {isAccessible && item.badgeCount !== undefined && (
                        <span
                          className={`text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded whitespace-nowrap ${
                            item.badgeTone === 'alert'
                              ? isCurrent
                                ? 'bg-rose-700 text-white'
                                : 'text-rose-400 font-semibold'
                              : item.badgeTone === 'shortcut'
                              ? isCurrent
                                ? 'text-emerald-100'
                                : 'text-slate-500'
                              : isCurrent
                              ? 'text-emerald-100'
                              : 'text-slate-400'
                          }`}
                        >
                          {item.badgeCount}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Pinned System Settings Entry (Stores, Printer, Llama 3 AI & SQL Server Backup) */}
      <div className="px-2.5 py-2.5 border-t border-slate-800/90 bg-slate-950 shrink-0">
        <div className="px-2.5 pb-1 flex items-center justify-between text-[11px] text-slate-500">
          <span className="font-semibold">System & Governance</span>
          <span className="font-mono tabular-nums">
            {activeStoresCount}/{totalStoresCount} Stores
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            if (isSettingsAccessible) {
              onSelectTab('settings');
            }
          }}
          disabled={!isSettingsAccessible}
          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition-colors text-left ${
            !isSettingsAccessible
              ? 'text-slate-600 opacity-50 cursor-not-allowed'
              : isSettingsCurrent
              ? 'bg-emerald-600 text-white font-semibold cursor-pointer'
              : 'text-slate-200 bg-slate-900 hover:bg-slate-800 hover:text-white border border-slate-800 cursor-pointer'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Settings
              className={`w-4 h-4 shrink-0 ${
                !isSettingsAccessible
                  ? 'text-slate-700'
                  : isSettingsCurrent
                  ? 'text-white'
                  : 'text-emerald-400'
              }`}
            />
            <span className="truncate">Settings</span>
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-2">
            {!isSettingsAccessible ? (
              <Lock className="w-3 h-3 text-slate-600" />
            ) : (
              <span
                className={`text-[10px] font-mono whitespace-nowrap ${
                  isSettingsCurrent
                    ? 'text-emerald-100'
                    : isAdmin
                    ? 'text-slate-400'
                    : 'text-slate-500'
                }`}
              >
                {isAdmin ? 'Themes · AI · SQL' : 'Themes · View'}
              </span>
            )}
          </div>
        </button>
      </div>

      {/* RBAC Notice / Valuation Footer */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-900/60 text-[11px] text-slate-400 shrink-0">
        {role === 'Salesman' ? (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-emerald-400">
              <Lock className="w-3.5 h-3.5" />
              <span>Salesman POS Mode</span>
            </div>
            <p className="app-sidebar-valuation-extra text-[10px] text-slate-400 leading-normal">
              Authorized for <strong>Fast POS</strong> and <strong>Live Stock</strong> balances. System configurations, margins, and purchase ledgers are protected.
            </p>
          </div>
        ) : role === 'Moderator' ? (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-sky-400">
              <Lock className="w-3.5 h-3.5" />
              <span>Branch Manager Mode</span>
            </div>
            <p className="app-sidebar-valuation-extra text-[10px] text-slate-400 leading-normal">
              Authorized for <strong>POS</strong>, <strong>Live Stock</strong>, <strong>Purchase</strong>, and <strong>Store</strong> operations. Store ON/OFF, AI, and SQL require Admin.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-[11px] font-semibold text-indigo-400">
                Admin Full Access
              </span>
              <span className="font-mono tabular-nums text-emerald-400 text-xs font-semibold">
                {formatCurrency(systemStats.inventoryValuationRetail)}
              </span>
            </div>
            <div className="app-sidebar-valuation-extra space-y-1">
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>Cost Basis:</span>
                <span className="font-mono tabular-nums text-slate-300">
                  {formatCurrency(systemStats.inventoryValuationCost)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                <span>Customer Dues:</span>
                <span className="font-mono tabular-nums text-amber-300">
                  {formatCurrency(systemStats.totalCustomerDues)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
