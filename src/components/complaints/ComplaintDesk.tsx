/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Module: Customer Complaint Box & Salesman Coaching Desk
 * Centralizes customer dispute resolution, shortage/missed medicine logging,
 * admin remarks auditing, and actionable salesman coaching insights.
 */

import React, { useState, useMemo } from 'react';
import { usePharmacy } from '../../context/PharmacyContext';
import { CustomerComplaint, ComplaintCategory, ComplaintStatus } from '../../types/pharmacy';
import {
  MessageSquareWarning,
  Search,
  Filter,
  PlusCircle,
  CheckCircle2,
  AlertTriangle,
  Clock,
  UserCheck,
  Receipt,
  FileText,
  Check,
  X,
  Trash2,
  Sparkles,
  Phone,
  Store,
} from 'lucide-react';

export const ComplaintDesk: React.FC = () => {
  const {
    complaints,
    sales,
    addComplaint,
    updateComplaint,
    deleteComplaint,
    resolveComplaint,
    formatCurrency,
    showToast,
    askConfirm,
  } = usePharmacy();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | ComplaintStatus>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [salesmanFilter, setSalesmanFilter] = useState<string>('All');
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [resolvingComplaint, setResolvingComplaint] = useState<CustomerComplaint | null>(null);
  const [resolutionActionText, setResolutionActionText] = useState('');
  const [coachingUpdateText, setCoachingUpdateText] = useState('');

  // New Complaint Form state
  const [selectedInvoiceNum, setSelectedInvoiceNum] = useState('');
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formCustomerPhone, setFormCustomerPhone] = useState('');
  const [formSalesmanName, setFormSalesmanName] = useState('');
  const [formCategory, setFormCategory] = useState<ComplaintCategory>('Medicine Missed / Short Dispensed');
  const [formMissedMed, setFormMissedMed] = useState('');
  const [formMissedQty, setFormMissedQty] = useState(1);
  const [formDesc, setFormDesc] = useState('');
  const [formAdminRemarks, setFormAdminRemarks] = useState('');
  const [formCoachingNotes, setFormCoachingNotes] = useState('');

  // Handle selecting receipt in new complaint modal
  const handleSelectInvoice = (invNum: string) => {
    setSelectedInvoiceNum(invNum);
    const sale = sales.find((s) => s.InvoiceNumber === invNum);
    if (sale) {
      setFormCustomerName(sale.CustomerName);
      setFormCustomerPhone(sale.CustomerPhone || '');
      setFormSalesmanName(sale.SalesmanName || 'General Staff');
      if (sale.Items && sale.Items.length > 0) {
        setFormMissedMed(sale.Items[0].TradeName);
      }
    }
  };

  // Quick reset new modal form
  const resetForm = () => {
    setSelectedInvoiceNum('');
    setFormCustomerName('');
    setFormCustomerPhone('');
    setFormSalesmanName('');
    setFormCategory('Medicine Missed / Short Dispensed');
    setFormMissedMed('');
    setFormMissedQty(1);
    setFormDesc('');
    setFormAdminRemarks('');
    setFormCoachingNotes('Cross-verify physical blister count against terminal invoice before sealing the pouch.');
  };

  const handleOpenNewModal = () => {
    resetForm();
    setIsNewModalOpen(true);
  };

  // Handle Form Submit
  const handleCreateComplaint = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDesc.trim()) {
      showToast('Please enter the customer grievance description.', 'warning');
      return;
    }

    const sale = sales.find((s) => s.InvoiceNumber === selectedInvoiceNum);

    addComplaint({
      ReceiptNumber: selectedInvoiceNum || 'REC-WALKIN',
      SaleID: sale?.SaleID,
      CustomerID: sale?.CustomerID || undefined,
      CustomerName: formCustomerName.trim() || 'Walk-in Customer',
      CustomerPhone: formCustomerPhone.trim(),
      CustomerAddress: sale?.CustomerAddress,
      SalesmanID: sale?.SalesmanID || 'EMP-001',
      SalesmanName: formSalesmanName.trim() || 'General Staff',
      TerminalName: sale?.TerminalName || 'Counter 1',
      Category: formCategory,
      Status: 'Pending / Under Review' as ComplaintStatus,
      ShortOrMissedMedicine: formMissedMed.trim()
        ? `${formMissedMed.trim()} (Short: ${formMissedQty} pcs)`
        : undefined,
      IssueDescription: formDesc.trim(),
      AdminRemarks: formAdminRemarks.trim() || 'Registered for investigation and dispenser consultation.',
      SalesmanCoachingNotes: formCoachingNotes.trim() || undefined,
    });

    showToast('Customer complaint recorded successfully.', 'success', 'Saved');
    setIsNewModalOpen(false);
    resetForm();
  };

  // Handle Resolve Action
  const handleOpenResolveDialog = (complaint: CustomerComplaint) => {
    setResolvingComplaint(complaint);
    setResolutionActionText(
      complaint.Category === 'Medicine Missed / Short Dispensed'
        ? `Replaced missing ${complaint.ShortOrMissedMedicine || 'medicine'} free of charge and apologized to customer.`
        : 'Dispute investigated, customer satisfied with store credit or replacement.'
    );
    setCoachingUpdateText(complaint.SalesmanCoachingNotes || '');
  };

  const handleConfirmResolve = () => {
    if (!resolvingComplaint) return;
    if (!resolutionActionText.trim()) {
      showToast('Please state the resolution action taken.', 'warning');
      return;
    }

    resolveComplaint(
      resolvingComplaint.ComplaintID,
      resolutionActionText.trim(),
      coachingUpdateText.trim()
    );

    showToast(
      `Complaint ${resolvingComplaint.ComplaintID} marked as Resolved.`,
      'success',
      'Resolved'
    );
    setResolvingComplaint(null);
  };

  // Handle Delete
  const handleDeleteComplaint = async (complaint: CustomerComplaint) => {
    const ok = await askConfirm({
      title: 'Delete Complaint Record',
      message: `Are you sure you want to delete grievance ${complaint.ComplaintID} for receipt ${complaint.ReceiptNumber}?`,
      confirmLabel: 'Delete Record',
      isDestructive: true,
    });
    if (ok) {
      deleteComplaint(complaint.ComplaintID);
      showToast(`Complaint ${complaint.ComplaintID} deleted.`, 'info');
    }
  };

  // Filtered complaints
  const filteredComplaints = useMemo(() => {
    return complaints.filter((c) => {
      if (statusFilter !== 'All' && c.Status !== statusFilter) return false;
      if (categoryFilter !== 'All' && c.Category !== categoryFilter) return false;
      if (salesmanFilter !== 'All' && c.SalesmanName !== salesmanFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchReceipt = c.ReceiptNumber.toLowerCase().includes(q);
        const matchCust = c.CustomerName.toLowerCase().includes(q);
        const matchSalesman = c.SalesmanName.toLowerCase().includes(q);
        const matchDesc = c.IssueDescription.toLowerCase().includes(q);
        const matchRemarks = (c.AdminRemarks || '').toLowerCase().includes(q);
        const matchMed = (c.ShortOrMissedMedicine || '').toLowerCase().includes(q);

        if (!matchReceipt && !matchCust && !matchSalesman && !matchDesc && !matchRemarks && !matchMed) {
          return false;
        }
      }

      return true;
    });
  }, [complaints, statusFilter, categoryFilter, salesmanFilter, searchQuery]);

  // Distinct salesmen in complaints
  const salesmanOptions = useMemo(() => {
    const set = new Set<string>();
    complaints.forEach((c) => {
      if (c.SalesmanName) set.add(c.SalesmanName);
    });
    return Array.from(set).sort();
  }, [complaints]);

  // KPIs
  const stats = useMemo(() => {
    const total = complaints.length;
    const pending = complaints.filter((c) => c.Status === 'Pending / Under Review').length;
    const investigating = complaints.filter((c) => c.Status === 'Investigating').length;
    const resolved = complaints.filter(
      (c) => c.Status === 'Resolved / Reconciled' || c.Status === 'Medicine Replaced / Refunded'
    ).length;
    const shortageCount = complaints.filter((c) => c.Category === 'Medicine Missed / Short Dispensed').length;

    return {
      total,
      pending,
      investigating,
      resolved,
      shortageCount,
    };
  }, [complaints]);

  // Salesman Coaching Analytics Grouping
  const salesmanCoachingMap = useMemo(() => {
    const map = new Map<
      string,
      {
        salesmanName: string;
        totalComplaints: number;
        shortageCount: number;
        wrongMedCount: number;
        pendingCount: number;
        coachingPoints: string[];
      }
    >();

    complaints.forEach((c) => {
      const sm = c.SalesmanName || 'General Staff';
      if (!map.has(sm)) {
        map.set(sm, {
          salesmanName: sm,
          totalComplaints: 0,
          shortageCount: 0,
          wrongMedCount: 0,
          pendingCount: 0,
          coachingPoints: [],
        });
      }
      const data = map.get(sm)!;
      data.totalComplaints += 1;
      if (c.Category === 'Medicine Missed / Short Dispensed') data.shortageCount += 1;
      if (c.Category === 'Wrong Medicine Dispensed') data.wrongMedCount += 1;
      if (c.Status === 'Pending / Under Review' || c.Status === 'Investigating') data.pendingCount += 1;
      if (c.SalesmanCoachingNotes && !data.coachingPoints.includes(c.SalesmanCoachingNotes)) {
        data.coachingPoints.push(c.SalesmanCoachingNotes);
      }
    });

    return Array.from(map.values()).sort((a, b) => b.totalComplaints - a.totalComplaints);
  }, [complaints]);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-900 text-slate-100 overflow-hidden">
      {/* Top Header */}
      <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-rose-950/80 border border-rose-700/60 text-rose-400">
            <MessageSquareWarning className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-bold text-white tracking-wide">
                Customer Complaint Box & Coaching Desk
              </h1>
              <span className="text-[10px] uppercase font-mono font-bold bg-rose-950 text-rose-300 border border-rose-800/80 px-1.5 py-0.5 rounded">
                Quality Assurance & Audit
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Record missed medicines, customer disputes, admin investigations, and coach dispensers on counter accuracy
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenNewModal}
          className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors shadow-md cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          <span>+ File New Complaint</span>
        </button>
      </div>

      {/* KPI Stats Strip */}
      <div className="p-4 bg-slate-950/60 border-b border-slate-800 grid grid-cols-2 md:grid-cols-5 gap-3 shrink-0">
        <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
          <span className="text-[10px] font-semibold uppercase text-slate-400 block tracking-wider">
            Total Filed Grievances
          </span>
          <span className="text-lg font-bold text-white font-mono mt-0.5 block">
            {stats.total}
          </span>
          <span className="text-[10px] text-slate-400">All-time audit logs</span>
        </div>

        <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
          <span className="text-[10px] font-semibold uppercase text-amber-300 block tracking-wider">
            Pending Action
          </span>
          <span className="text-lg font-bold text-amber-400 font-mono mt-0.5 block">
            {stats.pending}
          </span>
          <span className="text-[10px] text-amber-400/80">Awaiting store review</span>
        </div>

        <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
          <span className="text-[10px] font-semibold uppercase text-blue-300 block tracking-wider">
            Under Investigation
          </span>
          <span className="text-lg font-bold text-blue-400 font-mono mt-0.5 block">
            {stats.investigating}
          </span>
          <span className="text-[10px] text-blue-400/80">Stock check in progress</span>
        </div>

        <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
          <span className="text-[10px] font-semibold uppercase text-emerald-300 block tracking-wider">
            Resolved & Settled
          </span>
          <span className="text-lg font-bold text-emerald-400 font-mono mt-0.5 block">
            {stats.resolved}
          </span>
          <span className="text-[10px] text-emerald-400/80">Customer satisfied</span>
        </div>

        <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
          <span className="text-[10px] font-semibold uppercase text-rose-300 block tracking-wider">
            Shortage / Missed Strip
          </span>
          <span className="text-lg font-bold text-rose-400 font-mono mt-0.5 block">
            {stats.shortageCount}
          </span>
          <span className="text-[10px] text-rose-400/80">Packing error rate</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center gap-2.5 shrink-0">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Invoice #, Customer, Salesman, Medicine or Remarks..."
            className="w-full bg-slate-950 border border-slate-700 rounded-md pl-9 pr-7 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-rose-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Status Filter */}
        <div className="flex items-center space-x-1">
          {(['All', 'Pending / Under Review', 'Investigating', 'Resolved / Reconciled'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                statusFilter === st
                  ? 'bg-rose-950 text-rose-300 border border-rose-800/80'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Category Filter */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-rose-500"
        >
          <option value="All">All Categories</option>
          <option value="Medicine Missed / Short Dispensed">Medicine Missed / Short Dispensed</option>
          <option value="Wrong Medicine Dispensed">Wrong Medicine Dispensed</option>
          <option value="Damaged / Expired Batch">Damaged / Expired Batch</option>
          <option value="Overcharge / Billing Error">Overcharge / Billing Error</option>
          <option value="Salesman Conduct / Delay">Salesman Conduct / Delay</option>
          <option value="Other">Other</option>
        </select>

        {/* Salesman Filter */}
        <select
          value={salesmanFilter}
          onChange={(e) => setSalesmanFilter(e.target.value)}
          className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-rose-500"
        >
          <option value="All">All Salesmen</option>
          {salesmanOptions.map((sm) => (
            <option key={sm} value={sm}>
              {sm}
            </option>
          ))}
        </select>
      </div>

      {/* Main View Area: Grid with Complaints List & Salesman Coaching Panel */}
      <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left 2 Cols: Complaints Records */}
        <div className="lg:col-span-2 space-y-3">
          {filteredComplaints.length === 0 ? (
            <div className="text-center py-16 bg-slate-950/60 rounded-xl border border-slate-800">
              <CheckCircle2 className="w-12 h-12 text-emerald-500/60 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-slate-300">No active complaints found</h3>
              <p className="text-xs text-slate-500 mt-1">
                All customer disputes and dispensing audits are clear under this view.
              </p>
            </div>
          ) : (
            filteredComplaints.map((c) => {
              const isPending = c.Status === 'Pending / Under Review';
              const isInvestigating = c.Status === 'Investigating';
              const isResolved =
                c.Status === 'Resolved / Reconciled' || c.Status === 'Medicine Replaced / Refunded';

              return (
                <div
                  key={c.ComplaintID}
                  className={`p-4 rounded-xl border transition-all space-y-3 ${
                    isPending
                      ? 'bg-slate-950 border-rose-900/60 hover:border-rose-700'
                      : isInvestigating
                      ? 'bg-slate-950 border-blue-900/60 hover:border-blue-700'
                      : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-xs text-rose-400 bg-rose-950/80 border border-rose-900/80 px-2 py-0.5 rounded">
                        {c.ComplaintID}
                      </span>
                      <span className="font-mono font-medium text-xs text-slate-300">
                        Ref: {c.ReceiptNumber}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        ({c.CreatedAt.substring(0, 10)})
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      {/* Status Tag */}
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                          isPending
                            ? 'bg-rose-950 text-rose-300 border-rose-800'
                            : isInvestigating
                            ? 'bg-blue-950 text-blue-300 border-blue-800'
                            : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                        }`}
                      >
                        {c.Status}
                      </span>
                    </div>
                  </div>

                  {/* Customer & Salesman Info Ribbon */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs font-mono bg-slate-900/90 p-2.5 rounded-lg border border-slate-800/80">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans">Customer</span>
                      <span className="font-bold text-slate-200">{c.CustomerName}</span>
                      {c.CustomerPhone && (
                        <span className="text-[10px] text-slate-400 block">{c.CustomerPhone}</span>
                      )}
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans">Counter & Dispenser</span>
                      <span className="font-bold text-amber-300">{c.SalesmanName}</span>
                      <span className="text-[10px] text-slate-400 block">{c.TerminalName || 'Counter 1'}</span>
                    </div>
                    <div className="col-span-2 md:col-span-1">
                      <span className="text-[10px] text-slate-400 block font-sans">Grievance Category</span>
                      <span className="font-semibold text-rose-300">{c.Category}</span>
                    </div>
                  </div>

                  {/* Missed Medicine Badge (if shortage) */}
                  {c.ShortOrMissedMedicine && (
                    <div className="p-2 rounded bg-amber-950/30 border border-amber-900/50 flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="text-amber-200">
                          Shortage Reported: <strong>{c.ShortOrMissedMedicine}</strong>
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Grievance Description */}
                  <div className="text-xs text-slate-200 bg-slate-900/50 p-2.5 rounded-lg border border-slate-800/60">
                    <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-0.5">
                      Customer Complaint
                    </span>
                    <p className="italic">"{c.IssueDescription}"</p>
                  </div>

                  {/* Admin Remarks */}
                  {c.AdminRemarks && (
                    <div className="text-xs text-amber-200 bg-amber-950/20 p-2.5 rounded-lg border border-amber-900/40">
                      <span className="text-[10px] font-semibold uppercase text-amber-400 block mb-0.5">
                        Admin Investigation Remarks
                      </span>
                      <p>{c.AdminRemarks}</p>
                    </div>
                  )}

                  {/* Salesman Coaching Notes */}
                  {c.SalesmanCoachingNotes && (
                    <div className="text-xs text-cyan-200 bg-cyan-950/20 p-2.5 rounded-lg border border-cyan-900/40">
                      <span className="text-[10px] font-semibold uppercase text-cyan-400 block mb-0.5">
                        Salesman Coaching Guidance
                      </span>
                      <p>{c.SalesmanCoachingNotes}</p>
                    </div>
                  )}

                  {/* Resolution Action (if resolved) */}
                  {c.ResolutionAction && (
                    <div className="text-xs text-emerald-200 bg-emerald-950/20 p-2.5 rounded-lg border border-emerald-900/40">
                      <span className="text-[10px] font-semibold uppercase text-emerald-400 block mb-0.5 flex items-center space-x-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>Resolution Action ({c.ResolvedAt?.substring(0, 10)})</span>
                      </span>
                      <p>{c.ResolutionAction}</p>
                    </div>
                  )}

                  {/* Footer Action Buttons */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                    <div className="flex items-center space-x-2">
                      {isPending && (
                        <button
                          onClick={() => updateComplaint(c.ComplaintID, { Status: 'Investigating' })}
                          className="px-2.5 py-1 rounded bg-blue-950 hover:bg-blue-900 text-blue-300 font-medium border border-blue-800 transition-colors"
                        >
                          Mark Investigating
                        </button>
                      )}
                      {!isResolved && (
                        <button
                          onClick={() => handleOpenResolveDialog(c)}
                          className="px-2.5 py-1 rounded bg-emerald-950 hover:bg-emerald-900 text-emerald-300 font-bold border border-emerald-800 transition-colors flex items-center space-x-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Resolve Issue</span>
                        </button>
                      )}
                    </div>

                    <button
                      onClick={() => handleDeleteComplaint(c)}
                      className="text-slate-400 hover:text-rose-400 p-1 rounded transition-colors"
                      title="Delete complaint audit"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Col: Salesman Coaching Intelligence Panel */}
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                  Salesman Coaching Analytics
                </h2>
              </div>
              <span className="text-[10px] text-slate-400">Quality Monitor</span>
            </div>

            <p className="text-xs text-slate-400">
              Correlating customer shortage complaints and dispense accuracy to guide dispensers during team consultations.
            </p>

            <div className="space-y-3">
              {salesmanCoachingMap.map((sm) => (
                <div
                  key={sm.salesmanName}
                  className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5 font-bold text-slate-200">
                      <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                      <span>{sm.salesmanName}</span>
                    </div>
                    <span
                      className={`font-mono text-[10px] px-1.5 py-0.2 rounded border ${
                        sm.pendingCount > 0
                          ? 'bg-rose-950 text-rose-300 border-rose-800'
                          : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                      }`}
                    >
                      {sm.totalComplaints} Incidents
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                    <div className="bg-slate-950 p-1.5 rounded border border-slate-800">
                      <span className="text-slate-400 block text-[9px]">Missed Medicine</span>
                      <span className="text-amber-400 font-bold">{sm.shortageCount} times</span>
                    </div>
                    <div className="bg-slate-950 p-1.5 rounded border border-slate-800">
                      <span className="text-slate-400 block text-[9px]">Wrong Dispense</span>
                      <span className="text-rose-400 font-bold">{sm.wrongMedCount} times</span>
                    </div>
                  </div>

                  {sm.coachingPoints.length > 0 && (
                    <div className="pt-1 border-t border-slate-800 text-[10px] text-cyan-300 space-y-1">
                      <span className="font-bold text-cyan-400 block">Recommended Coaching:</span>
                      {sm.coachingPoints.slice(0, 2).map((pt, i) => (
                        <p key={i} className="italic text-slate-300">&bull; {pt}</p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* NEW COMPLAINT MODAL */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
            <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2 text-rose-400">
                <MessageSquareWarning className="w-5 h-5" />
                <h3 className="text-sm font-bold text-white">Log Customer Complaint / Shortage</h3>
              </div>
              <button onClick={() => setIsNewModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateComplaint} className="p-4 space-y-3 text-xs">
              {/* Select Sale Invoice */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Sale Invoice Number *
                </label>
                <select
                  value={selectedInvoiceNum}
                  onChange={(e) => handleSelectInvoice(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-mono"
                  required
                >
                  <option value="">-- Select from recent sale invoices --</option>
                  {sales.map((s) => (
                    <option key={s.SaleID} value={s.InvoiceNumber}>
                      {s.InvoiceNumber} &bull; {s.CustomerName} &bull; {s.SaleDate.substring(0, 10)} ({formatCurrency(s.FinalAmount || s.TotalAmount)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Customer & Salesman */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-0.5">Customer Name</label>
                  <input
                    type="text"
                    value={formCustomerName}
                    onChange={(e) => setFormCustomerName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-white"
                    placeholder="Customer Name"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-0.5">Salesman / Dispenser</label>
                  <input
                    type="text"
                    value={formSalesmanName}
                    onChange={(e) => setFormSalesmanName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-white"
                    placeholder="Salesman Name"
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-slate-400 mb-0.5">Complaint Category</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-white"
                >
                  <option value="Medicine Missed / Short Dispensed">Medicine Missed / Short Dispensed</option>
                  <option value="Wrong Medicine Dispensed">Wrong Medicine Dispensed</option>
                  <option value="Damaged / Expired Batch">Damaged / Expired Batch</option>
                  <option value="Overcharge / Billing Error">Overcharge / Billing Error</option>
                  <option value="Salesman Conduct / Delay">Salesman Conduct / Delay</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Missed Medicine details */}
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-slate-400 mb-0.5">Shortage Medicine Name</label>
                  <input
                    type="text"
                    value={formMissedMed}
                    onChange={(e) => setFormMissedMed(e.target.value)}
                    placeholder="e.g. Paracetamol 500mg"
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-0.5">Short Qty</label>
                  <input
                    type="number"
                    min="1"
                    value={formMissedQty}
                    onChange={(e) => setFormMissedQty(parseInt(e.target.value) || 1)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-white"
                  />
                </div>
              </div>

              {/* Customer Grievance */}
              <div>
                <label className="block text-slate-300 font-semibold mb-0.5">
                  Customer Grievance Description *
                </label>
                <textarea
                  rows={2}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Details of what customer reported..."
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                  required
                />
              </div>

              {/* Admin Remarks */}
              <div>
                <label className="block text-amber-300 font-semibold mb-0.5">
                  Admin Assessment Remarks
                </label>
                <textarea
                  rows={2}
                  value={formAdminRemarks}
                  onChange={(e) => setFormAdminRemarks(e.target.value)}
                  placeholder="Verification against shelf stock and register..."
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                />
              </div>

              {/* Salesman Coaching Notes */}
              <div>
                <label className="block text-cyan-300 font-semibold mb-0.5">
                  Salesman Coaching & Training Note
                </label>
                <textarea
                  rows={2}
                  value={formCoachingNotes}
                  onChange={(e) => setFormCoachingNotes(e.target.value)}
                  placeholder="Guidance to review with dispenser..."
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                />
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold"
                >
                  Save Grievance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESOLUTION DIALOG */}
      {resolvingComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-md w-full p-4 space-y-3 text-xs">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <span className="font-bold text-sm text-emerald-400 flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>Resolve Grievance {resolvingComplaint.ComplaintID}</span>
              </span>
              <button
                onClick={() => setResolvingComplaint(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
              <p className="text-slate-300 font-medium">Customer: {resolvingComplaint.CustomerName}</p>
              <p className="text-slate-400 text-[11px] mt-0.5">Receipt: {resolvingComplaint.ReceiptNumber}</p>
              <p className="text-rose-300 text-[11px] mt-0.5 italic">"{resolvingComplaint.IssueDescription}"</p>
            </div>

            <div>
              <label className="block text-slate-200 font-semibold mb-1">
                Resolution Action Taken *
              </label>
              <textarea
                rows={3}
                value={resolutionActionText}
                onChange={(e) => setResolutionActionText(e.target.value)}
                placeholder="e.g. Replaced strip, refunded amount, or clarified dosage with customer..."
                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                required
              />
            </div>

            <div>
              <label className="block text-cyan-300 font-semibold mb-1">
                Updated Salesman Coaching Points
              </label>
              <textarea
                rows={2}
                value={coachingUpdateText}
                onChange={(e) => setCoachingUpdateText(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setResolvingComplaint(null)}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmResolve}
                className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
              >
                Mark Resolved & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
