import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../services/store.tsx';
import {
  ShieldAlert,
  Activity,
  Award,
  CheckCircle2,
  XCircle,
  MessageSquareWarning,
  Plus,
} from 'lucide-react';
import type { UserProfile } from '../../types/index.ts';

interface RegistryRecord {
  id: string;
  record_type: string;
  license_number: string;
  official_name: string;
  issuing_authority: string;
  state_district: string;
  is_test_record: number;
}

export const AdminDashboard: React.FC = () => {
  const {
    sessionToken,
    allUsers,
    donations,
    analytics,
    auditLogs,
    complaints,
    updateUserVerification,
    addVerificationRecord,
    assignVolunteerToDonation,
    updateComplaintStatus,
    setSelectedDonationForCert,
    setSelectedDonationForQr,
  } = useApp();

  const [activeTab, setActiveTab] = useState<
    'OVERVIEW' | 'VERIFICATION' | 'DONATIONS' | 'COMPLAINTS' | 'AUDIT'
  >('OVERVIEW');

  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  // Reject user inline modal state
  const [rejectTarget, setRejectTarget] = useState<UserProfile | null>(null);
  const [rejectReason, setRejectReason] = useState(
    'Document reference or licence could not be verified against compliance records.'
  );

  // Complaint resolution inline modal state
  const [resolveTargetId, setResolveTargetId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');

  // Verification registry records
  const [registryRecords, setRegistryRecords] = useState<RegistryRecord[]>([]);
  const [showAddRegistry, setShowAddRegistry] = useState(false);
  const [newRegType, setNewRegType] = useState<'NGO' | 'RESTAURANT'>('NGO');
  const [newRegLicense, setNewRegLicense] = useState('');
  const [newRegName, setNewRegName] = useState('');
  const [newRegAuth, setNewRegAuth] = useState('Registrar of Societies');
  const [newRegDistrict, setNewRegDistrict] = useState('Mangalagiri, Andhra Pradesh');

  // Volunteer selector per donation
  const [selectedVolunteerByDonation, setSelectedVolunteerByDonation] = useState<
    Record<string, string>
  >({});

  const loadRegistryRecords = useCallback(async () => {
    if (!sessionToken) return;
    try {
      const res = await fetch('/api/admin/verification-records', {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRegistryRecords(data.records || []);
      }
    } catch {
      // Ignore transient error
    }
  }, [sessionToken]);

  useEffect(() => {
    loadRegistryRecords();
  }, [loadRegistryRecords]);

  const approvedVolunteers = allUsers.filter(
    (u) => u.role === 'ROLE_VOLUNTEER' && u.verificationStatus === 'APPROVED'
  );
  const pendingUsers = allUsers.filter((u) => u.verificationStatus === 'PENDING');
  const openComplaints = complaints.filter((c) => c.status !== 'RESOLVED');

  const totalRestaurants = allUsers.filter((u) => u.role === 'ROLE_RESTAURANT').length;
  const totalNgos = allUsers.filter((u) => u.role === 'ROLE_NGO').length;
  const totalVolunteers = allUsers.filter((u) => u.role === 'ROLE_VOLUNTEER').length;

  const totalKgRescued =
    analytics?.totalFoodRescuedKg ??
    donations.reduce((acc, d) => acc + (d.status === 'COMPLETED' ? d.quantityKg : 0), 0);
  const totalMeals =
    analytics?.totalMealsDistributed ??
    donations.reduce(
      (acc, d) => acc + (d.status === 'COMPLETED' ? d.estimatedServings : 0),
      0
    );

  const handleApproveUser = async (user: UserProfile) => {
    setIsBusy(true);
    setActionFeedback(null);
    try {
      await updateUserVerification(user.id, 'APPROVED');
      setActionFeedback({
        type: 'success',
        message: `Approved ${user.organizationName || user.name}.`,
      });
    } catch (err) {
      setActionFeedback({ type: 'error', message: (err as Error).message });
    } finally {
      setIsBusy(false);
    }
  };

  const handleSuspendUser = async (user: UserProfile) => {
    setIsBusy(true);
    setActionFeedback(null);
    try {
      await updateUserVerification(user.id, 'SUSPENDED', 'Suspended by administrator.');
      setActionFeedback({
        type: 'success',
        message: `Suspended ${user.organizationName || user.name}.`,
      });
    } catch (err) {
      setActionFeedback({ type: 'error', message: (err as Error).message });
    } finally {
      setIsBusy(false);
    }
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectTarget || !rejectReason.trim()) return;
    setIsBusy(true);
    setActionFeedback(null);
    try {
      await updateUserVerification(rejectTarget.id, 'REJECTED', rejectReason.trim());
      setActionFeedback({
        type: 'success',
        message: `Rejected verification for ${rejectTarget.organizationName || rejectTarget.name}.`,
      });
      setRejectTarget(null);
    } catch (err) {
      setActionFeedback({ type: 'error', message: (err as Error).message });
    } finally {
      setIsBusy(false);
    }
  };

  const handleAddRegistryRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsBusy(true);
    setActionFeedback(null);
    try {
      await addVerificationRecord({
        recordType: newRegType,
        licenseNumber: newRegLicense.trim().toUpperCase(),
        officialName: newRegName.trim(),
        issuingAuthority: newRegAuth.trim(),
        stateDistrict: newRegDistrict.trim(),
      });
      setNewRegLicense('');
      setNewRegName('');
      setShowAddRegistry(false);
      await loadRegistryRecords();
      setActionFeedback({
        type: 'success',
        message: 'Verification licence record added to registry.',
      });
    } catch (err) {
      setActionFeedback({ type: 'error', message: (err as Error).message });
    } finally {
      setIsBusy(false);
    }
  };

  const handleAssignVolunteer = async (donationId: string) => {
    const volId =
      selectedVolunteerByDonation[donationId] || approvedVolunteers[0]?.id;
    if (!volId) {
      setActionFeedback({
        type: 'error',
        message: 'No approved volunteer is currently available.',
      });
      return;
    }
    setIsBusy(true);
    setActionFeedback(null);
    try {
      await assignVolunteerToDonation(donationId, volId);
      setActionFeedback({
        type: 'success',
        message: `Assigned volunteer courier to ${donationId}.`,
      });
    } catch (err) {
      setActionFeedback({ type: 'error', message: (err as Error).message });
    } finally {
      setIsBusy(false);
    }
  };

  const handleResolveComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolveTargetId) return;
    setIsBusy(true);
    try {
      await updateComplaintStatus(resolveTargetId, 'RESOLVED', resolutionNote.trim());
      setResolveTargetId(null);
      setResolutionNote('');
      setActionFeedback({
        type: 'success',
        message: 'Complaint marked RESOLVED and logged.',
      });
    } catch (err) {
      setActionFeedback({ type: 'error', message: (err as Error).message });
    } finally {
      setIsBusy(false);
    }
  };

  const categoryData = analytics?.categoryBreakdown || [];
  const maxCatKg = Math.max(1, ...categoryData.map((c) => c.kg));
  const statusData = analytics?.statusBreakdown || [];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 mb-1">
            <span className="font-semibold text-rose-600 dark:text-rose-400">
              Operations Administration
            </span>
            <span aria-hidden="true">·</span>
            <span>Partner Verification, Dispatch & Audit Control</span>
          </div>
          <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-white">
            Annadaan Operations Console
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Monitor compliance approvals, active food rescues, volunteer dispatch, and safety reports.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="px-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-right">
            <span className="text-[11px] text-zinc-500 block">Pending Verifications</span>
            <span className="text-lg font-extrabold text-amber-600 dark:text-amber-400 tabular-nums">
              {pendingUsers.length}
            </span>
          </div>
          <div className="px-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-right">
            <span className="text-[11px] text-zinc-500 block">Open Issues</span>
            <span className="text-lg font-extrabold text-rose-600 dark:text-rose-400 tabular-nums">
              {openComplaints.length}
            </span>
          </div>
        </div>
      </div>

      {/* Nav Tabs */}
      <div className="flex items-center gap-1.5 border-b border-zinc-200 dark:border-zinc-800 pb-3 overflow-x-auto">
        {[
          { id: 'OVERVIEW', label: 'Analytics & Partners' },
          { id: 'VERIFICATION', label: `Verifications (${pendingUsers.length} Pending)` },
          { id: 'DONATIONS', label: `Donations Ledger (${donations.length})` },
          { id: 'COMPLAINTS', label: `Safety & Issues (${openComplaints.length})` },
          { id: 'AUDIT', label: `Audit Trail (${auditLogs.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              activeTab === tab.id
                ? 'bg-rose-500 text-white font-bold'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {actionFeedback && (
        <div
          className={`p-3.5 rounded-xl text-xs font-medium border ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
          }`}
        >
          {actionFeedback.message}
        </div>
      )}

      {/* TAB 1: ANALYTICS & PARTNERS */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <span className="text-xs text-zinc-500 block mb-1">Food Rescued</span>
              <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {totalKgRescued} kg
              </div>
              <span className="text-[11px] text-zinc-500 tabular-nums">
                ~{totalMeals} meals served
              </span>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <span className="text-xs text-zinc-500 block mb-1">Receiving NGOs</span>
              <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 tabular-nums">
                {totalNgos}
              </div>
              <span className="text-[11px] text-zinc-500">Registered shelters</span>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <span className="text-xs text-zinc-500 block mb-1">Food Providers</span>
              <div className="text-2xl font-extrabold text-sky-600 dark:text-sky-400 tabular-nums">
                {totalRestaurants}
              </div>
              <span className="text-[11px] text-zinc-500">Restaurants & banquets</span>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <span className="text-xs text-zinc-500 block mb-1">Volunteer Fleet</span>
              <div className="text-2xl font-extrabold text-teal-600 dark:text-teal-400 tabular-nums">
                {totalVolunteers}
              </div>
              <span className="text-[11px] text-zinc-500">Active couriers</span>
            </div>
          </div>

          {/* Analytics Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-4">
              <h2 className="font-bold text-sm text-zinc-900 dark:text-white">
                Rescued Volume by Food Category
              </h2>
              {categoryData.length === 0 ? (
                <p className="text-xs text-zinc-500 py-8 text-center">
                  No donation volume recorded yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {categoryData.map((row) => (
                    <div key={row.category} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">
                          {row.category.replace(/_/g, ' ')}
                        </span>
                        <span className="font-mono font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                          {row.kg} kg
                        </span>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all"
                          style={{ width: `${Math.max(6, (row.kg / maxCatKg) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-4">
              <h2 className="font-bold text-sm text-zinc-900 dark:text-white">
                Donation Lifecycle Breakdown
              </h2>
              {statusData.length === 0 ? (
                <p className="text-xs text-zinc-500 py-8 text-center">
                  No donations in lifecycle yet.
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {statusData.map((item) => (
                    <div
                      key={item.status}
                      className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                    >
                      <span className="text-[11px] font-mono text-zinc-500 block">
                        {item.status}
                      </span>
                      <span className="text-xl font-extrabold text-zinc-900 dark:text-white tabular-nums">
                        {item.count}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Directory Table */}
          <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
            <h2 className="font-bold text-sm text-zinc-900 dark:text-white">
              Registered Accounts Directory
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 dark:bg-zinc-950 font-mono text-[11px] text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="px-4 py-3">Entity / Name</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3">City</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Governance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {allUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-950/60">
                      <td className="px-4 py-3">
                        <div className="font-bold text-zinc-900 dark:text-white">
                          {user.organizationName || user.name}
                        </div>
                        <div className="text-[11px] text-zinc-500">{user.email}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-zinc-600 dark:text-zinc-400">
                        {user.role.replace('ROLE_', '')}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-zinc-500">
                        {user.licenseNumber || user.registrationNumber || '—'}
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                        {user.location.city}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`font-bold text-xs ${
                            user.verificationStatus === 'APPROVED'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : user.verificationStatus === 'PENDING'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {user.verificationStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                        {user.role !== 'ROLE_ADMIN' &&
                          user.verificationStatus !== 'APPROVED' && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleApproveUser(user)}
                              className="px-2.5 py-1 rounded-md bg-emerald-500 text-zinc-950 font-bold"
                            >
                              Approve
                            </button>
                          )}
                        {user.role !== 'ROLE_ADMIN' &&
                          user.verificationStatus === 'APPROVED' && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleSuspendUser(user)}
                              className="px-2.5 py-1 rounded-md bg-rose-500/15 text-rose-600 dark:text-rose-400 font-semibold"
                            >
                              Suspend
                            </button>
                          )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: VERIFICATIONS & TEST LICENCE REGISTRY */}
      {activeTab === 'VERIFICATION' && (
        <div className="space-y-6">
          <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-4">
            <h2 className="font-bold text-sm text-zinc-900 dark:text-white">
              Pending Organization & Volunteer Verifications
            </h2>

            {pendingUsers.length === 0 ? (
              <p className="text-xs text-zinc-500 py-8 text-center">
                No pending verifications in the queue.
              </p>
            ) : (
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {pendingUsers.map((user) => (
                  <div
                    key={user.id}
                    className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div>
                      <div className="text-xs font-mono text-zinc-500">
                        {user.role} · {user.email} · {user.phone}
                      </div>
                      <h3 className="font-bold text-sm text-zinc-900 dark:text-white mt-0.5">
                        {user.organizationName || user.name}
                      </h3>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 font-mono">
                        Licence / Reg No:{' '}
                        <strong className="text-emerald-600 dark:text-emerald-400">
                          {user.licenseNumber || user.registrationNumber || 'N/A'}
                        </strong>{' '}
                        · Doc Ref: {user.documentRef || 'Uploaded'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleApproveUser(user)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold rounded-lg"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve Partner
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => setRejectTarget(user)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-rose-500/15 text-rose-600 dark:text-rose-400 text-xs font-semibold rounded-lg"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Authorized Test Verification Registry */}
          <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-sm text-zinc-900 dark:text-white">
                  Compliance Verification Registry
                </h2>
                <p className="text-xs text-zinc-500">
                  Authorized NGO registration and restaurant FSSAI reference records checked during signup.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddRegistry((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" /> Add Registry Record
              </button>
            </div>

            {showAddRegistry && (
              <form
                onSubmit={handleAddRegistryRecord}
                className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 grid grid-cols-1 md:grid-cols-5 gap-3 items-end"
              >
                <div>
                  <label className="block text-[11px] font-semibold mb-1">Type</label>
                  <select
                    value={newRegType}
                    onChange={(e) => setNewRegType(e.target.value as 'NGO' | 'RESTAURANT')}
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-2 text-xs"
                  >
                    <option value="NGO">NGO</option>
                    <option value="RESTAURANT">RESTAURANT</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1">Licence No *</label>
                  <input
                    type="text"
                    required
                    value={newRegLicense}
                    onChange={(e) => setNewRegLicense(e.target.value)}
                    placeholder="TEST-NGO-2026-007"
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1">Official Name *</label>
                  <input
                    type="text"
                    required
                    value={newRegName}
                    onChange={(e) => setNewRegName(e.target.value)}
                    placeholder="Organization Name"
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1">Authority *</label>
                  <input
                    type="text"
                    required
                    value={newRegAuth}
                    onChange={(e) => setNewRegAuth(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-2 text-xs"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isBusy}
                  className="px-4 py-2 rounded-lg bg-emerald-500 text-zinc-950 font-bold text-xs"
                >
                  Save Record
                </button>
              </form>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 dark:bg-zinc-950 font-mono text-[11px] text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="px-3 py-2.5">Type</th>
                    <th className="px-3 py-2.5">Licence / Reg Number</th>
                    <th className="px-3 py-2.5">Official Name</th>
                    <th className="px-3 py-2.5">Authority</th>
                    <th className="px-3 py-2.5">District</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {registryRecords.map((rec) => (
                    <tr key={rec.id}>
                      <td className="px-3 py-2.5 font-mono font-semibold">{rec.record_type}</td>
                      <td className="px-3 py-2.5 font-mono text-emerald-600 dark:text-emerald-400">
                        {rec.license_number}
                      </td>
                      <td className="px-3 py-2.5 font-medium">{rec.official_name}</td>
                      <td className="px-3 py-2.5 text-zinc-500">{rec.issuing_authority}</td>
                      <td className="px-3 py-2.5 text-zinc-500">{rec.state_district}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DONATIONS MASTER LEDGER */}
      {activeTab === 'DONATIONS' && (
        <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-x-auto space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-sm text-zinc-900 dark:text-white">
              Master Food Rescue Ledger
            </h2>
            <span className="text-xs font-mono text-zinc-500 tabular-nums">
              {donations.length} total records
            </span>
          </div>

          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-950 font-mono text-[11px] text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="px-3 py-2.5">ID</th>
                <th className="px-3 py-2.5">Donor</th>
                <th className="px-3 py-2.5">Food Title</th>
                <th className="px-3 py-2.5">Qty</th>
                <th className="px-3 py-2.5">Allocated NGO</th>
                <th className="px-3 py-2.5">Courier</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {donations.map((item) => (
                <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-950/60">
                  <td className="px-3 py-2.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {item.id}
                  </td>
                  <td className="px-3 py-2.5">{item.donorName}</td>
                  <td className="px-3 py-2.5 font-semibold">{item.title}</td>
                  <td className="px-3 py-2.5 font-mono tabular-nums">{item.quantityKg} kg</td>
                  <td className="px-3 py-2.5">{item.allocatedNgoName || '—'}</td>
                  <td className="px-3 py-2.5">
                    {item.assignedVolunteerName ? (
                      <span>{item.assignedVolunteerName}</span>
                    ) : item.status === 'APPROVED' && approvedVolunteers.length > 0 ? (
                      <div className="flex items-center gap-1.5">
                        <select
                          value={
                            selectedVolunteerByDonation[item.id] ||
                            approvedVolunteers[0].id
                          }
                          onChange={(e) =>
                            setSelectedVolunteerByDonation((prev) => ({
                              ...prev,
                              [item.id]: e.target.value,
                            }))
                          }
                          className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 text-[11px]"
                        >
                          {approvedVolunteers.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleAssignVolunteer(item.id)}
                          className="px-2 py-1 rounded bg-sky-500 text-zinc-950 font-bold text-[11px]"
                        >
                          Assign
                        </button>
                      </div>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 font-semibold">{item.status}</td>
                  <td className="px-3 py-2.5 text-right space-x-1.5 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setSelectedDonationForQr(item)}
                      className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded font-medium"
                    >
                      QR
                    </button>
                    {item.status === 'COMPLETED' && (
                      <button
                        type="button"
                        onClick={() => setSelectedDonationForCert(item)}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-amber-500/15 text-amber-700 dark:text-amber-300 rounded font-semibold"
                      >
                        <Award className="w-3 h-3" /> Cert
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 4: COMPLAINTS */}
      {activeTab === 'COMPLAINTS' && (
        <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-4">
          <h2 className="font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-2">
            <MessageSquareWarning className="w-4 h-4 text-rose-500" /> Safety & Logistics Reports
          </h2>
          {complaints.length === 0 ? (
            <p className="text-xs text-zinc-500 py-8 text-center">
              No safety issues or complaints reported.
            </p>
          ) : (
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {complaints.map((cmp) => (
                <div
                  key={cmp.id}
                  className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="text-xs font-mono text-zinc-500">
                      {cmp.id} · Reported by {cmp.reporterName} ·{' '}
                      <span
                        className={
                          cmp.status === 'RESOLVED'
                            ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                            : 'text-amber-600 dark:text-amber-400 font-bold'
                        }
                      >
                        {cmp.status}
                      </span>
                    </div>
                    <h3 className="font-bold text-sm text-zinc-900 dark:text-white">
                      {cmp.subject}
                    </h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                      {cmp.description}
                    </p>
                    {cmp.resolutionNote && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400">
                        Resolution: {cmp.resolutionNote}
                      </p>
                    )}
                  </div>

                  {cmp.status !== 'RESOLVED' && (
                    <button
                      type="button"
                      onClick={() => {
                        setResolveTargetId(cmp.id);
                        setResolutionNote('');
                      }}
                      className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs shrink-0"
                    >
                      Resolve Issue
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: AUDIT TRAIL */}
      {activeTab === 'AUDIT' && (
        <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-4 font-mono text-xs">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
            <h2 className="font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-2 font-sans">
              <Activity className="w-4 h-4 text-emerald-500" /> Database Security & Lifecycle Audit Trail
            </h2>
            <span className="text-[11px] text-zinc-500">
              {auditLogs.length} audit events
            </span>
          </div>

          <div className="space-y-2 max-h-[480px] overflow-y-auto">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-start justify-between gap-3 text-[11px]"
              >
                <div>
                  <span className="text-zinc-500 block">
                    [{new Date(log.createdAt).toLocaleString()}] · {log.actorRole} ·{' '}
                    {log.actorName}
                  </span>
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">
                    {log.action} on {log.targetType} ({log.targetId})
                  </span>
                  <p className="text-zinc-600 dark:text-zinc-400 mt-0.5">{log.details}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reject Reason Modal (No window.prompt) */}
      {rejectTarget && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <form
            onSubmit={handleConfirmReject}
            className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-4"
          >
            <div className="flex items-center gap-2 text-rose-500">
              <ShieldAlert className="w-5 h-5" />
              <h3 className="font-bold text-base text-zinc-900 dark:text-white">
                Reject Verification
              </h3>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Specify the rejection reason for{' '}
              <strong>{rejectTarget.organizationName || rejectTarget.name}</strong>. They will see
              this message and may resubmit updated details.
            </p>
            <textarea
              rows={3}
              required
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                className="px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isBusy}
                className="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold"
              >
                Confirm Rejection
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Resolve Complaint Modal */}
      {resolveTargetId && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <form
            onSubmit={handleResolveComplaint}
            className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-4"
          >
            <h3 className="font-bold text-base">Resolve Safety / Logistics Issue</h3>
            <textarea
              rows={3}
              required
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              placeholder="Document resolution action taken..."
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setResolveTargetId(null)}
                className="px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isBusy}
                className="px-4 py-2 rounded-lg bg-emerald-500 text-zinc-950 text-xs font-bold"
              >
                Mark Resolved
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
