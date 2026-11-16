import express from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { DatabaseSync } from 'node:sqlite';
import type {
  AnalyticsSummary,
  AuditLogItem,
  ComplaintItem,
  DonationItem,
  DonationRequestItem,
  DonationStatus,
  NotificationItem,
  StatusHistoryItem,
  UserProfile,
  UserRole,
  VerificationStatus,
  VolunteerAssignment,
} from '../types/index.ts';
import {
  assertValidDonationTransition,
  canRequestDonation,
  isDonationExpired,
} from '../domain/stateMachine.ts';
import { rankSuitableNgos } from '../domain/matching.ts';

interface AuthenticatedRequest extends express.Request {
  authUser?: UserProfile;
  authToken?: string;
}

function genId(prefix: string): string {
  return `${prefix}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

export function expireStaleDonations(db: DatabaseSync): void {
  const nowIso = new Date().toISOString();
  const candidates = db
    .prepare(
      `SELECT id, status, safe_consumption_deadline, expiry_timestamp FROM donations WHERE status IN ('DRAFT', 'AVAILABLE', 'REQUESTED', 'APPROVED')`
    )
    .all() as Array<{
    id: string;
    status: DonationStatus;
    safe_consumption_deadline: string;
    expiry_timestamp: string;
  }>;

  const nowMs = Date.now();
  const updateDonation = db.prepare(
    `UPDATE donations SET status = 'EXPIRED', updated_at = ? WHERE id = ?`
  );
  const insertHistory = db.prepare(`
    INSERT INTO donation_status_history (
      id, donation_id, status, performed_by_user_id, performed_by_role, performed_by_name, note, timestamp
    ) VALUES (?, ?, 'EXPIRED', NULL, 'ROLE_ADMIN', 'Expiry Monitor', ?, ?)
  `);
  const rejectPendingReqs = db.prepare(`
    UPDATE food_requests SET status = 'REJECTED', rejection_reason = 'Donation expired before approval', response_timestamp = ?
    WHERE donation_id = ? AND status = 'PENDING'
  `);

  for (const row of candidates) {
    if (
      isDonationExpired(
        {
          status: row.status,
          safeConsumptionDeadline: row.safe_consumption_deadline,
          expiryTimestamp: row.expiry_timestamp,
        },
        nowMs
      )
    ) {
      db.exec('BEGIN TRANSACTION;');
      try {
        updateDonation.run(nowIso, row.id);
        insertHistory.run(
          genId('HIST'),
          row.id,
          'Passed safe consumption deadline. Automatically marked EXPIRED.',
          nowIso
        );
        rejectPendingReqs.run(nowIso, row.id);
        db.exec('COMMIT;');
      } catch {
        db.exec('ROLLBACK;');
      }
    }
  }
}

export function getUserProfileById(
  db: DatabaseSync,
  userId: string
): UserProfile | null {
  const userRow = db
    .prepare(`SELECT * FROM users WHERE id = ?`)
    .get(userId) as Record<string, unknown> | undefined;
  if (!userRow) return null;
  return hydrateUserProfile(db, userRow);
}

function hydrateUserProfile(
  db: DatabaseSync,
  userRow: Record<string, unknown>
): UserProfile {
  const id = String(userRow.id);
  const role = String(userRow.role) as UserRole;

  const profile: UserProfile = {
    id,
    name: String(userRow.full_name),
    email: String(userRow.email),
    role,
    phone: String(userRow.phone),
    verificationStatus: String(userRow.verification_status) as VerificationStatus,
    rejectionReason: userRow.rejection_reason
      ? String(userRow.rejection_reason)
      : undefined,
    createdAt: String(userRow.created_at),
    location: {
      latitude: Number(userRow.latitude),
      longitude: Number(userRow.longitude),
      address: String(userRow.address),
      city: String(userRow.city),
      state: String(userRow.state),
      postalCode: String(userRow.postal_code),
    },
  };

  if (role === 'ROLE_RESTAURANT') {
    const r = db
      .prepare(`SELECT * FROM restaurants WHERE user_id = ?`)
      .get(id) as Record<string, unknown> | undefined;
    if (r) {
      profile.organizationName = String(r.restaurant_name);
      profile.contactPerson = String(r.owner_manager_name);
      profile.licenseNumber = String(r.fssai_license_number);
      profile.issuingAuthority = String(r.issuing_authority);
      profile.restaurantCategory = String(r.restaurant_category);
      profile.operatingHours = String(r.operating_hours);
      profile.documentRef = String(r.document_ref);
    }
  } else if (role === 'ROLE_NGO') {
    const n = db
      .prepare(`SELECT * FROM ngos WHERE user_id = ?`)
      .get(id) as Record<string, unknown> | undefined;
    if (n) {
      profile.organizationName = String(n.organization_name);
      profile.registrationNumber = String(n.registration_number);
      profile.issuingAuthority = String(n.issuing_authority);
      profile.contactPerson = String(n.contact_person);
      profile.organizationType = String(n.organization_type) as UserProfile['organizationType'];
      profile.beneficiariesCount = Number(n.beneficiaries_count);
      profile.maxReceivingCapacityKg = Number(n.max_capacity_kg);
      profile.currentAvailableCapacityKg = Number(n.available_capacity_kg);
      profile.operatingHours = String(n.operating_hours);
      profile.documentRef = String(n.document_ref);
      try {
        profile.foodPreferences = JSON.parse(String(n.food_preferences));
      } catch {
        profile.foodPreferences = ['ALL'];
      }
    }
  } else if (role === 'ROLE_VOLUNTEER') {
    const v = db
      .prepare(`SELECT * FROM volunteers WHERE user_id = ?`)
      .get(id) as Record<string, unknown> | undefined;
    if (v) {
      profile.vehicleType = String(v.vehicle_type) as UserProfile['vehicleType'];
      profile.maxTravelDistanceKm = Number(v.max_travel_distance_km);
      profile.availabilityStatus = String(v.availability_status) as UserProfile['availabilityStatus'];
      profile.documentRef = String(v.id_document_ref);
    }
  }

  return profile;
}

function getAllUsersHydrated(db: DatabaseSync): UserProfile[] {
  const rows = db
    .prepare(`SELECT * FROM users ORDER BY created_at DESC`)
    .all() as Array<Record<string, unknown>>;
  return rows.map((r) => hydrateUserProfile(db, r));
}

function getAllDonationsHydrated(db: DatabaseSync): DonationItem[] {
  const rows = db
    .prepare(`SELECT * FROM donations ORDER BY created_at DESC`)
    .all() as Array<Record<string, unknown>>;

  const historyStmt = db.prepare(
    `SELECT * FROM donation_status_history WHERE donation_id = ? ORDER BY timestamp ASC`
  );

  return rows.map((row) => {
    const id = String(row.id);
    const historyRows = historyStmt.all(id) as Array<Record<string, unknown>>;
    const statusHistory: StatusHistoryItem[] = historyRows.map((h) => ({
      status: String(h.status) as DonationStatus,
      timestamp: String(h.timestamp),
      performedByRole: String(h.performed_by_role) as UserRole,
      performedByName: String(h.performed_by_name),
      note: h.note ? String(h.note) : undefined,
    }));

    return {
      id,
      donorId: String(row.donor_id),
      donorName: String(row.donor_name),
      donorType: String(row.donor_type) as 'RESTAURANT' | 'INDIVIDUAL',
      title: String(row.title),
      description: String(row.description),
      category: String(row.category) as DonationItem['category'],
      isVegetarian: Boolean(row.is_vegetarian),
      quantityKg: Number(row.quantity_kg),
      estimatedServings: Number(row.estimated_servings),
      preparationTimestamp: String(row.preparation_timestamp),
      expiryTimestamp: String(row.expiry_timestamp),
      safeConsumptionDeadline: String(row.safe_consumption_deadline),
      storageConditions: String(row.storage_conditions),
      allergenInfo: row.allergen_info ? String(row.allergen_info) : undefined,
      foodHandlingDeclared: Boolean(row.food_handling_declared),
      occasion: row.occasion ? (String(row.occasion) as DonationItem['occasion']) : undefined,
      pickupLocation: {
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        address: String(row.address),
        city: String(row.city),
        state: String(row.state),
        postalCode: String(row.postal_code),
      },
      pickupTimeWindow: String(row.pickup_time_window),
      specialInstructions: row.special_instructions
        ? String(row.special_instructions)
        : undefined,
      status: String(row.status) as DonationStatus,
      allocatedNgoId: row.allocated_ngo_id ? String(row.allocated_ngo_id) : undefined,
      allocatedNgoName: row.allocated_ngo_name ? String(row.allocated_ngo_name) : undefined,
      assignedVolunteerId: row.assigned_volunteer_id
        ? String(row.assigned_volunteer_id)
        : undefined,
      assignedVolunteerName: row.assigned_volunteer_name
        ? String(row.assigned_volunteer_name)
        : undefined,
      pickupQrCode: String(row.pickup_qr_code),
      deliveryQrCode: String(row.delivery_qr_code),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      statusHistory,
    };
  });
}

function getAllRequestsHydrated(db: DatabaseSync): DonationRequestItem[] {
  const rows = db
    .prepare(
      `SELECT r.*, d.title as donation_title
       FROM food_requests r
       JOIN donations d ON d.id = r.donation_id
       ORDER BY r.request_timestamp DESC`
    )
    .all() as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    id: String(r.id),
    donationId: String(r.donation_id),
    donationTitle: String(r.donation_title),
    ngoId: String(r.ngo_id),
    ngoName: String(r.ngo_name),
    requestedQuantityKg: Number(r.requested_quantity_kg),
    beneficiariesCount: Number(r.beneficiaries_count),
    status: String(r.status) as DonationRequestItem['status'],
    requestTimestamp: String(r.request_timestamp),
    responseTimestamp: r.response_timestamp ? String(r.response_timestamp) : undefined,
    rejectionReason: r.rejection_reason ? String(r.rejection_reason) : undefined,
  }));
}

function getAllAssignmentsHydrated(db: DatabaseSync): VolunteerAssignment[] {
  const rows = db
    .prepare(
      `SELECT a.*, d.title as donation_title, d.donor_name, d.address as pickup_address,
              d.latitude as pickup_lat, d.longitude as pickup_lng, d.pickup_time_window,
              d.allocated_ngo_id, d.allocated_ngo_name,
              u.address as delivery_address, u.latitude as delivery_lat, u.longitude as delivery_lng
       FROM volunteer_assignments a
       JOIN donations d ON d.id = a.donation_id
       LEFT JOIN users u ON u.id = d.allocated_ngo_id
       ORDER BY a.assigned_at DESC`
    )
    .all() as Array<Record<string, unknown>>;

  return rows.map((a) => ({
    id: String(a.id),
    donationId: String(a.donation_id),
    donationTitle: String(a.donation_title),
    volunteerId: String(a.volunteer_id),
    volunteerName: String(a.volunteer_name),
    donorName: String(a.donor_name),
    pickupAddress: String(a.pickup_address),
    pickupCoordinates: [Number(a.pickup_lat), Number(a.pickup_lng)],
    ngoName: a.allocated_ngo_name ? String(a.allocated_ngo_name) : 'Assigned Shelter',
    deliveryAddress: a.delivery_address ? String(a.delivery_address) : 'Shelter Address',
    deliveryCoordinates: [
      a.delivery_lat ? Number(a.delivery_lat) : 16.4649,
      a.delivery_lng ? Number(a.delivery_lng) : 80.5083,
    ],
    status: String(a.status) as VolunteerAssignment['status'],
    pickupDeadline: String(a.pickup_time_window),
    assignedAt: String(a.assigned_at),
    pickedUpAt: a.picked_up_at ? String(a.picked_up_at) : undefined,
    completedAt: a.completed_at ? String(a.completed_at) : undefined,
  }));
}

function writeNotification(
  db: DatabaseSync,
  userId: string,
  targetRole: UserRole | 'ALL',
  title: string,
  message: string,
  type: NotificationItem['type'] = 'INFO'
): void {
  db.prepare(`
    INSERT INTO notifications (id, user_id, target_role, title, message, type, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?)
  `).run(genId('NTF'), userId, targetRole, title, message, type, new Date().toISOString());
}

function writeAuditLog(
  db: DatabaseSync,
  actor: Pick<UserProfile, 'id' | 'role' | 'name'>,
  action: string,
  targetType: string,
  targetId: string,
  details: string
): void {
  db.prepare(`
    INSERT INTO audit_logs (id, actor_user_id, actor_role, actor_name, action, target_type, target_id, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    genId('AUD'),
    actor.id,
    actor.role,
    actor.name,
    action,
    targetType,
    targetId,
    details,
    new Date().toISOString()
  );
}

