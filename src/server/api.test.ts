import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createDatabase } from './db.ts';
import { createApiRouter } from './api.ts';

async function startTestServer() {
  const db = createDatabase(':memory:');
  const app = express();
  app.use('/api', createApiRouter(db));
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}/api`;
  return { server, baseUrl, db };
}

test('Auth, NGO verification validation, Admin approval, and Full Donation Lifecycle', async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    // 1. Admin cannot self-register
    const adminRegRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'ROLE_ADMIN',
        email: 'rogue@annadaan.org',
        password: 'Password123',
        fullName: 'Rogue',
        phone: '9999999999',
        address: 'Addr',
      }),
    });
    assert.equal(adminRegRes.status, 403);

    // 2. Invalid NGO registration number rejected
    const badNgoRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'ROLE_NGO',
        organizationName: 'Fake Shelter',
        registrationNumber: 'INVALID-999',
        issuingAuthority: 'Registrar',
        contactPerson: 'Asha',
        email: 'fake@ngo.org',
        phone: '9876543210',
        password: 'Password123',
        address: 'Road 1, Neerukonda',
        city: 'Mangalagiri',
        state: 'Andhra Pradesh',
        documentRef: 'DOC-1',
      }),
    });
    assert.equal(badNgoRes.status, 400);
    const badNgoJson = (await badNgoRes.json()) as { error: string };
    assert.equal(badNgoJson.error, 'Invalid NGO registration number.');

    // 3. Duplicate NGO registration number rejected
    const dupNgoRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'ROLE_NGO',
        organizationName: 'Duplicate Sneha',
        registrationNumber: 'TEST-NGO-2026-001',
        issuingAuthority: 'Registrar',
        contactPerson: 'Meera',
        email: 'newmail@sneha.org',
        phone: '9876543211',
        password: 'Password123',
        address: 'Road 2, Neerukonda',
        city: 'Mangalagiri',
        state: 'Andhra Pradesh',
        documentRef: 'DOC-2',
      }),
    });
    assert.equal(dupNgoRes.status, 409);

    // 4. Valid test registry NGO registration -> PENDING
    const validNgoRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'ROLE_NGO',
        organizationName: 'Hope Haven Orphanage Foundation',
        registrationNumber: 'TEST-NGO-2026-004',
        issuingAuthority: 'NITI Aayog Darpan Registry (Test)',
        contactPerson: 'Sita Ram',
        email: 'sita@hopehaven.org',
        phone: '9876543212',
        password: 'Password123',
        address: 'Plot 7, SRM University AP Road',
        city: 'Mangalagiri',
        state: 'Andhra Pradesh',
        beneficiariesCount: 55,
        maxCapacityKg: 80,
        documentRef: 'DOC-HOPE-004.pdf',
      }),
    });
    assert.equal(validNgoRes.status, 201);

    // 5. Pending NGO cannot log in yet
    const pendingLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'ROLE_NGO',
        email: 'sita@hopehaven.org',
        password: 'Password123',
      }),
    });
    assert.equal(pendingLoginRes.status, 403);
    const pendingJson = (await pendingLoginRes.json()) as { code: string; error: string };
    assert.equal(pendingJson.code, 'VERIFICATION_PENDING');

    // 6. Admin logs in and approves the NGO
    const adminLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'ROLE_ADMIN',
        email: 'admin@annadaan.org',
        password: 'Admin@Annadaan2026',
      }),
    });
    assert.equal(adminLoginRes.status, 200);
    const { token: adminToken } = (await adminLoginRes.json()) as { token: string };

    const adminBootRes = await fetch(`${baseUrl}/bootstrap`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminBoot = (await adminBootRes.json()) as {
      users: Array<{ id: string; email: string }>;
    };
    const hopeUser = adminBoot.users.find((u) => u.email === 'sita@hopehaven.org');
    assert.ok(hopeUser);

    const approveRes = await fetch(`${baseUrl}/admin/verifications/${hopeUser.id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: 'APPROVED' }),
    });
    assert.equal(approveRes.status, 200);

    // 7. Approved NGO logs in and cannot request EXPIRED donation DON-2026-104
    const ngoLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'ROLE_NGO',
        email: 'sita@hopehaven.org',
        password: 'Password123',
      }),
    });
    assert.equal(ngoLoginRes.status, 200);
    const { token: ngoToken } = (await ngoLoginRes.json()) as { token: string };

    const expiredReqRes = await fetch(`${baseUrl}/donations/DON-2026-104/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ngoToken}`,
      },
      body: JSON.stringify({ requestedQtyKg: 10 }),
    });
    assert.equal(expiredReqRes.status, 400);

    // 8. Approved NGO requests AVAILABLE donation DON-2026-101
    const reqRes = await fetch(`${baseUrl}/donations/DON-2026-101/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ngoToken}`,
      },
      body: JSON.stringify({ requestedQtyKg: 35 }),
    });
    assert.equal(reqRes.status, 201);
    const { requestId } = (await reqRes.json()) as { requestId: string };

    // 9. Restaurant logs in and approves request -> ASSIGNED
    const restLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'ROLE_RESTAURANT',
        email: 'events@tajkrishna.com',
        password: 'Partner@123',
      }),
    });
    assert.equal(restLoginRes.status, 200);
    const { token: restToken } = (await restLoginRes.json()) as { token: string };

    const appReqRes = await fetch(`${baseUrl}/requests/${requestId}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${restToken}`,
      },
      body: JSON.stringify({}),
    });
    assert.equal(appReqRes.status, 200);
  } finally {
    server.close();
  }
});
