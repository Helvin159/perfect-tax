/// <reference types="vitest/importMeta" />

import 'server-only';

import type {
  Access,
  FieldAccess,
  Payload,
  PayloadRequest,
  RequestContext,
} from 'payload';

import {
  denyAuthorization,
  type AuthorizationDecision,
  type AuthorizationDenialCode,
} from '@/modules/authorization/domain/decision';
import { parseClientOwnedResource } from '@/modules/authorization/domain/resource-evidence';
import { createAuthorizationPolicies } from '@/modules/authorization/policies';
import {
  parseClientId,
  type ClientId,
} from '@/modules/portal-identity/domain/identifiers';
import {
  parsePortalPrincipal,
  type ClientPrincipal,
  type PortalPrincipal,
  type StaffPrincipal,
} from '@/modules/portal-identity/domain/principal';
import {
  isClientStatus,
  type ClientStatus,
} from '@/modules/portal-identity/domain/client';
import { isRecord } from '@/modules/portal-identity/domain/validation';
import { parseClientNumber } from '@/modules/portal-identity/domain/client-number';

const CLIENTS_SLUG = 'clients' as const;
const PORTAL_PRINCIPALS_DISCRIMINATOR = 'portal-principals' as const;
const portalCapabilityContextKey = 'portalPayloadCapability';

type OperationalPortalPrincipal = StaffPrincipal | ClientPrincipal;

/**
 * This is deliberately not a Payload CMS identity. It contains only the
 * fields needed to exact-match a request to the principal held in the private
 * runtime registry.
 */
export type PortalPayloadUser =
  | Readonly<{
      collection: typeof PORTAL_PRINCIPALS_DISCRIMINATOR;
      id: `staff:${number}`;
      kind: 'staff';
      role: StaffPrincipal['role'];
      staffId: StaffPrincipal['staffId'];
    }>
  | Readonly<{
      clientId: ClientPrincipal['clientId'];
      collection: typeof PORTAL_PRINCIPALS_DISCRIMINATOR;
      id: `client:${number}`;
      kind: 'client';
    }>;

type PortalAttestationBinding = {
  readonly ownershipEvidence?: NonNullable<
    ReturnType<typeof parseClientOwnedResource>
  >;
  readonly principal: OperationalPortalPrincipal;
  request?: object;
  readonly user: PortalPayloadUser;
};

// The token object, registry, and issuance path never leave this module.
const portalAttestations = new WeakMap<object, PortalAttestationBinding>();
const ownershipEvidenceBindings = new WeakMap<object, object>();

export class PortalPayloadAuthorizationError extends Error {
  readonly code: AuthorizationDenialCode;

  constructor(code: AuthorizationDenialCode) {
    super(`Portal operation denied: ${code}`);
    this.name = 'PortalPayloadAuthorizationError';
    this.code = code;
  }
}

export class PortalPayloadPersistenceError extends Error {
  constructor() {
    super('Portal operation returned an invalid persistence projection');
    this.name = 'PortalPayloadPersistenceError';
  }
}

/**
 * Agent 11 completes this same module with its concrete session/domain
 * resolver. Keeping the interface and composition private prevents feature
 * code from substituting a resolver.
 */
interface TrustedPortalPrincipalResolver<Source extends object> {
  resolveCanonicalPrincipal(
    source: Source,
  ): PortalPrincipal | undefined | Promise<PortalPrincipal | undefined>;
}

export type PortalClientSummary = Readonly<{
  clientNumber: string;
  firstName: string;
  id: ClientId;
  lastName: string;
  status: ClientStatus;
}>;

export type PortalClientProfile = PortalClientSummary &
  Readonly<{ contactEmail: string }>;

/** Fixed user-driven operations. There is intentionally no generic Local API. */
export interface PortalPayloadGateway<PrincipalSource extends object> {
  listClientSummaries(
    principalSource: PrincipalSource,
  ): Promise<readonly PortalClientSummary[]>;
  readOwnClientProfile(
    principalSource: PrincipalSource,
  ): Promise<PortalClientProfile>;
}

