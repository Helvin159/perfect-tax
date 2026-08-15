# Attested Payload gateway

This directory is the Slice 1 security choke point for user-driven Payload
operations. It implements ADR 0010's runtime capability protocol without
changing Payload Admin, `cms-users`, collection registration, schemas, or
migrations.

## Runtime trust model

`portal-payload-gateway.ts` owns a module-private `WeakMap`. A fresh frozen
token is registered only after the injected Agent 11 resolver recognizes its
own opaque server-side source and returns a canonical operational principal.
The token is placed under an enumerable string key in Local API context. The
key is not secret; object identity in the private registry is the capability.

Each binding contains:

- one frozen active Staff/MFA-verified or active Client principal;
- one minimal `PortalPayloadUser` with the explicit `portal-principals`
  discriminator;
- Client self-ownership evidence, when the canonical principal is a Client;
- and the first Payload request object on which the token is observed.

Access succeeds only when the token is registered, the complete narrow user
exactly matches the binding, and the request is the binding's original request.
JSON reconstruction, matching fields, TypeScript brands, `Object.freeze`, role
strings, IDs, and context property names do not establish trust. A token copied
to another request is rejected, which also prevents its request-scoped
DataLoader or transaction lineage from being transferred. The registry entry
is revoked when the top-level gateway call settles, including denial and
persistence-error paths.

Every top-level gateway method omits `req`, creates a fresh user/context/token,
sets `overrideAccess: false` and `depth: 0`, and owns a fixed select. Caller
options, arbitrary queries, relationships, joins, population, field names,
Payload users, and context are not accepted.

## Agent 11 integration

Agent 11 must implement
`TrustedPortalPrincipalResolver<OpaqueAgent11Source>` at the server composition
root in `src/modules/auth/portal-principal-composition.ts`. The focused
architecture test rejects imports of the composition factory from any other
production file. The source must itself be recognized using Agent 11's private
runtime state after all of these canonical checks:

1. Better Auth validates the live session and yields its immutable
   `AuthUserId`.
2. PortalIdentity resolves exactly one matching Staff or Client binding.
3. The bound domain record exists and has an eligible status.
4. Staff is `active` and carries application-verified MFA assurance.
5. Client is `active`; Slice 1 still provisions no Client credentials.

Compose once with
`composePortalPayloadGatewayWithPrincipalResolver(payload, resolver)`. Give
application services only the resulting `PortalPayloadGateway`; do not export
the resolver, composition dependencies, Payload object, session token, or an
attestation helper. Gateway methods receive only the opaque Agent 11 source.
They never receive a browser principal or a principal-shaped object.

The composition factory is the narrow issuance seam. It does not accept a
principal directly and never returns a token. It is intentionally not re-
exported through a general authorization barrel. An enrollment principal,
disabled/inactive subject, malformed resolver output, missing source, or
throwing resolver is rejected before Payload runs.

One gateway call is one top-level Payload request. Agent 11 and feature code
must not retain a `PayloadRequest`, context, token, DataLoader, or transaction
for another call or principal.

## Agent 12 integration

`composePrimaryOwnerBootstrapSystemGateway` is separate from every Staff role.
Agent 12 composes it only from
`src/modules/staff/application/primary-owner-bootstrap.ts`; the architecture
test rejects other production imports. Agent 12 supplies two private resolvers:

- a non-web invocation source that resolves only to
  `primary-owner-bootstrap`; and
- a canonical create-result source that resolves to the newly created primary
  owner Staff ID.

The returned gateway opens a bounded asynchronous scope requiring the exact
`initial-primary-owner-provisioning` reason code and a UUID correlation/job/
request ID. Inside the scope, Agent 12 may pass `scope.context` to its one
allowlisted Payload create and use `authorizePrimaryOwnerBootstrap` when
constructing `createStaffCollection`. The capability binds to the first
Payload request and is revoked when the callback ends.

The scope supplies a targetless failure audit source and can derive a success
audit source only through the trusted target resolver. Pass the returned
`auditSourceResolver` to Agent 7's recorder and record the event before the
scope ends. Agent 10 does not create the Staff record, credentials,
PortalIdentity, MFA enrollment, advisory lock, transaction, or CLI.

## Agent 13 collection composition

**Clients must not be registered unchanged.** Its current collection has no
fail-closed access configuration.

Agent 13 must create the reviewed private collection registration and attach:

- `portalClientCollectionAccess` as the collection access contract;
- `portalClientFieldAccess.read` only to fields approved for portal response;
- explicit denial for unimplemented mutation paths; and
- `requireAttestedPortalRequest(req)` in any security-sensitive hook before a
  side effect or nested operation.

The current gateway projections contain only Client summary fields and the
current Client's own contact email. Do not attach portal field access to future
relationships, joins, private tax data, documents, assignments, credentials,
or identity fields without a separate review. Nested operations must pass the
same `req`; no hook may substitute user/context/principal data. Relationship
fields must remain outside selects even at depth zero because raw IDs can leak.

Agent 13 remains responsible for registration and any CMS-side collection
composition. CMS users do not pass these portal access functions, and a portal
user is never a `cms-users` identity.

## Agent 14 database handoff

This gateway assumes only the existing numeric `ClientId`/`StaffId` contracts
and the existing `clients` collection slug. It adds no table, field, index,
constraint, role, grant, migration, generated Payload type, or physical-schema
decision. Agent 14 must not infer a schema-ownership choice from this module.

Database-backed collection access, hooks, relationship population, and
transaction propagation tests remain an integration step after Agent 13
registration and Agent 14 migrations exist. The maintained unit tests here
cover the production capability checks, fixed Local API arguments, Payload
3.86 `createLocalReq` token propagation, request/DataLoader isolation contract,
nested same-request behavior, and cross-request rejection.
