import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_services_content_policy" AS ENUM('evergreen', 'legal', 'urgent-announcement');
  CREATE TYPE "public"."enum_services_translation_workflow_en_state" AS ENUM('draft', 'needs-review', 'reviewed', 'published');
  CREATE TYPE "public"."enum_services_translation_workflow_es_state" AS ENUM('draft', 'needs-review', 'reviewed', 'published');
  CREATE TYPE "public"."enum_services_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__services_v_version_content_policy" AS ENUM('evergreen', 'legal', 'urgent-announcement');
  CREATE TYPE "public"."enum__services_v_version_translation_workflow_en_state" AS ENUM('draft', 'needs-review', 'reviewed', 'published');
  CREATE TYPE "public"."enum__services_v_version_translation_workflow_es_state" AS ENUM('draft', 'needs-review', 'reviewed', 'published');
  CREATE TYPE "public"."enum__services_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__services_v_published_locale" AS ENUM('en', 'es');
  CREATE TYPE "public"."enum_public_media_asset_type" AS ENUM('brand-logo', 'brand-icon', 'marketing-image');
  CREATE TYPE "public"."enum_public_media_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__public_media_v_version_asset_type" AS ENUM('brand-logo', 'brand-icon', 'marketing-image');
  CREATE TYPE "public"."enum__public_media_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__public_media_v_published_locale" AS ENUM('en', 'es');
  CREATE TYPE "public"."enum_business_identity_branding_status" AS ENUM('established', 'rebranding');
  CREATE TYPE "public"."enum_business_identity_content_policy" AS ENUM('evergreen', 'legal', 'urgent-announcement');
  CREATE TYPE "public"."enum_business_identity_translation_workflow_en_state" AS ENUM('draft', 'needs-review', 'reviewed', 'published');
  CREATE TYPE "public"."enum_business_identity_translation_workflow_es_state" AS ENUM('draft', 'needs-review', 'reviewed', 'published');
  CREATE TYPE "public"."enum_business_identity_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__business_identity_v_version_branding_status" AS ENUM('established', 'rebranding');
  CREATE TYPE "public"."enum__business_identity_v_version_content_policy" AS ENUM('evergreen', 'legal', 'urgent-announcement');
  CREATE TYPE "public"."enum__business_identity_v_version_translation_workflow_en_state" AS ENUM('draft', 'needs-review', 'reviewed', 'published');
  CREATE TYPE "public"."enum__business_identity_v_version_translation_workflow_es_state" AS ENUM('draft', 'needs-review', 'reviewed', 'published');
  CREATE TYPE "public"."enum__business_identity_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__business_identity_v_published_locale" AS ENUM('en', 'es');
  CREATE TYPE "public"."enum_contact_settings_business_hours_day" AS ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');
  CREATE TYPE "public"."enum_contact_settings_content_policy" AS ENUM('evergreen', 'legal', 'urgent-announcement');
  CREATE TYPE "public"."enum_contact_settings_translation_workflow_en_state" AS ENUM('draft', 'needs-review', 'reviewed', 'published');
  CREATE TYPE "public"."enum_contact_settings_translation_workflow_es_state" AS ENUM('draft', 'needs-review', 'reviewed', 'published');
  CREATE TYPE "public"."enum_contact_settings_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__contact_settings_v_version_business_hours_day" AS ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');
  CREATE TYPE "public"."enum__contact_settings_v_version_content_policy" AS ENUM('evergreen', 'legal', 'urgent-announcement');
  CREATE TYPE "public"."enum__contact_settings_v_version_translation_workflow_en_state" AS ENUM('draft', 'needs-review', 'reviewed', 'published');
  CREATE TYPE "public"."enum__contact_settings_v_version_translation_workflow_es_state" AS ENUM('draft', 'needs-review', 'reviewed', 'published');
  CREATE TYPE "public"."enum__contact_settings_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__contact_settings_v_published_locale" AS ENUM('en', 'es');
  CREATE TYPE "public"."enum_portal_settings_availability_state" AS ENUM('unavailable', 'transitioning', 'available');
  CREATE TYPE "public"."enum_portal_settings_content_policy" AS ENUM('evergreen', 'legal', 'urgent-announcement');
  CREATE TYPE "public"."enum_portal_settings_translation_workflow_en_state" AS ENUM('draft', 'needs-review', 'reviewed', 'published');
  CREATE TYPE "public"."enum_portal_settings_translation_workflow_es_state" AS ENUM('draft', 'needs-review', 'reviewed', 'published');
  CREATE TYPE "public"."enum_portal_settings_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__portal_settings_v_version_availability_state" AS ENUM('unavailable', 'transitioning', 'available');
  CREATE TYPE "public"."enum__portal_settings_v_version_content_policy" AS ENUM('evergreen', 'legal', 'urgent-announcement');
  CREATE TYPE "public"."enum__portal_settings_v_version_translation_workflow_en_state" AS ENUM('draft', 'needs-review', 'reviewed', 'published');
  CREATE TYPE "public"."enum__portal_settings_v_version_translation_workflow_es_state" AS ENUM('draft', 'needs-review', 'reviewed', 'published');
  CREATE TYPE "public"."enum__portal_settings_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__portal_settings_v_published_locale" AS ENUM('en', 'es');
  CREATE TYPE "public"."enum_homepage_content_content_policy" AS ENUM('evergreen', 'legal', 'urgent-announcement');
  CREATE TYPE "public"."enum_homepage_content_translation_workflow_en_state" AS ENUM('draft', 'needs-review', 'reviewed', 'published');
  CREATE TYPE "public"."enum_homepage_content_translation_workflow_es_state" AS ENUM('draft', 'needs-review', 'reviewed', 'published');
  CREATE TYPE "public"."enum_homepage_content_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__homepage_content_v_version_content_policy" AS ENUM('evergreen', 'legal', 'urgent-announcement');
  CREATE TYPE "public"."enum__homepage_content_v_version_translation_workflow_en_state" AS ENUM('draft', 'needs-review', 'reviewed', 'published');
  CREATE TYPE "public"."enum__homepage_content_v_version_translation_workflow_es_state" AS ENUM('draft', 'needs-review', 'reviewed', 'published');
  CREATE TYPE "public"."enum__homepage_content_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__homepage_content_v_published_locale" AS ENUM('en', 'es');
  ALTER TYPE "public"."enum_cms_users_role" ADD VALUE 'bilingual-reviewer' BEFORE 'publisher';
  CREATE TABLE "services" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"stable_identifier" varchar,
  	"display_order" numeric DEFAULT 100,
  	"is_active" boolean DEFAULT false,
  	"content_policy" "enum_services_content_policy" DEFAULT 'evergreen',
  	"working_revision" numeric DEFAULT 1,
  	"translation_workflow_en_state" "enum_services_translation_workflow_en_state" DEFAULT 'draft',
  	"translation_workflow_en_source_revision" numeric DEFAULT 1,
  	"translation_workflow_en_reviewed_by_id" integer,
  	"translation_workflow_en_reviewed_at" timestamp(3) with time zone,
  	"translation_workflow_en_published_by_id" integer,
  	"translation_workflow_en_published_at" timestamp(3) with time zone,
  	"translation_workflow_en_last_edited_by_id" integer,
  	"translation_workflow_en_last_edited_at" timestamp(3) with time zone,
  	"translation_workflow_en_review_notes" varchar,
  	"translation_workflow_es_state" "enum_services_translation_workflow_es_state" DEFAULT 'draft',
  	"translation_workflow_es_source_revision" numeric DEFAULT 1,
  	"translation_workflow_es_reviewed_by_id" integer,
  	"translation_workflow_es_reviewed_at" timestamp(3) with time zone,
  	"translation_workflow_es_published_by_id" integer,
  	"translation_workflow_es_published_at" timestamp(3) with time zone,
  	"translation_workflow_es_last_edited_by_id" integer,
  	"translation_workflow_es_last_edited_at" timestamp(3) with time zone,
  	"translation_workflow_es_review_notes" varchar,
  	"urgent_publication_controls_expires_at" timestamp(3) with time zone,
  	"urgent_publication_controls_translation_owner_id" integer,
  	"urgent_publication_controls_translation_follow_up_deadline" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_services_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "services_locales" (
  	"title" varchar,
  	"summary" varchar,
  	"detailed_description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_services_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_stable_identifier" varchar,
  	"version_display_order" numeric DEFAULT 100,
  	"version_is_active" boolean DEFAULT false,
  	"version_content_policy" "enum__services_v_version_content_policy" DEFAULT 'evergreen',
  	"version_working_revision" numeric DEFAULT 1,
  	"version_translation_workflow_en_state" "enum__services_v_version_translation_workflow_en_state" DEFAULT 'draft',
  	"version_translation_workflow_en_source_revision" numeric DEFAULT 1,
  	"version_translation_workflow_en_reviewed_by_id" integer,
  	"version_translation_workflow_en_reviewed_at" timestamp(3) with time zone,
  	"version_translation_workflow_en_published_by_id" integer,
  	"version_translation_workflow_en_published_at" timestamp(3) with time zone,
  	"version_translation_workflow_en_last_edited_by_id" integer,
  	"version_translation_workflow_en_last_edited_at" timestamp(3) with time zone,
  	"version_translation_workflow_en_review_notes" varchar,
  	"version_translation_workflow_es_state" "enum__services_v_version_translation_workflow_es_state" DEFAULT 'draft',
  	"version_translation_workflow_es_source_revision" numeric DEFAULT 1,
  	"version_translation_workflow_es_reviewed_by_id" integer,
  	"version_translation_workflow_es_reviewed_at" timestamp(3) with time zone,
  	"version_translation_workflow_es_published_by_id" integer,
  	"version_translation_workflow_es_published_at" timestamp(3) with time zone,
  	"version_translation_workflow_es_last_edited_by_id" integer,
  	"version_translation_workflow_es_last_edited_at" timestamp(3) with time zone,
  	"version_translation_workflow_es_review_notes" varchar,
  	"version_urgent_publication_controls_expires_at" timestamp(3) with time zone,
  	"version_urgent_publication_controls_translation_owner_id" integer,
  	"version_urgent_publication_controls_translation_follow_up_deadline" timestamp(3) with time zone,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__services_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "enum__services_v_published_locale",
  	"latest" boolean
  );
  
  CREATE TABLE "_services_v_locales" (
  	"version_title" varchar,
  	"version_summary" varchar,
  	"version_detailed_description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "public_media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"asset_type" "enum_public_media_asset_type",
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_public_media_status" DEFAULT 'draft',
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "public_media_locales" (
  	"alt_text" varchar,
  	"caption" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_public_media_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_asset_type" "enum__public_media_v_version_asset_type",
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__public_media_v_version_status" DEFAULT 'draft',
  	"version_url" varchar,
  	"version_thumbnail_u_r_l" varchar,
  	"version_filename" varchar,
  	"version_mime_type" varchar,
  	"version_filesize" numeric,
  	"version_width" numeric,
  	"version_height" numeric,
  	"version_focal_x" numeric,
  	"version_focal_y" numeric,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "enum__public_media_v_published_locale",
  	"latest" boolean
  );
  
  CREATE TABLE "_public_media_v_locales" (
  	"version_alt_text" varchar,
  	"version_caption" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "business_identity" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"legal_business_name" varchar,
  	"public_display_name" varchar DEFAULT 'Perfect Tax',
  	"short_name" varchar,
  	"primary_logo_id" integer,
  	"compact_logo_id" integer,
  	"branding_status" "enum_business_identity_branding_status" DEFAULT 'established',
  	"content_policy" "enum_business_identity_content_policy" DEFAULT 'legal',
  	"working_revision" numeric DEFAULT 1,
  	"translation_workflow_en_state" "enum_business_identity_translation_workflow_en_state" DEFAULT 'draft',
  	"translation_workflow_en_source_revision" numeric DEFAULT 1,
  	"translation_workflow_en_reviewed_by_id" integer,
  	"translation_workflow_en_reviewed_at" timestamp(3) with time zone,
  	"translation_workflow_en_published_by_id" integer,
  	"translation_workflow_en_published_at" timestamp(3) with time zone,
  	"translation_workflow_en_last_edited_by_id" integer,
  	"translation_workflow_en_last_edited_at" timestamp(3) with time zone,
  	"translation_workflow_en_review_notes" varchar,
  	"translation_workflow_es_state" "enum_business_identity_translation_workflow_es_state" DEFAULT 'draft',
  	"translation_workflow_es_source_revision" numeric DEFAULT 1,
  	"translation_workflow_es_reviewed_by_id" integer,
  	"translation_workflow_es_reviewed_at" timestamp(3) with time zone,
  	"translation_workflow_es_published_by_id" integer,
  	"translation_workflow_es_published_at" timestamp(3) with time zone,
  	"translation_workflow_es_last_edited_by_id" integer,
  	"translation_workflow_es_last_edited_at" timestamp(3) with time zone,
  	"translation_workflow_es_review_notes" varchar,
  	"urgent_publication_controls_expires_at" timestamp(3) with time zone,
  	"urgent_publication_controls_translation_owner_id" integer,
  	"urgent_publication_controls_translation_follow_up_deadline" timestamp(3) with time zone,
  	"_status" "enum_business_identity_status" DEFAULT 'draft',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "business_identity_locales" (
  	"tagline" varchar,
  	"business_description" varchar,
  	"service_area_description" varchar,
  	"public_disclaimer" varchar,
  	"rebranding_notice" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_business_identity_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_legal_business_name" varchar,
  	"version_public_display_name" varchar DEFAULT 'Perfect Tax',
  	"version_short_name" varchar,
  	"version_primary_logo_id" integer,
  	"version_compact_logo_id" integer,
  	"version_branding_status" "enum__business_identity_v_version_branding_status" DEFAULT 'established',
  	"version_content_policy" "enum__business_identity_v_version_content_policy" DEFAULT 'legal',
  	"version_working_revision" numeric DEFAULT 1,
  	"version_translation_workflow_en_state" "enum__business_identity_v_version_translation_workflow_en_state" DEFAULT 'draft',
  	"version_translation_workflow_en_source_revision" numeric DEFAULT 1,
  	"version_translation_workflow_en_reviewed_by_id" integer,
  	"version_translation_workflow_en_reviewed_at" timestamp(3) with time zone,
  	"version_translation_workflow_en_published_by_id" integer,
  	"version_translation_workflow_en_published_at" timestamp(3) with time zone,
  	"version_translation_workflow_en_last_edited_by_id" integer,
  	"version_translation_workflow_en_last_edited_at" timestamp(3) with time zone,
  	"version_translation_workflow_en_review_notes" varchar,
  	"version_translation_workflow_es_state" "enum__business_identity_v_version_translation_workflow_es_state" DEFAULT 'draft',
  	"version_translation_workflow_es_source_revision" numeric DEFAULT 1,
  	"version_translation_workflow_es_reviewed_by_id" integer,
  	"version_translation_workflow_es_reviewed_at" timestamp(3) with time zone,
  	"version_translation_workflow_es_published_by_id" integer,
  	"version_translation_workflow_es_published_at" timestamp(3) with time zone,
  	"version_translation_workflow_es_last_edited_by_id" integer,
  	"version_translation_workflow_es_last_edited_at" timestamp(3) with time zone,
  	"version_translation_workflow_es_review_notes" varchar,
  	"version_urgent_publication_controls_expires_at" timestamp(3) with time zone,
  	"version_urgent_publication_controls_translation_owner_id" integer,
  	"version_urgent_publication_controls_translation_follow_up_deadline" timestamp(3) with time zone,
  	"version__status" "enum__business_identity_v_version_status" DEFAULT 'draft',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "enum__business_identity_v_published_locale",
  	"latest" boolean
  );
  
  CREATE TABLE "_business_identity_v_locales" (
  	"version_tagline" varchar,
  	"version_business_description" varchar,
  	"version_service_area_description" varchar,
  	"version_public_disclaimer" varchar,
  	"version_rebranding_notice" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "contact_settings_business_hours" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"day" "enum_contact_settings_business_hours_day",
  	"closed" boolean DEFAULT false,
  	"opens_at" varchar,
  	"closes_at" varchar
  );
  
  CREATE TABLE "contact_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"approved_telephone" varchar,
  	"approved_whats_app_number" varchar,
  	"approved_general_email" varchar,
  	"office_address_line1" varchar,
  	"office_address_line2" varchar,
  	"office_address_city" varchar,
  	"office_address_region" varchar,
  	"office_address_postal_code" varchar,
  	"office_address_country_code" varchar DEFAULT 'US',
  	"channels_telephone_enabled" boolean DEFAULT false,
  	"channels_whats_app_enabled" boolean DEFAULT false,
  	"channels_email_enabled" boolean DEFAULT false,
  	"content_policy" "enum_contact_settings_content_policy" DEFAULT 'legal',
  	"working_revision" numeric DEFAULT 1,
  	"translation_workflow_en_state" "enum_contact_settings_translation_workflow_en_state" DEFAULT 'draft',
  	"translation_workflow_en_source_revision" numeric DEFAULT 1,
  	"translation_workflow_en_reviewed_by_id" integer,
  	"translation_workflow_en_reviewed_at" timestamp(3) with time zone,
  	"translation_workflow_en_published_by_id" integer,
  	"translation_workflow_en_published_at" timestamp(3) with time zone,
  	"translation_workflow_en_last_edited_by_id" integer,
  	"translation_workflow_en_last_edited_at" timestamp(3) with time zone,
  	"translation_workflow_en_review_notes" varchar,
  	"translation_workflow_es_state" "enum_contact_settings_translation_workflow_es_state" DEFAULT 'draft',
  	"translation_workflow_es_source_revision" numeric DEFAULT 1,
  	"translation_workflow_es_reviewed_by_id" integer,
  	"translation_workflow_es_reviewed_at" timestamp(3) with time zone,
  	"translation_workflow_es_published_by_id" integer,
  	"translation_workflow_es_published_at" timestamp(3) with time zone,
  	"translation_workflow_es_last_edited_by_id" integer,
  	"translation_workflow_es_last_edited_at" timestamp(3) with time zone,
  	"translation_workflow_es_review_notes" varchar,
  	"urgent_publication_controls_expires_at" timestamp(3) with time zone,
  	"urgent_publication_controls_translation_owner_id" integer,
  	"urgent_publication_controls_translation_follow_up_deadline" timestamp(3) with time zone,
  	"_status" "enum_contact_settings_status" DEFAULT 'draft',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "contact_settings_locales" (
  	"contact_safety_instructions" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_contact_settings_v_version_business_hours" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"day" "enum__contact_settings_v_version_business_hours_day",
  	"closed" boolean DEFAULT false,
  	"opens_at" varchar,
  	"closes_at" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_contact_settings_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_approved_telephone" varchar,
  	"version_approved_whats_app_number" varchar,
  	"version_approved_general_email" varchar,
  	"version_office_address_line1" varchar,
  	"version_office_address_line2" varchar,
  	"version_office_address_city" varchar,
  	"version_office_address_region" varchar,
  	"version_office_address_postal_code" varchar,
  	"version_office_address_country_code" varchar DEFAULT 'US',
  	"version_channels_telephone_enabled" boolean DEFAULT false,
  	"version_channels_whats_app_enabled" boolean DEFAULT false,
  	"version_channels_email_enabled" boolean DEFAULT false,
  	"version_content_policy" "enum__contact_settings_v_version_content_policy" DEFAULT 'legal',
  	"version_working_revision" numeric DEFAULT 1,
  	"version_translation_workflow_en_state" "enum__contact_settings_v_version_translation_workflow_en_state" DEFAULT 'draft',
  	"version_translation_workflow_en_source_revision" numeric DEFAULT 1,
  	"version_translation_workflow_en_reviewed_by_id" integer,
  	"version_translation_workflow_en_reviewed_at" timestamp(3) with time zone,
  	"version_translation_workflow_en_published_by_id" integer,
  	"version_translation_workflow_en_published_at" timestamp(3) with time zone,
  	"version_translation_workflow_en_last_edited_by_id" integer,
  	"version_translation_workflow_en_last_edited_at" timestamp(3) with time zone,
  	"version_translation_workflow_en_review_notes" varchar,
  	"version_translation_workflow_es_state" "enum__contact_settings_v_version_translation_workflow_es_state" DEFAULT 'draft',
  	"version_translation_workflow_es_source_revision" numeric DEFAULT 1,
  	"version_translation_workflow_es_reviewed_by_id" integer,
  	"version_translation_workflow_es_reviewed_at" timestamp(3) with time zone,
  	"version_translation_workflow_es_published_by_id" integer,
  	"version_translation_workflow_es_published_at" timestamp(3) with time zone,
  	"version_translation_workflow_es_last_edited_by_id" integer,
  	"version_translation_workflow_es_last_edited_at" timestamp(3) with time zone,
  	"version_translation_workflow_es_review_notes" varchar,
  	"version_urgent_publication_controls_expires_at" timestamp(3) with time zone,
  	"version_urgent_publication_controls_translation_owner_id" integer,
  	"version_urgent_publication_controls_translation_follow_up_deadline" timestamp(3) with time zone,
  	"version__status" "enum__contact_settings_v_version_status" DEFAULT 'draft',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "enum__contact_settings_v_published_locale",
  	"latest" boolean
  );
  
  CREATE TABLE "_contact_settings_v_locales" (
  	"version_contact_safety_instructions" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "portal_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"availability_state" "enum_portal_settings_availability_state" DEFAULT 'unavailable',
  	"content_policy" "enum_portal_settings_content_policy" DEFAULT 'evergreen',
  	"working_revision" numeric DEFAULT 1,
  	"translation_workflow_en_state" "enum_portal_settings_translation_workflow_en_state" DEFAULT 'draft',
  	"translation_workflow_en_source_revision" numeric DEFAULT 1,
  	"translation_workflow_en_reviewed_by_id" integer,
  	"translation_workflow_en_reviewed_at" timestamp(3) with time zone,
  	"translation_workflow_en_published_by_id" integer,
  	"translation_workflow_en_published_at" timestamp(3) with time zone,
  	"translation_workflow_en_last_edited_by_id" integer,
  	"translation_workflow_en_last_edited_at" timestamp(3) with time zone,
  	"translation_workflow_en_review_notes" varchar,
  	"translation_workflow_es_state" "enum_portal_settings_translation_workflow_es_state" DEFAULT 'draft',
  	"translation_workflow_es_source_revision" numeric DEFAULT 1,
  	"translation_workflow_es_reviewed_by_id" integer,
  	"translation_workflow_es_reviewed_at" timestamp(3) with time zone,
  	"translation_workflow_es_published_by_id" integer,
  	"translation_workflow_es_published_at" timestamp(3) with time zone,
  	"translation_workflow_es_last_edited_by_id" integer,
  	"translation_workflow_es_last_edited_at" timestamp(3) with time zone,
  	"translation_workflow_es_review_notes" varchar,
  	"urgent_publication_controls_expires_at" timestamp(3) with time zone,
  	"urgent_publication_controls_translation_owner_id" integer,
  	"urgent_publication_controls_translation_follow_up_deadline" timestamp(3) with time zone,
  	"_status" "enum_portal_settings_status" DEFAULT 'draft',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "portal_settings_locales" (
  	"transition_notice" varchar,
  	"sign_in_placeholder_heading" varchar,
  	"sign_in_placeholder_message" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_portal_settings_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_availability_state" "enum__portal_settings_v_version_availability_state" DEFAULT 'unavailable',
  	"version_content_policy" "enum__portal_settings_v_version_content_policy" DEFAULT 'evergreen',
  	"version_working_revision" numeric DEFAULT 1,
  	"version_translation_workflow_en_state" "enum__portal_settings_v_version_translation_workflow_en_state" DEFAULT 'draft',
  	"version_translation_workflow_en_source_revision" numeric DEFAULT 1,
  	"version_translation_workflow_en_reviewed_by_id" integer,
  	"version_translation_workflow_en_reviewed_at" timestamp(3) with time zone,
  	"version_translation_workflow_en_published_by_id" integer,
  	"version_translation_workflow_en_published_at" timestamp(3) with time zone,
  	"version_translation_workflow_en_last_edited_by_id" integer,
  	"version_translation_workflow_en_last_edited_at" timestamp(3) with time zone,
  	"version_translation_workflow_en_review_notes" varchar,
  	"version_translation_workflow_es_state" "enum__portal_settings_v_version_translation_workflow_es_state" DEFAULT 'draft',
  	"version_translation_workflow_es_source_revision" numeric DEFAULT 1,
  	"version_translation_workflow_es_reviewed_by_id" integer,
  	"version_translation_workflow_es_reviewed_at" timestamp(3) with time zone,
  	"version_translation_workflow_es_published_by_id" integer,
  	"version_translation_workflow_es_published_at" timestamp(3) with time zone,
  	"version_translation_workflow_es_last_edited_by_id" integer,
  	"version_translation_workflow_es_last_edited_at" timestamp(3) with time zone,
  	"version_translation_workflow_es_review_notes" varchar,
  	"version_urgent_publication_controls_expires_at" timestamp(3) with time zone,
  	"version_urgent_publication_controls_translation_owner_id" integer,
  	"version_urgent_publication_controls_translation_follow_up_deadline" timestamp(3) with time zone,
  	"version__status" "enum__portal_settings_v_version_status" DEFAULT 'draft',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "enum__portal_settings_v_published_locale",
  	"latest" boolean
  );
  
  CREATE TABLE "_portal_settings_v_locales" (
  	"version_transition_notice" varchar,
  	"version_sign_in_placeholder_heading" varchar,
  	"version_sign_in_placeholder_message" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "homepage_content_process_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"description" varchar
  );
  
  CREATE TABLE "homepage_content" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"content_policy" "enum_homepage_content_content_policy" DEFAULT 'evergreen',
  	"working_revision" numeric DEFAULT 1,
  	"translation_workflow_en_state" "enum_homepage_content_translation_workflow_en_state" DEFAULT 'draft',
  	"translation_workflow_en_source_revision" numeric DEFAULT 1,
  	"translation_workflow_en_reviewed_by_id" integer,
  	"translation_workflow_en_reviewed_at" timestamp(3) with time zone,
  	"translation_workflow_en_published_by_id" integer,
  	"translation_workflow_en_published_at" timestamp(3) with time zone,
  	"translation_workflow_en_last_edited_by_id" integer,
  	"translation_workflow_en_last_edited_at" timestamp(3) with time zone,
  	"translation_workflow_en_review_notes" varchar,
  	"translation_workflow_es_state" "enum_homepage_content_translation_workflow_es_state" DEFAULT 'draft',
  	"translation_workflow_es_source_revision" numeric DEFAULT 1,
  	"translation_workflow_es_reviewed_by_id" integer,
  	"translation_workflow_es_reviewed_at" timestamp(3) with time zone,
  	"translation_workflow_es_published_by_id" integer,
  	"translation_workflow_es_published_at" timestamp(3) with time zone,
  	"translation_workflow_es_last_edited_by_id" integer,
  	"translation_workflow_es_last_edited_at" timestamp(3) with time zone,
  	"translation_workflow_es_review_notes" varchar,
  	"urgent_publication_controls_expires_at" timestamp(3) with time zone,
  	"urgent_publication_controls_translation_owner_id" integer,
  	"urgent_publication_controls_translation_follow_up_deadline" timestamp(3) with time zone,
  	"_status" "enum_homepage_content_status" DEFAULT 'draft',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "homepage_content_locales" (
  	"hero_eyebrow" varchar,
  	"hero_heading" varchar,
  	"hero_body" varchar,
  	"services_introduction_heading" varchar,
  	"services_introduction_body" varchar,
  	"portal_introduction_heading" varchar,
  	"portal_introduction_body" varchar,
  	"trust_section_heading" varchar,
  	"trust_section_body" varchar,
  	"call_to_action_heading" varchar,
  	"call_to_action_body" varchar,
  	"call_to_action_primary_label" varchar,
  	"call_to_action_secondary_label" varchar,
  	"footer_copy" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_homepage_content_v_version_process_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"description" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_homepage_content_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_content_policy" "enum__homepage_content_v_version_content_policy" DEFAULT 'evergreen',
  	"version_working_revision" numeric DEFAULT 1,
  	"version_translation_workflow_en_state" "enum__homepage_content_v_version_translation_workflow_en_state" DEFAULT 'draft',
  	"version_translation_workflow_en_source_revision" numeric DEFAULT 1,
  	"version_translation_workflow_en_reviewed_by_id" integer,
  	"version_translation_workflow_en_reviewed_at" timestamp(3) with time zone,
  	"version_translation_workflow_en_published_by_id" integer,
  	"version_translation_workflow_en_published_at" timestamp(3) with time zone,
  	"version_translation_workflow_en_last_edited_by_id" integer,
  	"version_translation_workflow_en_last_edited_at" timestamp(3) with time zone,
  	"version_translation_workflow_en_review_notes" varchar,
  	"version_translation_workflow_es_state" "enum__homepage_content_v_version_translation_workflow_es_state" DEFAULT 'draft',
  	"version_translation_workflow_es_source_revision" numeric DEFAULT 1,
  	"version_translation_workflow_es_reviewed_by_id" integer,
  	"version_translation_workflow_es_reviewed_at" timestamp(3) with time zone,
  	"version_translation_workflow_es_published_by_id" integer,
  	"version_translation_workflow_es_published_at" timestamp(3) with time zone,
  	"version_translation_workflow_es_last_edited_by_id" integer,
  	"version_translation_workflow_es_last_edited_at" timestamp(3) with time zone,
  	"version_translation_workflow_es_review_notes" varchar,
  	"version_urgent_publication_controls_expires_at" timestamp(3) with time zone,
  	"version_urgent_publication_controls_translation_owner_id" integer,
  	"version_urgent_publication_controls_translation_follow_up_deadline" timestamp(3) with time zone,
  	"version__status" "enum__homepage_content_v_version_status" DEFAULT 'draft',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "enum__homepage_content_v_published_locale",
  	"latest" boolean
  );
  
  CREATE TABLE "_homepage_content_v_locales" (
  	"version_hero_eyebrow" varchar,
  	"version_hero_heading" varchar,
  	"version_hero_body" varchar,
  	"version_services_introduction_heading" varchar,
  	"version_services_introduction_body" varchar,
  	"version_portal_introduction_heading" varchar,
  	"version_portal_introduction_body" varchar,
  	"version_trust_section_heading" varchar,
  	"version_trust_section_body" varchar,
  	"version_call_to_action_heading" varchar,
  	"version_call_to_action_body" varchar,
  	"version_call_to_action_primary_label" varchar,
  	"version_call_to_action_secondary_label" varchar,
  	"version_footer_copy" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "services_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "public_media_id" integer;
  ALTER TABLE "services" ADD CONSTRAINT "services_translation_workflow_en_reviewed_by_id_cms_users_id_fk" FOREIGN KEY ("translation_workflow_en_reviewed_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "services" ADD CONSTRAINT "services_translation_workflow_en_published_by_id_cms_users_id_fk" FOREIGN KEY ("translation_workflow_en_published_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "services" ADD CONSTRAINT "services_translation_workflow_en_last_edited_by_id_cms_users_id_fk" FOREIGN KEY ("translation_workflow_en_last_edited_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "services" ADD CONSTRAINT "services_translation_workflow_es_reviewed_by_id_cms_users_id_fk" FOREIGN KEY ("translation_workflow_es_reviewed_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "services" ADD CONSTRAINT "services_translation_workflow_es_published_by_id_cms_users_id_fk" FOREIGN KEY ("translation_workflow_es_published_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "services" ADD CONSTRAINT "services_translation_workflow_es_last_edited_by_id_cms_users_id_fk" FOREIGN KEY ("translation_workflow_es_last_edited_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "services" ADD CONSTRAINT "services_urgent_publication_controls_translation_owner_id_cms_users_id_fk" FOREIGN KEY ("urgent_publication_controls_translation_owner_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "services_locales" ADD CONSTRAINT "services_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_services_v" ADD CONSTRAINT "_services_v_parent_id_services_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_services_v" ADD CONSTRAINT "_services_v_version_translation_workflow_en_reviewed_by_id_cms_users_id_fk" FOREIGN KEY ("version_translation_workflow_en_reviewed_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_services_v" ADD CONSTRAINT "_services_v_version_translation_workflow_en_published_by_id_cms_users_id_fk" FOREIGN KEY ("version_translation_workflow_en_published_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_services_v" ADD CONSTRAINT "_services_v_version_translation_workflow_en_last_edited_by_id_cms_users_id_fk" FOREIGN KEY ("version_translation_workflow_en_last_edited_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_services_v" ADD CONSTRAINT "_services_v_version_translation_workflow_es_reviewed_by_id_cms_users_id_fk" FOREIGN KEY ("version_translation_workflow_es_reviewed_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_services_v" ADD CONSTRAINT "_services_v_version_translation_workflow_es_published_by_id_cms_users_id_fk" FOREIGN KEY ("version_translation_workflow_es_published_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_services_v" ADD CONSTRAINT "_services_v_version_translation_workflow_es_last_edited_by_id_cms_users_id_fk" FOREIGN KEY ("version_translation_workflow_es_last_edited_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_services_v" ADD CONSTRAINT "_services_v_version_urgent_publication_controls_translation_owner_id_cms_users_id_fk" FOREIGN KEY ("version_urgent_publication_controls_translation_owner_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_services_v_locales" ADD CONSTRAINT "_services_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_services_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "public_media_locales" ADD CONSTRAINT "public_media_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."public_media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_public_media_v" ADD CONSTRAINT "_public_media_v_parent_id_public_media_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."public_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_public_media_v_locales" ADD CONSTRAINT "_public_media_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_public_media_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "business_identity" ADD CONSTRAINT "business_identity_primary_logo_id_public_media_id_fk" FOREIGN KEY ("primary_logo_id") REFERENCES "public"."public_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "business_identity" ADD CONSTRAINT "business_identity_compact_logo_id_public_media_id_fk" FOREIGN KEY ("compact_logo_id") REFERENCES "public"."public_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "business_identity" ADD CONSTRAINT "business_identity_translation_workflow_en_reviewed_by_id_cms_users_id_fk" FOREIGN KEY ("translation_workflow_en_reviewed_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "business_identity" ADD CONSTRAINT "business_identity_translation_workflow_en_published_by_id_cms_users_id_fk" FOREIGN KEY ("translation_workflow_en_published_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "business_identity" ADD CONSTRAINT "business_identity_translation_workflow_en_last_edited_by_id_cms_users_id_fk" FOREIGN KEY ("translation_workflow_en_last_edited_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "business_identity" ADD CONSTRAINT "business_identity_translation_workflow_es_reviewed_by_id_cms_users_id_fk" FOREIGN KEY ("translation_workflow_es_reviewed_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "business_identity" ADD CONSTRAINT "business_identity_translation_workflow_es_published_by_id_cms_users_id_fk" FOREIGN KEY ("translation_workflow_es_published_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "business_identity" ADD CONSTRAINT "business_identity_translation_workflow_es_last_edited_by_id_cms_users_id_fk" FOREIGN KEY ("translation_workflow_es_last_edited_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "business_identity" ADD CONSTRAINT "business_identity_urgent_publication_controls_translation_owner_id_cms_users_id_fk" FOREIGN KEY ("urgent_publication_controls_translation_owner_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "business_identity_locales" ADD CONSTRAINT "business_identity_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."business_identity"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_business_identity_v" ADD CONSTRAINT "_business_identity_v_version_primary_logo_id_public_media_id_fk" FOREIGN KEY ("version_primary_logo_id") REFERENCES "public"."public_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_business_identity_v" ADD CONSTRAINT "_business_identity_v_version_compact_logo_id_public_media_id_fk" FOREIGN KEY ("version_compact_logo_id") REFERENCES "public"."public_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_business_identity_v" ADD CONSTRAINT "_business_identity_v_version_translation_workflow_en_reviewed_by_id_cms_users_id_fk" FOREIGN KEY ("version_translation_workflow_en_reviewed_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_business_identity_v" ADD CONSTRAINT "_business_identity_v_version_translation_workflow_en_published_by_id_cms_users_id_fk" FOREIGN KEY ("version_translation_workflow_en_published_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_business_identity_v" ADD CONSTRAINT "_business_identity_v_version_translation_workflow_en_last_edited_by_id_cms_users_id_fk" FOREIGN KEY ("version_translation_workflow_en_last_edited_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_business_identity_v" ADD CONSTRAINT "_business_identity_v_version_translation_workflow_es_reviewed_by_id_cms_users_id_fk" FOREIGN KEY ("version_translation_workflow_es_reviewed_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_business_identity_v" ADD CONSTRAINT "_business_identity_v_version_translation_workflow_es_published_by_id_cms_users_id_fk" FOREIGN KEY ("version_translation_workflow_es_published_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_business_identity_v" ADD CONSTRAINT "_business_identity_v_version_translation_workflow_es_last_edited_by_id_cms_users_id_fk" FOREIGN KEY ("version_translation_workflow_es_last_edited_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_business_identity_v" ADD CONSTRAINT "_business_identity_v_version_urgent_publication_controls_translation_owner_id_cms_users_id_fk" FOREIGN KEY ("version_urgent_publication_controls_translation_owner_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_business_identity_v_locales" ADD CONSTRAINT "_business_identity_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_business_identity_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "contact_settings_business_hours" ADD CONSTRAINT "contact_settings_business_hours_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."contact_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "contact_settings" ADD CONSTRAINT "contact_settings_translation_workflow_en_reviewed_by_id_cms_users_id_fk" FOREIGN KEY ("translation_workflow_en_reviewed_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "contact_settings" ADD CONSTRAINT "contact_settings_translation_workflow_en_published_by_id_cms_users_id_fk" FOREIGN KEY ("translation_workflow_en_published_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "contact_settings" ADD CONSTRAINT "contact_settings_translation_workflow_en_last_edited_by_id_cms_users_id_fk" FOREIGN KEY ("translation_workflow_en_last_edited_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "contact_settings" ADD CONSTRAINT "contact_settings_translation_workflow_es_reviewed_by_id_cms_users_id_fk" FOREIGN KEY ("translation_workflow_es_reviewed_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "contact_settings" ADD CONSTRAINT "contact_settings_translation_workflow_es_published_by_id_cms_users_id_fk" FOREIGN KEY ("translation_workflow_es_published_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "contact_settings" ADD CONSTRAINT "contact_settings_translation_workflow_es_last_edited_by_id_cms_users_id_fk" FOREIGN KEY ("translation_workflow_es_last_edited_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "contact_settings" ADD CONSTRAINT "contact_settings_urgent_publication_controls_translation_owner_id_cms_users_id_fk" FOREIGN KEY ("urgent_publication_controls_translation_owner_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "contact_settings_locales" ADD CONSTRAINT "contact_settings_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."contact_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_contact_settings_v_version_business_hours" ADD CONSTRAINT "_contact_settings_v_version_business_hours_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_contact_settings_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_contact_settings_v" ADD CONSTRAINT "_contact_settings_v_version_translation_workflow_en_reviewed_by_id_cms_users_id_fk" FOREIGN KEY ("version_translation_workflow_en_reviewed_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_contact_settings_v" ADD CONSTRAINT "_contact_settings_v_version_translation_workflow_en_published_by_id_cms_users_id_fk" FOREIGN KEY ("version_translation_workflow_en_published_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_contact_settings_v" ADD CONSTRAINT "_contact_settings_v_version_translation_workflow_en_last_edited_by_id_cms_users_id_fk" FOREIGN KEY ("version_translation_workflow_en_last_edited_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_contact_settings_v" ADD CONSTRAINT "_contact_settings_v_version_translation_workflow_es_reviewed_by_id_cms_users_id_fk" FOREIGN KEY ("version_translation_workflow_es_reviewed_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_contact_settings_v" ADD CONSTRAINT "_contact_settings_v_version_translation_workflow_es_published_by_id_cms_users_id_fk" FOREIGN KEY ("version_translation_workflow_es_published_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_contact_settings_v" ADD CONSTRAINT "_contact_settings_v_version_translation_workflow_es_last_edited_by_id_cms_users_id_fk" FOREIGN KEY ("version_translation_workflow_es_last_edited_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_contact_settings_v" ADD CONSTRAINT "_contact_settings_v_version_urgent_publication_controls_translation_owner_id_cms_users_id_fk" FOREIGN KEY ("version_urgent_publication_controls_translation_owner_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_contact_settings_v_locales" ADD CONSTRAINT "_contact_settings_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_contact_settings_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "portal_settings" ADD CONSTRAINT "portal_settings_translation_workflow_en_reviewed_by_id_cms_users_id_fk" FOREIGN KEY ("translation_workflow_en_reviewed_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "portal_settings" ADD CONSTRAINT "portal_settings_translation_workflow_en_published_by_id_cms_users_id_fk" FOREIGN KEY ("translation_workflow_en_published_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "portal_settings" ADD CONSTRAINT "portal_settings_translation_workflow_en_last_edited_by_id_cms_users_id_fk" FOREIGN KEY ("translation_workflow_en_last_edited_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "portal_settings" ADD CONSTRAINT "portal_settings_translation_workflow_es_reviewed_by_id_cms_users_id_fk" FOREIGN KEY ("translation_workflow_es_reviewed_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "portal_settings" ADD CONSTRAINT "portal_settings_translation_workflow_es_published_by_id_cms_users_id_fk" FOREIGN KEY ("translation_workflow_es_published_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "portal_settings" ADD CONSTRAINT "portal_settings_translation_workflow_es_last_edited_by_id_cms_users_id_fk" FOREIGN KEY ("translation_workflow_es_last_edited_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "portal_settings" ADD CONSTRAINT "portal_settings_urgent_publication_controls_translation_owner_id_cms_users_id_fk" FOREIGN KEY ("urgent_publication_controls_translation_owner_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "portal_settings_locales" ADD CONSTRAINT "portal_settings_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."portal_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_portal_settings_v" ADD CONSTRAINT "_portal_settings_v_version_translation_workflow_en_reviewed_by_id_cms_users_id_fk" FOREIGN KEY ("version_translation_workflow_en_reviewed_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_portal_settings_v" ADD CONSTRAINT "_portal_settings_v_version_translation_workflow_en_published_by_id_cms_users_id_fk" FOREIGN KEY ("version_translation_workflow_en_published_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_portal_settings_v" ADD CONSTRAINT "_portal_settings_v_version_translation_workflow_en_last_edited_by_id_cms_users_id_fk" FOREIGN KEY ("version_translation_workflow_en_last_edited_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_portal_settings_v" ADD CONSTRAINT "_portal_settings_v_version_translation_workflow_es_reviewed_by_id_cms_users_id_fk" FOREIGN KEY ("version_translation_workflow_es_reviewed_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_portal_settings_v" ADD CONSTRAINT "_portal_settings_v_version_translation_workflow_es_published_by_id_cms_users_id_fk" FOREIGN KEY ("version_translation_workflow_es_published_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_portal_settings_v" ADD CONSTRAINT "_portal_settings_v_version_translation_workflow_es_last_edited_by_id_cms_users_id_fk" FOREIGN KEY ("version_translation_workflow_es_last_edited_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_portal_settings_v" ADD CONSTRAINT "_portal_settings_v_version_urgent_publication_controls_translation_owner_id_cms_users_id_fk" FOREIGN KEY ("version_urgent_publication_controls_translation_owner_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_portal_settings_v_locales" ADD CONSTRAINT "_portal_settings_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_portal_settings_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "homepage_content_process_steps" ADD CONSTRAINT "homepage_content_process_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage_content"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "homepage_content" ADD CONSTRAINT "homepage_content_translation_workflow_en_reviewed_by_id_cms_users_id_fk" FOREIGN KEY ("translation_workflow_en_reviewed_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "homepage_content" ADD CONSTRAINT "homepage_content_translation_workflow_en_published_by_id_cms_users_id_fk" FOREIGN KEY ("translation_workflow_en_published_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "homepage_content" ADD CONSTRAINT "homepage_content_translation_workflow_en_last_edited_by_id_cms_users_id_fk" FOREIGN KEY ("translation_workflow_en_last_edited_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "homepage_content" ADD CONSTRAINT "homepage_content_translation_workflow_es_reviewed_by_id_cms_users_id_fk" FOREIGN KEY ("translation_workflow_es_reviewed_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "homepage_content" ADD CONSTRAINT "homepage_content_translation_workflow_es_published_by_id_cms_users_id_fk" FOREIGN KEY ("translation_workflow_es_published_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "homepage_content" ADD CONSTRAINT "homepage_content_translation_workflow_es_last_edited_by_id_cms_users_id_fk" FOREIGN KEY ("translation_workflow_es_last_edited_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "homepage_content" ADD CONSTRAINT "homepage_content_urgent_publication_controls_translation_owner_id_cms_users_id_fk" FOREIGN KEY ("urgent_publication_controls_translation_owner_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "homepage_content_locales" ADD CONSTRAINT "homepage_content_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage_content"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_homepage_content_v_version_process_steps" ADD CONSTRAINT "_homepage_content_v_version_process_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_homepage_content_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_homepage_content_v" ADD CONSTRAINT "_homepage_content_v_version_translation_workflow_en_reviewed_by_id_cms_users_id_fk" FOREIGN KEY ("version_translation_workflow_en_reviewed_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_homepage_content_v" ADD CONSTRAINT "_homepage_content_v_version_translation_workflow_en_published_by_id_cms_users_id_fk" FOREIGN KEY ("version_translation_workflow_en_published_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_homepage_content_v" ADD CONSTRAINT "_homepage_content_v_version_translation_workflow_en_last_edited_by_id_cms_users_id_fk" FOREIGN KEY ("version_translation_workflow_en_last_edited_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_homepage_content_v" ADD CONSTRAINT "_homepage_content_v_version_translation_workflow_es_reviewed_by_id_cms_users_id_fk" FOREIGN KEY ("version_translation_workflow_es_reviewed_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_homepage_content_v" ADD CONSTRAINT "_homepage_content_v_version_translation_workflow_es_published_by_id_cms_users_id_fk" FOREIGN KEY ("version_translation_workflow_es_published_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_homepage_content_v" ADD CONSTRAINT "_homepage_content_v_version_translation_workflow_es_last_edited_by_id_cms_users_id_fk" FOREIGN KEY ("version_translation_workflow_es_last_edited_by_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_homepage_content_v" ADD CONSTRAINT "_homepage_content_v_version_urgent_publication_controls_translation_owner_id_cms_users_id_fk" FOREIGN KEY ("version_urgent_publication_controls_translation_owner_id") REFERENCES "public"."cms_users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_homepage_content_v_locales" ADD CONSTRAINT "_homepage_content_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_homepage_content_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "services_stable_identifier_idx" ON "services" USING btree ("stable_identifier");
  CREATE INDEX "services_translation_workflow_en_translation_workflow_en_idx" ON "services" USING btree ("translation_workflow_en_reviewed_by_id");
  CREATE INDEX "services_translation_workflow_en_translation_workflow__1_idx" ON "services" USING btree ("translation_workflow_en_published_by_id");
  CREATE INDEX "services_translation_workflow_en_translation_workflow__2_idx" ON "services" USING btree ("translation_workflow_en_last_edited_by_id");
  CREATE INDEX "services_translation_workflow_es_translation_workflow_es_idx" ON "services" USING btree ("translation_workflow_es_reviewed_by_id");
  CREATE INDEX "services_translation_workflow_es_translation_workflow__1_idx" ON "services" USING btree ("translation_workflow_es_published_by_id");
  CREATE INDEX "services_translation_workflow_es_translation_workflow__2_idx" ON "services" USING btree ("translation_workflow_es_last_edited_by_id");
  CREATE INDEX "services_urgent_publication_controls_urgent_publication__idx" ON "services" USING btree ("urgent_publication_controls_translation_owner_id");
  CREATE INDEX "services_updated_at_idx" ON "services" USING btree ("updated_at");
  CREATE INDEX "services_created_at_idx" ON "services" USING btree ("created_at");
  CREATE INDEX "services__status_idx" ON "services" USING btree ("_status");
  CREATE UNIQUE INDEX "services_locales_locale_parent_id_unique" ON "services_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_services_v_parent_idx" ON "_services_v" USING btree ("parent_id");
  CREATE INDEX "_services_v_version_version_stable_identifier_idx" ON "_services_v" USING btree ("version_stable_identifier");
  CREATE INDEX "_services_v_version_translation_workflow_en_version_tran_idx" ON "_services_v" USING btree ("version_translation_workflow_en_reviewed_by_id");
  CREATE INDEX "_services_v_version_translation_workflow_en_version_tr_1_idx" ON "_services_v" USING btree ("version_translation_workflow_en_published_by_id");
  CREATE INDEX "_services_v_version_translation_workflow_en_version_tr_2_idx" ON "_services_v" USING btree ("version_translation_workflow_en_last_edited_by_id");
  CREATE INDEX "_services_v_version_translation_workflow_es_version_tran_idx" ON "_services_v" USING btree ("version_translation_workflow_es_reviewed_by_id");
  CREATE INDEX "_services_v_version_translation_workflow_es_version_tr_1_idx" ON "_services_v" USING btree ("version_translation_workflow_es_published_by_id");
  CREATE INDEX "_services_v_version_translation_workflow_es_version_tr_2_idx" ON "_services_v" USING btree ("version_translation_workflow_es_last_edited_by_id");
  CREATE INDEX "_services_v_version_urgent_publication_controls_version__idx" ON "_services_v" USING btree ("version_urgent_publication_controls_translation_owner_id");
  CREATE INDEX "_services_v_version_version_updated_at_idx" ON "_services_v" USING btree ("version_updated_at");
  CREATE INDEX "_services_v_version_version_created_at_idx" ON "_services_v" USING btree ("version_created_at");
  CREATE INDEX "_services_v_version_version__status_idx" ON "_services_v" USING btree ("version__status");
  CREATE INDEX "_services_v_created_at_idx" ON "_services_v" USING btree ("created_at");
  CREATE INDEX "_services_v_updated_at_idx" ON "_services_v" USING btree ("updated_at");
  CREATE INDEX "_services_v_snapshot_idx" ON "_services_v" USING btree ("snapshot");
  CREATE INDEX "_services_v_published_locale_idx" ON "_services_v" USING btree ("published_locale");
  CREATE INDEX "_services_v_latest_idx" ON "_services_v" USING btree ("latest");
  CREATE UNIQUE INDEX "_services_v_locales_locale_parent_id_unique" ON "_services_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "public_media_updated_at_idx" ON "public_media" USING btree ("updated_at");
  CREATE INDEX "public_media_created_at_idx" ON "public_media" USING btree ("created_at");
  CREATE INDEX "public_media__status_idx" ON "public_media" USING btree ("_status");
  CREATE UNIQUE INDEX "public_media_filename_idx" ON "public_media" USING btree ("filename");
  CREATE UNIQUE INDEX "public_media_locales_locale_parent_id_unique" ON "public_media_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_public_media_v_parent_idx" ON "_public_media_v" USING btree ("parent_id");
  CREATE INDEX "_public_media_v_version_version_updated_at_idx" ON "_public_media_v" USING btree ("version_updated_at");
  CREATE INDEX "_public_media_v_version_version_created_at_idx" ON "_public_media_v" USING btree ("version_created_at");
  CREATE INDEX "_public_media_v_version_version__status_idx" ON "_public_media_v" USING btree ("version__status");
  CREATE INDEX "_public_media_v_version_version_filename_idx" ON "_public_media_v" USING btree ("version_filename");
  CREATE INDEX "_public_media_v_created_at_idx" ON "_public_media_v" USING btree ("created_at");
  CREATE INDEX "_public_media_v_updated_at_idx" ON "_public_media_v" USING btree ("updated_at");
  CREATE INDEX "_public_media_v_snapshot_idx" ON "_public_media_v" USING btree ("snapshot");
  CREATE INDEX "_public_media_v_published_locale_idx" ON "_public_media_v" USING btree ("published_locale");
  CREATE INDEX "_public_media_v_latest_idx" ON "_public_media_v" USING btree ("latest");
  CREATE UNIQUE INDEX "_public_media_v_locales_locale_parent_id_unique" ON "_public_media_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "business_identity_primary_logo_idx" ON "business_identity" USING btree ("primary_logo_id");
  CREATE INDEX "business_identity_compact_logo_idx" ON "business_identity" USING btree ("compact_logo_id");
  CREATE INDEX "business_identity_translation_workflow_en_translation_wo_idx" ON "business_identity" USING btree ("translation_workflow_en_reviewed_by_id");
  CREATE INDEX "business_identity_translation_workflow_en_translation__1_idx" ON "business_identity" USING btree ("translation_workflow_en_published_by_id");
  CREATE INDEX "business_identity_translation_workflow_en_translation__2_idx" ON "business_identity" USING btree ("translation_workflow_en_last_edited_by_id");
  CREATE INDEX "business_identity_translation_workflow_es_translation_wo_idx" ON "business_identity" USING btree ("translation_workflow_es_reviewed_by_id");
  CREATE INDEX "business_identity_translation_workflow_es_translation__1_idx" ON "business_identity" USING btree ("translation_workflow_es_published_by_id");
  CREATE INDEX "business_identity_translation_workflow_es_translation__2_idx" ON "business_identity" USING btree ("translation_workflow_es_last_edited_by_id");
  CREATE INDEX "business_identity_urgent_publication_controls_urgent_pub_idx" ON "business_identity" USING btree ("urgent_publication_controls_translation_owner_id");
  CREATE INDEX "business_identity__status_idx" ON "business_identity" USING btree ("_status");
  CREATE UNIQUE INDEX "business_identity_locales_locale_parent_id_unique" ON "business_identity_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_business_identity_v_version_version_primary_logo_idx" ON "_business_identity_v" USING btree ("version_primary_logo_id");
  CREATE INDEX "_business_identity_v_version_version_compact_logo_idx" ON "_business_identity_v" USING btree ("version_compact_logo_id");
  CREATE INDEX "_business_identity_v_version_translation_workflow_en_ver_idx" ON "_business_identity_v" USING btree ("version_translation_workflow_en_reviewed_by_id");
  CREATE INDEX "_business_identity_v_version_translation_workflow_en_v_1_idx" ON "_business_identity_v" USING btree ("version_translation_workflow_en_published_by_id");
  CREATE INDEX "_business_identity_v_version_translation_workflow_en_v_2_idx" ON "_business_identity_v" USING btree ("version_translation_workflow_en_last_edited_by_id");
  CREATE INDEX "_business_identity_v_version_translation_workflow_es_ver_idx" ON "_business_identity_v" USING btree ("version_translation_workflow_es_reviewed_by_id");
  CREATE INDEX "_business_identity_v_version_translation_workflow_es_v_1_idx" ON "_business_identity_v" USING btree ("version_translation_workflow_es_published_by_id");
  CREATE INDEX "_business_identity_v_version_translation_workflow_es_v_2_idx" ON "_business_identity_v" USING btree ("version_translation_workflow_es_last_edited_by_id");
  CREATE INDEX "_business_identity_v_version_urgent_publication_controls_idx" ON "_business_identity_v" USING btree ("version_urgent_publication_controls_translation_owner_id");
  CREATE INDEX "_business_identity_v_version_version__status_idx" ON "_business_identity_v" USING btree ("version__status");
  CREATE INDEX "_business_identity_v_created_at_idx" ON "_business_identity_v" USING btree ("created_at");
  CREATE INDEX "_business_identity_v_updated_at_idx" ON "_business_identity_v" USING btree ("updated_at");
  CREATE INDEX "_business_identity_v_snapshot_idx" ON "_business_identity_v" USING btree ("snapshot");
  CREATE INDEX "_business_identity_v_published_locale_idx" ON "_business_identity_v" USING btree ("published_locale");
  CREATE INDEX "_business_identity_v_latest_idx" ON "_business_identity_v" USING btree ("latest");
  CREATE UNIQUE INDEX "_business_identity_v_locales_locale_parent_id_unique" ON "_business_identity_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "contact_settings_business_hours_order_idx" ON "contact_settings_business_hours" USING btree ("_order");
  CREATE INDEX "contact_settings_business_hours_parent_id_idx" ON "contact_settings_business_hours" USING btree ("_parent_id");
  CREATE INDEX "contact_settings_translation_workflow_en_translation_wor_idx" ON "contact_settings" USING btree ("translation_workflow_en_reviewed_by_id");
  CREATE INDEX "contact_settings_translation_workflow_en_translation_w_1_idx" ON "contact_settings" USING btree ("translation_workflow_en_published_by_id");
  CREATE INDEX "contact_settings_translation_workflow_en_translation_w_2_idx" ON "contact_settings" USING btree ("translation_workflow_en_last_edited_by_id");
  CREATE INDEX "contact_settings_translation_workflow_es_translation_wor_idx" ON "contact_settings" USING btree ("translation_workflow_es_reviewed_by_id");
  CREATE INDEX "contact_settings_translation_workflow_es_translation_w_1_idx" ON "contact_settings" USING btree ("translation_workflow_es_published_by_id");
  CREATE INDEX "contact_settings_translation_workflow_es_translation_w_2_idx" ON "contact_settings" USING btree ("translation_workflow_es_last_edited_by_id");
  CREATE INDEX "contact_settings_urgent_publication_controls_urgent_publ_idx" ON "contact_settings" USING btree ("urgent_publication_controls_translation_owner_id");
  CREATE INDEX "contact_settings__status_idx" ON "contact_settings" USING btree ("_status");
  CREATE UNIQUE INDEX "contact_settings_locales_locale_parent_id_unique" ON "contact_settings_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_contact_settings_v_version_business_hours_order_idx" ON "_contact_settings_v_version_business_hours" USING btree ("_order");
  CREATE INDEX "_contact_settings_v_version_business_hours_parent_id_idx" ON "_contact_settings_v_version_business_hours" USING btree ("_parent_id");
  CREATE INDEX "_contact_settings_v_version_translation_workflow_en_vers_idx" ON "_contact_settings_v" USING btree ("version_translation_workflow_en_reviewed_by_id");
  CREATE INDEX "_contact_settings_v_version_translation_workflow_en_ve_1_idx" ON "_contact_settings_v" USING btree ("version_translation_workflow_en_published_by_id");
  CREATE INDEX "_contact_settings_v_version_translation_workflow_en_ve_2_idx" ON "_contact_settings_v" USING btree ("version_translation_workflow_en_last_edited_by_id");
  CREATE INDEX "_contact_settings_v_version_translation_workflow_es_vers_idx" ON "_contact_settings_v" USING btree ("version_translation_workflow_es_reviewed_by_id");
  CREATE INDEX "_contact_settings_v_version_translation_workflow_es_ve_1_idx" ON "_contact_settings_v" USING btree ("version_translation_workflow_es_published_by_id");
  CREATE INDEX "_contact_settings_v_version_translation_workflow_es_ve_2_idx" ON "_contact_settings_v" USING btree ("version_translation_workflow_es_last_edited_by_id");
  CREATE INDEX "_contact_settings_v_version_urgent_publication_controls__idx" ON "_contact_settings_v" USING btree ("version_urgent_publication_controls_translation_owner_id");
  CREATE INDEX "_contact_settings_v_version_version__status_idx" ON "_contact_settings_v" USING btree ("version__status");
  CREATE INDEX "_contact_settings_v_created_at_idx" ON "_contact_settings_v" USING btree ("created_at");
  CREATE INDEX "_contact_settings_v_updated_at_idx" ON "_contact_settings_v" USING btree ("updated_at");
  CREATE INDEX "_contact_settings_v_snapshot_idx" ON "_contact_settings_v" USING btree ("snapshot");
  CREATE INDEX "_contact_settings_v_published_locale_idx" ON "_contact_settings_v" USING btree ("published_locale");
  CREATE INDEX "_contact_settings_v_latest_idx" ON "_contact_settings_v" USING btree ("latest");
  CREATE UNIQUE INDEX "_contact_settings_v_locales_locale_parent_id_unique" ON "_contact_settings_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "portal_settings_translation_workflow_en_translation_work_idx" ON "portal_settings" USING btree ("translation_workflow_en_reviewed_by_id");
  CREATE INDEX "portal_settings_translation_workflow_en_translation_wo_1_idx" ON "portal_settings" USING btree ("translation_workflow_en_published_by_id");
  CREATE INDEX "portal_settings_translation_workflow_en_translation_wo_2_idx" ON "portal_settings" USING btree ("translation_workflow_en_last_edited_by_id");
  CREATE INDEX "portal_settings_translation_workflow_es_translation_work_idx" ON "portal_settings" USING btree ("translation_workflow_es_reviewed_by_id");
  CREATE INDEX "portal_settings_translation_workflow_es_translation_wo_1_idx" ON "portal_settings" USING btree ("translation_workflow_es_published_by_id");
  CREATE INDEX "portal_settings_translation_workflow_es_translation_wo_2_idx" ON "portal_settings" USING btree ("translation_workflow_es_last_edited_by_id");
  CREATE INDEX "portal_settings_urgent_publication_controls_urgent_publi_idx" ON "portal_settings" USING btree ("urgent_publication_controls_translation_owner_id");
  CREATE INDEX "portal_settings__status_idx" ON "portal_settings" USING btree ("_status");
  CREATE UNIQUE INDEX "portal_settings_locales_locale_parent_id_unique" ON "portal_settings_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_portal_settings_v_version_translation_workflow_en_versi_idx" ON "_portal_settings_v" USING btree ("version_translation_workflow_en_reviewed_by_id");
  CREATE INDEX "_portal_settings_v_version_translation_workflow_en_ver_1_idx" ON "_portal_settings_v" USING btree ("version_translation_workflow_en_published_by_id");
  CREATE INDEX "_portal_settings_v_version_translation_workflow_en_ver_2_idx" ON "_portal_settings_v" USING btree ("version_translation_workflow_en_last_edited_by_id");
  CREATE INDEX "_portal_settings_v_version_translation_workflow_es_versi_idx" ON "_portal_settings_v" USING btree ("version_translation_workflow_es_reviewed_by_id");
  CREATE INDEX "_portal_settings_v_version_translation_workflow_es_ver_1_idx" ON "_portal_settings_v" USING btree ("version_translation_workflow_es_published_by_id");
  CREATE INDEX "_portal_settings_v_version_translation_workflow_es_ver_2_idx" ON "_portal_settings_v" USING btree ("version_translation_workflow_es_last_edited_by_id");
  CREATE INDEX "_portal_settings_v_version_urgent_publication_controls_v_idx" ON "_portal_settings_v" USING btree ("version_urgent_publication_controls_translation_owner_id");
  CREATE INDEX "_portal_settings_v_version_version__status_idx" ON "_portal_settings_v" USING btree ("version__status");
  CREATE INDEX "_portal_settings_v_created_at_idx" ON "_portal_settings_v" USING btree ("created_at");
  CREATE INDEX "_portal_settings_v_updated_at_idx" ON "_portal_settings_v" USING btree ("updated_at");
  CREATE INDEX "_portal_settings_v_snapshot_idx" ON "_portal_settings_v" USING btree ("snapshot");
  CREATE INDEX "_portal_settings_v_published_locale_idx" ON "_portal_settings_v" USING btree ("published_locale");
  CREATE INDEX "_portal_settings_v_latest_idx" ON "_portal_settings_v" USING btree ("latest");
  CREATE UNIQUE INDEX "_portal_settings_v_locales_locale_parent_id_unique" ON "_portal_settings_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "homepage_content_process_steps_order_idx" ON "homepage_content_process_steps" USING btree ("_order");
  CREATE INDEX "homepage_content_process_steps_parent_id_idx" ON "homepage_content_process_steps" USING btree ("_parent_id");
  CREATE INDEX "homepage_content_process_steps_locale_idx" ON "homepage_content_process_steps" USING btree ("_locale");
  CREATE INDEX "homepage_content_translation_workflow_en_translation_wor_idx" ON "homepage_content" USING btree ("translation_workflow_en_reviewed_by_id");
  CREATE INDEX "homepage_content_translation_workflow_en_translation_w_1_idx" ON "homepage_content" USING btree ("translation_workflow_en_published_by_id");
  CREATE INDEX "homepage_content_translation_workflow_en_translation_w_2_idx" ON "homepage_content" USING btree ("translation_workflow_en_last_edited_by_id");
  CREATE INDEX "homepage_content_translation_workflow_es_translation_wor_idx" ON "homepage_content" USING btree ("translation_workflow_es_reviewed_by_id");
  CREATE INDEX "homepage_content_translation_workflow_es_translation_w_1_idx" ON "homepage_content" USING btree ("translation_workflow_es_published_by_id");
  CREATE INDEX "homepage_content_translation_workflow_es_translation_w_2_idx" ON "homepage_content" USING btree ("translation_workflow_es_last_edited_by_id");
  CREATE INDEX "homepage_content_urgent_publication_controls_urgent_publ_idx" ON "homepage_content" USING btree ("urgent_publication_controls_translation_owner_id");
  CREATE INDEX "homepage_content__status_idx" ON "homepage_content" USING btree ("_status");
  CREATE UNIQUE INDEX "homepage_content_locales_locale_parent_id_unique" ON "homepage_content_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_homepage_content_v_version_process_steps_order_idx" ON "_homepage_content_v_version_process_steps" USING btree ("_order");
  CREATE INDEX "_homepage_content_v_version_process_steps_parent_id_idx" ON "_homepage_content_v_version_process_steps" USING btree ("_parent_id");
  CREATE INDEX "_homepage_content_v_version_process_steps_locale_idx" ON "_homepage_content_v_version_process_steps" USING btree ("_locale");
  CREATE INDEX "_homepage_content_v_version_translation_workflow_en_vers_idx" ON "_homepage_content_v" USING btree ("version_translation_workflow_en_reviewed_by_id");
  CREATE INDEX "_homepage_content_v_version_translation_workflow_en_ve_1_idx" ON "_homepage_content_v" USING btree ("version_translation_workflow_en_published_by_id");
  CREATE INDEX "_homepage_content_v_version_translation_workflow_en_ve_2_idx" ON "_homepage_content_v" USING btree ("version_translation_workflow_en_last_edited_by_id");
  CREATE INDEX "_homepage_content_v_version_translation_workflow_es_vers_idx" ON "_homepage_content_v" USING btree ("version_translation_workflow_es_reviewed_by_id");
  CREATE INDEX "_homepage_content_v_version_translation_workflow_es_ve_1_idx" ON "_homepage_content_v" USING btree ("version_translation_workflow_es_published_by_id");
  CREATE INDEX "_homepage_content_v_version_translation_workflow_es_ve_2_idx" ON "_homepage_content_v" USING btree ("version_translation_workflow_es_last_edited_by_id");
  CREATE INDEX "_homepage_content_v_version_urgent_publication_controls__idx" ON "_homepage_content_v" USING btree ("version_urgent_publication_controls_translation_owner_id");
  CREATE INDEX "_homepage_content_v_version_version__status_idx" ON "_homepage_content_v" USING btree ("version__status");
  CREATE INDEX "_homepage_content_v_created_at_idx" ON "_homepage_content_v" USING btree ("created_at");
  CREATE INDEX "_homepage_content_v_updated_at_idx" ON "_homepage_content_v" USING btree ("updated_at");
  CREATE INDEX "_homepage_content_v_snapshot_idx" ON "_homepage_content_v" USING btree ("snapshot");
  CREATE INDEX "_homepage_content_v_published_locale_idx" ON "_homepage_content_v" USING btree ("published_locale");
  CREATE INDEX "_homepage_content_v_latest_idx" ON "_homepage_content_v" USING btree ("latest");
  CREATE UNIQUE INDEX "_homepage_content_v_locales_locale_parent_id_unique" ON "_homepage_content_v_locales" USING btree ("_locale","_parent_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_services_fk" FOREIGN KEY ("services_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_public_media_fk" FOREIGN KEY ("public_media_id") REFERENCES "public"."public_media"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_services_id_idx" ON "payload_locked_documents_rels" USING btree ("services_id");
  CREATE INDEX "payload_locked_documents_rels_public_media_id_idx" ON "payload_locked_documents_rels" USING btree ("public_media_id");`);
}

export async function down({
  db,
  payload,
  req,
}: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "services" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "services_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_services_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_services_v_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "public_media" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "public_media_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_public_media_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_public_media_v_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "business_identity" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "business_identity_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_business_identity_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_business_identity_v_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "contact_settings_business_hours" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "contact_settings" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "contact_settings_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_contact_settings_v_version_business_hours" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_contact_settings_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_contact_settings_v_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "portal_settings" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "portal_settings_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_portal_settings_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_portal_settings_v_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "homepage_content_process_steps" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "homepage_content" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "homepage_content_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_homepage_content_v_version_process_steps" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_homepage_content_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_homepage_content_v_locales" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "services" CASCADE;
  DROP TABLE "services_locales" CASCADE;
  DROP TABLE "_services_v" CASCADE;
  DROP TABLE "_services_v_locales" CASCADE;
  DROP TABLE "public_media" CASCADE;
  DROP TABLE "public_media_locales" CASCADE;
  DROP TABLE "_public_media_v" CASCADE;
  DROP TABLE "_public_media_v_locales" CASCADE;
  DROP TABLE "business_identity" CASCADE;
  DROP TABLE "business_identity_locales" CASCADE;
  DROP TABLE "_business_identity_v" CASCADE;
  DROP TABLE "_business_identity_v_locales" CASCADE;
  DROP TABLE "contact_settings_business_hours" CASCADE;
  DROP TABLE "contact_settings" CASCADE;
  DROP TABLE "contact_settings_locales" CASCADE;
  DROP TABLE "_contact_settings_v_version_business_hours" CASCADE;
  DROP TABLE "_contact_settings_v" CASCADE;
  DROP TABLE "_contact_settings_v_locales" CASCADE;
  DROP TABLE "portal_settings" CASCADE;
  DROP TABLE "portal_settings_locales" CASCADE;
  DROP TABLE "_portal_settings_v" CASCADE;
  DROP TABLE "_portal_settings_v_locales" CASCADE;
  DROP TABLE "homepage_content_process_steps" CASCADE;
  DROP TABLE "homepage_content" CASCADE;
  DROP TABLE "homepage_content_locales" CASCADE;
  DROP TABLE "_homepage_content_v_version_process_steps" CASCADE;
  DROP TABLE "_homepage_content_v" CASCADE;
  DROP TABLE "_homepage_content_v_locales" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_services_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_public_media_fk";
  
  ALTER TABLE "cms_users" ALTER COLUMN "role" SET DATA TYPE text;
  ALTER TABLE "cms_users" ALTER COLUMN "role" SET DEFAULT 'editor'::text;
  DROP TYPE "public"."enum_cms_users_role";
  CREATE TYPE "public"."enum_cms_users_role" AS ENUM('editor', 'publisher', 'cms-admin');
  ALTER TABLE "cms_users" ALTER COLUMN "role" SET DEFAULT 'editor'::"public"."enum_cms_users_role";
  ALTER TABLE "cms_users" ALTER COLUMN "role" SET DATA TYPE "public"."enum_cms_users_role" USING "role"::"public"."enum_cms_users_role";
  DROP INDEX "payload_locked_documents_rels_services_id_idx";
  DROP INDEX "payload_locked_documents_rels_public_media_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "services_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "public_media_id";
  DROP TYPE "public"."enum_services_content_policy";
  DROP TYPE "public"."enum_services_translation_workflow_en_state";
  DROP TYPE "public"."enum_services_translation_workflow_es_state";
  DROP TYPE "public"."enum_services_status";
  DROP TYPE "public"."enum__services_v_version_content_policy";
  DROP TYPE "public"."enum__services_v_version_translation_workflow_en_state";
  DROP TYPE "public"."enum__services_v_version_translation_workflow_es_state";
  DROP TYPE "public"."enum__services_v_version_status";
  DROP TYPE "public"."enum__services_v_published_locale";
  DROP TYPE "public"."enum_public_media_asset_type";
  DROP TYPE "public"."enum_public_media_status";
  DROP TYPE "public"."enum__public_media_v_version_asset_type";
  DROP TYPE "public"."enum__public_media_v_version_status";
  DROP TYPE "public"."enum__public_media_v_published_locale";
  DROP TYPE "public"."enum_business_identity_branding_status";
  DROP TYPE "public"."enum_business_identity_content_policy";
  DROP TYPE "public"."enum_business_identity_translation_workflow_en_state";
  DROP TYPE "public"."enum_business_identity_translation_workflow_es_state";
  DROP TYPE "public"."enum_business_identity_status";
  DROP TYPE "public"."enum__business_identity_v_version_branding_status";
  DROP TYPE "public"."enum__business_identity_v_version_content_policy";
  DROP TYPE "public"."enum__business_identity_v_version_translation_workflow_en_state";
  DROP TYPE "public"."enum__business_identity_v_version_translation_workflow_es_state";
  DROP TYPE "public"."enum__business_identity_v_version_status";
  DROP TYPE "public"."enum__business_identity_v_published_locale";
  DROP TYPE "public"."enum_contact_settings_business_hours_day";
  DROP TYPE "public"."enum_contact_settings_content_policy";
  DROP TYPE "public"."enum_contact_settings_translation_workflow_en_state";
  DROP TYPE "public"."enum_contact_settings_translation_workflow_es_state";
  DROP TYPE "public"."enum_contact_settings_status";
  DROP TYPE "public"."enum__contact_settings_v_version_business_hours_day";
  DROP TYPE "public"."enum__contact_settings_v_version_content_policy";
  DROP TYPE "public"."enum__contact_settings_v_version_translation_workflow_en_state";
  DROP TYPE "public"."enum__contact_settings_v_version_translation_workflow_es_state";
  DROP TYPE "public"."enum__contact_settings_v_version_status";
  DROP TYPE "public"."enum__contact_settings_v_published_locale";
  DROP TYPE "public"."enum_portal_settings_availability_state";
  DROP TYPE "public"."enum_portal_settings_content_policy";
  DROP TYPE "public"."enum_portal_settings_translation_workflow_en_state";
  DROP TYPE "public"."enum_portal_settings_translation_workflow_es_state";
  DROP TYPE "public"."enum_portal_settings_status";
  DROP TYPE "public"."enum__portal_settings_v_version_availability_state";
  DROP TYPE "public"."enum__portal_settings_v_version_content_policy";
  DROP TYPE "public"."enum__portal_settings_v_version_translation_workflow_en_state";
  DROP TYPE "public"."enum__portal_settings_v_version_translation_workflow_es_state";
  DROP TYPE "public"."enum__portal_settings_v_version_status";
  DROP TYPE "public"."enum__portal_settings_v_published_locale";
  DROP TYPE "public"."enum_homepage_content_content_policy";
  DROP TYPE "public"."enum_homepage_content_translation_workflow_en_state";
  DROP TYPE "public"."enum_homepage_content_translation_workflow_es_state";
  DROP TYPE "public"."enum_homepage_content_status";
  DROP TYPE "public"."enum__homepage_content_v_version_content_policy";
  DROP TYPE "public"."enum__homepage_content_v_version_translation_workflow_en_state";
  DROP TYPE "public"."enum__homepage_content_v_version_translation_workflow_es_state";
  DROP TYPE "public"."enum__homepage_content_v_version_status";
  DROP TYPE "public"."enum__homepage_content_v_published_locale";`);
}
