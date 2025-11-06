import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables:', {
    url: supabaseUrl ? '✓ Set' : '✗ Missing',
    key: supabaseAnonKey ? '✓ Set' : '✗ Missing'
  })
  throw new Error(
    'Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env.local file and restart the dev server.'
  )
}

// Log connection info in development
if (import.meta.env.DEV) {
  console.log('Supabase client initialized:', {
    url: supabaseUrl,
    keyPrefix: supabaseAnonKey?.substring(0, 20) + '...'
  })
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

