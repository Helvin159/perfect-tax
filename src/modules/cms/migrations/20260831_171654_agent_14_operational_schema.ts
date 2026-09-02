import {
  sql,
  type MigrateDownArgs,
  type MigrateUpArgs,
} from '@payloadcms/db-postgres';

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   SET LOCAL search_path TO public;
   CREATE TYPE "public"."enum_staff_role" AS ENUM('owner', 'administrator', 'case-worker', 'intake');
  CREATE TYPE "public"."enum_staff_status" AS ENUM('active', 'disabled');
  CREATE TYPE "public"."enum_clients_status" AS ENUM('active', 'inactive');
  CREATE TYPE "public"."enum_portal_identities_subject_type" AS ENUM('staff', 'client');
  CREATE TYPE "public"."enum_security_events_action" AS ENUM('primary-owner.bootstrap.succeeded', 'primary-owner.bootstrap.failed', 'authentication.succeeded', 'authentication.failed', 'session.ended', 'mfa.enrollment.succeeded', 'mfa.verification.succeeded', 'mfa.verification.failed', 'domain-subject.disabled', 'authorization.denied');
  CREATE TYPE "public"."enum_security_events_actor_kind" AS ENUM('anonymous', 'system', 'auth-user', 'staff', 'client', 'staff-enrollment');
  CREATE TYPE "public"."enum_security_events_target_type" AS ENUM('auth-user', 'staff', 'client');
  CREATE TABLE "staff" (
    "id" serial PRIMARY KEY NOT NULL,
    "first_name" varchar NOT NULL,
    "last_name" varchar NOT NULL,
    "work_email" varchar NOT NULL,
    "role" "enum_staff_role" NOT NULL,
    "status" "enum_staff_status" NOT NULL,
    "is_primary_owner" boolean DEFAULT false NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "clients" (
    "id" serial PRIMARY KEY NOT NULL,
    "client_number" varchar NOT NULL,
    "first_name" varchar NOT NULL,
    "last_name" varchar NOT NULL,
    "contact_email" varchar NOT NULL,
    "status" "enum_clients_status" DEFAULT 'active' NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "portal_identities" (
    "id" serial PRIMARY KEY NOT NULL,
    "auth_user_id" varchar NOT NULL,
    "subject_type" "enum_portal_identities_subject_type" NOT NULL,
    "staff_id" integer,
    "client_id" integer,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "security_events" (
    "id" serial PRIMARY KEY NOT NULL,
    "occurred_at" timestamp(3) with time zone NOT NULL,
    "action" "enum_security_events_action" NOT NULL,
    "actor_kind" "enum_security_events_actor_kind" NOT NULL,
    "actor_id" varchar,
    "target_type" "enum_security_events_target_type",
    "target_id" varchar,
    "correlation_id" varchar,
    "metadata" jsonb NOT NULL
  );

  ALTER TABLE "portal_identities" ADD CONSTRAINT "portal_identities_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE restrict ON UPDATE no action;
  ALTER TABLE "portal_identities" ADD CONSTRAINT "portal_identities_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;
  CREATE UNIQUE INDEX "staff_work_email_idx" ON "staff" USING btree ("work_email");
  CREATE INDEX "staff_is_primary_owner_idx" ON "staff" USING btree ("is_primary_owner");
  CREATE INDEX "staff_updated_at_idx" ON "staff" USING btree ("updated_at");
  CREATE INDEX "staff_created_at_idx" ON "staff" USING btree ("created_at");
  CREATE UNIQUE INDEX "clients_client_number_idx" ON "clients" USING btree ("client_number");
  CREATE INDEX "clients_updated_at_idx" ON "clients" USING btree ("updated_at");
  CREATE INDEX "clients_created_at_idx" ON "clients" USING btree ("created_at");
  CREATE UNIQUE INDEX "portal_identities_auth_user_id_idx" ON "portal_identities" USING btree ("auth_user_id");
  CREATE UNIQUE INDEX "portal_identities_staff_idx" ON "portal_identities" USING btree ("staff_id");
  CREATE UNIQUE INDEX "portal_identities_client_idx" ON "portal_identities" USING btree ("client_id");
  CREATE INDEX "portal_identities_updated_at_idx" ON "portal_identities" USING btree ("updated_at");
  CREATE INDEX "portal_identities_created_at_idx" ON "portal_identities" USING btree ("created_at");
  CREATE INDEX "security_events_occurred_at_idx" ON "security_events" USING btree ("occurred_at");
  CREATE INDEX "security_events_action_idx" ON "security_events" USING btree ("action");
  CREATE INDEX "security_events_correlation_id_idx" ON "security_events" USING btree ("correlation_id");

  ALTER TABLE "staff"
    ADD CONSTRAINT "staff_first_name_length_check" CHECK (char_length("first_name") BETWEEN 1 AND 100),
    ADD CONSTRAINT "staff_last_name_length_check" CHECK (char_length("last_name") BETWEEN 1 AND 100),
    ADD CONSTRAINT "staff_work_email_length_check" CHECK (char_length("work_email") BETWEEN 1 AND 254),
    ADD CONSTRAINT "staff_owner_marker_check" CHECK (("role" = 'owner') = "is_primary_owner"),
    ADD CONSTRAINT "staff_primary_owner_active_check" CHECK (NOT "is_primary_owner" OR "status" = 'active');
  CREATE UNIQUE INDEX "staff_work_email_lower_idx" ON "staff" (lower("work_email"));
  CREATE UNIQUE INDEX "staff_primary_owner_unique_idx" ON "staff" ("is_primary_owner") WHERE "is_primary_owner";

  CREATE FUNCTION "public"."perfect_tax_protect_primary_owner"() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = pg_catalog, public
  AS $$
  BEGIN
    IF TG_OP = 'DELETE' THEN
      IF OLD."role" = 'owner' OR OLD."is_primary_owner" THEN
        RAISE EXCEPTION 'primary owner mutation is prohibited' USING ERRCODE = '42501';
      END IF;
      RETURN OLD;
    END IF;

    IF OLD."role" = 'owner' OR OLD."is_primary_owner" THEN
      IF NEW."role" <> 'owner' OR NOT NEW."is_primary_owner" OR NEW."status" <> 'active' THEN
        RAISE EXCEPTION 'primary owner mutation is prohibited' USING ERRCODE = '42501';
      END IF;
    ELSIF NEW."role" = 'owner' OR NEW."is_primary_owner" THEN
      RAISE EXCEPTION 'primary owner promotion is prohibited' USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
  END;
  $$;
  CREATE TRIGGER "staff_protect_primary_owner_trigger"
    BEFORE UPDATE OR DELETE ON "staff"
    FOR EACH ROW EXECUTE FUNCTION "public"."perfect_tax_protect_primary_owner"();

  ALTER TABLE "clients"
    ADD CONSTRAINT "clients_client_number_format_check" CHECK ("client_number" ~ '^CL-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$'),
    ADD CONSTRAINT "clients_first_name_length_check" CHECK (char_length("first_name") BETWEEN 1 AND 100),
    ADD CONSTRAINT "clients_last_name_length_check" CHECK (char_length("last_name") BETWEEN 1 AND 100),
    ADD CONSTRAINT "clients_contact_email_length_check" CHECK (char_length("contact_email") BETWEEN 1 AND 254);

  CREATE FUNCTION "public"."perfect_tax_protect_client_number"() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = pg_catalog, public
  AS $$
  BEGIN
    IF OLD."client_number" IS DISTINCT FROM NEW."client_number" THEN
      RAISE EXCEPTION 'client number mutation is prohibited' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END;
  $$;
  CREATE TRIGGER "clients_protect_client_number_trigger"
    BEFORE UPDATE ON "clients"
    FOR EACH ROW EXECUTE FUNCTION "public"."perfect_tax_protect_client_number"();

  ALTER TABLE "portal_identities"
    ADD CONSTRAINT "portal_identities_auth_user_id_check" CHECK (
      char_length("auth_user_id") BETWEEN 1 AND 255
      AND btrim("auth_user_id") = "auth_user_id"
    ),
    ADD CONSTRAINT "portal_identities_subject_check" CHECK (
      ("subject_type" = 'staff' AND "staff_id" IS NOT NULL AND "client_id" IS NULL)
      OR
      ("subject_type" = 'client' AND "client_id" IS NOT NULL AND "staff_id" IS NULL)
    );

  CREATE FUNCTION "public"."perfect_tax_reject_immutable_table_mutation"() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = pg_catalog, public
  AS $$
  BEGIN
    RAISE EXCEPTION 'immutable table mutation is prohibited' USING ERRCODE = '42501';
  END;
  $$;
  CREATE TRIGGER "portal_identities_immutable_row_trigger"
    BEFORE UPDATE OR DELETE ON "portal_identities"
    FOR EACH ROW EXECUTE FUNCTION "public"."perfect_tax_reject_immutable_table_mutation"();
  CREATE TRIGGER "portal_identities_immutable_truncate_trigger"
    BEFORE TRUNCATE ON "portal_identities"
    FOR EACH STATEMENT EXECUTE FUNCTION "public"."perfect_tax_reject_immutable_table_mutation"();

  CREATE FUNCTION "public"."perfect_tax_security_event_metadata_is_scalar"(value jsonb) RETURNS boolean
  LANGUAGE sql
  IMMUTABLE
  STRICT
  SET search_path = pg_catalog
  AS $$
    SELECT jsonb_typeof(value) = 'object'
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_each(value) AS entry
        WHERE jsonb_typeof(entry.value) NOT IN ('boolean', 'string')
      )
  $$;

  ALTER TABLE "security_events"
    ADD CONSTRAINT "security_events_actor_check" CHECK (
      (("actor_kind" IN ('anonymous', 'system')) AND "actor_id" IS NULL)
      OR
      (("actor_kind" IN ('auth-user', 'staff', 'client', 'staff-enrollment'))
        AND "actor_id" IS NOT NULL
        AND char_length("actor_id") BETWEEN 1 AND 255)
    ),
    ADD CONSTRAINT "security_events_target_check" CHECK (
      ("target_type" IS NULL AND "target_id" IS NULL)
      OR
      ("target_type" IS NOT NULL
        AND "target_id" IS NOT NULL
        AND char_length("target_id") BETWEEN 1 AND 255)
    ),
    ADD CONSTRAINT "security_events_correlation_id_check" CHECK (
      "correlation_id" IS NULL
      OR (
        char_length("correlation_id") = 36
        AND "correlation_id" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      )
    ),
    ADD CONSTRAINT "security_events_metadata_check" CHECK (
      "public"."perfect_tax_security_event_metadata_is_scalar"("metadata")
    ),
    ADD CONSTRAINT "security_events_action_shape_check" CHECK (
      CASE "action"
        WHEN 'primary-owner.bootstrap.succeeded' THEN
          "actor_kind" = 'system' AND "actor_id" IS NULL AND "target_type" = 'staff' AND "target_id" IS NOT NULL
        WHEN 'primary-owner.bootstrap.failed' THEN
          "actor_kind" = 'system' AND "actor_id" IS NULL AND "target_type" IS NULL AND "target_id" IS NULL
        WHEN 'authentication.succeeded' THEN
          "actor_kind" = 'auth-user' AND "actor_id" IS NOT NULL AND "target_type" IS NULL AND "target_id" IS NULL
        WHEN 'authentication.failed' THEN
          "actor_kind" IN ('anonymous', 'auth-user') AND "target_type" IS NULL AND "target_id" IS NULL
        WHEN 'mfa.enrollment.succeeded' THEN
          "actor_kind" = 'staff-enrollment' AND "actor_id" IS NOT NULL AND "target_type" IS NULL AND "target_id" IS NULL
        WHEN 'mfa.verification.succeeded' THEN
          "actor_kind" = 'staff-enrollment' AND "actor_id" IS NOT NULL AND "target_type" IS NULL AND "target_id" IS NULL
        WHEN 'mfa.verification.failed' THEN
          "actor_kind" = 'staff-enrollment' AND "actor_id" IS NOT NULL AND "target_type" IS NULL AND "target_id" IS NULL
        WHEN 'domain-subject.disabled' THEN
          "actor_kind" IN ('staff', 'system') AND "target_type" IN ('staff', 'client') AND "target_id" IS NOT NULL
        WHEN 'session.ended' THEN true
        WHEN 'authorization.denied' THEN true
        ELSE false
      END
    );

  CREATE FUNCTION "public"."perfect_tax_append_security_event"(
    event_occurred_at timestamp with time zone,
    event_action "public"."enum_security_events_action",
    event_actor_kind "public"."enum_security_events_actor_kind",
    event_actor_id varchar,
    event_target_type "public"."enum_security_events_target_type",
    event_target_id varchar,
    event_correlation_id varchar,
    event_metadata jsonb
  ) RETURNS integer
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = pg_catalog, public
  AS $$
    INSERT INTO public.security_events (
      occurred_at,
      action,
      actor_kind,
      actor_id,
      target_type,
      target_id,
      correlation_id,
      metadata
    ) VALUES (
      event_occurred_at,
      event_action,
      event_actor_kind,
      event_actor_id,
      event_target_type,
      event_target_id,
      event_correlation_id,
      event_metadata
    )
    RETURNING id
  $$;
  REVOKE ALL ON FUNCTION "public"."perfect_tax_append_security_event"(
    timestamp with time zone,
    "public"."enum_security_events_action",
    "public"."enum_security_events_actor_kind",
    varchar,
    "public"."enum_security_events_target_type",
    varchar,
    varchar,
    jsonb
  ) FROM PUBLIC;
  CREATE TRIGGER "security_events_immutable_row_trigger"
    BEFORE UPDATE OR DELETE ON "security_events"
    FOR EACH ROW EXECUTE FUNCTION "public"."perfect_tax_reject_immutable_table_mutation"();
  CREATE TRIGGER "security_events_immutable_truncate_trigger"
    BEFORE TRUNCATE ON "security_events"
    FOR EACH STATEMENT EXECUTE FUNCTION "public"."perfect_tax_reject_immutable_table_mutation"();

  COMMENT ON TABLE "public"."staff" IS 'perfect-tax:migration-owner=payload;ledger=public.payload_migrations;migration=20260831_171654_agent_14_operational_schema';
  COMMENT ON TABLE "public"."clients" IS 'perfect-tax:migration-owner=payload;ledger=public.payload_migrations;migration=20260831_171654_agent_14_operational_schema';
  COMMENT ON TABLE "public"."portal_identities" IS 'perfect-tax:migration-owner=payload;ledger=public.payload_migrations;migration=20260831_171654_agent_14_operational_schema';
  COMMENT ON TABLE "public"."security_events" IS 'perfect-tax:migration-owner=payload;ledger=public.payload_migrations;migration=20260831_171654_agent_14_operational_schema';`);
}

export async function down({
  db,
  payload,
  req,
}: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  SET LOCAL search_path TO public;
  DROP FUNCTION "public"."perfect_tax_append_security_event"(
    timestamp with time zone,
    "public"."enum_security_events_action",
    "public"."enum_security_events_actor_kind",
    varchar,
    "public"."enum_security_events_target_type",
    varchar,
    varchar,
    jsonb
  );
  DROP TABLE "portal_identities";
  DROP TABLE "security_events";
  DROP TABLE "staff";
  DROP TABLE "clients";
  DROP FUNCTION "public"."perfect_tax_security_event_metadata_is_scalar"(jsonb);
  DROP FUNCTION "public"."perfect_tax_reject_immutable_table_mutation"();
  DROP FUNCTION "public"."perfect_tax_protect_client_number"();
  DROP FUNCTION "public"."perfect_tax_protect_primary_owner"();
  DROP TYPE "public"."enum_staff_role";
  DROP TYPE "public"."enum_staff_status";
  DROP TYPE "public"."enum_clients_status";
  DROP TYPE "public"."enum_portal_identities_subject_type";
  DROP TYPE "public"."enum_security_events_action";
  DROP TYPE "public"."enum_security_events_actor_kind";
  DROP TYPE "public"."enum_security_events_target_type";`);
}
