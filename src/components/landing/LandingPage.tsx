import React from 'react';
import { useApp } from '../../services/store.tsx';
import { HeroGlobe } from '../3d/HeroGlobe.tsx';
import { InteractiveFoodMap } from '../map/InteractiveFoodMap.tsx';
import { ArrowRight, CheckCircle2, ChevronRight } from 'lucide-react';

export const LandingPage: React.FC<{
  setActiveTab: (tab: string) => void;
}> = ({ setActiveTab }) => {
  const { analytics, donations, allUsers } = useApp();

  const totalKg =
    analytics?.totalFoodRescuedKg ??
    donations.reduce((acc, d) => acc + (d.status === 'COMPLETED' ? d.quantityKg : 0), 0);
  const totalMeals =
    analytics?.totalMealsDistributed ??
    donations.reduce((acc, d) => acc + (d.status === 'COMPLETED' ? d.estimatedServings : 0), 0);
  const approvedNgos =
    analytics?.approvedNgos ??
    allUsers.filter((u) => u.role === 'ROLE_NGO' && u.verificationStatus === 'APPROVED').length;
  const co2Saved = analytics?.co2EmissionsPreventedKg ?? Math.round(totalKg * 2.5);

  return (
    <div className="space-y-12 pb-12">
      {/* Impact Overview Hero */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-6 space-y-5">
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
            Community Food Rescue Network
          </p>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-zinc-900 dark:text-white leading-tight [text-wrap:balance]">
            Every Meal Deserves a Purpose.
          </h1>

          <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-300 leading-relaxed max-w-xl">
            Connecting surplus food from verified restaurants, banquets, and event hosts with approved orphanages, old-age homes, and community shelters.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs transition-colors whitespace-nowrap"
            >
              <span>Return to Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('map')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold text-xs transition-colors whitespace-nowrap"
            >
              <span>Open Live Map</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="pt-4 flex flex-wrap items-center gap-6 text-xs text-zinc-500 dark:text-zinc-400 border-t border-zinc-200 dark:border-zinc-800">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Verified Shelter Network
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Safe Consumption Enforcement
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              QR Handover Traceability
            </span>
          </div>
        </div>

        <div className="lg:col-span-6 flex justify-center">
          <HeroGlobe />
        </div>
      </section>

      {/* Live Impact Metrics */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-1">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Food Rescued</span>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
            {totalKg.toLocaleString()} kg
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Completed surplus deliveries
          </p>
        </div>

        <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-1">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Meals Served</span>
          <div className="text-2xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-400 tabular-nums">
            {totalMeals.toLocaleString()}
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Distributed across shelters
          </p>
        </div>

        <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-1">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Approved Shelters</span>
          <div className="text-2xl sm:text-3xl font-extrabold text-sky-600 dark:text-sky-400 tabular-nums">
            {approvedNgos}
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Verified NGO partners
          </p>
        </div>

        <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-1">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">CO₂ Offset</span>
          <div className="text-2xl sm:text-3xl font-extrabold text-teal-600 dark:text-teal-400 tabular-nums">
            {co2Saved.toLocaleString()} kg
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Estimated emissions avoided
          </p>
        </div>
      </section>

      {/* 3-Step Flow */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
          How Food Rescue Works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2">
            <h3 className="font-bold text-sm text-zinc-900 dark:text-white">
              01. Publish Surplus Food
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Restaurants and event donors log food quantity, dietary details, storage temperature, and safe consumption deadlines.
            </p>
          </div>
          <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2">
            <h3 className="font-bold text-sm text-zinc-900 dark:text-white">
              02. Verified Shelter Matching
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Nearby approved orphanages and shelters matching dietary type and storage capacity request and reserve available food.
            </p>
          </div>
          <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2">
            <h3 className="font-bold text-sm text-zinc-900 dark:text-white">
              03. Tracked Pickup & Delivery
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Volunteers verify donor pickup and NGO handover with QR tokens, followed by shelter inspection and completion receipt.
            </p>
          </div>
        </div>
      </section>

      {/* Live Map Preview */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
            Live Redistribution Network
          </h2>
          <button
            type="button"
            onClick={() => setActiveTab('map')}
            className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            Expand map
          </button>
        </div>
        <InteractiveFoodMap heightClass="h-[400px]" />
      </section>

      <footer className="pt-6 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400 flex items-center justify-between">
        <span>ANNADAAN · Every Meal Deserves a Purpose</span>
        <span>Verified Community Food Redistribution</span>
      </footer>
    </div>
  );
};
