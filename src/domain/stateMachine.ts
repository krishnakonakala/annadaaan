import type { DonationItem, DonationStatus } from '../types/index.ts';

const ALLOWED_TRANSITIONS: Record<DonationStatus, DonationStatus[]> = {
  DRAFT: ['AVAILABLE', 'CANCELLED'],
  AVAILABLE: ['REQUESTED', 'EXPIRED', 'CANCELLED'],
  REQUESTED: ['APPROVED', 'AVAILABLE', 'REJECTED', 'EXPIRED', 'CANCELLED'],
  APPROVED: ['ASSIGNED', 'PICKED_UP', 'CANCELLED', 'EXPIRED'],
  ASSIGNED: ['PICKED_UP', 'CANCELLED'],
  PICKED_UP: ['DELIVERED'],
  DELIVERED: ['COMPLETED'],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: [],
  EXPIRED: [],
};

export function canTransitionDonationStatus(
  from: DonationStatus,
  to: DonationStatus
): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertValidDonationTransition(
  from: DonationStatus,
  to: DonationStatus
): void {
  if (!canTransitionDonationStatus(from, to)) {
    throw new Error(`Invalid donation status transition from ${from} to ${to}.`);
  }
}

export function isDonationExpired(
  donation: Pick<DonationItem, 'status' | 'safeConsumptionDeadline' | 'expiryTimestamp'>,
  nowMs: number = Date.now()
): boolean {
  if (donation.status === 'EXPIRED') return true;
  if (['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED'].includes(donation.status)) {
    return false;
  }
  const safeDeadlineMs = new Date(donation.safeConsumptionDeadline).getTime();
  const expiryMs = new Date(donation.expiryTimestamp).getTime();
  return safeDeadlineMs < nowMs || expiryMs < nowMs;
}

export function canRequestDonation(
  donation: Pick<DonationItem, 'status' | 'safeConsumptionDeadline' | 'expiryTimestamp' | 'quantityKg'>,
  requestedQtyKg: number,
  nowMs: number = Date.now()
): { allowed: boolean; reason?: string } {
  if (donation.status === 'EXPIRED' || isDonationExpired(donation, nowMs)) {
    return { allowed: false, reason: 'This donation has passed its safe consumption deadline and is expired.' };
  }
  if (donation.status !== 'AVAILABLE') {
    return { allowed: false, reason: `Donation is currently ${donation.status} and cannot be requested.` };
  }
  if (!Number.isFinite(requestedQtyKg) || requestedQtyKg <= 0) {
    return { allowed: false, reason: 'Requested quantity must be greater than zero.' };
  }
  if (requestedQtyKg > donation.quantityKg) {
    return { allowed: false, reason: `Requested quantity (${requestedQtyKg} kg) exceeds available batch (${donation.quantityKg} kg).` };
  }
  return { allowed: true };
}
