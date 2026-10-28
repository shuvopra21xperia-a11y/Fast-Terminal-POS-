/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Module H: Native SQL Server (192.168.0.13) Connection Engine, Daily .bak Backup & Audit Trail
 * Uses backend native Node `mssql` (TDS) driver to communicate directly with 192.168.0.13:1433
 */

import React, { useState, useEffect } from 'react';
import { usePharmacy } from '../../context/PharmacyContext';
import { SQL_SERVER_2008_SCHEMA, generateSqlBackupContent } from '../../utils/sqlScriptGenerator';
import {
  Database,
  Download,
  RotateCcw,
  Server,
  FileCode,
  Play,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Archive,
  RefreshCw,
  UploadCloud,
} from 'lucide-react';

export const DatabaseBackupConsole: React.FC = () => {
  const {
    currentUser,
    auditLogs,
    resetDatabaseToSeed,
    medicines,
    batches,
    suppliers,
    customers,
    sales,
    purchases,
    expireVault,
    stores,
    storeStocks,
    storeTransactions,
    storeToggleLogs,
    addAuditLog,
    showToast,
    askConfirm,
  } = usePharmacy();

  const [activeTab, setActiveTab] = useState<'backup' | 'schema' | 'query' | 'audit'>('backup');
  const [dbConfig, setDbConfig] = useState<{
    server: string;
    database: string;
    user: string;
    password: string;
    port: string;
    appPort: string;
    ollamaPort: string;
    connected: boolean;
    tcpReachable?: boolean;
    status: string;
  }>({
    server: '192.168.0.13',
    database: 'PharmaCoreDB',
    user: 'sa',
    password: '',
    port: '1433',
    appPort: '3000',
    ollamaPort: '11434',
    connected: false,
    status: 'Checking SQL Server 192.168.0.13:1433...',
  });

  const [connectionTesting, setConnectionTesting] = useState(false);
  const [isSyncingSql, setIsSyncingSql] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  // SQL Query console state
  const [sqlQuery, setSqlQuery] = useState<string>(
    'SELECT TOP 10 MedicineID, TradeName, GenericName, RackNo, Unit FROM [dbo].[Medicines];'
  );
  const [queryRunning, setQueryRunning] = useState(false);
  const [querySource, setQuerySource] = useState<string>('Local POS Dataset');
  const [queryResult, setQueryResult] = useState<any[] | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/system-info').then((r) => r.json()).catch(() => null),
      fetch('/api/db-status').then((r) => r.json()).catch(() => null),
    ]).then(([sys, db]) => {
      setDbConfig((prev) => ({
        ...prev,
        server: db?.server || sys?.dbServer || '192.168.0.13',
        database: db?.database || sys?.dbName || 'PharmaCoreDB',
        user: db?.user || sys?.dbUser || 'sa',
        port: String(db?.port || sys?.dbPort || '1433'),
        appPort: String(sys?.appPort || db?.appPort || '3000'),
        ollamaPort: String(sys?.ollamaPort || '11434'),
        connected: Boolean(db?.connected),
        tcpReachable: Boolean(db?.tcpReachable),
        status: db?.status || 'Local POS Ledger Ready',
      }));
    });
  }, []);

  const handleSaveAndTestSqlServer = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setConnectionTesting(true);
    setConnectionResult(null);

    try {
      const res = await fetch('/api/db/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          server: dbConfig.server.trim() || '192.168.0.13',
          port: dbConfig.port.trim() || '1433',
          database: dbConfig.database.trim() || 'PharmaCoreDB',
          user: dbConfig.user.trim() || 'sa',
          password: dbConfig.password,
        }),
      });
      const data = await res.json();
      setDbConfig((prev) => ({
        ...prev,
        connected: Boolean(data.connected),
        tcpReachable: Boolean(data.tcpReachable),
        status: data.message || prev.status,
      }));
      setConnectionResult({
        ok: Boolean(data.connected),
        text: data.message || 'SQL Server configuration updated.',
      });
      showToast(
        data.message || 'SQL Server configuration saved.',
        data.connected ? 'success' : 'info',
        data.connected ? 'SQL Server Connected' : 'Config Saved'
      );
    } catch (err: any) {
      setConnectionResult({
        ok: false,
        text: err?.message || 'Could not reach backend SQL Server bridge.',
      });
    } finally {
      setConnectionTesting(false);
    }
  };

  const handleSyncToSqlServer = async () => {
    setIsSyncingSql(true);
    try {
      const res = await fetch('/api/db/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          syncedBy: currentUser?.FullName || 'Admin',
          medicines,
          batches,
          suppliers,
          customers,
          sales,
          purchases,
          stores,
          storeStocks,
        }),
      });
      const data = await res.json();
      if (data?.success) {
        addAuditLog(
          'SYSTEM_BACKUP',
          `Synchronized POS ledger directly to SQL Server ${dbConfig.server} [${dbConfig.database}].`
        );
        showToast(data.message, 'success', 'SQL Server Sync Complete');
        setConnectionResult({ ok: true, text: data.message });
      } else {
        showToast(
          data?.error || `Cannot reach SQL Server ${dbConfig.server}:${dbConfig.port}`,
          'warning',
          'SQL Sync Notice'
        );
        setConnectionResult({
          ok: false,
          text: data?.error || `Cannot reach ${dbConfig.server}:${dbConfig.port}`,
        });
      }
    } catch (err: any) {
      showToast(err?.message || 'SQL sync request failed.', 'error', 'Sync Error');
    } finally {
      setIsSyncingSql(false);
    }
  };

  const [copied, setCopied] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'info' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleDownloadMasterSql = () => {
    const link = document.createElement('a');
    link.href = '/api/download-sql';
    link.download = 'pharmacore_database_setup.sql';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addAuditLog('SYSTEM_BACKUP', 'Downloaded standalone SQL Server 2008 R2 setup file (pharmacore_database_setup.sql).');
    showNotification('pharmacore_database_setup.sql downloaded. Run in SSMS on 192.168.0.13 to initialize schema.');
  };

  const handleCopySchema = () => {
    navigator.clipboard.writeText(SQL_SERVER_2008_SCHEMA);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    showNotification('SQL Server 2008 R2 DDL script copied to clipboard.');
  };

  const handleDownloadBackup = () => {
    const fullState = {
      medicines,
      batches,
      suppliers,
      customers,
      sales,
      purchases,
      expireVault,
      stores,
      storeStocks,
      storeTransactions,
      storeToggleLogs,
    };

    const sql = generateSqlBackupContent(fullState);
    const blob = new Blob([sql], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `PharmaCoreDB_Backup_${new Date().toISOString().split('T')[0]}.bak.sql`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    addAuditLog('SYSTEM_BACKUP', 'Generated full SQL Server .bak database backup script including Regional Stores.');
    showNotification('Daily Database Backup file generated and downloaded successfully.');
  };

  const handleRunQuery = async () => {
    setQueryRunning(true);
    try {
      const res = await fetch('/api/db/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: sqlQuery }),
      });
      const data = await res.json();
      if (data?.success && data?.connected) {
        setQuerySource(`Live SQL Server ${data.server} [${data.database}] (${data.latencyMs}ms)`);
        setQueryResult(data.rows || []);
        setQueryRunning(false);
        return;
      }
    } catch {
      // Fall back to local POS dataset below when 192.168.0.13 is unreachable
    }

    setQuerySource(`Offline Local POS Cache (${dbConfig.server} unreachable on current network)`);
    const q = sqlQuery.toLowerCase();
    if (q.includes('warehousestores')) {
      setQueryResult(stores);
    } else if (q.includes('storestocks')) {
      setQueryResult(storeStocks.slice(0, 15));
    } else if (q.includes('storetransactions')) {
      setQueryResult(storeTransactions.slice(0, 15));
    } else if (q.includes('storetoggleauditlogs')) {
      setQueryResult(storeToggleLogs.slice(0, 15));
    } else if (q.includes('medicines')) {
      setQueryResult(medicines.slice(0, 10));
    } else if (q.includes('batches')) {
      setQueryResult(batches.slice(0, 10));
    } else if (q.includes('expirevault')) {
      setQueryResult(expireVault.slice(0, 10));
    } else if (q.includes('sales')) {
      setQueryResult(sales.slice(0, 10));
    } else {
      setQueryResult(medicines.slice(0, 10));
    }
    setQueryRunning(false);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-900 select-none">
      {/* Title Bar */}
      <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white tracking-tight">
              Native SQL Server ({dbConfig.server}) &amp; Automated Backup Engine
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Direct Node.js <code className="font-mono text-emerald-400">mssql</code> TDS socket connection to {dbConfig.server}:{dbConfig.port}, live sync, .bak export, and audit trails.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded border border-slate-800 text-xs shrink-0">
          <button
            onClick={() => setActiveTab('backup')}
            className={`px-3 py-1.5 rounded transition-colors cursor-pointer ${
              activeTab === 'backup'
                ? 'bg-emerald-600 text-white font-medium'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            SQL 192.168.0.13 &amp; Backup
          </button>
          <button
            onClick={() => setActiveTab('schema')}
            className={`px-3 py-1.5 rounded transition-colors cursor-pointer ${
              activeTab === 'schema'
                ? 'bg-emerald-600 text-white font-medium'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            SQL Server 2008 DDL
          </button>
          <button
            onClick={() => setActiveTab('query')}
            className={`px-3 py-1.5 rounded transition-colors cursor-pointer ${
              activeTab === 'query'
                ? 'bg-emerald-600 text-white font-medium'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            T-SQL Query Console
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-1.5 rounded transition-colors cursor-pointer ${
              activeTab === 'audit'
                ? 'bg-emerald-600 text-white font-medium'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Audit Trail ({auditLogs.length})
          </button>
        </div>
      </div>

      {notification && (
        <div className="px-4 py-2 bg-emerald-950/80 border-b border-emerald-700/60 text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-emerald-400 hover:text-emerald-200 text-xs font-bold px-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {activeTab === 'backup' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* Native SQL Server 192.168.0.13 Connection & Live Sync Card */}
          <form
            onSubmit={handleSaveAndTestSqlServer}
            className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-emerald-400" />
                <div>
                  <h3 className="font-semibold text-white text-sm">
                    Native SQL Server TDS Connection (Target: 192.168.0.13)
                  </h3>
                  <p className="text-[11px] text-slate-400">{dbConfig.status}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-1 rounded font-mono text-[11px] font-semibold border ${
                    dbConfig.connected
                      ? 'bg-emerald-950/70 text-emerald-300 border-emerald-700/70'
                      : 'bg-slate-900 text-sky-300 border-slate-700'
                  }`}
                >
                  {dbConfig.connected ? 'CONNECTED · LIVE TDS' : 'LOCAL LEDGER · READY FOR LAN'}
                </span>

                <button
                  type="submit"
                  disabled={connectionTesting}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${connectionTesting ? 'animate-spin' : ''}`} />
                  <span>{connectionTesting ? 'Connecting...' : 'Save & Connect'}</span>
                </button>

                <button
                  type="button"
                  disabled={isSyncingSql}
                  onClick={handleSyncToSqlServer}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  title="Push current medicines, batches, stores, and sales directly into SQL Server 192.168.0.13"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>{isSyncingSql ? 'Syncing...' : `Sync to ${dbConfig.server}`}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div>
                <label className="block text-[10.5px] text-slate-400 mb-1">
                  SQL Server IP / Host (DB_SERVER)
                </label>
                <input
                  type="text"
                  value={dbConfig.server}
                  onChange={(e) => setDbConfig({ ...dbConfig, server: e.target.value })}
                  placeholder="192.168.0.13"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10.5px] text-slate-400 mb-1">
                  TCP Port (DB_PORT)
                </label>
                <input
                  type="text"
                  value={dbConfig.port}
                  onChange={(e) => setDbConfig({ ...dbConfig, port: e.target.value })}
                  placeholder="1433"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10.5px] text-slate-400 mb-1">
                  Database Name (DB_NAME)
                </label>
                <input
                  type="text"
                  value={dbConfig.database}
                  onChange={(e) => setDbConfig({ ...dbConfig, database: e.target.value })}
                  placeholder="PharmaCoreDB"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10.5px] text-slate-400 mb-1">
                  SQL Login User (DB_USER)
                </label>
                <input
                  type="text"
                  value={dbConfig.user}
                  onChange={(e) => setDbConfig({ ...dbConfig, user: e.target.value })}
                  placeholder="sa"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10.5px] text-slate-400 mb-1">
                  SQL Password (DB_PASSWORD)
                </label>
                <input
                  type="password"
                  value={dbConfig.password}
                  onChange={(e) => setDbConfig({ ...dbConfig, password: e.target.value })}
                  placeholder="Enter sa password..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {connectionResult && (
              <div
                className={`p-2.5 rounded-lg border flex items-center gap-2 ${
                  connectionResult.ok
                    ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-300'
                    : 'bg-amber-950/50 border-amber-800/60 text-amber-200'
                }`}
              >
                {connectionResult.ok ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                )}
                <span className="font-sans text-[11px]">{connectionResult.text}</span>
              </div>
            )}
          </form>

          {/* Master SQL File & Backup Engine */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-semibold text-white text-sm">
                <FileCode className="w-4 h-4 text-emerald-400" />
                <span>Master SQL Server Setup &amp; Standalone Archive</span>
              </div>
              <p className="text-slate-400 text-xs leading-normal">
                Complete Transact-SQL setup script for Microsoft SQL Server (<code className="text-emerald-400 font-mono">192.168.0.13</code>). Creates <code className="text-emerald-400 font-mono">[PharmaCoreDB]</code>, all tables, FEFO indexes, stored procedures, and seed records.
              </p>

              <div className="flex flex-wrap gap-2 pt-1">
                <a
                  href="/api/download-zip"
                  download="pharmacore-pos.zip"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg flex items-center gap-2 shadow-sm transition-colors text-xs cursor-pointer"
                >
                  <Archive className="w-4 h-4" />
                  <span>Download Desktop Project (.ZIP)</span>
                </a>

                <button
                  onClick={handleDownloadMasterSql}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg flex items-center gap-2 shadow-sm transition-colors text-xs cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download pharmacore_database_setup.sql</span>
                </button>

                <button
                  onClick={handleDownloadBackup}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg flex items-center gap-2 text-xs transition-colors cursor-pointer"
                >
                  <Database className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Export Live Snapshot (.bak.sql)</span>
                </button>
              </div>
            </div>

            {/* Reset / Restore from seed */}
            <div className="p-3.5 bg-slate-900/60 rounded-lg border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-rose-400">
                <RotateCcw className="w-4 h-4" />
                <span>Database Reset &amp; Seed Restoration</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-normal">
                Restores the local ledger to initial clean seed state (admin, moderator, salesman accounts, pharmaceutical profiles, suppliers, batches, and regional store balances).
              </p>
              <button
                onClick={() => {
                  askConfirm({
                    title: 'Reset Database to Seed State',
                    message:
                      'Are you sure you want to restore the database to the initial clean seed state? All current sales, purchases, batches, and ledger transactions will be reset.',
                    confirmLabel: 'Reset Database',
                    cancelLabel: 'Cancel',
                    isDestructive: true,
                    onConfirm: () => {
                      resetDatabaseToSeed();
                      showToast(
                        'Database has been successfully restored to initial seed state.',
                        'success',
                        'Database Reset'
                      );
                      showNotification('Database has been successfully restored to initial seed state.');
                    },
                  });
                }}
                className="px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 text-rose-300 rounded-lg font-medium text-xs transition-colors cursor-pointer"
              >
                Reset Database to Seed State
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'schema' && (
        <div className="flex-1 flex flex-col overflow-hidden p-4">
          <div className="flex items-center justify-between pb-2 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span>Microsoft SQL Server 2008 R2+ Compatible DDL (Transact-SQL)</span>
              <span className="font-mono text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800/40">
                Host: {dbConfig.server}:{dbConfig.port}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopySchema}
                className="flex items-center gap-1.5 px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs transition-colors cursor-pointer"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                )}
                <span>{copied ? 'Copied to Clipboard!' : 'Copy T-SQL Script'}</span>
              </button>

              <button
                onClick={handleDownloadMasterSql}
                className="flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-xs transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .SQL File</span>
              </button>
            </div>
          </div>
          <pre className="flex-1 bg-slate-950 p-4 border border-slate-800 rounded font-mono text-[11px] text-slate-300 overflow-y-auto leading-relaxed select-text">
            {SQL_SERVER_2008_SCHEMA}
          </pre>
        </div>
      )}

      {activeTab === 'query' && (
        <div className="flex-1 flex flex-col overflow-hidden p-4 space-y-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              Interactive Transact-SQL Query Runner (Target: {dbConfig.server}:{dbConfig.port})
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={sqlQuery}
                onChange={(e) => setSqlQuery(e.target.value)}
                placeholder="SELECT TOP 10 * FROM [dbo].[Medicines];"
                className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 font-mono text-xs text-white focus:outline-hidden focus:border-emerald-500"
              />
              <button
                onClick={handleRunQuery}
                disabled={queryRunning}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5" />
                <span>{queryRunning ? 'Executing...' : 'Execute (F5)'}</span>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-slate-950 border border-slate-800 rounded p-3">
            <span className="text-[11px] font-mono text-slate-400 block pb-2">
              Source: {querySource}
            </span>
            <pre className="font-mono text-[11px] text-emerald-300 overflow-x-auto select-text">
              {JSON.stringify(queryResult || medicines.slice(0, 5), null, 2)}
            </pre>
          </div>
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="bg-slate-950 border border-slate-800 rounded overflow-hidden text-xs">
            <div className="p-3 border-b border-slate-800 bg-slate-900/60 font-semibold text-slate-300 flex justify-between items-center">
              <span>System Logs &amp; Security Audit Trail</span>
              <span className="text-[11px] text-slate-400">
                Immutable records of price updates, vault transfers, purchases, and due receipts
              </span>
            </div>

            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/40 text-slate-400 text-[11px] uppercase">
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">User</th>
                  <th className="p-3">Action Event</th>
                  <th className="p-3">Details / Audit Payload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 font-mono">
                {auditLogs.map((log) => (
                  <tr key={log.LogID} className="hover:bg-slate-900/40">
                    <td className="p-3 text-slate-400 text-[11px]">
                      {new Date(log.Timestamp).toLocaleString()}
                    </td>
                    <td className="p-3 font-semibold text-emerald-400">{log.Username}</td>
                    <td className="p-3">
                      <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px] font-semibold">
                        {log.Action}
                      </span>
                    </td>
                    <td className="p-3 font-sans text-slate-200">{log.Details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
