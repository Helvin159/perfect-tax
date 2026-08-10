import {
  parseClientId,
  parseStaffId,
  type ClientId,
  type StaffId,
} from '../../portal-identity/domain/identifiers';
import {
  hasExactKeys,
  isRecord,
} from '../../portal-identity/domain/validation';

/** Ownership must be loaded from trusted domain/repository data, never claims. */
export type ClientOwnedResource = Readonly<{ clientId: ClientId }>;

/**
 * Future policy input only. Role membership is not assignment evidence, and
 * an empty assignedStaffIds list grants no Client access.
 */
export type AssignedClientResource = ClientOwnedResource &
  Readonly<{ assignedStaffIds: readonly StaffId[] }>;

export function parseClientOwnedResource(
  value: unknown,
): ClientOwnedResource | undefined {
  if (!isRecord(value) || !hasExactKeys(value, ['clientId'])) {
    return undefined;
  }

  const clientId = parseClientId(value.clientId);
  return clientId ? Object.freeze({ clientId }) : undefined;
}

export function parseAssignedClientResource(
  value: unknown,
): AssignedClientResource | undefined {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['assignedStaffIds', 'clientId']) ||
    !Array.isArray(value.assignedStaffIds)
  ) {
    return undefined;
  }

  const clientId = parseClientId(value.clientId);
  const assignedStaffIds = value.assignedStaffIds.map(parseStaffId);

  if (!clientId || assignedStaffIds.some((staffId) => staffId === undefined)) {
    return undefined;
  }

  const canonicalStaffIds = assignedStaffIds as StaffId[];
  if (new Set(canonicalStaffIds).size !== canonicalStaffIds.length) {
    return undefined;
  }

  return Object.freeze({
    assignedStaffIds: Object.freeze(canonicalStaffIds),
    clientId,
  });
}
