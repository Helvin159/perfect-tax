import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  findByID: vi.fn(),
  getPayload: vi.fn(),
  readAuthenticatedPortalSession: vi.fn(),
  readStaffMfaAssurance: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@payload-config', () => ({ default: Object.freeze({}) }));
vi.mock('payload', () => ({ getPayload: mocks.getPayload }));
vi.mock('./session', () => ({
  readAuthenticatedPortalSession: mocks.readAuthenticatedPortalSession,
}));
vi.mock('./mfa', () => ({
  readStaffMfaAssurance: mocks.readStaffMfaAssurance,
}));

import {
  parseAuthUserId,
  parseClientId,
  parseStaffId,
} from '@/modules/portal-identity/domain/identifiers';
import { STAFF_ENROLLMENT_OPERATIONS } from '@/modules/portal-identity/domain/principal';

import type { StaffMfaAssurance } from './mfa-assurance-reader';
import * as portalPrincipalExports from './portal-principal-composition';
import {
  isCanonicalActiveStaffMfaSubject,
  resolveCanonicalPortalPrincipalFromSession,
} from './portal-principal-composition';
import type { AuthenticatedPortalSession } from './session-reader';

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Invalid Agent 11 test fixture');
  return value;
}

const authUserA = required(parseAuthUserId('auth-user-a'));
const authUserB = required(parseAuthUserId('auth-user-b'));
const staffId = required(parseStaffId(11));
const clientId = required(parseClientId(101));

function requestHeaders(extra: Record<string, string> = {}) {
  return new Headers({
    cookie: 'portal-auth.session_token=server-validated-token',
    ...extra,
  });
}

function verifiedAssurance(
  session: AuthenticatedPortalSession,
): StaffMfaAssurance {
  return Object.freeze({
    authUserId: session.authUserId,
    enrollment: 'complete',
    enrollmentOnly: false,
    evidence: Object.freeze({
      method: 'totp',
      provider: 'better-auth',
      sessionId: session.sessionId,
      verifiedAt: new Date(session.createdAt.getTime() + 60_000),
    }),
    sessionAssurance: 'verified',
  });
}

function enrollmentAssurance(
  session: AuthenticatedPortalSession,
): StaffMfaAssurance {
  return Object.freeze({
    authUserId: session.authUserId,
    enrollment: 'required',
    enrollmentOnly: true,
    evidence: null,
    sessionAssurance: 'unverified',
  });
}

type TestState = {
  bindingRows: unknown[];
  client: unknown;
  mfa: StaffMfaAssurance | null;
  session: AuthenticatedPortalSession | null;
  staff: unknown;
};

let state: TestState;

function activeStaffBinding(authUserId: string = authUserA) {
  return {
    authUserId,
    staff: staffId,
    subjectType: 'staff',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  const now = Date.now();
  const session: AuthenticatedPortalSession = Object.freeze({
    authUserId: authUserA,
    createdAt: new Date(now - 5 * 60_000),
    expiresAt: new Date(now + 7 * 60 * 60_000),
    sessionId: 'session-a',
  });
  state = {
    bindingRows: [activeStaffBinding()],
    client: Object.freeze({ id: clientId, status: 'active' }),
    mfa: verifiedAssurance(session),
    session,
    staff: Object.freeze({
      id: staffId,
      role: 'administrator',
      status: 'active',
    }),
  };

  mocks.getPayload.mockResolvedValue({
    find: mocks.find,
    findByID: mocks.findByID,
  });
  mocks.readAuthenticatedPortalSession.mockImplementation(
    async () => state.session,
  );
  mocks.readStaffMfaAssurance.mockImplementation(async () => state.mfa);
  mocks.find.mockImplementation(async () => ({ docs: state.bindingRows }));
  mocks.findByID.mockImplementation(async ({ collection }) =>
    collection === 'staff' ? state.staff : state.client,
  );
});

