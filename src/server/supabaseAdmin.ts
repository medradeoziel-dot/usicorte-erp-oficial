import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY } from '../lib/db';

dotenv.config();

/**
 * Cliente Supabase com privilégios administrativos para o backend/Node.js.
 * Utiliza preferencialmente a chave secreta (SUPABASE_SECRET_KEY / sb_secret_... ou SUPABASE_SERVICE_ROLE_KEY).
 * Se nenhuma chave administrativa for fornecida, utiliza a chave pública / publishable como fallback.
 */
export function createSupabaseAdminClient(): SupabaseClient {
  const url = (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    DEFAULT_SUPABASE_URL
  ).trim();

  const secretKey = (
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    DEFAULT_SUPABASE_ANON_KEY
  ).trim();

  return createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export const supabaseAdmin = createSupabaseAdminClient();
