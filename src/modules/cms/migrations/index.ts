import * as migration_20260718_213559_initial_cms from './20260718_213559_initial_cms';
import * as migration_20260718_223444_task_5_public_content from './20260718_223444_task_5_public_content';

export const migrations = [
  {
    up: migration_20260718_213559_initial_cms.up,
    down: migration_20260718_213559_initial_cms.down,
    name: '20260718_213559_initial_cms',
  },
  {
    up: migration_20260718_223444_task_5_public_content.up,
    down: migration_20260718_223444_task_5_public_content.down,
    name: '20260718_223444_task_5_public_content',
  },
];
