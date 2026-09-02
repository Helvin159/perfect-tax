import 'server-only';

import type {
  CollectionSlug,
  Payload,
  PayloadRequest,
  RequestContext,
} from 'payload';
import { createLocalReq } from 'payload';

import type { BootstrapCredential } from '@/modules/auth/bootstrap';
import type {
  AuthUserId,
  StaffId,
} from '@/modules/portal-identity/domain/identifiers';
import {
  parseAuthUserId,
  parseStaffId,
} from '@/modules/portal-identity/domain/identifiers';
import { isRecord } from '@/modules/portal-identity/domain/validation';
import {
  PORTAL_IDENTITIES_SLUG,
  type PortalIdentityPersistenceRecord,
} from '@/modules/portal-identity/infrastructure/portal-identity-collection';
import { SECURITY_EVENTS_SLUG } from '@/modules/audit/infrastructure/security-events-collection';
import { verifyOperationalDatabaseContract } from '@/modules/database/operational-schema-verification';

import { STAFF_COLLECTION_SLUG } from '../domain/invariants';
import {
  PRIMARY_OWNER_BOOTSTRAP_ENVIRONMENT_KEYS,
  PrimaryOwnerBootstrapError,
  type PrimaryOwnerBootstrapInput,
} from './primary-owner-bootstrap';

const PRIMARY_OWNER_BOOTSTRAP_ADVISORY_LOCK = 1_617_731_881;

type QueryClient = Readonly<{
  query(text: string, values: readonly number[]): Promise<unknown>;
  release(): void;
}>;

type BootstrapPayload = Payload & {
  db: Payload['db'] & {
    pool: Readonly<{ connect(): Promise<QueryClient> }>;
  };
};

export type PendingPrimaryOwnerPersistence = Readonly<{
  auditRequest: PayloadRequest;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  staffId: StaffId;
}>;

function registered(payload: Payload, slug: string): boolean {
  return (
    isRecord(payload.collections) && Object.hasOwn(payload.collections, slug)
  );
}

/**
 * Agent 13 must register all three private collections. Agent 14 must then
 * replace the final fail-closed branch only after reviewed constraints,
 * transaction behavior, and the physical schema decision are deployed.
 */
export async function assertPrimaryOwnerBootstrapRuntimeReady(
  payload: Payload,
): Promise<void> {
  if (
    !registered(payload, STAFF_COLLECTION_SLUG) ||
    !registered(payload, PORTAL_IDENTITIES_SLUG) ||
    !registered(payload, SECURITY_EVENTS_SLUG)
  ) {
    throw new PrimaryOwnerBootstrapError('NOT_READY');
  }

  try {
    await verifyOperationalDatabaseContract(
      (payload as BootstrapPayload).db.pool,
    );
  } catch {
    throw new PrimaryOwnerBootstrapError('NOT_READY');
  }
}

