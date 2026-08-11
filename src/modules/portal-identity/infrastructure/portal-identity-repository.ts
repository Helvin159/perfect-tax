import 'server-only';

import type { Payload } from 'payload';

import {
  parseClientId,
  parseStaffId,
  type AuthUserId,
  type ClientId,
  type StaffId,
} from '../domain/identifiers';
import {
  parsePortalIdentity,
  type PortalIdentity,
} from '../domain/portal-identity';
import { isRecord } from '../domain/validation';
import { PORTAL_IDENTITIES_SLUG } from './portal-identity-collection';

export interface PortalIdentityRepository {
  findByAuthUserId(authUserId: AuthUserId): Promise<PortalIdentity | null>;
  findByClientId(clientId: ClientId): Promise<PortalIdentity | null>;
  findByStaffId(staffId: StaffId): Promise<PortalIdentity | null>;
}

export class PortalIdentityPersistenceError extends Error {
  constructor(
    public readonly code: 'duplicate-binding' | 'invalid-persisted-binding',
  ) {
    super(`PortalIdentity persistence invariant violated: ${code}`);
    this.name = 'PortalIdentityPersistenceError';
  }
}

type FindResult = Readonly<{ docs: readonly unknown[] }>;
type PortalIdentityFind = (
  options: Readonly<{
    collection: typeof PORTAL_IDENTITIES_SLUG;
    depth: 0;
    limit: 2;
    overrideAccess: true;
    select: Readonly<{
      authUserId: true;
      client: true;
      staff: true;
      subjectType: true;
    }>;
    where: Readonly<Record<string, Readonly<{ equals: string | number }>>>;
  }>,
) => Promise<FindResult>;

function relationshipId(value: unknown): unknown {
  return isRecord(value) ? value.id : value;
}

function mapPersistedBinding(value: unknown): PortalIdentity {
  if (!isRecord(value)) {
    throw new PortalIdentityPersistenceError('invalid-persisted-binding');
  }

  const authUserId = value.authUserId;
  const staffValue = relationshipId(value.staff);
  const clientValue = relationshipId(value.client);
  const hasStaff = staffValue !== undefined && staffValue !== null;
  const hasClient = clientValue !== undefined && clientValue !== null;

  if (hasStaff === hasClient) {
    throw new PortalIdentityPersistenceError('invalid-persisted-binding');
  }

  if (value.subjectType === 'staff') {
    if (hasClient) {
      throw new PortalIdentityPersistenceError('invalid-persisted-binding');
    }
    const staffId = parseStaffId(staffValue);
    const binding = parsePortalIdentity({
      authUserId,
      staffId,
      subjectKind: 'staff',
    });
    if (binding) return binding;
  }

  if (value.subjectType === 'client') {
    if (hasStaff) {
      throw new PortalIdentityPersistenceError('invalid-persisted-binding');
    }
    const clientId = parseClientId(clientValue);
    const binding = parsePortalIdentity({
      authUserId,
      clientId,
      subjectKind: 'client',
    });
    if (binding) return binding;
  }

  throw new PortalIdentityPersistenceError('invalid-persisted-binding');
}

/**
 * Server-only read adapter returning only Agent 2's frozen binding data. It
 * intentionally exposes no create, update, delete, email, role, or principal
 * projection capability.
 */
export function createPayloadPortalIdentityRepository(
  payload: Pick<Payload, 'find'>,
): PortalIdentityRepository {
  const find = payload.find.bind(payload) as unknown as PortalIdentityFind;

  const findOne = async (
    where: Readonly<Record<string, Readonly<{ equals: string | number }>>>,
  ): Promise<PortalIdentity | null> => {
    const result = await find({
      collection: PORTAL_IDENTITIES_SLUG,
      depth: 0,
      limit: 2,
      overrideAccess: true,
      select: {
        authUserId: true,
        client: true,
        staff: true,
        subjectType: true,
      },
      where,
    });

    if (result.docs.length > 1) {
      throw new PortalIdentityPersistenceError('duplicate-binding');
    }

    return result.docs[0] === undefined
      ? null
      : mapPersistedBinding(result.docs[0]);
  };

  return Object.freeze({
    findByAuthUserId: (authUserId: AuthUserId) =>
      findOne({ authUserId: { equals: authUserId } }),
    findByClientId: (clientId: ClientId) =>
      findOne({ client: { equals: clientId } }),
    findByStaffId: (staffId: StaffId) =>
      findOne({ staff: { equals: staffId } }),
  });
}
