import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const infrastructureDirectory = fileURLToPath(new URL('.', import.meta.url));

function source(name: string): string {
  return readFileSync(new URL(name, import.meta.url), 'utf8');
}

describe('attested Payload gateway architecture boundary', () => {
  it('keeps production Payload access private, fixed, and non-bypassing', () => {
    const portalSource = source('portal-payload-gateway.ts');

    expect(portalSource).toContain('overrideAccess: false');
    expect(portalSource).not.toContain('overrideAccess: true');
    expect(portalSource).not.toMatch(/\bpayload\s*:\s*Payload\b/u);
    expect(portalSource).toContain('const productionPortalPayload');
    expect(portalSource).toContain('return getPayload({ config })');
    expect(portalSource).not.toMatch(
      /export\s+(?:const|function)\s+(?:getProductionPortalPayload|productionPortalPayload)\b/u,
    );
  });

  it('keeps the portal registry, issuer, resolver, and composition private', () => {
    const portalSource = source('portal-payload-gateway.ts');

    expect(portalSource).not.toMatch(
      /export\s+function\s+composePortalPayloadGatewayWithPrincipalResolver\b/u,
    );
    expect(portalSource).not.toMatch(
      /export\s+(?:interface|type)\s+TrustedPortalPrincipalResolver\b/u,
    );
    expect(portalSource).not.toMatch(
      /export\s+(?:const|function)\s+(?:issuePortalOperation|portalAttestations)\b/u,
    );
    expect(portalSource).toContain(
      "from '@/modules/auth/portal-principal-composition'",
    );
    expect(portalSource).toContain(
      'export const portalPayloadGateway: PortalPayloadGateway<Headers>',
    );
    expect(portalSource).not.toMatch(
      /export\s+(?:const|function)\s+(?:create|compose)(?:Trusted)?PortalPayloadGateway\b/u,
    );
    expect(portalSource).toContain(
      "const portalCapabilityContextKey = 'portalPayloadCapability'",
    );
    expect(portalSource).not.toContain(
      'export const portalCapabilityContextKey',
    );
  });

  it('keeps canonical identity and domain reads narrow and server-derived', () => {
    const resolverSource = readFileSync(
      new URL('../../auth/portal-principal-composition.ts', import.meta.url),
      'utf8',
    );

    expect(resolverSource).toContain('readAuthenticatedPortalSession(headers)');
    expect(resolverSource).toMatch(/\.findByAuthUserId\(\s*authUserId/u);
    expect(resolverSource).toContain('overrideAccess: true');
    expect(resolverSource).toContain('depth: 0');
    expect(resolverSource).toContain('select: { role: true, status: true }');
    expect(resolverSource).toContain('select: { status: true }');
    expect(resolverSource).not.toMatch(/workEmail|contactEmail|cms-users/u);
    expect(resolverSource).not.toMatch(/resolveByEmail|resolveByWorkEmail/u);
    expect(resolverSource).not.toMatch(
      /export\s+(?:const|function)\s+(?:issue|attest).*Principal/u,
    );
  });

  it('keeps the system registry, issuer, resolvers, composition, and audit sources private', () => {
    const systemSource = source('system-payload-gateway.ts');

    expect(systemSource).not.toMatch(
      /export\s+function\s+composePrimaryOwnerBootstrapSystemGateway\b/u,
    );
    expect(systemSource).not.toMatch(
      /export\s+(?:interface|type)\s+TrustedPrimaryOwner(?:BootstrapSource|Target)Resolver\b/u,
    );
    expect(systemSource).not.toMatch(
      /export\s+(?:const|function)\s+(?:systemCapabilities|systemAuditSources|createAuditSource)\b/u,
    );
    expect(systemSource).not.toMatch(
      /export\s+(?:async\s+)?function\s+(?:run|bootstrap|create|compose|issue|trust).*PrimaryOwner/iu,
    );
    expect(systemSource).not.toMatch(/\bgetPayload\s*\(/u);
    expect(systemSource).not.toContain('overrideAccess: true');
    expect(systemSource).not.toContain('bypass-all');
    expect(systemSource).not.toContain('super-admin');
    expect(systemSource).not.toContain("'root'");
    expect(systemSource).toContain("'primary-owner-bootstrap'");
    expect(systemSource).toContain('isDirectCommandExecution()');
    expect(systemSource).toContain('runPrimaryOwnerBootstrapCommand({');
  });

  it('exposes primary-owner bootstrap only as the direct non-web package command', () => {
    const packageJson = JSON.parse(
      readFileSync(
        new URL('../../../../package.json', import.meta.url),
        'utf8',
      ),
    ) as { scripts?: Record<string, string> };
    const command = packageJson.scripts?.['portal:bootstrap-primary-owner'];
    const appRouteSources = [
      '../../../app/api/auth/[...all]/route.ts',
      '../../../app/api/health/live/route.ts',
      '../../../app/api/health/ready/route.ts',
      '../../../app/api/locale/route.ts',
    ].map((path) => readFileSync(new URL(path, import.meta.url), 'utf8'));

    expect(command).toContain('--conditions=react-server');
    expect(command).toContain('system-payload-gateway.ts');
    expect(appRouteSources.join('\n')).not.toMatch(
      /primary-owner|bootstrap-primary-owner|system-payload-gateway/iu,
    );
  });

  it('marks source inspection as defense in depth rather than the runtime control', () => {
    const readme = source('README.md');

    expect(readme).toContain('defense in depth only');
    expect(readme).toContain(
      'JavaScript\nmodule-private state plus the absence of any exported issuance call path',
    );
  });

  it('keeps all Agent 10 implementation files in the owned infrastructure directory', () => {
    expect(infrastructureDirectory).toMatch(
      /src\/modules\/authorization\/infrastructure\/$/u,
    );
  });
});
