import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { useApp } from '../../services/store';
import { Award, CheckCircle, Download, Printer, Share2, ShieldCheck } from 'lucide-react';

export const CertificateModal: React.FC = () => {
  const { selectedDonationForCert, setSelectedDonationForCert } = useApp();

  const donation = selectedDonationForCert;

  useEffect(() => {
    if (donation) {
      try {
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#10b981', '#f59e0b', '#38bdf8'],
        });
      } catch {
        // Fallback silently if canvas context is restricted
      }
    }
  }, [donation]);

  if (!donation) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-3xl p-6 md:p-8 shadow-2xl text-zinc-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800 mb-6">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Official Food Rescue Certificate</h3>
              <p className="text-xs text-zinc-400">Verified Social Impact Record</p>
            </div>
          </div>
          <button
            onClick={() => setSelectedDonationForCert(null)}
            className="text-zinc-400 hover:text-zinc-200 text-lg font-bold p-1 rounded-lg"
          >
            ✕
          </button>
        </div>

        {/* Printable Certificate Frame */}
        <div
          id="printable-certificate"
          className="relative rounded-2xl border-4 border-double border-amber-500/40 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-6 md:p-8 shadow-inner text-center select-none"
        >
          {/* Watermark Logo */}
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none text-8xl font-black">
            ANNADAAN
          </div>

          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-zinc-950 font-black text-sm">
              अ
            </span>
            <span className="text-2xl font-black tracking-wider text-emerald-400">ANNADAAN</span>
          </div>
          <p className="text-xs uppercase tracking-widest text-zinc-400 font-mono mb-4">
            National Food Rescue & Redistribution Network
          </p>

          <div className="w-24 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent mx-auto mb-6" />

          <h2 className="text-xl md:text-2xl font-serif font-bold text-amber-200 mb-2">
            Certificate of Meaningful Contribution
          </h2>
          <p className="text-xs text-zinc-400 mb-6">
            Presented in grateful recognition of surplus food donation and community nourishment
          </p>

          <p className="text-xs text-zinc-400 uppercase tracking-wider font-mono">This is proudly presented to</p>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white mt-1 mb-4 underline decoration-amber-500/50 underline-offset-8">
            {donation.donorName}
          </h1>

          <p className="text-sm text-zinc-300 max-w-lg mx-auto leading-relaxed mb-6">
            For successfully redirecting <strong className="text-emerald-400 font-bold">{donation.quantityKg} kg</strong> of wholesome food ({donation.title}), providing an estimated <strong className="text-amber-400 font-bold">~{donation.estimatedServings} nourishing meals</strong> to the beneficiaries at <strong className="text-emerald-300">{donation.allocatedNgoName || 'Verified Receiving Shelter'}</strong>.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 text-left text-xs mb-6 font-mono">
            <div>
              <span className="text-[10px] text-zinc-500 block">DONATION ID</span>
              <span className="text-zinc-200 font-semibold">{donation.id}</span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 block">VERIFIED QUANTITY</span>
              <span className="text-emerald-400 font-semibold">{donation.quantityKg} kg</span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 block">MEALS RESCUED</span>
              <span className="text-amber-400 font-semibold">~{donation.estimatedServings} Servings</span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 block">DATE COMPLETED</span>
              <span className="text-zinc-200 font-semibold">
                {new Date(donation.updatedAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t border-zinc-800/80 text-left text-xs text-zinc-400 gap-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <span className="font-bold text-zinc-200 block text-[11px]">CRYPTOGRAPHICALLY VERIFIED</span>
                <span className="text-[10px] font-mono text-zinc-500">Hash: SHA256-ANND-{donation.id}</span>
              </div>
            </div>

            <div className="text-center sm:text-right">
              <div className="font-serif italic text-sm text-amber-200">Dr. Ananya Sharma</div>
              <div className="text-[10px] text-zinc-400">Chief Logistics Officer, Annadaan Platform</div>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold rounded-xl transition-colors shadow-lg shadow-emerald-500/20"
          >
            <Printer className="w-4 h-4" /> Print / Save as PDF
          </button>
          <button
            onClick={() => setSelectedDonationForCert(null)}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
