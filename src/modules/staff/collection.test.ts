import type { Field } from 'payload';
import { describe, expect, it } from 'vitest';

import {
  STAFF_ROLES,
  STAFF_STATUSES,
} from '@/modules/portal-identity/domain/staff';

import {
  createStaffCollection,
  denyStaffAccess,
  denyStaffAdminAccess,
  denyStaffFieldAccess,
  Staff,
  validateStaffRoleField,
  validateStaffStatusField,
} from './collection';
import { enforceStaffMutation } from './domain/invariants';
import {
  normalizeWorkEmailField,
  validateWorkEmail,
} from './domain/work-email';

function dataField(name: string): Extract<Field, { name: string }> {
  const field = Staff.fields.find(
    (candidate): candidate is Extract<Field, { name: string }> =>
      'name' in candidate && candidate.name === name,
  );

  if (!field) throw new Error(`Missing Staff field: ${name}`);
  return field;
}

function optionValues(name: string): string[] {
  const field = dataField(name);
  if (field.type !== 'select') throw new Error(`${name} is not a select field`);

  return field.options.map((option) =>
    typeof option === 'string' ? option : option.value,
  );
}

describe('Staff collection persistence shape', () => {
  it('contains only the minimal Staff domain fields and Payload timestamps', () => {
    expect(Staff.slug).toBe('staff');
    expect(
      Staff.fields.map((field) => ('name' in field ? field.name : undefined)),
    ).toEqual([
      'firstName',
      'lastName',
      'workEmail',
      'role',
      'status',
      'isPrimaryOwner',
    ]);

    for (const name of [
      'firstName',
      'lastName',
      'workEmail',
      'role',
      'status',
    ]) {
      const field = dataField(name);
      expect('required' in field && field.required).toBe(true);
    }

    expect(Staff.timestamps).not.toBe(false);
  });

  it('contains no credential, provider, invitation, CMS, or case fields', () => {
    const fieldNames = new Set(
      Staff.fields.flatMap((field) => ('name' in field ? [field.name] : [])),
    );

    for (const forbidden of [
      'email',
      'loginEmail',
      'password',
      'passwordHash',
      'sessions',
      'totpSecret',
      'backupCodes',
      'betterAuthRole',
      'invitation',
      'cmsUser',
      'caseStatus',
    ]) {
      expect(fieldNames.has(forbidden)).toBe(false);
    }
  });

  it('uses exactly the frozen Staff roles and statuses', () => {
    expect(optionValues('role')).toEqual(STAFF_ROLES);
    expect(optionValues('status')).toEqual(STAFF_STATUSES);

    for (const role of STAFF_ROLES)
      expect(validateStaffRoleField(role)).toBe(true);
    for (const role of [
      'admin',
      'content-editor',
      'client',
      'OWNER',
      undefined,
    ]) {
      expect(validateStaffRoleField(role)).not.toBe(true);
    }

    for (const status of STAFF_STATUSES) {
      expect(validateStaffStatusField(status)).toBe(true);
    }
    for (const status of ['inactive', 'invited', 'pending', undefined]) {
      expect(validateStaffStatusField(status)).not.toBe(true);
    }
  });

  it('normalizes and uniquely indexes valid work email contact data', () => {
    expect(
      normalizeWorkEmailField({ value: '  PERSON@Example.COM  ' } as never),
    ).toBe('person@example.com');
    expect(validateWorkEmail('person@example.com')).toBe(true);
    expect(validateWorkEmail('not-an-email')).not.toBe(true);
    expect(validateWorkEmail(`${'a'.repeat(250)}@example.com`)).not.toBe(true);

    const workEmail = dataField('workEmail');
    expect(workEmail.type).toBe('email');
    expect('unique' in workEmail && workEmail.unique).toBe(true);
    expect('index' in workEmail && workEmail.index).toBe(true);
  });

  it('keeps the owner marker server-owned and all access fail-closed', async () => {
    const marker = dataField('isPrimaryOwner');
    expect(marker.type).toBe('checkbox');
    expect('defaultValue' in marker && marker.defaultValue).toBe(false);
    expect('access' in marker && marker.access).toBeDefined();
    expect(await denyStaffFieldAccess({} as never)).toBe(false);

    expect(await denyStaffAdminAccess()).toBe(false);
    expect(await denyStaffAccess({} as never)).toBe(false);
    expect(Staff.access).toMatchObject({
      admin: denyStaffAdminAccess,
      create: denyStaffAccess,
      delete: denyStaffAccess,
      read: denyStaffAccess,
      update: denyStaffAccess,
    });
  });

  it('supports ordinary non-owner Staff creation', () => {
    const data = {
      firstName: 'Ada',
      isPrimaryOwner: false,
      lastName: 'Lovelace',
      role: 'case-worker' as const,
      status: 'active' as const,
      workEmail: 'ada@example.com',
    };

    expect(enforceStaffMutation({ data, operation: 'create' })).toStrictEqual(
      data,
    );
  });

  it('exports a fresh fail-closed config for later server composition', () => {
    const collection = createStaffCollection();
    expect(collection).not.toBe(Staff);
    expect(collection.slug).toBe(Staff.slug);
    expect(collection.access?.create).toBe(denyStaffAccess);
  });
});