describe('canonical portal principal resolution', () => {
  it('exports no injectable resolver factory or principal attester', () => {
    expect(Object.keys(portalPrincipalExports).sort()).toEqual([
      'isCanonicalActiveStaffMfaSubject',
      'resolveCanonicalPortalPrincipalFromSession',
    ]);
  });

  it('constructs a fully verified Staff principal only from canonical state', async () => {
    const result = await resolveCanonicalPortalPrincipalFromSession(
      requestHeaders({
        'x-auth-user-id': authUserB,
        'x-client-id': '999',
        'x-mfa-verified': 'true',
        'x-portal-identity': JSON.stringify({ staffId: 999 }),
        'x-role': 'owner',
        'x-staff-id': '999',
      }),
    );

    expect(result).toEqual({
      outcome: 'authorized',
      principal: {
        authUserId: authUserA,
        kind: 'staff',
        mfaAssurance: 'verified',
        role: 'administrator',
        staffId,
        status: 'active',
      },
      session: { fresh: true },
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(JSON.stringify(result)).not.toContain('session-a');
    expect(JSON.stringify(result)).not.toContain('session_token');
    expect(result).not.toHaveProperty('createdAt');
    expect(result).not.toHaveProperty('expiresAt');
    expect(mocks.find).toHaveBeenCalledWith({
      collection: 'portal-identities',
      depth: 0,
      limit: 2,
      overrideAccess: true,
      select: {
        authUserId: true,
        client: true,
        staff: true,
        subjectType: true,
      },
      where: { authUserId: { equals: authUserA } },
    });
    expect(mocks.findByID).toHaveBeenCalledWith({
      collection: 'staff',
      depth: 0,
      id: staffId,
      overrideAccess: true,
      select: { role: true, status: true },
    });
  });

  it('denies browser claims, fake IDs, and matching email without a binding', async () => {
    state.bindingRows = [];

    await expect(
      resolveCanonicalPortalPrincipalFromSession(
        requestHeaders({
          'x-auth-user-id': authUserA,
          'x-client-id': String(clientId),
          'x-email': 'same-as-staff@example.test',
          'x-mfa-verified': 'true',
          'x-role': 'owner',
          'x-staff-id': String(staffId),
        }),
      ),
    ).resolves.toEqual({ outcome: 'denied' });
    expect(mocks.findByID).not.toHaveBeenCalled();
    expect(mocks.readStaffMfaAssurance).not.toHaveBeenCalled();
  });

  it('denies missing, malformed, ambiguous, and cross-user bindings', async () => {
    const invalidBindingRows = [
      [],
      [activeStaffBinding(authUserB)],
      [
        {
          ...activeStaffBinding(),
          client: clientId,
        },
      ],
      [{ ...activeStaffBinding(), staff: 0 }],
      [{ ...activeStaffBinding(), subjectType: 'unknown' }],
    ];

    for (const bindingRows of invalidBindingRows) {
      state.bindingRows = bindingRows;
      await expect(
        resolveCanonicalPortalPrincipalFromSession(requestHeaders()),
      ).resolves.toEqual({ outcome: 'denied' });
    }
  });

  it('denies missing, mismatched, disabled, and invalid-role Staff records', async () => {
    for (const staff of [
      null,
      { id: 12, role: 'administrator', status: 'active' },
      { id: staffId, role: 'administrator', status: 'disabled' },
      { id: staffId, role: 'content-editor', status: 'active' },
      { id: staffId, role: 'owner', status: 'unknown' },
    ]) {
      state.staff = staff;
      await expect(
        resolveCanonicalPortalPrincipalFromSession(requestHeaders()),
      ).resolves.toEqual({ outcome: 'denied' });
    }
  });

  it('returns only the frozen enrollment principal for legitimate incomplete MFA', async () => {
    state.mfa = enrollmentAssurance(state.session!);

    const result = await resolveCanonicalPortalPrincipalFromSession(
      requestHeaders({ 'x-mfa-verified': 'true', 'x-role': 'owner' }),
    );

    expect(result).toEqual({
      outcome: 'enrollment-only',
      principal: {
        allowedOperations: STAFF_ENROLLMENT_OPERATIONS,
        authUserId: authUserA,
        kind: 'staff-enrollment',
        staffId,
      },
      session: { fresh: true },
    });
    expect(Object.isFrozen(result)).toBe(true);
    if (result.outcome !== 'enrollment-only') {
      throw new Error('Expected enrollment-only resolution');
    }
    expect(Object.isFrozen(result.principal)).toBe(true);
    expect(result.principal).not.toHaveProperty('role');
    expect(result.principal).not.toHaveProperty('mfaAssurance');
  });

  it('denies invalid MFA combinations and exact-session substitution', async () => {
    const verified = verifiedAssurance(state.session!);
    const invalidAssurances = [
      null,
      { ...verified, authUserId: authUserB },
      {
        ...verified,
        evidence: { ...verified.evidence!, sessionId: 'session-b' },
      },
      { ...verified, enrollmentOnly: true },
      { ...verified, evidence: null },
      {
        ...enrollmentAssurance(state.session!),
        sessionAssurance: 'verified',
      },
    ];

    for (const assurance of invalidAssurances) {
      state.mfa = assurance as StaffMfaAssurance | null;
      await expect(
        resolveCanonicalPortalPrincipalFromSession(requestHeaders()),
      ).resolves.toEqual({ outcome: 'denied' });
    }
  });

  it('keeps ordinary verified operations valid while separately reporting stale freshness', async () => {
    const staleSession: AuthenticatedPortalSession = Object.freeze({
      ...state.session!,
      createdAt: new Date(Date.now() - 16 * 60_000),
    });
    state.session = staleSession;
    state.mfa = verifiedAssurance(staleSession);

    await expect(
      resolveCanonicalPortalPrincipalFromSession(requestHeaders()),
    ).resolves.toMatchObject({
      outcome: 'authorized',
      session: { fresh: false },
    });
  });

  it('revalidates Staff status on every operation instead of caching a principal', async () => {
    await expect(
      resolveCanonicalPortalPrincipalFromSession(requestHeaders()),
    ).resolves.toMatchObject({ outcome: 'authorized' });

    state.staff = Object.freeze({
      id: staffId,
      role: 'administrator',
      status: 'disabled',
    });

    await expect(
      resolveCanonicalPortalPrincipalFromSession(requestHeaders()),
    ).resolves.toEqual({ outcome: 'denied' });
    expect(mocks.findByID).toHaveBeenCalledTimes(2);
    expect(mocks.readAuthenticatedPortalSession).toHaveBeenCalledTimes(2);
  });

  it('keeps every Client binding fail closed in Slice 1', async () => {
    state.bindingRows = [
      {
        authUserId: authUserA,
        client: clientId,
        subjectType: 'client',
      },
    ];

    for (const client of [
      { id: clientId, status: 'active' },
      { id: clientId, status: 'inactive' },
      { id: 202, status: 'active' },
      null,
    ]) {
      state.client = client;
      await expect(
        resolveCanonicalPortalPrincipalFromSession(requestHeaders()),
      ).resolves.toEqual({ outcome: 'denied' });
    }

    expect(mocks.findByID).toHaveBeenCalledWith({
      collection: 'clients',
      depth: 0,
      id: clientId,
      overrideAccess: true,
      select: { status: true },
    });
    expect(mocks.readStaffMfaAssurance).not.toHaveBeenCalled();
  });

  it('turns duplicate persistence and provider failures into the same generic denial', async () => {
    state.bindingRows = [activeStaffBinding(), activeStaffBinding()];
    await expect(
      resolveCanonicalPortalPrincipalFromSession(requestHeaders()),
    ).resolves.toEqual({ outcome: 'denied' });

    state.bindingRows = [activeStaffBinding()];
    mocks.readStaffMfaAssurance.mockRejectedValueOnce(
      new Error('provider unavailable'),
    );
    await expect(
      resolveCanonicalPortalPrincipalFromSession(requestHeaders()),
    ).resolves.toEqual({ outcome: 'denied' });
  });
});

describe('canonical active Staff MFA subject resolution', () => {
  it('authorizes only the exact active canonical Staff binding', async () => {
    await expect(isCanonicalActiveStaffMfaSubject(authUserA)).resolves.toBe(
      true,
    );

    state.staff = { id: staffId, role: 'administrator', status: 'disabled' };
    await expect(isCanonicalActiveStaffMfaSubject(authUserA)).resolves.toBe(
      false,
    );

    state.bindingRows = [
      {
        authUserId: authUserA,
        client: clientId,
        subjectType: 'client',
      },
    ];
    await expect(isCanonicalActiveStaffMfaSubject(authUserA)).resolves.toBe(
      false,
    );

    state.bindingRows = [activeStaffBinding(authUserB)];
    await expect(isCanonicalActiveStaffMfaSubject(authUserA)).resolves.toBe(
      false,
    );
  });
});
