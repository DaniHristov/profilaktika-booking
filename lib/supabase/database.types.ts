
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
                    "action": string,"actor": string,"booking_id": string | null,"created_at": string,"id": number,"payload": Json | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor": string,"booking_id"?: string | null,"created_at"?: string,"id"?: never,"payload"?: Json | null
                  }
                  Update: {
                    "action"?: string,"actor"?: string,"booking_id"?: string | null,"created_at"?: string,"id"?: never,"payload"?: Json | null
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
                    "campaign_id": string,"cancel_token": string,"consent_at": string,"created_at": string,"email": string,"full_name": string,"id": string,"notes": string | null,"phone": string,"slot_id": string,"status": string,"updated_at": string,"workplace": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "campaign_id": string,"cancel_token"?: string,"consent_at": string,"created_at"?: string,"email": string,"full_name": string,"id"?: string,"notes"?: string | null,"phone": string,"slot_id": string,"status"?: string,"updated_at"?: string,"workplace"?: string | null
                  }
                  Update: {
                    "campaign_id"?: string,"cancel_token"?: string,"consent_at"?: string,"created_at"?: string,"email"?: string,"full_name"?: string,"id"?: string,"notes"?: string | null,"phone"?: string,"slot_id"?: string,"status"?: string,"updated_at"?: string,"workplace"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "bookings_slot_id_campaign_id_fkey"
      columns: ["slot_id","campaign_id"]
isOneToOne: false
      referencedRelation: "slots"
      referencedColumns: ["id","campaign_id"]
    }
                  ]
                },"campaigns": {
                  Row: {
                    "booking_closes_hours_before": number,"created_at": string,"id": string,"is_active": boolean,"location_address": string,"location_note": string | null,"slug": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "booking_closes_hours_before"?: number,"created_at"?: string,"id"?: string,"is_active"?: boolean,"location_address": string,"location_note"?: string | null,"slug": string,"title": string
                  }
                  Update: {
                    "booking_closes_hours_before"?: number,"created_at"?: string,"id"?: string,"is_active"?: boolean,"location_address"?: string,"location_note"?: string | null,"slug"?: string,"title"?: string
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
      referencedRelation: "campaigns"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "get_availability":
{ Args: { "p_slug": string }; Returns: {
              "available_count": number,"duration_min": number,"slot_id": string,"starts_at": string
            }[]
                           },
"get_campaign_public":
{ Args: { "p_slug": string }; Returns: {
              "is_active": boolean,"location_address": string,"location_note": string,"title": string
            }[]
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
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
