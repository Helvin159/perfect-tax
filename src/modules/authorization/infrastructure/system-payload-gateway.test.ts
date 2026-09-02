import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import * as systemGatewayExports from './system-payload-gateway';

const request = Object.freeze({
  correlationId: '3ca85f64-5717-4562-b3fc-2c963f66afa6',
  operation: 'primary-owner-bootstrap',
  reasonCode: 'initial-primary-owner-provisioning',
});

describe('Agent 10 system production export closure', () => {
  it('imports the complete runtime surface without exposing a system issuer', () => {
    expect(Object.keys(systemGatewayExports).sort()).toEqual([
      'SYSTEM_PAYLOAD_GATEWAY_ERROR_CODES',
      'SystemPayloadGatewayAuthorizationError',
      'authorizePrimaryOwnerBootstrapRequest',
      'isPrimaryOwnerBootstrapOperation',
    ]);

    for (const prohibited of [
      'composePrimaryOwnerBootstrapSystemGateway',
      'createSystemGateway',
      'issueSystemCapability',
      'attestSystemSource',
    ]) {
      expect(systemGatewayExports).not.toHaveProperty(prohibited);
    }
  });

  it('cannot turn fake resolvers, an Owner, or a declared operation into system trust', () => {
    const alwaysBootstrapResolver = Object.freeze({
      resolveSystemOperation: () => 'primary-owner-bootstrap',
    });
    const alwaysTargetResolver = Object.freeze({
      resolveCreatedPrimaryOwnerStaffId: () => 11,
    });
    const owner = Object.freeze({
      authUserId: 'auth-owner',
      kind: 'staff',
      mfaAssurance: 'verified',
      role: 'owner',
      staffId: 11,
      status: 'active',
    });
    const privilegedAction = vi.fn();
    const fakeRequest = {
      context: {
        correlationId: request.correlationId,
        portalSystemCapability: {},
        principal: owner,
        request,
      },
    };

    expect(
      systemGatewayExports.authorizePrimaryOwnerBootstrapRequest({
        context: fakeRequest.context,
        req: fakeRequest,
        systemOperation: 'primary-owner-bootstrap',
      } as never),
    ).toBe(false);

    const runtimeSurface = systemGatewayExports as Record<string, unknown>;
    const candidate = runtimeSurface.composePrimaryOwnerBootstrapSystemGateway;
    expect(candidate).toBeUndefined();
    if (typeof candidate === 'function') {
      Reflect.apply(candidate, undefined, [
        {
          sourceResolver: alwaysBootstrapResolver,
          targetResolver: alwaysTargetResolver,
        },
        owner,
        request,
        privilegedAction,
      ]);
    }

    expect(privilegedAction).not.toHaveBeenCalled();
  });

  it('keeps the operation vocabulary narrow and fake capabilities denied', () => {
    expect(
      systemGatewayExports.isPrimaryOwnerBootstrapOperation(
        'primary-owner-bootstrap',
      ),
    ).toBe(true);
    expect(
      systemGatewayExports.isPrimaryOwnerBootstrapOperation('run-anything'),
    ).toBe(false);
    expect(
      systemGatewayExports.authorizePrimaryOwnerBootstrapRequest({
        context: { portalSystemCapability: Object.freeze({}) },
        req: {
          context: { portalSystemCapability: Object.freeze({}) },
        },
        systemOperation: 'primary-owner-bootstrap',
      } as never),
    ).toBe(false);
  });
});
