import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Building2,
  HeartHandshake,
  User,
  Truck,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Clock,
  Sun,
  Moon,
  ChevronDown,
} from 'lucide-react';
import { useApp, LoginErrorResponse } from '../../services/store.tsx';
import { AnnadaanLogo } from '../common/AnnadaanLogo.tsx';
import type { OrganizationType, UserRole } from '../../types/index.ts';

interface RoleConfig {
  role: UserRole;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accentText: string;
  accentBg: string;
  allowRegister: boolean;
  seedEmail: string;
  seedPassword: string;
  seedNote: string;
}

const ROLE_CONFIGS: RoleConfig[] = [
  {
    role: 'ROLE_RESTAURANT',
    title: 'Restaurant / Food Provider',
    subtitle: 'Commercial kitchen or banquet',
    description:
      'Post surplus meals with safety windows, review NGO requests, and generate handover tokens.',
    icon: Building2,
    accentText: 'text-emerald-500',
    accentBg: 'bg-emerald-500/10',
    allowRegister: true,
    seedEmail: 'events@tajkrishna.com',
    seedPassword: 'Partner@123',
    seedNote: 'Fictional test FSSAI IDs for registration: TEST-FSSAI-1003, TEST-FSSAI-1004',
  },
  {
    role: 'ROLE_NGO',
    title: 'NGO / Food Receiver',
    subtitle: 'Orphanage, shelter, or trust',
    description:
      'Browse nearby surplus meals, submit capacity-matched requests, and confirm receipt.',
    icon: HeartHandshake,
    accentText: 'text-amber-500',
    accentBg: 'bg-amber-500/10',
    allowRegister: true,
    seedEmail: 'care@snehaorphanage.org',
    seedPassword: 'Partner@123',
    seedNote: 'Fictional test NGO IDs for registration: TEST-NGO-2026-004, TEST-NGO-2026-006',
  },
  {
    role: 'ROLE_INDIVIDUAL',
    title: 'Individual Donor',
    subtitle: 'Weddings, events, or household',
    description:
      'Share fresh excess food from family celebrations and track delivery to verified shelters.',
    icon: User,
    accentText: 'text-rose-500',
    accentBg: 'bg-rose-500/10',
    allowRegister: true,
    seedEmail: 'rajesh.verma@gmail.com',
    seedPassword: 'Donor@123',
    seedNote: 'Simple registration — no business licence required.',
  },
  {
    role: 'ROLE_VOLUNTEER',
    title: 'Volunteer',
    subtitle: 'Pickup and delivery courier',
    description:
      'Accept approved rescue missions, verify QR handovers at pickup and drop-off, and log deliveries.',
    icon: Truck,
    accentText: 'text-sky-500',
    accentBg: 'bg-sky-500/10',
    allowRegister: true,
    seedEmail: 'karthik.rescue@gmail.com',
    seedPassword: 'Volunteer@123',
    seedNote: 'New volunteer applications require administrator verification.',
  },
  {
    role: 'ROLE_ADMIN',
    title: 'Administrator',
    subtitle: 'Platform operations & verification',
    description:
      'Verify NGOs and restaurants, audit donation states, resolve issues, and monitor impact.',
    icon: ShieldCheck,
    accentText: 'text-teal-500',
    accentBg: 'bg-teal-500/10',
    allowRegister: false,
    seedEmail: 'admin@annadaan.org',
    seedPassword: 'Admin@Annadaan2026',
    seedNote: 'Restricted access. Self-registration is disabled for administrators.',
  },
];

