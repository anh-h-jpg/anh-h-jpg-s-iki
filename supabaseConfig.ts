/// <reference types="vite/client" />

/**
 * Cấu hình kết nối Supabase cố định từ code cho môi trường Production.
 * Đọc ưu tiên từ biến môi trường Vite (import.meta.env.VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY).
 * Nếu môi trường không hỗ trợ, sử dụng hằng số cấu hình bên dưới.
 * Bỏ hoàn toàn việc đọc cấu hình từ localStorage.
 */

export const DEFAULT_SUPABASE_URL = 'https://gpfkjlunuufnljatjjec.supabase.co';

// Hằng số Supabase Anon Key dự phòng nếu không đặt trong file .env hoặc môi trường hosting
export const DEFAULT_SUPABASE_ANON_KEY = '';

export function sanitizeSupabaseUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  let url = rawUrl.trim();
  url = url.replace(/\/rest\/v1\/?$/i, '');
  url = url.replace(/\/auth\/v1\/?$/i, '');
  url = url.replace(/\/+$/, '');
  return url;
}

export function getSupabaseCredentials(): { url: string; key: string; isConfigured: boolean } {
  const envUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

  const rawUrl = envUrl || DEFAULT_SUPABASE_URL;
  const url = sanitizeSupabaseUrl(rawUrl);
  const key = (envKey || DEFAULT_SUPABASE_ANON_KEY).trim();

  return {
    url,
    key,
    isConfigured: Boolean(url && key && url.startsWith('http')),
  };
}
