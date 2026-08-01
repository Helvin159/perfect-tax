import { describe, expect, it } from 'vitest';

import { readPublicMedia, updatePublicMedia } from './access';
import {
  enforcePublicMediaAuthorization,
  PublicMedia,
  PUBLIC_MEDIA_BOUNDARY,
  PUBLIC_MEDIA_MIME_TYPES,
} from './public-media';

const editor = { collection: 'cms-users', id: 1, role: 'editor' };
const reviewer = {
  collection: 'cms-users',
  id: 2,
  role: 'bilingual-reviewer',
};
const publisher = { collection: 'cms-users', id: 3, role: 'publisher' };

function accessArgs(user: unknown) {
  return { req: { user } } as never;
}

function authorize(args: {
  data: Record<string, unknown>;
  operation: 'create' | 'update';
  originalDoc?: Record<string, unknown>;
  user: unknown;
}) {
  return enforcePublicMediaAuthorization({
    data: args.data,
    operation: args.operation,
    originalDoc: args.originalDoc,
    req: { user: args.user },
  } as never);
}

describe('PublicMedia boundary', () => {
  it('allows anonymous reads only for published public assets', () => {
    expect(readPublicMedia(accessArgs(null))).toEqual({
      _status: { equals: 'published' },
    });
    expect(readPublicMedia(accessArgs(editor))).toBe(true);
    expect(updatePublicMedia(accessArgs(null))).toBe(false);
    expect(updatePublicMedia(accessArgs(reviewer))).toBe(false);
  });

  it('accepts only web-safe raster image MIME types', () => {
    expect(PUBLIC_MEDIA_MIME_TYPES).toEqual([
      'image/avif',
      'image/jpeg',
      'image/png',
      'image/webp',
    ]);
    expect(PUBLIC_MEDIA_MIME_TYPES).not.toContain('application/pdf');
    expect(PublicMedia.upload).toMatchObject({
      mimeTypes: [...PUBLIC_MEDIA_MIME_TYPES],
      staticDir: 'public-media',
    });
  });

  it('documents every prohibited private-document category', () => {
    for (const phrase of [
      'tax records',
      'identity',
      'immigration',
      'client photographs',
      'private uploads',
      'case evidence',
    ]) {
      expect(PUBLIC_MEDIA_BOUNDARY.toLowerCase()).toContain(phrase);
    }
  });

  it('forces editor uploads to draft and reserves publication for publishers', () => {
    expect(
      authorize({ data: {}, operation: 'create', user: editor }),
    ).toMatchObject({ _status: 'draft' });
    expect(() =>
      authorize({
        data: { _status: 'published' },
        operation: 'create',
        user: editor,
      }),
    ).toThrow('begin as a draft');

    expect(
      authorize({
        data: { _status: 'published' },
        operation: 'update',
        originalDoc: { _status: 'draft' },
        user: publisher,
      }),
    ).toMatchObject({ _status: 'published' });
    expect(() =>
      authorize({ data: {}, operation: 'create', user: reviewer }),
    ).toThrow('Only editors');
  });

  it('prevents publishers from editing media metadata while publishing', () => {
    expect(() =>
      authorize({
        data: { altText: 'Changed', _status: 'published' },
        operation: 'update',
        originalDoc: { altText: 'Original', _status: 'draft' },
        user: publisher,
      }),
    ).toThrow('Only editors may change');
  });

  it('forces editor metadata changes back to draft', () => {
    expect(
      authorize({
        data: { altText: 'Improved alternative text', _status: 'published' },
        operation: 'update',
        originalDoc: { altText: 'Original', _status: 'published' },
        user: editor,
      }),
    ).toMatchObject({ _status: 'draft' });
  });
});