type ClientFind = (
  options: Readonly<{
    collection: typeof CLIENTS_SLUG;
    context: RequestContext;
    depth: 0;
    limit: 100;
    overrideAccess: false;
    page: 1;
    select: Readonly<{
      clientNumber: true;
      firstName: true;
      lastName: true;
      status: true;
    }>;
    sort: 'clientNumber';
    user: PortalPayloadUser;
  }>,
) => Promise<Readonly<{ docs: readonly unknown[] }>>;

type ClientFindById = (
  options: Readonly<{
    collection: typeof CLIENTS_SLUG;
    context: RequestContext;
    depth: 0;
    id: ClientId;
    overrideAccess: false;
    select: Readonly<{
      clientNumber: true;
      contactEmail: true;
      firstName: true;
      lastName: true;
      status: true;
    }>;
    user: PortalPayloadUser;
  }>,
) => Promise<unknown>;

type PreparedPortalOperation = Readonly<{
  context: RequestContext;
  principal: OperationalPortalPrincipal;
  token: object;
  user: PortalPayloadUser;
}>;

function operationalPrincipal(
  value: PortalPrincipal | undefined,
): OperationalPortalPrincipal | undefined {
  const principal = parsePortalPrincipal(value);
  return principal?.kind === 'staff' || principal?.kind === 'client'
    ? principal
    : undefined;
}

function toPortalPayloadUser(
  principal: OperationalPortalPrincipal,
): PortalPayloadUser {
  if (principal.kind === 'staff') {
    return Object.freeze({
      collection: PORTAL_PRINCIPALS_DISCRIMINATOR,
      id: `staff:${principal.staffId}` as const,
      kind: 'staff',
      role: principal.role,
      staffId: principal.staffId,
    });
  }

  return Object.freeze({
    clientId: principal.clientId,
    collection: PORTAL_PRINCIPALS_DISCRIMINATOR,
    id: `client:${principal.clientId}` as const,
    kind: 'client',
  });
}

function hasExactUserKeys(
  value: Record<string, unknown>,
  expected: PortalPayloadUser,
): boolean {
  const actualKeys = Object.keys(value).sort();
  const expectedKeys = Object.keys(expected).sort();
  return (
    actualKeys.length === expectedKeys.length &&
    actualKeys.every((key, index) => key === expectedKeys[index])
  );
}

function matchesPortalPayloadUser(
  value: unknown,
  expected: PortalPayloadUser,
): boolean {
  if (!isRecord(value) || !hasExactUserKeys(value, expected)) return false;

  return Object.entries(expected).every(([key, expectedValue]) =>
    Object.is(value[key], expectedValue),
  );
}

function capabilityFromContext(context: unknown): object | undefined {
  if (!isRecord(context)) return undefined;
  const capability = context[portalCapabilityContextKey];
  return typeof capability === 'object' && capability !== null
    ? capability
    : undefined;
}

function bindRequestToAttestation(
  binding: PortalAttestationBinding,
  request: object,
): boolean {
  if (binding.request === undefined) {
    binding.request = request;
    return true;
  }

  return binding.request === request;
}

/**
 * Resolves only a gateway-created request. Property names and user shape carry
 * no authority: the context token must exist in the private WeakMap, the full
 * narrow user must match, and the token must remain on its first request.
 */
export function resolveAttestedPortalRequest(
  request: unknown,
): Readonly<{ principal: OperationalPortalPrincipal }> | undefined {
  if (!isRecord(request)) return undefined;

  const token = capabilityFromContext(request.context);
  if (!token) return undefined;

  const binding = portalAttestations.get(token);
  if (
    !binding ||
    !matchesPortalPayloadUser(request.user, binding.user) ||
    !bindRequestToAttestation(binding, request)
  ) {
    return undefined;
  }

  return Object.freeze({ principal: binding.principal });
}

