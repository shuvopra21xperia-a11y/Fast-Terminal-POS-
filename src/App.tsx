/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PharmaCore Desktop Pharmacy Inventory, POS & AI Purchasing System
 * Microsoft SQL Server 2008 R2 & Llama 3 Offline Architecture
 *
 * RBAC Permissions:
 * - Admin: Full access to all modules & Settings (Regional Stores, POS, Printer, Llama 3 AI, SQL Server & Backup)
 * - Moderator: Fast POS, Live Stock, Purchase Dashboard, Store (incl. Supplier Tree Report), and Settings (read-only)
 * - Salesman: Fast POS Terminal and Live Stock (read-only multi-store balances)
 */

import React, { useState } from 'react';
import { PharmacyProvider, usePharmacy } from './context/PharmacyContext';
import { DesktopHeader } from './components/DesktopHeader';
import { NavigationSidebar, NavTab } from './components/NavigationSidebar';
import { PosTerminal } from './components/pos/PosTerminal';
import { MedicineManager } from './components/medicines/MedicineManager';
import { BatchInventoryViewer } from './components/inventory/BatchInventoryViewer';
import { MedicineAdjustmentPage } from './components/inventory/MedicineAdjustmentPage';
import { PurchaseDashboard } from './components/purchases/PurchaseDashboard';
import { ExpireVaultManager } from './components/expire/ExpireVaultManager';
import { CustomerLedger } from './components/customers/CustomerLedger';
import { SupplierLedger } from './components/suppliers/SupplierLedger';
import { ReceiptSettingsModal } from './components/system/ReceiptSettingsModal';
import { ShortcutsModal } from './components/system/ShortcutsModal';
import { LoginScreen } from './components/auth/LoginScreen';
import { AdminAnalyticsDashboard } from './components/analytics/AdminAnalyticsDashboard';
import { SaleLedger } from './components/sales/SaleLedger';
import { ComplaintDesk } from './components/complaints/ComplaintDesk';
import { ProfitAnalytics } from './components/profit/ProfitAnalytics';
import { StoreDashboard } from './components/store/StoreDashboard';
import { LiveStockDashboard } from './components/inventory/LiveStockDashboard';
import { ReorderDashboard } from './components/reorder/ReorderDashboard';
import { SettingsDashboard, SettingsSection } from './components/system/SettingsDashboard';
import { ToastContainer } from './components/system/ToastContainer';
import { ConfirmDialog } from './components/system/ConfirmDialog';

const MODERATOR_ALLOWED_TABS: NavTab[] = [
  'pos',
  'liveStock',
  'purchases',
  'reorder',
  'store',
  'storeReport',
  'settings',
];

const SALESMAN_ALLOWED_TABS: NavTab[] = ['pos', 'liveStock'];

