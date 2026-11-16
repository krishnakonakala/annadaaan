import React, { useState } from 'react';
import { AppProvider, useApp } from './services/store.tsx';
import { Header } from './components/common/Header.tsx';
import { LandingPage } from './components/landing/LandingPage.tsx';
import { InteractiveFoodMap } from './components/map/InteractiveFoodMap.tsx';
import { RestaurantDashboard } from './components/dashboards/RestaurantDashboard.tsx';
import { NgoDashboard } from './components/dashboards/NgoDashboard.tsx';
import { IndividualDonorDashboard } from './components/dashboards/IndividualDonorDashboard.tsx';
import { VolunteerDashboard } from './components/dashboards/VolunteerDashboard.tsx';
import { AdminDashboard } from './components/dashboards/AdminDashboard.tsx';
import { QrModal } from './components/common/QrModal.tsx';
import { CertificateModal } from './components/common/CertificateModal.tsx';
import { RoleEntryScreen } from './components/auth/RoleEntryScreen.tsx';

const MainLayout: React.FC = () => {
  const { currentUser, isBootstrapping } = useApp();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'map' | 'overview'>('dashboard');

  if (isBootstrapping) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex items-center justify-center">
        <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Loading ANNADAAN...
        </div>
      </div>
    );
  }

  // First screen for unauthenticated visitors: Animated 5-Role Selection Popup
  if (!currentUser) {
    return <RoleEntryScreen />;
  }

  const renderDashboardByRole = () => {
    switch (currentUser.role) {
      case 'ROLE_RESTAURANT':
        return <RestaurantDashboard />;
      case 'ROLE_NGO':
        return <NgoDashboard />;
      case 'ROLE_INDIVIDUAL':
        return <IndividualDonorDashboard />;
      case 'ROLE_VOLUNTEER':
        return <VolunteerDashboard />;
      case 'ROLE_ADMIN':
      default:
        return <AdminDashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-300 transition-colors duration-200">
      <Header
        activeTab={activeTab}
        setActiveTab={(tab) => setActiveTab(tab as 'dashboard' | 'map' | 'overview')}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'dashboard' && renderDashboardByRole()}

        {activeTab === 'map' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <div>
                <h1 className="text-xl font-bold text-zinc-900 dark:text-white">
                  Redistribution Network Map
                </h1>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Approved receiving shelters, available food pickups, and active courier routes.
                </p>
              </div>
            </div>
            <InteractiveFoodMap heightClass="h-[640px]" />
          </div>
        )}

        {activeTab === 'overview' && (
          <LandingPage setActiveTab={(tab) => setActiveTab(tab as 'dashboard' | 'map' | 'overview')} />
        )}
      </main>

      <QrModal />
      <CertificateModal />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
