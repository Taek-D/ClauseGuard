export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      contracts: {
        Row: {
          id: string
          user_id: string
          title: string
          file_name: string
          file_url: string
          file_size: number
          mime_type: string
          contract_type: string
          industry: string
          status: string
          counterparty: string | null
          effective_date: string | null
          expiry_date: string | null
          tags: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          file_name: string
          file_url: string
          file_size: number
          mime_type: string
          contract_type: string
          industry: string
          status?: string
          counterparty?: string | null
          effective_date?: string | null
          expiry_date?: string | null
          tags?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          file_name?: string
          file_url?: string
          file_size?: number
          mime_type?: string
          contract_type?: string
          industry?: string
          status?: string
          counterparty?: string | null
          effective_date?: string | null
          expiry_date?: string | null
          tags?: string[]
          updated_at?: string
        }
      }
      analyses: {
        Row: {
          id: string
          contract_id: string
          overall_risk_level: string
          risk_score: number
          summary: string
          clauses: Json
          critical_count: number
          high_count: number
          medium_count: number
          low_count: number
          key_findings: string[]
          recommendations: string[]
          language: string
          analyzed_at: string
        }
        Insert: {
          id?: string
          contract_id: string
          overall_risk_level: string
          risk_score: number
          summary: string
          clauses: Json
          critical_count?: number
          high_count?: number
          medium_count?: number
          low_count?: number
          key_findings?: string[]
          recommendations?: string[]
          language?: string
          analyzed_at?: string
        }
        Update: {
          overall_risk_level?: string
          risk_score?: number
          summary?: string
          clauses?: Json
          critical_count?: number
          high_count?: number
          medium_count?: number
          low_count?: number
          key_findings?: string[]
          recommendations?: string[]
        }
      }
      profiles: {
        Row: {
          id: string
          email: string
          name: string
          company: string | null
          plan: string
          contracts_used: number
          contracts_limit: number
          created_at: string
        }
        Insert: {
          id: string
          email: string
          name: string
          company?: string | null
          plan?: string
          contracts_used?: number
          contracts_limit?: number
          created_at?: string
        }
        Update: {
          name?: string
          company?: string | null
          plan?: string
          contracts_used?: number
          contracts_limit?: number
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
