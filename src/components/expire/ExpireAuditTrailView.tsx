/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { usePharmacy } from '../../context/PharmacyContext';
import { AuditLog } from '../../types/pharmacy';
import {
  ShieldAlert,
  Search,
  Filter,
  Calendar,
  Clock,
  Printer,
  FileText,
  Boxes,
  Banknote,
  ArrowRightLeft,
  Phone,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

export const ExpireAuditTrailView: React.FC = () => {
  const { auditLogs, formatCurrency } = usePharmacy();

  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');

  // Filter only expiry-related audit actions
  const expiryAuditLogs = useMemo(() => {
    const expiryActions = [
      'STOCK_TRANSFER_VAULT',
      'EXPIRE_OUT_INVOICE',
      'EXPIRE_IN_INVOICE',
      'EXPIRE_CASH_REFUND',
      'SUPPLIER_CALL_LOG',
      'VAULT_RECONCILIATION',
    ];

    return auditLogs.filter((log) => expiryActions.includes(log.Action));
  }, [auditLogs]);

  // Apply filters & search
  const filteredLogs = useMemo(() => {
    return expiryAuditLogs.filter((log) => {
      if (actionFilter !== 'all' && log.Action !== actionFilter) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchDetails = log.Details.toLowerCase().includes(q);
        const matchUser = log.Username.toLowerCase().includes(q);
        const matchId = log.LogID.toLowerCase().includes(q);
        if (!matchDetails && !matchUser && !matchId) {
          return false;
        }
      }

      return true;
    });
  }, [expiryAuditLogs, actionFilter, searchQuery]);

  const getActionBadge = (action: AuditLog['Action']) => {
    switch (action) {
      case 'EXPIRE_OUT_INVOICE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
            <FileText className="w-3.5 h-3.5 text-amber-400" />
            Out-Invoice Issued
          </span>
        );
      case 'EXPIRE_IN_INVOICE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-400" />
            In-Invoice (Stock Exchanged)
          </span>
        );
      case 'EXPIRE_CASH_REFUND':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-green-500/20 text-green-300 border border-green-500/40">
            <Banknote className="w-3.5 h-3.5 text-green-400" />
            Cash Refund Credited
          </span>
        );
      case 'STOCK_TRANSFER_VAULT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
            <Boxes className="w-3.5 h-3.5 text-purple-400" />
            Quarantine to Vault
          </span>
        );
      case 'SUPPLIER_CALL_LOG':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40">
            <Phone className="w-3.5 h-3.5 text-sky-400" />
            Supplier Call Logged
          </span>
        );
      case 'VAULT_RECONCILIATION':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
            <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
            Vault Reconciliation
          </span>
        );
    }
  };

  const handlePrintAudit = () => {
    window.print();
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-900 overflow-hidden">
      {/* Top Filter Bar */}
      <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 flex-1">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search audit trail by invoice #, medicine, supplier, operator..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 shadow-inner"
            />
          </div>

          {/* Action Filter */}
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Expiry Audit Actions</option>
            <option value="EXPIRE_OUT_INVOICE">Out-Invoice Created</option>
            <option value="EXPIRE_IN_INVOICE">In-Invoice Stock Incremented</option>
            <option value="EXPIRE_CASH_REFUND">Direct Cash Refund</option>
            <option value="STOCK_TRANSFER_VAULT">Transferred to Vault</option>
            <option value="SUPPLIER_CALL_LOG">Supplier Call Log</option>
            <option value="VAULT_RECONCILIATION">Vault Reconciliation</option>
          </select>
        </div>

        <button
          onClick={handlePrintAudit}
          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
        >
          <Printer className="w-3.5 h-3.5 text-slate-400" />
          <span>Print Audit Report</span>
        </button>
      </div>

      {/* Audit Log Table */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredLogs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
            <AlertCircle className="w-10 h-10 text-slate-500 mb-2" />
            <p className="text-sm font-bold text-white">No Matching Audit Entries</p>
            <p className="text-xs text-slate-500 mt-1">Try modifying your search or filter options.</p>
          </div>
        ) : (
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60 shadow-sm">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-3 w-40">Timestamp</th>
                  <th className="py-3 px-3 w-44">Action Type</th>
                  <th className="py-3 px-3">Transaction Details & Audit Notes</th>
                  <th className="py-3 px-3 w-36">Operator / User</th>
                  <th className="py-3 px-3 w-28 text-right">Log ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {filteredLogs.map((log) => (
                  <tr key={log.LogID} className="hover:bg-slate-900/60 transition-colors">
                    <td className="py-3 px-3 text-slate-400 text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span>{new Date(log.Timestamp).toLocaleDateString()}</span>
                        <span className="text-slate-500">{new Date(log.Timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </td>

                    <td className="py-3 px-3 font-sans">
                      {getActionBadge(log.Action)}
                    </td>

                    <td className="py-3 px-3 font-sans text-slate-200 text-xs">
                      {log.Details}
                    </td>

                    <td className="py-3 px-3 font-sans text-slate-400 text-xs">
                      <span className="text-slate-300 font-medium">{log.Username}</span>
                    </td>

                    <td className="py-3 px-3 text-right text-slate-500 text-[10px]">
                      {log.LogID}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
