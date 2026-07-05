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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      announcement_reads: {
        Row: {
          announcement_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          body: string | null
          created_at: string
          expires_at: string | null
          id: string
          manufacturer_org_id: string
          published_at: string
          segment: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          manufacturer_org_id: string
          published_at?: string
          segment?: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          manufacturer_org_id?: string
          published_at?: string
          segment?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_manufacturer_org_id_fkey"
            columns: ["manufacturer_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      api_clients: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          org_id: string
          rate_limit_per_min: number
          scopes: string[]
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          org_id: string
          rate_limit_per_min?: number
          scopes?: string[]
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          org_id?: string
          rate_limit_per_min?: number
          scopes?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "api_clients_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      api_request_logs: {
        Row: {
          client_id: string | null
          created_at: string
          duration_ms: number | null
          error: string | null
          id: string
          org_id: string | null
          resource: string
          status: number
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          org_id?: string | null
          resource: string
          status: number
        }
        Update: {
          client_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          org_id?: string | null
          resource?: string
          status?: number
        }
        Relationships: [
          {
            foreignKeyName: "api_request_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "api_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_access: {
        Row: {
          catalog_id: string
          granted_at: string
          partner_org_id: string
        }
        Insert: {
          catalog_id: string
          granted_at?: string
          partner_org_id: string
        }
        Update: {
          catalog_id?: string
          granted_at?: string
          partner_org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_access_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "product_catalogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_access_partner_org_id_fkey"
            columns: ["partner_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_favorites: {
        Row: {
          created_at: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_products: {
        Row: {
          added_at: string
          catalog_id: string
          product_id: string
          sort_order: number
        }
        Insert: {
          added_at?: string
          catalog_id: string
          product_id: string
          sort_order?: number
        }
        Update: {
          added_at?: string
          catalog_id?: string
          product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "catalog_products_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "product_catalogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      certifications: {
        Row: {
          created_at: string
          criteria_met: Json | null
          expires_at: string | null
          id: string
          issued_at: string
          level: Database["public"]["Enums"]["tier_level"]
          manufacturer_org_id: string
          partner_org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          criteria_met?: Json | null
          expires_at?: string | null
          id?: string
          issued_at?: string
          level: Database["public"]["Enums"]["tier_level"]
          manufacturer_org_id: string
          partner_org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          criteria_met?: Json | null
          expires_at?: string | null
          id?: string
          issued_at?: string
          level?: Database["public"]["Enums"]["tier_level"]
          manufacturer_org_id?: string
          partner_org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "certifications_manufacturer_org_id_fkey"
            columns: ["manufacturer_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certifications_partner_org_id_fkey"
            columns: ["partner_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_adjudications: {
        Row: {
          computed_credit_cents: number
          computed_payout_pct: number
          created_at: string
          created_by: string
          decided_at: string | null
          decided_by: string | null
          decision: string
          decision_notes: string | null
          dot_date: string | null
          eligibility: Json
          eligible: boolean
          id: string
          months_in_service: number
          original_tread: number | null
          policy_id: string
          purchase_date: string | null
          record_id: string
          remaining_tread: number | null
          tire_price_cents: number
          unrepairable_confirmed: boolean
        }
        Insert: {
          computed_credit_cents: number
          computed_payout_pct: number
          created_at?: string
          created_by: string
          decided_at?: string | null
          decided_by?: string | null
          decision?: string
          decision_notes?: string | null
          dot_date?: string | null
          eligibility?: Json
          eligible: boolean
          id?: string
          months_in_service: number
          original_tread?: number | null
          policy_id: string
          purchase_date?: string | null
          record_id: string
          remaining_tread?: number | null
          tire_price_cents: number
          unrepairable_confirmed?: boolean
        }
        Update: {
          computed_credit_cents?: number
          computed_payout_pct?: number
          created_at?: string
          created_by?: string
          decided_at?: string | null
          decided_by?: string | null
          decision?: string
          decision_notes?: string | null
          dot_date?: string | null
          eligibility?: Json
          eligible?: boolean
          id?: string
          months_in_service?: number
          original_tread?: number | null
          policy_id?: string
          purchase_date?: string | null
          record_id?: string
          remaining_tread?: number | null
          tire_price_cents?: number
          unrepairable_confirmed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "claim_adjudications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_adjudications_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_adjudications_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "warranty_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_adjudications_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "records"
            referencedColumns: ["id"]
          },
        ]
      }
      competitor_prices: {
        Row: {
          competitor_name: string
          competitor_sku: string | null
          created_at: string
          id: string
          manufacturer_org_id: string
          observed_at: string
          price_cents: number
          product_id: string | null
          source_url: string | null
        }
        Insert: {
          competitor_name: string
          competitor_sku?: string | null
          created_at?: string
          id?: string
          manufacturer_org_id: string
          observed_at?: string
          price_cents?: number
          product_id?: string | null
          source_url?: string | null
        }
        Update: {
          competitor_name?: string
          competitor_sku?: string | null
          created_at?: string
          id?: string
          manufacturer_org_id?: string
          observed_at?: string
          price_cents?: number
          product_id?: string | null
          source_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competitor_prices_manufacturer_org_id_fkey"
            columns: ["manufacturer_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_memos: {
        Row: {
          adjudication_id: string | null
          amount_cents: number
          applied_at: string | null
          applied_order_id: string | null
          created_at: string
          created_by: string
          currency: string
          id: string
          issuer_org_id: string
          memo_number: string
          notes: string | null
          recipient_org_id: string
          record_id: string | null
          status: string
          updated_at: string
          void_reason: string | null
        }
        Insert: {
          adjudication_id?: string | null
          amount_cents: number
          applied_at?: string | null
          applied_order_id?: string | null
          created_at?: string
          created_by: string
          currency?: string
          id?: string
          issuer_org_id: string
          memo_number: string
          notes?: string | null
          recipient_org_id: string
          record_id?: string | null
          status?: string
          updated_at?: string
          void_reason?: string | null
        }
        Update: {
          adjudication_id?: string | null
          amount_cents?: number
          applied_at?: string | null
          applied_order_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          id?: string
          issuer_org_id?: string
          memo_number?: string
          notes?: string | null
          recipient_org_id?: string
          record_id?: string | null
          status?: string
          updated_at?: string
          void_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_memos_adjudication_id_fkey"
            columns: ["adjudication_id"]
            isOneToOne: true
            referencedRelation: "claim_adjudications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_memos_applied_order_id_fkey"
            columns: ["applied_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_memos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_memos_issuer_org_id_fkey"
            columns: ["issuer_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_memos_recipient_org_id_fkey"
            columns: ["recipient_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_memos_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "records"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_field_definitions: {
        Row: {
          created_at: string
          display_order: number
          entity_type: string
          field_key: string
          field_label: string
          field_type: string
          id: string
          is_required: boolean
          options: Json
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          entity_type: string
          field_key: string
          field_label: string
          field_type: string
          id?: string
          is_required?: boolean
          options?: Json
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          entity_type?: string
          field_key?: string
          field_label?: string
          field_type?: string
          id?: string
          is_required?: boolean
          options?: Json
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_definitions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_registrations: {
        Row: {
          created_at: string
          customer_contact: string | null
          customer_email: string | null
          customer_name: string
          est_value_cents: number | null
          expected_close_date: string | null
          expires_at: string | null
          id: string
          manufacturer_org_id: string
          notes: string | null
          partner_org_id: string
          products: Json | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["deal_status"]
          submitted_by: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_contact?: string | null
          customer_email?: string | null
          customer_name: string
          est_value_cents?: number | null
          expected_close_date?: string | null
          expires_at?: string | null
          id?: string
          manufacturer_org_id: string
          notes?: string | null
          partner_org_id: string
          products?: Json | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["deal_status"]
          submitted_by?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_contact?: string | null
          customer_email?: string | null
          customer_name?: string
          est_value_cents?: number | null
          expected_close_date?: string | null
          expires_at?: string | null
          id?: string
          manufacturer_org_id?: string
          notes?: string | null
          partner_org_id?: string
          products?: Json | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["deal_status"]
          submitted_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_registrations_manufacturer_org_id_fkey"
            columns: ["manufacturer_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_registrations_partner_org_id_fkey"
            columns: ["partner_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      dealer_inventory: {
        Row: {
          auto_service_ids: string[]
          barcode: string | null
          brand: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          location: string | null
          name: string
          notes: string | null
          org_id: string
          product_id: string | null
          qty_on_hand: number
          reorder_point: number
          retail_price: number | null
          size: string | null
          sku: string
          supplier_name: string | null
          supplier_org_id: string | null
          unit_cost: number | null
          updated_at: string
        }
        Insert: {
          auto_service_ids?: string[]
          barcode?: string | null
          brand?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          name: string
          notes?: string | null
          org_id: string
          product_id?: string | null
          qty_on_hand?: number
          reorder_point?: number
          retail_price?: number | null
          size?: string | null
          sku: string
          supplier_name?: string | null
          supplier_org_id?: string | null
          unit_cost?: number | null
          updated_at?: string
        }
        Update: {
          auto_service_ids?: string[]
          barcode?: string | null
          brand?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          name?: string
          notes?: string | null
          org_id?: string
          product_id?: string | null
          qty_on_hand?: number
          reorder_point?: number
          retail_price?: number | null
          size?: string | null
          sku?: string
          supplier_name?: string | null
          supplier_org_id?: string | null
          unit_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dealer_inventory_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dealer_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dealer_inventory_supplier_org_id_fkey"
            columns: ["supplier_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_routes: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string
          driver_name: string | null
          id: string
          notes: string | null
          org_id: string
          route_date: string
          route_number: string
          started_at: string | null
          status: string
          updated_at: string
          vehicle: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by: string
          driver_name?: string | null
          id?: string
          notes?: string | null
          org_id: string
          route_date: string
          route_number: string
          started_at?: string | null
          status?: string
          updated_at?: string
          vehicle?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string
          driver_name?: string | null
          id?: string
          notes?: string | null
          org_id?: string
          route_date?: string
          route_number?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          vehicle?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_routes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_stops: {
        Row: {
          address: string | null
          created_at: string
          customer_name: string
          delivered_at: string | null
          id: string
          order_id: string | null
          pod_notes: string | null
          route_id: string
          seq: number
          signature_path: string | null
          signed_by_name: string | null
          status: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          customer_name: string
          delivered_at?: string | null
          id?: string
          order_id?: string | null
          pod_notes?: string | null
          route_id: string
          seq?: number
          signature_path?: string | null
          signed_by_name?: string | null
          status?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          customer_name?: string
          delivered_at?: string | null
          id?: string
          order_id?: string | null
          pod_notes?: string | null
          route_id?: string
          seq?: number
          signature_path?: string | null
          signed_by_name?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_stops_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_stops_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "delivery_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      disposal_haulers: {
        Row: {
          created_at: string
          default_destination: string | null
          destination_permit: string | null
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          org_id: string
          permit: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_destination?: string | null
          destination_permit?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          org_id: string
          permit?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_destination?: string | null
          destination_permit?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          org_id?: string
          permit?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disposal_haulers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      disposal_manifests: {
        Row: {
          completed_at: string | null
          cost: number | null
          counts: Json
          created_at: string
          created_by: string
          destination_facility: string | null
          destination_permit: string | null
          document_name: string | null
          document_path: string | null
          hauler_name: string
          hauler_permit: string | null
          hauler_phone: string | null
          id: string
          manifest_number: string
          notes: string | null
          org_id: string
          pickup_date: string | null
          status: string
          total_tires: number
          updated_at: string
          weight_lbs: number | null
        }
        Insert: {
          completed_at?: string | null
          cost?: number | null
          counts?: Json
          created_at?: string
          created_by: string
          destination_facility?: string | null
          destination_permit?: string | null
          document_name?: string | null
          document_path?: string | null
          hauler_name: string
          hauler_permit?: string | null
          hauler_phone?: string | null
          id?: string
          manifest_number: string
          notes?: string | null
          org_id: string
          pickup_date?: string | null
          status?: string
          total_tires?: number
          updated_at?: string
          weight_lbs?: number | null
        }
        Update: {
          completed_at?: string | null
          cost?: number | null
          counts?: Json
          created_at?: string
          created_by?: string
          destination_facility?: string | null
          destination_permit?: string | null
          document_name?: string | null
          document_path?: string | null
          hauler_name?: string
          hauler_permit?: string | null
          hauler_phone?: string | null
          id?: string
          manifest_number?: string
          notes?: string | null
          org_id?: string
          pickup_date?: string | null
          status?: string
          total_tires?: number
          updated_at?: string
          weight_lbs?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "disposal_manifests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      edi_messages: {
        Row: {
          control_number: string | null
          created_at: string
          direction: string
          error: string | null
          id: string
          org_id: string
          partner_id: string | null
          processed_at: string | null
          raw: string
          related_order_id: string | null
          status: string
          transaction_set: string
        }
        Insert: {
          control_number?: string | null
          created_at?: string
          direction: string
          error?: string | null
          id?: string
          org_id: string
          partner_id?: string | null
          processed_at?: string | null
          raw: string
          related_order_id?: string | null
          status?: string
          transaction_set: string
        }
        Update: {
          control_number?: string | null
          created_at?: string
          direction?: string
          error?: string | null
          id?: string
          org_id?: string
          partner_id?: string | null
          processed_at?: string | null
          raw?: string
          related_order_id?: string | null
          status?: string
          transaction_set?: string
        }
        Relationships: [
          {
            foreignKeyName: "edi_messages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edi_messages_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "edi_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edi_messages_related_order_id_fkey"
            columns: ["related_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      edi_partners: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          isa_id: string
          isa_qualifier: string
          name: string
          notes: string | null
          org_id: string
          partner_org_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          isa_id: string
          isa_qualifier?: string
          name: string
          notes?: string | null
          org_id: string
          partner_org_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          isa_id?: string
          isa_qualifier?: string
          name?: string
          notes?: string | null
          org_id?: string
          partner_org_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "edi_partners_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edi_partners_partner_org_id_fkey"
            columns: ["partner_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_connections: {
        Row: {
          created_at: string
          last_sync_at: string | null
          last_sync_summary: string | null
          org_id: string
          provider: string
          sync_source: string | null
          token_hash: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          last_sync_at?: string | null
          last_sync_summary?: string | null
          org_id: string
          provider?: string
          sync_source?: string | null
          token_hash?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          last_sync_at?: string | null
          last_sync_summary?: string | null
          org_id?: string
          provider?: string
          sync_source?: string | null
          token_hash?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "erp_connections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      exemption_certificates: {
        Row: {
          cert_type: string
          created_at: string
          created_by: string
          effective_date: string
          expiration_date: string | null
          file_name: string | null
          file_path: string | null
          holder_org_id: string
          id: string
          issuer_org_id: string
          jurisdictions: string[]
          notes: string | null
          purchase_order_ref: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          single_purchase: boolean
          status: string
          superseded_by: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          cert_type?: string
          created_at?: string
          created_by: string
          effective_date?: string
          expiration_date?: string | null
          file_name?: string | null
          file_path?: string | null
          holder_org_id: string
          id?: string
          issuer_org_id: string
          jurisdictions?: string[]
          notes?: string | null
          purchase_order_ref?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          single_purchase?: boolean
          status?: string
          superseded_by?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          cert_type?: string
          created_at?: string
          created_by?: string
          effective_date?: string
          expiration_date?: string | null
          file_name?: string | null
          file_path?: string | null
          holder_org_id?: string
          id?: string
          issuer_org_id?: string
          jurisdictions?: string[]
          notes?: string | null
          purchase_order_ref?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          single_purchase?: boolean
          status?: string
          superseded_by?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exemption_certificates_holder_org_id_fkey"
            columns: ["holder_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exemption_certificates_issuer_org_id_fkey"
            columns: ["issuer_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exemption_certificates_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "exemption_certificates"
            referencedColumns: ["id"]
          },
        ]
      }
      field_defs: {
        Row: {
          created_at: string
          default_value: Json | null
          field_key: string
          field_type: string
          group_name: string | null
          help_text: string | null
          id: string
          is_active: boolean
          is_required: boolean
          label: string
          max_length: number | null
          max_value: number | null
          min_value: number | null
          object_type_id: string
          options: Json
          org_id: string | null
          placeholder: string | null
          sort_order: number
          updated_at: string
          validation_regex: string | null
        }
        Insert: {
          created_at?: string
          default_value?: Json | null
          field_key: string
          field_type: string
          group_name?: string | null
          help_text?: string | null
          id?: string
          is_active?: boolean
          is_required?: boolean
          label: string
          max_length?: number | null
          max_value?: number | null
          min_value?: number | null
          object_type_id: string
          options?: Json
          org_id?: string | null
          placeholder?: string | null
          sort_order?: number
          updated_at?: string
          validation_regex?: string | null
        }
        Update: {
          created_at?: string
          default_value?: Json | null
          field_key?: string
          field_type?: string
          group_name?: string | null
          help_text?: string | null
          id?: string
          is_active?: boolean
          is_required?: boolean
          label?: string
          max_length?: number | null
          max_value?: number | null
          min_value?: number | null
          object_type_id?: string
          options?: Json
          org_id?: string | null
          placeholder?: string | null
          sort_order?: number
          updated_at?: string
          validation_regex?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "field_defs_object_type_id_fkey"
            columns: ["object_type_id"]
            isOneToOne: false
            referencedRelation: "object_type_defs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_defs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      file_endpoints: {
        Row: {
          config: Json
          created_at: string
          created_by: string
          file_type: string
          id: string
          is_active: boolean
          kind: string
          last_error: string | null
          last_polled_at: string | null
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          created_by: string
          file_type?: string
          id?: string
          is_active?: boolean
          kind?: string
          last_error?: string | null
          last_polled_at?: string | null
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string
          file_type?: string
          id?: string
          is_active?: boolean
          kind?: string
          last_error?: string | null
          last_polled_at?: string | null
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "file_endpoints_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      fitment_tires: {
        Row: {
          attributes: Json
          brand: string
          created_at: string
          fitment_id: string
          id: string
          is_oem: boolean
          model: string | null
          notes: string | null
          sku: string | null
        }
        Insert: {
          attributes?: Json
          brand: string
          created_at?: string
          fitment_id: string
          id?: string
          is_oem?: boolean
          model?: string | null
          notes?: string | null
          sku?: string | null
        }
        Update: {
          attributes?: Json
          brand?: string
          created_at?: string
          fitment_id?: string
          id?: string
          is_oem?: boolean
          model?: string | null
          notes?: string | null
          sku?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fitment_tires_fitment_id_fkey"
            columns: ["fitment_id"]
            isOneToOne: false
            referencedRelation: "machine_fitments"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_providers: {
        Row: {
          capabilities: string[]
          category: string
          config_schema: Json
          created_at: string
          description: string | null
          docs_url: string | null
          id: string
          is_active: boolean
          key: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          capabilities?: string[]
          category?: string
          config_schema?: Json
          created_at?: string
          description?: string | null
          docs_url?: string | null
          id?: string
          is_active?: boolean
          key: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          capabilities?: string[]
          category?: string
          config_schema?: Json
          created_at?: string
          description?: string | null
          docs_url?: string | null
          id?: string
          is_active?: boolean
          key?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      integration_runs: {
        Row: {
          capability: string
          detail: string | null
          finished_at: string | null
          id: string
          org_id: string
          org_integration_id: string
          records_processed: number
          started_at: string
          status: string
        }
        Insert: {
          capability: string
          detail?: string | null
          finished_at?: string | null
          id?: string
          org_id: string
          org_integration_id: string
          records_processed?: number
          started_at?: string
          status?: string
        }
        Update: {
          capability?: string
          detail?: string | null
          finished_at?: string | null
          id?: string
          org_id?: string
          org_integration_id?: string
          records_processed?: number
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_runs_org_integration_id_fkey"
            columns: ["org_integration_id"]
            isOneToOne: false
            referencedRelation: "org_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_transactions: {
        Row: {
          created_at: string
          created_by: string
          delta: number
          id: string
          item_id: string
          org_id: string
          reason: string
          reference: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          delta: number
          id?: string
          item_id: string
          org_id: string
          reason: string
          reference?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          delta?: number
          id?: string
          item_id?: string
          org_id?: string
          reason?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transactions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "dealer_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          created_by: string
          customer_name: string
          customer_phone: string | null
          id: string
          invoice_number: string
          lines: Json
          notes: string | null
          org_id: string
          paid_at: string | null
          payment_method: string | null
          site_address: string | null
          status: string
          subtotal_cents: number
          tax_cents: number
          tax_rate_pct: number
          total_cents: number
          updated_at: string
          void_reason: string | null
          work_order_id: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          customer_name: string
          customer_phone?: string | null
          id?: string
          invoice_number: string
          lines?: Json
          notes?: string | null
          org_id: string
          paid_at?: string | null
          payment_method?: string | null
          site_address?: string | null
          status?: string
          subtotal_cents?: number
          tax_cents?: number
          tax_rate_pct?: number
          total_cents?: number
          updated_at?: string
          void_reason?: string | null
          work_order_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          customer_name?: string
          customer_phone?: string | null
          id?: string
          invoice_number?: string
          lines?: Json
          notes?: string | null
          org_id?: string
          paid_at?: string | null
          payment_method?: string | null
          site_address?: string | null
          status?: string
          subtotal_cents?: number
          tax_cents?: number
          tax_rate_pct?: number
          total_cents?: number
          updated_at?: string
          void_reason?: string | null
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: true
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          accepted_at: string | null
          assigned_at: string | null
          assigned_partner_org_id: string | null
          company: string | null
          contact_email: string | null
          contact_name: string
          contact_phone: string | null
          created_at: string
          est_value_cents: number | null
          id: string
          manufacturer_org_id: string
          notes: string | null
          region: string | null
          source: string | null
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          assigned_at?: string | null
          assigned_partner_org_id?: string | null
          company?: string | null
          contact_email?: string | null
          contact_name: string
          contact_phone?: string | null
          created_at?: string
          est_value_cents?: number | null
          id?: string
          manufacturer_org_id: string
          notes?: string | null
          region?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          assigned_at?: string | null
          assigned_partner_org_id?: string | null
          company?: string | null
          contact_email?: string | null
          contact_name?: string
          contact_phone?: string | null
          created_at?: string
          est_value_cents?: number | null
          id?: string
          manufacturer_org_id?: string
          notes?: string | null
          region?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_partner_org_id_fkey"
            columns: ["assigned_partner_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_manufacturer_org_id_fkey"
            columns: ["manufacturer_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_fitments: {
        Row: {
          aspect_ratio: number | null
          attributes: Json
          construction: string
          created_at: string
          id: string
          inflation_psi: number | null
          is_primary: boolean
          load_index: string | null
          machine_type_id: string
          notes: string | null
          ply_rating: string | null
          position: string
          qty_per_machine: number
          rim_diameter: number | null
          rim_width: string | null
          section_width: number | null
          speed_rating: string | null
          tire_size: string
          tread_code: string | null
        }
        Insert: {
          aspect_ratio?: number | null
          attributes?: Json
          construction?: string
          created_at?: string
          id?: string
          inflation_psi?: number | null
          is_primary?: boolean
          load_index?: string | null
          machine_type_id: string
          notes?: string | null
          ply_rating?: string | null
          position?: string
          qty_per_machine?: number
          rim_diameter?: number | null
          rim_width?: string | null
          section_width?: number | null
          speed_rating?: string | null
          tire_size: string
          tread_code?: string | null
        }
        Update: {
          aspect_ratio?: number | null
          attributes?: Json
          construction?: string
          created_at?: string
          id?: string
          inflation_psi?: number | null
          is_primary?: boolean
          load_index?: string | null
          machine_type_id?: string
          notes?: string | null
          ply_rating?: string | null
          position?: string
          qty_per_machine?: number
          rim_diameter?: number | null
          rim_width?: string | null
          section_width?: number | null
          speed_rating?: string | null
          tire_size?: string
          tread_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machine_fitments_machine_type_id_fkey"
            columns: ["machine_type_id"]
            isOneToOne: false
            referencedRelation: "machine_types"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_types: {
        Row: {
          category: string
          created_at: string
          id: string
          is_active: boolean
          make: string
          model: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          make: string
          model: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          make?: string
          model?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      map_violations: {
        Row: {
          created_at: string
          id: string
          manufacturer_org_id: string
          notes: string | null
          observed_price_cents: number
          product_id: string | null
          reporter_partner_org_id: string | null
          status: Database["public"]["Enums"]["map_status"]
          updated_at: string
          url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          manufacturer_org_id: string
          notes?: string | null
          observed_price_cents?: number
          product_id?: string | null
          reporter_partner_org_id?: string | null
          status?: Database["public"]["Enums"]["map_status"]
          updated_at?: string
          url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          manufacturer_org_id?: string
          notes?: string | null
          observed_price_cents?: number
          product_id?: string | null
          reporter_partner_org_id?: string | null
          status?: Database["public"]["Enums"]["map_status"]
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "map_violations_manufacturer_org_id_fkey"
            columns: ["manufacturer_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "map_violations_reporter_partner_org_id_fkey"
            columns: ["reporter_partner_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      mdf_budgets: {
        Row: {
          created_at: string
          id: string
          manufacturer_org_id: string
          partner_org_id: string
          period: string
          total_budget_cents: number
          updated_at: string
          used_cents: number
        }
        Insert: {
          created_at?: string
          id?: string
          manufacturer_org_id: string
          partner_org_id: string
          period: string
          total_budget_cents?: number
          updated_at?: string
          used_cents?: number
        }
        Update: {
          created_at?: string
          id?: string
          manufacturer_org_id?: string
          partner_org_id?: string
          period?: string
          total_budget_cents?: number
          updated_at?: string
          used_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "mdf_budgets_manufacturer_org_id_fkey"
            columns: ["manufacturer_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mdf_budgets_partner_org_id_fkey"
            columns: ["partner_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      mdf_requests: {
        Row: {
          activity_type: string | null
          amount_approved_cents: number | null
          amount_requested_cents: number
          campaign_name: string
          claim_proof_url: string | null
          created_at: string
          id: string
          manufacturer_org_id: string
          notes: string | null
          partner_org_id: string
          planned_date: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["mdf_status"]
          submitted_by: string | null
          updated_at: string
        }
        Insert: {
          activity_type?: string | null
          amount_approved_cents?: number | null
          amount_requested_cents?: number
          campaign_name: string
          claim_proof_url?: string | null
          created_at?: string
          id?: string
          manufacturer_org_id: string
          notes?: string | null
          partner_org_id: string
          planned_date?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["mdf_status"]
          submitted_by?: string | null
          updated_at?: string
        }
        Update: {
          activity_type?: string | null
          amount_approved_cents?: number | null
          amount_requested_cents?: number
          campaign_name?: string
          claim_proof_url?: string | null
          created_at?: string
          id?: string
          manufacturer_org_id?: string
          notes?: string | null
          partner_org_id?: string
          planned_date?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["mdf_status"]
          submitted_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mdf_requests_manufacturer_org_id_fkey"
            columns: ["manufacturer_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mdf_requests_partner_org_id_fkey"
            columns: ["partner_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_group_members: {
        Row: {
          group_id: string
          user_id: string
        }
        Insert: {
          group_id: string
          user_id: string
        }
        Update: {
          group_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "notification_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          org_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          org_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_groups_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_rule_recipients: {
        Row: {
          group_id: string | null
          id: string
          org_role: string | null
          org_role_id: string | null
          recipient_type: string
          rule_id: string
          user_id: string | null
        }
        Insert: {
          group_id?: string | null
          id?: string
          org_role?: string | null
          org_role_id?: string | null
          recipient_type: string
          rule_id: string
          user_id?: string | null
        }
        Update: {
          group_id?: string | null
          id?: string
          org_role?: string | null
          org_role_id?: string | null
          recipient_type?: string
          rule_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_rule_recipients_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "notification_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_rule_recipients_org_role_id_fkey"
            columns: ["org_role_id"]
            isOneToOne: false
            referencedRelation: "org_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_rule_recipients_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "notification_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_rules: {
        Row: {
          condition_filter: Json
          created_at: string
          description: string | null
          entity_type: string
          id: string
          is_active: boolean
          name: string
          org_id: string
          trigger_event: string
          updated_at: string
        }
        Insert: {
          condition_filter?: Json
          created_at?: string
          description?: string | null
          entity_type: string
          id?: string
          is_active?: boolean
          name: string
          org_id: string
          trigger_event: string
          updated_at?: string
        }
        Update: {
          condition_filter?: Json
          created_at?: string
          description?: string | null
          entity_type?: string
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          trigger_event?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          is_read: boolean
          rule_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          is_read?: boolean
          rule_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          is_read?: boolean
          rule_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "notification_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      object_type_defs: {
        Row: {
          api_name: string
          color: string
          created_at: string
          description: string | null
          has_receiving_org: boolean
          icon: string
          id: string
          is_active: boolean
          label: string
          label_plural: string
          number_prefix: string
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          api_name: string
          color?: string
          created_at?: string
          description?: string | null
          has_receiving_org?: boolean
          icon?: string
          id?: string
          is_active?: boolean
          label: string
          label_plural: string
          number_prefix?: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          api_name?: string
          color?: string
          created_at?: string
          description?: string | null
          has_receiving_org?: boolean
          icon?: string
          id?: string
          is_active?: boolean
          label?: string
          label_plural?: string
          number_prefix?: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      object_type_seqs: {
        Row: {
          current_value: number
          object_type_id: string
          year_month: string
        }
        Insert: {
          current_value?: number
          object_type_id: string
          year_month: string
        }
        Update: {
          current_value?: number
          object_type_id?: string
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "object_type_seqs_object_type_id_fkey"
            columns: ["object_type_id"]
            isOneToOne: false
            referencedRelation: "object_type_defs"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_progress: {
        Row: {
          completed_at: string
          completed_by: string
          id: string
          partner_org_id: string
          step_id: string
        }
        Insert: {
          completed_at?: string
          completed_by: string
          id?: string
          partner_org_id: string
          step_id: string
        }
        Update: {
          completed_at?: string
          completed_by?: string
          id?: string
          partner_org_id?: string
          step_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_progress_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_progress_partner_org_id_fkey"
            columns: ["partner_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_progress_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "onboarding_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_steps: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_required: boolean
          manufacturer_org_id: string
          resource_url: string | null
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_required?: boolean
          manufacturer_org_id: string
          resource_url?: string | null
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_required?: boolean
          manufacturer_org_id?: string
          resource_url?: string | null
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_steps_manufacturer_org_id_fkey"
            columns: ["manufacturer_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      order_invoices: {
        Row: {
          buyer_org_id: string
          created_at: string
          created_by: string
          currency: string
          due_date: string | null
          exemption_certificate_id: string | null
          id: string
          invoice_number: string
          issue_date: string
          notes: string | null
          order_id: string
          paid_at: string | null
          payment_ref: string | null
          payment_terms: string | null
          seller_org_id: string
          status: string
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          subtotal: number
          tax_amount: number
          tax_exempt: boolean
          tax_rate: number
          total: number
          updated_at: string
          void_reason: string | null
        }
        Insert: {
          buyer_org_id: string
          created_at?: string
          created_by: string
          currency?: string
          due_date?: string | null
          exemption_certificate_id?: string | null
          id?: string
          invoice_number: string
          issue_date?: string
          notes?: string | null
          order_id: string
          paid_at?: string | null
          payment_ref?: string | null
          payment_terms?: string | null
          seller_org_id: string
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          subtotal: number
          tax_amount?: number
          tax_exempt?: boolean
          tax_rate?: number
          total: number
          updated_at?: string
          void_reason?: string | null
        }
        Update: {
          buyer_org_id?: string
          created_at?: string
          created_by?: string
          currency?: string
          due_date?: string | null
          exemption_certificate_id?: string | null
          id?: string
          invoice_number?: string
          issue_date?: string
          notes?: string | null
          order_id?: string
          paid_at?: string | null
          payment_ref?: string | null
          payment_terms?: string | null
          seller_org_id?: string
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          subtotal?: number
          tax_amount?: number
          tax_exempt?: boolean
          tax_rate?: number
          total?: number
          updated_at?: string
          void_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_invoices_buyer_org_id_fkey"
            columns: ["buyer_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_invoices_exemption_certificate_id_fkey"
            columns: ["exemption_certificate_id"]
            isOneToOne: false
            referencedRelation: "exemption_certificates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_invoices_seller_org_id_fkey"
            columns: ["seller_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_integrations: {
        Row: {
          config: Json
          created_at: string
          created_by: string
          enabled_capabilities: string[]
          id: string
          last_error: string | null
          last_run_at: string | null
          org_id: string
          provider_id: string
          status: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          created_by: string
          enabled_capabilities?: string[]
          id?: string
          last_error?: string | null
          last_run_at?: string | null
          org_id: string
          provider_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string
          enabled_capabilities?: string[]
          id?: string
          last_error?: string | null
          last_run_at?: string | null
          org_id?: string
          provider_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_integrations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_integrations_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "integration_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      org_locations: {
        Row: {
          city: string | null
          contact_name: string | null
          country: string | null
          created_at: string
          id: string
          is_active: boolean
          is_default_billing: boolean
          is_default_shipping: boolean
          kind: string
          line1: string | null
          line2: string | null
          name: string
          notes: string | null
          org_id: string
          phone: string | null
          postal: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_default_billing?: boolean
          is_default_shipping?: boolean
          kind?: string
          line1?: string | null
          line2?: string | null
          name: string
          notes?: string | null
          org_id: string
          phone?: string | null
          postal?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_default_billing?: boolean
          is_default_shipping?: boolean
          kind?: string
          line1?: string | null
          line2?: string | null
          name?: string
          notes?: string | null
          org_id?: string
          phone?: string | null
          postal?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_locations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_roles: {
        Row: {
          color: string
          created_at: string
          description: string | null
          id: string
          name: string
          org_id: string
          permissions: Json
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          org_id: string
          permissions?: Json
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          org_id?: string
          permissions?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_roles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_relationships: {
        Row: {
          child_org_id: string
          created_at: string
          custom_fields: Json
          delivery_notes: string | null
          discount_label: string | null
          effective_end_date: string | null
          effective_start_date: string
          id: string
          parent_org_id: string
          payment_terms: string | null
          preferred: boolean
          relationship_type: Database["public"]["Enums"]["relationship_type"]
          rep_email: string | null
          rep_name: string | null
          rep_phone: string | null
          status: Database["public"]["Enums"]["relationship_status"]
          updated_at: string
        }
        Insert: {
          child_org_id: string
          created_at?: string
          custom_fields?: Json
          delivery_notes?: string | null
          discount_label?: string | null
          effective_end_date?: string | null
          effective_start_date?: string
          id?: string
          parent_org_id: string
          payment_terms?: string | null
          preferred?: boolean
          relationship_type: Database["public"]["Enums"]["relationship_type"]
          rep_email?: string | null
          rep_name?: string | null
          rep_phone?: string | null
          status?: Database["public"]["Enums"]["relationship_status"]
          updated_at?: string
        }
        Update: {
          child_org_id?: string
          created_at?: string
          custom_fields?: Json
          delivery_notes?: string | null
          discount_label?: string | null
          effective_end_date?: string | null
          effective_start_date?: string
          id?: string
          parent_org_id?: string
          payment_terms?: string | null
          preferred?: boolean
          relationship_type?: Database["public"]["Enums"]["relationship_type"]
          rep_email?: string | null
          rep_name?: string | null
          rep_phone?: string | null
          status?: Database["public"]["Enums"]["relationship_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_relationships_child_org_id_fkey"
            columns: ["child_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_relationships_parent_org_id_fkey"
            columns: ["parent_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: Json
          annual_revenue_range: string | null
          billing_address: Json | null
          brand_color: string | null
          brands: string[]
          business_type: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          custom_fields: Json
          dba_name: string | null
          employee_count: number | null
          id: string
          industry: string | null
          is_listed_supplier: boolean
          legal_name: string | null
          logo_path: string | null
          name: string
          notes: string | null
          payments_enabled: boolean
          portal_name: string | null
          registration_number: string | null
          settings: Json
          status: Database["public"]["Enums"]["org_status"]
          storefront_catalog_id: string | null
          storefront_slug: string | null
          stripe_account_id: string | null
          supplier_blurb: string | null
          tax_id: string | null
          type: Database["public"]["Enums"]["org_type"]
          updated_at: string
          website: string | null
          year_established: number | null
        }
        Insert: {
          address?: Json
          annual_revenue_range?: string | null
          billing_address?: Json | null
          brand_color?: string | null
          brands?: string[]
          business_type?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          custom_fields?: Json
          dba_name?: string | null
          employee_count?: number | null
          id?: string
          industry?: string | null
          is_listed_supplier?: boolean
          legal_name?: string | null
          logo_path?: string | null
          name: string
          notes?: string | null
          payments_enabled?: boolean
          portal_name?: string | null
          registration_number?: string | null
          settings?: Json
          status?: Database["public"]["Enums"]["org_status"]
          storefront_catalog_id?: string | null
          storefront_slug?: string | null
          stripe_account_id?: string | null
          supplier_blurb?: string | null
          tax_id?: string | null
          type: Database["public"]["Enums"]["org_type"]
          updated_at?: string
          website?: string | null
          year_established?: number | null
        }
        Update: {
          address?: Json
          annual_revenue_range?: string | null
          billing_address?: Json | null
          brand_color?: string | null
          brands?: string[]
          business_type?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          custom_fields?: Json
          dba_name?: string | null
          employee_count?: number | null
          id?: string
          industry?: string | null
          is_listed_supplier?: boolean
          legal_name?: string | null
          logo_path?: string | null
          name?: string
          notes?: string | null
          payments_enabled?: boolean
          portal_name?: string | null
          registration_number?: string | null
          settings?: Json
          status?: Database["public"]["Enums"]["org_status"]
          storefront_catalog_id?: string | null
          storefront_slug?: string | null
          stripe_account_id?: string | null
          supplier_blurb?: string | null
          tax_id?: string | null
          type?: Database["public"]["Enums"]["org_type"]
          updated_at?: string
          website?: string | null
          year_established?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_storefront_catalog_id_fkey"
            columns: ["storefront_catalog_id"]
            isOneToOne: false
            referencedRelation: "product_catalogs"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_applications: {
        Row: {
          applicant_email: string
          applicant_first_name: string | null
          applicant_last_name: string | null
          applicant_phone: string | null
          applicant_user_id: string | null
          business_info: Json
          created_at: string
          created_org_id: string | null
          id: string
          proposed_org_name: string
          proposed_org_type: Database["public"]["Enums"]["org_type"]
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["application_status"]
          target_parent_org_id: string
          updated_at: string
        }
        Insert: {
          applicant_email: string
          applicant_first_name?: string | null
          applicant_last_name?: string | null
          applicant_phone?: string | null
          applicant_user_id?: string | null
          business_info?: Json
          created_at?: string
          created_org_id?: string | null
          id?: string
          proposed_org_name: string
          proposed_org_type: Database["public"]["Enums"]["org_type"]
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          target_parent_org_id: string
          updated_at?: string
        }
        Update: {
          applicant_email?: string
          applicant_first_name?: string | null
          applicant_last_name?: string | null
          applicant_phone?: string | null
          applicant_user_id?: string | null
          business_info?: Json
          created_at?: string
          created_org_id?: string | null
          id?: string
          proposed_org_name?: string
          proposed_org_type?: Database["public"]["Enums"]["org_type"]
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          target_parent_org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_applications_created_org_id_fkey"
            columns: ["created_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_applications_target_parent_org_id_fkey"
            columns: ["target_parent_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_tiers: {
        Row: {
          created_at: string
          id: string
          manufacturer_org_id: string
          partner_org_id: string
          tier_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          manufacturer_org_id: string
          partner_org_id: string
          tier_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          manufacturer_org_id?: string
          partner_org_id?: string
          tier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_tiers_manufacturer_org_id_fkey"
            columns: ["manufacturer_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_tiers_partner_org_id_fkey"
            columns: ["partner_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_tiers_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "pricing_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_defs: {
        Row: {
          action: string
          allowed: boolean
          created_at: string
          id: string
          object_type_id: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          action: string
          allowed?: boolean
          created_at?: string
          id?: string
          object_type_id: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          action?: string
          allowed?: boolean
          created_at?: string
          id?: string
          object_type_id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "permission_defs_object_type_id_fkey"
            columns: ["object_type_id"]
            isOneToOne: false
            referencedRelation: "object_type_defs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permission_defs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admin_audit: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          id: string
          payload: Json
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          id?: string
          payload?: Json
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          id?: string
          payload?: Json
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          created_at: string
          granted_at: string
          granted_by: string | null
          level: Database["public"]["Enums"]["platform_admin_level"]
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_at?: string
          granted_by?: string | null
          level?: Database["public"]["Enums"]["platform_admin_level"]
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted_at?: string
          granted_by?: string | null
          level?: Database["public"]["Enums"]["platform_admin_level"]
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pos_customers: {
        Row: {
          created_at: string
          customer_type: string
          email: string | null
          id: string
          name: string
          notes: string | null
          org_id: string
          phone: string | null
          tax_exempt: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_type?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          org_id: string
          phone?: string | null
          tax_exempt?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_type?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          org_id?: string
          phone?: string | null
          tax_exempt?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_customers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_sale_lines: {
        Row: {
          description: string
          id: string
          inventory_item_id: string | null
          kind: string
          quantity: number
          sale_id: string
          sku: string | null
          sort_order: number
          taxable: boolean
          unit_price: number
        }
        Insert: {
          description: string
          id?: string
          inventory_item_id?: string | null
          kind?: string
          quantity?: number
          sale_id: string
          sku?: string | null
          sort_order?: number
          taxable?: boolean
          unit_price?: number
        }
        Update: {
          description?: string
          id?: string
          inventory_item_id?: string | null
          kind?: string
          quantity?: number
          sale_id?: string
          sku?: string | null
          sort_order?: number
          taxable?: boolean
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "pos_sale_lines_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "dealer_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_sale_lines_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "pos_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_sales: {
        Row: {
          amount_tendered: number | null
          change_due: number | null
          completed_at: string | null
          created_at: string
          created_by: string
          customer_id: string | null
          id: string
          location_id: string | null
          notes: string | null
          org_id: string
          payment_method: string | null
          payment_ref: string | null
          status: string
          subtotal: number
          tax_amount: number
          tax_rate: number
          ticket_number: string
          total: number
          updated_at: string
          vehicle_id: string | null
          voided_at: string | null
        }
        Insert: {
          amount_tendered?: number | null
          change_due?: number | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          customer_id?: string | null
          id?: string
          location_id?: string | null
          notes?: string | null
          org_id: string
          payment_method?: string | null
          payment_ref?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          ticket_number: string
          total?: number
          updated_at?: string
          vehicle_id?: string | null
          voided_at?: string | null
        }
        Update: {
          amount_tendered?: number | null
          change_due?: number | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          customer_id?: string | null
          id?: string
          location_id?: string | null
          notes?: string | null
          org_id?: string
          payment_method?: string | null
          payment_ref?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          ticket_number?: string
          total?: number
          updated_at?: string
          vehicle_id?: string | null
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "pos_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_sales_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "org_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_sales_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_sales_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "pos_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_services: {
        Row: {
          auto_add: boolean
          compliance_kind: string | null
          created_at: string
          id: string
          is_active: boolean
          kind: string
          name: string
          org_id: string
          per_tire: boolean
          sku: string | null
          sort_order: number
          taxable: boolean
          unit_price: number
          updated_at: string
        }
        Insert: {
          auto_add?: boolean
          compliance_kind?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          name: string
          org_id: string
          per_tire?: boolean
          sku?: string | null
          sort_order?: number
          taxable?: boolean
          unit_price?: number
          updated_at?: string
        }
        Update: {
          auto_add?: boolean
          compliance_kind?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          name?: string
          org_id?: string
          per_tire?: boolean
          sku?: string | null
          sort_order?: number
          taxable?: boolean
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_services_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_vehicles: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          inflation_psi: number | null
          lug_torque_ft_lbs: number | null
          make: string | null
          mileage: number | null
          model: string | null
          notes: string | null
          org_id: string
          plate: string | null
          tire_size: string | null
          vin: string | null
          year: number | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          inflation_psi?: number | null
          lug_torque_ft_lbs?: number | null
          make?: string | null
          mileage?: number | null
          model?: string | null
          notes?: string | null
          org_id: string
          plate?: string | null
          tire_size?: string | null
          vin?: string | null
          year?: number | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          inflation_psi?: number | null
          lug_torque_ft_lbs?: number | null
          make?: string | null
          mileage?: number | null
          model?: string | null
          notes?: string | null
          org_id?: string
          plate?: string | null
          tire_size?: string | null
          vin?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_vehicles_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "pos_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_vehicles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      price_list_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string
          assignment_type: string
          customer_org_id: string | null
          group_name: string | null
          id: string
          price_list_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          assignment_type: string
          customer_org_id?: string | null
          group_name?: string | null
          id?: string
          price_list_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          assignment_type?: string
          customer_org_id?: string | null
          group_name?: string | null
          id?: string
          price_list_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_list_assignments_customer_org_id_fkey"
            columns: ["customer_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_list_assignments_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      price_list_audit_logs: {
        Row: {
          action: string
          created_at: string
          detail: Json
          id: string
          price_list_id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          detail?: Json
          id?: string
          price_list_id: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          detail?: Json
          id?: string
          price_list_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_list_audit_logs_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      price_list_import_jobs: {
        Row: {
          created_at: string
          created_by: string
          error_log: Json
          failed_rows: number
          file_name: string | null
          id: string
          price_list_id: string
          status: string
          successful_rows: number
          total_rows: number
        }
        Insert: {
          created_at?: string
          created_by: string
          error_log?: Json
          failed_rows?: number
          file_name?: string | null
          id?: string
          price_list_id: string
          status?: string
          successful_rows?: number
          total_rows?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          error_log?: Json
          failed_rows?: number
          file_name?: string | null
          id?: string
          price_list_id?: string
          status?: string
          successful_rows?: number
          total_rows?: number
        }
        Relationships: [
          {
            foreignKeyName: "price_list_import_jobs_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      price_list_items: {
        Row: {
          created_at: string
          discount_percent: number | null
          effective_end_date: string | null
          effective_start_date: string | null
          id: string
          max_quantity: number | null
          min_quantity: number
          price: number
          price_list_id: string
          product_id: string
          sku: string
          unit_of_measure: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          discount_percent?: number | null
          effective_end_date?: string | null
          effective_start_date?: string | null
          id?: string
          max_quantity?: number | null
          min_quantity?: number
          price: number
          price_list_id: string
          product_id: string
          sku: string
          unit_of_measure?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          discount_percent?: number | null
          effective_end_date?: string | null
          effective_start_date?: string | null
          id?: string
          max_quantity?: number | null
          min_quantity?: number
          price?: number
          price_list_id?: string
          product_id?: string
          sku?: string
          unit_of_measure?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_list_items_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_list_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      price_lists: {
        Row: {
          created_at: string
          created_by: string
          currency: string
          description: string | null
          effective_end_date: string | null
          effective_start_date: string | null
          id: string
          is_default: boolean
          name: string
          org_id: string
          priority: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          currency?: string
          description?: string | null
          effective_end_date?: string | null
          effective_start_date?: string | null
          id?: string
          is_default?: boolean
          name: string
          org_id: string
          priority?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          currency?: string
          description?: string | null
          effective_end_date?: string | null
          effective_start_date?: string | null
          id?: string
          is_default?: boolean
          name?: string
          org_id?: string
          priority?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_lists_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_tiers: {
        Row: {
          created_at: string
          discount_pct: number
          id: string
          level: Database["public"]["Enums"]["tier_level"] | null
          manufacturer_org_id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          discount_pct?: number
          id?: string
          level?: Database["public"]["Enums"]["tier_level"] | null
          manufacturer_org_id: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          discount_pct?: number
          id?: string
          level?: Database["public"]["Enums"]["tier_level"] | null
          manufacturer_org_id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_tiers_manufacturer_org_id_fkey"
            columns: ["manufacturer_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      prm_activities: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          payload: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          payload?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          payload?: Json
        }
        Relationships: []
      }
      product_catalogs: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          org_id: string
          root_category_id: string | null
          status: string
          updated_at: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          org_id: string
          root_category_id?: string | null
          status?: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          org_id?: string
          root_category_id?: string | null
          status?: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_catalogs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_catalogs_root_category_id_fkey"
            columns: ["root_category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          org_id: string
          parent_id: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          org_id: string
          parent_id?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          org_id?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      product_field_defs: {
        Row: {
          created_at: string
          field_key: string
          field_type: string
          group_name: string | null
          help_text: string | null
          id: string
          is_active: boolean
          is_comparable: boolean
          is_filterable: boolean
          is_required: boolean
          label: string
          options: Json | null
          placeholder: string | null
          product_type_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          field_key: string
          field_type: string
          group_name?: string | null
          help_text?: string | null
          id?: string
          is_active?: boolean
          is_comparable?: boolean
          is_filterable?: boolean
          is_required?: boolean
          label: string
          options?: Json | null
          placeholder?: string | null
          product_type_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          field_key?: string
          field_type?: string
          group_name?: string | null
          help_text?: string | null
          id?: string
          is_active?: boolean
          is_comparable?: boolean
          is_filterable?: boolean
          is_required?: boolean
          label?: string
          options?: Json | null
          placeholder?: string | null
          product_type_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_field_defs_product_type_id_fkey"
            columns: ["product_type_id"]
            isOneToOne: false
            referencedRelation: "product_types"
            referencedColumns: ["id"]
          },
        ]
      }
      product_media: {
        Row: {
          alt_text: string | null
          created_at: string
          id: string
          is_primary: boolean
          media_type: string
          product_id: string
          sort_order: number
          url: string
          variant_id: string | null
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          media_type?: string
          product_id: string
          sort_order?: number
          url: string
          variant_id?: string | null
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          media_type?: string
          product_id?: string
          sort_order?: number
          url?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_media_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_media_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_prices: {
        Row: {
          created_at: string
          currency: string
          effective_from: string | null
          effective_to: string | null
          id: string
          is_active: boolean
          min_quantity: number
          notes: string | null
          org_id: string | null
          price_type: string
          product_id: string
          unit_price: number
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          is_active?: boolean
          min_quantity?: number
          notes?: string | null
          org_id?: string | null
          price_type?: string
          product_id: string
          unit_price: number
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          is_active?: boolean
          min_quantity?: number
          notes?: string | null
          org_id?: string | null
          price_type?: string
          product_id?: string
          unit_price?: number
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_prices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_prices_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_types: {
        Row: {
          color: string
          created_at: string
          description: string | null
          icon: string
          id: string
          is_active: boolean
          name: string
          org_id: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          is_active?: boolean
          name: string
          org_id: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_types_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variant_axes: {
        Row: {
          allowed_values: Json
          created_at: string
          id: string
          is_required: boolean
          name: string
          product_type_id: string
          slug: string
          sort_order: number
        }
        Insert: {
          allowed_values?: Json
          created_at?: string
          id?: string
          is_required?: boolean
          name: string
          product_type_id: string
          slug: string
          sort_order?: number
        }
        Update: {
          allowed_values?: Json
          created_at?: string
          id?: string
          is_required?: boolean
          name?: string
          product_type_id?: string
          slug?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_variant_axes_product_type_id_fkey"
            columns: ["product_type_id"]
            isOneToOne: false
            referencedRelation: "product_types"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          axes: Json
          created_at: string
          id: string
          is_active: boolean
          name: string | null
          product_id: string
          sku: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          axes?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string | null
          product_id: string
          sku: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          axes?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string | null
          product_id?: string
          sku?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          bin_location: string | null
          category_id: string | null
          created_at: string
          description: string | null
          field_values: Json
          id: string
          lead_time_days: number | null
          name: string
          org_id: string
          product_type_id: string
          short_description: string | null
          sku: string
          sort_order: number
          status: string
          stock_qty: number | null
          stock_status: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          bin_location?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          field_values?: Json
          id?: string
          lead_time_days?: number | null
          name: string
          org_id: string
          product_type_id: string
          short_description?: string | null
          sku: string
          sort_order?: number
          status?: string
          stock_qty?: number | null
          stock_status?: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          bin_location?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          field_values?: Json
          id?: string
          lead_time_days?: number | null
          name?: string
          org_id?: string
          product_type_id?: string
          short_description?: string | null
          sku?: string
          sort_order?: number
          status?: string
          stock_qty?: number | null
          stock_status?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_product_type_id_fkey"
            columns: ["product_type_id"]
            isOneToOne: false
            referencedRelation: "product_types"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          phone?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      promotion_saves: {
        Row: {
          created_at: string
          promotion_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          promotion_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          promotion_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotion_saves_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_saves_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          brand: string | null
          created_at: string
          created_by: string | null
          cta_label: string
          cta_url: string | null
          ends_at: string | null
          featured: boolean
          headline: string
          id: string
          image_url: string | null
          is_active: boolean
          kind: string
          org_id: string
          reward_label: string | null
          starts_at: string
          subhead: string | null
          terms: Json
          updated_at: string
        }
        Insert: {
          brand?: string | null
          created_at?: string
          created_by?: string | null
          cta_label?: string
          cta_url?: string | null
          ends_at?: string | null
          featured?: boolean
          headline: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          kind: string
          org_id: string
          reward_label?: string | null
          starts_at?: string
          subhead?: string | null
          terms?: Json
          updated_at?: string
        }
        Update: {
          brand?: string | null
          created_at?: string
          created_by?: string | null
          cta_label?: string
          cta_url?: string | null
          ends_at?: string | null
          featured?: boolean
          headline?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          kind?: string
          org_id?: string
          reward_label?: string | null
          starts_at?: string
          subhead?: string | null
          terms?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_events: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          kind: string
          message: string
          order_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          message: string
          order_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          message?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_lines: {
        Row: {
          id: string
          name: string
          notes: string | null
          order_id: string
          picked_qty: number
          product_id: string
          quantity: number
          sku: string
          sort_order: number
          total_price: number | null
          unit_price: number
          variant_id: string | null
        }
        Insert: {
          id?: string
          name: string
          notes?: string | null
          order_id: string
          picked_qty?: number
          product_id: string
          quantity: number
          sku: string
          sort_order?: number
          total_price?: number | null
          unit_price: number
          variant_id?: string | null
        }
        Update: {
          id?: string
          name?: string
          notes?: string | null
          order_id?: string
          picked_qty?: number
          product_id?: string
          quantity?: number
          sku?: string
          sort_order?: number
          total_price?: number | null
          unit_price?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          bill_to_location_id: string | null
          buyer_org_id: string
          carrier: string | null
          catalog_id: string | null
          confirmed_at: string | null
          created_at: string
          created_by: string | null
          currency: string
          delivered_at: string | null
          eta_date: string | null
          eta_note: string | null
          exemption_certificate_id: string | null
          id: string
          issue_note: string | null
          notes: string | null
          payment_method: string
          payment_terms: string | null
          po_number: string
          received_by: string | null
          seller_org_id: string
          seller_po_number: string | null
          ship_to_address: string | null
          ship_to_location_id: string | null
          shipped_at: string | null
          status: string
          submitted_at: string | null
          subtotal: number
          tax_amount: number
          tax_exempt: boolean
          total_amount: number
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          bill_to_location_id?: string | null
          buyer_org_id: string
          carrier?: string | null
          catalog_id?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          delivered_at?: string | null
          eta_date?: string | null
          eta_note?: string | null
          exemption_certificate_id?: string | null
          id?: string
          issue_note?: string | null
          notes?: string | null
          payment_method?: string
          payment_terms?: string | null
          po_number: string
          received_by?: string | null
          seller_org_id: string
          seller_po_number?: string | null
          ship_to_address?: string | null
          ship_to_location_id?: string | null
          shipped_at?: string | null
          status?: string
          submitted_at?: string | null
          subtotal?: number
          tax_amount?: number
          tax_exempt?: boolean
          total_amount?: number
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          bill_to_location_id?: string | null
          buyer_org_id?: string
          carrier?: string | null
          catalog_id?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          delivered_at?: string | null
          eta_date?: string | null
          eta_note?: string | null
          exemption_certificate_id?: string | null
          id?: string
          issue_note?: string | null
          notes?: string | null
          payment_method?: string
          payment_terms?: string | null
          po_number?: string
          received_by?: string | null
          seller_org_id?: string
          seller_po_number?: string | null
          ship_to_address?: string | null
          ship_to_location_id?: string | null
          shipped_at?: string | null
          status?: string
          submitted_at?: string | null
          subtotal?: number
          tax_amount?: number
          tax_exempt?: boolean
          total_amount?: number
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_bill_to_location_id_fkey"
            columns: ["bill_to_location_id"]
            isOneToOne: false
            referencedRelation: "org_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_buyer_org_id_fkey"
            columns: ["buyer_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "product_catalogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_exemption_certificate_id_fkey"
            columns: ["exemption_certificate_id"]
            isOneToOne: false
            referencedRelation: "exemption_certificates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_seller_org_id_fkey"
            columns: ["seller_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_ship_to_location_id_fkey"
            columns: ["ship_to_location_id"]
            isOneToOne: false
            referencedRelation: "org_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      record_activities: {
        Row: {
          activity_type: string
          body: string | null
          created_at: string
          id: string
          is_internal: boolean
          metadata: Json
          record_id: string
          user_id: string
        }
        Insert: {
          activity_type: string
          body?: string | null
          created_at?: string
          id?: string
          is_internal?: boolean
          metadata?: Json
          record_id: string
          user_id: string
        }
        Update: {
          activity_type?: string
          body?: string | null
          created_at?: string
          id?: string
          is_internal?: boolean
          metadata?: Json
          record_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "record_activities_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "record_activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      record_number_counters: {
        Row: {
          next_value: number
          object_type_id: string
        }
        Insert: {
          next_value?: number
          object_type_id: string
        }
        Update: {
          next_value?: number
          object_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "record_number_counters_object_type_id_fkey"
            columns: ["object_type_id"]
            isOneToOne: true
            referencedRelation: "object_type_defs"
            referencedColumns: ["id"]
          },
        ]
      }
      records: {
        Row: {
          assigned_to: string | null
          closed_at: string | null
          created_at: string
          description: string | null
          field_values: Json
          id: string
          object_type_id: string
          photos: Json
          priority: string
          receiving_org_id: string | null
          record_number: string
          status_id: string | null
          submitted_by: string
          submitting_org_id: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          closed_at?: string | null
          created_at?: string
          description?: string | null
          field_values?: Json
          id?: string
          object_type_id: string
          photos?: Json
          priority?: string
          receiving_org_id?: string | null
          record_number: string
          status_id?: string | null
          submitted_by: string
          submitting_org_id: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          closed_at?: string | null
          created_at?: string
          description?: string | null
          field_values?: Json
          id?: string
          object_type_id?: string
          photos?: Json
          priority?: string
          receiving_org_id?: string | null
          record_number?: string
          status_id?: string | null
          submitted_by?: string
          submitting_org_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "records_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "records_object_type_id_fkey"
            columns: ["object_type_id"]
            isOneToOne: false
            referencedRelation: "object_type_defs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "records_receiving_org_id_fkey"
            columns: ["receiving_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "records_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "status_defs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "records_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "records_submitting_org_id_fkey"
            columns: ["submitting_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_downloads: {
        Row: {
          downloaded_at: string
          id: string
          partner_org_id: string | null
          resource_id: string
          user_id: string
        }
        Insert: {
          downloaded_at?: string
          id?: string
          partner_org_id?: string | null
          resource_id: string
          user_id: string
        }
        Update: {
          downloaded_at?: string
          id?: string
          partner_org_id?: string | null
          resource_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_downloads_partner_org_id_fkey"
            columns: ["partner_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_downloads_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          created_at: string
          description: string | null
          download_count: number
          id: string
          manufacturer_org_id: string
          required_tier: Database["public"]["Enums"]["tier_level"] | null
          tags: string[] | null
          title: string
          type: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          download_count?: number
          id?: string
          manufacturer_org_id: string
          required_tier?: Database["public"]["Enums"]["tier_level"] | null
          tags?: string[] | null
          title: string
          type?: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          description?: string | null
          download_count?: number
          id?: string
          manufacturer_org_id?: string
          required_tier?: Database["public"]["Enums"]["tier_level"] | null
          tags?: string[] | null
          title?: string
          type?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "resources_manufacturer_org_id_fkey"
            columns: ["manufacturer_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      return_authorizations: {
        Row: {
          buyer_org_id: string
          carrier: string | null
          created_at: string
          credit_memo_id: string | null
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          id: string
          notes: string | null
          order_id: string
          reason: string
          received_at: string | null
          requested_by: string
          rma_number: string
          seller_org_id: string
          status: string
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          buyer_org_id: string
          carrier?: string | null
          created_at?: string
          credit_memo_id?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          notes?: string | null
          order_id: string
          reason: string
          received_at?: string | null
          requested_by: string
          rma_number: string
          seller_org_id: string
          status?: string
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          buyer_org_id?: string
          carrier?: string | null
          created_at?: string
          credit_memo_id?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          reason?: string
          received_at?: string | null
          requested_by?: string
          rma_number?: string
          seller_org_id?: string
          status?: string
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_authorizations_buyer_org_id_fkey"
            columns: ["buyer_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_authorizations_credit_memo_id_fkey"
            columns: ["credit_memo_id"]
            isOneToOne: false
            referencedRelation: "credit_memos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_authorizations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_authorizations_seller_org_id_fkey"
            columns: ["seller_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      return_lines: {
        Row: {
          order_line_id: string
          quantity: number
          return_id: string
        }
        Insert: {
          order_line_id: string
          quantity: number
          return_id: string
        }
        Update: {
          order_line_id?: string
          quantity?: number
          return_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_lines_order_line_id_fkey"
            columns: ["order_line_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_lines_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "return_authorizations"
            referencedColumns: ["id"]
          },
        ]
      }
      scrap_tire_ledger: {
        Row: {
          created_at: string
          created_by: string | null
          delta: number
          id: string
          notes: string | null
          org_id: string
          reference: string | null
          source: string
          tire_type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delta: number
          id?: string
          notes?: string | null
          org_id: string
          reference?: string | null
          source?: string
          tire_type?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delta?: number
          id?: string
          notes?: string | null
          org_id?: string
          reference?: string | null
          source?: string
          tire_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "scrap_tire_ledger_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_lines: {
        Row: {
          order_line_id: string
          quantity: number
          shipment_id: string
        }
        Insert: {
          order_line_id: string
          quantity: number
          shipment_id: string
        }
        Update: {
          order_line_id?: string
          quantity?: number
          shipment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_lines_order_line_id_fkey"
            columns: ["order_line_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_lines_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          bol_number: string | null
          buyer_org_id: string
          carrier: string | null
          created_at: string
          created_by: string
          delivered_at: string | null
          eta_date: string | null
          freight_cost: number | null
          id: string
          mode: string
          notes: string | null
          order_id: string
          pallets: number | null
          pro_number: string | null
          seller_org_id: string
          service: string | null
          shipment_number: string
          shipped_at: string
          status: string
          tracking_numbers: string[]
          updated_at: string
          weight_lbs: number | null
        }
        Insert: {
          bol_number?: string | null
          buyer_org_id: string
          carrier?: string | null
          created_at?: string
          created_by: string
          delivered_at?: string | null
          eta_date?: string | null
          freight_cost?: number | null
          id?: string
          mode?: string
          notes?: string | null
          order_id: string
          pallets?: number | null
          pro_number?: string | null
          seller_org_id: string
          service?: string | null
          shipment_number: string
          shipped_at?: string
          status?: string
          tracking_numbers?: string[]
          updated_at?: string
          weight_lbs?: number | null
        }
        Update: {
          bol_number?: string | null
          buyer_org_id?: string
          carrier?: string | null
          created_at?: string
          created_by?: string
          delivered_at?: string | null
          eta_date?: string | null
          freight_cost?: number | null
          id?: string
          mode?: string
          notes?: string | null
          order_id?: string
          pallets?: number | null
          pro_number?: string | null
          seller_org_id?: string
          service?: string | null
          shipment_number?: string
          shipped_at?: string
          status?: string
          tracking_numbers?: string[]
          updated_at?: string
          weight_lbs?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_buyer_org_id_fkey"
            columns: ["buyer_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_seller_org_id_fkey"
            columns: ["seller_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sourcing_requests: {
        Row: {
          created_at: string
          id: string
          machine: string | null
          org_id: string
          prompt: string | null
          quantity: number
          requested_by: string
          results: Json
          tire_size: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          machine?: string | null
          org_id: string
          prompt?: string | null
          quantity?: number
          requested_by: string
          results?: Json
          tire_size?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          machine?: string | null
          org_id?: string
          prompt?: string | null
          quantity?: number
          requested_by?: string
          results?: Json
          tire_size?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sourcing_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sourcing_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      spiff_claim_activities: {
        Row: {
          action: string
          actor_id: string
          claim_id: string
          created_at: string
          id: string
          payload: Json
        }
        Insert: {
          action: string
          actor_id: string
          claim_id: string
          created_at?: string
          id?: string
          payload?: Json
        }
        Update: {
          action?: string
          actor_id?: string
          claim_id?: string
          created_at?: string
          id?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "spiff_claim_activities_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "spiff_claims"
            referencedColumns: ["id"]
          },
        ]
      }
      spiff_claims: {
        Row: {
          attachments: Json
          claim_number: string
          claimant_org_id: string
          created_at: string
          created_by: string
          customer_name: string | null
          customer_ref: string | null
          id: string
          invoice_date: string | null
          invoice_number: string | null
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          payment_ref: string | null
          product_id: string | null
          program_id: string
          quantity_sold: number
          rejection_reason: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          reviewer_notes: string | null
          reward_amount: number | null
          sale_amount: number | null
          sale_date: string
          status: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          attachments?: Json
          claim_number: string
          claimant_org_id: string
          created_at?: string
          created_by: string
          customer_name?: string | null
          customer_ref?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_ref?: string | null
          product_id?: string | null
          program_id: string
          quantity_sold: number
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          reward_amount?: number | null
          sale_amount?: number | null
          sale_date: string
          status?: string
          unit_price: number
          updated_at?: string
        }
        Update: {
          attachments?: Json
          claim_number?: string
          claimant_org_id?: string
          created_at?: string
          created_by?: string
          customer_name?: string | null
          customer_ref?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_ref?: string | null
          product_id?: string | null
          program_id?: string
          quantity_sold?: number
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          reward_amount?: number | null
          sale_amount?: number | null
          sale_date?: string
          status?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "spiff_claims_claimant_org_id_fkey"
            columns: ["claimant_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spiff_claims_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spiff_claims_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "spiff_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      spiff_programs: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          eligible_org_types: string[]
          end_date: string | null
          flat_reward_amount: number | null
          id: string
          max_reward_per_claim: number | null
          max_total_payout: number | null
          min_quantity: number
          name: string
          notes: string | null
          org_id: string
          product_scope: Json
          program_type: string
          requires_invoice: boolean
          reward_currency: string
          reward_per_unit: number | null
          reward_type: string
          start_date: string
          status: string
          tiered_rewards: Json
          total_paid_out: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          eligible_org_types?: string[]
          end_date?: string | null
          flat_reward_amount?: number | null
          id?: string
          max_reward_per_claim?: number | null
          max_total_payout?: number | null
          min_quantity?: number
          name: string
          notes?: string | null
          org_id: string
          product_scope?: Json
          program_type?: string
          requires_invoice?: boolean
          reward_currency?: string
          reward_per_unit?: number | null
          reward_type?: string
          start_date: string
          status?: string
          tiered_rewards?: Json
          total_paid_out?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          eligible_org_types?: string[]
          end_date?: string | null
          flat_reward_amount?: number | null
          id?: string
          max_reward_per_claim?: number | null
          max_total_payout?: number | null
          min_quantity?: number
          name?: string
          notes?: string | null
          org_id?: string
          product_scope?: Json
          program_type?: string
          requires_invoice?: boolean
          reward_currency?: string
          reward_per_unit?: number | null
          reward_type?: string
          start_date?: string
          status?: string
          tiered_rewards?: Json
          total_paid_out?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "spiff_programs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      status_defs: {
        Row: {
          category: string
          color: string
          created_at: string
          id: string
          is_default: boolean
          is_terminal: boolean
          name: string
          object_type_id: string
          org_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          category?: string
          color?: string
          created_at?: string
          id?: string
          is_default?: boolean
          is_terminal?: boolean
          name: string
          object_type_id: string
          org_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category?: string
          color?: string
          created_at?: string
          id?: string
          is_default?: boolean
          is_terminal?: boolean
          name?: string
          object_type_id?: string
          org_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_defs_object_type_id_fkey"
            columns: ["object_type_id"]
            isOneToOne: false
            referencedRelation: "object_type_defs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_defs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          attachments: Json | null
          author_user_id: string
          body: string
          created_at: string
          id: string
          ticket_id: string
        }
        Insert: {
          attachments?: Json | null
          author_user_id: string
          body: string
          created_at?: string
          id?: string
          ticket_id: string
        }
        Update: {
          attachments?: Json | null
          author_user_id?: string
          body?: string
          created_at?: string
          id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          manufacturer_org_id: string
          partner_org_id: string
          priority: Database["public"]["Enums"]["ticket_priority"]
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          manufacturer_org_id: string
          partner_org_id: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          manufacturer_org_id?: string
          partner_org_id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_manufacturer_org_id_fkey"
            columns: ["manufacturer_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_partner_org_id_fkey"
            columns: ["partner_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tech_locations: {
        Row: {
          battery_pct: number | null
          lat: number
          lng: number
          org_id: string
          recorded_at: string
          status: string
          user_id: string
        }
        Insert: {
          battery_pct?: number | null
          lat: number
          lng: number
          org_id: string
          recorded_at?: string
          status?: string
          user_id: string
        }
        Update: {
          battery_pct?: number | null
          lat?: number
          lng?: number
          org_id?: string
          recorded_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tech_locations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tech_locations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tire_disposal_rules: {
        Row: {
          agency: string | null
          agency_url: string | null
          fee_label: string | null
          id: string
          notes: string | null
          per_tire_fee: number | null
          record_retention_years: number | null
          report_frequency: string | null
          state: string
          storage_limit: number | null
          updated_at: string
        }
        Insert: {
          agency?: string | null
          agency_url?: string | null
          fee_label?: string | null
          id?: string
          notes?: string | null
          per_tire_fee?: number | null
          record_retention_years?: number | null
          report_frequency?: string | null
          state: string
          storage_limit?: number | null
          updated_at?: string
        }
        Update: {
          agency?: string | null
          agency_url?: string | null
          fee_label?: string | null
          id?: string
          notes?: string | null
          per_tire_fee?: number | null
          record_retention_years?: number | null
          report_frequency?: string | null
          state?: string
          storage_limit?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      training_courses: {
        Row: {
          active: boolean
          content_url: string | null
          created_at: string
          description: string | null
          duration_minutes: number | null
          id: string
          level: string | null
          manufacturer_org_id: string
          required_tier: Database["public"]["Enums"]["tier_level"] | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          content_url?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          level?: string | null
          manufacturer_org_id: string
          required_tier?: Database["public"]["Enums"]["tier_level"] | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          content_url?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          level?: string | null
          manufacturer_org_id?: string
          required_tier?: Database["public"]["Enums"]["tier_level"] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_courses_manufacturer_org_id_fkey"
            columns: ["manufacturer_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      training_enrollments: {
        Row: {
          completed_at: string | null
          course_id: string
          created_at: string
          id: string
          partner_org_id: string
          score: number | null
          status: Database["public"]["Enums"]["enrollment_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          course_id: string
          created_at?: string
          id?: string
          partner_org_id: string
          score?: number | null
          status?: Database["public"]["Enums"]["enrollment_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          course_id?: string
          created_at?: string
          id?: string
          partner_org_id?: string
          score?: number | null
          status?: Database["public"]["Enums"]["enrollment_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "training_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_enrollments_partner_org_id_fkey"
            columns: ["partner_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_org_roles: {
        Row: {
          created_at: string
          id: string
          org_id: string
          org_role_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          org_role_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          org_role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_org_roles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_org_roles_org_role_id_fkey"
            columns: ["org_role_id"]
            isOneToOne: false
            referencedRelation: "org_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_organization_roles: {
        Row: {
          created_at: string
          id: string
          invited_at: string | null
          invited_by: string | null
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["user_role_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["user_role_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["user_role_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_organization_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          address: Json | null
          code: string | null
          created_at: string
          id: string
          manufacturer_org_id: string
          name: string
          updated_at: string
        }
        Insert: {
          address?: Json | null
          code?: string | null
          created_at?: string
          id?: string
          manufacturer_org_id: string
          name: string
          updated_at?: string
        }
        Update: {
          address?: Json | null
          code?: string | null
          created_at?: string
          id?: string
          manufacturer_org_id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_manufacturer_org_id_fkey"
            columns: ["manufacturer_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      warranty_policies: {
        Row: {
          coverage_type: string
          created_at: string
          duration_months: number
          flat_payout_pct: number | null
          id: string
          is_active: boolean
          manufacturer_org_id: string
          min_tread_pct_remaining: number
          name: string
          notes: string | null
          proration_method: string
          requires_unrepairable: boolean
          time_bands: Json
          updated_at: string
          use_dot_date_fallback: boolean
        }
        Insert: {
          coverage_type: string
          created_at?: string
          duration_months: number
          flat_payout_pct?: number | null
          id?: string
          is_active?: boolean
          manufacturer_org_id: string
          min_tread_pct_remaining?: number
          name: string
          notes?: string | null
          proration_method?: string
          requires_unrepairable?: boolean
          time_bands?: Json
          updated_at?: string
          use_dot_date_fallback?: boolean
        }
        Update: {
          coverage_type?: string
          created_at?: string
          duration_months?: number
          flat_payout_pct?: number | null
          id?: string
          is_active?: boolean
          manufacturer_org_id?: string
          min_tread_pct_remaining?: number
          name?: string
          notes?: string | null
          proration_method?: string
          requires_unrepairable?: boolean
          time_bands?: Json
          updated_at?: string
          use_dot_date_fallback?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "warranty_policies_manufacturer_org_id_fkey"
            columns: ["manufacturer_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_events: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          kind: string
          message: string
          work_order_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          message: string
          work_order_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          message?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_events_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          assigned_to: string | null
          bay: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          customer_name: string
          customer_phone: string | null
          duration_minutes: number
          equipment_identifier: string | null
          equipment_make: string | null
          equipment_model: string | null
          id: string
          lat: number | null
          lng: number | null
          org_id: string
          photos: Json
          pos_sale_id: string | null
          priority: string
          scheduled_at: string | null
          service_lines: Json
          signature_path: string | null
          signed_by_name: string | null
          site_address: string | null
          site_notes: string | null
          sla_minutes: number | null
          started_at: string | null
          status: string
          time_window: string | null
          updated_at: string
          wo_number: string
        }
        Insert: {
          assigned_to?: string | null
          bay?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          customer_name: string
          customer_phone?: string | null
          duration_minutes?: number
          equipment_identifier?: string | null
          equipment_make?: string | null
          equipment_model?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          org_id: string
          photos?: Json
          pos_sale_id?: string | null
          priority?: string
          scheduled_at?: string | null
          service_lines?: Json
          signature_path?: string | null
          signed_by_name?: string | null
          site_address?: string | null
          site_notes?: string | null
          sla_minutes?: number | null
          started_at?: string | null
          status?: string
          time_window?: string | null
          updated_at?: string
          wo_number: string
        }
        Update: {
          assigned_to?: string | null
          bay?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          customer_name?: string
          customer_phone?: string | null
          duration_minutes?: number
          equipment_identifier?: string | null
          equipment_make?: string | null
          equipment_model?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          org_id?: string
          photos?: Json
          pos_sale_id?: string | null
          priority?: string
          scheduled_at?: string | null
          service_lines?: Json
          signature_path?: string | null
          signed_by_name?: string | null
          site_address?: string | null
          site_notes?: string | null
          sla_minutes?: number | null
          started_at?: string | null
          status?: string
          time_window?: string | null
          updated_at?: string
          wo_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_pos_sale_id_fkey"
            columns: ["pos_sale_id"]
            isOneToOne: false
            referencedRelation: "pos_sales"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      api_gateway: {
        Args: { api_key: string; payload?: Json; resource: string }
        Returns: Json
      }
      approve_partner_application: {
        Args: { _app_id: string }
        Returns: string
      }
      calculate_spiff_reward: {
        Args: { _program_id: string; _quantity: number }
        Returns: number
      }
      claim_initial_platform_admin: {
        Args: { _user_id: string }
        Returns: boolean
      }
      erp_push_stock: { Args: { rows: Json; token: string }; Returns: Json }
      fire_notification_rules: {
        Args: {
          _entity_id: string
          _entity_type: string
          _event: string
          _org_id: string
          _payload: Json
        }
        Returns: undefined
      }
      next_record_number: {
        Args: { p_object_type_id: string }
        Returns: string
      }
      review_mdf_request: {
        Args: {
          _amount_approved_cents?: number
          _id: string
          _notes?: string
          _status: string
        }
        Returns: {
          activity_type: string | null
          amount_approved_cents: number | null
          amount_requested_cents: number
          campaign_name: string
          claim_proof_url: string | null
          created_at: string
          id: string
          manufacturer_org_id: string
          notes: string | null
          partner_org_id: string
          planned_date: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["mdf_status"]
          submitted_by: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "mdf_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "claims_submitter" | "viewer"
      application_status:
        | "submitted"
        | "under_review"
        | "approved"
        | "rejected"
        | "withdrawn"
      deal_status:
        | "submitted"
        | "approved"
        | "rejected"
        | "expired"
        | "won"
        | "lost"
      enrollment_status: "enrolled" | "in_progress" | "completed"
      lead_status:
        | "new"
        | "assigned"
        | "accepted"
        | "declined"
        | "working"
        | "won"
        | "lost"
      map_status: "open" | "investigating" | "resolved"
      mdf_status:
        | "draft"
        | "submitted"
        | "approved"
        | "rejected"
        | "claimed"
        | "paid"
      order_status:
        | "submitted"
        | "accepted"
        | "fulfilled"
        | "shipped"
        | "invoiced"
        | "cancelled"
      org_status: "active" | "pending" | "suspended"
      org_type: "manufacturer" | "distributor" | "dealer"
      platform_admin_level: "super_admin" | "support" | "read_only"
      quote_status: "draft" | "submitted" | "converted" | "expired"
      relationship_status: "active" | "pending" | "terminated"
      relationship_type: "manufacturer_distributor" | "distributor_dealer"
      ticket_priority: "low" | "normal" | "high" | "urgent"
      ticket_status: "open" | "pending" | "resolved" | "closed"
      tier_level: "silver" | "gold" | "platinum"
      user_role_status: "active" | "invited" | "disabled"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "manager", "claims_submitter", "viewer"],
      application_status: [
        "submitted",
        "under_review",
        "approved",
        "rejected",
        "withdrawn",
      ],
      deal_status: [
        "submitted",
        "approved",
        "rejected",
        "expired",
        "won",
        "lost",
      ],
      enrollment_status: ["enrolled", "in_progress", "completed"],
      lead_status: [
        "new",
        "assigned",
        "accepted",
        "declined",
        "working",
        "won",
        "lost",
      ],
      map_status: ["open", "investigating", "resolved"],
      mdf_status: [
        "draft",
        "submitted",
        "approved",
        "rejected",
        "claimed",
        "paid",
      ],
      order_status: [
        "submitted",
        "accepted",
        "fulfilled",
        "shipped",
        "invoiced",
        "cancelled",
      ],
      org_status: ["active", "pending", "suspended"],
      org_type: ["manufacturer", "distributor", "dealer"],
      platform_admin_level: ["super_admin", "support", "read_only"],
      quote_status: ["draft", "submitted", "converted", "expired"],
      relationship_status: ["active", "pending", "terminated"],
      relationship_type: ["manufacturer_distributor", "distributor_dealer"],
      ticket_priority: ["low", "normal", "high", "urgent"],
      ticket_status: ["open", "pending", "resolved", "closed"],
      tier_level: ["silver", "gold", "platinum"],
      user_role_status: ["active", "invited", "disabled"],
    },
  },
} as const
