// ============================================================
// RESERVAS - Cliente Supabase
// Inicializacion centralizada con CDN (sin bundler)
// ============================================================

/**
 * CONFIGURACION
 * Reemplaza estos valores con los de tu proyecto Supabase:
 * Dashboard -> Settings -> API -> Project URL / anon key
 */
const SUPABASE_URL = "https://foujbhzbcopdyqmcydxn.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvdWpiaHpiY29wZHlxbWN5ZHhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4OTczOTAsImV4cCI6MjA5NDQ3MzM5MH0.5rwHuPQsvHa3a7YEKHdzCWIQBdx3fkxa3LMcDWS_8I0";

const SUPABASE_CDN_MAX_INTENTOS = 10;
const SUPABASE_CDN_ESPERA_MS = 400;

let supabaseClient = null;

function validarConfiguracionSupabase() {
  if (!SUPABASE_URL || SUPABASE_URL.includes('TU_PROYECTO')) {
    throw new Error('Falta configurar SUPABASE_URL con la URL real del proyecto.');
  }

  if (!SUPABASE_KEY || SUPABASE_KEY.includes('TU_ANON_KEY')) {
    throw new Error('Falta configurar SUPABASE_KEY con la anon key real del proyecto.');
  }
}

function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function esperarSupabaseDesdeCDN() {
  for (let intento = 1; intento <= SUPABASE_CDN_MAX_INTENTOS; intento++) {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      return window.supabase;
    }

    await esperar(SUPABASE_CDN_ESPERA_MS);
  }

  throw new Error('No se pudo cargar la libreria de Supabase desde el CDN.');
}

async function inicializarClienteSupabase() {
  if (supabaseClient) return supabaseClient;

  validarConfiguracionSupabase();
  const supabaseCdn = await esperarSupabaseDesdeCDN();
  supabaseClient = supabaseCdn.createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log('Supabase client inicializado:', SUPABASE_URL);
  return supabaseClient;
}
