import type { DonationItem, MatchingResult, UserProfile } from '../types/index.ts';

export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

export interface MatchingWeights {
  distanceWeight: number;
  capacityWeight: number;
  compatibilityWeight: number;
  availabilityWeight: number;
  feasibilityWeight: number;
}

export const DEFAULT_MATCHING_WEIGHTS: MatchingWeights = {
  distanceWeight: 0.35,
  capacityWeight: 0.25,
  compatibilityWeight: 0.20,
  availabilityWeight: 0.10,
  feasibilityWeight: 0.10,
};

export function rankSuitableNgos(
  donation: DonationItem,
  ngos: UserProfile[],
  weights: MatchingWeights = DEFAULT_MATCHING_WEIGHTS,
  maxSearchRadiusKm: number = 30
): MatchingResult[] {
  const donorCoords = donation.pickupLocation;

  const eligibleCandidates = ngos.filter((ngo) => {
    if (ngo.role !== 'ROLE_NGO') return false;
    if (ngo.verificationStatus !== 'APPROVED') return false;

    const availableCap = ngo.currentAvailableCapacityKg ?? 0;
    if (availableCap < donation.quantityKg * 0.5) {
      return false;
    }

    const dist = calculateHaversineDistance(
      donorCoords.latitude,
      donorCoords.longitude,
      ngo.location.latitude,
      ngo.location.longitude
    );

    return dist <= maxSearchRadiusKm;
  });

  const scoredResults: MatchingResult[] = eligibleCandidates.map((ngo) => {
    const distanceKm = calculateHaversineDistance(
      donorCoords.latitude,
      donorCoords.longitude,
      ngo.location.latitude,
      ngo.location.longitude
    );

    const distanceScore = Math.max(0, Math.min(100, (1 - distanceKm / maxSearchRadiusKm) * 100));

    const availableCap = ngo.currentAvailableCapacityKg ?? 100;
    const capacityRatio = availableCap / Math.max(1, donation.quantityKg);
    let capacityScore = 100;
    if (capacityRatio < 1) {
      capacityScore = capacityRatio * 80;
    } else if (capacityRatio > 5) {
      capacityScore = 95;
    }

    let compatibilityScore = 70;
    const prefs = ngo.foodPreferences || ['ALL'];
    if (prefs.includes('ALL')) {
      compatibilityScore = 100;
    } else if (donation.isVegetarian && prefs.includes('VEG')) {
      compatibilityScore = 100;
    } else if (!donation.isVegetarian && prefs.includes('NON_VEG')) {
      compatibilityScore = 100;
    } else if (!donation.isVegetarian && prefs.includes('VEG')) {
      compatibilityScore = 0;
    }

    const availabilityScore = ngo.operatingHours ? 95 : 80;

    const now = Date.now();
    const deadline = new Date(donation.safeConsumptionDeadline).getTime();
    const hoursLeft = Math.max(0, (deadline - now) / (1000 * 60 * 60));

    let feasibilityScore = 90;
    if (hoursLeft < 3 && distanceKm > 10) {
      feasibilityScore = 40;
    } else if (hoursLeft < 6 && distanceKm <= 5) {
      feasibilityScore = 100;
    }

    const totalScore = Math.round(
      distanceScore * weights.distanceWeight +
        capacityScore * weights.capacityWeight +
        compatibilityScore * weights.compatibilityWeight +
        availabilityScore * weights.availabilityWeight +
        feasibilityScore * weights.feasibilityWeight
    );

    let matchGrade: MatchingResult['matchGrade'] = 'MODERATE';
    if (totalScore >= 90) matchGrade = 'EXCELLENT';
    else if (totalScore >= 75) matchGrade = 'VERY_GOOD';
    else if (totalScore >= 60) matchGrade = 'GOOD';

    return {
      ngo,
      distanceKm,
      distanceScore: Math.round(distanceScore),
      capacityScore: Math.round(capacityScore),
      compatibilityScore: Math.round(compatibilityScore),
      availabilityScore: Math.round(availabilityScore),
      urgencyScore: Math.round(feasibilityScore),
      totalScore,
      matchGrade,
    };
  });

  return scoredResults
    .filter((r) => r.compatibilityScore > 0)
    .sort((a, b) => {
      if (b.totalScore !== a.totalScore) {
        return b.totalScore - a.totalScore;
      }
      return a.distanceKm - b.distanceKm;
    });
}
