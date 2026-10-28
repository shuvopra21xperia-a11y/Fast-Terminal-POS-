/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Standalone Native Desktop Application Title Bar & Status Header
 * Connects directly to Electron window IPC controls and SQL Server (192.168.0.13)
 */

import React, { useState, useEffect } from 'react';
import { usePharmacy } from '../context/PharmacyContext';
import {
  ShieldCheck,
  UserCheck,
  Server,
  Cpu,
  Minus,
  Square,
  Copy,
  X,
  Keyboard,
  Clock,
  Download,
  Printer,
  Palette,
  PanelLeft,
  PanelLeftClose,
} from 'lucide-react';
import { THEME_CATALOG } from '../utils/themeCatalog';
import { ThemeType } from '../types/pharmacy';

interface DesktopHeaderProps {
  onOpenReceiptSettings: () => void;
  onOpenShortcutsHelp: () => void;
  onOpenThemeSettings?: () => void;
  activeTab?: string;
  onSelectTab?: (tab: any) => void;
}

export const DesktopHeader: React.FC<DesktopHeaderProps> = ({
  onOpenReceiptSettings,
  onOpenShortcutsHelp,
  onOpenThemeSettings,
  activeTab = 'pos',
  onSelectTab,
}) => {
  const {
    currentUser,
    switchUser,
    logout,
    askConfirm,
    showToast,
    theme,
    setTheme,
    layoutStyle,
    isSidebarCollapsed,
    toggleSidebar,
  } = usePharmacy();

  const isElectron = typeof window !== 'undefined' && Boolean(window.electronPOS?.isElectron);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);

  const [ollamaStatus, setOllamaStatus] = useState<{ connected: boolean; host: string; port?: string }>({
    connected: false,
    host: 'localhost:11434',
    port: '11434',
  });
  const [dbStatus, setDbStatus] = useState<{
    server: string;
    database: string;
    port?: string;
    appPort?: string | number;
    connected?: boolean;
  }>({
    server: '192.168.0.13',
    database: 'PharmaCoreDB',
    port: '1433',
    appPort: '3000',
    connected: false,
  });
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isElectron) return;
    window.electronPOS?.isWindowMaximized?.().then((val) => setIsMaximized(Boolean(val))).catch(() => {});
    const unsub = window.electronPOS?.onMaximizedChange?.((val) => setIsMaximized(Boolean(val)));
    return () => {
      unsub?.();
    };
  }, [isElectron]);

  useEffect(() => {
    fetch('/api/ollama/status')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.connected) {
          setOllamaStatus({ connected: true, host: data.host, port: data.port || '11434' });
        } else {
          setOllamaStatus({
            connected: false,
            host: data?.host || 'localhost:11434',
            port: data?.port || '11434',
          });
        }
      })
      .catch(() => {
        setOllamaStatus({ connected: false, host: 'localhost:11434', port: '11434' });
      });

    fetch('/api/db-status')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.server) {
          setDbStatus({
            server: data.server,
            database: data.database || 'PharmaCoreDB',
            port: data.port || '1433',
            appPort: data.appPort || '3000',
            connected: Boolean(data.connected),
          });
        }
      })
      .catch(() => {
        fetch('/api/system-info')
          .then((res) => res.json())
          .then((data) => {
            if (data && data.dbServer) {
              setDbStatus({
                server: data.dbServer,
                database: data.dbName,
                port: data.dbPort,
                appPort: data.appPort,
                connected: false,
              });
            }
          })
          .catch(() => {});
      });
  }, []);

  const handleMinimize = () => {
    if (window.electronPOS?.minimizeWindow) {
      window.electronPOS.minimizeWindow();
    }
  };

  const handleToggleMaximize = async () => {
    if (window.electronPOS?.toggleMaximizeWindow) {
      const res = await window.electronPOS.toggleMaximizeWindow();
      if (res && typeof res.isMaximized === 'boolean') {
        setIsMaximized(res.isMaximized);
      }
    }
  };

  const handleCloseWindow = () => {
    if (window.electronPOS?.closeWindow) {
      askConfirm({
        title: 'Exit PharmaCore Desktop POS',
        message: 'Close the standalone PharmaCore POS desktop application window?',
        confirmLabel: 'Exit Desktop App',
        cancelLabel: 'Cancel',
        isDestructive: true,
        onConfirm: () => {
          window.electronPOS?.closeWindow?.();
        },
      });
    }
  };

  return (
    <header className="app-window-header bg-slate-950 border-b border-slate-800 select-none text-xs flex flex-col shrink-0">
      {/* Native Draggable Desktop Title Bar with Minimize / Maximize / Close */}
      <div
        onDoubleClick={handleToggleMaximize}
        className="app-titlebar flex items-center justify-between px-3 py-1.5 border-b border-slate-800/80 bg-slate-950 text-slate-400"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-3.5 h-3.5 rounded bg-emerald-600 flex items-center justify-center font-bold text-[9px] text-white tracking-tighter shrink-0">
            Rx
          </div>
          <span className="font-semibold text-slate-200 tracking-tight truncate">
            Fatema Pharmacy · PharmaCore Desktop POS v2026.4
          </span>
          <span className="text-slate-600 text-[11px]">—</span>
          <span className="text-slate-400 font-mono text-[11px] truncate max-w-sm">
            SQL {dbStatus.server}:{dbStatus.port || '1433'} · {dbStatus.database} (
            {dbStatus.connected ? 'Live TDS' : 'Local Ledger'})
          </span>
        </div>

        {/* Native Desktop Window Controls */}
        <div className="flex items-center gap-1 -mr-1">
          <button
            type="button"
            onClick={handleMinimize}
            title="Minimize Window"
            className="w-7 h-5 flex items-center justify-center text-slate-400 hover:bg-slate-800 hover:text-slate-200 rounded transition-colors cursor-pointer"
          >
            <Minus className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={handleToggleMaximize}
            title={isMaximized ? 'Restore Down' : 'Maximize Window'}
            className="w-7 h-5 flex items-center justify-center text-slate-400 hover:bg-slate-800 hover:text-slate-200 rounded transition-colors cursor-pointer"
          >
            {isMaximized ? <Copy className="w-2.5 h-2.5" /> : <Square className="w-2.5 h-2.5" />}
          </button>
          <button
            type="button"
            onClick={handleCloseWindow}
            title="Close Application"
            className="app-titlebar-close w-7 h-5 flex items-center justify-center text-slate-400 hover:bg-rose-600 hover:text-white rounded transition-colors cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Primary Desktop Action & Status Bar */}
      <div className="app-menubar flex items-center justify-between px-4 py-2 bg-slate-900/90 text-slate-300 border-b border-transparent">
        <div className="flex items-center gap-3">
          {/* Sidebar Toggle Button */}
          <button
            onClick={toggleSidebar}
            className={`p-1.5 rounded transition-all cursor-pointer flex items-center justify-center ${
              isSidebarCollapsed
                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/80 hover:bg-emerald-900/80'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title={isSidebarCollapsed ? 'Expand Navigation Sidebar' : 'Collapse Navigation Sidebar'}
          >
            {isSidebarCollapsed ? (
              <PanelLeft className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>

          <div className="flex items-baseline gap-2">
            <span className="text-sm font-bold tracking-tight text-white font-sans">
              PharmaCore
            </span>
            <span className="app-tech-telemetry text-[11px] font-medium text-emerald-400 uppercase tracking-wider">
              {isElectron ? 'Desktop Native' : 'Offline Pro'}
            </span>
          </div>

          <div className="app-tech-telemetry h-4 w-px bg-slate-700" />

          {/* SQL Server 192.168.0.13 Connection Indicator */}
          <div
            className="app-tech-telemetry flex items-center gap-1.5 text-[11px] text-slate-400"
            title={
              dbStatus.connected
                ? `Connected via native mssql TDS to ${dbStatus.server}:${dbStatus.port || '1433'} [${dbStatus.database}]`
                : `Target SQL Server: ${dbStatus.server}:${dbStatus.port || '1433'} [${dbStatus.database}] — Local POS cache active`
            }
          >
            <Server
              className={`w-3.5 h-3.5 ${
                dbStatus.connected ? 'text-emerald-400' : 'text-sky-400'
              }`}
            />
            <span className="font-mono">{dbStatus.server}</span>
          </div>

          {/* Ollama Llama 3 AI Status */}
          <div
            className="app-tech-telemetry flex items-center gap-1.5 text-[11px] text-slate-400 cursor-help"
            title={
              ollamaStatus.connected
                ? `Llama 3 is active at ${ollamaStatus.host} (Port: ${ollamaStatus.port || '11434'})`
                : `Target: Port ${ollamaStatus.port || '11434'} at ${ollamaStatus.host}. Local deterministic Pharma-Neural reasoning active when offline.`
            }
          >
            <Cpu
              className={`w-3.5 h-3.5 ${
                ollamaStatus.connected ? 'text-emerald-400' : 'text-amber-400'
              }`}
            />
            <span>Llama 3 AI</span>
          </div>

          {/* Module Switcher for all roles */}
          {onSelectTab && currentUser && (
            <>
              <div className="h-4 w-px bg-slate-700" />
              <div className="flex items-center gap-1.5 bg-slate-800/90 px-2.5 py-1 rounded border border-slate-700/80">
                <span className="text-[10px] text-slate-400 font-semibold">Module:</span>
                <select
                  value={activeTab === 'storeReport' ? 'store' : activeTab}
                  onChange={(e) => onSelectTab(e.target.value)}
                  className="bg-transparent text-emerald-400 font-semibold text-xs border-none outline-none cursor-pointer"
                >
                  {currentUser?.Role === 'Admin' ? (
                    <>
                      <optgroup label="Catalog & Warehouse" className="bg-slate-900 text-slate-400">
                        <option value="medicines" className="bg-slate-900 text-slate-100">Medicine Profile</option>
                        <option value="adjustments" className="bg-slate-900 text-slate-100">Medicine Adjustment</option>
                        <option value="purchases" className="bg-slate-900 text-slate-100">Purchase Dashboard</option>
                        <option value="suppliers" className="bg-slate-900 text-slate-100">Supplier & Ledger</option>
                        <option value="store" className="bg-slate-900 text-slate-100">Store</option>
                        <option value="expire" className="bg-slate-900 text-slate-100">Expire Vault & Return</option>
                        <option value="batches" className="bg-slate-900 text-slate-100">Batch & Inventory</option>
                      </optgroup>
                      <optgroup label="POS & Receivables" className="bg-slate-900 text-slate-400">
                        <option value="pos" className="bg-slate-900 text-slate-100">Fast POS Terminal</option>
                        <option value="customers" className="bg-slate-900 text-slate-100">Customer & Due</option>
                        <option value="salesLedger" className="bg-slate-900 text-slate-100">Sale Ledger & Receipts</option>
                      </optgroup>
                      <optgroup label="Analytics & Live Stock" className="bg-slate-900 text-slate-400">
                        <option value="analytics" className="bg-slate-900 text-slate-100">Executive Analytics</option>
                        <option value="profit" className="bg-slate-900 text-slate-100">Profit & Margin</option>
                        <option value="complaints" className="bg-slate-900 text-slate-100">Complain Box & Coaching</option>
                        <option value="liveStock" className="bg-slate-900 text-slate-100">Live Stock</option>
                      </optgroup>
                      <optgroup label="System & Governance" className="bg-slate-900 text-slate-400">
                        <option value="settings" className="bg-slate-900 text-slate-100">Settings (Stores · AI · SQL)</option>
                      </optgroup>
                    </>
                  ) : currentUser?.Role === 'Moderator' ? (
                    <>
                      <option value="purchases" className="bg-slate-900 text-slate-100">Purchase Dashboard</option>
                      <option value="store" className="bg-slate-900 text-slate-100">Store</option>
                      <option value="pos" className="bg-slate-900 text-slate-100">Fast POS Terminal</option>
                      <option value="liveStock" className="bg-slate-900 text-slate-100">Live Stock</option>
                      <option value="settings" className="bg-slate-900 text-slate-100">Settings</option>
                    </>
                  ) : (
                    <>
                      <option value="pos" className="bg-slate-900 text-slate-100">Fast POS Terminal</option>
                      <option value="liveStock" className="bg-slate-900 text-slate-100">Live Stock</option>
                    </>
                  )}
                </select>
              </div>
            </>
          )}
        </div>

        {/* Right side: User Role Switcher & Hardware Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenShortcutsHelp}
            className="flex items-center gap-1 px-2 py-1 text-[11px] rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
            title="View POS keyboard navigation shortcuts (F1-F4, Enter)"
          >
            <Keyboard className="w-3 h-3 text-slate-400" />
            <span>Hotkeys</span>
          </button>

          {/* Multi-Theme Quick Selector */}
          <div
            className="flex items-center gap-1.5 px-2 py-1 text-[11px] rounded bg-slate-800 border border-slate-700/60"
            title="Switch application theme instantly or open Settings -> Themes & Layout"
          >
            <button
              type="button"
              onClick={() => {
                if (onOpenThemeSettings) {
                  onOpenThemeSettings();
                }
              }}
              className="text-emerald-400 hover:opacity-80 flex items-center cursor-pointer"
              title="Open Themes & Classic Layout Studio in Settings"
            >
              <Palette className="w-3.5 h-3.5" />
            </button>
            <select
              value={theme}
              onChange={(e) => {
                const nextTheme = e.target.value as ThemeType;
                setTheme(nextTheme);
                const def = THEME_CATALOG.find((t) => t.id === nextTheme);
                showToast(
                  `Applied ${def?.name || nextTheme} across the entire workspace.`,
                  'info',
                  'Theme Switched'
                );
              }}
              className="bg-transparent text-slate-200 font-semibold text-[11px] border-none outline-none cursor-pointer"
            >
              {THEME_CATALOG.map((t) => (
                <option key={t.id} value={t.id} className="bg-slate-900 text-slate-100">
                  {t.shortLabel}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={onOpenReceiptSettings}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors border border-slate-700/60 cursor-pointer"
            title="Configure Rongta Thermal Printer, Native Serial/USB/TCP & Receipt Template"
          >
            <Printer className="w-3.5 h-3.5 text-emerald-400" />
            <span>Rongta Printer</span>
          </button>

          {!isElectron && (
            <a
              href="/api/download-zip"
              download="pharmacore-pos.zip"
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-xs"
              title="Download full standalone Electron desktop project, .sql file, and launchers as a .ZIP archive"
            >
              <Download className="w-3 h-3" />
              <span>Download Desktop .ZIP</span>
            </a>
          )}

          <div className="h-4 w-px bg-slate-700" />

          {/* Current User & Role Switcher */}
          <div className="flex items-center gap-2 bg-slate-800/80 px-2.5 py-1 rounded border border-slate-700/60">
            {currentUser?.Role === 'Admin' ? (
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            ) : currentUser?.Role === 'Moderator' ? (
              <UserCheck className="w-3.5 h-3.5 text-sky-400" />
            ) : (
              <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <div className="text-left">
              <span className="font-semibold text-slate-200 block text-[11px] leading-tight">
                {currentUser?.FullName || 'User'}
              </span>
              <span className="text-[10px] text-slate-400 leading-tight">
                Role:{' '}
                <strong
                  className={
                    currentUser?.Role === 'Admin'
                      ? 'text-indigo-300 font-semibold'
                      : currentUser?.Role === 'Moderator'
                      ? 'text-sky-300 font-semibold'
                      : 'text-emerald-300 font-semibold'
                  }
                >
                  {currentUser?.Role}
                </strong>
              </span>
            </div>

            <select
              value={currentUser?.Role || 'Salesman'}
              onChange={(e) => switchUser(e.target.value as any)}
              className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 border-none outline-none cursor-pointer"
              title="Quickly switch role to test access boundaries"
            >
              <option value="Admin">Admin (Full)</option>
              <option value="Moderator">Moderator (Branch Mgr)</option>
              <option value="Salesman">Salesman (POS & Live Stock)</option>
            </select>
          </div>

          <button
            onClick={() => {
              askConfirm({
                title: 'Confirm Terminal Log Out',
                message: 'Are you sure you want to log out from this pharmacy terminal session?',
                confirmLabel: 'Log Out',
                cancelLabel: 'Stay Logged In',
                isDestructive: true,
                onConfirm: () => {
                  logout();
                  showToast('Session ended. Please log in to continue.', 'info', 'Logged Out');
                },
              });
            }}
            className="flex items-center gap-1 px-2 py-1 text-[11px] rounded bg-rose-950/50 hover:bg-rose-900/70 border border-rose-800/60 text-rose-300 transition-colors cursor-pointer"
            title="Log out and return to Login Screen"
          >
            <span>Log Out</span>
          </button>

          <div className="text-slate-400 font-mono text-[11px] flex items-center gap-1 pl-1">
            <Clock className="w-3 h-3 text-slate-500" />
            <span>{currentTime}</span>
          </div>

          {/* Compact Window Controls when Simple Layout hides the top title bar in Electron */}
          {isElectron && layoutStyle === 'simple' && (
            <div className="flex items-center gap-1 pl-2 border-l border-slate-700">
              <button
                type="button"
                onClick={handleMinimize}
                title="Minimize"
                className="w-6 h-5 flex items-center justify-center text-slate-400 hover:bg-slate-800 hover:text-slate-200 rounded cursor-pointer"
              >
                <Minus className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={handleToggleMaximize}
                title="Maximize / Restore"
                className="w-6 h-5 flex items-center justify-center text-slate-400 hover:bg-slate-800 hover:text-slate-200 rounded cursor-pointer"
              >
                {isMaximized ? <Copy className="w-2.5 h-2.5" /> : <Square className="w-2.5 h-2.5" />}
              </button>
              <button
                type="button"
                onClick={handleCloseWindow}
                title="Close Application"
                className="w-6 h-5 flex items-center justify-center text-slate-400 hover:bg-rose-600 hover:text-white rounded cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
