/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Regional Store & Inventory Report Dashboard ("Report")
 * 1) All Stored Medicine with Supplier Tree & Group
 * 2) Store Toggle Compliance & Accountability Audit Log
 * 3) Logistics & Reporting Software Data Synchronization Hub (JSON / CSV / SQL)
 */

import React, { useState, useMemo } from 'react';
import { usePharmacy } from '../../context/PharmacyContext';
import { StoreMedicinePage } from './StoreMedicinePage';
import {
  FolderTree,
  ShieldCheck,
  Share2,
  Download,
  Copy,
  Check,
  Search,
  Settings,
  Database,
  FileSpreadsheet,
  FileJson,
} from 'lucide-react';

interface StoreReportDashboardProps {
  onOpenStoreSettings: () => void;
}

export const StoreReportDashboard: React.FC<StoreReportDashboardProps> = ({
  onOpenStoreSettings,
}) => {
  const {
    stores,
    storeStocks,
    storeTransactions,
    storeToggleLogs,
    batches,
    formatCurrency,
    showToast,
    recordLogisticsSyncExport,
  } = usePharmacy();

  const [activeTab, setActiveTab] = useState<'supplier-tree' | 'toggle-audit' | 'logistics-sync'>(
    'supplier-tree'
  );
  const [auditSearch, setAuditSearch] = useState('');
  const [auditStoreFilter, setAuditStoreFilter] = useState('ALL');
  const [copiedPayload, setCopiedPayload] = useState(false);

  // Dormant (switched-off) store stock reconciliation summary for 100% system-wide consistency
  const dormantSummary = useMemo(() => {
    const dormantStores = stores.filter((s) => !s.IsActive);
    if (dormantStores.length === 0) return null;
    const dormantIds = new Set(dormantStores.map((s) => s.StoreID));
    const items = storeStocks.filter((st) => dormantIds.has(st.StoreID) && st.Quantity > 0);
    const units = items.reduce((s, i) => s + i.Quantity, 0);
    const valuation = items.reduce((s, i) => s + i.Quantity * i.CostPrice, 0);
    return {
      storeNames: dormantStores.map((s) => s.ShortName).join(', '),
      units,
      valuation: Math.round(valuation * 100) / 100,
    };
  }, [stores, storeStocks]);

  const filteredToggleLogs = useMemo(() => {
    return storeToggleLogs.filter((entry) => {
      if (auditStoreFilter !== 'ALL' && entry.StoreID !== auditStoreFilter) return false;
      if (auditSearch.trim()) {
        const q = auditSearch.toLowerCase();
        return (
          entry.StoreName.toLowerCase().includes(q) ||
          entry.StoreCode.toLowerCase().includes(q) ||
          entry.Region.toLowerCase().includes(q) ||
          entry.ChangedByName.toLowerCase().includes(q) ||
          entry.Reason.toLowerCase().includes(q) ||
          entry.ToggleID.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [storeToggleLogs, auditStoreFilter, auditSearch]);

  // Real Logistics & ERP Synchronization Manifest
  const logisticsSyncManifest = useMemo(() => {
    const mainPosUnits = batches.reduce((s, b) => s + Math.max(0, b.CurrentStock), 0);
    const activeWarehouseUnits = storeStocks
      .filter((st) => stores.find((s) => s.StoreID === st.StoreID)?.IsActive)
      .reduce((s, st) => s + Math.max(0, st.Quantity), 0);
    const dormantWarehouseUnits = storeStocks
      .filter((st) => !stores.find((s) => s.StoreID === st.StoreID)?.IsActive)
      .reduce((s, st) => s + Math.max(0, st.Quantity), 0);

    return {
      schema: 'pharmacore.logistics.wms.sync.v2',
      generatedAt: new Date().toISOString(),
      organization: 'Fatema Pharmacy · Regional Warehouse Network',
      consistencyChecksum: {
        mainPosCounterUnits: mainPosUnits,
        activeRegionalStoreUnits: activeWarehouseUnits,
        dormantLockedStoreUnits: dormantWarehouseUnits,
        totalEnterpriseUnits: mainPosUnits + activeWarehouseUnits + dormantWarehouseUnits,
      },
      warehouses: stores.map((st) => {
        const rows = storeStocks.filter((r) => r.StoreID === st.StoreID && r.Quantity > 0);
        return {
          storeId: st.StoreID,
          code: st.Code,
          shortName: st.ShortName,
          name: st.Name,
          region: st.Region,
          branchManager: st.BranchManager,
          managerPhone: st.ManagerPhone,
          isActive: st.IsActive,
          operationalState: st.IsActive ? 'ONLINE_TRANSACTING' : 'OFFLINE_HIDDEN_LOCKED',
          lastToggledAt: st.LastToggledAt,
          lastToggledBy: st.LastToggledBy,
          batchCount: rows.length,
          totalUnits: rows.reduce((s, i) => s + i.Quantity, 0),
          costValuation:
            Math.round(rows.reduce((s, i) => s + i.Quantity * i.CostPrice, 0) * 100) / 100,
        };
      }),
      storedMedicines: storeStocks.filter((st) => st.Quantity > 0),
      recentStoreTransactions: storeTransactions.slice(0, 50),
      complianceToggleAuditTrail: storeToggleLogs,
    };
  }, [stores, storeStocks, storeTransactions, storeToggleLogs, batches]);

  const handleDownloadJsonSync = () => {
    const json = JSON.stringify(logisticsSyncManifest, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pharmacore_logistics_erp_sync_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    recordLogisticsSyncExport(
      'JSON',
      `Downloaded Logistics & ERP Sync Manifest (${logisticsSyncManifest.storedMedicines.length} batches, ${storeTransactions.length} transactions)`
    );
    showToast('Downloaded JSON Logistics & ERP Sync Manifest.', 'success', 'Sync Manifest Ready');
  };

  const handleDownloadAuditCsv = () => {
    const headers = [
      'ToggleID',
      'Timestamp',
      'StoreCode',
      'StoreName',
      'Region',
      'PreviousState',
      'NewState',
      'Administrator',
      'Role',
      'StockUnitsSnapshot',
      'ValuationSnapshot',
      'ComplianceReason',
    ];
    const rows = filteredToggleLogs.map((l) =>
      [
        `"${l.ToggleID}"`,
        `"${l.Timestamp}"`,
        `"${l.StoreCode}"`,
        `"${l.StoreName}"`,
        `"${l.Region}"`,
        l.PreviousState ? 'ON' : 'OFF',
        l.NewState ? 'ON' : 'OFF',
        `"${l.ChangedByName}"`,
        `"${l.ChangedByRole}"`,
        l.StockUnitsSnapshot,
        l.ValuationSnapshot.toFixed(2),
        `"${l.Reason.replace(/"/g, '""')}"`,
      ].join(',')
    );

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `store_toggle_compliance_audit_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    recordLogisticsSyncExport('CSV', `Exported ${filteredToggleLogs.length} Store Toggle Audit records`);
    showToast('Exported Store Toggle Audit Log to CSV.', 'success', 'Compliance CSV Downloaded');
  };

  const handleDownloadSqlSync = () => {
    const lines: string[] = [
      '-- PharmaCore Regional Warehouse & Logistics Sync Script (T-SQL)',
      `-- Generated: ${new Date().toISOString()}`,
      'USE [PharmaCoreDB];',
      'GO',
      '',
    ];
    stores.forEach((s) => {
      lines.push(
        `UPDATE [dbo].[WarehouseStores] SET [IsActive] = ${s.IsActive ? 1 : 0}, [BranchManager] = N'${s.BranchManager.replace(/'/g, "''")}' WHERE [StoreID] = '${s.StoreID}';`
      );
    });
    const sqlText = lines.join('\n');
    const blob = new Blob([sqlText], { type: 'application/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pharmacore_warehouse_sync_${new Date().toISOString().slice(0, 10)}.sql`;
    a.click();
    URL.revokeObjectURL(url);

    recordLogisticsSyncExport('SQL', 'Exported T-SQL Regional Store State Synchronization Script');
    showToast('Downloaded T-SQL Warehouse Sync Script.', 'success', 'SQL Sync Ready');
  };

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(logisticsSyncManifest, null, 2));
      setCopiedPayload(true);
      recordLogisticsSyncExport('JSON', 'Copied JSON Logistics Sync payload to clipboard');
      showToast('Logistics JSON sync payload copied to clipboard.', 'success', 'Copied');
      setTimeout(() => setCopiedPayload(false), 2000);
    } catch {
      showToast('Unable to access clipboard in current browser context.', 'warning', 'Clipboard');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-900 overflow-hidden select-none">
      {/* Top Report Header & View Tabs */}
      <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <FolderTree className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-bold text-white whitespace-nowrap">
            Stored Medicine & Warehouse Compliance Reports
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setActiveTab('supplier-tree')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'supplier-tree'
                  ? 'bg-emerald-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FolderTree className="w-3.5 h-3.5" />
              <span>Stored Medicine · Supplier Tree</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('toggle-audit')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'toggle-audit'
                  ? 'bg-emerald-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Store Toggle Audit ({storeToggleLogs.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('logistics-sync')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'logistics-sync'
                  ? 'bg-emerald-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Logistics & ERP Sync</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onOpenStoreSettings}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5 text-sky-400" />
            <span>Store Settings</span>
          </button>
        </div>
      </div>

      {/* Dormant Store Accounting Consistency Banner (when any store is OFF) */}
      {dormantSummary && (
        <div className="px-4 py-2 bg-amber-950/50 border-b border-amber-800/50 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-200 shrink-0">
          <span>
            Inventory Consistency Notice: <strong>{dormantSummary.storeNames}</strong> switched OFF —{' '}
            <strong className="font-mono tabular-nums">{dormantSummary.units} units</strong> (
            <strong className="font-mono tabular-nums">
              {formatCurrency(dormantSummary.valuation)}
            </strong>
            ) remain safely preserved in dormant custody and excluded from active dispatch.
          </span>
          <button
            type="button"
            onClick={onOpenStoreSettings}
            className="text-amber-300 hover:underline font-semibold whitespace-nowrap cursor-pointer"
          >
            Manage in Settings →
          </button>
        </div>
      )}

      {/* TAB 1: STORED MEDICINE WITH SUPPLIER TREE & GROUP */}
      {activeTab === 'supplier-tree' && (
        <StoreMedicinePage scope="all_active_stores" />
      )}

      {/* TAB 2: STORE TOGGLE COMPLIANCE AUDIT LOG */}
      {activeTab === 'toggle-audit' && (
        <div className="flex-1 flex flex-col overflow-hidden p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950 border border-slate-800 rounded-lg p-3 shrink-0">
            <div className="flex items-center gap-2.5 flex-1 min-w-[240px]">
              <div className="relative flex-1 max-w-md">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  placeholder="Search administrator, store, region, or compliance reason..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <select
                value={auditStoreFilter}
                onChange={(e) => setAuditStoreFilter(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="ALL">All 3 Regional Stores</option>
                {stores.map((s) => (
                  <option key={s.StoreID} value={s.StoreID}>
                    {s.ShortName} ({s.Code})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleDownloadAuditCsv}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Compliance Log (CSV)</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto border border-slate-800 rounded-lg bg-slate-950">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-[11px] font-semibold text-slate-400">
                <tr>
                  <th className="py-2.5 px-3">Audit ID</th>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Regional Store</th>
                  <th className="py-2.5 px-3">State Transition</th>
                  <th className="py-2.5 px-3">Administrator</th>
                  <th className="py-2.5 px-3 text-right">Stock Snapshot</th>
                  <th className="py-2.5 px-3 text-right">Valuation Snapshot</th>
                  <th className="py-2.5 px-3">Compliance Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredToggleLogs.map((log) => (
                  <tr key={log.ToggleID} className="hover:bg-slate-900/60">
                    <td className="py-2.5 px-3 font-mono tabular-nums font-semibold text-slate-200">
                      {log.ToggleID}
                    </td>
                    <td className="py-2.5 px-3 font-mono tabular-nums text-[11px] text-slate-400">
                      {new Date(log.Timestamp).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-white">{log.StoreName}</div>
                      <div className="text-[11px] text-slate-400">
                        {log.StoreCode} · {log.Region}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px]">
                      <span className="text-slate-400">{log.PreviousState ? 'ON' : 'OFF'}</span>
                      <span className="mx-1.5 text-slate-500">→</span>
                      <strong className={log.NewState ? 'text-emerald-400' : 'text-rose-400'}>
                        {log.NewState ? 'ON (Active)' : 'OFF (Hidden)'}
                      </strong>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="text-slate-200 font-medium">{log.ChangedByName}</div>
                      <div className="text-[11px] text-indigo-400">{log.ChangedByRole}</div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-white font-semibold">
                      {log.StockUnitsSnapshot} units
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-400 font-semibold">
                      {formatCurrency(log.ValuationSnapshot)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 max-w-xs">{log.Reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: LOGISTICS & REPORTING SOFTWARE DATA SYNCHRONIZATION */}
      {activeTab === 'logistics-sync' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Enterprise Consistency Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5">
              <span className="text-[11px] text-slate-400 block">Main POS Counter Stock</span>
              <span className="mt-1 block font-mono tabular-nums text-xl font-bold text-white">
                {logisticsSyncManifest.consistencyChecksum.mainPosCounterUnits.toLocaleString()} units
              </span>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5">
              <span className="text-[11px] text-slate-400 block">Active Regional Warehouses</span>
              <span className="mt-1 block font-mono tabular-nums text-xl font-bold text-emerald-400">
                {logisticsSyncManifest.consistencyChecksum.activeRegionalStoreUnits.toLocaleString()} units
              </span>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5">
              <span className="text-[11px] text-slate-400 block">Dormant / Locked Stores</span>
              <span className="mt-1 block font-mono tabular-nums text-xl font-bold text-amber-400">
                {logisticsSyncManifest.consistencyChecksum.dormantLockedStoreUnits.toLocaleString()} units
              </span>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5">
              <span className="text-[11px] text-slate-400 block">Total Organization Inventory</span>
              <span className="mt-1 block font-mono tabular-nums text-xl font-bold text-sky-400">
                {logisticsSyncManifest.consistencyChecksum.totalEnterpriseUnits.toLocaleString()} units
              </span>
            </div>
          </div>

          {/* Export Adapters */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 flex flex-col justify-between space-y-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-white font-semibold text-xs">
                  <FileJson className="w-4 h-4 text-emerald-400" />
                  <span>JSON Logistics & WMS Sync Payload</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Complete structured payload containing regional store states, stored medicine batches, transaction vouchers, and toggle compliance logs for REST/EDI logistics connectors.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadJsonSync}
                  className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .JSON</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyJson}
                  className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedPayload ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedPayload ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 flex flex-col justify-between space-y-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-white font-semibold text-xs">
                  <FileSpreadsheet className="w-4 h-4 text-sky-400" />
                  <span>Compliance & Accountability Ledger (CSV)</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Spreadsheet-ready audit feed of every regional warehouse ON/OFF switch event with stock & financial snapshots for BI and compliance software.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadAuditCsv}
                className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-sky-400" />
                <span>Download Compliance .CSV</span>
              </button>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 flex flex-col justify-between space-y-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-white font-semibold text-xs">
                  <Database className="w-4 h-4 text-indigo-400" />
                  <span>SQL Server 2008 R2 Sync Script (.SQL)</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Transact-SQL synchronization statements updating regional warehouse operational states and branch manager assignments on central SQL Server instances.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadSqlSync}
                className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-indigo-400" />
                <span>Download T-SQL Sync</span>
              </button>
            </div>
          </div>

          {/* Live JSON Schema Preview */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200">
                Live Synchronization Manifest Preview ({logisticsSyncManifest.schema})
              </span>
              <span className="font-mono text-[11px] text-slate-400">
                {logisticsSyncManifest.warehouses.length} stores ·{' '}
                {logisticsSyncManifest.storedMedicines.length} batch records
              </span>
            </div>
            <pre className="p-4 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-72">
              {JSON.stringify(
                {
                  schema: logisticsSyncManifest.schema,
                  generatedAt: logisticsSyncManifest.generatedAt,
                  consistencyChecksum: logisticsSyncManifest.consistencyChecksum,
                  warehouses: logisticsSyncManifest.warehouses,
                },
                null,
                2
              )}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