function computeAnalytics(
  db: DatabaseSync,
  users: UserProfile[],
  donations: DonationItem[]
): AnalyticsSummary {
  const completed = donations.filter((d) => d.status === 'COMPLETED');
  const totalFoodRescuedKg = completed.reduce((sum, d) => sum + d.quantityKg, 0);
  const totalMealsDistributed = completed.reduce(
    (sum, d) => sum + d.estimatedServings,
    0
  );
  const activeDonationsCount = donations.filter((d) =>
    ['AVAILABLE', 'REQUESTED', 'APPROVED', 'ASSIGNED', 'PICKED_UP', 'DELIVERED'].includes(
      d.status
    )
  ).length;
  const expiredDonationsCount = donations.filter((d) => d.status === 'EXPIRED').length;

  const categoryMap = new Map<string, { kg: number; count: number }>();
  const statusMap = new Map<string, number>();

  for (const d of donations) {
    const cat = categoryMap.get(d.category) || { kg: 0, count: 0 };
    cat.kg += d.quantityKg;
    cat.count += 1;
    categoryMap.set(d.category, cat);
    statusMap.set(d.status, (statusMap.get(d.status) || 0) + 1);
  }

  return {
    totalFoodRescuedKg,
    totalMealsDistributed,
    activeDonationsCount,
    completedDonationsCount: completed.length,
    expiredDonationsCount,
    participatingRestaurants: users.filter(
      (u) => u.role === 'ROLE_RESTAURANT' && u.verificationStatus === 'APPROVED'
    ).length,
    approvedNgos: users.filter(
      (u) => u.role === 'ROLE_NGO' && u.verificationStatus === 'APPROVED'
    ).length,
    pendingVerificationsCount: users.filter((u) => u.verificationStatus === 'PENDING')
      .length,
    registeredVolunteers: users.filter(
      (u) => u.role === 'ROLE_VOLUNTEER' && u.verificationStatus === 'APPROVED'
    ).length,
    co2EmissionsPreventedKg: Math.round(totalFoodRescuedKg * 2.5),
    categoryBreakdown: Array.from(categoryMap.entries()).map(([category, v]) => ({
      category,
      kg: v.kg,
      count: v.count,
    })),
    statusBreakdown: Array.from(statusMap.entries()).map(([status, count]) => ({
      status,
      count,
    })),
  };
}

