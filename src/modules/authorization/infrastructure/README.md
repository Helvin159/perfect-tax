# Attested Payload gateways

This directory is Agent 10's server-only authorization choke point. It contains
the capability registries, issuers, verifiers, fixed Payload ports, Agent 8
policy integration, and the audited system-operation envelope. Agent 11
completed the portal composition in this same module. Agent 12 completed the
separate concrete primary-owner composition, which remains deployment-readiness
blocked until Agents 13 and 14 register and physically prove its persistence
boundary.

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
the narrow user, context, pagination, sort, IDs, and fixed projections. Its
private concrete Payload port resolves the configured Payload runtime and is
not exported or injectable. The gateway accepts no caller-controlled Payload
request, instance, user, context, select, depth, relationship population,
assignment evidence, or ownership evidence. Agent 8 policy decisions remain
authoritative; Case Worker access fails closed because Slice 1 has no canonical
assignment persistence.

Current portal runtime exports are verification, collection-composition, and
one final operational entrypoint only:

- `PortalPayloadAuthorizationError` and `PortalPayloadPersistenceError`:
  errors; neither issues nor verifies authority.
- `resolveAttestedPortalRequest`: verifies a registered capability, exact user,
  and exact request binding; it cannot register a capability.
- `authorizePortalClientRead` and `authorizePortalClientFieldRead`: verify the
  private capability and apply Agent 8 policy.
- `portalClientCollectionAccess` and `portalClientFieldAccess`: frozen,
  fail-closed access contracts built from those verifiers.
- `requireAttestedPortalRequest`: verifier that throws on denial.
- `portalPayloadGateway`: the fixed production gateway. Its methods accept only
  request `Headers`; every invocation calls Agent 11's concrete resolver before
  the module-private Agent 10 issuer is reachable.

The type-only DTO, narrow gateway, and Payload-user exports carry no runtime
issuance path.

## Agent 11 closed composition

`src/modules/auth/portal-principal-composition.ts` is the concrete canonical
resolver. It establishes, in order:

1. Better Auth validates the live session and yields its immutable
   `AuthUserId`.
2. Exactly one `PortalIdentity` binds that auth user to Staff or Client.
3. The canonical Staff/Client record exists and is eligible.
4. Staff is active and has application-verified MFA assurance.
5. Client is active; Agent 11 must not infer ownership from caller input.

The resolver returns an explicit frozen `authorized`, `enrollment-only`, or
`denied` result. Its narrow session projection carries only the independent
freshness boolean needed by future sensitive operations; freshness is not
added to the principal and is not required for ordinary authorized work. The
result remains ordinary application data and has no runtime authority.

Slice 1 has no approved Client credential provisioning or activation path. The
resolver validates a Client binding and canonical status but returns `denied`
even when that Client is active. Slice 2 must deliberately replace this policy
when its provisioning boundary is approved; email matching can never do so.

`portal-payload-gateway.ts` directly imports the concrete resolver and is the
only module with lexical access to Agent 10's private issuer. It exports the
fixed `portalPayloadGateway` and accepts no resolver, predicate, Payload
instance, or other dependency argument. Enrollment, inactive/disabled,
missing, duplicated, malformed, or throwing resolution fails before Payload.
No generic resolver-driven gateway factory, principal attester, or capability
issuer is exported.

The production Better Auth route also uses Agent 11's separate canonical
active-Staff subject predicate for the already-reviewed Agent 9 MFA enrollment
boundary. That predicate resolves only `AuthUserId -> PortalIdentity -> Staff`
and cannot infer Staff identity from email or browser properties.

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

The envelope owns terminal auditing and transaction settlement:

- A successful action must return a target source recognized by the private
  target resolver. That source privately carries the canonical Staff target and
  transaction settlement. The envelope appends exactly one
  `primary-owner.bootstrap.succeeded` event in the same transaction, commits,
  and only then returns the result.
- A thrown action or invalid target appends exactly one
  `primary-owner.bootstrap.failed` event after privileged application state is
  rolled back and before propagating the failure.
- If the required append fails, the invocation fails closed. A failed success
  append rolls back Staff, PortalIdentity, and the uncommitted event together.
  It does not trigger a second terminal-event attempt, avoiding an accidental
  success/failure pair.

The validated correlation ID is stored only in trusted system provenance.
Agent 7's system recorder request accepts only the action and copies correlation
from that provenance, so the callback cannot omit or replace it. Event actor,
operation, reason, and success target are also server derived. Capability,
principal, credential/session/MFA material, full request bodies, and private
Client data never enter the event request.

This contract prevents a successful return without the audit append and
transaction commit. Agent 12 uses one Payload request/transaction for Staff,
PortalIdentity, and the success event, but does not claim a real PostgreSQL
proof before Agent 14/15 migration and integration work.

Current system runtime exports are non-issuing:

- `SYSTEM_PAYLOAD_GATEWAY_ERROR_CODES` and
  `SystemPayloadGatewayAuthorizationError`: vocabulary/error only.
- `authorizePrimaryOwnerBootstrapRequest`: verifies a private capability and
  exact request binding; it cannot issue one.
- `isPrimaryOwnerBootstrapOperation`: validates the one-operation vocabulary;
  it conveys no authority.

`PrimaryOwnerBootstrapRequest` and error-code exports are type-only where
applicable and cannot mint authority.

## Agent 12 closed composition

`system-payload-gateway.ts` now directly owns the concrete private non-web
invocation source, canonical created-Staff target source, Agent 7 Payload-backed
recorders, and direct command execution. Its fixed executor uses Agent 3's
credential provisioner and Agent 12's narrow persistence runtime. The runner,
dependency object, sources, registries, resolvers, recorder composition,
settlement sources, and gateway remain unexported.

The package command directly executes this module under the `react-server`
condition. It is the only place the private runner is handed to the command
adapter. Imports from ordinary modules can reach only non-issuing verifiers and
error/vocabulary exports; Owner and Administrator principals have no conversion
path to a system source.

The concrete operation holds a PostgreSQL session advisory lock from canonical
preflight through terminal settlement. It rechecks Owner evidence inside the
application transaction, creates fixed active primary Owner state, binds the
Agent 3 `AuthUserId` explicitly through PortalIdentity, and leaves MFA state
untouched. Agent 11 therefore yields enrollment-only authority until Agent 9
TOTP verification succeeds.

Current production execution rejects readiness before capability issuance or
credential creation. See
`src/modules/staff/application/PRIMARY_OWNER_BOOTSTRAP_HANDOFF.md` for exact
Agent 13/14 activation requirements and proof limits.

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

Agent 14 remains responsible for physical schema and final transaction proof.
Agent 10/12 add no table, field, index, constraint, grant, migration, generated
Payload type, or schema-ownership decision.
