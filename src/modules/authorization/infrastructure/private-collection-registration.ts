import 'server-only';

import type { Access, CollectionConfig, Field } from 'payload';

import { SecurityEvents } from '@/modules/audit/infrastructure/security-events-collection';
import { createAuthorizationPolicies } from '@/modules/authorization/policies';
import { Clients } from '@/modules/clients/collection';
import { PortalIdentities } from '@/modules/portal-identity/infrastructure/portal-identity-collection';
import { createStaffCollection } from '@/modules/staff/collection';

import {
  portalClientCollectionAccess,
  portalClientFieldAccess,
  resolveAttestedPortalRequest,
} from './portal-payload-gateway';
import { authorizePrimaryOwnerBootstrapRequest } from './system-payload-gateway';

export const denyPrivateCollectionAdminAccess = () => false;

/**
 * Staff has no Slice 1 gateway method, but any future nested/read operation on
 * an already attested request must still run Agent 8 policy. Owner and
 * Administrator reads pass; self-scoped Staff reads remain closed until a
 * trusted Staff target-evidence composition exists.
 */
export const authorizePrivateStaffRead: Access = ({ req }) => {
  const attested = resolveAttestedPortalRequest(req);
  if (!attested) return false;

  const policies = createAuthorizationPolicies({
    isTrustedAssignmentEvidence: () => false,
    isTrustedOwnershipEvidence: () => false,
    isTrustedPrincipal: (principal) => principal === attested.principal,
    isTrustedStaffCreationEvidence: () => false,
    isTrustedStaffResourceEvidence: () => false,
  });

  return policies.decideStaffOperation(attested.principal, 'read').allowed;
};

function protectClientField(field: Field): Field {
  if (!('name' in field)) return field;

  return {
    ...field,
    access: portalClientFieldAccess,
  } as Field;
}

const staffCollection = createStaffCollection({
  authorizePrimaryOwnerBootstrap: authorizePrimaryOwnerBootstrapRequest,
});

/**
 * Slice 1 exposes no ordinary Staff collection operation. The sole privileged
 * create remains Agent 12's capability-bound bootstrap, which intentionally
 * uses `overrideAccess: true` and is independently constrained by Staff hooks.
 */
export const PrivateStaff: CollectionConfig = {
  ...staffCollection,
  access: {
    ...staffCollection.access,
    read: authorizePrivateStaffRead,
  },
  admin: {
    ...staffCollection.admin,
    hidden: true,
  },
};

/**
 * The raw Agent 5 schema deliberately owns no final access composition. This
 * registered variant grants only Agent 10's runtime-attested, Agent 8-policy
 * controlled read and denies every mutation and Admin operation.
 */
export const PrivateClients: CollectionConfig = {
  ...Clients,
  access: {
    admin: denyPrivateCollectionAdminAccess,
    ...portalClientCollectionAccess,
  },
  admin: {
    ...Clients.admin,
    hidden: true,
  },
  disableBulkDelete: true,
  fields: Clients.fields.map(protectClientField),
};

export const PrivatePortalIdentities: CollectionConfig = {
  ...PortalIdentities,
  access: {
    admin: denyPrivateCollectionAdminAccess,
    ...PortalIdentities.access,
  },
  admin: {
    ...PortalIdentities.admin,
    hidden: true,
  },
};

export const PrivateSecurityEvents: CollectionConfig = {
  ...SecurityEvents,
  access: {
    admin: denyPrivateCollectionAdminAccess,
    ...SecurityEvents.access,
  },
  admin: {
    ...SecurityEvents.admin,
    hidden: true,
  },
};

export const PRIVATE_OPERATIONAL_COLLECTIONS = [
  PrivateStaff,
  PrivateClients,
  PrivatePortalIdentities,
  PrivateSecurityEvents,
] as const satisfies readonly CollectionConfig[];
