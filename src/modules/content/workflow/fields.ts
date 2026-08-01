import type { Field } from 'payload';

import { validateReviewNotes } from './review-notes';
import {
  CONTENT_POLICIES,
  PUBLIC_CONTENT_LOCALES,
  TRANSLATION_STATES,
  type ContentPolicy,
  type PublicContentLocale,
} from './types';

function workflowLocaleFields(locale: PublicContentLocale): Field {
  return {
    name: locale,
    type: 'group',
    fields: [
      {
        name: 'state',
        type: 'select',
        defaultValue: 'draft',
        options: TRANSLATION_STATES.map((state) => ({
          label: state,
          value: state,
        })),
        required: true,
      },
      {
        name: 'sourceRevision',
        type: 'number',
        admin: { readOnly: true },
        defaultValue: 1,
        min: 1,
        required: true,
      },
      {
        name: 'reviewedBy',
        type: 'relationship',
        admin: { readOnly: true },
        relationTo: 'cms-users',
      },
      {
        name: 'reviewedAt',
        type: 'date',
        admin: { readOnly: true },
      },
      {
        name: 'publishedBy',
        type: 'relationship',
        admin: { readOnly: true },
        relationTo: 'cms-users',
      },
      {
        name: 'publishedAt',
        type: 'date',
        admin: { readOnly: true },
      },
      {
        name: 'lastEditedBy',
        type: 'relationship',
        admin: { hidden: true, readOnly: true },
        relationTo: 'cms-users',
      },
      {
        name: 'lastEditedAt',
        type: 'date',
        admin: { hidden: true, readOnly: true },
      },
      {
        name: 'reviewNotes',
        type: 'textarea',
        admin: {
          description:
            'Editorial context only. Never enter client names, identifiers, records, or case details.',
        },
        maxLength: 1_000,
        validate: validateReviewNotes,
      },
    ],
    label: locale === 'en' ? 'English' : 'Spanish',
  };
}

export function createEditorialWorkflowFields(
  defaultContentPolicy: ContentPolicy,
): Field[] {
  return [
    {
      name: 'contentPolicy',
      type: 'select',
      admin: {
        description:
          'Controls the server-side bilingual review and publication policy.',
      },
      defaultValue: defaultContentPolicy,
      options: CONTENT_POLICIES.map((policy) => ({
        label: policy,
        value: policy,
      })),
      required: true,
    },
    {
      name: 'workingRevision',
      type: 'number',
      admin: { hidden: true, readOnly: true },
      defaultValue: 1,
      min: 1,
      required: true,
    },
    {
      name: 'translationWorkflow',
      type: 'group',
      admin: {
        description:
          'Workflow metadata is editorial-only and must never include client-sensitive information.',
      },
      fields: PUBLIC_CONTENT_LOCALES.map(workflowLocaleFields),
    },
    {
      name: 'urgentPublicationControls',
      type: 'group',
      admin: {
        condition: (_, siblingData) =>
          siblingData?.contentPolicy === 'urgent-announcement',
        description:
          'Required when an urgent announcement is published in one locale before the other.',
      },
      fields: [
        {
          name: 'expiresAt',
          type: 'date',
        },
        {
          name: 'translationOwner',
          type: 'relationship',
          relationTo: 'cms-users',
        },
        {
          name: 'translationFollowUpDeadline',
          type: 'date',
        },
      ],
    },
  ];
}
