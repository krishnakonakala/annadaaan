import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type {
  AnalyticsSummary,
  AuditLogItem,
  ComplaintItem,
  DonationItem,
  DonationRequestItem,
  MatchingResult,
  NotificationItem,
  UserProfile,
  UserRole,
  VerificationStatus,
  VolunteerAssignment,
} from '../types/index.ts';
import { LanguageCode, translations } from '../i18n/translations.ts';

export interface LoginErrorResponse {
  error: string;
  code?: 'VERIFICATION_PENDING' | 'VERIFICATION_REJECTED' | 'ACCOUNT_SUSPENDED';
  rejectionReason?: string;
  allowResubmit?: boolean;
  currentReferenceNumber?: string;
}

export interface PublicOverviewData {
  analytics: AnalyticsSummary;
  publicNgos: Array<{
    id: string;
    name: string;
    organizationType?: string;
    location: UserProfile['location'];
    currentAvailableCapacityKg?: number;
    beneficiariesCount?: number;
  }>;
  publicDonations: Array<{
    id: string;
    title: string;
    donorName: string;
    quantityKg: number;
    estimatedServings: number;
    isVegetarian: boolean;
    status: string;
    safeConsumptionDeadline: string;
    pickupLocation: UserProfile['location'];
  }>;
  testVerificationRegistry: Array<{
    record_type: string;
    license_number: string;
    official_name: string;
    issuing_authority: string;
    state_district: string;
    is_test_record: number;
  }>;
}

interface AppContextType {
  isBootstrapping: boolean;
  sessionToken: string | null;
  currentUser: UserProfile | null;
  allUsers: UserProfile[];
  donations: DonationItem[];
  requests: DonationRequestItem[];
  assignments: VolunteerAssignment[];
  notifications: NotificationItem[];
  auditLogs: AuditLogItem[];
  complaints: ComplaintItem[];
  analytics: AnalyticsSummary | null;
  publicOverview: PublicOverviewData | null;
  currentLanguage: LanguageCode;
  t: (key: keyof typeof translations['en']) => string;
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  toggleTheme: () => void;
  setLanguage: (lang: LanguageCode) => void;

  // Auth actions
  login: (
    role: UserRole,
    email: string,
    password: string
  ) => Promise<{ ok: true; user: UserProfile } | ({ ok: false } & LoginErrorResponse)>;
  register: (
    payload: Record<string, unknown>
  ) => Promise<{
    ok: boolean;
    message?: string;
    error?: string;
    verificationStatus?: VerificationStatus;
  }>;
  resubmitVerification: (payload: {
    email: string;
    password: string;
    role: UserRole;
    referenceNumber: string;
    documentRef: string;
  }) => Promise<{ ok: boolean; message?: string; error?: string }>;
  logout: () => Promise<void>;
  refreshData: () => Promise<void>;

  // Domain actions
  createDonation: (
    item: Partial<DonationItem> & { status?: 'DRAFT' | 'AVAILABLE' }
  ) => Promise<{ donation: DonationItem; matches: MatchingResult[] }>;
  publishDonation: (donationId: string) => Promise<void>;
  cancelDonation: (donationId: string, reason?: string) => Promise<void>;
  requestDonation: (donationId: string, requestedQtyKg: number) => Promise<void>;
  acceptDonationRequest: (requestId: string, volunteerId?: string) => Promise<void>;
  rejectDonationRequest: (requestId: string, reason: string) => Promise<void>;
  assignVolunteerToDonation: (donationId: string, volunteerId?: string) => Promise<void>;
  verifyPickupByQr: (
    donationId: string,
    scannedQr: string
  ) => Promise<{ success: boolean; message: string }>;
  verifyDeliveryByQr: (
    donationId: string,
    scannedQr: string
  ) => Promise<{ success: boolean; message: string }>;
  confirmDonationReceipt: (donationId: string, notes?: string) => Promise<void>;
  updateUserVerification: (
    userId: string,
    status: VerificationStatus,
    reason?: string
  ) => Promise<void>;
  addVerificationRecord: (payload: {
    recordType: 'NGO' | 'RESTAURANT';
    licenseNumber: string;
    officialName: string;
    issuingAuthority: string;
    stateDistrict: string;
  }) => Promise<void>;
  createComplaint: (payload: {
    subject: string;
    description: string;
    donationId?: string;
  }) => Promise<void>;
  updateComplaintStatus: (
    id: string,
    status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED',
    resolutionNote?: string
  ) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;

  // Modals
  selectedDonationForCert: DonationItem | null;
  setSelectedDonationForCert: (item: DonationItem | null) => void;
  selectedDonationForQr: DonationItem | null;
  setSelectedDonationForQr: (item: DonationItem | null) => void;
}

