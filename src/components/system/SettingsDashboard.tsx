/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Enterprise System & Regional Warehouse Settings Dashboard
 * Accessible directly from the Left Navigation Panel ("Settings")
 *
 * Sections:
 * 1) Regional Stores (ON/OFF Governance, Branch Manager RBAC & Toggle Audit Trail)
 * 2) POS, Currency & Pharmacy Profile
 * 3) Thermal Printer & ESC/POS Hardware (with Live Receipt Paper Preview)
 * 4) Llama 3 AI Purchasing (Offline Neural Reorder, Margin & Expiry Intelligence)
 * 5) SQL Server & Backup (.env Credentials, Daily .bak Engine, T-SQL & System Audit)
 * 6) Access Roles & Logistics Compliance
 */

import React, { useState, useEffect, useMemo } from 'react';
import { usePharmacy } from '../../context/PharmacyContext';
import { ReceiptSettings, WarehouseStore, PrinterTransportMode, ReorderPaperSize } from '../../types/pharmacy';
import { printTestReceipt } from '../../utils/thermalPrinter';
import {
  getHardwarePrinterStatus,
  subscribeHardwarePrinterStatus,
  fetchAvailableSystemPrinters,
  fetchNativeSerialPorts,
  testNativeSerialPort,
  testNetworkPrinterConnection,
  SystemPrinterInfo,
  NativeSerialPortInfo,
} from '../../utils/hardwarePrinterManager';
import { AiPurchasingAgent } from '../ai/AiPurchasingAgent';
import { DatabaseBackupConsole } from './DatabaseBackupConsole';
import {
  Settings,
  Warehouse,
  Sliders,
  Printer,
  ShieldCheck,
  Lock,
  CheckCircle2,
  Coins,
  Usb,
  Cpu,
  Globe,
  Scissors,
  Wallet,
  Zap,
  HelpCircle,
  Save,
  UserCheck,
  Download,
  PanelLeft,
  Sparkles,
  Database,
  Palette,
  Layout,
  Monitor,
  Grid3X3,
} from 'lucide-react';
import {
  LAYOUT_STYLE_CATALOG,
  THEME_CATALOG,
  ThemeDefinition,
  getThemeDefinition,
} from '../../utils/themeCatalog';

export type SettingsSection =
  | 'stores'
  | 'appearance'
  | 'general'
  | 'printer'
  | 'ai'
  | 'database'
  | 'rbac';

interface SettingsDashboardProps {
  initialSection?: SettingsSection;
  sectionTriggerNonce?: number;
  onNavigateToReport?: () => void;
}

const COMMON_PRINTERS = [
  'RONGTA 80mm Series Printer',
  'Rongta RP80 / RP326 / RP332 Thermal',
  'Default POS Thermal Printer (80mm)',
  'EPSON TM-T88 / TM-T20 Series',
  'Xprinter XP-N160M / XP-80C',
  'POS-80 / POS-58 USB Thermal',
  'Star Micronics TSP100 / TSP650',
  'Network ESC/POS Printer (TCP/IP)',
  'Generic / Text-Only POS Driver',
];

