import 'server-only';

import type { Payload } from 'payload';

import {
  parseClientId,
  parseStaffId,
  type AuthUserId,
  type ClientId,
  type StaffId,
} from '@/modules/portal-identity/domain/identifiers';
import {
  parsePortalIdentity,
  type PortalIdentity,
} from '@/modules/portal-identity/domain/portal-identity';
import {
  parsePortalPrincipal,
  STAFF_ENROLLMENT_OPERATIONS,
  type StaffEnrollmentPrincipal,
  type StaffPrincipal,
} from '@/modules/portal-identity/domain/principal';
import {
  isStaffRole,
  isStaffStatus,
  type StaffRole,
  type StaffStatus,
} from '@/modules/portal-identity/domain/staff';
import { isClientStatus } from '@/modules/portal-identity/domain/client';
import { isRecord } from '@/modules/portal-identity/domain/validation';
import { createPayloadPortalIdentityRepository } from '@/modules/portal-identity/infrastructure/portal-identity-repository';
import { STAFF_COLLECTION_SLUG } from '@/modules/staff/domain/invariants';

import type { StaffMfaAssurance } from './mfa-assurance-reader';
import {
  isFreshPortalSession,
  type AuthenticatedPortalSession,
} from './session-reader';

const CLIENTS_SLUG = 'clients' as const;

type CanonicalStaffRecord = Readonly<{
  id: StaffId;
  role: StaffRole;
  status: StaffStatus;
}>;

type CanonicalClientRecord = Readonly<{
  id: ClientId;
  status: 'active' | 'inactive';
}>;

export type CanonicalPortalSessionSecurity = Readonly<{
  fresh: boolean;
}>;

export type CanonicalPortalPrincipalResolution =
  | Readonly<{
      outcome: 'authorized';
      principal: StaffPrincipal;
      session: CanonicalPortalSessionSecurity;
    }>
  | Readonly<{
      outcome: 'enrollment-only';
      principal: StaffEnrollmentPrincipal;
      session: CanonicalPortalSessionSecurity;
    }>
  | Readonly<{ outcome: 'denied' }>;

type CanonicalPortalPrincipalResolverDependencies = Readonly<{
  findClientById(clientId: ClientId): Promise<unknown>;
  findPortalIdentityByAuthUserId(
    authUserId: AuthUserId,
  ): Promise<PortalIdentity | null | unknown>;
  findStaffById(staffId: StaffId): Promise<unknown>;
  readAuthenticatedSession(
    headers: Headers,
  ): Promise<AuthenticatedPortalSession | null>;
  readStaffMfaAssurance(headers: Headers): Promise<StaffMfaAssurance | null>;
}>;

type CanonicalStaffSubjectDependencies = Pick<
  CanonicalPortalPrincipalResolverDependencies,
  'findPortalIdentityByAuthUserId' | 'findStaffById'
>;

const deniedResolution: CanonicalPortalPrincipalResolution = Object.freeze({
  outcome: 'denied',
});

function parseCanonicalStaffRecord(
  value: unknown,
  expectedStaffId: StaffId,
): CanonicalStaffRecord | undefined {
  if (!isRecord(value)) return undefined;

  const id = parseStaffId(value.id);
  if (
    id !== expectedStaffId ||
    !isStaffRole(value.role) ||
    !isStaffStatus(value.status)
  ) {
    return undefined;
  }

  return Object.freeze({ id, role: value.role, status: value.status });
}

function parseCanonicalClientRecord(
  value: unknown,
  expectedClientId: ClientId,
): CanonicalClientRecord | undefined {
  if (!isRecord(value)) return undefined;

  const id = parseClientId(value.id);
  if (id !== expectedClientId || !isClientStatus(value.status)) {
    return undefined;
  }

  return Object.freeze({ id, status: value.status });
}

