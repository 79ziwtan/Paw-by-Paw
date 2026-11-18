-- Dog photos: a private Storage bucket, readable/writable by staff who can access the dog.
-- Objects live at "<dog_id>/<random>.jpg"; dogs.photo_path holds that path (column already exists).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dog-photos', 'dog-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- The dog an object belongs to: its first folder, if that's a uuid (anything else -> null -> no access).
create or replace function public.dog_photo_dog_id(object_name text) returns uuid
language sql immutable set search_path = public as $$
  select case when split_part(object_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then split_part(object_name, '/', 1)::uuid end
$$;

create policy dog_photos_select on storage.objects for select to authenticated
  using (bucket_id = 'dog-photos' and public.can_access_dog(public.dog_photo_dog_id(name)));
create policy dog_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'dog-photos' and public.can_access_dog(public.dog_photo_dog_id(name)));
create policy dog_photos_update on storage.objects for update to authenticated
  using (bucket_id = 'dog-photos' and public.can_access_dog(public.dog_photo_dog_id(name)))
  with check (bucket_id = 'dog-photos' and public.can_access_dog(public.dog_photo_dog_id(name)));
create policy dog_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'dog-photos' and public.can_access_dog(public.dog_photo_dog_id(name)));

-- Expose photo_path on dog_summary (calendar, dog cards, summary card). Same view as
-- 20261117140000_dog_summary_trainer.sql with photo_path added at the end.
CREATE OR REPLACE VIEW "public"."dog_summary" WITH ("security_invoker"='true') AS
 SELECT "d"."id",
    "d"."name",
    "d"."breed",
    "d"."goal",
    "d"."location_id",
    "d"."household_id",
    "d"."archived_at",
    "h"."owner_name",
    "h"."phone",
    "h"."payment_status",
    ( SELECT ("p"."sessions_total" - "p"."sessions_used")
           FROM "public"."packages" "p"
          WHERE ("p"."household_id" = "h"."id")
          ORDER BY "p"."created_at" DESC
         LIMIT 1) AS "sessions_remaining",
    ( SELECT "ps"."name"
           FROM "public"."plan_stages" "ps"
          WHERE (("ps"."dog_id" = "d"."id") AND ("ps"."status" = 'in_progress'::"public"."stage_status"))
          ORDER BY "ps"."position"
         LIMIT 1) AS "current_stage",
    ( SELECT "count"(*) AS "count"
           FROM "public"."flags" "f"
          WHERE (("f"."dog_id" = "d"."id") AND ("f"."resolved_at" IS NULL))) AS "active_flags",
    ( SELECT "max"("f"."severity") AS "max"
           FROM "public"."flags" "f"
          WHERE (("f"."dog_id" = "d"."id") AND ("f"."resolved_at" IS NULL))) AS "max_flag_severity",
    ( SELECT "jsonb_agg"("s".* ORDER BY "s"."occurred_at" DESC) AS "jsonb_agg"
           FROM ( SELECT "s_1"."id",
                    "s_1"."occurred_at",
                    "s_1"."rating",
                    "s_1"."takes_food",
                    "s_1"."external_notes",
                    "s_1"."next_step",
                    ( SELECT "st"."display_name"
                           FROM "public"."staff" "st"
                          WHERE ("st"."id" = "s_1"."staff_id")) AS "trainer",
                    ( SELECT "jsonb_agg"("jsonb_build_object"('tag', "t"."label", 'measures', "sb"."measures")) AS "jsonb_agg"
                           FROM ("public"."session_behaviors" "sb"
                             JOIN "public"."behavior_tags" "t" ON (("t"."id" = "sb"."tag_id")))
                          WHERE ("sb"."session_id" = "s_1"."id")) AS "behaviors"
                   FROM "public"."sessions" "s_1"
                  WHERE ("s_1"."dog_id" = "d"."id")
                  ORDER BY "s_1"."occurred_at" DESC
                 LIMIT 2) "s") AS "last_sessions",
    "d"."birth_date",
    "d"."photo_path"
   FROM ("public"."dogs" "d"
     JOIN "public"."households" "h" ON (("h"."id" = "d"."household_id")));