export const RoleEntryScreen: React.FC = () => {
  const { login, register, resubmitVerification, theme, toggleTheme } = useApp();

  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [showCredentialsHint, setShowCredentialsHint] = useState(false);

  // Login State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<LoginErrorResponse | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Resubmission state for REJECTED accounts
  const [resubmitRef, setResubmitRef] = useState('');
  const [resubmitDoc, setResubmitDoc] = useState('');

  // Registration State
  const [regForm, setRegForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    address: '',
    city: 'Mangalagiri',
    stateDistrict: 'Mangalagiri, Andhra Pradesh',
    // NGO
    organizationName: '',
    registrationNumber: '',
    issuingAuthority: 'Registrar of Societies, Andhra Pradesh',
    organizationType: 'ORPHANAGE' as OrganizationType,
    beneficiariesCount: 50,
    maxCapacityKg: 80,
    foodPreference: 'ALL' as 'ALL' | 'VEG' | 'NON_VEG',
    operatingHours: '08:00 AM - 09:00 PM',
    documentRef: '',
    // Restaurant
    restaurantName: '',
    licenseNumber: '',
    restaurantCategory: 'Restaurant & Banquet',
    // Volunteer
    vehicleType: 'TWO_WHEELER' as 'TWO_WHEELER' | 'FOUR_WHEELER' | 'VAN' | 'ELECTRIC_BIKE',
    maxTravelDistanceKm: 15,
    availabilityStatus: 'AVAILABLE' as 'AVAILABLE' | 'BUSY',
  });

  const activeConfig = ROLE_CONFIGS.find((r) => r.role === selectedRole) || null;

  const handleSelectRole = (role: UserRole) => {
    setSelectedRole(role);
    setMode('LOGIN');
    setEmail('');
    setPassword('');
    setLoginError(null);
    setStatusNotice(null);
    setShowCredentialsHint(false);
  };

  const handleFillSeedCredentials = () => {
    if (!activeConfig) return;
    setEmail(activeConfig.seedEmail);
    setPassword(activeConfig.seedPassword);
    setLoginError(null);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) return;
    setIsSubmitting(true);
    setLoginError(null);
    setStatusNotice(null);

    try {
      const result = await login(selectedRole, email, password);
      if (!result.ok) {
        setLoginError(result);
        if (result.currentReferenceNumber) {
          setResubmitRef(result.currentReferenceNumber);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResubmitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) return;
    setIsSubmitting(true);
    try {
      const res = await resubmitVerification({
        email,
        password,
        role: selectedRole,
        referenceNumber: resubmitRef,
        documentRef: resubmitDoc,
      });
      if (res.ok) {
        setLoginError(null);
        setStatusNotice(
          res.message || 'Verification resubmitted. Pending administrator review.'
        );
      } else {
        setLoginError({ error: res.error || 'Resubmission failed.' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole || selectedRole === 'ROLE_ADMIN') return;
    setIsSubmitting(true);
    setLoginError(null);
    setStatusNotice(null);

    try {
      const payload: Record<string, unknown> = {
        role: selectedRole,
        fullName: regForm.fullName,
        contactPerson: regForm.fullName,
        ownerManagerName: regForm.fullName,
        email: regForm.email,
        phone: regForm.phone,
        password: regForm.password,
        address: regForm.address,
        city: regForm.city,
        state: 'Andhra Pradesh',
        stateDistrict: regForm.stateDistrict,
        operatingHours: regForm.operatingHours,
        documentRef: regForm.documentRef,
      };

      if (selectedRole === 'ROLE_NGO') {
        payload.organizationName = regForm.organizationName;
        payload.registrationNumber = regForm.registrationNumber;
        payload.issuingAuthority = regForm.issuingAuthority;
        payload.organizationType = regForm.organizationType;
        payload.beneficiariesCount = Number(regForm.beneficiariesCount);
        payload.maxCapacityKg = Number(regForm.maxCapacityKg);
        payload.foodPreferences = [regForm.foodPreference];
      } else if (selectedRole === 'ROLE_RESTAURANT') {
        payload.restaurantName = regForm.restaurantName;
        payload.licenseNumber = regForm.licenseNumber;
        payload.issuingAuthority = regForm.issuingAuthority;
        payload.restaurantCategory = regForm.restaurantCategory;
      } else if (selectedRole === 'ROLE_VOLUNTEER') {
        payload.vehicleType = regForm.vehicleType;
        payload.maxTravelDistanceKm = Number(regForm.maxTravelDistanceKm);
        payload.availabilityStatus = regForm.availabilityStatus;
      }

      const res = await register(payload);
      if (!res.ok) {
        setLoginError({ error: res.error || 'Registration failed.' });
      } else if (res.verificationStatus === 'PENDING') {
        setMode('LOGIN');
        setEmail(regForm.email);
        setPassword('');
        setStatusNotice(
          res.message ||
            'Registration submitted. Verification is pending administrator review.'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col justify-between p-4 sm:p-8 relative overflow-hidden transition-colors duration-200">
      {/* Subtle architectural ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[780px] h-[360px] bg-emerald-500/10 dark:bg-emerald-500/12 rounded-full blur-[140px]" />
      </div>

      {/* Minimal Top Bar */}
      <div className="relative z-10 max-w-5xl w-full mx-auto flex items-center justify-between py-2">
        <AnnadaanLogo size="md" showTagline={true} />
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-zinc-700" />
          )}
        </button>
      </div>

      {/* Centered Role Selection / Auth Modal Window */}
      <div className="relative z-10 flex-1 flex items-center justify-center py-6">
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-4xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-2xl"
        >
          <AnimatePresence mode="wait">
            {!activeConfig ? (
              <motion.div
                key="role-picker"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.18 }}
                className="space-y-6"
              >
                <div className="space-y-1.5 border-b border-zinc-200 dark:border-zinc-800 pb-5">
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
                    Welcome to ANNADAAN
                  </h1>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Choose how you want to participate in food rescue.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {ROLE_CONFIGS.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.role}
                        type="button"
                        onClick={() => handleSelectRole(item.role)}
                        className="group text-left p-5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 hover:border-emerald-500 dark:hover:border-emerald-500 transition-all flex flex-col justify-between min-h-[170px]"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <div
                              className={`w-10 h-10 rounded-lg ${item.accentBg} ${item.accentText} flex items-center justify-center`}
                            >
                              <Icon className="w-5 h-5" />
                            </div>
                            <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
                          </div>
                          <h2 className="text-sm font-bold text-zinc-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                            {item.title}
                          </h2>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                            {item.subtitle}
                          </p>
                          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-2.5 leading-relaxed">
                            {item.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key={activeConfig.role}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.18 }}
                className="space-y-5"
              >
                {/* Role Header + Back */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-4">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedRole(null)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-200 transition-colors"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>All roles</span>
                    </button>
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-9 h-9 rounded-lg ${activeConfig.accentBg} ${activeConfig.accentText} flex items-center justify-center`}
                      >
                        <activeConfig.icon className="w-4 h-4" />
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                          {activeConfig.title}
                        </h2>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {activeConfig.subtitle}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Login / Register Toggle (Disabled for Admin) */}
                  {activeConfig.allowRegister && (
                    <div className="flex items-center gap-1 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                      <button
                        type="button"
                        onClick={() => {
                          setMode('LOGIN');
                          setLoginError(null);
                        }}
                        className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                          mode === 'LOGIN'
                            ? 'bg-emerald-500 text-zinc-950 font-bold'
                            : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                        }`}
                      >
                        Sign In
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMode('REGISTER');
                          setLoginError(null);
                          setStatusNotice(null);
                        }}
                        className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                          mode === 'REGISTER'
                            ? 'bg-emerald-500 text-zinc-950 font-bold'
                            : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                        }`}
                      >
                        Register
                      </button>
                    </div>
                  )}
                </div>

                {/* Notices & Errors */}
                {statusNotice && (
                  <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-start gap-2.5">
                    <Clock className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">{statusNotice}</p>
                    </div>
                  </div>
                )}

                {loginError && (
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs space-y-2">
                    <div className="flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">{loginError.error}</p>
                        {loginError.rejectionReason && (
                          <p className="mt-1 text-rose-600 dark:text-rose-200">
                            Reason: {loginError.rejectionReason}
                          </p>
                        )}
                      </div>
                    </div>

                    {loginError.code === 'VERIFICATION_REJECTED' &&
                      loginError.allowResubmit && (
                        <form
                          onSubmit={handleResubmitSubmit}
                          className="pt-2 border-t border-rose-500/20 grid grid-cols-1 sm:grid-cols-3 gap-2"
                        >
                          <input
                            type="text"
                            required
                            value={resubmitRef}
                            onChange={(e) => setResubmitRef(e.target.value)}
                            placeholder="Updated Licence / Reg No."
                            className="bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100"
                          />
                          <input
                            type="text"
                            required
                            value={resubmitDoc}
                            onChange={(e) => setResubmitDoc(e.target.value)}
                            placeholder="Supporting Doc Ref"
                            className="bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100"
                          />
                          <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs"
                          >
                            Resubmit Verification
                          </button>
                        </form>
                      )}
                  </div>
                )}

                {/* LOGIN FORM */}
                {mode === 'LOGIN' ? (
                  <div className="space-y-4">
                    <form onSubmit={handleLoginSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                            Email Address
                          </label>
                          <div className="relative">
                            <Mail className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
                            <input
                              type="email"
                              required
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              placeholder="name@organization.org"
                              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                            Password
                          </label>
                          <div className="relative">
                            <Lock className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
                            <input
                              type={showPassword ? 'text' : 'password'}
                              required
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder="Enter your password"
                              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg pl-9 pr-9 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-emerald-500"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              aria-label="Toggle password visibility"
                              className="absolute right-2.5 top-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                            >
                              {showPassword ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-4 pt-1">
                        <button
                          type="button"
                          onClick={() => setShowCredentialsHint(!showCredentialsHint)}
                          className="inline-flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                        >
                          <span>Seeded test credentials</span>
                          <ChevronDown
                            className={`w-3.5 h-3.5 transition-transform ${
                              showCredentialsHint ? 'rotate-180' : ''
                            }`}
                          />
                        </button>

                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs transition-colors flex items-center gap-2 disabled:opacity-50 whitespace-nowrap"
                        >
                          <span>{isSubmitting ? 'Signing in...' : 'Sign In'}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </form>

                    {showCredentialsHint && (
                      <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="space-y-0.5 font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
                          <div>
                            Email:{' '}
                            <span className="text-zinc-900 dark:text-zinc-100">
                              {activeConfig.seedEmail}
                            </span>
                          </div>
                          <div>
                            Password:{' '}
                            <span className="text-zinc-900 dark:text-zinc-100">
                              {activeConfig.seedPassword}
                            </span>
                          </div>
                          <div className="font-sans text-[11px] text-zinc-500 pt-0.5">
                            {activeConfig.seedNote}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleFillSeedCredentials}
                          className="px-3 py-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-xs font-semibold text-zinc-900 dark:text-zinc-100 whitespace-nowrap shrink-0"
                        >
                          Fill Credentials
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* ROLE-SPECIFIC REGISTRATION FORM */
                  <form onSubmit={handleRegisterSubmit} className="space-y-4">
                    {selectedRole === 'ROLE_NGO' && (
                      <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-600 dark:text-zinc-400">
                        {activeConfig.seedNote}
                      </div>
                    )}
                    {selectedRole === 'ROLE_RESTAURANT' && (
                      <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-600 dark:text-zinc-400">
                        {activeConfig.seedNote}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {selectedRole === 'ROLE_NGO' && (
                        <>
                          <div>
                            <label className="block text-xs font-semibold mb-1">
                              Official NGO Name *
                            </label>
                            <input
                              type="text"
                              required
                              value={regForm.organizationName}
                              onChange={(e) =>
                                setRegForm({ ...regForm, organizationName: e.target.value })
                              }
                              placeholder="Hope Haven Orphanage Foundation"
                              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold mb-1">
                              NGO Registration / Licence Number *
                            </label>
                            <input
                              type="text"
                              required
                              value={regForm.registrationNumber}
                              onChange={(e) =>
                                setRegForm({
                                  ...regForm,
                                  registrationNumber: e.target.value,
                                })
                              }
                              placeholder="TEST-NGO-2026-004"
                              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold mb-1">
                              Issuing Authority *
                            </label>
                            <input
                              type="text"
                              required
                              value={regForm.issuingAuthority}
                              onChange={(e) =>
                                setRegForm({ ...regForm, issuingAuthority: e.target.value })
                              }
                              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold mb-1">
                              Organization Category
                            </label>
                            <select
                              value={regForm.organizationType}
                              onChange={(e) =>
                                setRegForm({
                                  ...regForm,
                                  organizationType: e.target.value as OrganizationType,
                                })
                              }
                              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs"
                            >
                              <option value="ORPHANAGE">Orphanage</option>
                              <option value="OLD_AGE_HOME">Old-Age Home</option>
                              <option value="HOMELESS_SHELTER">Homeless Shelter</option>
                              <option value="CHARITABLE_TRUST">Charitable Trust</option>
                              <option value="COMMUNITY_KITCHEN">Community Kitchen</option>
                              <option value="FOOD_BANK">Food Bank</option>
                            </select>
                          </div>
                        </>
                      )}

                      {selectedRole === 'ROLE_RESTAURANT' && (
                        <>
                          <div>
                            <label className="block text-xs font-semibold mb-1">
                              Restaurant / Kitchen Name *
                            </label>
                            <input
                              type="text"
                              required
                              value={regForm.restaurantName}
                              onChange={(e) =>
                                setRegForm({ ...regForm, restaurantName: e.target.value })
                              }
                              placeholder="Minerva Grand Banquets"
                              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold mb-1">
                              FSSAI / Food Licence Number *
                            </label>
                            <input
                              type="text"
                              required
                              value={regForm.licenseNumber}
                              onChange={(e) =>
                                setRegForm({ ...regForm, licenseNumber: e.target.value })
                              }
                              placeholder="TEST-FSSAI-1003"
                              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold mb-1">
                              Issuing Authority *
                            </label>
                            <input
                              type="text"
                              required
                              value={regForm.issuingAuthority}
                              onChange={(e) =>
                                setRegForm({ ...regForm, issuingAuthority: e.target.value })
                              }
                              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold mb-1">
                              Business Category
                            </label>
                            <input
                              type="text"
                              value={regForm.restaurantCategory}
                              onChange={(e) =>
                                setRegForm({
                                  ...regForm,
                                  restaurantCategory: e.target.value,
                                })
                              }
                              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs"
                            />
                          </div>
                        </>
                      )}

                      <div>
                        <label className="block text-xs font-semibold mb-1">
                          {selectedRole === 'ROLE_NGO'
                            ? 'Contact Person Name *'
                            : selectedRole === 'ROLE_RESTAURANT'
                            ? 'Owner / Manager Name *'
                            : 'Full Name *'}
                        </label>
                        <input
                          type="text"
                          required
                          value={regForm.fullName}
                          onChange={(e) =>
                            setRegForm({ ...regForm, fullName: e.target.value })
                          }
                          placeholder="Full name"
                          className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold mb-1">
                          Official Email *
                        </label>
                        <input
                          type="email"
                          required
                          value={regForm.email}
                          onChange={(e) =>
                            setRegForm({ ...regForm, email: e.target.value })
                          }
                          placeholder="contact@organization.org"
                          className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold mb-1">
                          Mobile Number *
                        </label>
                        <input
                          type="tel"
                          required
                          value={regForm.phone}
                          onChange={(e) =>
                            setRegForm({ ...regForm, phone: e.target.value })
                          }
                          placeholder="+91 98490 00000"
                          className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold mb-1">
                          Password (min 6 chars) *
                        </label>
                        <input
                          type="password"
                          required
                          minLength={6}
                          value={regForm.password}
                          onChange={(e) =>
                            setRegForm({ ...regForm, password: e.target.value })
                          }
                          placeholder="Create password"
                          className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold mb-1">
                          Street Address *
                        </label>
                        <input
                          type="text"
                          required
                          value={regForm.address}
                          onChange={(e) =>
                            setRegForm({ ...regForm, address: e.target.value })
                          }
                          placeholder="Building, street, locality"
                          className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold mb-1">
                          City / District *
                        </label>
                        <input
                          type="text"
                          required
                          value={regForm.city}
                          onChange={(e) =>
                            setRegForm({
                              ...regForm,
                              city: e.target.value,
                              stateDistrict: `${e.target.value}, Andhra Pradesh`,
                            })
                          }
                          className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs"
                        />
                      </div>

                      {selectedRole === 'ROLE_NGO' && (
                        <>
                          <div>
                            <label className="block text-xs font-semibold mb-1">
                              Beneficiary Capacity (Persons)
                            </label>
                            <input
                              type="number"
                              min={5}
                              value={regForm.beneficiariesCount}
                              onChange={(e) =>
                                setRegForm({
                                  ...regForm,
                                  beneficiariesCount: Number(e.target.value),
                                })
                              }
                              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold mb-1">
                              Supporting Certificate Reference *
                            </label>
                            <input
                              type="text"
                              required
                              value={regForm.documentRef}
                              onChange={(e) =>
                                setRegForm({ ...regForm, documentRef: e.target.value })
                              }
                              placeholder="DOC-NGO-CERT-2026.pdf"
                              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono"
                            />
                          </div>
                        </>
                      )}

                      {selectedRole === 'ROLE_RESTAURANT' && (
                        <div>
                          <label className="block text-xs font-semibold mb-1">
                            FSSAI Certificate Reference *
                          </label>
                          <input
                            type="text"
                            required
                            value={regForm.documentRef}
                            onChange={(e) =>
                              setRegForm({ ...regForm, documentRef: e.target.value })
                            }
                            placeholder="DOC-FSSAI-2026.pdf"
                            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono"
                          />
                        </div>
                      )}

                      {selectedRole === 'ROLE_VOLUNTEER' && (
                        <>
                          <div>
                            <label className="block text-xs font-semibold mb-1">
                              Vehicle Type
                            </label>
                            <select
                              value={regForm.vehicleType}
                              onChange={(e) =>
                                setRegForm({
                                  ...regForm,
                                  vehicleType: e.target.value as typeof regForm.vehicleType,
                                })
                              }
                              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs"
                            >
                              <option value="TWO_WHEELER">Two Wheeler</option>
                              <option value="ELECTRIC_BIKE">Electric Bike</option>
                              <option value="FOUR_WHEELER">Car / Sedan</option>
                              <option value="VAN">Delivery Van</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold mb-1">
                              Driving Licence / ID Reference *
                            </label>
                            <input
                              type="text"
                              required
                              value={regForm.documentRef}
                              onChange={(e) =>
                                setRegForm({ ...regForm, documentRef: e.target.value })
                              }
                              placeholder="DL-TS-2026-0001"
                              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono"
                            />
                          </div>
                        </>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs transition-colors flex items-center gap-2 disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>
                          {isSubmitting ? 'Submitting...' : 'Submit Registration'}
                        </span>
                      </button>
                    </div>
                  </form>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Quiet Footer */}
      <div className="relative z-10 max-w-5xl w-full mx-auto text-center text-xs text-zinc-500 dark:text-zinc-500 py-2">
        ANNADAAN Food Rescue & Redistribution Platform
      </div>
    </div>
  );
};
