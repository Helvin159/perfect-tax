# Attested Payload gateways

This directory is Agent 10's server-only authorization choke point. Agent 10
currently contains the capability registries, issuers, verifiers, fixed Payload
ports, Agent 8 policy integration, and the audited system-operation envelope.
It intentionally exports no production portal or system gateway capable of
minting authority. Production issuance remains fail closed until Agents 11 and
12 complete the concrete compositions in these same modules.

## Portal capability boundary

`portal-payload-gateway.ts` owns module-private `WeakMap` registries. Its
private composition function resolves an opaque source, creates a fresh frozen
token, and registers the canonical operational principal, narrow
`PortalPayloadUser`, canonical Client ownership evidence, and first Payload
request object. The issuer, resolver interface, composition function, and
registries are not exported.

The exported collection/field access functions can only verify a token already
present in the private registry. A token-like object, context property name,
role string, parsed/frozen/serialized/reconstructed principal, matching user,
or copied request establishes no authority. Every private gateway operation
revokes its token and ownership evidence in `finally`.

The private gateway owns `overrideAccess: false`, `depth: 0`, the collection,
the narrow user, context, pagination, sort, IDs, and fixed projections. It
accepts no caller-controlled Payload request, user, context, select, depth,
relationship population, assignment evidence, or ownership evidence. Agent 8
policy decisions remain authoritative; Case Worker access fails closed because
Slice 1 has no canonical assignment persistence.

Current portal runtime exports are verification and collection-composition
utilities only:

- `PortalPayloadAuthorizationError` and `PortalPayloadPersistenceError`:
  errors; neither issues nor verifies authority.
- `resolveAttestedPortalRequest`: verifies a registered capability, exact user,
  and exact request binding; it cannot register a capability.
- `authorizePortalClientRead` and `authorizePortalClientFieldRead`: verify the
  private capability and apply Agent 8 policy.
- `portalClientCollectionAccess` and `portalClientFieldAccess`: frozen,
  fail-closed access contracts built from those verifiers.
- `requireAttestedPortalRequest`: verifier that throws on denial.

The type-only DTO, narrow gateway, and Payload-user exports carry no runtime
issuance path.

## Agent 11 handoff

Agent 11 may complete `portal-payload-gateway.ts`; it must not create a second
composition module or export the private factory. The completed module must
directly import Agent 11's concrete
`resolveCanonicalPortalPrincipalFromSession` implementation from
`src/modules/auth/portal-principal-composition.ts`, close over it with the
existing private issuer, and export only the final narrowed portal gateway (or
its fixed operations). There must be no resolver/predicate/dependency argument
on that final export.

The concrete resolver must establish, in order:

1. Better Auth validates the live session and yields its immutable
   `AuthUserId`.
2. Exactly one `PortalIdentity` binds that auth user to Staff or Client.
3. The canonical Staff/Client record exists and is eligible.
4. Staff is active and has application-verified MFA assurance.
5. Client is active; Agent 11 must not infer ownership from caller input.

Only after those facts resolve may the existing private issuer register a
capability. Enrollment, inactive/disabled, missing, duplicated, malformed, or
throwing resolution fails before Payload. Agent 11 must not export a generic
resolver-driven gateway factory, principal attester, or capability issuer.

## System capability and audit boundary

`system-payload-gateway.ts` owns separate private `WeakMap` namespaces for the
system request capability and Agent 7 audit provenance. Its source resolver,
target resolver, audit-source type, audit resolver, composition function, and
gateway are all private. The application Owner role has no conversion path to
a system capability.

The bounded private envelope validates the sole operation
`primary-owner-bootstrap`, the fixed reason
`initial-primary-owner-provisioning`, and a UUID correlation ID before issuing
the request capability. The privileged callback receives only the fixed
operation/reason and request context. It never receives an audit source,
recorder, capability object, or correlation control.

The envelope owns terminal auditing:

- A successful action must return a target source recognized by the private
  target resolver. The envelope appends exactly one
  `primary-owner.bootstrap.succeeded` event before returning the result.
- A thrown action or invalid target appends exactly one
  `primary-owner.bootstrap.failed` event before propagating the failure.
- If the required append fails, the invocation fails closed. A failed success
  append does not trigger a second terminal-event attempt, avoiding an
  accidental success/failure pair.

The validated correlation ID is stored only in trusted system provenance.
Agent 7's system recorder request accepts only the action and copies correlation
from that provenance, so the callback cannot omit or replace it. Event actor,
operation, reason, and success target are also server derived. Capability,
principal, credential/session/MFA material, full request bodies, and private
Client data never enter the event request.

This contract prevents a successful return without the audit append. It does
not yet claim database atomicity: Agent 12/14 must put the privileged writes
and SecurityEvent append in the same database transaction so append failure
also rolls back the write.

Current system runtime exports are non-issuing:

- `SYSTEM_PAYLOAD_GATEWAY_ERROR_CODES` and
  `SystemPayloadGatewayAuthorizationError`: vocabulary/error only.
- `authorizePrimaryOwnerBootstrapRequest`: verifies a private capability and
  exact request binding; it cannot issue one.
- `isPrimaryOwnerBootstrapOperation`: validates the one-operation vocabulary;
  it conveys no authority.

`PrimaryOwnerBootstrapRequest` and error-code exports are type-only where
applicable and cannot mint authority.

## Agent 12 handoff

Agent 12 may complete `system-payload-gateway.ts`. It must directly import its
concrete private, non-web `primary-owner-bootstrap` invocation resolver and the
canonical created-Staff target resolver into that module, then construct Agent
7's real Payload-backed recorder against the module-private audit resolver.
The existing issuer and composition function remain unexported. The final
export may expose only the narrowed audited bootstrap operation and the request
authorization verifier needed by the Staff collection composition.

Agent 12 owns Staff creation, Better Auth credentials, PortalIdentity creation,
advisory locking, transaction integration, CLI behavior, and MFA enrollment.
It must not create a parallel capability, resolver-injection factory, optional
audit path, or role-to-system-capability conversion. The sole current system
operation remains `primary-owner-bootstrap`.

## Test-only private composition

Successful issuance behavior is tested in source under `import.meta.vitest`.
Vitest injects that module-local test API only for the two explicitly listed
Agent 10 source files. Normal production imports expose none of the private
factories or test dependencies, and another module cannot set another module's
`import.meta`. The ordinary `.test.ts` consumers import the complete runtime
namespaces and prove that fake resolvers, valid-looking Owner/Client values,
lookalike contexts, and source declarations cannot reach an issuer.

The source/import architecture test is defense in depth only. JavaScript
module-private state plus the absence of any exported issuance call path is the
runtime security boundary.

## Agent 13 and Agent 14 notes

Agent 13 must register Clients with the exported fail-closed collection and
field contracts, explicitly deny unimplemented mutations, and preserve the
same request object through security-sensitive hooks. CMS users remain outside
this portal identity path.

Agent 14 remains responsible for physical schema and transaction decisions.
Agent 10 adds no table, field, index, constraint, grant, migration, generated
Payload type, or PostgreSQL integration claim.
