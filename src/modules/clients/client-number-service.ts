import { randomBytes } from 'node:crypto';

import {
  parseClientNumber,
  type ClientNumber,
} from '@/modules/portal-identity/domain/client-number';

const CROCKFORD_BASE32_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CLIENT_NUMBER_RANDOM_CHARACTER_COUNT = 8;
const CLIENT_NUMBER_COLLISION_ATTEMPTS = 5;

/** Exact Payload/PostgreSQL unique index Agent 14 must preserve. */
export const CLIENT_NUMBER_UNIQUE_INDEX = 'clients_client_number_idx';

/**
 * Generates a non-secret business reference from Node's cryptographically
 * secure random source. The 32-character alphabet maps each byte uniformly
 * by consuming its low five bits.
 */
export function generateClientNumber(): ClientNumber {
  const bytes = randomBytes(CLIENT_NUMBER_RANDOM_CHARACTER_COUNT);
  const characters = Array.from(
    bytes,
    (byte) => CROCKFORD_BASE32_ALPHABET[byte & 31],
  ).join('');
  const candidate = `CL-${characters.slice(0, 4)}-${characters.slice(4)}`;
  const clientNumber = parseClientNumber(candidate);

  if (clientNumber === undefined) {
    throw new Error(
      'Secure Client-number generation produced an invalid value.',
    );
  }

  return clientNumber;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Recognizes only the assigned Client-number constraint, including when a
 * database error is wrapped through `cause`. Other uniqueness failures must
 * not be retried because they represent different invariant violations.
 */
export function isClientNumberCollision(error: unknown): boolean {
  let current = error;
  const visited = new Set<object>();

  while (isRecord(current) && !visited.has(current)) {
    visited.add(current);

    if (
      current.code === '23505' &&
      current.constraint === CLIENT_NUMBER_UNIQUE_INDEX
    ) {
      return true;
    }

    current = current.cause;
  }

  return false;
}

/**
 * Runs a Client create attempt and retries only a generated-number collision.
 * Each attempt must omit `clientNumber`; the collection hook generates a fresh
 * secure value. The operation callback is the deterministic test seam, so the
 * production random source is never injectable or caller-controlled.
 */
export async function createWithClientNumberCollisionRetry<Result>(
  createAttempt: () => Promise<Result>,
): Promise<Result> {
  for (
    let attempt = 1;
    attempt <= CLIENT_NUMBER_COLLISION_ATTEMPTS;
    attempt++
  ) {
    try {
      return await createAttempt();
    } catch (error) {
      if (
        !isClientNumberCollision(error) ||
        attempt === CLIENT_NUMBER_COLLISION_ATTEMPTS
      ) {
        throw error;
      }
    }
  }

  throw new Error('Unreachable Client-number collision retry state.');
}
