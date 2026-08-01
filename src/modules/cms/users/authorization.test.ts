import { describe, expect, it } from 'vitest';

import {
  CMS_BOOTSTRAP_CONTEXT,
  enforceCmsUserAuthorization,
} from './authorization';

const editor = { collection: 'cms-users', id: 1, role: 'editor' };
const administrator = {
  collection: 'cms-users',
  id: 2,
  role: 'cms-admin',
};

function authorize(args: {
  context?: Record<PropertyKey, unknown>;
  data: Record<string, unknown>;
  operation: 'create' | 'update';
  originalDoc?: Record<string, unknown>;
  user?: unknown;
}) {
  return enforceCmsUserAuthorization({
    context: args.context ?? {},
    data: args.data,
    operation: args.operation,
    originalDoc: args.originalDoc,
    req: { user: args.user ?? null },
  } as never);
}

describe('CmsUsers authorization hook', () => {
  it('rejects public first-user registration even when access is overridden', () => {
    expect(() =>
      authorize({
        data: { role: 'cms-admin' },
        operation: 'create',
      }),
    ).toThrow('not permitted');
  });

  it('prevents editors from creating users or promoting themselves', () => {
    expect(() =>
      authorize({
        data: { role: 'editor' },
        operation: 'create',
        user: editor,
      }),
    ).toThrow('not permitted');

    expect(() =>
      authorize({
        data: { role: 'bilingual-reviewer' },
        operation: 'update',
        originalDoc: { id: editor.id, role: editor.role },
        user: editor,
      }),
    ).toThrow('not permitted');
  });

  it('allows administrators to update another user role, never their own', () => {
    expect(
      authorize({
        data: { role: 'publisher' },
        operation: 'update',
        originalDoc: { id: editor.id, role: editor.role },
        user: administrator,
      }),
    ).toEqual({ role: 'publisher' });

    expect(() =>
      authorize({
        data: { role: 'editor' },
        operation: 'update',
        originalDoc: {
          id: administrator.id,
          role: administrator.role,
        },
        user: administrator,
      }),
    ).toThrow('not permitted');
  });

  it('accepts only a cms-admin role through the internal bootstrap context', () => {
    expect(
      authorize({
        context: { [CMS_BOOTSTRAP_CONTEXT]: true },
        data: { role: 'cms-admin' },
        operation: 'create',
      }),
    ).toEqual({ role: 'cms-admin' });

    expect(() =>
      authorize({
        context: { [CMS_BOOTSTRAP_CONTEXT]: true },
        data: { role: 'editor' },
        operation: 'create',
      }),
    ).toThrow('not permitted');
  });
});
