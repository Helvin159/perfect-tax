import { readdirSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const infrastructureDirectory = fileURLToPath(new URL('.', import.meta.url));
const sourceDirectory = fileURLToPath(new URL('../../../', import.meta.url));

function source(name: string): string {
  return readFileSync(new URL(name, import.meta.url), 'utf8');
}

function productionTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return productionTypeScriptFiles(path);
    return /\.(?:ts|tsx)$/u.test(entry.name) && !entry.name.endsWith('.test.ts')
      ? [path]
      : [];
  });
}

describe('attested Payload gateway architecture boundary', () => {
  it('contains no normal overrideAccess true or direct getPayload escape hatch', () => {
    const portalSource = source('portal-payload-gateway.ts');

    expect(portalSource).toContain('overrideAccess: false');
    expect(portalSource).not.toContain('overrideAccess: true');
    expect(portalSource).not.toMatch(/\bgetPayload\s*\(/u);
    expect(portalSource).not.toMatch(/\bpayload\s*:\s*Payload\b/u);
  });

  it('does not export a general principal or capability minting primitive', () => {
    const portalSource = source('portal-payload-gateway.ts');

    for (const prohibitedExport of [
      'createTrustedPrincipal',
      'markTrusted',
      'createCapability',
      'TRUSTED_SYMBOL',
    ]) {
      expect(portalSource).not.toMatch(
        new RegExp(`export\\s+(?:function|const|class)\\s+${prohibitedExport}`),
      );
    }
    expect(portalSource).not.toMatch(/export\s+function\s+attest\b/u);
    expect(portalSource).toContain(
      "const portalCapabilityContextKey = 'portalPayloadCapability'",
    );
    expect(portalSource).not.toContain(
      'export const portalCapabilityContextKey',
    );
  });

  it('keeps the system gateway Payload-free and operation-specific', () => {
    const systemSource = source('system-payload-gateway.ts');

    expect(systemSource).not.toMatch(/\bgetPayload\s*\(/u);
    expect(systemSource).not.toContain('overrideAccess: true');
    expect(systemSource).not.toContain('bypass-all');
    expect(systemSource).not.toContain('super-admin');
    expect(systemSource).not.toContain("'root'");
    expect(systemSource).toContain("'primary-owner-bootstrap'");
  });

  it('allows composition factories only at their named trusted roots', () => {
    const allowedPortalCompositionFiles = new Set([
      'modules/auth/portal-principal-composition.ts',
      'modules/authorization/infrastructure/portal-payload-gateway.ts',
    ]);
    const allowedSystemCompositionFiles = new Set([
      'modules/authorization/infrastructure/system-payload-gateway.ts',
      'modules/staff/application/primary-owner-bootstrap.ts',
    ]);
    const violations: string[] = [];

    for (const file of productionTypeScriptFiles(sourceDirectory)) {
      const relativePath = relative(sourceDirectory, file);
      const contents = readFileSync(file, 'utf8');
      if (
        contents.includes('composePortalPayloadGatewayWithPrincipalResolver') &&
        !allowedPortalCompositionFiles.has(relativePath)
      ) {
        violations.push(`portal:${relativePath}`);
      }
      if (
        contents.includes('composePrimaryOwnerBootstrapSystemGateway') &&
        !allowedSystemCompositionFiles.has(relativePath)
      ) {
        violations.push(`system:${relativePath}`);
      }
    }

    expect(violations).toEqual([]);
  });

  it('keeps all Agent 10 implementation files in the owned infrastructure directory', () => {
    expect(infrastructureDirectory).toMatch(
      /src\/modules\/authorization\/infrastructure\/$/u,
    );
  });
});
