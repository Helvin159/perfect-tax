import { describe, expect, it, vi } from 'vitest';

import {
  createEnforceStaffInvariants,
  enforceStaffDeleteInvariant,
  enforceStaffDeletion,
  enforceStaffMutation,
  type StaffPersistenceRecord,
} from './invariants';

const ordinaryStaff: StaffPersistenceRecord = {
  firstName: 'Katherine',
  id: 12,
  isPrimaryOwner: false,
  lastName: 'Johnson',
  role: 'administrator',
  status: 'active',
  workEmail: 'katherine@example.com',
};

const primaryOwner: StaffPersistenceRecord = {
  ...ordinaryStaff,
  id: 1,
  isPrimaryOwner: true,
  role: 'owner',
};

const ownerCreate = {
  firstName: 'Grace',
  isPrimaryOwner: true,
  lastName: 'Hopper',
  role: 'owner' as const,
  status: 'active' as const,
  workEmail: 'grace@example.com',
};

describe('Staff owner invariants', () => {
  it.each([
    {
      data: { ...ownerCreate, isPrimaryOwner: false },
      label: 'owner without marker',
    },
    {
      data: {
        ...ownerCreate,
        isPrimaryOwner: true,
        role: 'administrator' as const,
      },
      label: 'marker on non-owner',
    },
  ])('rejects inconsistent create state: $label', ({ data }) => {
    expect(() => enforceStaffMutation({ data, operation: 'create' })).toThrow(
      /owner/i,
    );
  });

  it('forbids normal owner creation even when role and marker are consistent', () => {
    expect(() =>
      enforceStaffMutation({ data: ownerCreate, operation: 'create' }),
    ).toThrow(/system bootstrap capability/i);
  });

  it('permits only an active, internally authorized bootstrap owner', () => {
    expect(
      enforceStaffMutation({
        data: ownerCreate,
        isPrimaryOwnerBootstrap: true,
        operation: 'create',
      }),
    ).toStrictEqual(ownerCreate);

    expect(() =>
      enforceStaffMutation({
        data: { ...ownerCreate, status: 'disabled' },
        isPrimaryOwnerBootstrap: true,
        operation: 'create',
      }),
    ).toThrow(/must be active/i);
  });

  it.each([
    {
      data: { role: 'owner' as const, isPrimaryOwner: true },
      label: 'promotion',
    },
    { data: { isPrimaryOwner: true }, label: 'marker assignment' },
  ])('forbids normal $label of an ordinary Staff record', ({ data }) => {
    expect(() =>
      enforceStaffMutation({
        data,
        operation: 'update',
        originalDoc: ordinaryStaff,
      }),
    ).toThrow(/cannot promote/i);
  });

  it.each([
    { data: { role: 'administrator' as const }, label: 'demotion' },
    { data: { isPrimaryOwner: false }, label: 'marker removal' },
    { data: { status: 'disabled' as const }, label: 'disablement' },
  ])('forbids primary-owner $label', ({ data }) => {
    expect(() =>
      enforceStaffMutation({
        data,
        operation: 'update',
        originalDoc: primaryOwner,
      }),
    ).toThrow(/primary owner/i);
  });

  it('allows primary-owner contact and name edits without changing identity', () => {
    const data = {
      firstName: 'Updated',
      workEmail: 'updated-work@example.com',
    };
    expect(
      enforceStaffMutation({
        data,
        operation: 'update',
        originalDoc: primaryOwner,
      }),
    ).toStrictEqual(data);
  });

  it.each([
    { data: { role: 'admin' }, label: 'invalid role' },
    { data: { status: 'inactive' }, label: 'invalid status' },
    { data: { isPrimaryOwner: 'true' }, label: 'invalid marker' },
  ])('rejects $label even on a direct invariant call', ({ data }) => {
    expect(() =>
      enforceStaffMutation({
        data: data as never,
        operation: 'update',
        originalDoc: ordinaryStaff,
      }),
    ).toThrow(/invalid|boolean/i);
  });

  it('forbids primary-owner deletion and permits ordinary Staff deletion', () => {
    expect(() => enforceStaffDeletion(primaryOwner)).toThrow(
      /cannot be deleted/i,
    );
    expect(() => enforceStaffDeletion(ordinaryStaff)).not.toThrow();
  });
});

describe('primary-owner bootstrap composition seam', () => {
  it('ignores caller-looking context and denies by default', async () => {
    const hook = createEnforceStaffInvariants();

    await expect(
      hook({
        context: {
          reason: 'looks legitimate',
          systemOperation: 'primary-owner-bootstrap',
        },
        data: ownerCreate,
        operation: 'create',
        req: {},
      } as never),
    ).rejects.toThrow(/system bootstrap capability/i);
  });

  it('delegates only owner creation to the injected private authorizer', async () => {
    const authorizePrimaryOwnerBootstrap = vi.fn(() => true);
    const hook = createEnforceStaffInvariants({
      authorizePrimaryOwnerBootstrap,
    });
    const req = { marker: 'same request object' };

    await expect(
      hook({
        context: {},
        data: ownerCreate,
        operation: 'create',
        req,
      } as never),
    ).resolves.toStrictEqual(ownerCreate);
    expect(authorizePrimaryOwnerBootstrap).toHaveBeenCalledWith({
      context: {},
      req,
      systemOperation: 'primary-owner-bootstrap',
    });

    authorizePrimaryOwnerBootstrap.mockClear();
    await hook({
      context: {},
      data: ordinaryStaff,
      operation: 'create',
      req,
    } as never);
    expect(authorizePrimaryOwnerBootstrap).not.toHaveBeenCalled();
  });
});

describe('primary-owner delete hook', () => {
  it('loads target evidence with the same request and denies owner deletion', async () => {
    const findByID = vi.fn().mockResolvedValue(primaryOwner);
    const req = { payload: { findByID } };

    await expect(
      enforceStaffDeleteInvariant({ id: primaryOwner.id, req } as never),
    ).rejects.toThrow(/cannot be deleted/i);
    expect(findByID).toHaveBeenCalledWith({
      collection: 'staff',
      depth: 0,
      id: primaryOwner.id,
      overrideAccess: true,
      req,
      select: {
        isPrimaryOwner: true,
        role: true,
      },
    });
  });

  it('allows deletion after independently loading ordinary Staff evidence', async () => {
    const findByID = vi.fn().mockResolvedValue(ordinaryStaff);
    const req = { payload: { findByID } };

    await expect(
      enforceStaffDeleteInvariant({ id: ordinaryStaff.id, req } as never),
    ).resolves.toBeUndefined();
  });
});
