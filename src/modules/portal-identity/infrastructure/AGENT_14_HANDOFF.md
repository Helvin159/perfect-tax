# PortalIdentity database handoff for Agent 14

PortalIdentity is an application-owned, immutable account-to-subject binding.
It does not belong in Better Auth's `portal_auth` schema and must not be linked
to either Staff or Client by email. Agent 13 owns collection registration;
Agent 14 owns the reviewed migration and physical constraint names.

## Required columns

- Payload primary key and its conventional `created_at` / `updated_at` columns.
- `auth_user_id`: non-null opaque string, maximum 255 characters.
- `subject_type`: non-null value restricted to `staff` or `client`.
- `staff_id`: nullable foreign key to `staff.id`.
- `client_id`: nullable foreign key to `clients.id`.

Use `ON DELETE RESTRICT` (or the repository's equivalent no-action behavior)
for both domain foreign keys. A domain subject must not be deleted while its
authentication binding still exists.

## Mandatory database constraints

The final migration must provide all of these race-safe constraints; Payload
field metadata and application hooks are defense in depth, not substitutes:

1. `UNIQUE (auth_user_id)`.
2. `UNIQUE (staff_id)` for non-null Staff references.
3. `UNIQUE (client_id)` for non-null Client references.
4. A subject-type/exclusivity check logically equivalent to:

   ```sql
   CHECK (
     (subject_type = 'staff' AND staff_id IS NOT NULL AND client_id IS NULL)
     OR
     (subject_type = 'client' AND client_id IS NOT NULL AND staff_id IS NULL)
   )
   ```

The check also rejects missing-subject, dual-subject, and type/relation mismatch
rows. Separate Staff and Client unique constraints are intentional: equal
numeric IDs from different domain tables do not represent the same subject.
The Staff-who-is-also-Client case remains deferred and must not be inferred by
matching contact data.

## Immutability

Application hooks reject every PortalIdentity update, including a submitted
unchanged binding. The migration must preserve the same rule for privileged or
out-of-band SQL: revoke ordinary `UPDATE` access to this table and/or add a
trigger that rejects changes to `auth_user_id`, `subject_type`, `staff_id`, and
`client_id`. No delete workflow is introduced by Agent 6; any later teardown
service requires its own reviewed lifecycle and audit design.

## Minimum Agent 11 read shape

The server-only repository returns exactly Agent 2's frozen union:

- `{ authUserId, subjectKind: 'staff', staffId }`, or
- `{ authUserId, subjectKind: 'client', clientId }`.

It provides lookups by opaque `authUserId`, Staff ID, and Client ID. It exports
no Payload-facing user shape, runtime attestation, credential operation, email,
role, status, MFA, invitation, CMS, assignment, or write capability.
