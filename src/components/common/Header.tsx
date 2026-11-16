import React, { useState } from 'react';
import { useApp } from '../../services/store.tsx';
import { AnnadaanLogo } from './AnnadaanLogo.tsx';
import { Bell, Globe, Sun, Moon, LogOut } from 'lucide-react';
import type { LanguageCode } from '../../i18n/translations.ts';

export const Header: React.FC<{
  activeTab: string;
  setActiveTab: (tab: string) => void;
}> = ({ activeTab, setActiveTab }) => {
  const {
    currentUser,
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    currentLanguage,
    setLanguage,
    theme,
    toggleTheme,
    t,
    logout,
  } = useApp();

  const [notifMenuOpen, setNotifMenuOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);

  if (!currentUser) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/90 backdrop-blur-md transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark */}
        <button
          type="button"
          onClick={() => setActiveTab('dashboard')}
          className="text-left focus-visible:outline-none"
        >
          <AnnadaanLogo size="md" showTagline={false} />
        </button>

        {/* Zone 2: Clean Single-Line Nav Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
              activeTab === 'dashboard'
                ? 'border-emerald-500 text-zinc-900 dark:text-white font-semibold'
                : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            Dashboard
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('map')}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
              activeTab === 'map'
                ? 'border-emerald-500 text-zinc-900 dark:text-white font-semibold'
                : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            Live Map
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-emerald-500 text-zinc-900 dark:text-white font-semibold'
                : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            {t('navImpact')}
          </button>
        </nav>

        {/* Zone 3: Account Controls & Logout */}
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="hidden lg:inline text-xs text-zinc-600 dark:text-zinc-400 truncate max-w-[180px]">
            {currentUser.organizationName || currentUser.name}
          </span>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-zinc-700" />
            )}
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setLangMenuOpen(!langMenuOpen);
                setNotifMenuOpen(false);
              }}
              aria-label="Change Language"
              className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors"
            >
              <Globe className="w-4 h-4" />
            </button>
            {langMenuOpen && (
              <div className="absolute right-0 mt-2 w-40 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-1.5 shadow-xl z-50">
                {[
                  { code: 'en', label: 'English' },
                  { code: 'te', label: 'తెలుగు (Telugu)' },
                  { code: 'hi', label: 'हिन्दी (Hindi)' },
                ].map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => {
                      setLanguage(item.code as LanguageCode);
                      setLangMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs rounded-lg transition-colors ${
                      currentLanguage === item.code
                        ? 'bg-emerald-500 text-zinc-950 font-bold'
                        : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setNotifMenuOpen(!notifMenuOpen);
                setLangMenuOpen(false);
              }}
              aria-label="Notifications"
              className="relative p-2 rounded-lg bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-zinc-950 text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {unreadCount}
                </span>
              )}
            </button>

            {notifMenuOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 shadow-xl z-50">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800 mb-2">
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                    Notifications
                  </span>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={() => markAllNotificationsRead()}
                      className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="space-y-1.5 max-h-72 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="text-xs text-zinc-500 text-center py-4">
                      No notifications
                    </p>
                  ) : (
                    notifications.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => markNotificationRead(item.id)}
                        className={`w-full text-left p-2.5 rounded-lg border text-xs transition-colors ${
                          item.read
                            ? 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400'
                            : 'bg-emerald-500/10 border-emerald-500/30 text-zinc-900 dark:text-zinc-100'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {item.title}
                          </span>
                          <span className="text-[10px] text-zinc-400 font-mono tabular-nums">
                            {new Date(item.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-xs leading-snug">{item.message}</p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => logout()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-800 hover:bg-zinc-800 dark:hover:bg-zinc-700 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Mobile navigation strip */}
      <div className="md:hidden border-t border-zinc-200 dark:border-zinc-800 px-4 py-2 flex items-center gap-4 text-xs font-medium overflow-x-auto">
        {[
          { id: 'dashboard', label: 'Dashboard' },
          { id: 'map', label: 'Live Map' },
          { id: 'overview', label: t('navImpact') },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`whitespace-nowrap shrink-0 py-1 ${
              activeTab === tab.id
                ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                : 'text-zinc-600 dark:text-zinc-400'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </header>
  );
};
