import 'server-only';

import { auth } from './runtime';
import { createStaffMfaAssuranceReader } from './mfa-assurance-reader';

export type {
  StaffMfaAssurance,
  StaffMfaEvidence,
} from './mfa-assurance-reader';

export const readStaffMfaAssurance = createStaffMfaAssuranceReader(auth);
