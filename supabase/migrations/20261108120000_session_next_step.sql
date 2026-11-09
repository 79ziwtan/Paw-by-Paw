-- Session log: a short "next step" the trainer taps or types at the end of a session.
-- Shown on the dog summary card (via dog_summary.last_sessions) so the next lesson starts from it.

alter table public.sessions add column if not exists next_step text not null default '';

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
                    ( SELECT "jsonb_agg"("jsonb_build_object"('tag', "t"."label", 'measures', "sb"."measures")) AS "jsonb_agg"
                           FROM ("public"."session_behaviors" "sb"
                             JOIN "public"."behavior_tags" "t" ON (("t"."id" = "sb"."tag_id")))
                          WHERE ("sb"."session_id" = "s_1"."id")) AS "behaviors"
                   FROM "public"."sessions" "s_1"
                  WHERE ("s_1"."dog_id" = "d"."id")
                  ORDER BY "s_1"."occurred_at" DESC
                 LIMIT 2) "s") AS "last_sessions",
    "d"."birth_date"
   FROM ("public"."dogs" "d"
     JOIN "public"."households" "h" ON (("h"."id" = "d"."household_id")));