export async function loadPrimaryOwnerBootstrapPayload(): Promise<BootstrapPayload> {
  if (process.env.NODE_ENV !== 'production') {
    try {
      process.loadEnvFile('.env');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  delete process.env[PRIMARY_OWNER_BOOTSTRAP_ENVIRONMENT_KEYS.password];

  const [{ getPayload }, { default: config }] = await Promise.all([
    import('payload'),
    import('@payload-config'),
  ]);
  const payload = (await getPayload({ config })) as BootstrapPayload;
  try {
    await assertPrimaryOwnerBootstrapRuntimeReady(payload);
  } catch (error) {
    await payload.destroy();
    throw error;
  }
  return payload;
}

export async function withPrimaryOwnerBootstrapSerialization<T>(
  payload: BootstrapPayload,
  operation: () => Promise<T>,
): Promise<T> {
  const lockClient = await payload.db.pool.connect();

  try {
    await lockClient.query('SELECT pg_advisory_lock($1)', [
      PRIMARY_OWNER_BOOTSTRAP_ADVISORY_LOCK,
    ]);
    return await operation();
  } finally {
    try {
      await lockClient.query('SELECT pg_advisory_unlock($1)', [
        PRIMARY_OWNER_BOOTSTRAP_ADVISORY_LOCK,
      ]);
    } finally {
      lockClient.release();
    }
  }
}

type PrimaryOwnerCount = (
  options: Readonly<{
    collection: CollectionSlug;
    overrideAccess: true;
    req?: PayloadRequest;
    where: Readonly<{
      or: readonly [
        Readonly<{ isPrimaryOwner: Readonly<{ equals: true }> }>,
        Readonly<{ role: Readonly<{ equals: 'owner' }> }>,
      ];
    }>;
  }>,
) => Promise<Readonly<{ totalDocs: unknown }>>;

export async function primaryOwnerAlreadyExists(
  payload: Payload,
  req?: PayloadRequest,
): Promise<boolean> {
  const count = payload.count.bind(payload) as unknown as PrimaryOwnerCount;
  const result = await count({
    collection: STAFF_COLLECTION_SLUG as CollectionSlug,
    overrideAccess: true,
    ...(req === undefined ? {} : { req }),
    where: {
      or: [{ isPrimaryOwner: { equals: true } }, { role: { equals: 'owner' } }],
    },
  });

  if (!Number.isSafeInteger(result.totalDocs) || Number(result.totalDocs) < 0) {
    throw new PrimaryOwnerBootstrapError('BOOTSTRAP_FAILED');
  }
  return Number(result.totalDocs) > 0;
}

export async function createPrimaryOwnerBootstrapPayloadRequest(
  payload: Payload,
): Promise<PayloadRequest> {
  return createLocalReq({}, payload);
}

type StaffCreate = (
  options: Readonly<{
    collection: CollectionSlug;
    context: RequestContext;
    data: Readonly<{
      firstName: string;
      isPrimaryOwner: true;
      lastName: string;
      role: 'owner';
      status: 'active';
      workEmail: string;
    }>;
    depth: 0;
    overrideAccess: true;
    req: PayloadRequest;
  }>,
) => Promise<unknown>;

type PortalIdentityCreate = (
  options: Readonly<{
    collection: CollectionSlug;
    context: RequestContext;
    data: PortalIdentityPersistenceRecord;
    depth: 0;
    overrideAccess: true;
    req: PayloadRequest;
  }>,
) => Promise<unknown>;

type StaffFindByID = (
  options: Readonly<{
    collection: CollectionSlug;
    depth: 0;
    id: StaffId;
    overrideAccess: true;
    req: PayloadRequest;
    select: Readonly<{
      id: true;
      isPrimaryOwner: true;
      role: true;
      status: true;
    }>;
    showHiddenFields: true;
  }>,
) => Promise<unknown>;

function relationshipId(value: unknown): unknown {
  return isRecord(value) ? value.id : value;
}

function parseCreatedStaffId(value: unknown): StaffId {
  if (!isRecord(value)) {
    throw new PrimaryOwnerBootstrapError('BOOTSTRAP_FAILED');
  }
  const staffId = parseStaffId(value.id);
  if (!staffId) throw new PrimaryOwnerBootstrapError('BOOTSTRAP_FAILED');
  return staffId;
}

/**
 * The Staff create response is intentionally a public-shaped projection and
 * therefore omits the server-owned primary-owner marker. Bootstrap must prove
 * the persisted state through this exact, transaction-bound internal read.
 */
async function verifyPersistedPrimaryOwner(
  payload: Payload,
  req: PayloadRequest,
  staffId: StaffId,
): Promise<void> {
  const findByID = payload.findByID.bind(payload) as unknown as StaffFindByID;
  const persisted = await findByID({
    collection: STAFF_COLLECTION_SLUG as CollectionSlug,
    depth: 0,
    id: staffId,
    overrideAccess: true,
    req,
    select: {
      id: true,
      isPrimaryOwner: true,
      role: true,
      status: true,
    },
    showHiddenFields: true,
  });

  if (
    !isRecord(persisted) ||
    parseStaffId(persisted.id) !== staffId ||
    persisted.role !== 'owner' ||
    persisted.status !== 'active' ||
    persisted.isPrimaryOwner !== true
  ) {
    throw new PrimaryOwnerBootstrapError('BOOTSTRAP_FAILED');
  }
}

function assertCreatedPortalIdentity(
  value: unknown,
  authUserId: AuthUserId,
  staffId: StaffId,
): void {
  if (
    !isRecord(value) ||
    parseAuthUserId(value.authUserId) !== authUserId ||
    value.subjectType !== 'staff' ||
    parseStaffId(relationshipId(value.staff)) !== staffId ||
    (value.client !== undefined && value.client !== null)
  ) {
    throw new PrimaryOwnerBootstrapError('BOOTSTRAP_FAILED');
  }
}

export async function preparePrimaryOwnerPersistence(
  payload: Payload,
  req: PayloadRequest,
  context: RequestContext,
  input: PrimaryOwnerBootstrapInput,
  credential: BootstrapCredential,
): Promise<PendingPrimaryOwnerPersistence> {
  req.context = context;
  const transactionID = await payload.db.beginTransaction();
  if (!transactionID) {
    throw new PrimaryOwnerBootstrapError('NOT_READY');
  }
  req.transactionID = transactionID;

  let settled = false;
  const rollback = async () => {
    if (settled) return;
    try {
      await payload.db.rollbackTransaction(transactionID);
    } finally {
      settled = true;
      delete req.transactionID;
    }
  };
  const commit = async () => {
    if (settled) throw new PrimaryOwnerBootstrapError('BOOTSTRAP_FAILED');
    try {
      await payload.db.commitTransaction(transactionID);
      settled = true;
      delete req.transactionID;
    } catch {
      await rollback();
      throw new PrimaryOwnerBootstrapError('BOOTSTRAP_FAILED');
    }
  };

  try {
    if (await primaryOwnerAlreadyExists(payload, req)) {
      throw new PrimaryOwnerBootstrapError('ALREADY_COMPLETED');
    }

    const createStaff = payload.create.bind(payload) as unknown as StaffCreate;
    const createdStaff = await createStaff({
      collection: STAFF_COLLECTION_SLUG as CollectionSlug,
      context,
      data: {
        firstName: input.firstName,
        isPrimaryOwner: true,
        lastName: input.lastName,
        role: 'owner',
        status: 'active',
        workEmail: input.workEmail,
      },
      depth: 0,
      overrideAccess: true,
      req,
    });
    const staffId = parseCreatedStaffId(createdStaff);
    await verifyPersistedPrimaryOwner(payload, req, staffId);

    const createPortalIdentity = payload.create.bind(
      payload,
    ) as unknown as PortalIdentityCreate;
    const createdIdentity = await createPortalIdentity({
      collection: PORTAL_IDENTITIES_SLUG as CollectionSlug,
      context,
      data: {
        authUserId: credential.authUserId,
        staff: staffId,
        subjectType: 'staff',
      },
      depth: 0,
      overrideAccess: true,
      req,
    });
    assertCreatedPortalIdentity(
      createdIdentity,
      credential.authUserId,
      staffId,
    );

    return Object.freeze({ auditRequest: req, commit, rollback, staffId });
  } catch (error) {
    try {
      await rollback();
    } catch {
      throw new PrimaryOwnerBootstrapError('BOOTSTRAP_FAILED');
    }
    throw error instanceof PrimaryOwnerBootstrapError
      ? error
      : new PrimaryOwnerBootstrapError('BOOTSTRAP_FAILED');
  }
}

export async function provisionPrimaryOwnerBootstrapCredential<T>(
  input: PrimaryOwnerBootstrapInput,
  finalize: (credential: BootstrapCredential) => Promise<T>,
): Promise<T> {
  const { provisionBootstrapCredential } =
    await import('@/modules/auth/bootstrap');
  return provisionBootstrapCredential(
    {
      email: input.loginEmail,
      name: `${input.firstName} ${input.lastName}`,
      password: input.password,
    },
    finalize,
  );
}
