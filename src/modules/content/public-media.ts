import {
  APIError,
  type CollectionBeforeChangeHook,
  type CollectionConfig,
  type TypeWithID,
} from 'payload';

import { isCmsAdminIdentity, isCmsIdentity } from '@/modules/cms/users/roles';

import {
  createEditorialContent,
  deleteEditorialContent,
  readPublicMedia,
  updatePublicMedia,
} from './access';
import {
  createPublicMediaCacheInvalidationHook,
  createPublicResourceDeletionInvalidationHook,
} from './infrastructure/public-cache-invalidation';

export const PUBLIC_MEDIA_MIME_TYPES = [
  'image/avif',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

const PUBLIC_MEDIA_BOUNDARY =
  'Public brand and marketing images only. Never upload tax records, identity or immigration documents, client photographs, private uploads, or case evidence.';

function valuesDiffer(left: unknown, right: unknown): boolean {
  return JSON.stringify(left ?? null) !== JSON.stringify(right ?? null);
}

export const enforcePublicMediaAuthorization: CollectionBeforeChangeHook<
  TypeWithID & Record<string, unknown>
> = ({ data, operation, originalDoc, req }) => {
  if (!isCmsIdentity(req.user)) {
    throw new APIError('An authenticated CMS identity is required.', 403);
  }
  const isAdministrator = isCmsAdminIdentity(req.user);
  const isEditor = req.user.role === 'editor';
  const isPublisher = req.user.role === 'publisher';

  if (operation === 'create') {
    if (!isEditor && !isAdministrator) {
      throw new APIError('Only editors may upload public media drafts.', 403);
    }
    if (data._status === 'published') {
      throw new APIError('New public media must begin as a draft.', 400);
    }
    data._status = 'draft';
    return data;
  }

  if (!isEditor && !isPublisher && !isAdministrator) {
    throw new APIError('This role cannot update public media.', 403);
  }

  const editorialFields = ['assetType', 'altText', 'caption'];
  const editsMedia =
    Boolean(req.file) ||
    editorialFields.some(
      (field) =>
        Object.prototype.hasOwnProperty.call(data, field) &&
        valuesDiffer(data[field], originalDoc?.[field]),
    );

  if (editsMedia && !isEditor && !isAdministrator) {
    throw new APIError('Only editors may change public media.', 403);
  }

  if (editsMedia && !isAdministrator) {
    data._status = 'draft';
  }

  if (
    data._status === 'published' &&
    originalDoc?._status !== 'published' &&
    !isPublisher &&
    !isAdministrator
  ) {
    throw new APIError('Only publishers may publish public media.', 403);
  }

  return data;
};

export const PublicMedia: CollectionConfig = {
  slug: 'public-media',
  access: {
    create: createEditorialContent,
    delete: deleteEditorialContent,
    read: readPublicMedia,
    update: updatePublicMedia,
  },
  admin: {
    description: PUBLIC_MEDIA_BOUNDARY,
    group: 'Public content',
    useAsTitle: 'filename',
  },
  fields: [
    {
      name: 'assetType',
      type: 'select',
      options: [
        { label: 'Brand logo', value: 'brand-logo' },
        { label: 'Brand icon', value: 'brand-icon' },
        { label: 'Marketing image', value: 'marketing-image' },
      ],
      required: true,
    },
    {
      name: 'altText',
      type: 'text',
      localized: true,
      maxLength: 300,
      required: true,
    },
    {
      name: 'caption',
      type: 'textarea',
      localized: true,
      maxLength: 600,
    },
  ],
  graphQL: false,
  hooks: {
    afterChange: [createPublicMediaCacheInvalidationHook()],
    afterDelete: [
      createPublicResourceDeletionInvalidationHook('business-identity'),
    ],
    beforeChange: [enforcePublicMediaAuthorization],
  },
  labels: {
    plural: 'Public media',
    singular: 'Public media asset',
  },
  upload: {
    mimeTypes: [...PUBLIC_MEDIA_MIME_TYPES],
    staticDir: 'public-media',
  },
  versions: {
    drafts: { autosave: false },
    maxPerDoc: 30,
  },
};

export { PUBLIC_MEDIA_BOUNDARY };
