import React, { useState } from 'react';
import { useApp } from '../../services/store.tsx';
import {
  UtensilsCrossed,
  PlusCircle,
  ShieldCheck,
  MapPin,
  CheckCircle,
  QrCode,
  Award,
  AlertTriangle,
  Send,
  XCircle,
} from 'lucide-react';
import type { FoodCategory, DonationItem, MatchingResult } from '../../types/index.ts';

export const RestaurantDashboard: React.FC = () => {
  const {
    currentUser,
    donations,
    requests,
    createDonation,
    publishDonation,
    cancelDonation,
    acceptDonationRequest,
    rejectDonationRequest,
    createComplaint,
    setSelectedDonationForQr,
    setSelectedDonationForCert,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'CREATE' | 'DONATIONS' | 'REQUESTS'>(
    'OVERVIEW'
  );
  const [createStep, setCreateStep] = useState<number>(1);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const [issueSubject, setIssueSubject] = useState('');
  const [issueDesc, setIssueDesc] = useState('');
  const [issueModalOpen, setIssueModalOpen] = useState(false);

  if (!currentUser) return null;

  const [formData, setFormData] = useState({
    title: '',
    category: 'COOKED_MEALS' as FoodCategory,
    description: '',
    isVegetarian: true,
    quantityKg: 25,
    estimatedServings: 60,
    preparationTimestamp: new Date().toISOString().substring(0, 16),
    safeHours: 5,
    storageConditions: 'Insulated hot warmer containers (65°C+)',
    allergenInfo: 'None',
    pickupAddress: currentUser.location.address,
    pickupCity: currentUser.location.city,
    pickupTimeWindow: 'Within next 90 minutes',
    specialInstructions: 'Enter through service gate.',
  });

  const [createdResult, setCreatedResult] = useState<{
    donation: DonationItem;
    matches: MatchingResult[];
  } | null>(null);

  const myDonations = donations.filter((d) => d.donorId === currentUser.id);
  const myRequests = requests.filter((r) => {
    const donation = donations.find((d) => d.id === r.donationId);
    return donation && donation.donorId === currentUser.id;
  });

  const totalKg = myDonations.reduce(
    (acc, d) => acc + (d.status === 'COMPLETED' ? d.quantityKg : 0),
    0
  );
  const totalMeals = myDonations.reduce(
    (acc, d) => acc + (d.status === 'COMPLETED' ? d.estimatedServings : 0),
    0
  );
  const activeDonationsCount = myDonations.filter((d) =>
    ['AVAILABLE', 'REQUESTED', 'APPROVED', 'ASSIGNED', 'PICKED_UP', 'DELIVERED'].includes(
      d.status
    )
  ).length;

  const submitDonation = async (status: 'DRAFT' | 'AVAILABLE') => {
    setActionError(null);
    setIsBusy(true);
    try {
      const safeDeadline = new Date(
        Date.now() + formData.safeHours * 3600 * 1000
      ).toISOString();
      const expiry = new Date(
        Date.now() + (formData.safeHours + 3) * 3600 * 1000
      ).toISOString();

      const res = await createDonation({
        title: formData.title,
        category: formData.category,
        description: formData.description,
        isVegetarian: formData.isVegetarian,
        quantityKg: Number(formData.quantityKg),
        estimatedServings: Number(formData.estimatedServings),
        preparationTimestamp: new Date(formData.preparationTimestamp).toISOString(),
        safeConsumptionDeadline: safeDeadline,
        expiryTimestamp: expiry,
        storageConditions: formData.storageConditions,
        allergenInfo: formData.allergenInfo,
        pickupLocation: {
          ...currentUser.location,
          address: formData.pickupAddress,
          city: formData.pickupCity,
        },
        pickupTimeWindow: formData.pickupTimeWindow,
        specialInstructions: formData.specialInstructions,
        status,
      });

      setCreatedResult(res);
      setCreateStep(4);
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
      setIssueModalOpen(false);
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
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              Restaurant Partner
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 font-mono">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              {currentUser.licenseNumber || 'FSSAI Verified'}
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-white">
            {currentUser.organizationName || currentUser.name}
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" />
            <span>
              {currentUser.location.address}, {currentUser.location.city}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIssueModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-semibold text-zinc-800 dark:text-zinc-200 whitespace-nowrap"
          >
            Report Issue
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('CREATE');
              setCreateStep(1);
              setCreatedResult(null);
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs whitespace-nowrap transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Publish Surplus Food</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1.5 border-b border-zinc-200 dark:border-zinc-800 pb-3 overflow-x-auto">
        {[
          { id: 'OVERVIEW', label: 'Overview' },
          { id: 'DONATIONS', label: `Donations (${myDonations.length})` },
          {
            id: 'REQUESTS',
            label: `NGO Requests (${myRequests.filter((r) => r.status === 'PENDING').length})`,
          },
          { id: 'CREATE', label: 'New Donation' },
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

      {/* TAB: OVERVIEW */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <span className="text-xs text-zinc-500 dark:text-zinc-400 block mb-1">
                Food Rescued
              </span>
              <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {totalKg} kg
              </div>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 block">
                Completed deliveries
              </span>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <span className="text-xs text-zinc-500 dark:text-zinc-400 block mb-1">
                Meals Distributed
              </span>
              <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 tabular-nums">
                {totalMeals}
              </div>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 block">
                Estimated servings delivered
              </span>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <span className="text-xs text-zinc-500 dark:text-zinc-400 block mb-1">
                Active Postings
              </span>
              <div className="text-2xl font-extrabold text-sky-600 dark:text-sky-400 tabular-nums">
                {activeDonationsCount}
              </div>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 block">
                Awaiting pickup or in transit
              </span>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <span className="text-xs text-zinc-500 dark:text-zinc-400 block mb-1">
                CO₂ Prevented
              </span>
              <div className="text-2xl font-extrabold text-teal-600 dark:text-teal-400 tabular-nums">
                {(totalKg * 2.5).toFixed(0)} kg
              </div>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 block">
                Estimated emissions saved
              </span>
            </div>
          </div>

          <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-2">
                <UtensilsCrossed className="w-4 h-4 text-emerald-500" /> Recent Donations
              </h2>
              <button
                type="button"
                onClick={() => setActiveTab('DONATIONS')}
                className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                View all
              </button>
            </div>

            {myDonations.length === 0 ? (
              <div className="py-8 text-center space-y-3">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  No surplus food postings yet.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('CREATE')}
                  className="px-4 py-2 rounded-lg bg-emerald-500 text-zinc-950 font-bold text-xs"
                >
                  Create First Donation
                </button>
              </div>
            ) : (
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {myDonations.slice(0, 4).map((item) => (
                  <div
                    key={item.id}
                    className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                        <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200">
                          {item.id}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {item.status}
                        </span>
                      </div>
                      <h3 className="font-bold text-sm text-zinc-900 dark:text-white mt-0.5">
                        {item.title}
                      </h3>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                        {item.quantityKg} kg · {item.estimatedServings} servings · Safe until{' '}
                        {new Date(item.safeConsumptionDeadline).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {item.status === 'DRAFT' && (
                        <button
                          type="button"
                          onClick={() => publishDonation(item.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold"
                        >
                          <Send className="w-3.5 h-3.5" /> Publish
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedDonationForQr(item)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-semibold text-zinc-800 dark:text-zinc-200"
                      >
                        <QrCode className="w-3.5 h-3.5" /> QR Token
                      </button>
                      {item.status === 'COMPLETED' && (
                        <button
                          type="button"
                          onClick={() => setSelectedDonationForCert(item)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-xs font-semibold text-amber-700 dark:text-amber-300"
                        >
                          <Award className="w-3.5 h-3.5" /> Certificate
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: CREATE WIZARD */}
      {activeTab === 'CREATE' && (
        <div className="max-w-2xl mx-auto p-6 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-5">
          <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
            {[
              { num: 1, label: 'Food Info' },
              { num: 2, label: 'Safety Window' },
              { num: 3, label: 'Pickup Details' },
              { num: 4, label: 'Matches' },
            ].map((step) => (
              <div key={step.num} className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold tabular-nums ${
                    createStep === step.num
                      ? 'bg-emerald-500 text-zinc-950'
                      : createStep > step.num
                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'
                  }`}
                >
                  {createStep > step.num ? '✓' : step.num}
                </div>
                <span className="hidden sm:inline text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  {step.label}
                </span>
              </div>
            ))}
          </div>

          {createStep === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Food Item Name / Title *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Executive Buffet Paneer Butter Masala & Pulao"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3.5 py-2.5 text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value as FoodCategory })
                    }
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs"
                  >
                    <option value="COOKED_MEALS">Cooked Meals</option>
                    <option value="RICE_AND_BIRYANI">Rice & Biryani</option>
                    <option value="VEGETABLES">Vegetables</option>
                    <option value="FRUITS">Fruits</option>
                    <option value="BAKERY">Bakery & Bread</option>
                    <option value="PACKAGED">Packaged Food</option>
                    <option value="SNACKS">Snacks</option>
                  </select>
                </div>

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
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Quantity (kg) *</label>
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
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3.5 py-2 text-xs font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Estimated Servings
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formData.estimatedServings}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        estimatedServings: Number(e.target.value),
                      })
                    }
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3.5 py-2 text-xs font-mono tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Description</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Fresh banquet batch packed in food-grade stainless containers."
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={!formData.title.trim()}
                  onClick={() => setCreateStep(2)}
                  className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-zinc-950 font-bold text-xs"
                >
                  Next: Safety & Expiry
                </button>
              </div>
            </div>
          )}

          {createStep === 2 && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Donations are automatically marked EXPIRED after their safe consumption deadline and cannot be requested past expiry.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Safe Consumption Window (Hours Remaining)
                </label>
                <select
                  value={formData.safeHours}
                  onChange={(e) =>
                    setFormData({ ...formData, safeHours: Number(e.target.value) })
                  }
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono"
                >
                  <option value={3}>3 Hours (Urgent Rescue)</option>
                  <option value={5}>5 Hours (Standard Hot Cooked Food)</option>
                  <option value={8}>8 Hours (Refrigerated)</option>
                  <option value={12}>12 Hours (Bakery / Packaged)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Storage Conditions
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

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Allergen Information
                </label>
                <input
                  type="text"
                  value={formData.allergenInfo}
                  onChange={(e) =>
                    setFormData({ ...formData, allergenInfo: e.target.value })
                  }
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setCreateStep(1)}
                  className="px-4 py-2 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-xs font-medium"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setCreateStep(3)}
                  className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs"
                >
                  Next: Pickup Location
                </button>
              </div>
            </div>
          )}

          {createStep === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Pickup Address *</label>
                <input
                  type="text"
                  required
                  value={formData.pickupAddress}
                  onChange={(e) =>
                    setFormData({ ...formData, pickupAddress: e.target.value })
                  }
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3.5 py-2 text-xs"
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
                    Pickup Time Window
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

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Access Instructions
                </label>
                <input
                  type="text"
                  value={formData.specialInstructions}
                  onChange={(e) =>
                    setFormData({ ...formData, specialInstructions: e.target.value })
                  }
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateStep(2)}
                  className="px-4 py-2 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-xs font-medium"
                >
                  Back
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => submitDonation('DRAFT')}
                    className="px-4 py-2 rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-xs font-semibold"
                  >
                    Save Draft
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => submitDonation('AVAILABLE')}
                    className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs"
                  >
                    {isBusy ? 'Publishing...' : 'Publish Donation'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {createStep === 4 && createdResult && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center">
                <CheckCircle className="w-7 h-7 text-emerald-500 mx-auto mb-1" />
                <h3 className="font-bold text-sm">
                  Donation {createdResult.donation.status === 'DRAFT' ? 'Saved as Draft' : 'Published'}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-mono tabular-nums">
                  {createdResult.donation.id} · {createdResult.donation.quantityKg} kg ·{' '}
                  {createdResult.donation.estimatedServings} servings
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Nearby Approved NGO Matches ({createdResult.matches.length})
                </h4>
                {createdResult.matches.length === 0 ? (
                  <p className="text-xs text-zinc-500 py-3">
                    No approved NGOs within 30 km with matching capacity/dietary preference.
                  </p>
                ) : (
                  createdResult.matches.slice(0, 3).map((match, idx) => (
                    <div
                      key={match.ngo.id}
                      className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-xs">
                          #{idx + 1} {match.ngo.organizationName || match.ngo.name}
                        </div>
                        <div className="text-[11px] text-zinc-500 tabular-nums">
                          {match.distanceKm} km away · Capacity: {match.ngo.currentAvailableCapacityKg} kg
                        </div>
                      </div>
                      <div className="text-right font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {match.totalScore}% Match
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setSelectedDonationForQr(createdResult.donation)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-xs font-semibold rounded-lg"
                >
                  <QrCode className="w-3.5 h-3.5" /> View QR
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('DONATIONS')}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs rounded-lg"
                >
                  Go to Donations
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: DONATIONS TABLE */}
      {activeTab === 'DONATIONS' && (
        <div className="rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-950 text-[11px] font-semibold text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Food Title</th>
                <th className="px-4 py-3">Quantity</th>
                <th className="px-4 py-3">Safe Until</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Allocated NGO</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {myDonations.map((item) => (
                <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-950/60">
                  <td className="px-4 py-3 font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                    {item.id}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-zinc-900 dark:text-white">
                      {item.title}
                    </div>
                    <div className="text-[11px] text-zinc-500">{item.category}</div>
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {item.quantityKg} kg ({item.estimatedServings} servings)
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] tabular-nums">
                    {new Date(item.safeConsumptionDeadline).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-3 font-semibold">{item.status}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                    {item.allocatedNgoName || 'Unassigned'}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                    {item.status === 'DRAFT' && (
                      <button
                        type="button"
                        onClick={() => publishDonation(item.id)}
                        className="px-2.5 py-1 bg-emerald-500 text-zinc-950 font-bold rounded-md"
                      >
                        Publish
                      </button>
                    )}
                    {['DRAFT', 'AVAILABLE', 'REQUESTED', 'APPROVED'].includes(item.status) && (
                      <button
                        type="button"
                        onClick={() => cancelDonation(item.id, 'Cancelled by restaurant')}
                        className="px-2.5 py-1 bg-rose-500/15 text-rose-600 dark:text-rose-400 font-semibold rounded-md"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedDonationForQr(item)}
                      className="px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-md font-medium"
                    >
                      QR
                    </button>
                    {item.status === 'COMPLETED' && (
                      <button
                        type="button"
                        onClick={() => setSelectedDonationForCert(item)}
                        className="px-2.5 py-1 bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold rounded-md"
                      >
                        Certificate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB: NGO REQUESTS */}
      {activeTab === 'REQUESTS' && (
        <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-4">
          <h2 className="font-bold text-sm text-zinc-900 dark:text-white">
            Incoming NGO Food Requests
          </h2>
          {myRequests.length === 0 ? (
            <p className="text-xs text-zinc-500 py-8 text-center">
              No food allocation requests yet.
            </p>
          ) : (
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {myRequests.map((req) => (
                <div
                  key={req.id}
                  className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div>
                    <div className="text-xs text-zinc-500 font-mono">
                      {req.id} · {req.donationTitle}
                    </div>
                    <h3 className="font-bold text-sm text-zinc-900 dark:text-white mt-0.5">
                      {req.ngoName}
                    </h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 tabular-nums mt-0.5">
                      Requested: <strong>{req.requestedQuantityKg} kg</strong> for{' '}
                      <strong>{req.beneficiariesCount}</strong> beneficiaries
                    </p>
                  </div>

                  {req.status === 'PENDING' ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => acceptDonationRequest(req.id)}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold rounded-lg"
                      >
                        Approve & Assign Courier
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          rejectDonationRequest(req.id, 'Allocated elsewhere')
                        }
                        className="inline-flex items-center gap-1 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-rose-500/15 text-zinc-700 dark:text-zinc-300 hover:text-rose-500 text-xs font-semibold rounded-lg"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Decline
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300">
                      {req.status}
                    </span>
                  )}
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
            <h3 className="font-bold text-base">Report Safety or Logistics Issue</h3>
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
                onClick={() => setIssueModalOpen(false)}
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
