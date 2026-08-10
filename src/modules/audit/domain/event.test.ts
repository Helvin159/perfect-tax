import { describe, expect, it } from 'vitest';

import { SECURITY_EVENT_ACTIONS } from './actions';
import {
  parseSecurityEventAppendRecord,
  parseSecurityEventInput,
  SecurityEventValidationError,
} from './event';

const correlationId = '018f47a8-7b2c-7f35-8c11-7bb91f934d22';

describe('security-event domain contract', () => {
  it('freezes the Slice 1 action catalog without invitation or email events', () => {
    expect(SECURITY_EVENT_ACTIONS).toEqual([
      'primary-owner.bootstrap.succeeded',
      'primary-owner.bootstrap.failed',
      'authentication.succeeded',
      'authentication.failed',
      'session.ended',
      'mfa.enrollment.succeeded',
      'mfa.verification.succeeded',
      'mfa.verification.failed',
      'domain-subject.disabled',
      'authorization.denied',
    ]);
    expect(Object.isFrozen(SECURITY_EVENT_ACTIONS)).toBe(true);
    expect(SECURITY_EVENT_ACTIONS.join(' ')).not.toMatch(/invite|email/);
  });

  it('accepts and freezes a valid owner-bootstrap event', () => {
    const event = parseSecurityEventInput({
      action: 'primary-owner.bootstrap.succeeded',
      actor: { kind: 'system' },
      correlationId,
      metadata: { operation: 'primary-owner-bootstrap' },
      target: { id: 41, type: 'staff' },
    });

    expect(event).toEqual({
      action: 'primary-owner.bootstrap.succeeded',
      actor: { kind: 'system' },
      correlationId,
      metadata: { operation: 'primary-owner-bootstrap' },
      target: { id: 41, type: 'staff' },
    });
    expect(Object.isFrozen(event)).toBe(true);
    expect(Object.isFrozen(event.actor)).toBe(true);
    expect(Object.isFrozen(event.metadata)).toBe(true);
    expect(Object.isFrozen(event.target)).toBe(true);
  });

  it('rejects an invalid action code', () => {
    expect(() =>
      parseSecurityEventInput({
        action: 'invitation.sent',
        actor: { kind: 'system' },
        metadata: {},
      }),
    ).toThrowError(new SecurityEventValidationError('invalid-action'));
  });

  it.each([
    { id: 0, kind: 'staff' },
    { id: '7', kind: 'staff' },
    { id: 7, kind: 'anonymous' },
    { id: 7, kind: 'cms-user' },
  ])('rejects malformed actor %#', (actor) => {
    expect(() =>
      parseSecurityEventInput({
        action: 'authorization.denied',
        actor,
        metadata: { reasonCode: 'forbidden-role' },
      }),
    ).toThrowError(new SecurityEventValidationError('invalid-actor'));
  });

  it.each([
    { id: 0, type: 'client' },
    { id: '9', type: 'staff' },
    { id: 9, type: 'portal-identity' },
    { id: ' auth-user ', type: 'auth-user' },
  ])('rejects malformed target %#', (target) => {
    expect(() =>
      parseSecurityEventInput({
        action: 'authorization.denied',
        actor: { id: 5, kind: 'staff' },
        metadata: { reasonCode: 'ownership-required' },
        target,
      }),
    ).toThrowError(new SecurityEventValidationError('invalid-target'));
  });

  it('rejects unknown metadata instead of stripping it', () => {
    expect(() =>
      parseSecurityEventInput({
        action: 'authorization.denied',
        actor: { id: 5, kind: 'staff' },
        metadata: {
          reasonCode: 'forbidden-role',
          route: '/admin',
        },
      }),
    ).toThrowError(new SecurityEventValidationError('invalid-metadata'));
  });

  it.each([
    { password: 'not-recordable' },
    { sessionToken: 'not-recordable' },
    { invitation_token: 'not-recordable' },
    { totpSecret: 'not-recordable' },
    { backupCodes: ['not-recordable'] },
    { emailBody: 'not-recordable' },
    { privateDocumentContent: 'not-recordable' },
    { providerSecret: 'not-recordable' },
    { requestBody: { arbitrary: true } },
  ])('rejects prohibited secret/private metadata key %#', (prohibited) => {
    expect(() =>
      parseSecurityEventInput({
        action: 'authentication.failed',
        actor: { kind: 'anonymous' },
        metadata: prohibited,
      }),
    ).toThrowError(new SecurityEventValidationError('prohibited-field'));
  });

  it('rejects caller-owned occurrence time and malformed correlation IDs', () => {
    expect(() =>
      parseSecurityEventInput({
        action: 'authentication.succeeded',
        actor: { id: 'auth_123', kind: 'auth-user' },
        metadata: {},
        occurredAt: '2020-01-01T00:00:00.000Z',
      }),
    ).toThrowError(new SecurityEventValidationError('invalid-event'));

    expect(() =>
      parseSecurityEventInput({
        action: 'authentication.succeeded',
        actor: { id: 'auth_123', kind: 'auth-user' },
        correlationId: 'request-token-like-free-text',
        metadata: {},
      }),
    ).toThrowError(new SecurityEventValidationError('invalid-correlation-id'));
  });

  it('rejects action/actor/target combinations outside the catalog contract', () => {
    expect(() =>
      parseSecurityEventInput({
        action: 'primary-owner.bootstrap.succeeded',
        actor: { id: 7, kind: 'staff' },
        metadata: { operation: 'primary-owner-bootstrap' },
        target: { id: 8, type: 'staff' },
      }),
    ).toThrowError(new SecurityEventValidationError('invalid-target'));
  });

  it('revalidates immutable flat append records at the schema boundary', () => {
    expect(
      parseSecurityEventAppendRecord({
        action: 'domain-subject.disabled',
        actorId: '7',
        actorKind: 'staff',
        metadata: { sessionsRevoked: true },
        occurredAt: '2026-08-10T14:30:00.000Z',
        targetId: '12',
        targetType: 'client',
      }),
    ).toEqual({
      action: 'domain-subject.disabled',
      actorId: '7',
      actorKind: 'staff',
      metadata: { sessionsRevoked: true },
      occurredAt: '2026-08-10T14:30:00.000Z',
      targetId: '12',
      targetType: 'client',
    });
  });
});
