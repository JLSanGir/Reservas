// ============================================================
// RESERVAS — Cliente Supabase
// Inicialización centralizada con CDN (sin bundler)
// ============================================================

/**
 * CONFIGURACIÓN
 * ─────────────
 * Reemplaza estos valores con los de tu proyecto Supabase:
 *   Dashboard → Settings → API → Project URL / anon key
 */
const SUPABASE_URL  = "https://foujbhzbcopdyqmcydxn.supabase.co";
const SUPABASE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvdWpiaHpiY29wZHlxbWN5ZHhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4OTczOTAsImV4cCI6MjA5NDQ3MzM5MH0.5rwHuPQsvHa3a7YEKHdzCWIQBdx3fkxa3LMcDWS_8I0";

// Inicializar cliente (la librería se carga vía CDN en el HTML)
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Verificación rápida en consola
console.log('✅ Supabase client inicializado:', SUPABASE_URL);
