import React, { useState } from 'react';
import { useApp } from '../../services/store.tsx';
import {
  PlusCircle,
  Clock,
  MapPin,
  Award,
  CheckCircle2,
  ShieldCheck,
  QrCode,
} from 'lucide-react';
import type { DonationOccasion, FoodCategory, DonationItem } from '../../types/index.ts';

export const IndividualDonorDashboard: React.FC = () => {
  const {
    currentUser,
    donations,
    requests,
    createDonation,
    acceptDonationRequest,
    rejectDonationRequest,
    setSelectedDonationForCert,
    setSelectedDonationForQr,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'WIZARD' | 'REQUESTS' | 'HISTORY'>(
    'DASHBOARD'
  );
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [isBusy, setIsBusy] = useState(false);

  if (!currentUser) return null;

  const [formData, setFormData] = useState({
    title: '',
    category: 'COOKED_MEALS' as FoodCategory,
    description: '',
    isVegetarian: true,
    quantityKg: 15,
    estimatedServings: 35,
    occasion: 'WEDDING' as DonationOccasion,
    safeHours: 6,
    storageConditions: 'Hygienically packaged in disposable food boxes',
    pickupAddress: currentUser.location.address,
    pickupCity: currentUser.location.city,
    pickupTimeWindow: 'Within next 2 hours',
    specialInstructions: 'Call mobile on arrival.',
  });

  const [lastSubmittedDonation, setLastSubmittedDonation] =
    useState<DonationItem | null>(null);

  const myDonations = donations.filter((d) => d.donorId === currentUser.id);
  const myRequests = requests.filter((r) => {
    const donation = donations.find((d) => d.id === r.donationId);
    return donation && donation.donorId === currentUser.id;
  });

  const totalMealsContributed = myDonations.reduce(
    (acc, d) => acc + (d.status === 'COMPLETED' ? d.estimatedServings : 0),
    0
  );
  const totalKgContributed = myDonations.reduce(
    (acc, d) => acc + (d.status === 'COMPLETED' ? d.quantityKg : 0),
    0
  );

  const handleSubmitWizard = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsBusy(true);
    try {
      const safeDeadline = new Date(
        Date.now() + formData.safeHours * 3600 * 1000
      ).toISOString();
      const expiry = new Date(
        Date.now() + (formData.safeHours + 2) * 3600 * 1000
      ).toISOString();

      const res = await createDonation({
        title: formData.title,
        category: formData.category,
        description: formData.description || `${formData.occasion} surplus meal batch`,
        isVegetarian: formData.isVegetarian,
        quantityKg: Number(formData.quantityKg),
        estimatedServings: Number(formData.estimatedServings),
        occasion: formData.occasion,
        safeConsumptionDeadline: safeDeadline,
        expiryTimestamp: expiry,
        storageConditions: formData.storageConditions,
        pickupLocation: {
          ...currentUser.location,
          address: formData.pickupAddress,
          city: formData.pickupCity,
        },
        pickupTimeWindow: formData.pickupTimeWindow,
        specialInstructions: formData.specialInstructions,
        status: 'AVAILABLE',
      });

      setLastSubmittedDonation(res.donation);
      setWizardStep(5);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Summary */}
      <div className="p-6 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-rose-600 dark:text-rose-400 mb-1">
            Individual Donor
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

        <button
          type="button"
          onClick={() => {
            setActiveTab('WIZARD');
            setWizardStep(1);
            setLastSubmittedDonation(null);
          }}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs whitespace-nowrap"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Donate Event Surplus</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 border-b border-zinc-200 dark:border-zinc-800 pb-3 overflow-x-auto">
        {[
          { id: 'DASHBOARD', label: 'Active Tracker' },
          { id: 'WIZARD', label: 'Donate Food Wizard' },
          {
            id: 'REQUESTS',
            label: `NGO Requests (${myRequests.filter((r) => r.status === 'PENDING').length})`,
          },
          { id: 'HISTORY', label: `History & Certificates (${myDonations.length})` },
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

      {activeTab === 'DASHBOARD' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <span className="text-xs text-zinc-500 block mb-1">Meals Rescued</span>
              <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 tabular-nums">
                {totalMealsContributed}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <span className="text-xs text-zinc-500 block mb-1">Food Shared</span>
              <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {totalKgContributed} kg
              </div>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <span className="text-xs text-zinc-500 block mb-1">Total Donations</span>
              <div className="text-2xl font-extrabold text-sky-600 dark:text-sky-400 tabular-nums">
                {myDonations.length}
              </div>
            </div>
          </div>

          <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-4">
            <h2 className="font-bold text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-500" /> Donation Status Tracker
            </h2>
            {myDonations.length === 0 ? (
              <p className="text-xs text-zinc-500 py-6 text-center">
                No donations posted yet.
              </p>
            ) : (
              <div className="space-y-4">
                {myDonations.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="text-xs text-zinc-500 font-mono">
                          {item.id} · {item.status}
                          {item.occasion ? ` · ${item.occasion}` : ''}
                        </div>
                        <h3 className="font-bold text-sm text-zinc-900 dark:text-white mt-0.5">
                          {item.title}
                        </h3>
                        <p className="text-xs text-zinc-500 tabular-nums">
                          {item.quantityKg} kg · {item.estimatedServings} servings
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedDonationForQr(item)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-xs font-semibold"
                        >
                          <QrCode className="w-3.5 h-3.5" /> Pickup QR
                        </button>
                        {item.status === 'COMPLETED' && (
                          <button
                            type="button"
                            onClick={() => setSelectedDonationForCert(item)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 text-xs font-semibold"
                          >
                            <Award className="w-3.5 h-3.5" /> Certificate
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-center text-[11px] font-semibold">
                      <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                        1. Published
                      </div>
                      <div
                        className={`p-2 rounded-lg ${
                          [
                            'REQUESTED',
                            'APPROVED',
                            'ASSIGNED',
                            'PICKED_UP',
                            'DELIVERED',
                            'COMPLETED',
                          ].includes(item.status)
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                            : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'
                        }`}
                      >
                        2. Matched
                      </div>
                      <div
                        className={`p-2 rounded-lg ${
                          ['PICKED_UP', 'DELIVERED', 'COMPLETED'].includes(item.status)
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                            : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'
                        }`}
                      >
                        3. Picked Up
                      </div>
                      <div
                        className={`p-2 rounded-lg ${
                          item.status === 'COMPLETED'
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                            : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'
                        }`}
                      >
                        4. Completed
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'WIZARD' && (
        <div className="max-w-2xl mx-auto p-6 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-5">
          <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
            {[
              { num: 1, label: 'Food' },
              { num: 2, label: 'Safety' },
              { num: 3, label: 'Occasion' },
              { num: 4, label: 'Pickup' },
              { num: 5, label: 'Done' },
            ].map((step) => (
              <div key={step.num} className="flex items-center gap-1.5">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold tabular-nums ${
                    wizardStep === step.num
                      ? 'bg-emerald-500 text-zinc-950'
                      : wizardStep > step.num
                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'
                  }`}
                >
                  {wizardStep > step.num ? '✓' : step.num}
                </div>
                <span className="hidden sm:inline text-xs font-medium">{step.label}</span>
              </div>
            ))}
          </div>

          {wizardStep === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  What food would you like to donate? *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Wedding Feast Rice, Dal & Paneer Curry"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3.5 py-2.5 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Dietary Type</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, isVegetarian: true })}
                      className={`flex-1 py-2 text-xs font-semibold rounded-lg border ${
                        formData.isVegetarian
                          ? 'bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                          : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-500'
                      }`}
                    >
                      Vegetarian
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, isVegetarian: false })}
                      className={`flex-1 py-2 text-xs font-semibold rounded-lg border ${
                        !formData.isVegetarian
                          ? 'bg-rose-500/15 border-rose-500 text-rose-600 dark:text-rose-400'
                          : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-500'
                      }`}
                    >
                      Non-Veg
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Quantity (kg)</label>
                  <input
                    type="number"
                    min={1}
                    value={formData.quantityKg}
                    onChange={(e) => {
                      const kg = Number(e.target.value);
                      setFormData({
                        ...formData,
                        quantityKg: kg,
                        estimatedServings: Math.round(kg * 2.5),
                      });
                    }}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono tabular-nums"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={!formData.title.trim()}
                  onClick={() => setWizardStep(2)}
                  className="px-5 py-2 rounded-lg bg-emerald-500 text-zinc-950 font-bold text-xs disabled:opacity-40"
                >
                  Next: Safety
                </button>
              </div>
            </div>
          )}

          {wizardStep === 2 && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Please declare honest safe consumption hours so nearby shelters can serve meals safely.
                </span>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Safe Consumption Hours
                </label>
                <select
                  value={formData.safeHours}
                  onChange={(e) =>
                    setFormData({ ...formData, safeHours: Number(e.target.value) })
                  }
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono"
                >
                  <option value={4}>4 Hours</option>
                  <option value={6}>6 Hours</option>
                  <option value={10}>10 Hours (Refrigerated)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Packaging & Storage
                </label>
                <input
                  type="text"
                  value={formData.storageConditions}
                  onChange={(e) =>
                    setFormData({ ...formData, storageConditions: e.target.value })
                  }
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs"
                />
              </div>
              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => setWizardStep(1)}
                  className="px-4 py-2 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-xs font-semibold"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setWizardStep(3)}
                  className="px-5 py-2 rounded-lg bg-emerald-500 text-zinc-950 font-bold text-xs"
                >
                  Next: Occasion
                </button>
              </div>
            </div>
          )}

          {wizardStep === 3 && (
            <div className="space-y-4">
              <label className="block text-xs font-semibold">Event Occasion</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { id: 'WEDDING', label: 'Wedding' },
                  { id: 'BIRTHDAY', label: 'Birthday' },
                  { id: 'FESTIVAL', label: 'Festival' },
                  { id: 'FAMILY_FUNCTION', label: 'Family Function' },
                  { id: 'CORPORATE_EVENT', label: 'Corporate Event' },
                  { id: 'COMMUNITY_GATHERING', label: 'Community Feast' },
                ].map((occ) => (
                  <button
                    key={occ.id}
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, occasion: occ.id as DonationOccasion })
                    }
                    className={`p-3 text-xs font-semibold rounded-lg border text-left ${
                      formData.occasion === occ.id
                        ? 'bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                        : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-500'
                    }`}
                  >
                    {occ.label}
                  </button>
                ))}
              </div>
              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => setWizardStep(2)}
                  className="px-4 py-2 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-xs font-semibold"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setWizardStep(4)}
                  className="px-5 py-2 rounded-lg bg-emerald-500 text-zinc-950 font-bold text-xs"
                >
                  Next: Pickup Details
                </button>
              </div>
            </div>
          )}

          {wizardStep === 4 && (
            <form onSubmit={handleSubmitWizard} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Pickup Address *
                </label>
                <input
                  type="text"
                  required
                  value={formData.pickupAddress}
                  onChange={(e) =>
                    setFormData({ ...formData, pickupAddress: e.target.value })
                  }
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">City</label>
                  <input
                    type="text"
                    value={formData.pickupCity}
                    onChange={(e) =>
                      setFormData({ ...formData, pickupCity: e.target.value })
                    }
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Pickup Window
                  </label>
                  <input
                    type="text"
                    value={formData.pickupTimeWindow}
                    onChange={(e) =>
                      setFormData({ ...formData, pickupTimeWindow: e.target.value })
                    }
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs"
                  />
                </div>
              </div>
              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => setWizardStep(3)}
                  className="px-4 py-2 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-xs font-semibold"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isBusy}
                  className="px-5 py-2 rounded-lg bg-emerald-500 text-zinc-950 font-bold text-xs"
                >
                  {isBusy ? 'Publishing...' : 'Submit Donation'}
                </button>
              </div>
            </form>
          )}

          {wizardStep === 5 && lastSubmittedDonation && (
            <div className="text-center space-y-4 py-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <h3 className="font-bold text-base">Donation Published</h3>
              <p className="text-xs text-zinc-500 font-mono">{lastSubmittedDonation.id}</p>
              <div className="flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedDonationForQr(lastSubmittedDonation)}
                  className="px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-semibold"
                >
                  Show Pickup QR
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('DASHBOARD')}
                  className="px-4 py-2 rounded-lg bg-emerald-500 text-zinc-950 text-xs font-bold"
                >
                  View Tracker
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'REQUESTS' && (
        <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-4">
          <h2 className="font-bold text-sm">NGO Allocation Requests</h2>
          {myRequests.length === 0 ? (
            <p className="text-xs text-zinc-500 py-6 text-center">No requests yet.</p>
          ) : (
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {myRequests.map((req) => (
                <div
                  key={req.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="font-bold text-sm">{req.ngoName}</div>
                    <div className="text-xs text-zinc-500 tabular-nums">
                      {req.donationTitle} · {req.requestedQuantityKg} kg
                    </div>
                  </div>
                  {req.status === 'PENDING' ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => acceptDonationRequest(req.id)}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-500 text-zinc-950 text-xs font-bold"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => rejectDonationRequest(req.id, 'Already allocated')}
                        className="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-semibold"
                      >
                        Decline
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs font-bold">{req.status}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'HISTORY' && (
        <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
          <h2 className="font-bold text-sm">Donation History & Certificates</h2>
          {myDonations.length === 0 ? (
            <p className="text-xs text-zinc-500 py-6 text-center">No past donations.</p>
          ) : (
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {myDonations.map((item) => (
                <div key={item.id} className="py-3.5 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-sm">{item.title}</div>
                    <div className="text-xs text-zinc-500 tabular-nums">
                      {item.quantityKg} kg · {item.status} ·{' '}
                      {new Date(item.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  {item.status === 'COMPLETED' && (
                    <button
                      type="button"
                      onClick={() => setSelectedDonationForCert(item)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 text-xs font-semibold"
                    >
                      <Award className="w-3.5 h-3.5" /> Certificate
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
