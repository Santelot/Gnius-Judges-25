// ============================================
// GNIUS CLUB - METRICS.JS
// Lógica de la página de métricas
// ============================================

import {
    checkSession,
    getCurrentUser,
    logout,
    getMetrics,
    getTopProjectsByCategory,
    getGlobalStats,
    getCategoryMetrics,
    getRecentActivity,
    subscribeToNominations,
    getInitials,
    formatRelativeTime
} from './app.js';

// Variables globales
let metricsSubscription = null;
let refreshInterval = null;

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    // Verificar sesión
    if (!checkSession()) return;

    // Inicializar UI
    await initMetrics();

    // Event listeners
    setupEventListeners();

    // Suscribirse a cambios en tiempo real
    setupRealtimeSubscription();

    // Auto-refresh cada 30 segundos
    setupAutoRefresh();
});

/**
 * Inicializar métricas
 */
async function initMetrics() {
    const user = getCurrentUser();

    // Mostrar info del usuario
    document.getElementById('userName').textContent = user.nombre;
    document.getElementById('userInitials').textContent = getInitials(user.nombre);

    // Cargar todas las métricas
    await loadAllMetrics();
}

/**
 * Configurar event listeners
 */
function setupEventListeners() {
    // Botón de refresh
    document.getElementById('refreshBtn').addEventListener('click', async () => {
        const btn = document.getElementById('refreshBtn');
        btn.style.animation = 'spin 1s linear';
        await loadAllMetrics();
        setTimeout(() => {
            btn.style.animation = '';
        }, 1000);
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', (e) => {
        e.preventDefault();
        if (confirm('¿Estás seguro de que quieres salir?')) {
            logout();
        }
    });
}

/**
 * Configurar suscripción en tiempo real
 */
function setupRealtimeSubscription() {
    metricsSubscription = subscribeToNominations(async (payload) => {
        console.log('🔄 Actualizando métricas en tiempo real...');
        await loadAllMetrics();
    });
}

/**
 * Configurar auto-refresh
 */
function setupAutoRefresh() {
    refreshInterval = setInterval(async () => {
        console.log('🔄 Auto-refresh de métricas...');
        await loadAllMetrics();
    }, 30000); // 30 segundos
}

// ============================================
// CARGAR MÉTRICAS
// ============================================

/**
 * Cargar todas las métricas
 */
async function loadAllMetrics() {
    await Promise.all([
        loadGlobalStats(),
        loadCategoryMetrics(),
        loadTopProjects(),
        loadRecentActivity()
    ]);
}

/**
 * Cargar estadísticas globales
 */
async function loadGlobalStats() {
    const stats = await getGlobalStats();

    document.getElementById('totalJudges').textContent = stats.totalJudges;
    document.getElementById('totalVotes').textContent = stats.totalVotes;
    document.getElementById('totalProjects').textContent = stats.totalProjects;
}

/**
 * Cargar métricas por categoría
 */
async function loadCategoryMetrics() {
    const metrics = await getCategoryMetrics();
    const container = document.getElementById('categoriesMetrics');

    if (metrics.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No hay métricas disponibles</p></div>';
        return;
    }

    let html = '';

    metrics.forEach(metric => {
        html += `
            <div class="category-metric-card">
                <div class="metric-header">
                    <div class="metric-title">${metric.nombre}</div>
                    <div class="metric-subtitle">${metric.grado}</div>
                </div>
                <div class="metric-body">
                    <div class="metric-stat">
                        <span class="metric-label">Total de Votos</span>
                        <span class="metric-value">${metric.total_votos}</span>
                    </div>
                    <div class="metric-stat">
                        <span class="metric-label">Jueces Votantes</span>
                        <span class="metric-value">${metric.jueces_votantes}</span>
                    </div>
                    <div class="metric-stat">
                        <span class="metric-label">Promedio de Votos</span>
                        <span class="metric-value">${metric.jueces_votantes > 0 ? (metric.total_votos / metric.jueces_votantes).toFixed(1) : '0'}</span>
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

/**
 * Cargar top 3 proyectos
 */
async function loadTopProjects() {
    const topProjects = await getTopProjectsByCategory();
    const container = document.getElementById('topProjects');

    if (topProjects.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Aún no hay proyectos nominados</p></div>';
        return;
    }

    // Agrupar por categoría
    const grouped = {};
    topProjects.forEach(project => {
        const key = project.categoria;
        if (!grouped[key]) {
            grouped[key] = {
                categoria: project.categoria,
                grado: project.grado,
                category_id: project.category_id,
                projects: []
            };
        }
        grouped[key].projects.push(project);
    });

    let html = '';

    Object.values(grouped).forEach(category => {
        html += `
            <div class="top-category-section">
                <h3 class="section-subtitle">${category.categoria} - ${category.grado}</h3>
                <div class="top-projects-list">
                    ${category.projects.map(project => {
                        const medalColors = {
                            1: '#FFD700',
                            2: '#C0C0C0',
                            3: '#CD7F32'
                        };
                        const borderColor = medalColors[project.ranking_en_categoria] || 'var(--primary)';

                        return `
                            <div class="top-project-card" style="border-left-color: ${borderColor}">
                                <div class="top-project-header">
                                    <div class="project-rank" style="background: linear-gradient(135deg, ${borderColor}, ${borderColor}dd)">
                                        ${project.ranking_en_categoria}
                                    </div>
                                    <div class="project-votes">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
                                        </svg>
                                        <span>${project.total_votos} voto${project.total_votos !== 1 ? 's' : ''}</span>
                                    </div>
                                </div>
                                <div class="project-info">
                                    <h4>${project.project_code}</h4>
                                    <p class="project-meta">${category.categoria}</p>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

/**
 * Cargar actividad reciente
 */
async function loadRecentActivity() {
    const activities = await getRecentActivity(15);
    const container = document.getElementById('recentActivity');

    if (activities.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No hay actividad reciente</p></div>';
        return;
    }

    let html = '';

    activities.forEach(activity => {
        const userName = activity.users?.nombre || 'Desconocido';
        const categoryName = activity.categories?.nombre || 'Desconocida';
        const grade = activity.categories?.grado || '';

        html += `
            <div class="activity-item">
                <div class="activity-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
                    </svg>
                </div>
                <div class="activity-details">
                    <div class="activity-text">
                        <strong>${userName}</strong> nominó el proyecto 
                        <strong>${activity.project_code}</strong> en 
                        <strong>${categoryName}</strong>
                        ${grade ? `(${grade})` : ''}
                    </div>
                    <div class="activity-time">${formatRelativeTime(activity.created_at)}</div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// ============================================
// UTILIDADES
// ============================================

/**
 * Formatear número con separadores
 */
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Calcular porcentaje
 */
function calculatePercentage(part, total) {
    if (total === 0) return 0;
    return ((part / total) * 100).toFixed(1);
}

// ============================================
// CLEANUP
// ============================================

// Limpiar suscripciones e intervalos al salir
window.addEventListener('beforeunload', () => {
    if (metricsSubscription) {
        metricsSubscription.unsubscribe();
    }
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
});

// Limpiar cuando se sale de la página
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        if (refreshInterval) {
            clearInterval(refreshInterval);
            refreshInterval = null;
        }
    } else {
        if (!refreshInterval) {
            setupAutoRefresh();
        }
    }
});