function policiesFor(token: object, binding: PortalAttestationBinding) {
  return createAuthorizationPolicies({
    // Slice 1 has no canonical assignment persistence.
    isTrustedAssignmentEvidence: () => false,
    isTrustedOwnershipEvidence: (value) =>
      typeof value === 'object' &&
      value !== null &&
      ownershipEvidenceBindings.get(value) === token,
    isTrustedPrincipal: (value) => value === binding.principal,
    isTrustedStaffCreationEvidence: () => false,
    isTrustedStaffResourceEvidence: () => false,
  });
}

function decideClientRead(token: object): AuthorizationDecision {
  const binding = portalAttestations.get(token);
  if (!binding) return denyAuthorization('invalid-principal');

  return policiesFor(token, binding).decideClientOperation(
    binding.principal,
    'read',
    binding.ownershipEvidence,
  );
}

function requireAllowed(decision: AuthorizationDecision): void {
  if (!decision.allowed) {
    throw new PortalPayloadAuthorizationError(decision.reasonCode);
  }
}

function clientReadConstraint(binding: PortalAttestationBinding) {
  return binding.principal.kind === 'client'
    ? ({ id: { equals: binding.principal.clientId } } as const)
    : true;
}

/**
 * Agent 13 attaches this to Clients.read. It independently re-establishes
 * runtime attestation and Agent 8 policy authorization on every call.
 */
export const authorizePortalClientRead: Access = ({ req }) => {
  const resolved = resolveAttestedPortalRequest(req);
  if (!resolved) return false;

  const token = capabilityFromContext(req.context);
  if (!token) return false;
  const binding = portalAttestations.get(token);
  if (!binding || binding.principal !== resolved.principal) return false;

  const decision = decideClientRead(token);
  return decision.allowed ? clientReadConstraint(binding) : false;
};

/** Agent 13 may attach this to approved readable Client fields. */
export const authorizePortalClientFieldRead: FieldAccess = ({ req }) => {
  const resolved = resolveAttestedPortalRequest(req);
  if (!resolved) return false;

  const token = capabilityFromContext(req.context);
  return token !== undefined && decideClientRead(token).allowed;
};

const denyPortalClientMutation: Access = () => false;
const denyPortalClientFieldMutation: FieldAccess = () => false;

/** Fail-closed collection contract for Agent 13's registration composition. */
export const portalClientCollectionAccess = Object.freeze({
  create: denyPortalClientMutation,
  delete: denyPortalClientMutation,
  read: authorizePortalClientRead,
  update: denyPortalClientMutation,
});

/** Fail-closed field contract; only an explicitly attached read is allowed. */
export const portalClientFieldAccess = Object.freeze({
  create: denyPortalClientFieldMutation,
  read: authorizePortalClientFieldRead,
  update: denyPortalClientFieldMutation,
});

function mapClientSummary(value: unknown): PortalClientSummary {
  if (!isRecord(value)) throw new PortalPayloadPersistenceError();

  const id = parseClientId(value.id);
  const clientNumber = parseClientNumber(value.clientNumber);
  if (
    !id ||
    !clientNumber ||
    typeof value.firstName !== 'string' ||
    typeof value.lastName !== 'string' ||
    !isClientStatus(value.status)
  ) {
    throw new PortalPayloadPersistenceError();
  }

  return Object.freeze({
    clientNumber,
    firstName: value.firstName,
    id,
    lastName: value.lastName,
    status: value.status,
  });
}

function mapClientProfile(value: unknown): PortalClientProfile {
  const summary = mapClientSummary(value);
  if (!isRecord(value) || typeof value.contactEmail !== 'string') {
    throw new PortalPayloadPersistenceError();
  }

  return Object.freeze({ ...summary, contactEmail: value.contactEmail });
}

function issuePortalOperation(
  principal: OperationalPortalPrincipal,
): PreparedPortalOperation {
  const token = Object.freeze({});
  const user = toPortalPayloadUser(principal);
  const ownershipEvidence =
    principal.kind === 'client'
      ? parseClientOwnedResource({ clientId: principal.clientId })
      : undefined;

  const binding: PortalAttestationBinding = {
    ...(ownershipEvidence === undefined ? {} : { ownershipEvidence }),
    principal,
    user,
  };
  portalAttestations.set(token, binding);
  if (ownershipEvidence !== undefined) {
    ownershipEvidenceBindings.set(ownershipEvidence, token);
  }

  return Object.freeze({
    context: Object.freeze({ [portalCapabilityContextKey]: token }),
    principal,
    token,
    user,
  });
}