function createStaffPrincipal(
  session: AuthenticatedPortalSession,
  staff: CanonicalStaffRecord,
): StaffPrincipal | undefined {
  const principal = parsePortalPrincipal({
    authUserId: session.authUserId,
    kind: 'staff',
    mfaAssurance: 'verified',
    role: staff.role,
    staffId: staff.id,
    status: 'active',
  });

  return principal?.kind === 'staff' ? principal : undefined;
}

function createEnrollmentPrincipal(
  session: AuthenticatedPortalSession,
  staff: CanonicalStaffRecord,
): StaffEnrollmentPrincipal | undefined {
  const principal = parsePortalPrincipal({
    allowedOperations: STAFF_ENROLLMENT_OPERATIONS,
    authUserId: session.authUserId,
    kind: 'staff-enrollment',
    staffId: staff.id,
  });

  return principal?.kind === 'staff-enrollment' ? principal : undefined;
}

function isFullyVerifiedMfa(
  assurance: StaffMfaAssurance,
  session: AuthenticatedPortalSession,
): boolean {
  return (
    assurance.authUserId === session.authUserId &&
    assurance.enrollment === 'complete' &&
    assurance.enrollmentOnly === false &&
    assurance.sessionAssurance === 'verified' &&
    assurance.evidence !== null &&
    assurance.evidence.sessionId === session.sessionId
  );
}

function isLegitimateEnrollmentOnlyMfa(
  assurance: StaffMfaAssurance,
  session: AuthenticatedPortalSession,
): boolean {
  return (
    assurance.authUserId === session.authUserId &&
    (assurance.enrollment === 'required' ||
      assurance.enrollment === 'complete') &&
    assurance.enrollmentOnly === true &&
    assurance.sessionAssurance === 'unverified' &&
    assurance.evidence === null
  );
}

/**
 * Provider-independent orchestration closed over by the two concrete Agent 11
 * exports. Its result is frozen application data, never an Agent 10 capability.
 */
function createCanonicalPortalPrincipalResolver(
  dependencies: CanonicalPortalPrincipalResolverDependencies,
) {
  return async function resolveCanonicalPortalPrincipal(
    headers: Headers,
  ): Promise<CanonicalPortalPrincipalResolution> {
    try {
      const session = await dependencies.readAuthenticatedSession(headers);
      if (!session) return deniedResolution;

      const binding = parsePortalIdentity(
        await dependencies.findPortalIdentityByAuthUserId(session.authUserId),
      );
      if (!binding || binding.authUserId !== session.authUserId) {
        return deniedResolution;
      }

      if (binding.subjectKind === 'client') {
        const client = parseCanonicalClientRecord(
          await dependencies.findClientById(binding.clientId),
          binding.clientId,
        );

        if (!client || client.status !== 'active') return deniedResolution;

        // Slice 1 has no approved Client credential provisioning or activation
        // path. Even an otherwise canonical active binding remains fail closed
        // until Slice 2 deliberately replaces this policy.
        return deniedResolution;
      }

      const staff = parseCanonicalStaffRecord(
        await dependencies.findStaffById(binding.staffId),
        binding.staffId,
      );
      if (!staff || staff.status !== 'active') return deniedResolution;

      const assurance = await dependencies.readStaffMfaAssurance(headers);
      if (!assurance || assurance.authUserId !== binding.authUserId) {
        return deniedResolution;
      }

      const sessionSecurity = Object.freeze({
        fresh: isFreshPortalSession(session),
      });

      if (isFullyVerifiedMfa(assurance, session)) {
        const principal = createStaffPrincipal(session, staff);
        return principal
          ? Object.freeze({
              outcome: 'authorized',
              principal,
              session: sessionSecurity,
            })
          : deniedResolution;
      }

      if (isLegitimateEnrollmentOnlyMfa(assurance, session)) {
        const principal = createEnrollmentPrincipal(session, staff);
        return principal
          ? Object.freeze({
              outcome: 'enrollment-only',
              principal,
              session: sessionSecurity,
            })
          : deniedResolution;
      }

      return deniedResolution;
    } catch {
      return deniedResolution;
    }
  };
}

