import 'server-only';

import { createBootstrapCredentialProvisioner } from './bootstrap-credential-service';
import { auth } from './runtime';

export type {
  BootstrapCredential,
  BootstrapCredentialInput,
} from './bootstrap-credential-service';
export { BootstrapCredentialError } from './bootstrap-credential-service';

export const provisionBootstrapCredential =
  createBootstrapCredentialProvisioner(auth);
