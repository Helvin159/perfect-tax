import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import * as portalGatewayExports from './portal-payload-gateway';

const owner = Object.freeze({
  authUserId: 'auth-owner',
  kind: 'staff',
  mfaAssurance: 'verified',
  role: 'owner',
  staffId: 11,
  status: 'active',
});

const client = Object.freeze({
  authUserId: 'auth-client',
  clientId: 101,
  kind: 'client',
  status: 'active',
});

function fakePortalRequest(principal: object) {
  return {
    context: {
      portalPayloadCapability: {},
      principal,
      resolveCanonicalPrincipal: () => principal,
      trusted: true,
    },
    user:
      'clientId' in principal
        ? {
            clientId: 101,
            collection: 'portal-principals',
            id: 'client:101',
            kind: 'client',
          }
        : {
            collection: 'portal-principals',
            id: 'staff:11',
            kind: 'staff',
            role: 'owner',
            staffId: 11,
          },
  };
}

describe('Agent 10 portal production export closure', () => {
  it('imports the complete runtime surface without exposing an authority issuer', () => {
    expect(Object.keys(portalGatewayExports).sort()).toEqual([
      'PortalPayloadAuthorizationError',
      'PortalPayloadPersistenceError',
      'authorizePortalClientFieldRead',
      'authorizePortalClientRead',
      'portalClientCollectionAccess',
      'portalClientFieldAccess',
      'requireAttestedPortalRequest',
      'resolveAttestedPortalRequest',
    ]);

    for (const prohibited of [
      'composePortalPayloadGatewayWithPrincipalResolver',
      'createPortalGateway',
      'createTrustedPortalGateway',
      'issuePortalCapability',
      'attestPortalPrincipal',
    ]) {
      expect(portalGatewayExports).not.toHaveProperty(prohibited);
    }
  });

  it('cannot turn fake resolvers, Owner/Client values, or lookalike context into trust', async () => {
    const alwaysOwnerResolver = Object.freeze({
      resolveCanonicalPrincipal: () => owner,
    });
    const alwaysClientResolver = Object.freeze({
      resolveCanonicalPrincipal: () => client,
    });
    const payload = Object.freeze({ find: vi.fn(), findByID: vi.fn() });

    for (const principal of [owner, client]) {
      const request = fakePortalRequest(principal);
      expect(
        portalGatewayExports.resolveAttestedPortalRequest(request),
      ).toBeUndefined();
      expect(
        await portalGatewayExports.authorizePortalClientRead({
          req: request,
        } as never),
      ).toBe(false);
      expect(
        await portalGatewayExports.authorizePortalClientFieldRead({
          req: request,
        } as never),
      ).toBe(false);
      expect(() =>
        portalGatewayExports.requireAttestedPortalRequest(request as never),
      ).toThrowError(
        new portalGatewayExports.PortalPayloadAuthorizationError(
          'invalid-principal',
        ),
      );
    }

    const runtimeSurface = portalGatewayExports as Record<string, unknown>;
    for (const resolver of [alwaysOwnerResolver, alwaysClientResolver]) {
      for (const prohibited of [
        'composePortalPayloadGatewayWithPrincipalResolver',
        'createPortalGateway',
        'createTrustedPortalGateway',
      ]) {
        const candidate = runtimeSurface[prohibited];
        expect(candidate).toBeUndefined();
        if (typeof candidate === 'function') {
          Reflect.apply(candidate, undefined, [payload, resolver]);
        }
      }
    }

    expect(payload.find).not.toHaveBeenCalled();
    expect(payload.findByID).not.toHaveBeenCalled();
  });

  it('keeps all exported Client mutation contracts fail closed', () => {
    expect(
      portalGatewayExports.portalClientCollectionAccess.create({} as never),
    ).toBe(false);
    expect(
      portalGatewayExports.portalClientCollectionAccess.update({} as never),
    ).toBe(false);
    expect(
      portalGatewayExports.portalClientCollectionAccess.delete({} as never),
    ).toBe(false);
    expect(
      portalGatewayExports.portalClientFieldAccess.create({} as never),
    ).toBe(false);
    expect(
      portalGatewayExports.portalClientFieldAccess.update({} as never),
    ).toBe(false);
  });
});