/** Trusted Better Auth MFA subject check; it never accepts email or role data. */
function createCanonicalActiveStaffMfaSubjectAuthorizer(
  dependencies: CanonicalStaffSubjectDependencies,
) {
  return async function isCanonicalActiveStaffMfaSubject(
    authUserId: AuthUserId,
  ): Promise<boolean> {
    try {
      const binding = parsePortalIdentity(
        await dependencies.findPortalIdentityByAuthUserId(authUserId),
      );
      if (
        !binding ||
        binding.authUserId !== authUserId ||
        binding.subjectKind !== 'staff'
      ) {
        return false;
      }

      const staff = parseCanonicalStaffRecord(
        await dependencies.findStaffById(binding.staffId),
        binding.staffId,
      );
      return staff?.status === 'active';
    } catch {
      return false;
    }
  };
}

async function getCanonicalPayload(): Promise<Payload> {
  const [{ getPayload }, { default: config }] = await Promise.all([
    import('payload'),
    import('@payload-config'),
  ]);
  return getPayload({ config });
}

async function findCanonicalPortalIdentity(authUserId: AuthUserId) {
  const payload = await getCanonicalPayload();
  return createPayloadPortalIdentityRepository(payload).findByAuthUserId(
    authUserId,
  );
}

async function findCanonicalStaff(staffId: StaffId): Promise<unknown> {
  const payload = await getCanonicalPayload();
  const findByID = payload.findByID.bind(payload) as unknown as (
    options: Readonly<{
      collection: typeof STAFF_COLLECTION_SLUG;
      depth: 0;
      id: StaffId;
      overrideAccess: true;
      select: Readonly<{ role: true; status: true }>;
    }>,
  ) => Promise<unknown>;

  return findByID({
    collection: STAFF_COLLECTION_SLUG,
    depth: 0,
    id: staffId,
    overrideAccess: true,
    select: { role: true, status: true },
  });
}

async function findCanonicalClient(clientId: ClientId): Promise<unknown> {
  const payload = await getCanonicalPayload();
  const findByID = payload.findByID.bind(payload) as unknown as (
    options: Readonly<{
      collection: typeof CLIENTS_SLUG;
      depth: 0;
      id: ClientId;
      overrideAccess: true;
      select: Readonly<{ status: true }>;
    }>,
  ) => Promise<unknown>;

  return findByID({
    collection: CLIENTS_SLUG,
    depth: 0,
    id: clientId,
    overrideAccess: true,
    select: { status: true },
  });
}

const concreteDependencies: CanonicalPortalPrincipalResolverDependencies =
  Object.freeze({
    findClientById: findCanonicalClient,
    findPortalIdentityByAuthUserId: findCanonicalPortalIdentity,
    findStaffById: findCanonicalStaff,
    readAuthenticatedSession: async (headers: Headers) => {
      const { readAuthenticatedPortalSession } = await import('./session');
      return readAuthenticatedPortalSession(headers);
    },
    readStaffMfaAssurance: async (headers: Headers) => {
      const { readStaffMfaAssurance } = await import('./mfa');
      return readStaffMfaAssurance(headers);
    },
  });

const concreteResolver =
  createCanonicalPortalPrincipalResolver(concreteDependencies);

const concreteMfaSubjectAuthorizer =
  createCanonicalActiveStaffMfaSubjectAuthorizer(concreteDependencies);

/**
 * The one production Better Auth -> PortalIdentity -> domain -> MFA resolver.
 * Agent 10 imports this exact function and does not accept a replacement.
 */
export async function resolveCanonicalPortalPrincipalFromSession(
  headers: Headers,
): Promise<CanonicalPortalPrincipalResolution> {
  return concreteResolver(headers);
}

/** Production callback used only by the reviewed Staff MFA HTTP boundary. */
export async function isCanonicalActiveStaffMfaSubject(
  authUserId: AuthUserId,
): Promise<boolean> {
  return concreteMfaSubjectAuthorizer(authUserId);
}
