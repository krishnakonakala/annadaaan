import React, { useState } from 'react';
import { useApp } from '../../services/store.tsx';
import { calculateHaversineDistance } from '../../domain/matching.ts';
import {
  HeartHandshake,
  Search,
  ShieldCheck,
  ArrowRight,
  Award,
} from 'lucide-react';
import type { DonationItem } from '../../types/index.ts';

export const NgoDashboard: React.FC = () => {
  const {
    currentUser,
    donations,
    requests,
    requestDonation,
    confirmDonationReceipt,
    createComplaint,
    setSelectedDonationForCert,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'DISCOVER' | 'INCOMING' | 'HISTORY'>(
    'DISCOVER'
  );
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterVegOnly, setFilterVegOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const [requestModalDonation, setRequestModalDonation] =
    useState<DonationItem | null>(null);
  const [requestedKg, setRequestedKg] = useState<number>(20);

  const [receiptDonation, setReceiptDonation] = useState<DonationItem | null>(null);
  const [receiptNotes, setReceiptNotes] = useState(
    'Inspected food temperature and sealed containers. Safe for beneficiaries.'
  );

  const [issueOpen, setIssueOpen] = useState(false);
  const [issueSubject, setIssueSubject] = useState('');
  const [issueDesc, setIssueDesc] = useState('');

  if (!currentUser) return null;

  const availableDonations = donations.filter((d) => {
    if (d.status !== 'AVAILABLE') return false;
    if (new Date(d.safeConsumptionDeadline).getTime() < Date.now()) return false;
    if (filterVegOnly && !d.isVegetarian) return false;
    if (filterCategory !== 'ALL' && d.category !== filterCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        d.title.toLowerCase().includes(q) || d.donorName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const myPendingRequests = requests.filter(
    (r) => r.ngoId === currentUser.id && r.status === 'PENDING'
  );

  const myAllocatedDonations = donations.filter(
    (d) =>
      d.allocatedNgoId === currentUser.id &&
      ['APPROVED', 'ASSIGNED', 'PICKED_UP', 'DELIVERED'].includes(d.status)
  );

  const completedHistory = donations.filter(
    (d) => d.allocatedNgoId === currentUser.id && d.status === 'COMPLETED'
  );

  const totalReceivedKg = completedHistory.reduce((acc, d) => acc + d.quantityKg, 0);
  const totalMealsFed = completedHistory.reduce(
    (acc, d) => acc + d.estimatedServings,
    0
  );

  const handleOpenRequest = (donation: DonationItem) => {
    setActionError(null);
    setRequestModalDonation(donation);
    setRequestedKg(donation.quantityKg);
  };

  const handleConfirmRequest = async () => {
    if (!requestModalDonation) return;
    setIsBusy(true);
    setActionError(null);
    try {
      await requestDonation(requestModalDonation.id, requestedKg);
      setRequestModalDonation(null);
      setActiveTab('INCOMING');
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleConfirmReceiptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiptDonation) return;
    setIsBusy(true);
    setActionError(null);
    try {
      await confirmDonationReceipt(receiptDonation.id, receiptNotes);
      setReceiptDonation(null);
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setIsBusy(false);
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsBusy(true);
    try {
      await createComplaint({ subject: issueSubject, description: issueDesc });
      setIssueSubject('');
      setIssueDesc('');
      setIssueOpen(false);
    } finally {
      setIsBusy(false);
    }
  };

  const capacityPct = Math.round(
    ((currentUser.currentAvailableCapacityKg || 50) /
      (currentUser.maxReceivingCapacityKg || 100)) *
      100
  );

  return (
    <div className="space-y-6">
      {/* Header Summary */}
      <div className="p-6 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 mb-1">
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              NGO Operations
            </span>
            <span aria-hidden="true">·</span>
            <span>{currentUser.organizationType || 'Shelter'}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 font-mono">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              {currentUser.registrationNumber || 'Approved'}
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-white">
            {currentUser.organizationName || currentUser.name}
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 tabular-nums">
            {currentUser.location.address}, {currentUser.location.city} ·{' '}
            {currentUser.beneficiariesCount || 50} beneficiaries
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
            <span className="text-[11px] text-zinc-500 block">Available Capacity</span>
            <span className="text-base font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {currentUser.currentAvailableCapacityKg} / {currentUser.maxReceivingCapacityKg || 100} kg ({capacityPct}%)
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIssueOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-semibold whitespace-nowrap"
          >
            Report Issue
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 border-b border-zinc-200 dark:border-zinc-800 pb-3 overflow-x-auto">
        {[
          { id: 'DISCOVER', label: `Available Food (${availableDonations.length})` },
          {
            id: 'INCOMING',
            label: `Active Requests & Deliveries (${myPendingRequests.length + myAllocatedDonations.length})`,
          },
          { id: 'HISTORY', label: `Received History (${completedHistory.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              activeTab === tab.id
                ? 'bg-emerald-500 text-zinc-950 font-bold'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {actionError && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-600 dark:text-rose-300">
          {actionError}
        </div>
      )}

      {/* TAB: DISCOVER */}
      {activeTab === 'DISCOVER' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
              <input
                type="text"
                placeholder="Search food or donor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-xs"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs"
              >
                <option value="ALL">All Categories</option>
                <option value="COOKED_MEALS">Cooked Meals</option>
                <option value="RICE_AND_BIRYANI">Rice & Biryani</option>
                <option value="VEGETABLES">Vegetables</option>
                <option value="FRUITS">Fruits</option>
                <option value="BAKERY">Bakery</option>
              </select>

              <button
                type="button"
                onClick={() => setFilterVegOnly(!filterVegOnly)}
                className={`px-3 py-2 text-xs font-semibold rounded-lg border ${
                  filterVegOnly
                    ? 'bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                    : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
                }`}
              >
                Vegetarian Only
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableDonations.length === 0 ? (
              <div className="col-span-full p-12 text-center rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <HeartHandshake className="w-10 h-10 text-zinc-400 mx-auto mb-2" />
                <h3 className="text-sm font-bold">No available surplus food right now</h3>
                <p className="text-xs text-zinc-500 mt-1">
                  Adjust filters or check back when nearby donors publish new batches.
                </p>
              </div>
            ) : (
              availableDonations.map((item) => {
                const distance = calculateHaversineDistance(
                  currentUser.location.latitude,
                  currentUser.location.longitude,
                  item.pickupLocation.latitude,
                  item.pickupLocation.longitude
                );

                const safeHoursLeft = Math.max(
                  0,
                  (new Date(item.safeConsumptionDeadline).getTime() - Date.now()) /
                    (1000 * 3600)
                );

                return (
                  <div
                    key={item.id}
                    className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                        <span
                          className={`font-semibold ${
                            item.isVegetarian
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {item.isVegetarian ? 'Vegetarian' : 'Non-Vegetarian'}
                        </span>
                        <span className="font-mono tabular-nums">{distance} km away</span>
                      </div>

                      <h3 className="font-bold text-base text-zinc-900 dark:text-white">
                        {item.title}
                      </h3>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">
                        {item.description}
                      </p>

                      <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800 space-y-1 text-xs tabular-nums">
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Quantity</span>
                          <span className="font-semibold">
                            {item.quantityKg} kg ({item.estimatedServings} servings)
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Donor</span>
                          <span className="font-medium truncate max-w-[160px]">
                            {item.donorName}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Safe Window</span>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {safeHoursLeft.toFixed(1)} hrs left
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-zinc-500 truncate">
                        {item.pickupLocation.address}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenRequest(item)}
                        className="inline-flex items-center gap-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold rounded-lg whitespace-nowrap shrink-0"
                      >
                        <span>Request</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB: INCOMING */}
      {activeTab === 'INCOMING' && (
        <div className="space-y-4">
          {myPendingRequests.length > 0 && (
            <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
              <h2 className="font-bold text-sm">Awaiting Donor Approval</h2>
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {myPendingRequests.map((req) => (
                  <div key={req.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-zinc-900 dark:text-white">
                        {req.donationTitle}
                      </div>
                      <div className="text-zinc-500 font-mono tabular-nums">
                        {req.id} · Requested {req.requestedQuantityKg} kg
                      </div>
                    </div>
                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                      PENDING
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
            <h2 className="font-bold text-sm">Allocated & In-Transit Deliveries</h2>
            {myAllocatedDonations.length === 0 ? (
              <p className="text-xs text-zinc-500 py-6 text-center">
                No incoming deliveries currently assigned.
              </p>
            ) : (
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {myAllocatedDonations.map((item) => (
                  <div
                    key={item.id}
                    className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-mono font-semibold text-zinc-500">
                          {item.id}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-bold text-sky-600 dark:text-sky-400">
                          {item.status}
                        </span>
                      </div>
                      <h3 className="font-bold text-sm text-zinc-900 dark:text-white mt-0.5">
                        {item.title}
                      </h3>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5 tabular-nums">
                        From {item.donorName} · {item.quantityKg} kg ({item.estimatedServings} servings) · Courier:{' '}
                        <strong>{item.assignedVolunteerName || 'Pending assignment'}</strong>
                      </p>
                    </div>

                    <div>
                      {item.status === 'DELIVERED' ? (
                        <button
                          type="button"
                          onClick={() => setReceiptDonation(item)}
                          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold rounded-lg whitespace-nowrap"
                        >
                          Confirm Receipt
                        </button>
                      ) : (
                        <span className="text-xs text-zinc-500">
                          {item.status === 'PICKED_UP'
                            ? 'Courier en route to shelter'
                            : 'Awaiting pickup handover'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: HISTORY */}
      {activeTab === 'HISTORY' && (
        <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-sm">Completed Food Distributions</h2>
            <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
              Total Served: {totalReceivedKg} kg · {totalMealsFed} meals
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-950 text-[11px] font-semibold text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="px-4 py-3">Donation ID</th>
                  <th className="px-4 py-3">Food Title</th>
                  <th className="px-4 py-3">Donor</th>
                  <th className="px-4 py-3">Quantity</th>
                  <th className="px-4 py-3">Completed</th>
                  <th className="px-4 py-3 text-right">Certificate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {completedHistory.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                      {item.id}
                    </td>
                    <td className="px-4 py-3 font-semibold">{item.title}</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                      {item.donorName}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{item.quantityKg} kg</td>
                    <td className="px-4 py-3 font-mono text-zinc-500 tabular-nums">
                      {new Date(item.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedDonationForCert(item)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500/15 text-amber-700 dark:text-amber-300 text-xs font-semibold rounded-md"
                      >
                        <Award className="w-3.5 h-3.5" /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Request Modal */}
      {requestModalDonation && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-4">
            <div>
              <h3 className="font-bold text-base">Request Food Allocation</h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                {requestModalDonation.title} · {requestModalDonation.donorName}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Quantity Requested (kg)
              </label>
              <input
                type="number"
                min={1}
                max={requestModalDonation.quantityKg}
                value={requestedKg}
                onChange={(e) => setRequestedKg(Number(e.target.value))}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono tabular-nums"
              />
              <span className="text-[11px] text-zinc-500 mt-1 block tabular-nums">
                Available batch: {requestModalDonation.quantityKg} kg · Your capacity:{' '}
                {currentUser.currentAvailableCapacityKg} kg
              </span>
            </div>

            {actionError && (
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-600 dark:text-rose-300">
                {actionError}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRequestModalDonation(null)}
                className="px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={handleConfirmRequest}
                className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold"
              >
                {isBusy ? 'Submitting...' : 'Confirm Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Receipt Modal */}
      {receiptDonation && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <form
            onSubmit={handleConfirmReceiptSubmit}
            className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-4"
          >
            <div>
              <h3 className="font-bold text-base">Confirm Food Receipt & Quality</h3>
              <p className="text-xs text-zinc-500 mt-0.5">{receiptDonation.title}</p>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Inspection Notes
              </label>
              <textarea
                rows={3}
                required
                value={receiptNotes}
                onChange={(e) => setReceiptNotes(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReceiptDonation(null)}
                className="px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isBusy}
                className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold"
              >
                {isBusy ? 'Confirming...' : 'Mark Completed'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Report Issue Modal */}
      {issueOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <form
            onSubmit={handleReportSubmit}
            className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-4"
          >
            <h3 className="font-bold text-base">Report Delivery or Quality Issue</h3>
            <div>
              <label className="block text-xs font-semibold mb-1">Subject *</label>
              <input
                type="text"
                required
                value={issueSubject}
                onChange={(e) => setIssueSubject(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Description *</label>
              <textarea
                rows={3}
                required
                value={issueDesc}
                onChange={(e) => setIssueDesc(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIssueOpen(false)}
                className="px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isBusy}
                className="px-4 py-2 rounded-lg bg-emerald-500 text-zinc-950 text-xs font-bold"
              >
                Submit Report
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