function revokePortalOperation(token: object): void {
  const binding = portalAttestations.get(token);
  if (binding?.ownershipEvidence !== undefined) {
    ownershipEvidenceBindings.delete(binding.ownershipEvidence);
  }
  portalAttestations.delete(token);
}

/**
 * Private Agent 11 composition seam. Agent 11 must directly import its
 * concrete resolver into this module and close over it here. Exporting this
 * function, either dependency, or the issuer would reopen portal authority.
 */
function composePortalPayloadGatewayWithPrincipalResolver<
  PrincipalSource extends object,
>(
  payload: Pick<Payload, 'find' | 'findByID'>,
  resolver: TrustedPortalPrincipalResolver<PrincipalSource>,
): PortalPayloadGateway<PrincipalSource> {
  const find = payload.find.bind(payload) as unknown as ClientFind;
  const findByID = payload.findByID.bind(payload) as unknown as ClientFindById;

  async function prepare(source: unknown): Promise<PreparedPortalOperation> {
    if (typeof source !== 'object' || source === null) {
      throw new PortalPayloadAuthorizationError('unauthenticated');
    }

    let resolved: PortalPrincipal | undefined;
    try {
      resolved = await resolver.resolveCanonicalPrincipal(
        source as PrincipalSource,
      );
    } catch {
      throw new PortalPayloadAuthorizationError('invalid-principal');
    }

    const principal = operationalPrincipal(resolved);
    if (!principal) {
      throw new PortalPayloadAuthorizationError('invalid-principal');
    }

    return issuePortalOperation(principal);
  }

  return Object.freeze({
    async listClientSummaries(
      principalSource: PrincipalSource,
      ...unexpectedArguments: readonly unknown[]
    ) {
      if (unexpectedArguments.length !== 0) {
        throw new PortalPayloadAuthorizationError('invalid-principal');
      }
      const operation = await prepare(principalSource);
      try {
        requireAllowed(decideClientRead(operation.token));

        const result = await find({
          collection: CLIENTS_SLUG,
          context: operation.context,
          depth: 0,
          limit: 100,
          overrideAccess: false,
          page: 1,
          select: {
            clientNumber: true,
            firstName: true,
            lastName: true,
            status: true,
          },
          sort: 'clientNumber',
          user: operation.user,
        });

        return Object.freeze(result.docs.map(mapClientSummary));
      } finally {
        revokePortalOperation(operation.token);
      }
    },

    async readOwnClientProfile(
      principalSource: PrincipalSource,
      ...unexpectedArguments: readonly unknown[]
    ) {
      if (unexpectedArguments.length !== 0) {
        throw new PortalPayloadAuthorizationError('invalid-principal');
      }
      const operation = await prepare(principalSource);
      try {
        if (operation.principal.kind !== 'client') {
          throw new PortalPayloadAuthorizationError('forbidden-role');
        }
        requireAllowed(decideClientRead(operation.token));

        const result = await findByID({
          collection: CLIENTS_SLUG,
          context: operation.context,
          depth: 0,
          id: operation.principal.clientId,
          overrideAccess: false,
          select: {
            clientNumber: true,
            contactEmail: true,
            firstName: true,
            lastName: true,
            status: true,
          },
          user: operation.user,
        });

        return mapClientProfile(result);
      } finally {
        revokePortalOperation(operation.token);
      }
    },
  });
}

/** Convenience for hooks that must deny before performing side effects. */
export function requireAttestedPortalRequest(
  req: PayloadRequest,
): Readonly<{ principal: OperationalPortalPrincipal }> {
  const resolved = resolveAttestedPortalRequest(req);
  if (!resolved) {
    throw new PortalPayloadAuthorizationError('invalid-principal');
  }
  return resolved;
}

