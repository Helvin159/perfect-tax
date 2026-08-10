import 'server-only';

import { betterAuth } from 'better-auth';
import { Pool } from 'pg';

import { getPortalAuthEnvironment } from './config/environment';
import { createPortalAuthOptions } from './config/options';
import { PORTAL_AUTH_SCHEMA } from './config/policy';

const environment = getPortalAuthEnvironment();

const pool = new Pool({
  application_name: 'operational-portal-auth',
  connectionString: environment.databaseURL,
  options: `-c search_path=${PORTAL_AUTH_SCHEMA},public`,
});

export const auth = betterAuth(
  createPortalAuthOptions({
    baseURL: environment.baseURL,
    database: pool,
    secret: environment.secret,
    secureCookies: environment.secureCookies,
  }),
);