export function createApiRouter(db: DatabaseSync): express.Router {
  const router = express.Router();
  router.use(express.json());

  const requireAuth: express.RequestHandler = (
    req: AuthenticatedRequest,
    res,
    next
  ) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const session = db
      .prepare(`SELECT * FROM sessions WHERE token = ?`)
      .get(token) as { token: string; user_id: string; expires_at: string } | undefined;

    if (!session || new Date(session.expires_at).getTime() < Date.now()) {
      if (session) {
        db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
      }
      res.status(401).json({ error: 'Session expired. Please sign in again.' });
      return;
    }

    const user = getUserProfileById(db, session.user_id);
    if (!user || user.verificationStatus !== 'APPROVED') {
      res.status(403).json({
        error: 'Your account is not active or approved.',
      });
      return;
    }

    req.authUser = user;
    req.authToken = token;
    next();
  };

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Public overview for initial screen & public map preview (no sensitive info)
  router.get('/public/overview', (_req, res) => {
    expireStaleDonations(db);
    const users = getAllUsersHydrated(db);
    const donations = getAllDonationsHydrated(db);
    const analytics = computeAnalytics(db, users, donations);

    const verifiedTestRecords = db
      .prepare(
        `SELECT record_type, license_number, official_name, issuing_authority, state_district, is_test_record
         FROM verification_records WHERE is_active = 1 ORDER BY record_type, license_number`
      )
      .all();

    res.json({
      analytics,
      publicNgos: users
        .filter((u) => u.role === 'ROLE_NGO' && u.verificationStatus === 'APPROVED')
        .map((u) => ({
          id: u.id,
          name: u.organizationName || u.name,
          organizationType: u.organizationType,
          location: u.location,
          currentAvailableCapacityKg: u.currentAvailableCapacityKg,
          beneficiariesCount: u.beneficiariesCount,
        })),
      publicDonations: donations
        .filter((d) => ['AVAILABLE', 'REQUESTED', 'APPROVED', 'ASSIGNED', 'PICKED_UP'].includes(d.status))
        .map((d) => ({
          id: d.id,
          title: d.title,
          donorName: d.donorName,
          quantityKg: d.quantityKg,
          estimatedServings: d.estimatedServings,
          isVegetarian: d.isVegetarian,
          status: d.status,
          safeConsumptionDeadline: d.safeConsumptionDeadline,
          pickupLocation: d.pickupLocation,
        })),
      testVerificationRegistry: verifiedTestRecords,
    });
  });

  // LOGIN
  router.post('/auth/login', (req, res) => {
    const { email, password, role } = req.body as {
      email?: string;
      password?: string;
      role?: UserRole;
    };

    if (!email || !password || !role) {
      res.status(400).json({ error: 'Email, password, and role are required.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const userRow = db
      .prepare(`SELECT * FROM users WHERE email = ?`)
      .get(cleanEmail) as Record<string, unknown> | undefined;

    const recordAttempt = (success: boolean, reason: string) => {
      db.prepare(`
        INSERT INTO login_attempts (id, email, role, success, reason, ip_address, attempted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        genId('LOG'),
        cleanEmail,
        role,
        success ? 1 : 0,
        reason,
        req.ip || '127.0.0.1',
        new Date().toISOString()
      );
    };

    if (!userRow) {
      recordAttempt(false, 'Account not found');
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const userRole = String(userRow.role) as UserRole;
    if (userRole !== role) {
      recordAttempt(false, `Role mismatch (expected ${userRole})`);
      res.status(403).json({
        error: `This email belongs to a different account role (${userRole.replace('ROLE_', '')}). Please select the matching role.`,
      });
      return;
    }

    const passwordMatches = bcrypt.compareSync(
      password,
      String(userRow.password_hash)
    );
    if (!passwordMatches) {
      recordAttempt(false, 'Incorrect password');
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const verificationStatus = String(userRow.verification_status) as VerificationStatus;
    if (verificationStatus === 'PENDING') {
      recordAttempt(false, 'Verification pending');
      const entityLabel =
        role === 'ROLE_NGO'
          ? 'NGO'
          : role === 'ROLE_RESTAURANT'
          ? 'restaurant'
          : 'volunteer';
      res.status(403).json({
        code: 'VERIFICATION_PENDING',
        error: `Your ${entityLabel} verification is pending.`,
      });
      return;
    }

    if (verificationStatus === 'REJECTED') {
      recordAttempt(false, 'Verification rejected');
      const hydrated = hydrateUserProfile(db, userRow);
      res.status(403).json({
        code: 'VERIFICATION_REJECTED',
        error: 'Your organization verification was rejected.',
        rejectionReason: hydrated.rejectionReason || 'Verification details could not be validated.',
        allowResubmit: role === 'ROLE_NGO' || role === 'ROLE_RESTAURANT',
        currentReferenceNumber:
          hydrated.registrationNumber || hydrated.licenseNumber || '',
      });
      return;
    }

    if (verificationStatus === 'SUSPENDED') {
      recordAttempt(false, 'Account suspended');
      res.status(403).json({
        code: 'ACCOUNT_SUSPENDED',
        error: 'Your account has been suspended by an administrator.',
      });
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const nowIso = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

    db.prepare(
      `INSERT INTO sessions (token, user_id, role, created_at, expires_at) VALUES (?, ?, ?, ?, ?)`
    ).run(token, String(userRow.id), userRole, nowIso, expiresAt);

    recordAttempt(true, 'Authenticated');
    const profile = hydrateUserProfile(db, userRow);

    res.json({ token, user: profile });
  });

  // REGISTER
  router.post('/auth/register', (req, res) => {
    const body = req.body as Record<string, unknown>;
    const role = String(body.role || '') as UserRole;

    if (role === 'ROLE_ADMIN') {
      res.status(403).json({
        error: 'Administrator accounts cannot be self-registered.',
      });
      return;
    }

    if (
      !['ROLE_RESTAURANT', 'ROLE_NGO', 'ROLE_INDIVIDUAL', 'ROLE_VOLUNTEER'].includes(
        role
      )
    ) {
      res.status(400).json({ error: 'Invalid role selected.' });
      return;
    }

    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const fullName = String(body.fullName || body.contactPerson || '').trim();
    const phone = String(body.phone || '').trim();
    const address = String(body.address || '').trim();
    const city = String(body.city || 'Mangalagiri').trim();
    const state = String(body.state || 'Andhra Pradesh').trim();
    const postalCode = String(body.postalCode || '522502').trim();
    const latitude = Number(body.latitude) || 16.4649;
    const longitude = Number(body.longitude) || 80.5083;

    if (!email || !password || password.length < 6 || !phone || !address) {
      res.status(400).json({
        error:
          'Please complete all required fields (valid email, password of at least 6 characters, mobile number, and address).',
      });
      return;
    }

    const existingEmail = db
      .prepare(`SELECT id FROM users WHERE email = ?`)
      .get(email);
    if (existingEmail) {
      res.status(409).json({
        error: 'An account with this email already exists. Please sign in instead.',
      });
      return;
    }

    const userId = genId('USR');
    const nowIso = new Date().toISOString();
    const passwordHash = bcrypt.hashSync(password, 10);

    if (role === 'ROLE_NGO') {
      const organizationName = String(body.organizationName || '').trim();
      const registrationNumber = String(body.registrationNumber || '').trim().toUpperCase();
      const issuingAuthority = String(body.issuingAuthority || '').trim();
      const contactPerson = String(body.contactPerson || fullName).trim();
      const organizationType = String(body.organizationType || 'ORPHANAGE');
      const stateDistrict = String(body.stateDistrict || `${city}, ${state}`).trim();
      const beneficiariesCount = Number(body.beneficiariesCount) || 40;
      const maxCapacityKg = Number(body.maxCapacityKg) || 60;
      const documentRef = String(body.documentRef || '').trim();
      const operatingHours = String(body.operatingHours || '08:00 AM - 09:00 PM').trim();
      const foodPreferences = Array.isArray(body.foodPreferences)
        ? body.foodPreferences
        : ['ALL'];

      if (
        !organizationName ||
        !registrationNumber ||
        !issuingAuthority ||
        !contactPerson ||
        !documentRef
      ) {
        res.status(400).json({
          error:
            'NGO registration requires official name, registration number, issuing authority, contact person, and supporting document reference.',
        });
        return;
      }

      const duplicateReg = db
        .prepare(`SELECT user_id FROM ngos WHERE registration_number = ?`)
        .get(registrationNumber);
      if (duplicateReg) {
        res.status(409).json({
          error: 'This NGO registration number is already registered on ANNADAAN.',
        });
        return;
      }

      const verifiedRecord = db
        .prepare(
          `SELECT * FROM verification_records WHERE record_type = 'NGO' AND license_number = ? AND is_active = 1`
        )
        .get(registrationNumber) as Record<string, unknown> | undefined;

      if (!verifiedRecord) {
        res.status(400).json({
          error: 'Invalid NGO registration number.',
        });
        return;
      }

      db.exec('BEGIN TRANSACTION;');
      try {
        db.prepare(`
          INSERT INTO users (
            id, email, password_hash, role, full_name, phone, verification_status,
            address, city, state, postal_code, latitude, longitude, created_at, updated_at
          ) VALUES (?, ?, ?, 'ROLE_NGO', ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          userId,
          email,
          passwordHash,
          contactPerson,
          phone,
          address,
          city,
          state,
          postalCode,
          latitude,
          longitude,
          nowIso,
          nowIso
        );

        db.prepare(`
          INSERT INTO ngos (
            user_id, organization_name, registration_number, issuing_authority, contact_person,
            organization_type, state_district, beneficiaries_count, max_capacity_kg,
            available_capacity_kg, food_preferences, operating_hours, document_ref
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          userId,
          organizationName,
          registrationNumber,
          issuingAuthority,
          contactPerson,
          organizationType,
          stateDistrict,
          beneficiariesCount,
          maxCapacityKg,
          maxCapacityKg,
          JSON.stringify(foodPreferences),
          operatingHours,
          documentRef
        );

        db.prepare(`
          INSERT INTO registration_documents (id, user_id, doc_type, reference_code, uploaded_at)
          VALUES (?, ?, 'NGO_CERTIFICATE', ?, ?)
        `).run(genId('DOC'), userId, documentRef, nowIso);

        writeNotification(
          db,
          'user-admin',
          'ROLE_ADMIN',
          'New NGO Verification Request',
          `${organizationName} (${registrationNumber}) submitted documents for approval.`,
          'ALERT'
        );

        writeAuditLog(
          db,
          { id: userId, role: 'ROLE_NGO', name: organizationName },
          'NGO_REGISTER',
          'USER',
          userId,
          `Registered NGO ${organizationName} with registry number ${registrationNumber} (Status: PENDING).`
        );

        db.exec('COMMIT;');
      } catch (err) {
        db.exec('ROLLBACK;');
        throw err;
      }

      res.status(201).json({
        verificationStatus: 'PENDING',
        message:
          'NGO registration submitted. Your NGO verification is pending administrator review.',
      });
      return;
    }

    if (role === 'ROLE_RESTAURANT') {
      const restaurantName = String(body.restaurantName || '').trim();
      const ownerManagerName = String(body.ownerManagerName || fullName).trim();
      const licenseNumber = String(body.licenseNumber || '').trim().toUpperCase();
      const issuingAuthority = String(body.issuingAuthority || 'FSSAI Authority').trim();
      const restaurantCategory = String(body.restaurantCategory || 'Restaurant').trim();
      const operatingHours = String(body.operatingHours || '09:00 AM - 11:00 PM').trim();
      const documentRef = String(body.documentRef || '').trim();

      if (!restaurantName || !ownerManagerName || !licenseNumber || !documentRef) {
        res.status(400).json({
          error:
            'Restaurant registration requires restaurant name, owner/manager name, FSSAI/food licence number, and supporting document reference.',
        });
        return;
      }

      const duplicateLic = db
        .prepare(`SELECT user_id FROM restaurants WHERE fssai_license_number = ?`)
        .get(licenseNumber);
      if (duplicateLic) {
        res.status(409).json({
          error: 'This FSSAI licence number is already registered on ANNADAAN.',
        });
        return;
      }

      const verifiedRecord = db
        .prepare(
          `SELECT * FROM verification_records WHERE record_type = 'RESTAURANT' AND license_number = ? AND is_active = 1`
        )
        .get(licenseNumber);
      if (!verifiedRecord) {
        res.status(400).json({
          error: 'Invalid FSSAI / food licence number.',
        });
        return;
      }

      db.exec('BEGIN TRANSACTION;');
      try {
        db.prepare(`
          INSERT INTO users (
            id, email, password_hash, role, full_name, phone, verification_status,
            address, city, state, postal_code, latitude, longitude, created_at, updated_at
          ) VALUES (?, ?, ?, 'ROLE_RESTAURANT', ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          userId,
          email,
          passwordHash,
          ownerManagerName,
          phone,
          address,
          city,
          state,
          postalCode,
          latitude,
          longitude,
          nowIso,
          nowIso
        );

        db.prepare(`
          INSERT INTO restaurants (
            user_id, restaurant_name, owner_manager_name, fssai_license_number,
            issuing_authority, restaurant_category, operating_hours, document_ref
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          userId,
          restaurantName,
          ownerManagerName,
          licenseNumber,
          issuingAuthority,
          restaurantCategory,
          operatingHours,
          documentRef
        );

        db.prepare(`
          INSERT INTO registration_documents (id, user_id, doc_type, reference_code, uploaded_at)
          VALUES (?, ?, 'FSSAI_LICENSE', ?, ?)
        `).run(genId('DOC'), userId, documentRef, nowIso);

        writeNotification(
          db,
          'user-admin',
          'ROLE_ADMIN',
          'New Restaurant Verification Request',
          `${restaurantName} (${licenseNumber}) submitted FSSAI credentials for review.`,
          'ALERT'
        );

        writeAuditLog(
          db,
          { id: userId, role: 'ROLE_RESTAURANT', name: restaurantName },
          'RESTAURANT_REGISTER',
          'USER',
          userId,
          `Registered restaurant ${restaurantName} with licence ${licenseNumber} (Status: PENDING).`
        );

        db.exec('COMMIT;');
      } catch (err) {
        db.exec('ROLLBACK;');
        throw err;
      }

      res.status(201).json({
        verificationStatus: 'PENDING',
        message:
          'Restaurant registration submitted. Your restaurant verification is pending administrator review.',
      });
      return;
    }

    if (role === 'ROLE_VOLUNTEER') {
      const vehicleType = String(body.vehicleType || 'TWO_WHEELER');
      const maxTravelDistanceKm = Number(body.maxTravelDistanceKm) || 15;
      const availabilityStatus = String(body.availabilityStatus || 'AVAILABLE');
      const documentRef = String(body.documentRef || '').trim();

      if (!fullName || !documentRef) {
        res.status(400).json({
          error:
            'Volunteer registration requires full name and driving licence / ID reference.',
        });
        return;
      }

      db.exec('BEGIN TRANSACTION;');
      try {
        db.prepare(`
          INSERT INTO users (
            id, email, password_hash, role, full_name, phone, verification_status,
            address, city, state, postal_code, latitude, longitude, created_at, updated_at
          ) VALUES (?, ?, ?, 'ROLE_VOLUNTEER', ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          userId,
          email,
          passwordHash,
          fullName,
          phone,
          address,
          city,
          state,
          postalCode,
          latitude,
          longitude,
          nowIso,
          nowIso
        );

        db.prepare(`
          INSERT INTO volunteers (user_id, vehicle_type, max_travel_distance_km, availability_status, id_document_ref)
          VALUES (?, ?, ?, ?, ?)
        `).run(userId, vehicleType, maxTravelDistanceKm, availabilityStatus, documentRef);

        db.prepare(`
          INSERT INTO registration_documents (id, user_id, doc_type, reference_code, uploaded_at)
          VALUES (?, ?, 'VOLUNTEER_ID', ?, ?)
        `).run(genId('DOC'), userId, documentRef, nowIso);

        writeNotification(
          db,
          'user-admin',
          'ROLE_ADMIN',
          'New Volunteer Application',
          `${fullName} applied as a ${vehicleType} volunteer courier.`,
          'ALERT'
        );

        db.exec('COMMIT;');
      } catch (err) {
        db.exec('ROLLBACK;');
        throw err;
      }

      res.status(201).json({
        verificationStatus: 'PENDING',
        message:
          'Volunteer registration submitted. Your volunteer verification is pending administrator review.',
      });
      return;
    }

    // ROLE_INDIVIDUAL — direct simple registration (immediately APPROVED)
    if (!fullName) {
      res.status(400).json({ error: 'Full name is required.' });
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

    db.exec('BEGIN TRANSACTION;');
    try {
      db.prepare(`
        INSERT INTO users (
          id, email, password_hash, role, full_name, phone, verification_status,
          address, city, state, postal_code, latitude, longitude, created_at, updated_at
        ) VALUES (?, ?, ?, 'ROLE_INDIVIDUAL', ?, ?, 'APPROVED', ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        email,
        passwordHash,
        fullName,
        phone,
        address,
        city,
        state,
        postalCode,
        latitude,
        longitude,
        nowIso,
        nowIso
      );

      db.prepare(`INSERT INTO individual_donors (user_id, preferred_occasion) VALUES (?, ?)`).run(
        userId,
        String(body.preferredOccasion || 'FAMILY_FUNCTION')
      );

      db.prepare(
        `INSERT INTO sessions (token, user_id, role, created_at, expires_at) VALUES (?, ?, 'ROLE_INDIVIDUAL', ?, ?)`
      ).run(token, userId, nowIso, expiresAt);

      db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }

    const user = getUserProfileById(db, userId);
    res.status(201).json({
      verificationStatus: 'APPROVED',
      token,
      user,
      message: 'Account created successfully.',
    });
  });

  // RESUBMIT REJECTED VERIFICATION
  router.post('/auth/resubmit-verification', (req, res) => {
    const { email, password, role, referenceNumber, documentRef } = req.body as {
      email?: string;
      password?: string;
      role?: UserRole;
      referenceNumber?: string;
      documentRef?: string;
    };

    if (!email || !password || !role || !referenceNumber || !documentRef) {
      res.status(400).json({
        error: 'Email, password, updated licence/registration number, and document reference are required.',
      });
      return;
    }

    const userRow = db
      .prepare(`SELECT * FROM users WHERE email = ?`)
      .get(email.trim().toLowerCase()) as Record<string, unknown> | undefined;

    if (
      !userRow ||
      String(userRow.role) !== role ||
      !bcrypt.compareSync(password, String(userRow.password_hash))
    ) {
      res.status(401).json({ error: 'Invalid credentials for resubmission.' });
      return;
    }

    const userId = String(userRow.id);
    const cleanRef = referenceNumber.trim().toUpperCase();
    const recordType = role === 'ROLE_NGO' ? 'NGO' : 'RESTAURANT';

    const validRecord = db
      .prepare(
        `SELECT * FROM verification_records WHERE record_type = ? AND license_number = ? AND is_active = 1`
      )
      .get(recordType, cleanRef);
    if (!validRecord) {
      res.status(400).json({
        error:
          role === 'ROLE_NGO'
            ? 'Invalid NGO registration number.'
            : 'Invalid FSSAI / food licence number.',
      });
      return;
    }

    const nowIso = new Date().toISOString();
    db.exec('BEGIN TRANSACTION;');
    try {
      if (role === 'ROLE_NGO') {
        const conflict = db
          .prepare(`SELECT user_id FROM ngos WHERE registration_number = ? AND user_id != ?`)
          .get(cleanRef, userId);
        if (conflict) {
          db.exec('ROLLBACK;');
          res.status(409).json({
            error: 'This NGO registration number is already registered on ANNADAAN.',
          });
          return;
        }
        db.prepare(
          `UPDATE ngos SET registration_number = ?, document_ref = ? WHERE user_id = ?`
        ).run(cleanRef, documentRef.trim(), userId);
      } else {
        const conflict = db
          .prepare(
            `SELECT user_id FROM restaurants WHERE fssai_license_number = ? AND user_id != ?`
          )
          .get(cleanRef, userId);
        if (conflict) {
          db.exec('ROLLBACK;');
          res.status(409).json({
            error: 'This FSSAI licence number is already registered on ANNADAAN.',
          });
          return;
        }
        db.prepare(
          `UPDATE restaurants SET fssai_license_number = ?, document_ref = ? WHERE user_id = ?`
        ).run(cleanRef, documentRef.trim(), userId);
      }

      db.prepare(
        `UPDATE users SET verification_status = 'PENDING', rejection_reason = NULL, updated_at = ? WHERE id = ?`
      ).run(nowIso, userId);

      db.prepare(
        `INSERT INTO registration_documents (id, user_id, doc_type, reference_code, uploaded_at) VALUES (?, ?, 'RESUBMISSION', ?, ?)`
      ).run(genId('DOC'), userId, documentRef.trim(), nowIso);

      writeNotification(
        db,
        'user-admin',
        'ROLE_ADMIN',
        'Verification Resubmitted',
        `${String(userRow.full_name)} resubmitted credentials (${cleanRef}) for review.`,
        'ALERT'
      );

      db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }

    res.json({
      verificationStatus: 'PENDING',
      message: 'Verification resubmitted. Your account is now pending administrator review.',
    });
  });

  router.get('/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({ user: req.authUser });
  });

  router.post('/auth/logout', requireAuth, (req: AuthenticatedRequest, res) => {
    if (req.authToken) {
      db.prepare(`DELETE FROM sessions WHERE token = ?`).run(req.authToken);
    }
    res.json({ success: true });
  });

  // BOOTSTRAP DASHBOARD DATA
  router.get('/bootstrap', requireAuth, (req: AuthenticatedRequest, res) => {
    expireStaleDonations(db);
    const currentUser = req.authUser!;
    const users = getAllUsersHydrated(db);
    const donations = getAllDonationsHydrated(db);
    const requests = getAllRequestsHydrated(db);
    const assignments = getAllAssignmentsHydrated(db);
    const analytics = computeAnalytics(db, users, donations);

    const notifRows = db
      .prepare(
        `SELECT * FROM notifications WHERE user_id = ? OR target_role = ? OR target_role = 'ALL' ORDER BY created_at DESC LIMIT 40`
      )
      .all(currentUser.id, currentUser.role) as Array<Record<string, unknown>>;

    const notifications: NotificationItem[] = notifRows.map((n) => ({
      id: String(n.id),
      userId: String(n.user_id),
      targetRole: String(n.target_role) as NotificationItem['targetRole'],
      title: String(n.title),
      message: String(n.message),
      type: String(n.type) as NotificationItem['type'],
      read: Boolean(n.is_read),
      timestamp: String(n.created_at),
    }));

    let auditLogs: AuditLogItem[] = [];
    if (currentUser.role === 'ROLE_ADMIN') {
      const aRows = db
        .prepare(`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 80`)
        .all() as Array<Record<string, unknown>>;
      auditLogs = aRows.map((a) => ({
        id: String(a.id),
        actorUserId: String(a.actor_user_id),
        actorRole: String(a.actor_role) as UserRole,
        actorName: String(a.actor_name),
        action: String(a.action),
        targetType: String(a.target_type),
        targetId: String(a.target_id),
        details: String(a.details),
        createdAt: String(a.created_at),
      }));
    }

    const complaintRows =
      currentUser.role === 'ROLE_ADMIN'
        ? (db
            .prepare(`SELECT * FROM complaints ORDER BY created_at DESC`)
            .all() as Array<Record<string, unknown>>)
        : (db
            .prepare(
              `SELECT * FROM complaints WHERE reporter_user_id = ? ORDER BY created_at DESC`
            )
            .all(currentUser.id) as Array<Record<string, unknown>>);

    const complaints: ComplaintItem[] = complaintRows.map((c) => ({
      id: String(c.id),
      reporterUserId: String(c.reporter_user_id),
      reporterName: String(c.reporter_name),
      donationId: c.donation_id ? String(c.donation_id) : undefined,
      subject: String(c.subject),
      description: String(c.description),
      status: String(c.status) as ComplaintItem['status'],
      resolutionNote: c.resolution_note ? String(c.resolution_note) : undefined,
      createdAt: String(c.created_at),
      updatedAt: String(c.updated_at),
    }));

    res.json({
      currentUser,
      users,
      donations,
      requests,
      assignments,
      notifications,
      auditLogs,
      complaints,
      analytics,
    });
  });

  // CREATE DONATION
  router.post('/donations', requireAuth, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    if (user.role !== 'ROLE_RESTAURANT' && user.role !== 'ROLE_INDIVIDUAL') {
      res.status(403).json({ error: 'Only restaurants and individual donors can post donations.' });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const title = String(body.title || '').trim();
    const quantityKg = Number(body.quantityKg);
    const estimatedServings = Number(body.estimatedServings) || Math.round(quantityKg * 2.5);
    const initialStatus: DonationStatus =
      body.status === 'DRAFT' ? 'DRAFT' : 'AVAILABLE';

    if (!title || !Number.isFinite(quantityKg) || quantityKg <= 0) {
      res.status(400).json({ error: 'Food title and positive quantity (kg) are required.' });
      return;
    }

    const nowIso = new Date().toISOString();
    const id = `DON-2026-${crypto.randomInt(105, 9999)}`;
    const secret = crypto.randomBytes(3).toString('hex').toUpperCase();
    const pickupQrCode = `ANNADAAN-PICKUP-${id}-${secret}`;
    const deliveryQrCode = `ANNADAAN-DELIV-${id}-${secret}`;
    const donorName = user.organizationName || user.name;
    const donorType = user.role === 'ROLE_RESTAURANT' ? 'RESTAURANT' : 'INDIVIDUAL';

    const pickupLoc = (body.pickupLocation as Record<string, unknown>) || {};
    const address = String(pickupLoc.address || user.location.address);
    const city = String(pickupLoc.city || user.location.city);
    const state = String(pickupLoc.state || user.location.state);
    const postalCode = String(pickupLoc.postalCode || user.location.postalCode);
    const latitude = Number(pickupLoc.latitude) || user.location.latitude;
    const longitude = Number(pickupLoc.longitude) || user.location.longitude;

    const safeConsumptionDeadline = String(
      body.safeConsumptionDeadline ||
        new Date(Date.now() + 5 * 3600 * 1000).toISOString()
    );
    const expiryTimestamp = String(
      body.expiryTimestamp || new Date(Date.now() + 8 * 3600 * 1000).toISOString()
    );
    const preparationTimestamp = String(body.preparationTimestamp || nowIso);

    db.exec('BEGIN TRANSACTION;');
    try {
      db.prepare(`
        INSERT INTO donations (
          id, donor_id, donor_name, donor_type, title, description, category, is_vegetarian,
          quantity_kg, estimated_servings, preparation_timestamp, expiry_timestamp,
          safe_consumption_deadline, storage_conditions, allergen_info, food_handling_declared,
          occasion, address, city, state, postal_code, latitude, longitude, pickup_time_window,
          special_instructions, status, pickup_qr_code, delivery_qr_code, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        user.id,
        donorName,
        donorType,
        title,
        String(body.description || ''),
        String(body.category || 'COOKED_MEALS'),
        body.isVegetarian === false ? 0 : 1,
        quantityKg,
        estimatedServings,
        preparationTimestamp,
        expiryTimestamp,
        safeConsumptionDeadline,
        String(body.storageConditions || 'Clean insulated containers'),
        String(body.allergenInfo || 'None'),
        body.occasion ? String(body.occasion) : null,
        address,
        city,
        state,
        postalCode,
        latitude,
        longitude,
        String(body.pickupTimeWindow || 'Within 2 hours'),
        String(body.specialInstructions || ''),
        initialStatus,
        pickupQrCode,
        deliveryQrCode,
        nowIso,
        nowIso
      );

      db.prepare(`
        INSERT INTO donation_status_history (
          id, donation_id, status, performed_by_user_id, performed_by_role, performed_by_name, note, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        genId('HIST'),
        id,
        initialStatus,
        user.id,
        user.role,
        donorName,
        initialStatus === 'DRAFT'
          ? 'Saved donation as draft.'
          : 'Donation published for verified NGO matching.',
        nowIso
      );

      if (initialStatus === 'AVAILABLE') {
        writeNotification(
          db,
          'all',
          'ROLE_NGO',
          'New Surplus Food Available',
          `${quantityKg} kg of ${title} published in ${city}.`,
          'MATCH'
        );
      }

      writeAuditLog(
        db,
        user,
        'CREATE_DONATION',
        'DONATION',
        id,
        `${donorName} created ${title} (${quantityKg} kg, status ${initialStatus}).`
      );

      db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }

    const created = getAllDonationsHydrated(db).find((d) => d.id === id)!;
    const allUsers = getAllUsersHydrated(db);
    const matches = rankSuitableNgos(created, allUsers);
    res.status(201).json({ donation: created, matches });
  });

  // PUBLISH DRAFT DONATION
  router.patch('/donations/:id/publish', requireAuth, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const donationId = String(req.params.id);
    const donation = getAllDonationsHydrated(db).find((d) => d.id === donationId);
    if (!donation) {
      res.status(404).json({ error: 'Donation not found.' });
      return;
    }
    if (donation.donorId !== user.id && user.role !== 'ROLE_ADMIN') {
      res.status(403).json({ error: 'Not authorized to publish this donation.' });
      return;
    }
    try {
      assertValidDonationTransition(donation.status, 'AVAILABLE');
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
      return;
    }

    const nowIso = new Date().toISOString();
    db.exec('BEGIN TRANSACTION;');
    try {
      db.prepare(`UPDATE donations SET status = 'AVAILABLE', updated_at = ? WHERE id = ?`).run(
        nowIso,
        donationId
      );
      db.prepare(`
        INSERT INTO donation_status_history (
          id, donation_id, status, performed_by_user_id, performed_by_role, performed_by_name, note, timestamp
        ) VALUES (?, ?, 'AVAILABLE', ?, ?, ?, ?, ?)
      `).run(
        genId('HIST'),
        donationId,
        user.id,
        user.role,
        user.organizationName || user.name,
        'Published draft donation to live pool.',
        nowIso
      );
      db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }

    res.json({ success: true });
  });

  // CANCEL DONATION
  router.patch('/donations/:id/cancel', requireAuth, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const donationId = String(req.params.id);
    const donation = getAllDonationsHydrated(db).find((d) => d.id === donationId);
    if (!donation) {
      res.status(404).json({ error: 'Donation not found.' });
      return;
    }
    if (donation.donorId !== user.id && user.role !== 'ROLE_ADMIN') {
      res.status(403).json({ error: 'Not authorized to cancel this donation.' });
      return;
    }
    try {
      assertValidDonationTransition(donation.status, 'CANCELLED');
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
      return;
    }

    const nowIso = new Date().toISOString();
    db.exec('BEGIN TRANSACTION;');
    try {
      db.prepare(`UPDATE donations SET status = 'CANCELLED', updated_at = ? WHERE id = ?`).run(
        nowIso,
        donationId
      );
      db.prepare(
        `UPDATE food_requests SET status = 'CANCELLED', response_timestamp = ? WHERE donation_id = ? AND status = 'PENDING'`
      ).run(nowIso, donationId);
      db.prepare(`
        INSERT INTO donation_status_history (
          id, donation_id, status, performed_by_user_id, performed_by_role, performed_by_name, note, timestamp
        ) VALUES (?, ?, 'CANCELLED', ?, ?, ?, ?, ?)
      `).run(
        genId('HIST'),
        donationId,
        user.id,
        user.role,
        user.organizationName || user.name,
        String(req.body?.reason || 'Cancelled by donor/admin.'),
        nowIso
      );
      writeAuditLog(
        db,
        user,
        'CANCEL_DONATION',
        'DONATION',
        donationId,
        `Donation ${donationId} cancelled.`
      );
      db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }

    res.json({ success: true });
  });

  // MATCHED NGOS FOR A DONATION
  router.get('/donations/:id/matches', requireAuth, (req, res) => {
    expireStaleDonations(db);
    const donation = getAllDonationsHydrated(db).find((d) => d.id === req.params.id);
    if (!donation) {
      res.status(404).json({ error: 'Donation not found.' });
      return;
    }
    const users = getAllUsersHydrated(db);
    res.json({ matches: rankSuitableNgos(donation, users) });
  });

  // NGO REQUEST DONATION
  router.post('/donations/:id/request', requireAuth, (req: AuthenticatedRequest, res) => {
    expireStaleDonations(db);
    const user = req.authUser!;
    if (user.role !== 'ROLE_NGO') {
      res.status(403).json({ error: 'Only approved NGOs can request food donations.' });
      return;
    }

    const donationId = String(req.params.id);
    const donation = getAllDonationsHydrated(db).find((d) => d.id === donationId);
    if (!donation) {
      res.status(404).json({ error: 'Donation not found.' });
      return;
    }

    const requestedQtyKg = Number(req.body?.requestedQtyKg ?? donation.quantityKg);
    const check = canRequestDonation(donation, requestedQtyKg);
    if (!check.allowed) {
      res.status(400).json({ error: check.reason });
      return;
    }

    const availCap = user.currentAvailableCapacityKg ?? 0;
    if (requestedQtyKg > availCap) {
      res.status(400).json({
        error: `Requested quantity (${requestedQtyKg} kg) exceeds your remaining receiving capacity (${availCap} kg).`,
      });
      return;
    }

    const reqId = `REQ-2026-${crypto.randomInt(100, 9999)}`;
    const nowIso = new Date().toISOString();
    const ngoName = user.organizationName || user.name;

    db.exec('BEGIN TRANSACTION;');
    try {
      assertValidDonationTransition(donation.status, 'REQUESTED');
      db.prepare(`
        INSERT INTO food_requests (
          id, donation_id, ngo_id, ngo_name, requested_quantity_kg, beneficiaries_count, status, request_timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?)
      `).run(
        reqId,
        donationId,
        user.id,
        ngoName,
        requestedQtyKg,
        user.beneficiariesCount || 50,
        nowIso
      );

      db.prepare(`UPDATE donations SET status = 'REQUESTED', updated_at = ? WHERE id = ?`).run(
        nowIso,
        donationId
      );

      db.prepare(`
        INSERT INTO donation_status_history (
          id, donation_id, status, performed_by_user_id, performed_by_role, performed_by_name, note, timestamp
        ) VALUES (?, ?, 'REQUESTED', ?, 'ROLE_NGO', ?, ?, ?)
      `).run(
        genId('HIST'),
        donationId,
        user.id,
        ngoName,
        `Requested ${requestedQtyKg} kg for ${user.beneficiariesCount || 50} beneficiaries.`,
        nowIso
      );

      writeNotification(
        db,
        donation.donorId,
        donation.donorType === 'RESTAURANT' ? 'ROLE_RESTAURANT' : 'ROLE_INDIVIDUAL',
        'Food Request Received',
        `${ngoName} requested ${requestedQtyKg} kg from "${donation.title}".`,
        'REQUEST'
      );

      writeAuditLog(
        db,
        user,
        'REQUEST_DONATION',
        'DONATION',
        donationId,
        `${ngoName} requested ${requestedQtyKg} kg.`
      );

      db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      res.status(400).json({ error: (err as Error).message });
      return;
    }

    res.status(201).json({ requestId: reqId });
  });

  // DONOR / ADMIN APPROVES REQUEST
  router.post('/requests/:id/approve', requireAuth, (req: AuthenticatedRequest, res) => {
    expireStaleDonations(db);
    const user = req.authUser!;
    const requestId = String(req.params.id);

    const requestRow = db
      .prepare(`SELECT * FROM food_requests WHERE id = ?`)
      .get(requestId) as Record<string, unknown> | undefined;

    if (!requestRow) {
      res.status(404).json({ error: 'Food request not found.' });
      return;
    }

    const donationId = String(requestRow.donation_id);
    const donation = getAllDonationsHydrated(db).find((d) => d.id === donationId);
    if (!donation) {
      res.status(404).json({ error: 'Associated donation not found.' });
      return;
    }

    if (donation.donorId !== user.id && user.role !== 'ROLE_ADMIN') {
      res.status(403).json({ error: 'Not authorized to approve this request.' });
      return;
    }

    if (String(requestRow.status) !== 'PENDING') {
      res.status(400).json({ error: 'Request has already been processed.' });
      return;
    }

    try {
      assertValidDonationTransition(donation.status, 'APPROVED');
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
      return;
    }

    const nowIso = new Date().toISOString();
    const ngoId = String(requestRow.ngo_id);
    const ngoName = String(requestRow.ngo_name);
    const optionalVolunteerId = req.body?.volunteerId
      ? String(req.body.volunteerId)
      : undefined;

    const assignedVolunteer = optionalVolunteerId
      ? getUserProfileById(db, optionalVolunteerId)
      : getAllUsersHydrated(db).find(
          (u) => u.role === 'ROLE_VOLUNTEER' && u.verificationStatus === 'APPROVED'
        );

    db.exec('BEGIN TRANSACTION;');
    try {
      db.prepare(
        `UPDATE food_requests SET status = 'APPROVED', response_timestamp = ? WHERE id = ?`
      ).run(nowIso, requestId);

      db.prepare(
        `UPDATE food_requests SET status = 'REJECTED', rejection_reason = 'Allocated to another NGO', response_timestamp = ? WHERE donation_id = ? AND id != ? AND status = 'PENDING'`
      ).run(nowIso, donationId, requestId);

      if (assignedVolunteer && assignedVolunteer.role === 'ROLE_VOLUNTEER') {
        db.prepare(`
          UPDATE donations
          SET status = 'ASSIGNED', allocated_ngo_id = ?, allocated_ngo_name = ?,
              assigned_volunteer_id = ?, assigned_volunteer_name = ?, updated_at = ?
          WHERE id = ?
        `).run(
          ngoId,
          ngoName,
          assignedVolunteer.id,
          assignedVolunteer.name,
          nowIso,
          donationId
        );

        db.prepare(`
          INSERT INTO donation_status_history (
            id, donation_id, status, performed_by_user_id, performed_by_role, performed_by_name, note, timestamp
          ) VALUES (?, ?, 'APPROVED', ?, ?, ?, ?, ?)
        `).run(
          genId('HIST'),
          donationId,
          user.id,
          user.role,
          user.organizationName || user.name,
          `Approved request for ${ngoName}.`,
          nowIso
        );

        db.prepare(`
          INSERT INTO donation_status_history (
            id, donation_id, status, performed_by_user_id, performed_by_role, performed_by_name, note, timestamp
          ) VALUES (?, ?, 'ASSIGNED', ?, ?, ?, ?, ?)
        `).run(
          genId('HIST'),
          donationId,
          user.id,
          user.role,
          user.organizationName || user.name,
          `Assigned volunteer courier ${assignedVolunteer.name}.`,
          nowIso
        );

        db.prepare(`
          INSERT INTO volunteer_assignments (
            id, donation_id, volunteer_id, volunteer_name, status, assigned_at
          ) VALUES (?, ?, ?, ?, 'ASSIGNED', ?)
        `).run(
          `ASG-2026-${crypto.randomInt(100, 9999)}`,
          donationId,
          assignedVolunteer.id,
          assignedVolunteer.name,
          nowIso
        );

        writeNotification(
          db,
          assignedVolunteer.id,
          'ROLE_VOLUNTEER',
          'New Pickup Assignment',
          `Assigned to deliver "${donation.title}" to ${ngoName}.`,
          'PICKUP'
        );
      } else {
        db.prepare(`
          UPDATE donations
          SET status = 'APPROVED', allocated_ngo_id = ?, allocated_ngo_name = ?, updated_at = ?
          WHERE id = ?
        `).run(ngoId, ngoName, nowIso, donationId);

        db.prepare(`
          INSERT INTO donation_status_history (
            id, donation_id, status, performed_by_user_id, performed_by_role, performed_by_name, note, timestamp
          ) VALUES (?, ?, 'APPROVED', ?, ?, ?, ?, ?)
        `).run(
          genId('HIST'),
          donationId,
          user.id,
          user.role,
          user.organizationName || user.name,
          `Approved request for ${ngoName}. Ready for volunteer assignment.`,
          nowIso
        );
      }

      writeNotification(
        db,
        ngoId,
        'ROLE_NGO',
        'Food Request Approved',
        `Your request for "${donation.title}" has been approved.`,
        'PICKUP'
      );

      writeAuditLog(
        db,
        user,
        'APPROVE_REQUEST',
        'FOOD_REQUEST',
        requestId,
        `Approved request ${requestId} for ${ngoName}.`
      );

      db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }

    res.json({ success: true });
  });

  // DONOR / ADMIN REJECTS REQUEST
  router.post('/requests/:id/reject', requireAuth, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const requestId = String(req.params.id);
    const reason = String(req.body?.reason || 'Unable to allocate').trim();

    const requestRow = db
      .prepare(`SELECT * FROM food_requests WHERE id = ?`)
      .get(requestId) as Record<string, unknown> | undefined;
    if (!requestRow) {
      res.status(404).json({ error: 'Food request not found.' });
      return;
    }

    const donationId = String(requestRow.donation_id);
    const donation = getAllDonationsHydrated(db).find((d) => d.id === donationId);
    if (!donation) {
      res.status(404).json({ error: 'Donation not found.' });
      return;
    }

    if (donation.donorId !== user.id && user.role !== 'ROLE_ADMIN') {
      res.status(403).json({ error: 'Not authorized to reject this request.' });
      return;
    }

    const nowIso = new Date().toISOString();
    db.exec('BEGIN TRANSACTION;');
    try {
      db.prepare(
        `UPDATE food_requests SET status = 'REJECTED', rejection_reason = ?, response_timestamp = ? WHERE id = ?`
      ).run(reason, nowIso, requestId);

      const nextStatus: DonationStatus = isDonationExpired(donation)
        ? 'EXPIRED'
        : 'AVAILABLE';
      db.prepare(`UPDATE donations SET status = ?, updated_at = ? WHERE id = ?`).run(
        nextStatus,
        nowIso,
        donationId
      );

      db.prepare(`
        INSERT INTO donation_status_history (
          id, donation_id, status, performed_by_user_id, performed_by_role, performed_by_name, note, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        genId('HIST'),
        donationId,
        nextStatus,
        user.id,
        user.role,
        user.organizationName || user.name,
        `Request declined: ${reason}.`,
        nowIso
      );

      writeNotification(
        db,
        String(requestRow.ngo_id),
        'ROLE_NGO',
        'Food Request Declined',
        `Request for "${donation.title}" was declined: ${reason}`,
        'INFO'
      );

      db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }

    res.json({ success: true });
  });

  // ASSIGN OR CLAIM VOLUNTEER (APPROVED -> ASSIGNED)
  router.post(
    '/donations/:id/assign-volunteer',
    requireAuth,
    (req: AuthenticatedRequest, res) => {
      const user = req.authUser!;
      const donationId = String(req.params.id);
      const donation = getAllDonationsHydrated(db).find((d) => d.id === donationId);
      if (!donation) {
        res.status(404).json({ error: 'Donation not found.' });
        return;
      }

      const targetVolId =
        user.role === 'ROLE_VOLUNTEER'
          ? user.id
          : String(req.body?.volunteerId || '');
      const volunteer = getUserProfileById(db, targetVolId);
      if (
        !volunteer ||
        volunteer.role !== 'ROLE_VOLUNTEER' ||
        volunteer.verificationStatus !== 'APPROVED'
      ) {
        res.status(400).json({ error: 'Valid approved volunteer is required.' });
        return;
      }

      if (
        user.role !== 'ROLE_ADMIN' &&
        user.role !== 'ROLE_VOLUNTEER' &&
        donation.donorId !== user.id
      ) {
        res.status(403).json({ error: 'Not authorized to assign volunteer.' });
        return;
      }

      try {
        assertValidDonationTransition(donation.status, 'ASSIGNED');
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
        return;
      }

      const nowIso = new Date().toISOString();
      db.exec('BEGIN TRANSACTION;');
      try {
        db.prepare(`
          UPDATE donations SET status = 'ASSIGNED', assigned_volunteer_id = ?, assigned_volunteer_name = ?, updated_at = ? WHERE id = ?
        `).run(volunteer.id, volunteer.name, nowIso, donationId);

        db.prepare(`
          INSERT INTO volunteer_assignments (
            id, donation_id, volunteer_id, volunteer_name, status, assigned_at
          ) VALUES (?, ?, ?, ?, 'ASSIGNED', ?)
        `).run(
          `ASG-2026-${crypto.randomInt(100, 9999)}`,
          donationId,
          volunteer.id,
          volunteer.name,
          nowIso
        );

        db.prepare(`
          INSERT INTO donation_status_history (
            id, donation_id, status, performed_by_user_id, performed_by_role, performed_by_name, note, timestamp
          ) VALUES (?, ?, 'ASSIGNED', ?, ?, ?, ?, ?)
        `).run(
          genId('HIST'),
          donationId,
          user.id,
          user.role,
          user.name,
          `Assigned volunteer ${volunteer.name} for pickup.`,
          nowIso
        );

        writeAuditLog(
          db,
          user,
          'ASSIGN_VOLUNTEER',
          'DONATION',
          donationId,
          `Assigned ${volunteer.name} to ${donationId}.`
        );

        db.exec('COMMIT;');
      } catch (err) {
        db.exec('ROLLBACK;');
        throw err;
      }

      res.json({ success: true });
    }
  );

  // VERIFY PICKUP BY QR (ASSIGNED/APPROVED -> PICKED_UP)
  router.post(
    '/donations/:id/verify-pickup',
    requireAuth,
    (req: AuthenticatedRequest, res) => {
      const user = req.authUser!;
      const donationId = String(req.params.id);
      const scannedQr = String(req.body?.scannedQr || '').trim();
      const donation = getAllDonationsHydrated(db).find((d) => d.id === donationId);

      if (!donation) {
        res.status(404).json({ error: 'Donation not found.' });
        return;
      }

      if (
        user.role !== 'ROLE_VOLUNTEER' &&
        user.role !== 'ROLE_ADMIN'
      ) {
        res.status(403).json({ error: 'Only assigned volunteers or admins can verify pickup.' });
        return;
      }

      if (donation.pickupQrCode !== scannedQr) {
        res.status(400).json({ error: 'Invalid or mismatched Pickup QR verification token.' });
        return;
      }

      try {
        assertValidDonationTransition(donation.status, 'PICKED_UP');
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
        return;
      }

      const nowIso = new Date().toISOString();
      db.exec('BEGIN TRANSACTION;');
      try {
        db.prepare(`UPDATE donations SET status = 'PICKED_UP', updated_at = ? WHERE id = ?`).run(
          nowIso,
          donationId
        );
        db.prepare(
          `UPDATE volunteer_assignments SET status = 'PICKED_UP', picked_up_at = ?, pickup_proof_note = ? WHERE donation_id = ?`
        ).run(nowIso, 'Pickup QR verified', donationId);

        db.prepare(`
          INSERT INTO donation_status_history (
            id, donation_id, status, performed_by_user_id, performed_by_role, performed_by_name, note, timestamp
          ) VALUES (?, ?, 'PICKED_UP', ?, ?, ?, ?, ?)
        `).run(
          genId('HIST'),
          donationId,
          user.id,
          user.role,
          user.name,
          'Pickup QR verified at donor location. Food collected and in transit.',
          nowIso
        );

        writeNotification(
          db,
          donation.donorId,
          donation.donorType === 'RESTAURANT' ? 'ROLE_RESTAURANT' : 'ROLE_INDIVIDUAL',
          'Food Picked Up',
          `${user.name} collected "${donation.title}".`,
          'DELIVERY'
        );

        if (donation.allocatedNgoId) {
          writeNotification(
            db,
            donation.allocatedNgoId,
            'ROLE_NGO',
            'Food En Route',
            `${user.name} has picked up "${donation.title}" and is heading to your shelter.`,
            'DELIVERY'
          );
        }

        db.exec('COMMIT;');
      } catch (err) {
        db.exec('ROLLBACK;');
        throw err;
      }

      res.json({ success: true, message: 'Pickup QR verified. Status updated to PICKED_UP.' });
    }
  );

  // VERIFY DELIVERY BY QR (PICKED_UP -> DELIVERED)
  router.post(
    '/donations/:id/verify-delivery',
    requireAuth,
    (req: AuthenticatedRequest, res) => {
      const user = req.authUser!;
      const donationId = String(req.params.id);
      const scannedQr = String(req.body?.scannedQr || '').trim();
      const donation = getAllDonationsHydrated(db).find((d) => d.id === donationId);

      if (!donation) {
        res.status(404).json({ error: 'Donation not found.' });
        return;
      }

      if (user.role !== 'ROLE_VOLUNTEER' && user.role !== 'ROLE_ADMIN') {
        res.status(403).json({ error: 'Only assigned volunteers or admins can verify delivery.' });
        return;
      }

      if (donation.deliveryQrCode !== scannedQr) {
        res.status(400).json({ error: 'Invalid Delivery QR verification token.' });
        return;
      }

      try {
        assertValidDonationTransition(donation.status, 'DELIVERED');
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
        return;
      }

      const nowIso = new Date().toISOString();
      db.exec('BEGIN TRANSACTION;');
      try {
        db.prepare(`UPDATE donations SET status = 'DELIVERED', updated_at = ? WHERE id = ?`).run(
          nowIso,
          donationId
        );
        db.prepare(
          `UPDATE volunteer_assignments SET status = 'DELIVERED', completed_at = ?, delivery_proof_note = ? WHERE donation_id = ?`
        ).run(nowIso, 'Delivery QR verified at NGO', donationId);

        db.prepare(`
          INSERT INTO donation_status_history (
            id, donation_id, status, performed_by_user_id, performed_by_role, performed_by_name, note, timestamp
          ) VALUES (?, ?, 'DELIVERED', ?, ?, ?, ?, ?)
        `).run(
          genId('HIST'),
          donationId,
          user.id,
          user.role,
          user.name,
          'Delivery handover verified at NGO destination via QR token.',
          nowIso
        );

        if (donation.allocatedNgoId) {
          writeNotification(
            db,
            donation.allocatedNgoId,
            'ROLE_NGO',
            'Delivery Arrived — Confirm Receipt',
            `"${donation.title}" has arrived. Please inspect and confirm receipt.`,
            'DELIVERY'
          );
        }

        db.exec('COMMIT;');
      } catch (err) {
        db.exec('ROLLBACK;');
        throw err;
      }

      res.json({
        success: true,
        message: 'Delivery verified. Awaiting NGO receipt confirmation.',
      });
    }
  );

  // NGO CONFIRMS RECEIPT (DELIVERED -> COMPLETED)
  router.post(
    '/donations/:id/confirm-receipt',
    requireAuth,
    (req: AuthenticatedRequest, res) => {
      const user = req.authUser!;
      const donationId = String(req.params.id);
      const notes = String(
        req.body?.notes || 'Food inspected, fresh, and distributed to beneficiaries.'
      ).trim();

      const donation = getAllDonationsHydrated(db).find((d) => d.id === donationId);
      if (!donation) {
        res.status(404).json({ error: 'Donation not found.' });
        return;
      }

      if (
        donation.allocatedNgoId !== user.id &&
        user.role !== 'ROLE_ADMIN'
      ) {
        res.status(403).json({
          error: 'Only the receiving NGO or administrator can confirm completion.',
        });
        return;
      }

      try {
        assertValidDonationTransition(donation.status, 'COMPLETED');
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
        return;
      }

      const nowIso = new Date().toISOString();
      db.exec('BEGIN TRANSACTION;');
      try {
        db.prepare(`UPDATE donations SET status = 'COMPLETED', updated_at = ? WHERE id = ?`).run(
          nowIso,
          donationId
        );

        db.prepare(`
          INSERT INTO donation_status_history (
            id, donation_id, status, performed_by_user_id, performed_by_role, performed_by_name, note, timestamp
          ) VALUES (?, ?, 'COMPLETED', ?, ?, ?, ?, ?)
        `).run(
          genId('HIST'),
          donationId,
          user.id,
          user.role,
          user.organizationName || user.name,
          notes,
          nowIso
        );

        writeNotification(
          db,
          donation.donorId,
          donation.donorType === 'RESTAURANT' ? 'ROLE_RESTAURANT' : 'ROLE_INDIVIDUAL',
          'Donation Completed',
          `Your donation (${donation.quantityKg} kg / ~${donation.estimatedServings} servings) has been completed and served.`,
          'INFO'
        );

        writeAuditLog(
          db,
          user,
          'COMPLETE_DONATION',
          'DONATION',
          donationId,
          `${user.organizationName || user.name} confirmed receipt for ${donationId}.`
        );

        db.exec('COMMIT;');
      } catch (err) {
        db.exec('ROLLBACK;');
        throw err;
      }

      res.json({ success: true });
    }
  );

  // ADMIN VERIFICATION APPROVAL / REJECTION / SUSPENSION
  router.post(
    '/admin/verifications/:userId',
    requireAuth,
    (req: AuthenticatedRequest, res) => {
      const admin = req.authUser!;
      if (admin.role !== 'ROLE_ADMIN') {
        res.status(403).json({ error: 'Administrator privileges required.' });
        return;
      }

      const targetUserId = String(req.params.userId);
      const status = String(req.body?.status || '') as VerificationStatus;
      const reason = req.body?.reason ? String(req.body.reason).trim() : null;

      if (!['APPROVED', 'REJECTED', 'SUSPENDED'].includes(status)) {
        res.status(400).json({ error: 'Invalid verification status.' });
        return;
      }

      if (status === 'REJECTED' && !reason) {
        res.status(400).json({ error: 'A rejection reason is required.' });
        return;
      }

      const target = getUserProfileById(db, targetUserId);
      if (!target) {
        res.status(404).json({ error: 'Target account not found.' });
        return;
      }

      const nowIso = new Date().toISOString();
      db.exec('BEGIN TRANSACTION;');
      try {
        db.prepare(
          `UPDATE users SET verification_status = ?, rejection_reason = ?, updated_at = ? WHERE id = ?`
        ).run(status, status === 'REJECTED' ? reason : null, nowIso, targetUserId);

        writeNotification(
          db,
          targetUserId,
          target.role,
          `Account Verification ${status}`,
          status === 'APPROVED'
            ? 'Your organization verification has been approved. You may now sign in.'
            : `Your verification status changed to ${status}: ${reason || ''}`,
          'ALERT'
        );

        writeAuditLog(
          db,
          admin,
          `VERIFICATION_${status}`,
          'USER',
          targetUserId,
          `Admin marked ${target.organizationName || target.name} (${target.role}) as ${status}${
            reason ? ` — Reason: ${reason}` : ''
          }.`
        );

        db.exec('COMMIT;');
      } catch (err) {
        db.exec('ROLLBACK;');
        throw err;
      }

      res.json({ success: true, status });
    }
  );

  // ADMIN VERIFICATION REGISTRY MANAGEMENT
  router.get(
    '/admin/verification-records',
    requireAuth,
    (req: AuthenticatedRequest, res) => {
      if (req.authUser?.role !== 'ROLE_ADMIN') {
        res.status(403).json({ error: 'Administrator privileges required.' });
        return;
      }
      const rows = db
        .prepare(`SELECT * FROM verification_records ORDER BY record_type, license_number`)
        .all();
      res.json({ records: rows });
    }
  );

  router.post(
    '/admin/verification-records',
    requireAuth,
    (req: AuthenticatedRequest, res) => {
      const admin = req.authUser!;
      if (admin.role !== 'ROLE_ADMIN') {
        res.status(403).json({ error: 'Administrator privileges required.' });
        return;
      }

      const recordType = String(req.body?.recordType || 'NGO');
      const licenseNumber = String(req.body?.licenseNumber || '').trim().toUpperCase();
      const officialName = String(req.body?.officialName || '').trim();
      const issuingAuthority = String(req.body?.issuingAuthority || '').trim();
      const stateDistrict = String(req.body?.stateDistrict || 'Mangalagiri, Andhra Pradesh').trim();

      if (!licenseNumber || !officialName || !issuingAuthority) {
        res.status(400).json({ error: 'Licence number, official name, and authority are required.' });
        return;
      }

      const existing = db
        .prepare(`SELECT id FROM verification_records WHERE license_number = ?`)
        .get(licenseNumber);
      if (existing) {
        res.status(409).json({ error: 'Licence number already exists in registry.' });
        return;
      }

      const id = genId('VR');
      db.prepare(`
        INSERT INTO verification_records (
          id, record_type, license_number, official_name, issuing_authority, state_district, is_active, is_test_record, notes
        ) VALUES (?, ?, ?, ?, ?, ?, 1, 1, 'Added by Administrator')
      `).run(id, recordType, licenseNumber, officialName, issuingAuthority, stateDistrict);

      writeAuditLog(
        db,
        admin,
        'ADD_VERIFICATION_RECORD',
        'VERIFICATION_RECORD',
        id,
        `Added ${recordType} verification record ${licenseNumber} for ${officialName}.`
      );

      res.status(201).json({ id, licenseNumber });
    }
  );

  // COMPLAINTS
  router.post('/complaints', requireAuth, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const subject = String(req.body?.subject || '').trim();
    const description = String(req.body?.description || '').trim();
    const donationId = req.body?.donationId ? String(req.body.donationId) : null;

    if (!subject || !description) {
      res.status(400).json({ error: 'Subject and description are required.' });
      return;
    }

    const id = `CMP-2026-${crypto.randomInt(10, 999)}`;
    const nowIso = new Date().toISOString();
    db.prepare(`
      INSERT INTO complaints (id, reporter_user_id, reporter_name, donation_id, subject, description, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'OPEN', ?, ?)
    `).run(
      id,
      user.id,
      user.organizationName || user.name,
      donationId,
      subject,
      description,
      nowIso,
      nowIso
    );

    writeNotification(
      db,
      'user-admin',
      'ROLE_ADMIN',
      'New Issue Reported',
      `${user.organizationName || user.name} filed issue: ${subject}`,
      'ALERT'
    );

    res.status(201).json({ id });
  });

  router.patch('/complaints/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const admin = req.authUser!;
    if (admin.role !== 'ROLE_ADMIN') {
      res.status(403).json({ error: 'Administrator privileges required.' });
      return;
    }

    const id = String(req.params.id);
    const status = String(req.body?.status || 'RESOLVED');
    const resolutionNote = String(req.body?.resolutionNote || '').trim();
    const nowIso = new Date().toISOString();

    db.prepare(
      `UPDATE complaints SET status = ?, resolution_note = ?, updated_at = ? WHERE id = ?`
    ).run(status, resolutionNote, nowIso, id);

    writeAuditLog(
      db,
      admin,
      'UPDATE_COMPLAINT',
      'COMPLAINT',
      id,
      `Updated complaint ${id} to ${status}${resolutionNote ? `: ${resolutionNote}` : ''}.`
    );

    res.json({ success: true });
  });

  // NOTIFICATIONS
  router.post('/notifications/:id/read', requireAuth, (req: AuthenticatedRequest, res) => {
    db.prepare(`UPDATE notifications SET is_read = 1 WHERE id = ?`).run(req.params.id);
    res.json({ success: true });
  });

  router.post('/notifications/read-all', requireAuth, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    db.prepare(
      `UPDATE notifications SET is_read = 1 WHERE user_id = ? OR target_role = ? OR target_role = 'ALL'`
    ).run(user.id, user.role);
    res.json({ success: true });
  });

  return router;
}