if (import.meta.vitest) {
  const { describe, expect, it, vi } = import.meta.vitest;

  type TestPrincipalSource = Readonly<{ opaque: string }>;

  const clientRecords = [
    {
      clientNumber: 'CL-7F4K-92MX',
      contactEmail: 'client-a@example.test',
      firstName: 'Ada',
      id: 101,
      lastName: 'Lovelace',
      relatedClient: 202,
      secretTaxValue: 'must-not-leak',
      status: 'active',
    },
    {
      clientNumber: 'CL-8G5M-93NX',
      contactEmail: 'client-b@example.test',
      firstName: 'Grace',
      id: 202,
      lastName: 'Hopper',
      relatedClient: 101,
      secretTaxValue: 'must-not-leak-either',
      status: 'active',
    },
  ] as const;

  function requiredTestPrincipal(value: unknown): PortalPrincipal {
    const principal = parsePortalPrincipal(value);
    if (!principal) throw new Error('Invalid test principal');
    return principal;
  }

  const owner = requiredTestPrincipal({
    authUserId: 'auth-owner',
    kind: 'staff',
    mfaAssurance: 'verified',
    role: 'owner',
    staffId: 11,
    status: 'active',
  });
  const client = requiredTestPrincipal({
    authUserId: 'auth-client-a',
    clientId: 101,
    kind: 'client',
    status: 'active',
  });
  const caseWorker = requiredTestPrincipal({
    authUserId: 'auth-case-worker',
    kind: 'staff',
    mfaAssurance: 'verified',
    role: 'case-worker',
    staffId: 22,
    status: 'active',
  });
  const enrollment = requiredTestPrincipal({
    allowedOperations: ['enroll-mfa', 'verify-mfa', 'sign-out'],
    authUserId: 'auth-enrollment',
    kind: 'staff-enrollment',
    staffId: 33,
  });

  function createPrivatePortalHarness() {
    const bindings = new WeakMap<object, PortalPrincipal>();
    const requests: Array<Record<string, unknown>> = [];
    const requestObservers: Array<(req: Record<string, unknown>) => void> = [];

    const find = vi.fn(async (options: Record<string, unknown>) => {
      const req = {
        context: { ...(options.context as Record<string, unknown>) },
        payloadDataLoader: new Map<string, unknown>(),
        transactionID: `transaction-${requests.length + 1}`,
        user: options.user,
      };
      requests.push(req);

      const access = await authorizePortalClientRead({ req } as never);
      if (access === false) throw new Error('Forbidden');
      if (!(await authorizePortalClientFieldRead({ req } as never))) {
        throw new Error('Forbidden field');
      }
      for (const observer of requestObservers) observer(req);

      const docs =
        access === true
          ? clientRecords
          : clientRecords.filter(
              (record) =>
                record.id === (access as { id: { equals: number } }).id.equals,
            );
      return { docs };
    });

    const findByID = vi.fn(async (options: Record<string, unknown>) => {
      const req = {
        context: { ...(options.context as Record<string, unknown>) },
        payloadDataLoader: new Map<string, unknown>(),
        transactionID: `transaction-${requests.length + 1}`,
        user: options.user,
      };
      requests.push(req);

      const access = await authorizePortalClientRead({ req } as never);
      if (access === false) throw new Error('Forbidden');
      if (!(await authorizePortalClientFieldRead({ req } as never))) {
        throw new Error('Forbidden field');
      }
      for (const observer of requestObservers) observer(req);

      const record = clientRecords.find(
        (candidate) => candidate.id === options.id,
      );
      if (!record) throw new Error('Not found');
      return record;
    });

    const gateway = composePortalPayloadGatewayWithPrincipalResolver(
      { find, findByID } as unknown as Pick<Payload, 'find' | 'findByID'>,
      {
        resolveCanonicalPrincipal: (source: TestPrincipalSource) =>
          bindings.get(source),
      },
    );

    return {
      bindings,
      find,
      findByID,
      gateway,
      requestObservers,
      requests,
      trust(principal: PortalPrincipal): TestPrincipalSource {
        const source = Object.freeze({ opaque: crypto.randomUUID() });
        bindings.set(source, principal);
        return source;
      },
    };
  }

  describe('private portal capability composition', () => {
    it('keeps fixed Payload arguments and narrow projections for trusted Owner and Client calls', async () => {
      const harness = createPrivatePortalHarness();
      const ownerResult = await harness.gateway.listClientSummaries(
        harness.trust(owner),
      );
      const clientResult = await harness.gateway.readOwnClientProfile(
        harness.trust(client),
      );

      expect(ownerResult).toEqual([
        {
          clientNumber: 'CL-7F4K-92MX',
          firstName: 'Ada',
          id: 101,
          lastName: 'Lovelace',
          status: 'active',
        },
        {
          clientNumber: 'CL-8G5M-93NX',
          firstName: 'Grace',
          id: 202,
          lastName: 'Hopper',
          status: 'active',
        },
      ]);
      expect(clientResult).toEqual({
        clientNumber: 'CL-7F4K-92MX',
        contactEmail: 'client-a@example.test',
        firstName: 'Ada',
        id: 101,
        lastName: 'Lovelace',
        status: 'active',
      });
      expect(JSON.stringify(ownerResult)).not.toContain('secretTaxValue');
      expect(JSON.stringify(ownerResult)).not.toContain('relatedClient');
      expect(harness.find).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'clients',
          depth: 0,
          overrideAccess: false,
          select: {
            clientNumber: true,
            firstName: true,
            lastName: true,
            status: true,
          },
        }),
      );
      expect(harness.find.mock.calls[0]?.[0]).not.toHaveProperty('req');
      expect(harness.findByID).toHaveBeenCalledWith(
        expect.objectContaining({
          depth: 0,
          id: 101,
          overrideAccess: false,
          select: {
            clientNumber: true,
            contactEmail: true,
            firstName: true,
            lastName: true,
            status: true,
          },
        }),
      );
    });

    it('denies parsed, frozen, serialized, reconstructed, enrollment, and unassigned sources', async () => {
      const harness = createPrivatePortalHarness();
      const genuineOwnerSource = harness.trust(owner);

      for (const fake of [
        owner,
        Object.freeze({ ...owner }),
        JSON.parse(JSON.stringify(genuineOwnerSource)),
        JSON.parse(JSON.stringify(owner)),
        { ...client },
      ]) {
        await expect(
          harness.gateway.listClientSummaries(fake as never),
        ).rejects.toMatchObject({ code: 'invalid-principal' });
      }

      await expect(
        harness.gateway.listClientSummaries(harness.trust(enrollment)),
      ).rejects.toMatchObject({ code: 'invalid-principal' });
      await expect(
        harness.gateway.listClientSummaries(harness.trust(caseWorker)),
      ).rejects.toMatchObject({ code: 'assignment-required' });
      expect(harness.find).not.toHaveBeenCalled();
    });

    it('rejects caller ownership/assignment arguments and exact-user/request substitution', async () => {
      const harness = createPrivatePortalHarness();
      const clientSource = harness.trust(client);

      await expect(
        (
          harness.gateway.readOwnClientProfile as unknown as (
            source: TestPrincipalSource,
            clientId: number,
          ) => Promise<unknown>
        )(clientSource, 202),
      ).rejects.toMatchObject({ code: 'invalid-principal' });
      await expect(
        (
          harness.gateway.listClientSummaries as unknown as (
            source: TestPrincipalSource,
            assignment: object,
          ) => Promise<unknown>
        )(harness.trust(caseWorker), { assignedStaffIds: [22] }),
      ).rejects.toMatchObject({ code: 'invalid-principal' });

      harness.requestObservers.push((req) => {
        expect(resolveAttestedPortalRequest(req)?.principal).toEqual(client);
        expect(
          resolveAttestedPortalRequest({ ...req, context: req.context }),
        ).toBeUndefined();
        expect(
          resolveAttestedPortalRequest({
            context: req.context,
            user: { ...(req.user as object), extra: true },
          }),
        ).toBeUndefined();
        expect(
          resolveAttestedPortalRequest({
            context: JSON.parse(JSON.stringify(req.context)),
            user: req.user,
          }),
        ).toBeUndefined();
      });

      await harness.gateway.readOwnClientProfile(clientSource);
      const retainedRequest = harness.requests[0];
      if (!retainedRequest) throw new Error('Missing retained request');
      expect(resolveAttestedPortalRequest(retainedRequest)).toBeUndefined();
    });

    it('revokes capabilities in finally and creates fresh request isolation state', async () => {
      const harness = createPrivatePortalHarness();
      const source = harness.trust(owner);
      await harness.gateway.listClientSummaries(source);
      await harness.gateway.listClientSummaries(source);

      const first = harness.requests[0];
      const second = harness.requests[1];
      if (!first || !second) throw new Error('Missing requests');
      expect(first).not.toBe(second);
      expect(first.context).not.toBe(second.context);
      expect(first.payloadDataLoader).not.toBe(second.payloadDataLoader);
      expect(Object.values(first.context as object)[0]).not.toBe(
        Object.values(second.context as object)[0],
      );
      expect(resolveAttestedPortalRequest(first)).toBeUndefined();
      expect(resolveAttestedPortalRequest(second)).toBeUndefined();

      let failedRequest: Record<string, unknown> | undefined;
      const failingGateway = composePortalPayloadGatewayWithPrincipalResolver(
        {
          find: vi.fn(async (options: Record<string, unknown>) => {
            failedRequest = {
              context: { ...(options.context as Record<string, unknown>) },
              user: options.user,
            };
            expect(resolveAttestedPortalRequest(failedRequest)).toBeDefined();
            throw new Error('persistence unavailable');
          }),
          findByID: vi.fn(),
        } as unknown as Pick<Payload, 'find' | 'findByID'>,
        { resolveCanonicalPrincipal: () => owner },
      );
      await expect(
        failingGateway.listClientSummaries({ opaque: 'private-source' }),
      ).rejects.toThrow('persistence unavailable');
      expect(resolveAttestedPortalRequest(failedRequest)).toBeUndefined();
    });

    it('preserves the token through Payload createLocalReq but rejects a copied request', async () => {
      const { createLocalReq } = await import('payload');
      let actualRequest: Awaited<ReturnType<typeof createLocalReq>> | undefined;
      let copiedRequestRejected = false;
      const fakePayload = {
        config: {
          admin: { user: 'cms-users' },
          localization: false,
          serverURL: 'http://localhost:3001',
        },
      } as unknown as Payload;
      const payloadPort = {
        find: vi.fn(async (options: Record<string, unknown>) => {
          actualRequest = await createLocalReq(
            {
              context: options.context as never,
              depth: 0,
              req: {
                i18n: { t: (key: string) => key },
                payloadDataLoader: new Map(),
              } as never,
              user: options.user as never,
            },
            fakePayload,
          );
          expect(resolveAttestedPortalRequest(actualRequest)).toBeDefined();

          const copiedRequest = await createLocalReq(
            {
              context: options.context as never,
              depth: 0,
              req: {
                i18n: { t: (key: string) => key },
                payloadDataLoader: new Map(),
              } as never,
              user: options.user as never,
            },
            fakePayload,
          );
          copiedRequestRejected =
            resolveAttestedPortalRequest(copiedRequest) === undefined;
          return { docs: [] };
        }),
        findByID: vi.fn(),
      };
      const gateway = composePortalPayloadGatewayWithPrincipalResolver(
        payloadPort as unknown as Pick<Payload, 'find' | 'findByID'>,
        { resolveCanonicalPrincipal: () => owner },
      );

      await gateway.listClientSummaries({ opaque: 'private-source' });
      expect(copiedRequestRejected).toBe(true);
      expect(resolveAttestedPortalRequest(actualRequest)).toBeUndefined();
    });
  });
}
