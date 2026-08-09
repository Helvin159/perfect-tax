import path from 'node:path';

import { postgresAdapter } from '@payloadcms/db-postgres';
import { nodemailerAdapter } from '@payloadcms/email-nodemailer';
import { buildConfig } from 'payload';

import { getServerEnvironment } from './src/config/env/values';
import { PublicMedia } from './src/modules/content/public-media';
import { Services } from './src/modules/content/services';
import { CmsUsers } from './src/modules/cms/users/collection';
import { BusinessIdentity } from './src/modules/settings/business-identity';
import { ContactSettings } from './src/modules/settings/contact-settings';
import { HomepageContent } from './src/modules/settings/homepage-content';
import { PortalSettings } from './src/modules/settings/portal-settings';

const environment = getServerEnvironment();
const rootDirectory = process.cwd();

export const PAYLOAD_DATABASE_SCHEMA_PUSH = false;

export default buildConfig({
  admin: {
    importMap: {
      baseDir: rootDirectory,
    },
    routes: {
      createFirstUser: '/bootstrap-required',
      forgot: '/recovery-unavailable',
    },
    user: 'cms-users',
  },
  collections: [CmsUsers, Services, PublicMedia],
  db: postgresAdapter({
    migrationDir: path.resolve(rootDirectory, 'src/modules/cms/migrations'),
    pool: {
      connectionString: environment.DATABASE_URL,
    },
    push: PAYLOAD_DATABASE_SCHEMA_PUSH,
  }),
  email: nodemailerAdapter({
    defaultFromAddress: environment.EMAIL_ADDRESS,
    defaultFromName: environment.EMAIL_NAME,
    skipVerify: true,
    transportOptions: {
      auth: {
        pass: environment.EMAIL_PASSWORD,
        user: environment.EMAIL_ADDRESS,
      },
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
    },
  }),
  graphQL: {
    disable: true,
  },
  globals: [BusinessIdentity, ContactSettings, PortalSettings, HomepageContent],
  localization: {
    defaultLocale: 'en',
    fallback: false,
    locales: [
      { code: 'en', label: 'English' },
      { code: 'es', label: 'Español' },
    ],
  },
  routes: {
    admin: '/admin',
    api: '/api/cms',
  },
  secret: environment.PAYLOAD_SECRET,
  serverURL: environment.SITE_URL,
  typescript: {
    autoGenerate: false,
    outputFile: path.resolve(rootDirectory, 'src/modules/cms/payload-types.ts'),
  },
});
