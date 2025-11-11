// ============================================
// GNIUS CLUB - APP.JS
// Lógica principal y conexión con Supabase
// ============================================

import { supabase } from './config.js';

// Variable global para el usuario actual
let currentUser = null;

// ============================================
// AUTENTICACIÓN Y USUARIOS
// ============================================

/**
 * Login del juez (sin autenticación real)
 */
export async function loginJudge(username, nombre) {
    try {
        const { data, error } = await supabase
            .rpc('get_or_create_user', {
                p_username: username.trim(),
                p_nombre: nombre.trim()
            });

        if (error) throw error;

        if (data && data.length > 0) {
            currentUser = data[0];
            
            // Guardar en localStorage
            localStorage.setItem('judgeUser', JSON.stringify(currentUser));
            
            console.log('✅ Usuario logueado:', currentUser);
            return { success: true, user: currentUser };
        } else {
            throw new Error('No se pudo crear o recuperar el usuario');
        }
    } catch (error) {
        console.error('❌ Error en login:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Obtener usuario actual
 */
export function getCurrentUser() {
    if (!currentUser) {
        const savedUser = localStorage.getItem('judgeUser');
        if (savedUser) {
            currentUser = JSON.parse(savedUser);
        }
    }
    return currentUser;
}

/**
 * Verificar si hay sesión activa
 */
export function checkSession() {
    const user = getCurrentUser();
    if (!user) {
        window.location.href = 'index.html';
        return false;
    }
    return true;
}

/**
 * Cerrar sesión
 */
export function logout() {
    localStorage.removeItem('judgeUser');
    currentUser = null;
    window.location.href = 'index.html';
}

// ============================================
// CATEGORÍAS
// ============================================

/**
 * Cargar todas las categorías
 */
export async function loadCategories() {
    try {
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .order('category_id');

        if (error) throw error;

        console.log('✅ Categorías cargadas:', data);
        return data || [];
    } catch (error) {
        console.error('❌ Error cargando categorías:', error);
        return [];
    }
}

// ============================================
// NOMINACIONES
// ============================================

/**
 * Nominar un proyecto
 */
export async function nominateProject(projectCode, categoryId) {
    const user = getCurrentUser();
    if (!user) {
        return { success: false, error: 'Usuario no autenticado' };
    }

    try {
        const { data, error } = await supabase
            .from('nominations')
            .insert({
                project_code: projectCode.trim(),
                category_id: categoryId,
                user_id: user.user_id
            })
            .select();

        if (error) {
            // Manejar errores específicos
            if (error.message.includes('límite') || error.message.includes('limit')) {
                return { 
                    success: false, 
                    error: 'Ya alcanzaste el límite de 3 nominaciones en esta categoría' 
                };
            }
            if (error.message.includes('unique_nomination') || error.code === '23505') {
                return { 
                    success: false, 
                    error: 'Ya nominaste este proyecto en esta categoría' 
                };
            }
            throw error;
        }

        console.log('✅ Proyecto nominado:', data[0]);
        return { success: true, nomination: data[0] };
    } catch (error) {
        console.error('❌ Error nominando proyecto:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Obtener resumen de nominaciones del juez actual
 */
export async function getMyNominations() {
    const user = getCurrentUser();
    if (!user) return [];

    try {
        const { data, error } = await supabase
            .rpc('get_judge_summary', {
                judge_user_id: user.user_id
            });

        if (error) throw error;

        console.log('✅ Resumen de nominaciones:', data);
        return data || [];
    } catch (error) {
        console.error('❌ Error obteniendo resumen:', error);
        return [];
    }
}

/**
 * Obtener nominaciones detalladas del juez
 */
export async function getMyDetailedNominations() {
    const user = getCurrentUser();
    if (!user) return [];

    try {
        const { data, error } = await supabase
            .from('nominations')
            .select(`
                nomination_id,
                project_code,
                created_at,
                category_id,
                categories (
                    nombre,
                    grado
                )
            `)
            .eq('user_id', user.user_id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        console.log('✅ Nominaciones detalladas:', data);
        return data || [];
    } catch (error) {
        console.error('❌ Error obteniendo nominaciones detalladas:', error);
        return [];
    }
}

/**
 * Verificar si puedo nominar en una categoría
 */
export async function canNominateInCategory(categoryId) {
    const user = getCurrentUser();
    if (!user) return false;

    try {
        const { data, error } = await supabase
            .from('nominations')
            .select('nomination_id')
            .eq('user_id', user.user_id)
            .eq('category_id', categoryId);

        if (error) throw error;

        const count = data.length;
        console.log(`📊 Nominaciones en categoría ${categoryId}: ${count}/3`);
        return count < 3;
    } catch (error) {
        console.error('❌ Error verificando límite:', error);
        return false;
    }
}

/**
 * Contar nominaciones en una categoría
 */
export async function countNominationsInCategory(categoryId) {
    const user = getCurrentUser();
    if (!user) return 0;

    try {
        const { data, error } = await supabase
            .from('nominations')
            .select('nomination_id')
            .eq('user_id', user.user_id)
            .eq('category_id', categoryId);

        if (error) throw error;

        return data.length;
    } catch (error) {
        console.error('❌ Error contando nominaciones:', error);
        return 0;
    }
}

/**
 * Verificar si ya nominé un proyecto específico
 */
export async function hasNominatedProject(projectCode, categoryId) {
    const user = getCurrentUser();
    if (!user) return false;

    try {
        const { data, error } = await supabase
            .from('nominations')
            .select('nomination_id')
            .eq('user_id', user.user_id)
            .eq('category_id', categoryId)
            .eq('project_code', projectCode.trim())
            .maybeSingle();

        if (error && error.code !== 'PGRST116') throw error;

        return data !== null;
    } catch (error) {
        console.error('❌ Error verificando nominación:', error);
        return false;
    }
}

/**
 * Eliminar una nominación
 */
export async function removeNomination(projectCode, categoryId) {
    const user = getCurrentUser();
    if (!user) {
        return { success: false, error: 'Usuario no autenticado' };
    }

    try {
        const { error } = await supabase
            .from('nominations')
            .delete()
            .eq('project_code', projectCode)
            .eq('category_id', categoryId)
            .eq('user_id', user.user_id);

        if (error) throw error;

        console.log('✅ Nominación eliminada');
        return { success: true };
    } catch (error) {
        console.error('❌ Error eliminando nominación:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Eliminar nominación por ID
 */
export async function removeNominationById(nominationId) {
    const user = getCurrentUser();
    if (!user) {
        return { success: false, error: 'Usuario no autenticado' };
    }

    try {
        const { error } = await supabase
            .from('nominations')
            .delete()
            .eq('nomination_id', nominationId)
            .eq('user_id', user.user_id);

        if (error) throw error;

        console.log('✅ Nominación eliminada');
        return { success: true };
    } catch (error) {
        console.error('❌ Error eliminando nominación:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// MÉTRICAS Y ESTADÍSTICAS
// ============================================

/**
 * Obtener métricas generales
 */
export async function getMetrics() {
    try {
        const { data, error } = await supabase
            .from('nomination_metrics')
            .select('*')
            .order('category_id')
            .order('total_votos', { ascending: false });

        if (error) throw error;

        console.log('✅ Métricas:', data);
        return data || [];
    } catch (error) {
        console.error('❌ Error obteniendo métricas:', error);
        return [];
    }
}

/**
 * Obtener top 3 proyectos por categoría
 */
export async function getTopProjectsByCategory() {
    try {
        const { data, error } = await supabase
            .from('top_projects_by_category')
            .select('*')
            .order('category_id')
            .order('ranking_en_categoria');

        if (error) throw error;

        console.log('✅ Top 3 por categoría:', data);
        return data || [];
    } catch (error) {
        console.error('❌ Error obteniendo top 3:', error);
        return [];
    }
}

/**
 * Obtener estadísticas globales
 */
export async function getGlobalStats() {
    try {
        // Total de jueces
        const { data: judgesData, error: judgesError } = await supabase
            .from('users')
            .select('user_id', { count: 'exact', head: true });

        // Total de votos
        const { data: votesData, error: votesError } = await supabase
            .from('nominations')
            .select('nomination_id', { count: 'exact', head: true });

        // Total de proyectos nominados (únicos)
        const { data: projectsData, error: projectsError } = await supabase
            .from('nominations')
            .select('project_code');

        if (judgesError || votesError || projectsError) {
            throw judgesError || votesError || projectsError;
        }

        const uniqueProjects = new Set(projectsData?.map(p => p.project_code) || []);

        const stats = {
            totalJudges: judgesData || 0,
            totalVotes: votesData || 0,
            totalProjects: uniqueProjects.size
        };

        console.log('✅ Estadísticas globales:', stats);
        return stats;
    } catch (error) {
        console.error('❌ Error obteniendo estadísticas:', error);
        return {
            totalJudges: 0,
            totalVotes: 0,
            totalProjects: 0
        };
    }
}

/**
 * Obtener métricas por categoría
 */
export async function getCategoryMetrics() {
    try {
        const { data, error } = await supabase
            .from('categories')
            .select(`
                category_id,
                nombre,
                grado,
                nominations (
                    nomination_id,
                    user_id
                )
            `);

        if (error) throw error;

        const metrics = data.map(cat => ({
            category_id: cat.category_id,
            nombre: cat.nombre,
            grado: cat.grado,
            total_votos: cat.nominations.length,
            jueces_votantes: new Set(cat.nominations.map(n => n.user_id)).size
        }));

        console.log('✅ Métricas por categoría:', metrics);
        return metrics;
    } catch (error) {
        console.error('❌ Error obteniendo métricas por categoría:', error);
        return [];
    }
}

/**
 * Obtener actividad reciente
 */
export async function getRecentActivity(limit = 20) {
    try {
        const { data, error } = await supabase
            .from('nominations')
            .select(`
                nomination_id,
                project_code,
                created_at,
                users (
                    nombre,
                    username
                ),
                categories (
                    nombre,
                    grado
                )
            `)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;

        console.log('✅ Actividad reciente:', data);
        return data || [];
    } catch (error) {
        console.error('❌ Error obteniendo actividad reciente:', error);
        return [];
    }
}

// ============================================
// SUSCRIPCIONES EN TIEMPO REAL
// ============================================

/**
 * Suscribirse a cambios en nominaciones
 */
export function subscribeToNominations(callback) {
    const subscription = supabase
        .channel('nominations-changes')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'nominations'
            },
            (payload) => {
                console.log('🔄 Cambio detectado en nominaciones:', payload);
                callback(payload);
            }
        )
        .subscribe();

    return subscription;
}

/**
 * Desuscribirse de cambios
 */
export function unsubscribe(subscription) {
    if (subscription) {
        subscription.unsubscribe();
    }
}

// ============================================
// UTILIDADES UI
// ============================================

/**
 * Mostrar toast de notificación
 */
export function showToast(message, type = 'success', duration = 3000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icons = {
        success: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>',
        error: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
        info: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'
    };

    const titles = {
        success: 'Éxito',
        error: 'Error',
        info: 'Información'
    };

    toast.innerHTML = `
        <div class="toast-icon" style="color: var(--${type})">
            ${icons[type]}
        </div>
        <div class="toast-content">
            <div class="toast-title">${titles[type]}</div>
            <div class="toast-message">${message}</div>
        </div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideInRight 0.3s reverse';
        setTimeout(() => {
            container.removeChild(toast);
        }, 300);
    }, duration);
}

/**
 * Formatear fecha relativa
 */
export function formatRelativeTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'Hace un momento';
    if (diffMins < 60) return `Hace ${diffMins} minuto${diffMins !== 1 ? 's' : ''}`;
    if (diffHours < 24) return `Hace ${diffHours} hora${diffHours !== 1 ? 's' : ''}`;
    if (diffDays < 7) return `Hace ${diffDays} día${diffDays !== 1 ? 's' : ''}`;
    
    return date.toLocaleDateString('es-MX', { 
        day: 'numeric', 
        month: 'short',
        year: 'numeric'
    });
}

/**
 * Obtener iniciales del nombre
 */
export function getInitials(name) {
    if (!name) return '??';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Calcular estadísticas del usuario
 */
export async function getUserStats() {
    const user = getCurrentUser();
    if (!user) return null;

    try {
        const summary = await getMyNominations();
        
        let totalNominations = 0;
        let categoriesCompleted = 0;
        
        summary.forEach(cat => {
            totalNominations += cat.total_nominaciones;
            if (cat.total_nominaciones === 3) {
                categoriesCompleted++;
            }
        });

        const remainingSlots = (6 * 3) - totalNominations;

        return {
            totalNominations,
            categoriesCompleted,
            remainingSlots
        };
    } catch (error) {
        console.error('❌ Error calculando estadísticas:', error);
        return {
            totalNominations: 0,
            categoriesCompleted: 0,
            remainingSlots: 18
        };
    }
}

// Exportar también para uso global
window.GniusApp = {
    loginJudge,
    getCurrentUser,
    checkSession,
    logout,
    loadCategories,
    nominateProject,
    getMyNominations,
    getMyDetailedNominations,
    canNominateInCategory,
    countNominationsInCategory,
    hasNominatedProject,
    removeNomination,
    removeNominationById,
    getMetrics,
    getTopProjectsByCategory,
    getGlobalStats,
    getCategoryMetrics,
    getRecentActivity,
    subscribeToNominations,
    unsubscribe,
    showToast,
    formatRelativeTime,
    getInitials,
    getUserStats
};

console.log('✅ Gnius App cargado correctamente');
