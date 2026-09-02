# Security-event provenance handoff

Security-event structure is not evidence of identity provenance. Callers must
never build `actor`, `actorId`, `target`, or `targetId` fields for a recorder.

## Agent 11: principal events

At the trusted principal composition boundary, instantiate the recorder with a
`TrustedPrincipalSourceResolver<YourOpaqueAttestedPrincipalSource>`. The source
type must be Agent 10/11's opaque runtime-attested object, and `resolvePrincipal`
must resolve it from the private capability registry to the canonical frozen
`PortalPrincipal`. It must not parse JSON, inspect caller-supplied properties,
accept a reconstructed principal, or treat TypeScript branding as provenance.

Feature code receives only `PrincipalSecurityEventRecorder` and calls:

```text
recordPrincipalSecurityEvent(attestedPrincipalSource, {
  action,
  correlationId?,
  metadata,
  targetSource?,
})
```

The recorder derives the actor from the resolved principal. It rejects request
objects containing `actor` or `target`. When a target is required, a separate
`TrustedTargetSourceResolver` must recognize an opaque source bound to a
canonical record loaded through the trusted repository/gateway boundary. An ID
or object assembled by feature code is not a target source.

## Agent 12: primary-owner bootstrap

The non-web bootstrap system gateway owns an opaque capability object registered
in its private runtime capability registry. Its `TrustedSystemSourceResolver`
must resolve that exact object identity to all of:

- operation: `primary-owner-bootstrap`;
- reason code: `initial-primary-owner-provisioning`; and
- the canonical newly created Staff target for a successful bootstrap.

Bootstrap calls:

```text
recordSystemSecurityEvent(privateBootstrapSource, {
  action: 'primary-owner.bootstrap.succeeded' | 'primary-owner.bootstrap.failed',
  correlationId?,
})
```

Operation, reason, system actor, and success target are derived from the private
source; bootstrap does not pass them in the request. A success source without a
Staff target and a failure source with any target both fail structural
validation. Never export a capability issuer or accept operation/reason strings
as a substitute for capability recognition.

## Composition constraint

Only the trusted server composition boundary receives the append port and the
three resolvers. Ordinary Client/Staff feature code receives a narrowed recorder
interface, never the append port, Payload factory, resolver, capability registry,
or persistence capability. Resolver behavior requires runtime object-identity
attestation; a lookalike object, serialized/reconstructed value, branded string,
session token, or API token must resolve to `undefined` and fail closed.
