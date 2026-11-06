export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          bank_account_holder: string
          bank_account_number: string
          bank_account_type: string
          bank_branch_code: string
          bank_name: string
          free_photos_per_day: number
          free_translations_per_day: number
          id: number
          price_12m: number
          price_1m: number
          price_3m: number
          updated_at: string
          whatsapp_number: string
        }
        Insert: {
          bank_account_holder?: string
          bank_account_number?: string
          bank_account_type?: string
          bank_branch_code?: string
          bank_name?: string
          free_photos_per_day?: number
          free_translations_per_day?: number
          id?: number
          price_12m?: number
          price_1m?: number
          price_3m?: number
          updated_at?: string
          whatsapp_number?: string
        }
        Update: {
          bank_account_holder?: string
          bank_account_number?: string
          bank_account_type?: string
          bank_branch_code?: string
          bank_name?: string
          free_photos_per_day?: number
          free_translations_per_day?: number
          id?: number
          price_12m?: number
          price_1m?: number
          price_3m?: number
          updated_at?: string
          whatsapp_number?: string
        }
        Relationships: []
      }
      direct_conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          participant_a: string
          participant_b: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          participant_a: string
          participant_b: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          participant_a?: string
          participant_b?: string
        }
        Relationships: []
      }
      direct_messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "direct_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_requests: {
        Row: {
          amount: number
          created_at: string
          id: string
          paid_amount: number | null
          paid_on: string | null
          payer_bank: string | null
          payer_name: string | null
          plan_months: number
          proof_path: string | null
          ref: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["payment_status"]
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          paid_amount?: number | null
          paid_on?: string | null
          payer_bank?: string | null
          payer_name?: string | null
          plan_months: number
          proof_path?: string | null
          ref?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          user_id?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          paid_amount?: number | null
          paid_on?: string | null
          payer_bank?: string | null
          payer_name?: string | null
          plan_months?: number
          proof_path?: string | null
          ref?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email: string
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
        }
        Relationships: []
      }
      room_messages: {
        Row: {
          created_at: string
          id: string
          room_id: string
          sender_id: string
          sender_name: string
          source_lang: string
          text: string
        }
        Insert: {
          created_at?: string
          id?: string
          room_id: string
          sender_id: string
          sender_name: string
          source_lang: string
          text: string
        }
        Update: {
          created_at?: string
          id?: string
          room_id?: string
          sender_id?: string
          sender_name?: string
          source_lang?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_participants: {
        Row: {
          display_name: string
          id: string
          joined_at: string
          lang: string
          last_seen: string
          room_id: string
          user_id: string
        }
        Insert: {
          display_name: string
          id?: string
          joined_at?: string
          lang?: string
          last_seen?: string
          room_id: string
          user_id: string
        }
        Update: {
          display_name?: string
          id?: string
          joined_at?: string
          lang?: string
          last_seen?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_participants_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          code: string
          created_at: string
          host_id: string
          id: string
          name: string | null
        }
        Insert: {
          code: string
          created_at?: string
          host_id: string
          id?: string
          name?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          host_id?: string
          id?: string
          name?: string | null
        }
        Relationships: []
      }
      songs: {
        Row: {
          created_at: string
          id: string
          lyrics: string
          settings: Json
          storage_path: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lyrics: string
          settings?: Json
          storage_path: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lyrics?: string
          settings?: Json
          storage_path?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      studio_ai_access: {
        Row: {
          denial_message: string
          id: number
          updated_at: string
        }
        Insert: {
          denial_message: string
          id?: number
          updated_at?: string
        }
        Update: {
          denial_message?: string
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      studio_usage: {
        Row: {
          character_count: number
          created_at: string
          generation_kind: string
          id: string
          language: string
          tool: string
          user_id: string
        }
        Insert: {
          character_count: number
          created_at?: string
          generation_kind?: string
          id?: string
          language: string
          tool: string
          user_id: string
        }
        Update: {
          character_count?: number
          created_at?: string
          generation_kind?: string
          id?: string
          language?: string
          tool?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          plan: string
          pro_expires_at: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          suspended: boolean
          trial_ends_at: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          plan?: string
          pro_expires_at?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          suspended?: boolean
          trial_ends_at?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          plan?: string
          pro_expires_at?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          suspended?: boolean
          trial_ends_at?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      usage_daily: {
        Row: {
          day: string
          photos: number
          translations: number
          user_id: string
        }
        Insert: {
          day: string
          photos?: number
          translations?: number
          user_id: string
        }
        Update: {
          day?: string
          photos?: number
          translations?: number
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      videos: {
        Row: {
          created_at: string
          duration_seconds: number | null
          id: string
          language: string | null
          size_bytes: number
          storage_path: string
          title: string
          tool: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          language?: string | null
          size_bytes?: number
          storage_path: string
          title: string
          tool?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          language?: string | null
          size_bytes?: number
          storage_path?: string
          title?: string
          tool?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_stats: { Args: never; Returns: Json }
      attach_payment_proof: {
        Args: { _id: string; _path: string }
        Returns: undefined
      }
      consume_usage: { Args: { _kind: string }; Returns: Json }
      create_payment_request: {
        Args: { _months: number }
        Returns: {
          amount: number
          created_at: string
          id: string
          paid_amount: number | null
          paid_on: string | null
          payer_bank: string | null
          payer_name: string | null
          plan_months: number
          proof_path: string | null
          ref: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["payment_status"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "payment_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ensure_account: { Args: never; Returns: undefined }
      has_active_access: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_pro: { Args: { _user_id: string }; Returns: boolean }
      is_room_member: {
        Args: { _room_id: string; _user_id: string }
        Returns: boolean
      }
      list_direct_conversations: {
        Args: never
        Returns: {
          id: string
          last_message: string
          last_message_at: string
          other_display_name: string
          other_email: string
          other_user_id: string
        }[]
      }
      lookup_room_by_code: {
        Args: { _code: string }
        Returns: {
          code: string
          id: string
        }[]
      }
      review_payment: {
        Args: { _approve: boolean; _id: string }
        Returns: undefined
      }
      sast_today: { Args: never; Returns: string }
      send_direct_message: {
        Args: {
          _body: string
          _conversation_id: string
          _recipient_email: string
        }
        Returns: undefined
      }
      submit_payer_details: {
        Args: {
          _id: string
          _paid_amount: number
          _paid_on: string
          _payer_bank: string
          _payer_name: string
        }
        Returns: undefined
      }
      usage_status: { Args: never; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "user"
      payment_status: "pending" | "approved" | "rejected"
      subscription_status: "trial" | "active" | "inactive"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      payment_status: ["pending", "approved", "rejected"],
      subscription_status: ["trial", "active", "inactive"],
    },
  },
} as const
