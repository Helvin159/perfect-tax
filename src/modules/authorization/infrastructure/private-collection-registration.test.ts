import type { CollectionConfig, Field } from 'payload';
import { describe, expect, it } from 'vitest';

import { CLIENT_POLICY_FIELDS } from '@/modules/authorization/policies';
import { CMS_USER_ROLES } from '@/modules/cms/users/roles';
import { denyPortalIdentityDelete } from '@/modules/portal-identity/infrastructure/portal-identity-collection';

import {
  portalClientCollectionAccess,
  portalClientFieldAccess,
} from './portal-payload-gateway';
import {
  authorizePrivateStaffRead,
  PRIVATE_OPERATIONAL_COLLECTIONS,
  PrivateClients,
  PrivatePortalIdentities,
  PrivateSecurityEvents,
  PrivateStaff,
} from './private-collection-registration';

const accessOperations = [
  'admin',
  'create',
  'delete',
  'read',
  'update',
] as const;

async function accessDecision(
  collection: CollectionConfig,
  operation: (typeof accessOperations)[number],
  request: Readonly<{ context: unknown; user: unknown }>,
) {
  const access = collection.access?.[operation];
  if (typeof access !== 'function') {
    throw new Error(`${collection.slug}.${operation} access is not explicit.`);
  }

  return access({ req: request } as never);
}

function namedFields(
  collection: CollectionConfig,
): Array<Field & { name: string }> {
  return collection.fields.filter(
    (field): field is Field & { name: string } => 'name' in field,
  );
}

describe('private operational collection registration', () => {
  it('registers only the four approved Slice 1 slugs in stable order', () => {
    expect(PRIVATE_OPERATIONAL_COLLECTIONS.map(({ slug }) => slug)).toEqual([
      'staff',
      'clients',
      'portal-identities',
      'security-events',
    ]);

    for (const deferred of [
      'cases',
      'documents',
      'assignments',
      'messages',
      'appointments',
      'payments',
      'notifications',
      'invitations',
    ]) {
      expect(
        PRIVATE_OPERATIONAL_COLLECTIONS.some(({ slug }) => slug === deferred),
      ).toBe(false);
    }
  });

  it('keeps every private collection non-authenticating, hidden, and outside GraphQL', () => {
    for (const collection of PRIVATE_OPERATIONAL_COLLECTIONS) {
      expect(collection.auth).toBeUndefined();
      expect(collection.admin?.hidden).toBe(true);
      expect(collection.graphQL).toBe(false);
    }
  });

  it.each(CMS_USER_ROLES)(
    'denies every explicit operation to the %s CMS role',
    async (role) => {
      const request = {
        context: {},
        user: { collection: 'cms-users', id: `cms-${role}`, role },
      };

      for (const collection of PRIVATE_OPERATIONAL_COLLECTIONS) {
        for (const operation of accessOperations) {
          await expect(
            accessDecision(collection, operation, request),
          ).resolves.toBe(false);
        }
      }
    },
  );

  it.each([
    {
      actor: 'anonymous',
      request: { context: {}, user: null },
    },
    {
      actor: 'fake Staff user',
      request: {
        context: {},
        user: {
          collection: 'portal-principals',
          id: 'staff:11',
          kind: 'staff',
          role: 'owner',
          staffId: 11,
        },
      },
    },
    {
      actor: 'fake Client user',
      request: {
        context: {},
        user: {
          clientId: 101,
          collection: 'portal-principals',
          id: 'client:101',
          kind: 'client',
        },
      },
    },
    {
      actor: 'enrollment principal',
      request: {
        context: {},
        user: {
          collection: 'portal-principals',
          id: 'staff:11',
          kind: 'staff-enrollment',
          staffId: 11,
        },
      },
    },
    {
      actor: 'fake Agent 10 context',
      request: {
        context: {
          portalPayloadCapability: {},
          portalPrincipal: {
            kind: 'staff',
            role: 'owner',
            staffId: 11,
          },
          trusted: true,
        },
        user: {
          collection: 'portal-principals',
          id: 'staff:11',
          kind: 'staff',
          role: 'owner',
          staffId: 11,
        },
      },
    },
  ])(
    'denies $actor across the registered access matrix',
    async ({ request }) => {
      for (const collection of PRIVATE_OPERATIONAL_COLLECTIONS) {
        for (const operation of accessOperations) {
          await expect(
            accessDecision(collection, operation, request),
          ).resolves.toBe(false);
        }
      }
    },
  );

  it('composes Client read from Agent 10 and denies all Client mutations', async () => {
    expect(PrivateClients.access?.read).toBe(portalClientCollectionAccess.read);
    expect(PrivateClients.access?.create).toBe(
      portalClientCollectionAccess.create,
    );
    expect(PrivateClients.access?.update).toBe(
      portalClientCollectionAccess.update,
    );
    expect(PrivateClients.access?.delete).toBe(
      portalClientCollectionAccess.delete,
    );

    for (const field of namedFields(PrivateClients)) {
      if (!('access' in field)) {
        throw new Error(`Missing Client field access for ${field.name}.`);
      }
      expect(field.access?.read).toBe(portalClientFieldAccess.read);
      expect(field.access?.create).toBe(portalClientFieldAccess.create);
      expect(field.access?.update).toBe(portalClientFieldAccess.update);
    }
  });

  it('composes Staff read through Agent 10 attestation and Agent 8 policy only', () => {
    expect(PrivateStaff.access?.read).toBe(authorizePrivateStaffRead);
    expect(PrivateStaff.access?.create).not.toBe(authorizePrivateStaffRead);
    expect(PrivateStaff.access?.update).not.toBe(authorizePrivateStaffRead);
    expect(PrivateStaff.access?.delete).not.toBe(authorizePrivateStaffRead);
  });

  it('keeps Agent 8 Client field vocabulary within the registered schema', () => {
    const registeredFields = new Set([
      'id',
      'createdAt',
      'updatedAt',
      ...namedFields(PrivateClients).map(({ name }) => name),
    ]);

    expect(
      CLIENT_POLICY_FIELDS.every((field) => registeredFields.has(field)),
    ).toBe(true);
    expect(CLIENT_POLICY_FIELDS).not.toEqual(
      expect.arrayContaining(['phone', 'authUserId', 'portalIdentity']),
    );
  });

  it('preserves owner, binding, and append-only invariant hooks under bypass', async () => {
    const staffHook = PrivateStaff.hooks?.beforeChange?.[0];
    if (typeof staffHook !== 'function') {
      throw new Error('Missing Staff invariant hook.');
    }

    await expect(
      staffHook({
        context: { portalSystemCapability: {} },
        data: {
          firstName: 'Primary',
          isPrimaryOwner: true,
          lastName: 'Owner',
          role: 'owner',
          status: 'active',
          workEmail: 'owner@example.test',
        },
        operation: 'create',
        req: {
          context: { portalSystemCapability: {} },
        },
      } as never),
    ).rejects.toThrow('system bootstrap capability');

    expect(PrivatePortalIdentities.hooks?.beforeDelete).toContain(
      denyPortalIdentityDelete,
    );
    expect(PrivateSecurityEvents.hooks?.beforeChange).toHaveLength(1);
    expect(PrivateSecurityEvents.hooks?.beforeDelete).toHaveLength(1);
  });
});
