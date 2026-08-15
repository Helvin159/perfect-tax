import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const infrastructureDirectory = fileURLToPath(new URL('.', import.meta.url));

function source(name: string): string {
  return readFileSync(new URL(name, import.meta.url), 'utf8');
}

describe('attested Payload gateway architecture boundary', () => {
  it('contains no normal overrideAccess true or direct getPayload escape hatch', () => {
    const portalSource = source('portal-payload-gateway.ts');

    expect(portalSource).toContain('overrideAccess: false');
    expect(portalSource).not.toContain('overrideAccess: true');
    expect(portalSource).not.toMatch(/\bgetPayload\s*\(/u);
    expect(portalSource).not.toMatch(/\bpayload\s*:\s*Payload\b/u);
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
      "const portalCapabilityContextKey = 'portalPayloadCapability'",
    );
    expect(portalSource).not.toContain(
      'export const portalCapabilityContextKey',
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
    expect(systemSource).not.toMatch(/\bgetPayload\s*\(/u);
    expect(systemSource).not.toContain('overrideAccess: true');
    expect(systemSource).not.toContain('bypass-all');
    expect(systemSource).not.toContain('super-admin');
    expect(systemSource).not.toContain("'root'");
    expect(systemSource).toContain("'primary-owner-bootstrap'");
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