const TOKEN_STORAGE_KEY = 'annadaan_session_token';

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentLanguage, setLanguage] = useState<LanguageCode>('en');
  const [theme, setThemeState] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('annadaan_theme');
    return saved === 'light' ? 'light' : 'dark';
  });

  const [sessionToken, setSessionToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_STORAGE_KEY)
  );
  const [isBootstrapping, setIsBootstrapping] = useState<boolean>(true);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [donations, setDonations] = useState<DonationItem[]>([]);
  const [requests, setRequests] = useState<DonationRequestItem[]>([]);
  const [assignments, setAssignments] = useState<VolunteerAssignment[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [complaints, setComplaints] = useState<ComplaintItem[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [publicOverview, setPublicOverview] = useState<PublicOverviewData | null>(null);

  const [selectedDonationForCert, setSelectedDonationForCert] =
    useState<DonationItem | null>(null);
  const [selectedDonationForQr, setSelectedDonationForQr] =
    useState<DonationItem | null>(null);

  const setTheme = (newTheme: 'dark' | 'light') => {
    setThemeState(newTheme);
    localStorage.setItem('annadaan_theme', newTheme);
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
  }, [theme]);

  const loadPublicOverview = useCallback(async () => {
    try {
      const res = await fetch('/api/public/overview');
      if (res.ok) {
        const data = (await res.json()) as PublicOverviewData;
        setPublicOverview(data);
      }
    } catch {
      // Ignore transient network failures
    }
  }, []);

  const loadBootstrap = useCallback(async (token: string) => {
    const res = await fetch('/api/bootstrap', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      setSessionToken(null);
      setCurrentUser(null);
      return false;
    }
    const data = await res.json();
    setCurrentUser(data.currentUser);
    setAllUsers(data.users || []);
    setDonations(data.donations || []);
    setRequests(data.requests || []);
    setAssignments(data.assignments || []);
    setNotifications(data.notifications || []);
    setAuditLogs(data.auditLogs || []);
    setComplaints(data.complaints || []);
    setAnalytics(data.analytics || null);
    return true;
  }, []);

  const refreshData = useCallback(async () => {
    await loadPublicOverview();
    if (sessionToken) {
      await loadBootstrap(sessionToken);
    }
  }, [loadBootstrap, loadPublicOverview, sessionToken]);

  useEffect(() => {
    let active = true;
    (async () => {
      await loadPublicOverview();
      if (sessionToken) {
        await loadBootstrap(sessionToken);
      }
      if (active) setIsBootstrapping(false);
    })();
    return () => {
      active = false;
    };
  }, [loadBootstrap, loadPublicOverview, sessionToken]);

  // Keep live data fresh while authenticated
  useEffect(() => {
    if (!sessionToken) return;
    const interval = setInterval(() => {
      loadBootstrap(sessionToken);
    }, 30_000);
    return () => clearInterval(interval);
  }, [loadBootstrap, sessionToken]);

  const apiCall = useCallback(
    async <T = unknown>(url: string, options: RequestInit = {}): Promise<T> => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
      };
      if (sessionToken) {
        headers.Authorization = `Bearer ${sessionToken}`;
      }
      const res = await fetch(url, { ...options, headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Request failed');
      }
      return data as T;
    },
    [sessionToken]
  );

  const t = (key: keyof typeof translations['en']): string => {
    return translations[currentLanguage]?.[key] || translations['en'][key] || key;
  };

  const login: AppContextType['login'] = async (role, email, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, email, password }),
    });
    const data = await res.json().catch(() => ({ error: 'Unable to sign in.' }));
    if (!res.ok) {
      return {
        ok: false,
        error: data.error || 'Invalid credentials.',
        code: data.code,
        rejectionReason: data.rejectionReason,
        allowResubmit: data.allowResubmit,
        currentReferenceNumber: data.currentReferenceNumber,
      };
    }

    localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
    setSessionToken(data.token);
    await loadBootstrap(data.token);
    return { ok: true, user: data.user };
  };

  const register: AppContextType['register'] = async (payload) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data.error || 'Registration failed.' };
    }
    if (data.token && data.user) {
      localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
      setSessionToken(data.token);
      await loadBootstrap(data.token);
    }
    return {
      ok: true,
      message: data.message,
      verificationStatus: data.verificationStatus,
    };
  };

  const resubmitVerification: AppContextType['resubmitVerification'] = async (
    payload
  ) => {
    const res = await fetch('/api/auth/resubmit-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data.error || 'Resubmission failed.' };
    }
    return { ok: true, message: data.message };
  };

  const logout = async () => {
    if (sessionToken) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionToken}` },
      }).catch(() => {});
    }
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setSessionToken(null);
    setCurrentUser(null);
    setAllUsers([]);
    setDonations([]);
    setRequests([]);
    setAssignments([]);
    setNotifications([]);
    setAuditLogs([]);
    setComplaints([]);
    await loadPublicOverview();
  };

  const createDonation: AppContextType['createDonation'] = async (item) => {
    const res = await apiCall<{ donation: DonationItem; matches: MatchingResult[] }>(
      '/api/donations',
      {
        method: 'POST',
        body: JSON.stringify(item),
      }
    );
    await refreshData();
    return res;
  };

  const publishDonation = async (donationId: string) => {
    await apiCall(`/api/donations/${donationId}/publish`, { method: 'PATCH' });
    await refreshData();
  };

  const cancelDonation = async (donationId: string, reason?: string) => {
    await apiCall(`/api/donations/${donationId}/cancel`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    });
    await refreshData();
  };

  const requestDonation = async (donationId: string, requestedQtyKg: number) => {
    await apiCall(`/api/donations/${donationId}/request`, {
      method: 'POST',
      body: JSON.stringify({ requestedQtyKg }),
    });
    await refreshData();
  };

  const acceptDonationRequest = async (requestId: string, volunteerId?: string) => {
    await apiCall(`/api/requests/${requestId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ volunteerId }),
    });
    await refreshData();
  };

  const rejectDonationRequest = async (requestId: string, reason: string) => {
    await apiCall(`/api/requests/${requestId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    await refreshData();
  };

  const assignVolunteerToDonation = async (donationId: string, volunteerId?: string) => {
    await apiCall(`/api/donations/${donationId}/assign-volunteer`, {
      method: 'POST',
      body: JSON.stringify({ volunteerId }),
    });
    await refreshData();
  };

  const verifyPickupByQr = async (donationId: string, scannedQr: string) => {
    try {
      const data = await apiCall<{ success: boolean; message: string }>(
        `/api/donations/${donationId}/verify-pickup`,
        {
          method: 'POST',
          body: JSON.stringify({ scannedQr }),
        }
      );
      await refreshData();
      return data;
    } catch (err) {
      return { success: false, message: (err as Error).message };
    }
  };

  const verifyDeliveryByQr = async (donationId: string, scannedQr: string) => {
    try {
      const data = await apiCall<{ success: boolean; message: string }>(
        `/api/donations/${donationId}/verify-delivery`,
        {
          method: 'POST',
          body: JSON.stringify({ scannedQr }),
        }
      );
      await refreshData();
      return data;
    } catch (err) {
      return { success: false, message: (err as Error).message };
    }
  };

  const confirmDonationReceipt = async (donationId: string, notes?: string) => {
    await apiCall(`/api/donations/${donationId}/confirm-receipt`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
    await refreshData();
  };

  const updateUserVerification = async (
    userId: string,
    status: VerificationStatus,
    reason?: string
  ) => {
    await apiCall(`/api/admin/verifications/${userId}`, {
      method: 'POST',
      body: JSON.stringify({ status, reason }),
    });
    await refreshData();
  };

  const addVerificationRecord: AppContextType['addVerificationRecord'] = async (
    payload
  ) => {
    await apiCall('/api/admin/verification-records', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    await refreshData();
  };

  const createComplaint: AppContextType['createComplaint'] = async (payload) => {
    await apiCall('/api/complaints', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    await refreshData();
  };

  const updateComplaintStatus: AppContextType['updateComplaintStatus'] = async (
    id,
    status,
    resolutionNote
  ) => {
    await apiCall(`/api/complaints/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, resolutionNote }),
    });
    await refreshData();
  };

  const markNotificationRead = async (id: string) => {
    await apiCall(`/api/notifications/${id}/read`, { method: 'POST' });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllNotificationsRead = async () => {
    await apiCall('/api/notifications/read-all', { method: 'POST' });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <AppContext.Provider
      value={{
        isBootstrapping,
        sessionToken,
        currentUser,
        allUsers,
        donations,
        requests,
        assignments,
        notifications,
        auditLogs,
        complaints,
        analytics,
        publicOverview,
        currentLanguage,
        t,
        theme,
        setTheme,
        toggleTheme,
        setLanguage,
        login,
        register,
        resubmitVerification,
        logout,
        refreshData,
        createDonation,
        publishDonation,
        cancelDonation,
        requestDonation,
        acceptDonationRequest,
        rejectDonationRequest,
        assignVolunteerToDonation,
        verifyPickupByQr,
        verifyDeliveryByQr,
        confirmDonationReceipt,
        updateUserVerification,
        addVerificationRecord,
        createComplaint,
        updateComplaintStatus,
        markNotificationRead,
        markAllNotificationsRead,
        selectedDonationForCert,
        setSelectedDonationForCert,
        selectedDonationForQr,
        setSelectedDonationForQr,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
