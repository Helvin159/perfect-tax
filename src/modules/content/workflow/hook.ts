import type {
  CollectionBeforeChangeHook,
  GlobalBeforeChangeHook,
  TypeWithID,
} from 'payload';

import {
  applyEditorialWorkflowChange,
  type EditorialWorkflowOptions,
} from './policy';

export function createCollectionWorkflowHook(
  options: EditorialWorkflowOptions,
): CollectionBeforeChangeHook<TypeWithID & Record<string, unknown>> {
  return ({ data, operation, originalDoc, req }) =>
    applyEditorialWorkflowChange({
      ...options,
      data,
      locale: req.locale,
      operation,
      originalDoc,
      user: req.user,
    });
}

export function createGlobalWorkflowHook(
  options: EditorialWorkflowOptions,
): GlobalBeforeChangeHook {
  return ({ data, originalDoc, req }) =>
    applyEditorialWorkflowChange({
      ...options,
      data,
      locale: req.locale,
      operation: originalDoc ? 'update' : 'create',
      originalDoc,
      user: req.user,
    });
}
