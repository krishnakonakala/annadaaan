import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';

export interface DbContext {
  db: DatabaseSync;
}

export function createDatabase(dbPath?: string): DatabaseSync {
  const targetPath =
    dbPath || path.resolve(process.cwd(), 'data', 'annadaan.db');

  if (targetPath !== ':memory:') {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  }

  const db = new DatabaseSync(targetPath);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA journal_mode = WAL;');

  initializeSchema(db);
  seedInitialData(db);

  return db;
}

function initializeSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      verification_status TEXT NOT NULL DEFAULT 'PENDING',
      rejection_reason TEXT,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      postal_code TEXT NOT NULL,
      latitude REAL NOT NULL DEFAULT 16.4649,
      longitude REAL NOT NULL DEFAULT 80.5083,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS restaurants (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      restaurant_name TEXT NOT NULL,
      owner_manager_name TEXT NOT NULL,
      fssai_license_number TEXT NOT NULL UNIQUE COLLATE NOCASE,
      issuing_authority TEXT NOT NULL,
      restaurant_category TEXT NOT NULL,
      operating_hours TEXT NOT NULL,
      document_ref TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ngos (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      organization_name TEXT NOT NULL,
      registration_number TEXT NOT NULL UNIQUE COLLATE NOCASE,
      issuing_authority TEXT NOT NULL,
      contact_person TEXT NOT NULL,
      organization_type TEXT NOT NULL,
      state_district TEXT NOT NULL,
      beneficiaries_count INTEGER NOT NULL,
      max_capacity_kg REAL NOT NULL,
      available_capacity_kg REAL NOT NULL,
      food_preferences TEXT NOT NULL,
      operating_hours TEXT NOT NULL,
      document_ref TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS individual_donors (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      preferred_occasion TEXT
    );

    CREATE TABLE IF NOT EXISTS volunteers (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      vehicle_type TEXT NOT NULL,
      max_travel_distance_km REAL NOT NULL,
      availability_status TEXT NOT NULL DEFAULT 'AVAILABLE',
      id_document_ref TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS verification_records (
      id TEXT PRIMARY KEY,
      record_type TEXT NOT NULL,
      license_number TEXT NOT NULL UNIQUE COLLATE NOCASE,
      official_name TEXT NOT NULL,
      issuing_authority TEXT NOT NULL,
      state_district TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      is_test_record INTEGER NOT NULL DEFAULT 1,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS registration_documents (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      doc_type TEXT NOT NULL,
      reference_code TEXT NOT NULL,
      uploaded_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS login_attempts (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      role TEXT NOT NULL,
      success INTEGER NOT NULL,
      reason TEXT,
      ip_address TEXT,
      attempted_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS donations (
      id TEXT PRIMARY KEY,
      donor_id TEXT NOT NULL REFERENCES users(id),
      donor_name TEXT NOT NULL,
      donor_type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      is_vegetarian INTEGER NOT NULL,
      quantity_kg REAL NOT NULL,
      estimated_servings INTEGER NOT NULL,
      preparation_timestamp TEXT NOT NULL,
      expiry_timestamp TEXT NOT NULL,
      safe_consumption_deadline TEXT NOT NULL,
      storage_conditions TEXT NOT NULL,
      allergen_info TEXT,
      food_handling_declared INTEGER NOT NULL DEFAULT 1,
      occasion TEXT,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      postal_code TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      pickup_time_window TEXT NOT NULL,
      special_instructions TEXT,
      status TEXT NOT NULL,
      allocated_ngo_id TEXT REFERENCES users(id),
      allocated_ngo_name TEXT,
      assigned_volunteer_id TEXT REFERENCES users(id),
      assigned_volunteer_name TEXT,
      pickup_qr_code TEXT NOT NULL,
      delivery_qr_code TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS donation_status_history (
      id TEXT PRIMARY KEY,
      donation_id TEXT NOT NULL REFERENCES donations(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      performed_by_user_id TEXT,
      performed_by_role TEXT NOT NULL,
      performed_by_name TEXT NOT NULL,
      note TEXT,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS food_requests (
      id TEXT PRIMARY KEY,
      donation_id TEXT NOT NULL REFERENCES donations(id) ON DELETE CASCADE,
      ngo_id TEXT NOT NULL REFERENCES users(id),
      ngo_name TEXT NOT NULL,
      requested_quantity_kg REAL NOT NULL,
      beneficiaries_count INTEGER NOT NULL,
      status TEXT NOT NULL,
      rejection_reason TEXT,
      request_timestamp TEXT NOT NULL,
      response_timestamp TEXT
    );

    CREATE TABLE IF NOT EXISTS volunteer_assignments (
      id TEXT PRIMARY KEY,
      donation_id TEXT NOT NULL REFERENCES donations(id) ON DELETE CASCADE,
      volunteer_id TEXT NOT NULL REFERENCES users(id),
      volunteer_name TEXT NOT NULL,
      status TEXT NOT NULL,
      pickup_proof_note TEXT,
      delivery_proof_note TEXT,
      assigned_at TEXT NOT NULL,
      picked_up_at TEXT,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      target_role TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_user_id TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      details TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS complaints (
      id TEXT PRIMARY KEY,
      reporter_user_id TEXT NOT NULL REFERENCES users(id),
      reporter_name TEXT NOT NULL,
      donation_id TEXT REFERENCES donations(id),
      subject TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'OPEN',
      resolution_note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

function seedInitialData(db: DatabaseSync): void {
  const existingCount = db
    .prepare('SELECT COUNT(*) as cnt FROM users')
    .get() as { cnt: number };

  if (existingCount.cnt > 0) {
    return;
  }

  const nowIso = new Date().toISOString();
  const hoursFromNow = (h: number) =>
    new Date(Date.now() + h * 3600 * 1000).toISOString();

  const adminHash = bcrypt.hashSync('Admin@Annadaan2026', 10);
  const partnerHash = bcrypt.hashSync('Partner@123', 10);
  const donorHash = bcrypt.hashSync('Donor@123', 10);
  const volHash = bcrypt.hashSync('Volunteer@123', 10);

  db.exec('BEGIN TRANSACTION;');
  try {
    // 1. Verification Registry Test Records (Clearly labeled TEST-* records)
    const insertVerify = db.prepare(`
      INSERT INTO verification_records (
        id, record_type, license_number, official_name, issuing_authority, state_district, is_active, is_test_record, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const testVerificationSeeds = [
      [
        'vr-ngo-1',
        'NGO',
        'TEST-NGO-2026-001',
        'Sneha Children Welfare Society',
        'Registrar of Societies, Andhra Pradesh',
        'Mangalagiri, Andhra Pradesh',
        1,
        1,
        'Fictional test verification record (pre-linked)',
      ],
      [
        'vr-ngo-2',
        'NGO',
        'TEST-NGO-2026-002',
        'Aasra Senior Citizens Charitable Trust',
        'Charity Commissioner, Andhra Pradesh',
        'Mangalagiri, Andhra Pradesh',
        1,
        1,
        'Fictional test verification record (pre-linked)',
      ],
      [
        'vr-ngo-3',
        'NGO',
        'TEST-NGO-2026-003',
        'Navajeevan Community Kitchen Trust',
        'Registrar of Trusts, Andhra Pradesh',
        'Tadepalli, Andhra Pradesh',
        1,
        1,
        'Fictional test verification record (pre-linked)',
      ],
      [
        'vr-ngo-4',
        'NGO',
        'TEST-NGO-2026-004',
        'Hope Haven Orphanage Foundation',
        'NITI Aayog Darpan Registry (Test)',
        'Amaravati, Andhra Pradesh',
        1,
        1,
        'Fictional test verification record available for new NGO sign-up testing',
      ],
      [
        'vr-ngo-5',
        'NGO',
        'TEST-NGO-2026-005',
        'Asha Orphanage & Shelter Trust',
        'Registrar of Societies, Andhra Pradesh (Test)',
        'Amaravati, Andhra Pradesh',
        1,
        1,
        'Fictional test verification record (pending approval demo)',
      ],
      [
        'vr-ngo-6',
        'NGO',
        'TEST-NGO-2026-006',
        'Annapurna Seva Ashram',
        'Charity Commissioner, Andhra Pradesh (Test)',
        'Guntur, Andhra Pradesh',
        1,
        1,
        'Fictional test verification record available for registration testing',
      ],
      [
        'vr-rest-1',
        'RESTAURANT',
        'TEST-FSSAI-1001',
        'Amaravati Campus Convention Kitchens',
        'FSSAI Central Licensing Authority',
        'Mangalagiri, Andhra Pradesh',
        1,
        1,
        'Fictional test FSSAI licence record (pre-linked)',
      ],
      [
        'vr-rest-2',
        'RESTAURANT',
        'TEST-FSSAI-1002',
        'Amaravati Heritage Kitchens',
        'FSSAI State Authority Andhra Pradesh',
        'Amaravati, Andhra Pradesh',
        1,
        1,
        'Fictional test FSSAI licence record (pre-linked)',
      ],
      [
        'vr-rest-3',
        'RESTAURANT',
        'TEST-FSSAI-1003',
        'Minerva Grand Banquets Amaravati',
        'FSSAI State Authority Andhra Pradesh (Test)',
        'Mangalagiri, Andhra Pradesh',
        1,
        1,
        'Fictional test FSSAI licence record available for restaurant sign-up testing',
      ],
      [
        'vr-rest-4',
        'RESTAURANT',
        'TEST-FSSAI-1004',
        'Krishna Riverfront Spice Kitchen',
        'FSSAI State Authority Andhra Pradesh (Test)',
        'Tadepalli, Andhra Pradesh',
        1,
        1,
        'Fictional test FSSAI licence record available for restaurant sign-up testing',
      ],
    ];

    for (const row of testVerificationSeeds) {
      insertVerify.run(...row);
    }

    // 2. Users across all 5 roles around SRM University AP, Neerukonda, Mangalagiri, Amaravati
    const insertUser = db.prepare(`
      INSERT INTO users (
        id, email, password_hash, role, full_name, phone, verification_status, rejection_reason,
        address, city, state, postal_code, latitude, longitude, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertUser.run(
      'user-admin',
      'admin@annadaan.org',
      adminHash,
      'ROLE_ADMIN',
      'Dr. Ananya Sharma',
      '+91 98490 11001',
      'APPROVED',
      null,
      'Annadaan Operations Center, SRM University AP Road, Neerukonda',
      'Mangalagiri',
      'Andhra Pradesh',
      '522502',
      16.4649,
      80.5083,
      nowIso,
      nowIso
    );

    insertUser.run(
      'user-rest-1',
      'events@tajkrishna.com',
      partnerHash,
      'ROLE_RESTAURANT',
      'Vikram Malhotra',
      '+91 98490 22002',
      'APPROVED',
      null,
      'Near SRM University AP Main Gate, Neerukonda',
      'Mangalagiri',
      'Andhra Pradesh',
      '522502',
      16.4662,
      80.5098,
      nowIso,
      nowIso
    );

    insertUser.run(
      'user-rest-2',
      'foodsafety@paradise.in',
      partnerHash,
      'ROLE_RESTAURANT',
      'Suresh Reddy',
      '+91 98490 33003',
      'APPROVED',
      null,
      'Seed Access Road, Near Kuragallu Cross',
      'Amaravati',
      'Andhra Pradesh',
      '522503',
      16.4735,
      80.5260,
      nowIso,
      nowIso
    );

    insertUser.run(
      'user-ngo-1',
      'care@snehaorphanage.org',
      partnerHash,
      'ROLE_NGO',
      'Meera Krishnan',
      '+91 98490 44004',
      'APPROVED',
      null,
      'Neerukonda Welfare Enclave, Near SRM University AP',
      'Mangalagiri',
      'Andhra Pradesh',
      '522502',
      16.4618,
      80.5142,
      nowIso,
      nowIso
    );

    insertUser.run(
      'user-ngo-2',
      'director@aasracare.org',
      partnerHash,
      'ROLE_NGO',
      'Raghavendra Rao',
      '+91 98490 55005',
      'APPROVED',
      null,
      'Main Bazar Road, Mangalagiri',
      'Mangalagiri',
      'Andhra Pradesh',
      '522503',
      16.4325,
      80.5665,
      nowIso,
      nowIso
    );

    insertUser.run(
      'user-ngo-3',
      'shelter@navajeevan.org',
      partnerHash,
      'ROLE_NGO',
      'Father Joseph Thomas',
      '+91 98490 66006',
      'APPROVED',
      null,
      'NH-16 Service Road, Tadepalli',
      'Tadepalli',
      'Andhra Pradesh',
      '522501',
      16.4812,
      80.5920,
      nowIso,
      nowIso
    );

    insertUser.run(
      'user-ngo-pending',
      'pending@ashaorphanage.org',
      partnerHash,
      'ROLE_NGO',
      'Lakshmi Devi',
      '+91 98490 66778',
      'PENDING',
      null,
      'Mandadam Village Road, Amaravati Capital Region',
      'Amaravati',
      'Andhra Pradesh',
      '522237',
      16.5060,
      80.5210,
      nowIso,
      nowIso
    );

    insertUser.run(
      'user-donor-1',
      'rajesh.verma@gmail.com',
      donorHash,
      'ROLE_INDIVIDUAL',
      'Rajesh & Kavitha Verma',
      '+91 98490 77007',
      'APPROVED',
      null,
      'Amaravati Villas, Kuragallu, Near SRM University AP',
      'Mangalagiri',
      'Andhra Pradesh',
      '522503',
      16.4585,
      80.5235,
      nowIso,
      nowIso
    );

    insertUser.run(
      'user-vol-1',
      'karthik.rescue@gmail.com',
      volHash,
      'ROLE_VOLUNTEER',
      'Karthik Varma',
      '+91 98490 88008',
      'APPROVED',
      null,
      'SRM University AP Circle, Neerukonda',
      'Mangalagiri',
      'Andhra Pradesh',
      '522502',
      16.4680,
      80.5115,
      nowIso,
      nowIso
    );

    insertUser.run(
      'user-vol-2',
      'deepika.ngo@gmail.com',
      volHash,
      'ROLE_VOLUNTEER',
      'Deepika Rao',
      '+91 98490 99009',
      'APPROVED',
      null,
      'Mangalagiri Bypass Junction',
      'Mangalagiri',
      'Andhra Pradesh',
      '522503',
      16.4360,
      80.5590,
      nowIso,
      nowIso
    );

    // 3. Role-specific extension tables
    const insertRest = db.prepare(`
      INSERT INTO restaurants (
        user_id, restaurant_name, owner_manager_name, fssai_license_number,
        issuing_authority, restaurant_category, operating_hours, document_ref
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertRest.run(
      'user-rest-1',
      'Amaravati Campus Convention Kitchens',
      'Vikram Malhotra',
      'TEST-FSSAI-1001',
      'FSSAI Central Licensing Authority',
      'Convention Kitchen & Dining',
      '08:00 AM - 11:30 PM',
      'DOC-FSSAI-1001.pdf'
    );

    insertRest.run(
      'user-rest-2',
      'Amaravati Heritage Kitchens',
      'Suresh Reddy',
      'TEST-FSSAI-1002',
      'FSSAI State Authority Andhra Pradesh',
      'Restaurant Chain',
      '11:00 AM - 11:00 PM',
      'DOC-FSSAI-1002.pdf'
    );

    const insertNgo = db.prepare(`
      INSERT INTO ngos (
        user_id, organization_name, registration_number, issuing_authority, contact_person,
        organization_type, state_district, beneficiaries_count, max_capacity_kg,
        available_capacity_kg, food_preferences, operating_hours, document_ref
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertNgo.run(
      'user-ngo-1',
      'Sneha Children Welfare Society',
      'TEST-NGO-2026-001',
      'Registrar of Societies, Andhra Pradesh',
      'Meera Krishnan',
      'ORPHANAGE',
      'Mangalagiri, Andhra Pradesh',
      75,
      90,
      65,
      JSON.stringify(['ALL', 'VEG']),
      '07:00 AM - 10:00 PM',
      'DOC-NGO-2026-001.pdf'
    );

    insertNgo.run(
      'user-ngo-2',
      'Aasra Senior Citizens Charitable Trust',
      'TEST-NGO-2026-002',
      'Charity Commissioner, Andhra Pradesh',
      'Raghavendra Rao',
      'OLD_AGE_HOME',
      'Mangalagiri, Andhra Pradesh',
      50,
      60,
      45,
      JSON.stringify(['VEG']),
      '08:00 AM - 08:30 PM',
      'DOC-NGO-2026-002.pdf'
    );

    insertNgo.run(
      'user-ngo-3',
      'Navajeevan Community Kitchen Trust',
      'TEST-NGO-2026-003',
      'Registrar of Trusts, Andhra Pradesh',
      'Father Joseph Thomas',
      'HOMELESS_SHELTER',
      'Tadepalli, Andhra Pradesh',
      120,
      150,
      110,
      JSON.stringify(['ALL']),
      '24 Hours',
      'DOC-NGO-2026-003.pdf'
    );

    insertNgo.run(
      'user-ngo-pending',
      'Asha Orphanage & Shelter Trust',
      'TEST-NGO-2026-005',
      'Registrar of Societies, Andhra Pradesh (Test)',
      'Lakshmi Devi',
      'ORPHANAGE',
      'Amaravati, Andhra Pradesh',
      60,
      80,
      80,
      JSON.stringify(['VEG']),
      '08:00 AM - 09:00 PM',
      'DOC-NGO-2026-005.pdf'
    );

    db.prepare(`INSERT INTO individual_donors (user_id, preferred_occasion) VALUES (?, ?)`).run(
      'user-donor-1',
      'WEDDING'
    );

    const insertVol = db.prepare(`
      INSERT INTO volunteers (user_id, vehicle_type, max_travel_distance_km, availability_status, id_document_ref)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertVol.run('user-vol-1', 'TWO_WHEELER', 18, 'AVAILABLE', 'DL-AP-2026-8801');
    insertVol.run('user-vol-2', 'VAN', 30, 'AVAILABLE', 'DL-AP-2026-9902');

    // 4. Donations near SRM University AP & Mangalagiri, Amaravati
    const insertDonation = db.prepare(`
      INSERT INTO donations (
        id, donor_id, donor_name, donor_type, title, description, category, is_vegetarian,
        quantity_kg, estimated_servings, preparation_timestamp, expiry_timestamp,
        safe_consumption_deadline, storage_conditions, allergen_info, food_handling_declared,
        occasion, address, city, state, postal_code, latitude, longitude, pickup_time_window,
        special_instructions, status, allocated_ngo_id, allocated_ngo_name,
        assigned_volunteer_id, assigned_volunteer_name, pickup_qr_code, delivery_qr_code,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertDonation.run(
      'DON-2026-101',
      'user-rest-1',
      'Amaravati Campus Convention Kitchens',
      'RESTAURANT',
      'Surplus Shahi Paneer & Jeera Rice Buffet',
      'Freshly prepared university symposium lunch surplus stored in heated stainless chaffing dishes.',
      'COOKED_MEALS',
      1,
      35,
      80,
      hoursFromNow(-2),
      hoursFromNow(8),
      hoursFromNow(5),
      'Hot insulated stainless containers (65°C+)',
      'Dairy (Paneer, Ghee, Cashew paste)',
      1,
      'CORPORATE_EVENT',
      'Near SRM University AP Main Gate, Neerukonda',
      'Mangalagiri',
      'Andhra Pradesh',
      '522502',
      16.4662,
      80.5098,
      'Within next 90 minutes',
      'Collect from convention catering bay near SRM University AP main road.',
      'AVAILABLE',
      null,
      null,
      null,
      null,
      'QR-PICKUP-DON-2026-101-SEC99',
      'QR-DELIV-DON-2026-101-SEC99',
      hoursFromNow(-2),
      hoursFromNow(-2)
    );

    insertDonation.run(
      'DON-2026-102',
      'user-rest-2',
      'Amaravati Heritage Kitchens',
      'RESTAURANT',
      'Andhra Veg & Spice Biryani Express Batch',
      'Batch packed hot biryani from evening service. Untouched kitchen reserves.',
      'RICE_AND_BIRYANI',
      0,
      45,
      110,
      hoursFromNow(-3),
      hoursFromNow(7),
      hoursFromNow(4),
      'Sealed food-grade warmer boxes',
      'None known',
      1,
      'EVERYDAY_SURPLUS',
      'Seed Access Road, Near Kuragallu Cross',
      'Amaravati',
      'Andhra Pradesh',
      '522503',
      16.4735,
      80.5260,
      'Immediate (Next 45 mins)',
      'Collect from express dispatch counter.',
      'PICKED_UP',
      'user-ngo-3',
      'Navajeevan Community Kitchen Trust',
      'user-vol-1',
      'Karthik Varma',
      'QR-PICKUP-DON-2026-102-SEC44',
      'QR-DELIV-DON-2026-102-SEC44',
      hoursFromNow(-3),
      hoursFromNow(-0.5)
    );

    insertDonation.run(
      'DON-2026-103',
      'user-donor-1',
      'Rajesh & Kavitha Verma',
      'INDIVIDUAL',
      'Wedding Reception Vegetarian Feast',
      'Pulao, Dal Makhani, Paneer Tikka, Naan, and Gulab Jamun from evening reception.',
      'COOKED_MEALS',
      1,
      60,
      150,
      hoursFromNow(-24),
      hoursFromNow(-10),
      hoursFromNow(-12),
      'Refrigerated and packed in hygienic meal boxes',
      'Dairy, Gluten',
      1,
      'WEDDING',
      'Amaravati Villas, Kuragallu, Near SRM University AP',
      'Mangalagiri',
      'Andhra Pradesh',
      '522503',
      16.4585,
      80.5235,
      'Completed',
      null,
      'COMPLETED',
      'user-ngo-1',
      'Sneha Children Welfare Society',
      'user-vol-2',
      'Deepika Rao',
      'QR-PICKUP-DON-2026-103-DONE',
      'QR-DELIV-DON-2026-103-DONE',
      hoursFromNow(-24),
      hoursFromNow(-16)
    );

    insertDonation.run(
      'DON-2026-104',
      'user-rest-1',
      'Amaravati Campus Convention Kitchens',
      'RESTAURANT',
      'Morning Breakfast Pastries & Idli Platter',
      'Early morning conference breakfast surplus.',
      'BAKERY',
      1,
      12,
      30,
      hoursFromNow(-14),
      hoursFromNow(-4),
      hoursFromNow(-5),
      'Room temperature sealed trays',
      'Gluten, Dairy',
      1,
      'CORPORATE_EVENT',
      'Near SRM University AP Main Gate, Neerukonda',
      'Mangalagiri',
      'Andhra Pradesh',
      '522502',
      16.4662,
      80.5098,
      'Expired window',
      null,
      'EXPIRED',
      null,
      null,
      null,
      null,
      'QR-PICKUP-DON-2026-104-EXP',
      'QR-DELIV-DON-2026-104-EXP',
      hoursFromNow(-14),
      hoursFromNow(-5)
    );

    // 5. Status History
    const insertHistory = db.prepare(`
      INSERT INTO donation_status_history (
        id, donation_id, status, performed_by_user_id, performed_by_role, performed_by_name, note, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertHistory.run('hist-101-1', 'DON-2026-101', 'AVAILABLE', 'user-rest-1', 'ROLE_RESTAURANT', 'Amaravati Campus Convention Kitchens', 'Published surplus after symposium luncheon near SRM University AP.', hoursFromNow(-2));
    insertHistory.run('hist-102-1', 'DON-2026-102', 'AVAILABLE', 'user-rest-2', 'ROLE_RESTAURANT', 'Amaravati Heritage Kitchens', 'Published evening dinner batch.', hoursFromNow(-3));
    insertHistory.run('hist-102-2', 'DON-2026-102', 'REQUESTED', 'user-ngo-3', 'ROLE_NGO', 'Navajeevan Community Kitchen Trust', 'Requested full 45 kg batch.', hoursFromNow(-2.5));
    insertHistory.run('hist-102-3', 'DON-2026-102', 'APPROVED', 'user-rest-2', 'ROLE_RESTAURANT', 'Amaravati Heritage Kitchens', 'Approved allocation to Navajeevan Community Kitchen Trust.', hoursFromNow(-2.1));
    insertHistory.run('hist-102-4', 'DON-2026-102', 'ASSIGNED', 'user-admin', 'ROLE_ADMIN', 'Dr. Ananya Sharma', 'Assigned courier Karthik Varma.', hoursFromNow(-1.8));
    insertHistory.run('hist-102-5', 'DON-2026-102', 'PICKED_UP', 'user-vol-1', 'ROLE_VOLUNTEER', 'Karthik Varma', 'Pickup QR verified; temperature 68°C.', hoursFromNow(-0.5));
    insertHistory.run('hist-103-1', 'DON-2026-103', 'AVAILABLE', 'user-donor-1', 'ROLE_INDIVIDUAL', 'Rajesh & Kavitha Verma', 'Posted wedding surplus.', hoursFromNow(-24));
    insertHistory.run('hist-103-2', 'DON-2026-103', 'DELIVERED', 'user-vol-2', 'ROLE_VOLUNTEER', 'Deepika Rao', 'Delivered to Sneha Children Welfare Society.', hoursFromNow(-18));
    insertHistory.run('hist-103-3', 'DON-2026-103', 'COMPLETED', 'user-ngo-1', 'ROLE_NGO', 'Sneha Children Welfare Society', '60kg verified and served warmly to 75 children.', hoursFromNow(-16));
    insertHistory.run('hist-104-1', 'DON-2026-104', 'EXPIRED', 'user-admin', 'ROLE_ADMIN', 'Expiry Monitor', 'Automatically marked EXPIRED after safe consumption deadline.', hoursFromNow(-5));

    // 6. Food Requests
    db.prepare(`
      INSERT INTO food_requests (
        id, donation_id, ngo_id, ngo_name, requested_quantity_kg, beneficiaries_count, status, rejection_reason, request_timestamp, response_timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'REQ-2026-001',
      'DON-2026-102',
      'user-ngo-3',
      'Navajeevan Community Kitchen Trust',
      45,
      120,
      'APPROVED',
      null,
      hoursFromNow(-2.5),
      hoursFromNow(-2.1)
    );

    // 7. Volunteer Assignments
    db.prepare(`
      INSERT INTO volunteer_assignments (
        id, donation_id, volunteer_id, volunteer_name, status, pickup_proof_note, delivery_proof_note, assigned_at, picked_up_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'ASG-2026-901',
      'DON-2026-102',
      'user-vol-1',
      'Karthik Varma',
      'PICKED_UP',
      'Pickup QR verified at Amaravati Heritage Kitchens.',
      null,
      hoursFromNow(-1.8),
      hoursFromNow(-0.5),
      null
    );

    // 8. Notifications & Audit Logs
    db.prepare(`
      INSERT INTO notifications (id, user_id, target_role, title, message, type, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'notif-seed-1',
      'user-admin',
      'ROLE_ADMIN',
      'NGO Verification Pending',
      'Asha Orphanage & Shelter Trust (TEST-NGO-2026-005) is awaiting verification review.',
      'ALERT',
      0,
      hoursFromNow(-1)
    );

    db.prepare(`
      INSERT INTO notifications (id, user_id, target_role, title, message, type, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'notif-seed-2',
      'user-vol-1',
      'ROLE_VOLUNTEER',
      'Active Delivery Assigned',
      'Batch DON-2026-102 picked up and ready for handover at Navajeevan Community Kitchen Trust.',
      'DELIVERY',
      0,
      hoursFromNow(-0.5)
    );

    db.prepare(`
      INSERT INTO audit_logs (id, actor_user_id, actor_role, actor_name, action, target_type, target_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'audit-seed-1',
      'user-admin',
      'ROLE_ADMIN',
      'Dr. Ananya Sharma',
      'ASSIGN_VOLUNTEER',
      'DONATION',
      'DON-2026-102',
      'Assigned courier Karthik Varma to deliver 45kg Amaravati batch to Navajeevan Community Kitchen Trust.',
      hoursFromNow(-1.8)
    );

    db.prepare(`
      INSERT INTO complaints (id, reporter_user_id, reporter_name, donation_id, subject, description, status, resolution_note, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'CMP-2026-01',
      'user-ngo-2',
      'Aasra Senior Citizens Charitable Trust',
      'DON-2026-101',
      'Gate Access Clarification Needed',
      'Please include security gate contact number on evening banquet pickups.',
      'OPEN',
      null,
      hoursFromNow(-1.2),
      hoursFromNow(-1.2)
    );

    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}
