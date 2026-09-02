\set ON_ERROR_STOP on

-- Run as the Payload migration role after every reviewed Payload migration.
-- The runtime role gets normal Payload CMS DML, then the four operational
-- tables are narrowed to the approved Slice 1 services.

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO :"payload_runtime_role";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO :"payload_runtime_role";

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.payload_migrations FROM :"payload_runtime_role";
GRANT SELECT ON TABLE public.payload_migrations TO :"payload_runtime_role";

REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.staff FROM :"payload_runtime_role";
GRANT SELECT, INSERT ON TABLE public.staff TO :"payload_runtime_role";
REVOKE SELECT ON SEQUENCE public.staff_id_seq FROM :"payload_runtime_role";
GRANT USAGE ON SEQUENCE public.staff_id_seq TO :"payload_runtime_role";

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.clients FROM :"payload_runtime_role";
GRANT SELECT ON TABLE public.clients TO :"payload_runtime_role";
REVOKE ALL ON SEQUENCE public.clients_id_seq FROM :"payload_runtime_role";

REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.portal_identities FROM :"payload_runtime_role";
GRANT SELECT, INSERT ON TABLE public.portal_identities TO :"payload_runtime_role";
REVOKE SELECT ON SEQUENCE public.portal_identities_id_seq FROM :"payload_runtime_role";
GRANT USAGE ON SEQUENCE public.portal_identities_id_seq TO :"payload_runtime_role";

REVOKE ALL ON TABLE public.security_events FROM :"payload_runtime_role";
REVOKE ALL ON SEQUENCE public.security_events_id_seq FROM :"payload_runtime_role";

REVOKE ALL ON FUNCTION public.perfect_tax_protect_primary_owner() FROM PUBLIC, :"payload_runtime_role";
REVOKE ALL ON FUNCTION public.perfect_tax_protect_client_number() FROM PUBLIC, :"payload_runtime_role";
REVOKE ALL ON FUNCTION public.perfect_tax_reject_immutable_table_mutation() FROM PUBLIC, :"payload_runtime_role";
REVOKE ALL ON FUNCTION public.perfect_tax_security_event_metadata_is_scalar(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.perfect_tax_security_event_metadata_is_scalar(jsonb) FROM :"payload_runtime_role";
REVOKE ALL ON FUNCTION public.perfect_tax_append_security_event(
  timestamp with time zone,
  public.enum_security_events_action,
  public.enum_security_events_actor_kind,
  varchar,
  public.enum_security_events_target_type,
  varchar,
  varchar,
  jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.perfect_tax_append_security_event(
  timestamp with time zone,
  public.enum_security_events_action,
  public.enum_security_events_actor_kind,
  varchar,
  public.enum_security_events_target_type,
  varchar,
  varchar,
  jsonb
) TO :"payload_runtime_role";
