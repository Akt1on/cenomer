export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      device_tokens: {
        Row: {
          id: string;
          user_id: string;
          token: string;
          platform: string;
          updated_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          token: string;
          platform?: string;
          updated_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          token?: string;
          platform?: string;
          updated_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          created_at: string;
          icon: string | null;
          id: string;
          name: string;
          slug: string;
          sort_order: number;
        };
        Insert: {
          created_at?: string;
          icon?: string | null;
          id?: string;
          name: string;
          slug: string;
          sort_order?: number;
        };
        Update: {
          created_at?: string;
          icon?: string | null;
          id?: string;
          name?: string;
          slug?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      favorites: {
        Row: {
          created_at: string;
          product_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          product_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          product_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "favorites_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      price_alerts: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          product_id: string;
          target_price: number | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          product_id: string;
          target_price?: number | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          product_id?: string;
          target_price?: number | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "price_alerts_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      price_history: {
        Row: {
          id: number;
          price: number;
          product_id: string;
          recorded_at: string;
          store_id: string;
        };
        Insert: {
          id?: number;
          price: number;
          product_id: string;
          recorded_at?: string;
          store_id: string;
        };
        Update: {
          id?: number;
          price?: number;
          product_id?: string;
          recorded_at?: string;
          store_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "price_history_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "price_history_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          best_price: number | null;
          brand: string | null;
          category_id: string | null;
          created_at: string;
          id: string;
          image_url: string | null;
          name: string;
          search_text: string | null;
          slug: string;
          updated_at: string;
          volume: string | null;
        };
        Insert: {
          best_price?: number | null;
          brand?: string | null;
          category_id?: string | null;
          created_at?: string;
          id?: string;
          image_url?: string | null;
          name: string;
          search_text?: string | null;
          slug: string;
          updated_at?: string;
          volume?: string | null;
        };
        Update: {
          best_price?: number | null;
          brand?: string | null;
          category_id?: string | null;
          created_at?: string;
          id?: string;
          image_url?: string | null;
          name?: string;
          search_text?: string | null;
          slug?: string;
          updated_at?: string;
          volume?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      referral_rewards: {
        Row: {
          id: string;
          referrer_id: string;
          referred_id: string;
          reward_type: string;
          granted_at: string;
          expires_at: string | null;
        };
        Insert: {
          id?: string;
          referrer_id: string;
          referred_id: string;
          reward_type?: string;
          granted_at?: string;
          expires_at?: string | null;
        };
        Update: {
          id?: string;
          referrer_id?: string;
          referred_id?: string;
          reward_type?: string;
          granted_at?: string;
          expires_at?: string | null;
        };
        Relationships: [];
      };
      referrals: {
        Row: {
          id: string;
          user_id: string;
          code: string;
          invited_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          code: string;
          invited_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          code?: string;
          invited_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          display_name: string | null;
          id: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          id: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          id?: string;
        };
        Relationships: [];
      };
      search_stats: {
        Row: {
          query: string;
          count: number;
          updated_at: string;
        };
        Insert: {
          query: string;
          count?: number;
          updated_at?: string;
        };
        Update: {
          query?: string;
          count?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      store_products: {
        Row: {
          fetched_at: string;
          id: string;
          in_stock: boolean;
          is_promo: boolean;
          old_price: number | null;
          price: number;
          product_id: string;
          store_id: string;
          store_product_url: string | null;
        };
        Insert: {
          fetched_at?: string;
          id?: string;
          in_stock?: boolean;
          is_promo?: boolean;
          old_price?: number | null;
          price: number;
          product_id: string;
          store_id: string;
          store_product_url?: string | null;
        };
        Update: {
          fetched_at?: string;
          id?: string;
          in_stock?: boolean;
          is_promo?: boolean;
          old_price?: number | null;
          price?: number;
          product_id?: string;
          store_id?: string;
          store_product_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "store_products_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "store_products_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          plan: string;
          source: string | null;
          starts_at: string;
          expires_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plan?: string;
          source?: string | null;
          starts_at?: string;
          expires_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          plan?: string;
          source?: string | null;
          starts_at?: string;
          expires_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      stores: {
        Row: {
          brand_color: string | null;
          created_at: string;
          id: string;
          logo_url: string | null;
          name: string;
          slug: string;
          website: string | null;
        };
        Insert: {
          brand_color?: string | null;
          created_at?: string;
          id?: string;
          logo_url?: string | null;
          name: string;
          slug: string;
          website?: string | null;
        };
        Update: {
          brand_color?: string | null;
          created_at?: string;
          id?: string;
          logo_url?: string | null;
          name?: string;
          slug?: string;
          website?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      activate_referral: { Args: { referral_code: string }; Returns: Json };
      get_product_best_price: { Args: { p_product_id: string }; Returns: number };
      get_store_rating: {
        Args: { days?: number };
        Returns: {
          store_id: string;
          category_id: string | null;
          avg_price: number;
          cnt: number;
        }[];
      };
      get_top_searches: {
        Args: { lim?: number };
        Returns: { query: string; count: number }[];
      };
      get_weekly_deals: {
        Args: { lim?: number };
        Returns: {
          id: string;
          slug: string;
          name: string;
          image_url: string | null;
          best_price: number;
          max_price: number | null;
        }[];
      };
      increment_search_stat: { Args: { search_query: string }; Returns: undefined };
      is_price_historical_min: {
        Args: { p_product_id: string; p_current_price: number; p_days?: number };
        Returns: boolean;
      };
      show_limit: { Args: never; Returns: number };
      show_trgm: { Args: { "": string }; Returns: string[] };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
