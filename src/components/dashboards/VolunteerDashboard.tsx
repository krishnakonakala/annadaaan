import React, { useState } from 'react';
import { useApp } from '../../services/store.tsx';
import {
  Truck,
  MapPin,
  QrCode,
  CheckCircle2,
  Navigation,
  PackageCheck,
  AlertTriangle,
} from 'lucide-react';
import { calculateHaversineDistance } from '../../domain/matching.ts';

export const VolunteerDashboard: React.FC = () => {
  const {
    currentUser,
    assignments,
    donations,
    assignVolunteerToDonation,
    verifyPickupByQr,
    verifyDeliveryByQr,
    createComplaint,
    setSelectedDonationForQr,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'AVAILABLE' | 'HISTORY'>('ACTIVE');
  const [manualQrToken, setManualQrToken] = useState('');
  const [scanMessage, setScanMessage] = useState<{ success: boolean; message: string } | null>(
    null
  );
  const [isBusy, setIsBusy] = useState(false);

  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [issueSubject, setIssueSubject] = useState('');
  const [issueDesc, setIssueDesc] = useState('');

  if (!currentUser) return null;

  const myAssignments = assignments.filter((a) => a.volunteerId === currentUser.id);
  const activeAssignments = myAssignments.filter((a) =>
    ['ASSIGNED', 'PICKED_UP'].includes(a.status)
  );
  const completedTasks = myAssignments.filter((a) => a.status === 'DELIVERED');

  // Donations explicitly assigned to this volunteer (active)
  const myActiveDonations = donations.filter(
    (d) =>
      d.assignedVolunteerId === currentUser.id &&
      ['ASSIGNED', 'PICKED_UP'].includes(d.status)
  );
  const primaryActiveDonation = myActiveDonations[0] ?? null;
  const primaryActiveAssignment = primaryActiveDonation
    ? activeAssignments.find((a) => a.donationId === primaryActiveDonation.id)
    : activeAssignments[0];

  // Approved donations awaiting a courier
  const availableApprovedMissions = donations.filter(
    (d) => d.status === 'APPROVED' && !d.assignedVolunteerId
  );

  const handleVerifyPickup = async (donationId: string, token: string) => {
    setIsBusy(true);
    setScanMessage(null);
    try {
      const res = await verifyPickupByQr(donationId, token.trim());
      setScanMessage(res);
      if (res.success) setManualQrToken('');
    } finally {
      setIsBusy(false);
    }
  };

  const handleVerifyDelivery = async (donationId: string, token: string) => {
    setIsBusy(true);
    setScanMessage(null);
    try {
      const res = await verifyDeliveryByQr(donationId, token.trim());
      setScanMessage(res);
      if (res.success) setManualQrToken('');
    } finally {
      setIsBusy(false);
    }
  };

  const handleClaimMission = async (donationId: string) => {
    setIsBusy(true);
    setScanMessage(null);
    try {
      await assignVolunteerToDonation(donationId);
      setScanMessage({
        success: true,
        message: `Claimed rescue mission ${donationId}. Proceed to donor pickup location.`,
      });
      setActiveTab('ACTIVE');
    } catch (err) {
      setScanMessage({ success: false, message: (err as Error).message });
    } finally {
      setIsBusy(false);
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsBusy(true);
    try {
      await createComplaint({
        subject: issueSubject,
        description: issueDesc,
        donationId: primaryActiveDonation?.id,
      });
      setIssueSubject('');
      setIssueDesc('');
      setIssueModalOpen(false);
      setScanMessage({
        success: true,
        message: 'Field issue reported to operations team.',
      });
    } catch (err) {
      setScanMessage({ success: false, message: (err as Error).message });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Summary */}
      <div className="p-6 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 mb-1">
            <span className="font-semibold text-sky-600 dark:text-sky-400">
              Volunteer Courier
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">
              {currentUser.vehicleType || 'Two Wheeler'} · Max Range{' '}
              {currentUser.maxTravelDistanceKm || 15} km
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-white">
            {currentUser.name}
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" />
            <span>
              {currentUser.location.address}, {currentUser.location.city}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-right">
            <span className="text-[11px] text-zinc-500 block">Completed Deliveries</span>
            <span className="text-lg font-extrabold text-sky-600 dark:text-sky-400 tabular-nums">
              {completedTasks.length}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIssueModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-semibold text-zinc-800 dark:text-zinc-200 whitespace-nowrap"
          >
            Report Field Issue
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1.5 border-b border-zinc-200 dark:border-zinc-800 pb-3 overflow-x-auto">
        {[
          {
            id: 'ACTIVE',
            label: `Active Mission (${myActiveDonations.length})`,
          },
          {
            id: 'AVAILABLE',
            label: `Open Pickups (${availableApprovedMissions.length})`,
          },
          {
            id: 'HISTORY',
            label: `Completed Runs (${completedTasks.length})`,
          },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              activeTab === tab.id
                ? 'bg-sky-500 text-zinc-950 font-bold'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {scanMessage && (
        <div
          className={`p-3.5 rounded-xl text-xs font-medium border ${
            scanMessage.success
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
          }`}
        >
          {scanMessage.message}
        </div>
      )}

      {/* TAB: ACTIVE MISSION */}
      {activeTab === 'ACTIVE' && (
        <div className="space-y-6">
          {myActiveDonations.length === 0 ? (
            <div className="p-10 text-center rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
              <Truck className="w-10 h-10 text-zinc-400 dark:text-zinc-600 mx-auto" />
              <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                No Active Pickup Assigned
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
                {availableApprovedMissions.length > 0
                  ? `${availableApprovedMissions.length} approved food rescue pickup(s) are ready for dispatch.`
                  : 'You are on standby. Approved NGO allocations will appear here and in Open Pickups.'}
              </p>
              {availableApprovedMissions.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('AVAILABLE')}
                  className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-zinc-950 font-bold text-xs"
                >
                  View Open Pickups ({availableApprovedMissions.length})
                </button>
              )}
            </div>
          ) : (
            myActiveDonations.map((donation) => {
              const assignment =
                activeAssignments.find((a) => a.donationId === donation.id) ||
                primaryActiveAssignment;
              const isAssigned = donation.status === 'ASSIGNED';
              const isPickedUp = donation.status === 'PICKED_UP';

              return (
                <div key={donation.id} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 p-6 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-5">
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-4">
                      <div>
                        <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono">
                          <span>{assignment?.id || donation.id}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-bold text-sky-600 dark:text-sky-400">
                            {donation.status}
                          </span>
                        </div>
                        <h2 className="font-bold text-lg text-zinc-900 dark:text-white mt-0.5">
                          {donation.title}
                        </h2>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums mt-0.5">
                          {donation.quantityKg} kg · ~{donation.estimatedServings} servings
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedDonationForQr(donation)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-semibold text-zinc-800 dark:text-zinc-200"
                      >
                        <QrCode className="w-4 h-4" /> Show QR Tokens
                      </button>
                    </div>

                    {/* Waypoints */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1">
                        <span className="text-[11px] font-mono text-amber-600 dark:text-amber-400 font-semibold">
                          1. PICKUP ORIGIN
                        </span>
                        <h3 className="font-bold text-sm text-zinc-900 dark:text-white">
                          {donation.donorName}
                        </h3>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400">
                          {donation.pickupLocation.address}, {donation.pickupLocation.city}
                        </p>
                        <p className="text-[11px] font-mono text-zinc-500 tabular-nums pt-1">
                          Safe deadline:{' '}
                          {new Date(donation.safeConsumptionDeadline).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>

                      <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1">
                        <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                          2. DESTINATION SHELTER
                        </span>
                        <h3 className="font-bold text-sm text-zinc-900 dark:text-white">
                          {donation.allocatedNgoName || 'Allocated Shelter'}
                        </h3>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400">
                          {assignment?.deliveryAddress || donation.pickupLocation.city}
                        </p>
                        <p className="text-[11px] text-zinc-500 pt-1">
                          Scan Delivery QR on handover
                        </p>
                      </div>
                    </div>

                    {/* QR Verification Controls */}
                    <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-3">
                      <h3 className="text-xs font-bold uppercase font-mono text-zinc-700 dark:text-zinc-300">
                        Chain-of-Custody Verification
                      </h3>

                      <div className="flex flex-col sm:flex-row gap-2.5">
                        <button
                          type="button"
                          disabled={!isAssigned || isBusy}
                          onClick={() => handleVerifyPickup(donation.id, donation.pickupQrCode)}
                          className="flex-1 py-2.5 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold disabled:opacity-35 inline-flex items-center justify-center gap-1.5"
                        >
                          <QrCode className="w-4 h-4" />
                          <span>1. Verify Pickup QR</span>
                        </button>

                        <button
                          type="button"
                          disabled={!isPickedUp || isBusy}
                          onClick={() =>
                            handleVerifyDelivery(donation.id, donation.deliveryQrCode)
                          }
                          className="flex-1 py-2.5 px-4 rounded-lg bg-sky-500 hover:bg-sky-400 text-zinc-950 text-xs font-bold disabled:opacity-35 inline-flex items-center justify-center gap-1.5"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>2. Verify Delivery QR</span>
                        </button>
                      </div>

                      <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={manualQrToken}
                          onChange={(e) => setManualQrToken(e.target.value)}
                          placeholder={
                            isAssigned
                              ? `Enter Pickup Token (e.g. ${donation.pickupQrCode})`
                              : `Enter Delivery Token (e.g. ${donation.deliveryQrCode})`
                          }
                          className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono"
                        />
                        <button
                          type="button"
                          disabled={!manualQrToken.trim() || isBusy}
                          onClick={() =>
                            isAssigned
                              ? handleVerifyPickup(donation.id, manualQrToken)
                              : handleVerifyDelivery(donation.id, manualQrToken)
                          }
                          className="px-4 py-2 rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-xs font-semibold disabled:opacity-40"
                        >
                          Submit Token
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Logistics Guidance Sidebar */}
                  <div className="space-y-4">
                    <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
                      <h3 className="font-bold text-xs uppercase font-mono text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                        <Navigation className="w-4 h-4 text-sky-500" /> Route Dispatch
                      </h3>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                        Storage: {donation.storageConditions}
                      </p>
                      {donation.specialInstructions && (
                        <p className="text-xs text-zinc-600 dark:text-zinc-400">
                          Pickup Note: {donation.specialInstructions}
                        </p>
                      )}
                      {assignment && (
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&origin=${assignment.pickupCoordinates[0]},${assignment.pickupCoordinates[1]}&destination=${assignment.deliveryCoordinates[0]},${assignment.deliveryCoordinates[1]}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-semibold text-zinc-800 dark:text-zinc-200"
                        >
                          Open Route in Maps ↗
                        </a>
                      )}
                    </div>

                    <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs space-y-2">
                      <span className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                        Transit Safety Checklist
                      </span>
                      <ul className="list-disc pl-4 text-zinc-600 dark:text-zinc-400 space-y-1">
                        <li>Keep food containers sealed and upright during transit.</li>
                        <li>Verify pickup QR with kitchen staff before departure.</li>
                        <li>Obtain NGO shelter delivery QR upon handover.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB: OPEN PICKUPS */}
      {activeTab === 'AVAILABLE' && (
        <div className="space-y-4">
          {availableApprovedMissions.length === 0 ? (
            <div className="p-10 text-center rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
              All approved donations currently have assigned couriers.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {availableApprovedMissions.map((item) => {
                const distKm = calculateHaversineDistance(
                  currentUser.location.latitude,
                  currentUser.location.longitude,
                  item.pickupLocation.latitude,
                  item.pickupLocation.longitude
                );
                return (
                  <div
                    key={item.id}
                    className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400">
                          {item.id} · {distKm.toFixed(1)} km from you
                        </span>
                        <h3 className="font-bold text-sm text-zinc-900 dark:text-white mt-0.5">
                          {item.title}
                        </h3>
                      </div>
                      <span className="text-xs font-bold tabular-nums text-amber-600 dark:text-amber-400">
                        {item.quantityKg} kg
                      </span>
                    </div>

                    <div className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1">
                      <div>
                        From: <strong className="text-zinc-800 dark:text-zinc-200">{item.donorName}</strong> ({item.pickupLocation.address})
                      </div>
                      <div>
                        To: <strong className="text-zinc-800 dark:text-zinc-200">{item.allocatedNgoName}</strong>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleClaimMission(item.id)}
                      className="w-full py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-zinc-950 font-bold text-xs inline-flex items-center justify-center gap-1.5"
                    >
                      <PackageCheck className="w-4 h-4" />
                      <span>Claim Rescue Mission</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB: DELIVERY HISTORY */}
      {activeTab === 'HISTORY' && (
        <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
          <h2 className="font-bold text-sm text-zinc-900 dark:text-white">
            Completed Courier History
          </h2>
          {completedTasks.length === 0 ? (
            <p className="text-xs text-zinc-500 py-8 text-center">
              No completed deliveries recorded yet.
            </p>
          ) : (
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {completedTasks.map((run) => (
                <div
                  key={run.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <h3 className="font-bold text-zinc-900 dark:text-white">
                      {run.donationTitle}
                    </h3>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {run.donorName} → {run.ngoName}
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      DELIVERED
                    </span>
                    <span className="block text-[11px] text-zinc-500 font-mono tabular-nums">
                      {run.completedAt
                        ? new Date(run.completedAt).toLocaleString()
                        : new Date(run.assignedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Report Issue Modal */}
      {issueModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <form
            onSubmit={handleReportSubmit}
            className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-4"
          >
            <h3 className="font-bold text-base">Report Field Logistics Issue</h3>
            <div>
              <label className="block text-xs font-semibold mb-1">Subject *</label>
              <input
                type="text"
                required
                value={issueSubject}
                onChange={(e) => setIssueSubject(e.target.value)}
                placeholder="e.g., Donor gate delayed / Container seal issue"
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
                onClick={() => setIssueModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isBusy}
                className="px-4 py-2 rounded-lg bg-sky-500 text-zinc-950 text-xs font-bold"
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
