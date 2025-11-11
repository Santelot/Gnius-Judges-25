// ============================================
// GNIUS CLUB - CONFIG.JS
// Configuración de Supabase
// ============================================

// IMPORTANTE: Reemplaza estos valores con tus credenciales de Supabase
const SUPABASE_URL = 'https://hjljwyeiwyjpprtbgyzw.supabase.co'; // Ej: https://xxxxx.supabase.co
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqbGp3eWVpd3lqcHBydGJneXp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NTY4NzQsImV4cCI6MjA3ODQzMjg3NH0.ar2n1FSsQ9UuOlc8UgEVgr_PieFMvpZQ9ZgyzIQEmSU'; // Tu clave anónima de Supabase

// Validar configuración
if (SUPABASE_URL === 'TU_SUPABASE_URL' || SUPABASE_ANON_KEY === 'TU_SUPABASE_ANON_KEY') {
    console.error(`⚠️  CONFIGURACIÓN DE SUPABASE REQUERIDA`);
}

// Importar cliente de Supabase desde CDN
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Crear cliente de Supabase
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Verificar conexión
supabase
    .from('categories')
    .select('count', { count: 'exact', head: true })
    .then(({ count, error }) => {
        if (error) {
            console.error('❌ Error conectando a Supabase:', error.message);
            console.error('Verifica que:');
            console.error('1. La URL y clave sean correctas');
            console.error('2. El schema SQL esté instalado');
            console.error('3. Las políticas RLS estén deshabilitadas o configuradas');
        } else {
            console.log('✅ Conexión exitosa con Supabase');
            console.log(`📊 ${count || 0} categorías encontradas`);
        }
    });

export default supabase;
