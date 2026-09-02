import { getPayload } from 'payload';

import * as initialCms from '../../src/modules/cms/migrations/20260718_213559_initial_cms';
import * as publicContent from '../../src/modules/cms/migrations/20260718_223444_task_5_public_content';
import config from '../../payload.config';

const payload = await getPayload({ config });

let exitCode = 0;
try {
  await payload.db.migrate({
    migrations: [
      {
        down: initialCms.down,
        name: '20260718_213559_initial_cms',
        up: initialCms.up,
      },
      {
        down: publicContent.down,
        name: '20260718_223444_task_5_public_content',
        up: publicContent.up,
      },
    ] as never,
  });
} catch (error) {
  exitCode = 1;
  console.error(error);
} finally {
  // Payload 3.86 clears its adapter state but does not close the pg pool.
  // This helper is a one-shot child process, so exit only after the committed
  // migrations have settled and avoid leaving a test connection behind.
  await payload.destroy();
  process.exit(exitCode);
}
