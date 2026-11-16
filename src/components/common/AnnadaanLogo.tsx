import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
  className?: string;
}

export const AnnadaanLogo: React.FC<LogoProps> = ({
  size = 'md',
  showTagline = false,
  className = '',
}) => {
  const iconSizes = {
    sm: 'w-8 h-8',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
  };

  const textSizes = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-2xl',
  };

  return (
    <div className={`flex items-center gap-2.5 select-none shrink-0 ${className}`}>
      <div
        className={`${iconSizes[size]} rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 p-1.5 flex items-center justify-center shrink-0`}
      >
        <svg
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          <path
            d="M10 26C10 26 13 36 24 38C20 36 17 31 17 26C17 21 21 16 24 13C18 15 10 20 10 26Z"
            fill="#A7F3D0"
            opacity="0.95"
          />
          <path
            d="M38 26C38 26 35 36 24 38C28 36 31 31 31 26C31 21 27 16 24 13C30 15 38 20 38 26Z"
            fill="#34D399"
          />
          <path
            d="M24 11C24 11 20 18 20 23C20 26.5 21.8 29 24 29C26.2 29 28 26.5 28 23C28 18 24 11 24 11Z"
            fill="#FDE047"
          />
          <circle cx="24" cy="8" r="2.2" fill="#FEF08A" />
        </svg>
      </div>

      <div className="flex flex-col justify-center">
        <span
          className={`font-extrabold tracking-tight ${textSizes[size]} text-zinc-900 dark:text-white leading-none whitespace-nowrap`}
        >
          ANNADAAN
        </span>
        {showTagline && (
          <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mt-1 leading-none whitespace-nowrap">
            Every Meal Deserves a Purpose
          </span>
        )}
      </div>
    </div>
  );
};
