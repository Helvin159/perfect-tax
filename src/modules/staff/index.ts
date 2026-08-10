export {
  createStaffCollection,
  denyStaffAccess,
  denyStaffAdminAccess,
  denyStaffFieldAccess,
  Staff,
  validateStaffRoleField,
  validateStaffStatusField,
} from './collection';
export {
  createEnforceStaffInvariants,
  enforceStaffDeleteInvariant,
  enforceStaffDeletion,
  enforceStaffMutation,
  STAFF_COLLECTION_SLUG,
  type AuthorizePrimaryOwnerBootstrap,
  type PrimaryOwnerBootstrapAuthorizationArgs,
  type StaffInvariantOptions,
  type StaffPersistenceRecord,
} from './domain/invariants';
export {
  normalizeWorkEmail,
  normalizeWorkEmailField,
  validateWorkEmail,
} from './domain/work-email';
