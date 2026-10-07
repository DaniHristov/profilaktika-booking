
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "admins": {
                  Row: {
                    "email": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "email": string,"user_id": string
                  }
                  Update: {
                    "email"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor": string,"booking_id": string | null,"created_at": string,"entity_id": string | null,"entity_type": string | null,"id": number,"payload": Json | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor": string,"booking_id"?: string | null,"created_at"?: string,"entity_id"?: string | null,"entity_type"?: string | null,"id"?: never,"payload"?: Json | null
                  }
                  Update: {
                    "action"?: string,"actor"?: string,"booking_id"?: string | null,"created_at"?: string,"entity_id"?: string | null,"entity_type"?: string | null,"id"?: never,"payload"?: Json | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_log_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    }
                  ]
                },"bookings": {
                  Row: {
                    "campaign_id": string,"cancel_token": string,"confirmation_sent_at": string | null,"consent_at": string,"created_at": string,"email": string,"full_name": string,"id": string,"notes": string | null,"phone": string,"slot_id": string,"status": string,"updated_at": string,"workplace": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "campaign_id": string,"cancel_token"?: string,"confirmation_sent_at"?: string | null,"consent_at": string,"created_at"?: string,"email": string,"full_name": string,"id"?: string,"notes"?: string | null,"phone": string,"slot_id": string,"status"?: string,"updated_at"?: string,"workplace"?: string | null
                  }
                  Update: {
                    "campaign_id"?: string,"cancel_token"?: string,"confirmation_sent_at"?: string | null,"consent_at"?: string,"created_at"?: string,"email"?: string,"full_name"?: string,"id"?: string,"notes"?: string | null,"phone"?: string,"slot_id"?: string,"status"?: string,"updated_at"?: string,"workplace"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "bookings_slot_id_campaign_id_fkey"
      columns: ["slot_id","campaign_id"]
isOneToOne: false
      referencedRelation: "admin_slot_stats"
      referencedColumns: ["id","campaign_id"]
    },{
      foreignKeyName: "bookings_slot_id_campaign_id_fkey"
      columns: ["slot_id","campaign_id"]
isOneToOne: false
      referencedRelation: "slots"
      referencedColumns: ["id","campaign_id"]
    }
                  ]
                },"campaigns": {
                  Row: {
                    "allow_public_cancel": boolean,"booking_closes_hours_before": number,"cancel_closes_hours_before": number,"created_at": string,"id": string,"is_active": boolean,"location_address": string,"location_note": string | null,"slug": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "allow_public_cancel"?: boolean,"booking_closes_hours_before"?: number,"cancel_closes_hours_before"?: number,"created_at"?: string,"id"?: string,"is_active"?: boolean,"location_address": string,"location_note"?: string | null,"slug": string,"title": string
                  }
                  Update: {
                    "allow_public_cancel"?: boolean,"booking_closes_hours_before"?: number,"cancel_closes_hours_before"?: number,"created_at"?: string,"id"?: string,"is_active"?: boolean,"location_address"?: string,"location_note"?: string | null,"slug"?: string,"title"?: string
                  }
                  Relationships: [
                    
                  ]
                },"rate_limit_hits": {
                  Row: {
                    "created_at": string,"id": number,"ip_hash": string,"kind": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: never,"ip_hash": string,"kind": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"ip_hash"?: string,"kind"?: string
                  }
                  Relationships: [
                    
                  ]
                },"slots": {
                  Row: {
                    "campaign_id": string,"capacity": number,"duration_min": number,"id": string,"is_blocked": boolean,"starts_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "campaign_id": string,"capacity"?: number,"duration_min": number,"id"?: string,"is_blocked"?: boolean,"starts_at": string
                  }
                  Update: {
                    "campaign_id"?: string,"capacity"?: number,"duration_min"?: number,"id"?: string,"is_blocked"?: boolean,"starts_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "slots_campaign_id_fkey"
      columns: ["campaign_id"]
isOneToOne: false
      referencedRelation: "admin_campaign_stats"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "slots_campaign_id_fkey"
      columns: ["campaign_id"]
isOneToOne: false
      referencedRelation: "campaigns"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "admin_campaign_stats": {
                  Row: {
                    "allow_public_cancel": boolean | null,"booking_closes_hours_before": number | null,"cancel_closes_hours_before": number | null,"created_at": string | null,"id": string | null,"is_active": boolean | null,"location_address": string | null,"location_note": string | null,"slug": string | null,"title": string | null,"upcoming_bookings": number | null,"upcoming_slots": number | null
                  }
                  ComputedFields: never
                  Insert: {
                           "allow_public_cancel"?: boolean | null,"booking_closes_hours_before"?: number | null,"cancel_closes_hours_before"?: number | null,"created_at"?: string | null,"id"?: string | null,"is_active"?: boolean | null,"location_address"?: string | null,"location_note"?: string | null,"slug"?: string | null,"title"?: string | null,"upcoming_bookings"?: never,"upcoming_slots"?: never
                         }
                        Update: {
                           "allow_public_cancel"?: boolean | null,"booking_closes_hours_before"?: number | null,"cancel_closes_hours_before"?: number | null,"created_at"?: string | null,"id"?: string | null,"is_active"?: boolean | null,"location_address"?: string | null,"location_note"?: string | null,"slug"?: string | null,"title"?: string | null,"upcoming_bookings"?: never,"upcoming_slots"?: never
                         }
                        Relationships: [
                    
                  ]
                },"admin_slot_stats": {
                  Row: {
                    "campaign_id": string | null,"capacity": number | null,"confirmed_count": number | null,"duration_min": number | null,"id": string | null,"is_blocked": boolean | null,"starts_at": string | null,"total_bookings": number | null
                  }
                  ComputedFields: never
                  Insert: {
                           "campaign_id"?: string | null,"capacity"?: number | null,"confirmed_count"?: never,"duration_min"?: number | null,"id"?: string | null,"is_blocked"?: boolean | null,"starts_at"?: string | null,"total_bookings"?: never
                         }
                        Update: {
                           "campaign_id"?: string | null,"capacity"?: number | null,"confirmed_count"?: never,"duration_min"?: number | null,"id"?: string | null,"is_blocked"?: boolean | null,"starts_at"?: string | null,"total_bookings"?: never
                         }
                        Relationships: [
                    {
      foreignKeyName: "slots_campaign_id_fkey"
      columns: ["campaign_id"]
isOneToOne: false
      referencedRelation: "admin_campaign_stats"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "slots_campaign_id_fkey"
      columns: ["campaign_id"]
isOneToOne: false
      referencedRelation: "campaigns"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "admin_actor":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"admin_cancel_booking":
{ Args: { "p_booking_id": string }; Returns: {
              "booking_id": string,"campaign_title": string,"duration_min": number,"email": string,"full_name": string,"location_address": string,"location_note": string,"starts_at": string
            }[]
                           },
"admin_delete_slot":
{ Args: { "p_slot_id": string }; Returns: undefined
                           },
"admin_generate_slots":
{ Args: { "p_campaign_id": string,"p_capacity": number,"p_dates": (string)[],"p_dry_run": boolean,"p_duration_min": number,"p_end": string,"p_start": string }; Returns: {
              "starts_at": string,"status": string
            }[]
                           },
"admin_list_bookings":
{ Args: { "p_campaign_id": string,"p_date": string,"p_limit": number,"p_offset": number,"p_search": string,"p_status": string,"p_time": string }; Returns: {
              "campaign_id": string,"campaign_title": string,"confirmation_sent_at": string,"created_at": string,"duration_min": number,"email": string,"full_name": string,"id": string,"notes": string,"phone": string,"slot_id": string,"starts_at": string,"status": string,"total_count": number,"workplace": string
            }[]
                           },
"admin_log_export":
{ Args: { "p_filters": Json,"p_format": string,"p_profile": string,"p_row_count": number }; Returns: undefined
                           },
"admin_move_booking":
{ Args: { "p_booking_id": string,"p_new_slot_id": string }; Returns: {
              "allow_public_cancel": boolean,"booking_id": string,"campaign_title": string,"cancel_token": string,"duration_min": number,"email": string,"full_name": string,"location_address": string,"location_note": string,"starts_at": string
            }[]
                           },
"admin_save_campaign":
{ Args: { "p_allow_public_cancel": boolean,"p_booking_closes_hours_before": number,"p_cancel_closes_hours_before": number,"p_id": string,"p_is_active": boolean,"p_location_address": string,"p_location_note": string,"p_slug": string,"p_title": string }; Returns: string
                           },
"admin_update_booking":
{ Args: { "p_booking_id": string,"p_email": string,"p_full_name": string,"p_notes": string,"p_phone": string,"p_workplace": string }; Returns: undefined
                           },
"admin_update_slot":
{ Args: { "p_capacity": number,"p_is_blocked": boolean,"p_slot_id": string }; Returns: undefined
                           },
"assert_admin":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"book_slot":
{ Args: { "p_email": string,"p_full_name": string,"p_notes": string,"p_phone": string,"p_slot_id": string,"p_workplace": string }; Returns: {
              "booking_id": string,"campaign_title": string,"cancel_token": string,"duration_min": number,"location_address": string,"location_note": string,"starts_at": string
            }[]
                           },
"cancel_booking_by_token":
{ Args: { "p_token": string }; Returns: {
              "booking_id": string,"campaign_title": string,"duration_min": number,"email": string,"full_name": string,"location_address": string,"location_note": string,"starts_at": string
            }[]
                           },
"check_rate_limit":
{ Args: { "p_ip_hash": string,"p_kind": string,"p_limit": number,"p_record"?: boolean,"p_window": string }; Returns: boolean
                           },
"get_availability":
{ Args: { "p_slug": string }; Returns: {
              "available_count": number,"duration_min": number,"slot_id": string,"starts_at": string
            }[]
                           },
"get_booking_for_cancel":
{ Args: { "p_token": string }; Returns: {
              "campaign_title": string,"cancel_state": string,"duration_min": number,"full_name": string,"location_address": string,"location_note": string,"starts_at": string
            }[]
                           },
"get_campaign_public":
{ Args: { "p_slug": string }; Returns: {
              "is_active": boolean,"location_address": string,"location_note": string,"title": string
            }[]
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"slot_times":
{ Args: { "p_dates": (string)[],"p_duration_min": number,"p_end": string,"p_start": string }; Returns: string[]
                           }
          }
          Enums: {
            [_ in never]: never
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
  "public": {
          Enums: {
            
          }
        }
} as const
