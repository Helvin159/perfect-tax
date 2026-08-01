import { describe, expect, it } from 'vitest';

import {
  accessCmsAdminPanel,
  createCmsUser,
  deleteCmsUser,
  manageCmsUserRole,
  readCmsUser,
  updateCmsUser,
} from './access';

const editor = {
  collection: 'cms-users',
  id: 12,
  role: 'editor',
};
const administrator = {
  collection: 'cms-users',
  id: 41,
  role: 'cms-admin',
};

function accessArgs(user: unknown) {
  return { req: { user } } as never;
}

describe('CmsUsers access control', () => {
  it('rejects anonymous and non-CMS identities from CMS administration', () => {
    expect(accessCmsAdminPanel(accessArgs(null))).toBe(false);
    expect(
      accessCmsAdminPanel(
        accessArgs({ collection: 'portal-users', id: 1, role: 'cms-admin' }),
      ),
    ).toBe(false);
    expect(readCmsUser(accessArgs(null))).toBe(false);
    expect(updateCmsUser(accessArgs(null))).toBe(false);
    expect(createCmsUser(accessArgs(null))).toBe(false);
  });

  it('limits editors to reading and updating their own profile', () => {
    expect(accessCmsAdminPanel(accessArgs(editor))).toBe(true);
    expect(readCmsUser(accessArgs(editor))).toEqual({
      id: { equals: editor.id },
    });
    expect(updateCmsUser(accessArgs(editor))).toEqual({
      id: { equals: editor.id },
    });
    expect(createCmsUser(accessArgs(editor))).toBe(false);
    expect(deleteCmsUser(accessArgs(editor))).toBe(false);
    expect(manageCmsUserRole(accessArgs(editor))).toBe(false);
  });

  it('allows administrators to provision users but not delete themselves', () => {
    expect(createCmsUser(accessArgs(administrator))).toBe(true);
    expect(readCmsUser(accessArgs(administrator))).toBe(true);
    expect(updateCmsUser(accessArgs(administrator))).toBe(true);
    expect(manageCmsUserRole(accessArgs(administrator))).toBe(true);
    expect(deleteCmsUser(accessArgs(administrator))).toEqual({
      id: { not_equals: administrator.id },
    });
  });
});
