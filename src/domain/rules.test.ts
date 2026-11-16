import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateHaversineDistance, rankSuitableNgos } from './matching.ts';
import {
  assertValidDonationTransition,
  canRequestDonation,
  canTransitionDonationStatus,
  isDonationExpired,
} from './stateMachine.ts';
import type { DonationItem, UserProfile } from '../types/index.ts';

test('Haversine distance calculation is accurate for SRM University AP and Mangalagiri landmarks', () => {
  const dist = calculateHaversineDistance(16.4649, 80.5083, 16.4325, 80.5665);
  assert.ok(dist >= 6.5 && dist <= 8.0, `Expected ~7.2km, got ${dist}`);
});

test('rankSuitableNgos filters out PENDING/REJECTED NGOs and dietary mismatches', () => {
  const donation: DonationItem = {
    id: 'DON-TEST-1',
    donorId: 'rest-1',
    donorName: 'Test Kitchen',
    donorType: 'RESTAURANT',
    title: 'Chicken Dum Biryani',
    description: 'Fresh surplus batch',
    category: 'RICE_AND_BIRYANI',
    isVegetarian: false,
    quantityKg: 25,
    estimatedServings: 60,
    preparationTimestamp: new Date().toISOString(),
    expiryTimestamp: new Date(Date.now() + 8 * 3600 * 1000).toISOString(),
    safeConsumptionDeadline: new Date(Date.now() + 5 * 3600 * 1000).toISOString(),
    storageConditions: 'Hot insulated boxes',
    foodHandlingDeclared: true,
    pickupLocation: {
      latitude: 16.4649,
      longitude: 80.5083,
      address: 'Neerukonda, SRM University AP Road',
      city: 'Mangalagiri',
      state: 'Andhra Pradesh',
      postalCode: '522502',
    },
    pickupTimeWindow: 'Within 2 hours',
    status: 'AVAILABLE',
    pickupQrCode: 'QR-P-1',
    deliveryQrCode: 'QR-D-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    statusHistory: [],
  };

  const ngos: UserProfile[] = [
    {
      id: 'ngo-approved-all',
      name: 'Navajeevan Shelter',
      email: 'n1@test.org',
      role: 'ROLE_NGO',
      phone: '9000000001',
      verificationStatus: 'APPROVED',
      location: {
        latitude: 16.4618,
        longitude: 80.5142,
        address: 'Neerukonda',
        city: 'Mangalagiri',
        state: 'Andhra Pradesh',
        postalCode: '522502',
      },
      currentAvailableCapacityKg: 60,
      foodPreferences: ['ALL'],
      operatingHours: '24 Hours',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'ngo-approved-veg',
      name: 'Pure Veg Ashram',
      email: 'n2@test.org',
      role: 'ROLE_NGO',
      phone: '9000000002',
      verificationStatus: 'APPROVED',
      location: {
        latitude: 16.4735,
        longitude: 80.5260,
        address: 'Kuragallu',
        city: 'Amaravati',
        state: 'Andhra Pradesh',
        postalCode: '522503',
      },
      currentAvailableCapacityKg: 60,
      foodPreferences: ['VEG'],
      createdAt: new Date().toISOString(),
    },
    {
      id: 'ngo-pending',
      name: 'Pending Trust',
      email: 'n3@test.org',
      role: 'ROLE_NGO',
      phone: '9000000003',
      verificationStatus: 'PENDING',
      location: {
        latitude: 16.5060,
        longitude: 80.5210,
        address: 'Mandadam',
        city: 'Amaravati',
        state: 'Andhra Pradesh',
        postalCode: '522237',
      },
      currentAvailableCapacityKg: 90,
      foodPreferences: ['ALL'],
      createdAt: new Date().toISOString(),
    },
  ];

  const results = rankSuitableNgos(donation, ngos);
  assert.equal(results.length, 1);
  assert.equal(results[0].ngo.id, 'ngo-approved-all');
  assert.ok(results[0].totalScore >= 80);
});

test('Donation state machine enforces full lifecycle and rejects invalid jumps', () => {
  assert.equal(canTransitionDonationStatus('DRAFT', 'AVAILABLE'), true);
  assert.equal(canTransitionDonationStatus('AVAILABLE', 'REQUESTED'), true);
  assert.equal(canTransitionDonationStatus('REQUESTED', 'APPROVED'), true);
  assert.equal(canTransitionDonationStatus('APPROVED', 'ASSIGNED'), true);
  assert.equal(canTransitionDonationStatus('ASSIGNED', 'PICKED_UP'), true);
  assert.equal(canTransitionDonationStatus('PICKED_UP', 'DELIVERED'), true);
  assert.equal(canTransitionDonationStatus('DELIVERED', 'COMPLETED'), true);

  assert.equal(canTransitionDonationStatus('AVAILABLE', 'COMPLETED'), false);
  assert.equal(canTransitionDonationStatus('EXPIRED', 'REQUESTED'), false);
  assert.throws(() => assertValidDonationTransition('EXPIRED', 'APPROVED'));
});

test('Expired donations are detected and cannot be requested', () => {
  const past = new Date(Date.now() - 3600 * 1000).toISOString();
  const future = new Date(Date.now() + 3600 * 1000).toISOString();

  assert.equal(
    isDonationExpired({
      status: 'AVAILABLE',
      safeConsumptionDeadline: past,
      expiryTimestamp: future,
    }),
    true
  );

  const reqCheck = canRequestDonation(
    {
      status: 'AVAILABLE',
      safeConsumptionDeadline: past,
      expiryTimestamp: future,
      quantityKg: 20,
    },
    10
  );
  assert.equal(reqCheck.allowed, false);

  const validCheck = canRequestDonation(
    {
      status: 'AVAILABLE',
      safeConsumptionDeadline: future,
      expiryTimestamp: future,
      quantityKg: 20,
    },
    15
  );
  assert.equal(validCheck.allowed, true);
});