export const SettingsDashboard: React.FC<SettingsDashboardProps> = ({
  initialSection = 'stores',
  sectionTriggerNonce,
  onNavigateToReport,
}) => {
  const {
    currentUser,
    users,
    stores,
    storeStocks,
    storeTransactions,
    storeToggleLogs,
    toggleStoreActive,
    updateStoreDetails,
    receiptSettings,
    updateReceiptSettings,
    isAuditModeActive,
    setAuditModeActive,
    theme,
    setTheme,
    layoutStyle,
    setLayoutStyle,
    formatCurrency,
    showToast,
    recordLogisticsSyncExport,
    isSidebarCollapsed,
    toggleSidebar,
    reorderSettings,
    updateReorderSettings,
  } = usePharmacy();

  const isAdmin = currentUser?.Role === 'Admin';
  const [themeCategoryFilter, setThemeCategoryFilter] = useState<
    'ALL' | ThemeDefinition['category']
  >('ALL');

  const [activeSection, setActiveSection] = useState<SettingsSection>(() => {
    if (!isAdmin && (initialSection === 'ai' || initialSection === 'database')) {
      return 'stores';
    }
    return initialSection;
  });

  useEffect(() => {
    if (!isAdmin && (initialSection === 'ai' || initialSection === 'database')) {
      setActiveSection('stores');
      return;
    }
    setActiveSection(initialSection);
  }, [initialSection, sectionTriggerNonce, isAdmin]);

  // =========================================================================
  // REGIONAL STORES STATE (REASON INPUTS & BRANCH MANAGER EDITS)
  // =========================================================================
  const [toggleReasons, setToggleReasons] = useState<Record<string, string>>({});
  const [branchDrafts, setBranchDrafts] = useState<
    Record<string, { BranchManager: string; ManagerPhone: string; Region: string }>
  >(() => {
    const map: Record<string, { BranchManager: string; ManagerPhone: string; Region: string }> = {};
    stores.forEach((s) => {
      map[s.StoreID] = {
        BranchManager: s.BranchManager,
        ManagerPhone: s.ManagerPhone,
        Region: s.Region,
      };
    });
    return map;
  });

  useEffect(() => {
    const map: Record<string, { BranchManager: string; ManagerPhone: string; Region: string }> = {};
    stores.forEach((s) => {
      map[s.StoreID] = {
        BranchManager: s.BranchManager,
        ManagerPhone: s.ManagerPhone,
        Region: s.Region,
      };
    });
    setBranchDrafts(map);
  }, [stores]);

  // Per-store live inventory metrics
  const storeMetricsMap = useMemo(() => {
    const map = new Map<
      string,
      { batchCount: number; units: number; costVal: number; txCount: number }
    >();
    stores.forEach((s) => {
      const stocks = storeStocks.filter((st) => st.StoreID === s.StoreID && st.Quantity > 0);
      const units = stocks.reduce((sum, i) => sum + i.Quantity, 0);
      const costVal = stocks.reduce((sum, i) => sum + i.Quantity * i.CostPrice, 0);
      const txCount = storeTransactions.filter(
        (tx) => tx.StoreID === s.StoreID || tx.TargetStoreID === s.StoreID
      ).length;
      map.set(s.StoreID, {
        batchCount: stocks.length,
        units,
        costVal: Math.round(costVal * 100) / 100,
        txCount,
      });
    });
    return map;
  }, [stores, storeStocks, storeTransactions]);

  const handleToggleStore = (store: WarehouseStore) => {
    if (!isAdmin) {
      showToast(
        'Only Administrators are authorized to switch regional stores ON or OFF.',
        'warning',
        'Administrator Authority Required'
      );
      return;
    }

    const nextState = !store.IsActive;
    const reasonText = toggleReasons[store.StoreID]?.trim();

    const res = toggleStoreActive(store.StoreID, nextState, reasonText);
    if (res.success) {
      setToggleReasons((prev) => ({ ...prev, [store.StoreID]: '' }));
      showToast(
        nextState
          ? `${store.ShortName} reactivated and restored to the Store operational interface.`
          : `${store.ShortName} switched OFF — hidden from Store interface and locked against transactions.`,
        nextState ? 'success' : 'info',
        nextState ? 'Store Activated' : 'Store Deactivated'
      );
    } else {
      showToast(res.error || 'Could not update store state.', 'error', 'Action Blocked');
    }
  };

  const handleSaveBranchDetails = (storeId: string) => {
    if (!isAdmin) {
      showToast('Only Administrators can update branch manager assignments.', 'warning', 'Restricted');
      return;
    }
    const draft = branchDrafts[storeId];
    if (!draft || !draft.BranchManager.trim()) {
      showToast('Branch Manager name cannot be empty.', 'warning', 'Validation');
      return;
    }
    const res = updateStoreDetails(storeId, {
      BranchManager: draft.BranchManager.trim(),
      ManagerPhone: draft.ManagerPhone.trim(),
      Region: draft.Region.trim(),
    });
    if (res.success) {
      showToast('Regional branch governance details saved.', 'success', 'Branch Updated');
    } else {
      showToast(res.error || 'Failed to update branch details.', 'error', 'Error');
    }
  };

  // =========================================================================
  // POS, CURRENCY & NATIVE RONGTA THERMAL PRINTER SETTINGS STATE
  // =========================================================================
  const [formData, setFormData] = useState<ReceiptSettings>({ ...receiptSettings });
  const [isTestPrinting, setIsTestPrinting] = useState(false);
  const [isTestingNetwork, setIsTestingNetwork] = useState(false);
  const [isTestingSerial, setIsTestingSerial] = useState(false);
  const [isRefreshingHardware, setIsRefreshingHardware] = useState(false);
  const [hardwareStatus, setHardwareStatus] = useState(getHardwarePrinterStatus());
  const [systemPrinters, setSystemPrinters] = useState<SystemPrinterInfo[]>([]);
  const [serialPorts, setSerialPorts] = useState<NativeSerialPortInfo[]>([]);

  const refreshNativeHardware = async () => {
    setIsRefreshingHardware(true);
    try {
      const [printers, ports] = await Promise.all([
        fetchAvailableSystemPrinters(),
        fetchNativeSerialPorts(),
      ]);
      setSystemPrinters(printers);
      setSerialPorts(ports);
    } finally {
      setIsRefreshingHardware(false);
    }
  };

  useEffect(() => {
    const unsub = subscribeHardwarePrinterStatus((st) => setHardwareStatus(st));
    refreshNativeHardware();
    return unsub;
  }, []);

  useEffect(() => {
    setFormData({ ...receiptSettings });
    setHardwareStatus(getHardwarePrinterStatus());
  }, [receiptSettings]);

  const handleSaveSystemSettings = (e?: React.FormEvent, allowPrinterSaveForManager = false) => {
    if (e) e.preventDefault();
    if (!isAdmin && !allowPrinterSaveForManager) {
      showToast('Only Administrators can modify global POS and organization settings.', 'warning', 'Admin Required');
      return;
    }
    updateReceiptSettings(formData);
    if (isAdmin && Boolean(formData.auditModeEnabled) !== isAuditModeActive) {
      setAuditModeActive(Boolean(formData.auditModeEnabled));
    }
    showToast('Rongta printer & POS receipt configuration saved.', 'success', 'Settings Saved');
  };

  const handleTestSerialPort = async () => {
    setIsTestingSerial(true);
    const res = await testNativeSerialPort(
      formData.serialPortPath || '',
      formData.serialBaudRate || 9600
    );
    setIsTestingSerial(false);
    if (res.success) {
      const next = { ...formData, printerTransport: 'serial' as PrinterTransportMode };
      setFormData(next);
      updateReceiptSettings(next);
      showToast(res.message || 'Native COM/Serial port ready!', 'success', 'SerialPort Ready');
    } else {
      showToast(res.error || 'Could not open COM/Serial port.', 'error', 'Serial Error');
    }
  };

  const handleTestNetworkIp = async () => {
    setIsTestingNetwork(true);
    const res = await testNetworkPrinterConnection(formData.networkPrinterIp || '');
    setIsTestingNetwork(false);
    if (res.success) {
      const next = { ...formData, printerTransport: 'network' as PrinterTransportMode };
      setFormData(next);
      updateReceiptSettings(next);
      showToast(res.message || 'Network ESC/POS printer reachable!', 'success', 'TCP 9100 Ready');
    } else {
      showToast(res.error || 'Could not reach printer on Port 9100.', 'error', 'Network Unreachable');
    }
  };

  const handleTestPrint = async () => {
    setIsTestPrinting(true);
    showToast(
      `Dispatching diagnostic receipt to ${formData.printerDevice || 'Rongta Thermal Printer'}...`,
      'info',
      'Native Test Print'
    );
    const ok = await printTestReceipt(formData, () => {
      setIsTestPrinting(false);
      showToast('Diagnostic thermal test receipt completed.', 'success', 'Printer Ready');
    });
    if (!ok) {
      setIsTestPrinting(false);
    }
  };

  const handleQuickExportComplianceJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      stores,
      storeToggleLogs,
      activeStoreCount: stores.filter((s) => s.IsActive).length,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pharmacore_governance_config_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    recordLogisticsSyncExport('JSON', 'Exported Regional Governance & RBAC Configuration Snapshot');
    showToast('Downloaded Governance & RBAC Configuration JSON.', 'success', 'Export Complete');
  };

  const activeStoreCount = stores.filter((s) => s.IsActive).length;

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-900 overflow-hidden select-none">
      {/* Top Workspace Header */}
      <div className="bg-slate-950 border-b border-slate-800 shrink-0">
        <div className="px-5 py-3 flex items-center justify-between gap-4 border-b border-slate-800/80">
          <div className="flex items-center gap-3 min-w-0">
            {isSidebarCollapsed && (
              <button
                type="button"
                onClick={toggleSidebar}
                className="px-2.5 py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1.5 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
              >
                <PanelLeft className="w-3.5 h-3.5 text-emerald-400" />
                <span>Menu</span>
              </button>
            )}
            <Settings className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-white tracking-tight truncate">
                Settings & Enterprise Governance
              </h2>
              <p className="text-[11px] text-slate-400 truncate">
                Regional warehouse controls, POS & currency, ESC/POS hardware, Llama 3 AI purchasing, SQL Server backup, and RBAC
              </p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-slate-400 font-mono tabular-nums whitespace-nowrap shrink-0">
            <span>Active Warehouses:</span>
            <strong className="text-emerald-400">{activeStoreCount}/3</strong>
            <span aria-hidden="true">·</span>
            <span className="font-sans text-slate-300">{currentUser?.Role}</span>
          </div>
        </div>

        {/* Dedicated Single-Line Settings Sub-Navigation Strip */}
        <div className="px-5 py-2 bg-slate-900/90 flex items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveSection('stores')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer border ${
              activeSection === 'stores'
                ? 'bg-emerald-600 text-white border-emerald-500 font-semibold'
                : 'bg-transparent text-slate-300 border-transparent hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Warehouse className="w-3.5 h-3.5" />
            <span>Regional Stores ({activeStoreCount}/3 ON)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('appearance')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer border ${
              activeSection === 'appearance'
                ? 'bg-emerald-600 text-white border-emerald-500 font-semibold'
                : 'bg-transparent text-slate-300 border-transparent hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Themes & Layout</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('general')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer border ${
              activeSection === 'general'
                ? 'bg-emerald-600 text-white border-emerald-500 font-semibold'
                : 'bg-transparent text-slate-300 border-transparent hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>POS, Currency & Profile</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('printer')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer border ${
              activeSection === 'printer'
                ? 'bg-emerald-600 text-white border-emerald-500 font-semibold'
                : 'bg-transparent text-slate-300 border-transparent hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Thermal Printer</span>
          </button>

          <button
            type="button"
            disabled={!isAdmin}
            onClick={() => {
              if (!isAdmin) return;
              setActiveSection('ai');
            }}
            title={
              isAdmin
                ? 'Open Llama 3 AI Purchasing & Reorder Intelligence'
                : 'Administrator authority required'
            }
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 border ${
              !isAdmin
                ? 'text-slate-600 border-transparent opacity-50 cursor-not-allowed'
                : activeSection === 'ai'
                ? 'bg-emerald-600 text-white border-emerald-500 font-semibold cursor-pointer'
                : 'bg-transparent text-slate-300 border-transparent hover:bg-slate-800 hover:text-white cursor-pointer'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Llama 3 AI Purchasing</span>
            {!isAdmin && <Lock className="w-3 h-3 ml-0.5" />}
          </button>

          <button
            type="button"
            disabled={!isAdmin}
            onClick={() => {
              if (!isAdmin) return;
              setActiveSection('database');
            }}
            title={
              isAdmin
                ? 'Open SQL Server 2008 R2 & Automated Backup Console'
                : 'Administrator authority required'
            }
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 border ${
              !isAdmin
                ? 'text-slate-600 border-transparent opacity-50 cursor-not-allowed'
                : activeSection === 'database'
                ? 'bg-emerald-600 text-white border-emerald-500 font-semibold cursor-pointer'
                : 'bg-transparent text-slate-300 border-transparent hover:bg-slate-800 hover:text-white cursor-pointer'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>SQL Server & Backup</span>
            {!isAdmin && <Lock className="w-3 h-3 ml-0.5" />}
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('rbac')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer border ${
              activeSection === 'rbac'
                ? 'bg-emerald-600 text-white border-emerald-500 font-semibold'
                : 'bg-transparent text-slate-300 border-transparent hover:bg-slate-800 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Roles & Compliance</span>
          </button>
        </div>
      </div>

      {/* RBAC Read-Only Banner for Non-Administrators */}
      {!isAdmin && (
        <div className="px-5 py-2 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs text-slate-300 shrink-0">
          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>
              Viewing in <strong>{currentUser?.Role}</strong> read-only governance mode. Switching regional stores ON/OFF, AI Purchasing, and SQL Server Backup require <strong>Administrator</strong> credentials.
            </span>
          </div>
          <span className="font-mono text-[11px] text-slate-500">RBAC Protected</span>
        </div>
      )}

      {/* Full-Height Embedded Consoles for Llama 3 AI Purchasing & SQL Server Backup */}
      {isAdmin && activeSection === 'ai' ? (
        <div className="flex-1 flex overflow-hidden min-h-0">
          <AiPurchasingAgent />
        </div>
      ) : isAdmin && activeSection === 'database' ? (
        <div className="flex-1 flex overflow-hidden min-h-0">
          <DatabaseBackupConsole />
        </div>
      ) : (
        /* Main Scrollable Settings Content */
        <div className="flex-1 overflow-y-auto p-5">
          <div className="max-w-7xl mx-auto space-y-6">
          {/* ========================================================================= */}
          {/* SECTION 1: REGIONAL STORES ON/OFF GOVERNANCE & AUDIT LOG                  */}
          {/* ========================================================================= */}
          {activeSection === 'stores' && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-white">
                    Regional Warehouse Activity Control (Store 1, Store 2, Store 3)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Individually switch regional stores ON or OFF. Switched-off stores immediately hide from the Store interface and reject transactions while preserving batch inventory consistency.
                  </p>
                </div>

                {onNavigateToReport && (
                  <button
                    type="button"
                    onClick={onNavigateToReport}
                    className="px-3.5 py-2 bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Open Full Compliance & Logistics Sync Report →
                  </button>
                )}
              </div>

              {/* 3 Regional Warehouse Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {stores.map((st) => {
                  const metrics = storeMetricsMap.get(st.StoreID) || {
                    batchCount: 0,
                    units: 0,
                    costVal: 0,
                    txCount: 0,
                  };
                  const draft = branchDrafts[st.StoreID] || {
                    BranchManager: st.BranchManager,
                    ManagerPhone: st.ManagerPhone,
                    Region: st.Region,
                  };

                  return (
                    <div
                      key={st.StoreID}
                      className={`rounded-xl border p-4 flex flex-col justify-between space-y-4 transition-colors ${
                        st.IsActive
                          ? 'bg-slate-950 border-slate-800'
                          : 'bg-slate-950/60 border-rose-900/50'
                      }`}
                    >
                      <div className="space-y-3">
                        {/* Header + Master ON/OFF Switch */}
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                              <span>{st.Code}</span>
                              <span aria-hidden="true">·</span>
                              <span className={st.IsActive ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                                {st.IsActive ? 'ONLINE · VISIBLE' : 'OFFLINE · HIDDEN'}
                              </span>
                            </div>
                            <h4 className="text-sm font-bold text-white mt-0.5">{st.Name}</h4>
                          </div>

                          {/* Individual Store ON/OFF Toggle */}
                          <button
                            type="button"
                            role="switch"
                            aria-checked={st.IsActive}
                            disabled={!isAdmin}
                            onClick={() => handleToggleStore(st)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 border ${
                              !isAdmin
                                ? 'bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed'
                                : st.IsActive
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 cursor-pointer'
                                : 'bg-slate-800 hover:bg-slate-700 text-rose-300 border-rose-800/70 cursor-pointer'
                            }`}
                            title={
                              isAdmin
                                ? `Switch ${st.ShortName} ${st.IsActive ? 'OFF' : 'ON'}`
                                : 'Administrator role required to toggle store state'
                            }
                          >
                            {!isAdmin && <Lock className="w-3 h-3" />}
                            <span>{st.IsActive ? 'Switched ON' : 'Switched OFF'}</span>
                          </button>
                        </div>

                        {/* Inventory Consistency Metrics */}
                        <div className="grid grid-cols-3 gap-2 py-2.5 border-y border-slate-800/80 font-mono tabular-nums text-xs">
                          <div>
                            <span className="text-[10px] font-sans text-slate-500 block">
                              Stored Units
                            </span>
                            <span className="font-bold text-white">{metrics.units}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-sans text-slate-500 block">
                              Cost Basis
                            </span>
                            <span className="font-bold text-emerald-400">
                              {formatCurrency(metrics.costVal)}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] font-sans text-slate-500 block">
                              Transactions
                            </span>
                            <span className="font-bold text-slate-200">{metrics.txCount}</span>
                          </div>
                        </div>

                        {/* Toggle Compliance Reason Input */}
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">
                            Compliance Audit Note (logged on next ON/OFF toggle)
                          </label>
                          <input
                            type="text"
                            disabled={!isAdmin}
                            value={toggleReasons[st.StoreID] || ''}
                            onChange={(e) =>
                              setToggleReasons((prev) => ({
                                ...prev,
                                [st.StoreID]: e.target.value,
                              }))
                            }
                            placeholder={
                              st.IsActive
                                ? 'e.g. Scheduled regional stock recount...'
                                : 'e.g. Audit verified — reactivating store...'
                            }
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                          />
                        </div>

                        {/* Branch Manager & Region Role-Based Assignment */}
                        <div className="pt-2 border-t border-slate-800/80 space-y-2 text-xs">
                          <div className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                            <UserCheck className="w-3.5 h-3.5 text-sky-400" />
                            <span>Branch Manager & Regional Assignment</span>
                          </div>

                          <div className="grid grid-cols-1 gap-2">
                            <input
                              type="text"
                              disabled={!isAdmin}
                              value={draft.BranchManager}
                              onChange={(e) =>
                                setBranchDrafts((prev) => ({
                                  ...prev,
                                  [st.StoreID]: { ...draft, BranchManager: e.target.value },
                                }))
                              }
                              placeholder="Branch Manager Full Name"
                              className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 disabled:opacity-60"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="text"
                                disabled={!isAdmin}
                                value={draft.ManagerPhone}
                                onChange={(e) =>
                                  setBranchDrafts((prev) => ({
                                    ...prev,
                                    [st.StoreID]: { ...draft, ManagerPhone: e.target.value },
                                  }))
                                }
                                placeholder="Manager Phone"
                                className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-emerald-500 disabled:opacity-60"
                              />
                              <input
                                type="text"
                                disabled={!isAdmin}
                                value={draft.Region}
                                onChange={(e) =>
                                  setBranchDrafts((prev) => ({
                                    ...prev,
                                    [st.StoreID]: { ...draft, Region: e.target.value },
                                  }))
                                }
                                placeholder="Zone / Region"
                                className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 disabled:opacity-60"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 text-[11px]">
                        <span className="text-slate-500 truncate">
                          Last toggled:{' '}
                          {st.LastToggledAt
                            ? new Date(st.LastToggledAt).toLocaleDateString()
                            : 'Initial'}
                        </span>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleSaveBranchDetails(st.StoreID)}
                            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-slate-700 rounded text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            Save Branch Info
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Store Toggle Accountability Audit Log */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white">
                      Store ON/OFF Toggle Compliance Audit Trail
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Every regional store state change is permanently logged with administrator identity and inventory valuation snapshot
                    </p>
                  </div>
                  <span className="font-mono tabular-nums text-xs text-slate-400">
                    {storeToggleLogs.length} events
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-950 border-b border-slate-800 text-[11px] font-semibold text-slate-400">
                      <tr>
                        <th className="py-2.5 px-3">Audit ID</th>
                        <th className="py-2.5 px-3">Timestamp</th>
                        <th className="py-2.5 px-3">Store & Region</th>
                        <th className="py-2.5 px-3">Transition</th>
                        <th className="py-2.5 px-3">Authorized By</th>
                        <th className="py-2.5 px-3 text-right">Snapshot</th>
                        <th className="py-2.5 px-3">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {storeToggleLogs.slice(0, 12).map((entry) => (
                        <tr key={entry.ToggleID} className="hover:bg-slate-900/50">
                          <td className="py-2 px-3 font-mono tabular-nums text-slate-300">
                            {entry.ToggleID}
                          </td>
                          <td className="py-2 px-3 font-mono tabular-nums text-[11px] text-slate-400">
                            {new Date(entry.Timestamp).toLocaleString()}
                          </td>
                          <td className="py-2 px-3">
                            <span className="font-semibold text-white">{entry.StoreName}</span>
                            <span className="text-slate-500 ml-1.5">· {entry.Region}</span>
                          </td>
                          <td className="py-2 px-3 font-mono text-[11px]">
                            <span className="text-slate-400">
                              {entry.PreviousState ? 'ON' : 'OFF'}
                            </span>
                            <span className="mx-1.5 text-slate-600">→</span>
                            <strong
                              className={
                                entry.NewState ? 'text-emerald-400' : 'text-rose-400'
                              }
                            >
                              {entry.NewState ? 'ON' : 'OFF'}
                            </strong>
                          </td>
                          <td className="py-2 px-3 text-slate-200">{entry.ChangedByName}</td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums">
                            <span className="text-white">{entry.StockUnitsSnapshot}u</span>
                            <span className="text-emerald-400 ml-1.5">
                              ({formatCurrency(entry.ValuationSnapshot)})
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-400 max-w-xs truncate" title={entry.Reason}>
                            {entry.Reason}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ========================================================================= */}
          {/* SECTION 1B: THEMES & CLASSIC / SIMPLE WORKSPACE LAYOUT STUDIO             */}
          {/* ========================================================================= */}
          {activeSection === 'appearance' && (
            <div className="space-y-6">
              {/* Top Summary Banner */}
              <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-950 border border-slate-800 rounded-xl p-4">
                <div>
                  <h3 className="text-base font-bold text-white">
                    Application Themes & Classic / Simple Layouts
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Switch the entire pharmacy workspace instantly between clinical light, warm off-white, studio gray, Windows 10, Windows XP, classic ERP, modern, or botanical neon palettes.
                  </p>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <div className="text-right">
                    <span className="text-slate-400 block text-[11px]">Active Configuration</span>
                    <span className="font-semibold text-white">
                      {getThemeDefinition(theme).name}
                    </span>
                    <span className="text-slate-500 mx-1.5">·</span>
                    <span className="font-mono text-emerald-400">
                      {LAYOUT_STYLE_CATALOG.find((l) => l.id === layoutStyle)?.shortLabel}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTheme('dark');
                      setLayoutStyle('standard');
                      showToast(
                        'Restored default Dark Slate Pro theme and Standard Desktop layout.',
                        'info',
                        'Appearance Reset'
                      );
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-medium whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Reset Default
                  </button>
                </div>
              </div>

              {/* Part 1: Workspace Layout Mode (Standard vs Simple Clean vs Classic Spreadsheet Grid) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      1. Workspace Layout Structure
                    </h4>
                    <p className="text-xs text-slate-400">
                      Choose between full desktop chrome, a distraction-free simple bar, or a classic accounting grid with square corners
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {LAYOUT_STYLE_CATALOG.map((layoutItem) => {
                    const isSelected = layoutStyle === layoutItem.id;
                    const IconComp =
                      layoutItem.id === 'simple'
                        ? Layout
                        : layoutItem.id === 'classic'
                        ? Grid3X3
                        : Monitor;

                    return (
                      <button
                        key={layoutItem.id}
                        type="button"
                        onClick={() => {
                          setLayoutStyle(layoutItem.id);
                          showToast(
                            `Switched workspace structure to ${layoutItem.name}.`,
                            'success',
                            'Layout Updated'
                          );
                        }}
                        className={`p-4 rounded-xl border text-left transition-colors flex flex-col justify-between space-y-3 cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-950/50 border-emerald-500'
                            : 'bg-slate-950 border-slate-800 hover:bg-slate-900/70'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-sm text-white flex items-center gap-2">
                              <IconComp className="w-4 h-4 text-emerald-400 shrink-0" />
                              <span>{layoutItem.name}</span>
                            </span>
                            {isSelected && (
                              <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1 whitespace-nowrap shrink-0">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Active</span>
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 leading-relaxed">
                            {layoutItem.description}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-slate-800/80 text-[11px] font-mono text-slate-400">
                          {layoutItem.highlights}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Part 2: 10 Complete Application Themes */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      2. Color & OS Theme Palette ({THEME_CATALOG.length} Themes)
                    </h4>
                    <p className="text-xs text-slate-400">
                      Click any theme card to apply immediately across POS, Store, Live Stock, Purchases, Ledgers, and Settings
                    </p>
                  </div>

                  {/* Category Segmented Filter */}
                  <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg overflow-x-auto">
                    {(
                      ['ALL', 'Light & Paper', 'Classic & OS', 'Modern & Neon', 'Dark'] as const
                    ).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setThemeCategoryFilter(cat)}
                        className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          themeCategoryFilter === cat
                            ? 'bg-emerald-600 text-white font-semibold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {cat === 'ALL' ? 'All Themes (10)' : cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {THEME_CATALOG.filter(
                    (item) =>
                      themeCategoryFilter === 'ALL' || item.category === themeCategoryFilter
                  ).map((item) => {
                    const isCurrent = theme === item.id;
                    const recLayout = LAYOUT_STYLE_CATALOG.find(
                      (l) => l.id === item.recommendedLayout
                    );

                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          setTheme(item.id);
                          showToast(
                            `Switched entire application to ${item.name}.`,
                            'success',
                            'Theme Activated'
                          );
                        }}
                        className={`rounded-xl border p-4 flex flex-col justify-between space-y-3.5 transition-colors cursor-pointer ${
                          isCurrent
                            ? 'bg-emerald-950/40 border-emerald-500'
                            : 'bg-slate-950 border-slate-800 hover:bg-slate-900/60'
                        }`}
                      >
                        <div className="space-y-3">
                          {/* Miniature Live Desktop Preview Frame */}
                          <div
                            data-preview-theme={item.id}
                            className="theme-preview-frame h-28 w-full border overflow-hidden flex flex-col shadow-xs"
                          >
                            {/* Preview Title Bar */}
                            <div className="theme-preview-titlebar h-5 px-2.5 flex items-center justify-between text-[9px] font-mono font-semibold shrink-0">
                              <span>PharmaCore · {item.shortLabel}</span>
                              <div className="flex items-center gap-1">
                                <span className="opacity-70">—</span>
                                <span className="opacity-70">□</span>
                                <span>×</span>
                              </div>
                            </div>

                            {/* Preview Body: Sidebar + Main Workspace Card */}
                            <div className="flex-1 flex overflow-hidden">
                              <div className="theme-preview-sidebar w-16 p-1.5 space-y-1 shrink-0">
                                <div className="theme-preview-primary h-3.5 px-1 flex items-center text-[8px] font-bold">
                                  POS
                                </div>
                                <div className="theme-preview-line h-2 w-10 opacity-60 rounded-xs" />
                                <div className="theme-preview-line h-2 w-11 opacity-50 rounded-xs" />
                                <div className="theme-preview-line h-2 w-9 opacity-40 rounded-xs" />
                              </div>

                              <div className="flex-1 p-2 flex flex-col justify-between">
                                <div className="theme-preview-card p-1.5 space-y-1">
                                  <div className="flex items-center justify-between">
                                    <div className="theme-preview-line h-2 w-16 opacity-80 rounded-xs" />
                                    <div className="theme-preview-primary px-1.5 py-0.5 text-[8px] font-bold leading-none">
                                      Sale
                                    </div>
                                  </div>
                                  <div className="theme-preview-line h-1.5 w-full opacity-45 rounded-xs" />
                                  <div className="theme-preview-line h-1.5 w-4/5 opacity-35 rounded-xs" />
                                </div>

                                <div className="flex items-center gap-1">
                                  <span className="theme-preview-swatch-card w-3.5 h-3.5 rounded-xs border inline-block" />
                                  <span className="theme-preview-swatch-canvas w-3.5 h-3.5 rounded-xs border inline-block" />
                                  <span className="theme-preview-swatch-sidebar w-3.5 h-3.5 rounded-xs border inline-block" />
                                  <span className="theme-preview-swatch-primary w-3.5 h-3.5 rounded-xs border inline-block" />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Theme Title & Description */}
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <h5 className="text-sm font-bold text-white truncate">
                                {item.name}
                              </h5>
                              {isCurrent ? (
                                <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1 whitespace-nowrap shrink-0">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Active</span>
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-500 whitespace-nowrap shrink-0">
                                  {item.category}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                              {item.description}
                            </p>
                          </div>
                        </div>

                        {/* Bottom Action Row */}
                        <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-2 text-[11px]">
                          <span className="text-slate-400 truncate">
                            Best with: <strong className="text-slate-200">{recLayout?.shortLabel}</strong>
                          </span>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTheme(item.id);
                              setLayoutStyle(item.recommendedLayout);
                              showToast(
                                `Applied ${item.name} with ${recLayout?.name}.`,
                                'success',
                                'Theme & Layout Applied'
                              );
                            }}
                            className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-slate-700 font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            Apply + {recLayout?.shortLabel}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SECTION 2: POS, CURRENCY & PHARMACY PROFILE                               */}
          {/* ========================================================================= */}
          {activeSection === 'general' && (
            <form onSubmit={handleSaveSystemSettings} className="space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Left Column: Dispensing Mode, Currency & Workspace Theme */}
                <div className="space-y-4">
                  {/* Sales Operation Mode */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-white">POS Sales Dispensing Mode</h4>
                        <p className="text-xs text-slate-400">
                          Control whether POS cashiers dispense per loose piece/tablet or full wholesale box
                        </p>
                      </div>
                      <span className="text-xs font-mono text-emerald-400 font-semibold">
                        {formData.wholesaleMode ? 'Wholesale' : 'Retail'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        disabled={!isAdmin}
                        onClick={() => setFormData({ ...formData, wholesaleMode: false })}
                        className={`p-3 rounded-lg text-left border transition-colors cursor-pointer disabled:opacity-60 ${
                          !formData.wholesaleMode
                            ? 'bg-emerald-950/50 border-emerald-500 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <div className="font-bold text-xs text-white">Retail Mode (Per Piece)</div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Dispense loose tablets, strips, or single units at retail counter.
                        </p>
                      </button>

                      <button
                        type="button"
                        disabled={!isAdmin}
                        onClick={() => setFormData({ ...formData, wholesaleMode: true })}
                        className={`p-3 rounded-lg text-left border transition-colors cursor-pointer disabled:opacity-60 ${
                          formData.wholesaleMode
                            ? 'bg-amber-950/50 border-amber-500 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <div className="font-bold text-xs text-white">Wholesale Mode (Full Box)</div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Dispense full sealed boxes and packs for B2B pharmacy distribution.
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Global Currency Configuration */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Coins className="w-4 h-4 text-emerald-400" />
                        <div>
                          <h4 className="text-sm font-bold text-white">Currency Configuration</h4>
                          <p className="text-xs text-slate-400">
                            Applied across POS, Purchases, Store Valuation, and Reports
                          </p>
                        </div>
                      </div>
                      <span className="font-mono text-xs font-bold text-emerald-400">
                        {formData.currencySymbol || '$'} · {formData.currencyCode || 'USD'}
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { symbol: '$', code: 'USD' },
                        { symbol: '৳', code: 'BDT' },
                        { symbol: '₹', code: 'INR' },
                        { symbol: '€', code: 'EUR' },
                        { symbol: '£', code: 'GBP' },
                        { symbol: 'AED', code: 'AED' },
                        { symbol: 'SAR', code: 'SAR' },
                        { symbol: 'PKR', code: 'PKR' },
                      ].map((cur) => (
                        <button
                          key={cur.code}
                          type="button"
                          disabled={!isAdmin}
                          onClick={() =>
                            setFormData({
                              ...formData,
                              currencySymbol: cur.symbol,
                              currencyCode: cur.code,
                            })
                          }
                          className={`py-2 px-2 rounded-lg text-center border transition-colors cursor-pointer disabled:opacity-60 ${
                            formData.currencySymbol === cur.symbol
                              ? 'bg-emerald-950/60 border-emerald-500 text-white font-bold'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          <span className="font-mono text-xs block text-emerald-400 font-bold">
                            {cur.symbol}
                          </span>
                          <span className="text-[10px] text-slate-400 block">{cur.code}</span>
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Custom Symbol</label>
                        <input
                          type="text"
                          maxLength={5}
                          disabled={!isAdmin}
                          value={formData.currencySymbol || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, currencySymbol: e.target.value })
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 font-mono text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Currency Code</label>
                        <input
                          type="text"
                          maxLength={5}
                          disabled={!isAdmin}
                          value={formData.currencyCode || ''}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              currencyCode: e.target.value.toUpperCase(),
                            })
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 font-mono text-xs text-white uppercase focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Theme & Physical Audit Mode */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-bold text-white">Active Theme & Layout</h4>
                        <p className="text-xs text-slate-400">
                          {getThemeDefinition(theme).name} ·{' '}
                          {LAYOUT_STYLE_CATALOG.find((l) => l.id === layoutStyle)?.name}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveSection('appearance')}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Palette className="w-3.5 h-3.5" />
                        <span>All 10 Themes & Layouts</span>
                      </button>
                    </div>

                    <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-white">Physical Inventory Audit Mode</h4>
                        <p className="text-[11px] text-slate-400">
                          Enables live shelf recount reconciliation in Medicine Adjustment
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={!isAdmin}
                        onClick={() =>
                          setFormData({
                            ...formData,
                            auditModeEnabled: !formData.auditModeEnabled,
                          })
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer disabled:opacity-50 ${
                          formData.auditModeEnabled
                            ? 'bg-emerald-600 text-white border-emerald-500'
                            : 'bg-slate-900 text-slate-300 border-slate-700'
                        }`}
                      >
                        {formData.auditModeEnabled ? 'Audit Mode ON' : 'Audit Mode OFF'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Column: Pharmacy Identity & Tax Header */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-4">
                  <div className="space-y-3.5 text-xs">
                    <div>
                      <h4 className="text-sm font-bold text-white">
                        Pharmacy Organization & Receipt Header
                      </h4>
                      <p className="text-xs text-slate-400">
                        Printed on POS receipts, purchase vouchers, and regional warehouse manifests
                      </p>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">Pharmacy Header Title</label>
                      <input
                        type="text"
                        required
                        disabled={!isAdmin}
                        value={formData.pharmacyName}
                        onChange={(e) =>
                          setFormData({ ...formData, pharmacyName: e.target.value })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-bold focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">Street Address & Branch HQ</label>
                      <input
                        type="text"
                        disabled={!isAdmin}
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-400 mb-1">Contact Phone</label>
                        <input
                          type="text"
                          disabled={!isAdmin}
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">Tax / Drug License / VAT No</label>
                        <input
                          type="text"
                          disabled={!isAdmin}
                          value={formData.taxNumber}
                          onChange={(e) =>
                            setFormData({ ...formData, taxNumber: e.target.value })
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-mono focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">Receipt Footer Terms</label>
                      <textarea
                        rows={3}
                        disabled={!isAdmin}
                        value={formData.footerMessage}
                        onChange={(e) =>
                          setFormData({ ...formData, footerMessage: e.target.value })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  {isAdmin && (
                    <div className="pt-3 border-t border-slate-800 flex justify-end">
                      <button
                        type="submit"
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <Save className="w-4 h-4" />
                        <span>Save POS & Profile Settings</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </form>
          )}

          {/* ========================================================================= */}
          {/* SECTION 3: NATIVE RONGTA THERMAL PRINTER & ESC/POS HARDWARE STUDIO        */}
          {/* ========================================================================= */}
          {activeSection === 'printer' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Left 7 Cols: Native Desktop Hardware & Print Driver Controls */}
              <div className="lg:col-span-7 bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      Native Rongta Thermal Printer &amp; ESC/POS Hardware Studio
                    </h4>
                    <p className="text-xs text-slate-400">
                      Direct OS Spooler, Win32 RAW USB, Node SerialPort (COM), and TCP Port 9100 — zero browser permission dependencies
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={refreshNativeHardware}
                      disabled={isRefreshingHardware}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {isRefreshingHardware ? 'Scanning...' : 'Rescan Hardware'}
                    </button>
                    <button
                      type="button"
                      onClick={handleTestPrint}
                      disabled={isTestPrinting}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>{isTestPrinting ? 'Printing...' : 'Native Test Print'}</span>
                    </button>
                  </div>
                </div>

                {hardwareStatus.isElectron && (
                  <div className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-700/60 text-emerald-300 text-xs flex items-center justify-between">
                    <span>Standalone Electron Native Spooler Active — Zero-Dialog Rongta Thermal Printing Enabled</span>
                    <span className="font-mono font-bold">DESKTOP NATIVE</span>
                  </div>
                )}

                {/* Native Transport Mode Selector */}
                <div className="space-y-1.5">
                  <label className="block text-slate-300 font-semibold">
                    1. Native Hardware Transport Channel
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {[
                      {
                        id: 'auto' as PrinterTransportMode,
                        title: 'Desktop Silent Spooler (Recommended)',
                        desc: 'Zero-dialog Electron & Windows Rongta driver (renders ৳ Taka, SVG barcodes & 80mm/58mm layout)',
                        icon: Printer,
                      },
                      {
                        id: 'raw-usb' as PrinterTransportMode,
                        title: 'Win32 RAW USB ESC/POS (USB001)',
                        desc: 'Direct winspool.Drv WritePrinter RAW binary ESC/POS + GS V 0 cutter & ESC p drawer kick',
                        icon: Usb,
                      },
                      {
                        id: 'serial' as PrinterTransportMode,
                        title: 'Native SerialPort (COM1 / COM3)',
                        desc: 'Direct Node.js serialport RS-232 / USB-Serial binary ESC/POS byte stream',
                        icon: Cpu,
                      },
                      {
                        id: 'network' as PrinterTransportMode,
                        title: 'Direct LAN TCP Socket (Port 9100)',
                        desc: 'Direct Node.js net.Socket raw ESC/POS connection for Ethernet / Wi-Fi Rongta printers',
                        icon: Globe,
                      },
                    ].map((modeItem) => {
                      const IconComp = modeItem.icon;
                      const currentMode = formData.printerTransport || 'auto';
                      const isSelected =
                        currentMode === modeItem.id ||
                        (modeItem.id === 'auto' && currentMode === 'spooler');
                      return (
                        <button
                          key={modeItem.id}
                          type="button"
                          onClick={() =>
                            setFormData({ ...formData, printerTransport: modeItem.id })
                          }
                          className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-950/50 border-emerald-500 text-white'
                              : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800/70'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-white flex items-center gap-1.5">
                              <IconComp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span>{modeItem.title}</span>
                            </span>
                            {isSelected && (
                              <span className="text-[10px] font-mono text-emerald-400 font-bold">
                                ACTIVE
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                            {modeItem.desc}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* OS Printer Queue + Native SerialPort COM Selector */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-slate-300 font-semibold">
                      2. Rongta / OS Spooler Printer Queue
                    </label>
                    <select
                      value={
                        [...systemPrinters.map((s) => s.name), ...COMMON_PRINTERS].includes(
                          formData.printerDevice || ''
                        )
                          ? formData.printerDevice
                          : 'custom'
                      }
                      onChange={(e) => {
                        if (e.target.value !== 'custom') {
                          setFormData({ ...formData, printerDevice: e.target.value });
                        }
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                    >
                      {systemPrinters.length > 0 && (
                        <optgroup label="Detected Local System Printers">
                          {systemPrinters.map((sp) => (
                            <option key={`sys-${sp.name}`} value={sp.name}>
                              {sp.name} {sp.portName ? `[${sp.portName}]` : ''} {sp.isDefault ? '(Default)' : ''}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      <optgroup label="Rongta & POS Thermal Profiles">
                        {COMMON_PRINTERS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </optgroup>
                      <option value="custom">Custom Windows / USB Printer Name...</option>
                    </select>
                    <input
                      type="text"
                      value={formData.printerDevice || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, printerDevice: e.target.value })
                      }
                      placeholder="e.g. RONGTA 80mm Series Printer, POS-80C"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-slate-300 font-semibold flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Cpu className="w-3.5 h-3.5 text-sky-400" />
                        <span>Native SerialPort (COM)</span>
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {serialPorts.length} port{serialPorts.length === 1 ? '' : 's'}
                      </span>
                    </label>
                    {serialPorts.length > 0 ? (
                      <select
                        value={formData.serialPortPath || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            serialPortPath: e.target.value,
                            ...(e.target.value ? { printerTransport: 'serial' } : {}),
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono text-xs"
                      >
                        <option value="">-- Select Detected COM Port --</option>
                        {serialPorts.map((sp) => (
                          <option key={sp.path} value={sp.path}>
                            {sp.path} {sp.friendlyName ? `(${sp.friendlyName})` : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={formData.serialPortPath || ''}
                        onChange={(e) =>
                          setFormData({ ...formData, serialPortPath: e.target.value })
                        }
                        placeholder="COM3 or /dev/ttyUSB0"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono text-xs"
                      />
                    )}
                    <div className="flex items-center gap-1.5">
                      <select
                        value={formData.serialBaudRate || 9600}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            serialBaudRate: Number(e.target.value) || 9600,
                          })
                        }
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono text-xs"
                      >
                        <option value={9600}>9600 Baud</option>
                        <option value={19200}>19200 Baud</option>
                        <option value={38400}>38400 Baud</option>
                        <option value={115200}>115200 Baud</option>
                      </select>
                      <button
                        type="button"
                        disabled={isTestingSerial}
                        onClick={handleTestSerialPort}
                        className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold whitespace-nowrap cursor-pointer disabled:opacity-50"
                      >
                        {isTestingSerial ? 'Testing...' : 'Test COM'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Direct TCP Socket Port 9100 */}
                <div className="space-y-1.5">
                  <label className="block text-slate-300 font-semibold flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Direct LAN TCP Socket (Ethernet / Wi-Fi Rongta Port 9100)</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={formData.networkPrinterIp || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, networkPrinterIp: e.target.value })
                      }
                      placeholder="Optional LAN Printer IP:Port (e.g. 192.168.0.200:9100)"
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      disabled={isTestingNetwork}
                      onClick={handleTestNetworkIp}
                      className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold whitespace-nowrap cursor-pointer disabled:opacity-50"
                    >
                      {isTestingNetwork ? 'Testing...' : 'Test TCP 9100'}
                    </button>
                  </div>
                </div>

                {/* Print Workflow & Roll Width */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Print Workflow</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        disabled={!isAdmin}
                        onClick={() => setFormData({ ...formData, printMode: 'direct' })}
                        className={`py-2 px-2.5 rounded-lg border text-xs font-medium cursor-pointer ${
                          formData.printMode !== 'preview'
                            ? 'bg-emerald-950/60 border-emerald-500 text-white font-semibold'
                            : 'bg-slate-900 border-slate-800 text-slate-400'
                        }`}
                      >
                        Direct Instant
                      </button>
                      <button
                        type="button"
                        disabled={!isAdmin}
                        onClick={() => setFormData({ ...formData, printMode: 'preview' })}
                        className={`py-2 px-2.5 rounded-lg border text-xs font-medium cursor-pointer ${
                          formData.printMode === 'preview'
                            ? 'bg-emerald-950/60 border-emerald-500 text-white font-semibold'
                            : 'bg-slate-900 border-slate-800 text-slate-400'
                        }`}
                      >
                        Preview Modal
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Thermal Roll Width</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        disabled={!isAdmin}
                        onClick={() => setFormData({ ...formData, printerWidth: '80mm' })}
                        className={`py-2 px-2.5 rounded-lg border text-xs font-mono cursor-pointer ${
                          formData.printerWidth === '80mm'
                            ? 'bg-emerald-950/60 border-emerald-500 text-white font-bold'
                            : 'bg-slate-900 border-slate-800 text-slate-400'
                        }`}
                      >
                        80mm Roll
                      </button>
                      <button
                        type="button"
                        disabled={!isAdmin}
                        onClick={() => setFormData({ ...formData, printerWidth: '58mm' })}
                        className={`py-2 px-2.5 rounded-lg border text-xs font-mono cursor-pointer ${
                          formData.printerWidth === '58mm'
                            ? 'bg-emerald-950/60 border-emerald-500 text-white font-bold'
                            : 'bg-slate-900 border-slate-800 text-slate-400'
                        }`}
                      >
                        58mm Roll
                      </button>
                    </div>
                  </div>
                </div>

                {/* Checkboxes */}
                <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-800">
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!isAdmin}
                      checked={formData.autoPrintOnSale ?? false}
                      onChange={(e) =>
                        setFormData({ ...formData, autoPrintOnSale: e.target.checked })
                      }
                    />
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>Auto-Print on Sale Tender</span>
                  </label>

                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!isAdmin}
                      checked={formData.cutPaper ?? true}
                      onChange={(e) => setFormData({ ...formData, cutPaper: e.target.checked })}
                    />
                    <Scissors className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Auto-Cut Paper (GS V 0)</span>
                  </label>

                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!isAdmin}
                      checked={formData.openCashDrawer ?? true}
                      onChange={(e) =>
                        setFormData({ ...formData, openCashDrawer: e.target.checked })
                      }
                    />
                    <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Cash Drawer Kick (ESC p)</span>
                  </label>

                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!isAdmin}
                      checked={formData.showGenericName}
                      onChange={(e) =>
                        setFormData({ ...formData, showGenericName: e.target.checked })
                      }
                    />
                    <span>Print Generic Formulation</span>
                  </label>

                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!isAdmin}
                      checked={formData.showBatchNo}
                      onChange={(e) =>
                        setFormData({ ...formData, showBatchNo: e.target.checked })
                      }
                    />
                    <span>Print Batch &amp; Expiry</span>
                  </label>

                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!isAdmin}
                      checked={formData.showRackNo}
                      onChange={(e) =>
                        setFormData({ ...formData, showRackNo: e.target.checked })
                      }
                    />
                    <span>Print Shelf / Rack Location</span>
                  </label>
                </div>

                <div className="pt-3 border-t border-slate-800 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleSaveSystemSettings(undefined, true)}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Rongta Thermal Printer Settings</span>
                  </button>
                </div>
              </div>

              {/* Right 5 Cols: Live Receipt Paper Preview */}
              <div className="lg:col-span-5 bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white">
                    Live Thermal Receipt Paper Preview ({formData.printerWidth})
                  </h4>
                  <span className="font-mono text-[11px] text-slate-400">
                    {formData.copies || 1} cop{(formData.copies || 1) > 1 ? 'ies' : 'y'}
                  </span>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 flex justify-center">
                  <div
                    className={`bg-white text-slate-900 rounded shadow-md p-4 font-mono text-[11px] space-y-2 transition-all ${
                      formData.printerWidth === '58mm' ? 'w-60' : 'w-80'
                    }`}
                  >
                    <div className="text-center border-b border-dashed border-slate-400 pb-2">
                      <div className="font-bold text-xs uppercase">{formData.pharmacyName}</div>
                      <div className="text-[10px] text-slate-600">{formData.address}</div>
                      <div className="text-[10px] text-slate-600">Tel: {formData.phone}</div>
                      <div className="text-[10px] text-slate-600">VAT: {formData.taxNumber}</div>
                    </div>

                    <div className="flex justify-between text-[10px] text-slate-600">
                      <span>REC-2026-1099</span>
                      <span>{new Date().toLocaleDateString()}</span>
                    </div>

                    <div className="border-y border-dashed border-slate-400 py-2 space-y-1.5">
                      <div>
                        <div className="flex justify-between font-bold">
                          <span>Napa Extra 500mg x2</span>
                          <span>{formData.currencySymbol || '$'}30.00</span>
                        </div>
                        {formData.showGenericName && (
                          <div className="text-[9.5px] text-slate-600">Paracetamol + Caffeine</div>
                        )}
                        {(formData.showBatchNo || formData.showRackNo) && (
                          <div className="text-[9.5px] text-slate-500">
                            {formData.showBatchNo ? 'Batch: NP-26A · Exp 11/28' : ''}
                            {formData.showBatchNo && formData.showRackNo ? ' · ' : ''}
                            {formData.showRackNo ? 'RACK-A1' : ''}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-between font-bold text-xs pt-1">
                      <span>NET TOTAL</span>
                      <span>{formData.currencySymbol || '$'}30.00</span>
                    </div>

                    <div className="pt-2 border-t border-dashed border-slate-400 text-center text-[10px] text-slate-600">
                      {formData.footerMessage}
                    </div>
                  </div>
                </div>
              </div>

              {/* Ink Printer & Reorder System Options (Paper Size & Download Directory) */}
              <div className="lg:col-span-12 bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Printer className="w-4 h-4 text-emerald-400" />
                      <span>Reorder System Ink Printer &amp; PDF Export Setup</span>
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Configure cut-sheet paper sizes (A4, Letter, Legal, A5) for ink printers and define the custom desktop directory path for exported PDF order lists.
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded text-xs font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-700/60">
                    Active Paper:{' '}
                    {reorderSettings.paperSize === 'Custom'
                      ? `Custom (${reorderSettings.customPaperWidth || 3.8} × ${reorderSettings.customPaperHeight || 9.0} ${reorderSettings.customPaperUnit || 'in'})`
                      : reorderSettings.paperSize}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  {/* Paper Size */}
                  <div className="space-y-1.5 md:col-span-1">
                    <label className="text-slate-300 font-bold block">Ink Printer Paper Size:</label>
                    <div className="grid grid-cols-5 gap-1.5">
                      {(['A4', 'Letter', 'Legal', 'A5', 'Custom'] as ReorderPaperSize[]).map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => updateReorderSettings({ paperSize: size })}
                          className={`py-2 rounded-lg font-mono font-bold text-xs border text-center transition-all cursor-pointer ${
                            reorderSettings.paperSize === size
                              ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                              : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-500">Standard cut-sheet or custom paper dimensions (e.g. 3.8" × 9").</p>

                    {reorderSettings.paperSize === 'Custom' && (
                      <div className="p-3 bg-slate-900/90 rounded-lg border border-emerald-600/50 space-y-2 mt-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-emerald-400 text-xs">Custom Dimensions:</span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {reorderSettings.customPaperWidth || 3.8} × {reorderSettings.customPaperHeight || 9.0} {reorderSettings.customPaperUnit || 'in'}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-0.5">Width:</label>
                            <input
                              type="number"
                              step="0.1"
                              min="1"
                              max="20"
                              value={reorderSettings.customPaperWidth ?? 3.8}
                              onChange={(e) => updateReorderSettings({ customPaperWidth: parseFloat(e.target.value) || 3.8 })}
                              className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-xs text-white font-mono focus:border-emerald-500 outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-0.5">Height:</label>
                            <input
                              type="number"
                              step="0.1"
                              min="1"
                              max="50"
                              value={reorderSettings.customPaperHeight ?? 9.0}
                              onChange={(e) => updateReorderSettings({ customPaperHeight: parseFloat(e.target.value) || 9.0 })}
                              className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-xs text-white font-mono focus:border-emerald-500 outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-0.5">Unit:</label>
                            <div className="grid grid-cols-2 gap-1">
                              <button
                                type="button"
                                onClick={() => updateReorderSettings({ customPaperUnit: 'in' })}
                                className={`py-1 text-xs font-mono font-bold rounded border cursor-pointer ${
                                  (reorderSettings.customPaperUnit || 'in') === 'in'
                                    ? 'bg-emerald-600 text-white border-emerald-500'
                                    : 'bg-slate-950 text-slate-300 border-slate-700'
                                }`}
                              >
                                in
                              </button>
                              <button
                                type="button"
                                onClick={() => updateReorderSettings({ customPaperUnit: 'mm' })}
                                className={`py-1 text-xs font-mono font-bold rounded border cursor-pointer ${
                                  reorderSettings.customPaperUnit === 'mm'
                                    ? 'bg-emerald-600 text-white border-emerald-500'
                                    : 'bg-slate-950 text-slate-300 border-slate-700'
                                }`}
                              >
                                mm
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Presets */}
                        <div className="pt-1">
                          <span className="text-[10px] text-slate-400 block mb-1">Quick Custom Presets:</span>
                          <div className="flex flex-wrap gap-1">
                            <button
                              type="button"
                              onClick={() => updateReorderSettings({ customPaperWidth: 3.8, customPaperHeight: 9.0, customPaperUnit: 'in' })}
                              className="px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 text-emerald-300 border border-emerald-700/60 text-[10px] font-mono cursor-pointer"
                            >
                              3.8" × 9.0" (Voucher / Slip) ★
                            </button>
                            <button
                              type="button"
                              onClick={() => updateReorderSettings({ customPaperWidth: 4.0, customPaperHeight: 6.0, customPaperUnit: 'in' })}
                              className="px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-mono cursor-pointer"
                            >
                              4" × 6" (Postcard)
                            </button>
                            <button
                              type="button"
                              onClick={() => updateReorderSettings({ customPaperWidth: 8.5, customPaperHeight: 5.5, customPaperUnit: 'in' })}
                              className="px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-mono cursor-pointer"
                            >
                              8.5" × 5.5" (Statement)
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* PDF Download Directory Path */}
                  <div className="space-y-1.5">
                    <label className="text-slate-300 font-bold block">PDF Download Directory Path:</label>
                    <input
                      type="text"
                      value={reorderSettings.pdfDownloadDirectory}
                      onChange={(e) => updateReorderSettings({ pdfDownloadDirectory: e.target.value })}
                      placeholder="e.g. C:\PharmaCore\Reorders\PDFs"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                    />
                    <p className="text-[10px] text-slate-500">Desktop export target directory for downloaded PDF order sheets.</p>
                  </div>

                  {/* Print Orientation */}
                  <div className="space-y-1.5">
                    <label className="text-slate-300 font-bold block">Page Orientation:</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => updateReorderSettings({ printOrientation: 'portrait' })}
                        className={`py-2 rounded-lg font-semibold text-xs border text-center transition-all cursor-pointer ${
                          reorderSettings.printOrientation === 'portrait'
                            ? 'bg-emerald-600 text-white border-emerald-500'
                            : 'bg-slate-900 text-slate-300 border-slate-800'
                        }`}
                      >
                        Portrait (Standard)
                      </button>
                      <button
                        type="button"
                        onClick={() => updateReorderSettings({ printOrientation: 'landscape' })}
                        className={`py-2 rounded-lg font-semibold text-xs border text-center transition-all cursor-pointer ${
                          reorderSettings.printOrientation === 'landscape'
                            ? 'bg-emerald-600 text-white border-emerald-500'
                            : 'bg-slate-900 text-slate-300 border-slate-800'
                        }`}
                      >
                        Landscape (Wide Table)
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500">Layout orientation for ink printer order sheets.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SECTION 4: ACCESS ROLES (RBAC) & LOGISTICS COMPLIANCE                     */}
          {/* ========================================================================= */}
          {activeSection === 'rbac' && (
            <div className="space-y-4">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold text-white">
                    Role-Based Access Control (RBAC) & Branch Governance Matrix
                  </h4>
                  <p className="text-xs text-slate-400">
                    Enforces strict separation of duties across Chief Administrators, Regional Branch Managers, and POS Cashiers
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleQuickExportComplianceJson}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Governance Snapshot (.JSON)</span>
                </button>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-900 border-b border-slate-800 text-[11px] font-semibold text-slate-400">
                    <tr>
                      <th className="py-2.5 px-4">Capability / Module</th>
                      <th className="py-2.5 px-4">Admin (Chief Pharmacist)</th>
                      <th className="py-2.5 px-4">Moderator (Branch / Inventory Mgr)</th>
                      <th className="py-2.5 px-4">Salesman (POS Cashier)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    <tr>
                      <td className="py-2.5 px-4 font-semibold text-white">
                        Switch Regional Stores ON / OFF
                      </td>
                      <td className="py-2.5 px-4 text-emerald-400 font-semibold">
                        Authorized (Logged)
                      </td>
                      <td className="py-2.5 px-4 text-slate-500">Locked (Read-Only View)</td>
                      <td className="py-2.5 px-4 text-slate-500">Restricted</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-semibold text-white">
                        Active Store Operations (In, Out, Inter-Change)
                      </td>
                      <td className="py-2.5 px-4 text-emerald-400 font-semibold">Full Access</td>
                      <td className="py-2.5 px-4 text-sky-400 font-semibold">
                        Active Stores Only
                      </td>
                      <td className="py-2.5 px-4 text-slate-500">Restricted</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-semibold text-white">
                        Stored Medicine Supplier Tree & Group Report
                      </td>
                      <td className="py-2.5 px-4 text-emerald-400 font-semibold">Full Access</td>
                      <td className="py-2.5 px-4 text-sky-400 font-semibold">Authorized</td>
                      <td className="py-2.5 px-4 text-slate-500">Restricted</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-semibold text-white">
                        Fast POS Terminal & Live Stock (Multi-Store Balances)
                      </td>
                      <td className="py-2.5 px-4 text-emerald-400 font-semibold">Full Access</td>
                      <td className="py-2.5 px-4 text-sky-400 font-semibold">Authorized</td>
                      <td className="py-2.5 px-4 text-emerald-400 font-semibold">
                        Authorized (POS + Read-Only Live Stock)
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-semibold text-white">
                        Settings: Llama 3 AI Purchasing & SQL Server Backup
                      </td>
                      <td className="py-2.5 px-4 text-emerald-400 font-semibold">Full Access</td>
                      <td className="py-2.5 px-4 text-slate-500">Restricted</td>
                      <td className="py-2.5 px-4 text-slate-500">Restricted</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Active Registered Users */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {users.map((u) => (
                  <div
                    key={u.UserID}
                    className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold text-white">{u.FullName}</div>
                      <div className="text-[11px] font-mono text-slate-400">@{u.Username}</div>
                    </div>
                    <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{u.Role}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          </div>
        </div>
      )}
    </div>
  );
};
