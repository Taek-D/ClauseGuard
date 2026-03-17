import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables'
  )
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

export async function uploadContractFile(
  userId: string,
  file: File
): Promise<{ path: string; url: string }> {
  const ext = file.name.split('.').pop() ?? 'pdf'
  const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { data, error } = await supabase.storage
    .from('contracts')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (error) throw error

  const { data: urlData } = supabase.storage
    .from('contracts')
    .getPublicUrl(data.path)

  return { path: data.path, url: urlData.publicUrl }
}

export async function deleteContractFile(path: string): Promise<void> {
  const { error } = await supabase.storage.from('contracts').remove([path])
  if (error) throw error
}
