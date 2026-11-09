
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "activity_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"actor_label": string | null,"changes": (string)[] | null,"created_at": string,"dog_id": string | null,"dog_name": string | null,"id": string,"label": string | null,"location_id": string | null,"org_id": string,"record_id": string | null,"table_name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"actor_label"?: string | null,"changes"?: (string)[] | null,"created_at"?: string,"dog_id"?: string | null,"dog_name"?: string | null,"id"?: string,"label"?: string | null,"location_id"?: string | null,"org_id": string,"record_id"?: string | null,"table_name": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"actor_label"?: string | null,"changes"?: (string)[] | null,"created_at"?: string,"dog_id"?: string | null,"dog_name"?: string | null,"id"?: string,"label"?: string | null,"location_id"?: string | null,"org_id"?: string,"record_id"?: string | null,"table_name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "activity_log_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activity_log_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activity_log_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"behavior_tags": {
                  Row: {
                    "created_at": string,"id": string,"label": string,"org_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"label": string,"org_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"label"?: string,"org_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "behavior_tags_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"dog_transfers": {
                  Row: {
                    "by_staff_id": string | null,"created_at": string,"dog_id": string,"from_location_id": string,"id": string,"reason": string | null,"to_location_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "by_staff_id"?: string | null,"created_at"?: string,"dog_id": string,"from_location_id": string,"id"?: string,"reason"?: string | null,"to_location_id": string
                  }
                  Update: {
                    "by_staff_id"?: string | null,"created_at"?: string,"dog_id"?: string,"from_location_id"?: string,"id"?: string,"reason"?: string | null,"to_location_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "dog_transfers_by_staff_id_fkey"
      columns: ["by_staff_id"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dog_transfers_dog_id_fkey"
      columns: ["dog_id"]
isOneToOne: false
      referencedRelation: "dog_summary"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dog_transfers_dog_id_fkey"
      columns: ["dog_id"]
isOneToOne: false
      referencedRelation: "dogs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dog_transfers_from_location_id_fkey"
      columns: ["from_location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dog_transfers_to_location_id_fkey"
      columns: ["to_location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    }
                  ]
                },"dogs": {
                  Row: {
                    "archived_at": string | null,"assigned_trainer_id": string | null,"birth_date": string | null,"breed": string | null,"created_at": string,"goal": string,"household_id": string,"id": string,"location_id": string,"name": string,"notes": string,"org_id": string,"photo_path": string | null,"presenting_problem": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"assigned_trainer_id"?: string | null,"birth_date"?: string | null,"breed"?: string | null,"created_at"?: string,"goal"?: string,"household_id": string,"id"?: string,"location_id": string,"name": string,"notes"?: string,"org_id": string,"photo_path"?: string | null,"presenting_problem"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"assigned_trainer_id"?: string | null,"birth_date"?: string | null,"breed"?: string | null,"created_at"?: string,"goal"?: string,"household_id"?: string,"id"?: string,"location_id"?: string,"name"?: string,"notes"?: string,"org_id"?: string,"photo_path"?: string | null,"presenting_problem"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "dogs_assigned_trainer_id_fkey"
      columns: ["assigned_trainer_id"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dogs_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dogs_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dogs_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"flags": {
                  Row: {
                    "created_at": string,"created_by": string | null,"dog_id": string,"id": string,"note": string,"resolution_note": string | null,"resolved_at": string | null,"resolved_by": string | null,"session_id": string | null,"severity": Database["public"]['Enums']["flag_severity"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"dog_id": string,"id"?: string,"note": string,"resolution_note"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"session_id"?: string | null,"severity": Database["public"]['Enums']["flag_severity"]
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"dog_id"?: string,"id"?: string,"note"?: string,"resolution_note"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"session_id"?: string | null,"severity"?: Database["public"]['Enums']["flag_severity"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "flags_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "flags_dog_id_fkey"
      columns: ["dog_id"]
isOneToOne: false
      referencedRelation: "dog_summary"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "flags_dog_id_fkey"
      columns: ["dog_id"]
isOneToOne: false
      referencedRelation: "dogs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "flags_resolved_by_fkey"
      columns: ["resolved_by"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "flags_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "flags_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "unsent_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"homework_tasks": {
                  Row: {
                    "completed_at": string | null,"completed_by": string | null,"created_at": string,"created_by": string | null,"dog_id": string,"id": string,"position": number,"session_id": string | null,"text": string,"update_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string | null,"completed_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"dog_id": string,"id"?: string,"position": number,"session_id"?: string | null,"text": string,"update_id"?: string | null
                  }
                  Update: {
                    "completed_at"?: string | null,"completed_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"dog_id"?: string,"id"?: string,"position"?: number,"session_id"?: string | null,"text"?: string,"update_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "homework_tasks_completed_by_fkey"
      columns: ["completed_by"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "homework_tasks_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "homework_tasks_dog_id_fkey"
      columns: ["dog_id"]
isOneToOne: false
      referencedRelation: "dog_summary"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "homework_tasks_dog_id_fkey"
      columns: ["dog_id"]
isOneToOne: false
      referencedRelation: "dogs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "homework_tasks_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "homework_tasks_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "unsent_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "homework_tasks_update_id_fkey"
      columns: ["update_id"]
isOneToOne: false
      referencedRelation: "owner_updates"
      referencedColumns: ["id"]
    }
                  ]
                },"households": {
                  Row: {
                    "created_at": string,"email": string | null,"id": string,"internal_notes": string,"location_id": string,"org_id": string,"owner_name": string,"payment_status": Database["public"]['Enums']["payment_status"],"phone": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email"?: string | null,"id"?: string,"internal_notes"?: string,"location_id": string,"org_id": string,"owner_name": string,"payment_status"?: Database["public"]['Enums']["payment_status"],"phone": string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string | null,"id"?: string,"internal_notes"?: string,"location_id"?: string,"org_id"?: string,"owner_name"?: string,"payment_status"?: Database["public"]['Enums']["payment_status"],"phone"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "households_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "households_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"locations": {
                  Row: {
                    "city": string | null,"created_at": string,"id": string,"name": string,"org_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "city"?: string | null,"created_at"?: string,"id"?: string,"name": string,"org_id": string
                  }
                  Update: {
                    "city"?: string | null,"created_at"?: string,"id"?: string,"name"?: string,"org_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "locations_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"organizations": {
                  Row: {
                    "created_at": string,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"owner_links": {
                  Row: {
                    "created_at": string,"created_by": string | null,"dog_id": string | null,"expires_at": string,"first_opened_at": string | null,"household_id": string,"id": string,"token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"dog_id"?: string | null,"expires_at": string,"first_opened_at"?: string | null,"household_id": string,"id"?: string,"token_hash": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"dog_id"?: string | null,"expires_at"?: string,"first_opened_at"?: string | null,"household_id"?: string,"id"?: string,"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "owner_links_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "owner_links_dog_id_fkey"
      columns: ["dog_id"]
isOneToOne: false
      referencedRelation: "dog_summary"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "owner_links_dog_id_fkey"
      columns: ["dog_id"]
isOneToOne: false
      referencedRelation: "dogs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "owner_links_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"owner_updates": {
                  Row: {
                    "created_at": string,"created_by": string | null,"dog_id": string,"expires_at": string | null,"first_opened_at": string | null,"id": string,"link_requested_at": string | null,"plan_progress": string,"sent_at": string | null,"session_id": string | null,"token_hash": string | null,"worked_on": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"dog_id": string,"expires_at"?: string | null,"first_opened_at"?: string | null,"id"?: string,"link_requested_at"?: string | null,"plan_progress"?: string,"sent_at"?: string | null,"session_id"?: string | null,"token_hash"?: string | null,"worked_on": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"dog_id"?: string,"expires_at"?: string | null,"first_opened_at"?: string | null,"id"?: string,"link_requested_at"?: string | null,"plan_progress"?: string,"sent_at"?: string | null,"session_id"?: string | null,"token_hash"?: string | null,"worked_on"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "owner_updates_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "owner_updates_dog_id_fkey"
      columns: ["dog_id"]
isOneToOne: false
      referencedRelation: "dog_summary"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "owner_updates_dog_id_fkey"
      columns: ["dog_id"]
isOneToOne: false
      referencedRelation: "dogs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "owner_updates_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "owner_updates_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "unsent_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"packages": {
                  Row: {
                    "created_at": string,"expires_on": string | null,"household_id": string,"id": string,"name": string,"paid": boolean,"sessions_total": number,"sessions_used": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"expires_on"?: string | null,"household_id": string,"id"?: string,"name": string,"paid"?: boolean,"sessions_total": number,"sessions_used"?: number
                  }
                  Update: {
                    "created_at"?: string,"expires_on"?: string | null,"household_id"?: string,"id"?: string,"name"?: string,"paid"?: boolean,"sessions_total"?: number,"sessions_used"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "packages_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"permission_keys": {
                  Row: {
                    "key": string,"label": string,"position": number
                  }
                  ComputedFields: never
                  Insert: {
                    "key": string,"label": string,"position": number
                  }
                  Update: {
                    "key"?: string,"label"?: string,"position"?: number
                  }
                  Relationships: [
                    
                  ]
                },"plan_stages": {
                  Row: {
                    "created_at": string,"description": string | null,"dog_id": string,"id": string,"name": string,"position": number,"source_template_id": string | null,"status": Database["public"]['Enums']["stage_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"dog_id": string,"id"?: string,"name": string,"position": number,"source_template_id"?: string | null,"status"?: Database["public"]['Enums']["stage_status"]
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"dog_id"?: string,"id"?: string,"name"?: string,"position"?: number,"source_template_id"?: string | null,"status"?: Database["public"]['Enums']["stage_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "plan_stages_dog_id_fkey"
      columns: ["dog_id"]
isOneToOne: false
      referencedRelation: "dog_summary"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "plan_stages_dog_id_fkey"
      columns: ["dog_id"]
isOneToOne: false
      referencedRelation: "dogs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "plan_stages_source_template_id_fkey"
      columns: ["source_template_id"]
isOneToOne: false
      referencedRelation: "plan_templates"
      referencedColumns: ["id"]
    }
                  ]
                },"plan_templates": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"org_id": string,"stages": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"org_id": string,"stages"?: NonNullable<Json>
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"org_id"?: string,"stages"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "plan_templates_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"session_behaviors": {
                  Row: {
                    "id": string,"measures": NonNullable<Json>,"note": string | null,"session_id": string,"tag_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"measures"?: NonNullable<Json>,"note"?: string | null,"session_id": string,"tag_id": string
                  }
                  Update: {
                    "id"?: string,"measures"?: NonNullable<Json>,"note"?: string | null,"session_id"?: string,"tag_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "session_behaviors_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "session_behaviors_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "unsent_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "session_behaviors_tag_id_fkey"
      columns: ["tag_id"]
isOneToOne: false
      referencedRelation: "behavior_tags"
      referencedColumns: ["id"]
    }
                  ]
                },"sessions": {
                  Row: {
                    "created_at": string,"dog_id": string,"external_notes": string,"id": string,"internal_notes": string,"next_step": string,"occurred_at": string,"package_id": string | null,"rating": number | null,"staff_id": string | null,"takes_food": boolean | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"dog_id": string,"external_notes"?: string,"id"?: string,"internal_notes"?: string,"next_step"?: string,"occurred_at"?: string,"package_id"?: string | null,"rating"?: number | null,"staff_id"?: string | null,"takes_food"?: boolean | null
                  }
                  Update: {
                    "created_at"?: string,"dog_id"?: string,"external_notes"?: string,"id"?: string,"internal_notes"?: string,"next_step"?: string,"occurred_at"?: string,"package_id"?: string | null,"rating"?: number | null,"staff_id"?: string | null,"takes_food"?: boolean | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "sessions_dog_id_fkey"
      columns: ["dog_id"]
isOneToOne: false
      referencedRelation: "dog_summary"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sessions_dog_id_fkey"
      columns: ["dog_id"]
isOneToOne: false
      referencedRelation: "dogs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sessions_package_id_fkey"
      columns: ["package_id"]
isOneToOne: false
      referencedRelation: "packages"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sessions_staff_id_fkey"
      columns: ["staff_id"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    }
                  ]
                },"staff": {
                  Row: {
                    "created_at": string,"deactivated_at": string | null,"display_name": string,"id": string,"org_id": string,"permissions": (string)[],"role": Database["public"]['Enums']["staff_role"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"deactivated_at"?: string | null,"display_name": string,"id": string,"org_id": string,"permissions"?: (string)[],"role"?: Database["public"]['Enums']["staff_role"]
                  }
                  Update: {
                    "created_at"?: string,"deactivated_at"?: string | null,"display_name"?: string,"id"?: string,"org_id"?: string,"permissions"?: (string)[],"role"?: Database["public"]['Enums']["staff_role"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "staff_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"staff_locations": {
                  Row: {
                    "location_id": string,"staff_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "location_id": string,"staff_id": string
                  }
                  Update: {
                    "location_id"?: string,"staff_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "staff_locations_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "staff_locations_staff_id_fkey"
      columns: ["staff_id"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    }
                  ]
                },"stage_events": {
                  Row: {
                    "by_staff_id": string | null,"created_at": string,"dog_id": string,"from_status": Database["public"]['Enums']["stage_status"] | null,"id": string,"reason": string | null,"session_id": string | null,"stage_id": string,"to_status": Database["public"]['Enums']["stage_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "by_staff_id"?: string | null,"created_at"?: string,"dog_id": string,"from_status"?: Database["public"]['Enums']["stage_status"] | null,"id"?: string,"reason"?: string | null,"session_id"?: string | null,"stage_id": string,"to_status": Database["public"]['Enums']["stage_status"]
                  }
                  Update: {
                    "by_staff_id"?: string | null,"created_at"?: string,"dog_id"?: string,"from_status"?: Database["public"]['Enums']["stage_status"] | null,"id"?: string,"reason"?: string | null,"session_id"?: string | null,"stage_id"?: string,"to_status"?: Database["public"]['Enums']["stage_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "stage_events_by_staff_id_fkey"
      columns: ["by_staff_id"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stage_events_dog_id_fkey"
      columns: ["dog_id"]
isOneToOne: false
      referencedRelation: "dog_summary"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stage_events_dog_id_fkey"
      columns: ["dog_id"]
isOneToOne: false
      referencedRelation: "dogs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stage_events_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stage_events_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "unsent_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stage_events_stage_id_fkey"
      columns: ["stage_id"]
isOneToOne: false
      referencedRelation: "plan_stages"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "dog_summary": {
                  Row: {
                    "active_flags": number | null,"archived_at": string | null,"birth_date": string | null,"breed": string | null,"current_stage": string | null,"goal": string,"household_id": string,"id": string,"last_sessions": Json | null,"location_id": string,"max_flag_severity": Database["public"]['Enums']["flag_severity"] | null,"name": string,"owner_name": string,"payment_status": Database["public"]['Enums']["payment_status"],"phone": string,"sessions_remaining": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "dogs_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dogs_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    }
                  ]
                },"unsent_sessions": {
                  Row: {
                    "dog_id": string,"dog_name": string,"external_notes": string,"homework": Json | null,"household_id": string,"id": string,"occurred_at": string,"owner_name": string,"trainer_name": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "dogs_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sessions_dog_id_fkey"
      columns: ["dog_id"]
isOneToOne: false
      referencedRelation: "dog_summary"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sessions_dog_id_fkey"
      columns: ["dog_id"]
isOneToOne: false
      referencedRelation: "dogs"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "auth_org_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"auth_role":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["staff_role"]
                           },
"can_access_dog":
{ Args: { "d": string }; Returns: boolean
                           },
"can_access_location":
{ Args: { "loc": string }; Returns: boolean
                           },
"create_organization":
{ Args: { "first_location"?: string,"org_name": string,"owner_display_name": string }; Returns: string
                           },
"create_owner_link":
{ Args: { "p_dog_id"?: string,"p_household_id": string }; Returns: string
                           },
"get_owner_profile":
{ Args: { "token": string }; Returns: Json
                           },
"get_owner_update":
{ Args: { "token": string }; Returns: Json
                           },
"get_team":
{ Args: Record<PropertyKey, never>; Returns: {
              "deactivated_at": string,"display_name": string,"email": string,"id": string,"last_sign_in_at": string,"location_ids": (string)[],"permissions": (string)[],"role": Database["public"]['Enums']["staff_role"]
            }[]
                           },
"has_perm":
{ Args: { "p": string }; Returns: boolean
                           },
"log_session":
{ Args: { "p_behaviors"?: Json,"p_count_package"?: boolean,"p_dog_id": string,"p_external_notes"?: string,"p_flag"?: Json,"p_homework"?: Json,"p_internal_notes"?: string,"p_occurred_at"?: string,"p_rating"?: number,"p_stage"?: Json,"p_takes_food"?: boolean }; Returns: string
                           },
"record_activity":
{ Args: { "p_action": string,"p_actor"?: string,"p_at"?: string,"p_changes"?: (string)[],"p_table": string,"r": Json }; Returns: undefined
                           },
"request_new_link":
{ Args: { "token": string }; Returns: undefined
                           },
"set_admin_permissions":
{ Args: { "p_permissions": (string)[],"p_staff_id": string }; Returns: undefined
                           },
"set_homework":
{ Args: { "done": boolean,"task_id": string,"token": string }; Returns: undefined
                           },
"set_profile_homework":
{ Args: { "done": boolean,"task_id": string,"token": string }; Returns: undefined
                           },
"set_trainer_active":
{ Args: { "p_active": boolean,"p_staff_id": string }; Returns: undefined
                           },
"transfer_household":
{ Args: { "p_household_id": string,"p_location_id": string,"p_reason"?: string }; Returns: undefined
                           },
"update_session":
{ Args: { "p_behaviors": Json,"p_external_notes": string,"p_internal_notes": string,"p_occurred_at": string,"p_rating": number,"p_session_id": string,"p_takes_food": boolean }; Returns: undefined
                           }
          }
          Enums: {
            "flag_severity": "low"|"med"|"high","payment_status": "current"|"overdue"|"none","staff_role": "owner"|"admin"|"trainer","stage_status": "not_started"|"in_progress"|"complete"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "flag_severity": ["low", "med", "high"],"payment_status": ["current", "overdue", "none"],"staff_role": ["owner", "admin", "trainer"],"stage_status": ["not_started", "in_progress", "complete"]
          }
        }
} as const
