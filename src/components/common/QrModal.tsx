import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useApp } from '../../services/store.tsx';
import { QrCode, CheckCircle2, AlertTriangle, ShieldCheck, X } from 'lucide-react';

export const QrModal: React.FC = () => {
  const {
    selectedDonationForQr,
    setSelectedDonationForQr,
    verifyPickupByQr,
    verifyDeliveryByQr,
    donations,
  } = useApp();
  const [pickupQrDataUrl, setPickupQrDataUrl] = useState<string>('');
  const [deliveryQrDataUrl, setDeliveryQrDataUrl] = useState<string>('');
  const [verifyInput, setVerifyInput] = useState('');
  const [verifyResult, setVerifyResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const donation =
    donations.find((d) => d.id === selectedDonationForQr?.id) ||
    selectedDonationForQr;

  useEffect(() => {
    if (!donation) return;

    QRCode.toDataURL(donation.pickupQrCode, {
      width: 240,
      margin: 2,
      color: { dark: '#047857', light: '#ffffff' },
    }).then(setPickupQrDataUrl);

    QRCode.toDataURL(donation.deliveryQrCode, {
      width: 240,
      margin: 2,
      color: { dark: '#0284c7', light: '#ffffff' },
    }).then(setDeliveryQrDataUrl);

    setVerifyResult(null);
    setVerifyInput('');
  }, [donation?.id]);

  if (!donation) return null;

  const handleVerifyPickup = async (token: string) => {
    setIsBusy(true);
    try {
      const res = await verifyPickupByQr(donation.id, token);
      setVerifyResult(res);
    } finally {
      setIsBusy(false);
    }
  };

  const handleVerifyDelivery = async (token: string) => {
    setIsBusy(true);
    try {
      const res = await verifyDeliveryByQr(donation.id, token);
      setVerifyResult(res);
    } finally {
      setIsBusy(false);
    }
  };

  const handleManualScan = async () => {
    if (!verifyInput.trim()) return;
    if (donation.status === 'ASSIGNED' || donation.status === 'APPROVED') {
      await handleVerifyPickup(verifyInput);
    } else {
      await handleVerifyDelivery(verifyInput);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-2xl text-zinc-900 dark:text-zinc-100">
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">Handover QR Verification</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                {donation.id} · {donation.status}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedDonationForQr(null)}
            aria-label="Close QR dialog"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="flex flex-col items-center p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-center">
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> 1. Pickup Token
            </span>
            {pickupQrDataUrl ? (
              <img
                src={pickupQrDataUrl}
                alt="Pickup QR Code"
                className="w-36 h-36 rounded-lg bg-white p-1 mb-2"
              />
            ) : (
              <div className="w-36 h-36 bg-zinc-200 dark:bg-zinc-800 rounded-lg mb-2" />
            )}
            <p className="text-[10px] text-zinc-500 font-mono break-all mb-2">
              {donation.pickupQrCode}
            </p>
            <button
              type="button"
              onClick={() => handleVerifyPickup(donation.pickupQrCode)}
              disabled={isBusy || !['ASSIGNED', 'APPROVED'].includes(donation.status)}
              className="w-full py-1.5 px-2 text-xs font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 disabled:opacity-40 transition-colors"
            >
              Verify Pickup
            </button>
          </div>

          <div className="flex flex-col items-center p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-center">
            <span className="text-xs font-bold text-sky-600 dark:text-sky-400 mb-2 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> 2. Delivery Token
            </span>
            {deliveryQrDataUrl ? (
              <img
                src={deliveryQrDataUrl}
                alt="Delivery QR Code"
                className="w-36 h-36 rounded-lg bg-white p-1 mb-2"
              />
            ) : (
              <div className="w-36 h-36 bg-zinc-200 dark:bg-zinc-800 rounded-lg mb-2" />
            )}
            <p className="text-[10px] text-zinc-500 font-mono break-all mb-2">
              {donation.deliveryQrCode}
            </p>
            <button
              type="button"
              onClick={() => handleVerifyDelivery(donation.deliveryQrCode)}
              disabled={isBusy || donation.status !== 'PICKED_UP'}
              className="w-full py-1.5 px-2 text-xs font-semibold rounded-lg bg-sky-500 hover:bg-sky-400 text-zinc-950 disabled:opacity-40 transition-colors"
            >
              Verify Delivery
            </button>
          </div>
        </div>

        {verifyResult && (
          <div
            className={`p-3 rounded-xl border flex items-center gap-2 mb-4 text-xs ${
              verifyResult.success
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
            }`}
          >
            {verifyResult.success ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{verifyResult.message}</span>
          </div>
        )}

        <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
            Enter Verification Token
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={verifyInput}
              onChange={(e) => setVerifyInput(e.target.value)}
              placeholder="Paste pickup or delivery QR token"
              className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={handleManualScan}
              disabled={isBusy}
              className="px-3.5 py-1.5 bg-zinc-900 dark:bg-zinc-800 hover:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-semibold rounded-lg text-white"
            >
              Verify
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