const MainDesktopLayout: React.FC = () => {
  const { currentUser, isAuthenticated, showToast } = usePharmacy();
  const [activeTab, setActiveTab] = useState<NavTab>(() => {
    return currentUser?.Role === 'Admin' ? 'analytics' : 'pos';
  });
  const [settingsRequest, setSettingsRequest] = useState<{
    section: SettingsSection;
    nonce: number;
  }>({ section: 'stores', nonce: 0 });
  const [storeViewRequest, setStoreViewRequest] = useState<{
    view: 'operations' | 'report';
    nonce: number;
  }>({ view: 'operations', nonce: 0 });

  // Modals
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);

  // When user logs in or switches role, route Admin to Executive Analytics and others to POS
  React.useEffect(() => {
    if (!currentUser) return;
    if (currentUser.Role === 'Admin') {
      setActiveTab('analytics');
    } else if (currentUser.Role === 'Salesman') {
      setActiveTab((prev) => (SALESMAN_ALLOWED_TABS.includes(prev) ? prev : 'pos'));
    } else if (currentUser.Role === 'Moderator') {
      setActiveTab((prev) => (MODERATOR_ALLOWED_TABS.includes(prev) ? prev : 'pos'));
    }
  }, [currentUser?.UserID, currentUser?.Role]);

  // If not logged in, render the Desktop Login Screen
  if (!isAuthenticated || !currentUser) {
    return <LoginScreen />;
  }

  const role = currentUser.Role;
  const isAdmin = role === 'Admin';
  const isModerator = role === 'Moderator';
  const isSalesman = role === 'Salesman';

  // Safeguard: compute effective tab based on strict RBAC rule
  let effectiveTab = activeTab;
  if (effectiveTab === 'ai' || effectiveTab === 'database') {
    effectiveTab = isAdmin ? 'settings' : 'pos';
  } else if (effectiveTab === 'storeReport') {
    effectiveTab = isAdmin || isModerator ? 'store' : 'pos';
  } else if (isSalesman && !SALESMAN_ALLOWED_TABS.includes(effectiveTab)) {
    effectiveTab = 'pos';
  } else if (isModerator && !MODERATOR_ALLOWED_TABS.includes(effectiveTab)) {
    effectiveTab = 'pos';
  }

  const handleTabSelect = (tab: NavTab) => {
    // Route Llama 3 AI Purchasing & SQL Server Backup directly into Settings
    if (tab === 'ai') {
      if (!isAdmin) {
        showToast(
          'Llama 3 AI Purchasing inside Settings requires Administrator authority.',
          'warning',
          'Access Restricted'
        );
        return;
      }
      setSettingsRequest({ section: 'ai', nonce: Date.now() });
      setActiveTab('settings');
      return;
    }

    if (tab === 'database') {
      if (!isAdmin) {
        showToast(
          'SQL Server & Backup inside Settings requires Administrator authority.',
          'warning',
          'Access Restricted'
        );
        return;
      }
      setSettingsRequest({ section: 'database', nonce: Date.now() });
      setActiveTab('settings');
      return;
    }

    // Route Supplier Tree Report directly into Store Dashboard's embedded Report view
    if (tab === 'storeReport') {
      if (!isAdmin && !isModerator) {
        showToast(
          'Store Supplier Tree Reports require Branch Manager or Administrator authority.',
          'warning',
          'Access Restricted'
        );
        return;
      }
      setStoreViewRequest({ view: 'report', nonce: Date.now() });
      setActiveTab('store');
      return;
    }

    if (tab === 'store') {
      setStoreViewRequest({ view: 'operations', nonce: Date.now() });
    }

    if (isSalesman && !SALESMAN_ALLOWED_TABS.includes(tab)) {
      showToast(
        'Salesman accounts are authorized for Fast POS and Live Stock views only.',
        'warning',
        'Access Restricted'
      );
      return;
    }
    if (isModerator && !MODERATOR_ALLOWED_TABS.includes(tab)) {
      showToast(
        'Branch Manager (Moderator) accounts are authorized for POS, Live Stock, Purchase, Store, and Settings views only.',
        'warning',
        'Access Restricted'
      );
      return;
    }
    setActiveTab(tab);
  };

  const openStoreGovernanceSettings = () => {
    setSettingsRequest({ section: 'stores', nonce: Date.now() });
    handleTabSelect('settings');
  };

  const handleOpenPrinterSettings = () => {
    setIsReceiptModalOpen(true);
  };

  const handleOpenFullPrinterStudio = () => {
    setIsReceiptModalOpen(false);
    setSettingsRequest({ section: 'printer', nonce: Date.now() });
    handleTabSelect('settings');
  };

  const handleOpenThemeSettings = () => {
    if (isSalesman) {
      showToast(
        'Use the header dropdown next to the palette icon to switch any of the 10 themes directly from POS.',
        'info',
        'Quick Theme Switcher'
      );
      return;
    }
    setSettingsRequest({ section: 'appearance', nonce: Date.now() });
    handleTabSelect('settings');
  };

  return (
    <div className="app-shell h-screen w-screen flex flex-col bg-slate-950 font-sans text-slate-100 overflow-hidden select-none">
      {/* Windows Desktop Title Bar & Top Action Header */}
      <DesktopHeader
        activeTab={effectiveTab}
        onSelectTab={handleTabSelect}
        onOpenReceiptSettings={handleOpenPrinterSettings}
        onOpenThemeSettings={handleOpenThemeSettings}
        onOpenShortcutsHelp={() => setIsShortcutsModalOpen(true)}
      />

      {/* Main Workspace Frame */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Navigation Panel (collapsible via header toggle for all roles) */}
        <NavigationSidebar
          activeTab={effectiveTab}
          onSelectTab={handleTabSelect}
        />

        {/* Viewport for Active Module */}
        <main className="flex-1 flex overflow-hidden bg-slate-900">
          {isAdmin && effectiveTab === 'analytics' && (
            <AdminAnalyticsDashboard onNavigate={handleTabSelect} />
          )}
          {isAdmin && effectiveTab === 'salesLedger' && (
            <SaleLedger onOpenComplaintDesk={() => handleTabSelect('complaints')} />
          )}
          {isAdmin && effectiveTab === 'profit' && <ProfitAnalytics />}
          {isAdmin && effectiveTab === 'complaints' && <ComplaintDesk />}
          {effectiveTab === 'pos' && (
            <PosTerminal onOpenLiveStock={() => handleTabSelect('liveStock')} />
          )}
          {effectiveTab === 'liveStock' && (
            <LiveStockDashboard
              onBackToPos={() => handleTabSelect('pos')}
              onOpenStore={() => handleTabSelect('store')}
              onOpenStoreSettings={openStoreGovernanceSettings}
            />
          )}
          {effectiveTab === 'purchases' && <PurchaseDashboard />}
          {(isAdmin || isModerator) && effectiveTab === 'reorder' && (
            <ReorderDashboard
              onOpenSettings={() => {
                setSettingsRequest({ section: 'printer', nonce: Date.now() });
                handleTabSelect('settings');
              }}
            />
          )}
          {(isAdmin || isModerator) && effectiveTab === 'store' && (
            <StoreDashboard
              onOpenStoreSettings={openStoreGovernanceSettings}
              initialView={storeViewRequest.view}
              viewTriggerNonce={storeViewRequest.nonce}
            />
          )}
          {(isAdmin || isModerator) && effectiveTab === 'settings' && (
            <SettingsDashboard
              initialSection={settingsRequest.section}
              sectionTriggerNonce={settingsRequest.nonce}
              onNavigateToReport={() => handleTabSelect('storeReport')}
            />
          )}
          {isAdmin && effectiveTab === 'medicines' && <MedicineManager />}
          {isAdmin && effectiveTab === 'batches' && <BatchInventoryViewer />}
          {isAdmin && effectiveTab === 'adjustments' && <MedicineAdjustmentPage />}
          {isAdmin && effectiveTab === 'expire' && <ExpireVaultManager />}
          {isAdmin && effectiveTab === 'customers' && <CustomerLedger />}
          {isAdmin && effectiveTab === 'suppliers' && <SupplierLedger />}
        </main>
      </div>

      {/* Modals & Dialogs */}
      <ReceiptSettingsModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        onOpenFullSettings={!isSalesman ? handleOpenFullPrinterStudio : undefined}
      />
      <ShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />
      <ConfirmDialog />
      <ToastContainer />
    </div>
  );
};

export default function App() {
  return (
    <PharmacyProvider>
      <MainDesktopLayout />
    </PharmacyProvider>
  );
}
