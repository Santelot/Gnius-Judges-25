// ============================================
// GNIUS CLUB - DASHBOARD.JS
// Lógica del dashboard principal
// ============================================

import { 
    checkSession, 
    getCurrentUser, 
    logout,
    loadCategories,
    nominateProject,
    getMyNominations,
    getMyDetailedNominations,
    countNominationsInCategory,
    hasNominatedProject,
    removeNominationById,
    showToast,
    getInitials,
    getUserStats,
    subscribeToNominations
} from './app.js';

// Variables globales
let categories = [];
let nominationsSubscription = null;

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    // Verificar sesión
    if (!checkSession()) return;

    // Inicializar UI
    await initDashboard();
    
    // Event listeners
    setupEventListeners();
    
    // Suscribirse a cambios en tiempo real
    setupRealtimeSubscription();
    
    // Ocultar loader del iframe cuando cargue
    setupIframeLoader();
});

/**
 * Inicializar dashboard
 */
async function initDashboard() {
    const user = getCurrentUser();
    
    // Mostrar info del usuario
    document.getElementById('userName').textContent = user.nombre;
    document.getElementById('userInitials').textContent = getInitials(user.nombre);
    
    // Cargar categorías
    categories = await loadCategories();
    populateCategorySelect();
    
    // Cargar estadísticas
    await updateUserStats();
}

/**
 * Configurar event listeners
 */
function setupEventListeners() {
    // Botón de nominar
    document.getElementById('nominateBtn').addEventListener('click', openNominationModal);
    
    // Modal de nominación
    document.getElementById('closeModal').addEventListener('click', closeNominationModal);
    document.getElementById('cancelNomination').addEventListener('click', closeNominationModal);
    document.getElementById('nominationForm').addEventListener('submit', handleNomination);
    
    // Cerrar modal al hacer clic fuera
    document.getElementById('nominationModal').addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            closeNominationModal();
        }
    });
    
    // Cambio de categoría
    document.getElementById('categorySelect').addEventListener('change', handleCategoryChange);
    
    // Mis nominaciones
    document.getElementById('myNominationsBtn').addEventListener('click', openMyNominationsModal);
    document.getElementById('closeMyNominationsModal').addEventListener('click', closeMyNominationsModal);
    
    // Cerrar modal de mis nominaciones al hacer clic fuera
    document.getElementById('myNominationsModal').addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            closeMyNominationsModal();
        }
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
 * Configurar loader del iframe
 */
function setupIframeLoader() {
    const iframe = document.getElementById('projectsIframe');
    const loader = document.getElementById('iframeLoader');
    
    iframe.addEventListener('load', () => {
        setTimeout(() => {
            loader.style.display = 'none';
            iframe.classList.add('loaded');
        }, 500);
    });
}

/**
 * Configurar suscripción en tiempo real
 */
function setupRealtimeSubscription() {
    nominationsSubscription = subscribeToNominations(async (payload) => {
        // Actualizar estadísticas cuando hay cambios
        await updateUserStats();
        
        // Mostrar notificación si es necesario
        if (payload.eventType === 'INSERT') {
            // Solo mostrar si no es del usuario actual
            const user = getCurrentUser();
            if (payload.new.user_id !== user.user_id) {
                console.log('🔔 Nueva nominación registrada');
            }
        }
    });
}

// ============================================
// ESTADÍSTICAS DEL USUARIO
// ============================================

/**
 * Actualizar estadísticas del usuario
 */
async function updateUserStats() {
    const stats = await getUserStats();
    
    if (stats) {
        document.getElementById('totalNominations').textContent = stats.totalNominations;
        document.getElementById('categoriesCompleted').textContent = `${stats.categoriesCompleted}/6`;
        document.getElementById('remainingSlots').textContent = stats.remainingSlots;
        document.getElementById('nominationsBadge').textContent = stats.totalNominations;
    }
}

// ============================================
// MODAL DE NOMINACIÓN
// ============================================

/**
 * Abrir modal de nominación
 */
function openNominationModal() {
    const modal = document.getElementById('nominationModal');
    modal.classList.add('active');
    
    // Limpiar formulario
    document.getElementById('projectCode').value = '';
    document.getElementById('categorySelect').value = '';
    document.getElementById('categoryInfo').style.display = 'none';
    document.getElementById('nominationError').style.display = 'none';
    
    // Focus en el input
    setTimeout(() => {
        document.getElementById('projectCode').focus();
    }, 100);
}

/**
 * Cerrar modal de nominación
 */
function closeNominationModal() {
    const modal = document.getElementById('nominationModal');
    modal.classList.remove('active');
}

/**
 * Poblar selector de categorías
 */
function populateCategorySelect() {
    const select = document.getElementById('categorySelect');
    select.innerHTML = '<option value="">Selecciona una categoría...</option>';
    
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.category_id;
        option.textContent = `${cat.nombre} - ${cat.grado}`;
        select.appendChild(option);
    });
}

/**
 * Manejar cambio de categoría
 */
async function handleCategoryChange(e) {
    const categoryId = parseInt(e.target.value);
    const categoryInfo = document.getElementById('categoryInfo');
    
    if (!categoryId) {
        categoryInfo.style.display = 'none';
        return;
    }
    
    // Contar nominaciones en esta categoría
    const count = await countNominationsInCategory(categoryId);
    
    // Mostrar info
    document.getElementById('categoryNominations').textContent = `${count}/3`;
    categoryInfo.style.display = 'block';
    
    // Actualizar estilo según disponibilidad
    const badge = document.getElementById('categoryNominations');
    if (count >= 3) {
        badge.style.color = 'var(--danger)';
    } else {
        badge.style.color = 'var(--success)';
    }
}

/**
 * Manejar nominación
 */
async function handleNomination(e) {
    e.preventDefault();
    
    const projectCode = document.getElementById('projectCode').value.trim();
    const categoryId = parseInt(document.getElementById('categorySelect').value);
    const errorDiv = document.getElementById('nominationError');
    const submitBtn = document.getElementById('submitNomination');
    
    // Validar
    if (!projectCode || !categoryId) {
        showError(errorDiv, 'Por favor completa todos los campos');
        return;
    }
    
    // Verificar si ya nominó este proyecto
    const alreadyNominated = await hasNominatedProject(projectCode, categoryId);
    if (alreadyNominated) {
        showError(errorDiv, 'Ya nominaste este proyecto en esta categoría');
        return;
    }
    
    // Verificar límite
    const count = await countNominationsInCategory(categoryId);
    if (count >= 3) {
        showError(errorDiv, 'Ya alcanzaste el límite de 3 nominaciones en esta categoría');
        return;
    }
    
    // Deshabilitar botón
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<svg class="spinner" viewBox="0 0 50 50" width="20" height="20"><circle class="path" cx="25" cy="25" r="20" fill="none" stroke-width="5"></circle></svg><span>Nominando...</span>';
    
    // Nominar
    const result = await nominateProject(projectCode, categoryId);
    
    if (result.success) {
        showToast('¡Proyecto nominado exitosamente!', 'success');
        closeNominationModal();
        await updateUserStats();
    } else {
        showError(errorDiv, result.error);
    }
    
    // Rehabilitar botón
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg><span>Nominar</span>';
}

/**
 * Mostrar error en el formulario
 */
function showError(errorDiv, message) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    errorDiv.classList.add('shake');
    setTimeout(() => {
        errorDiv.classList.remove('shake');
    }, 500);
}

// ============================================
// MODAL DE MIS NOMINACIONES
// ============================================

/**
 * Abrir modal de mis nominaciones
 */
async function openMyNominationsModal() {
    const modal = document.getElementById('myNominationsModal');
    const content = document.getElementById('myNominationsContent');
    
    modal.classList.add('active');
    
    // Mostrar loader
    content.innerHTML = '<div style="text-align: center; padding: 2rem;"><div class="loader-spinner"></div><p>Cargando...</p></div>';
    
    // Cargar nominaciones
    const summary = await getMyNominations();
    
    // Renderizar
    renderMyNominations(summary);
}

/**
 * Cerrar modal de mis nominaciones
 */
function closeMyNominationsModal() {
    const modal = document.getElementById('myNominationsModal');
    modal.classList.remove('active');
}

/**
 * Renderizar mis nominaciones
 */
async function renderMyNominations(summary) {
    const content = document.getElementById('myNominationsContent');
    
    if (!summary || summary.length === 0) {
        content.innerHTML = '<div class="empty-state"><p>No has nominado proyectos aún</p></div>';
        return;
    }
    
    // Obtener nominaciones detalladas
    const detailed = await getMyDetailedNominations();
    
    // Agrupar por categoría
    const grouped = {};
    detailed.forEach(nom => {
        const catId = nom.category_id;
        if (!grouped[catId]) {
            grouped[catId] = {
                category: nom.categories,
                nominations: []
            };
        }
        grouped[catId].nominations.push(nom);
    });
    
    // Renderizar
    let html = '';
    
    summary.forEach(cat => {
        const catData = grouped[cat.categoria] || grouped[Object.keys(grouped).find(key => {
            return grouped[key].category.nombre === cat.categoria;
        })];
        
        html += `
            <div class="nomination-category">
                <div class="category-header">
                    <div>
                        <div class="category-title">${cat.categoria}</div>
                        <div class="category-grade">${cat.grado}</div>
                    </div>
                    <div class="info-badge">
                        ${cat.total_nominaciones}/3
                    </div>
                </div>
                <div class="category-body">
                    ${cat.proyectos_nominados.length > 0 ? `
                        <ul class="project-list">
                            ${cat.proyectos_nominados.map((proj, idx) => {
                                const nomDetail = catData?.nominations.find(n => n.project_code === proj);
                                return `
                                    <li class="project-item">
                                        <span class="project-code">${proj}</span>
                                        <button 
                                            class="btn btn-icon btn-danger" 
                                            onclick="handleRemoveNomination('${nomDetail?.nomination_id || ''}', '${proj}')"
                                            title="Eliminar nominación"
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                <polyline points="3 6 5 6 21 6"></polyline>
                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                            </svg>
                                        </button>
                                    </li>
                                `;
                            }).join('')}
                        </ul>
                    ` : `
                        <div class="empty-state">
                            <p>No has nominado proyectos en esta categoría</p>
                        </div>
                    `}
                </div>
            </div>
        `;
    });
    
    content.innerHTML = html;
}

/**
 * Manejar eliminación de nominación
 */
window.handleRemoveNomination = async function(nominationId, projectCode) {
    if (!confirm(`¿Estás seguro de eliminar la nominación de ${projectCode}?`)) {
        return;
    }
    
    const result = await removeNominationById(nominationId);
    
    if (result.success) {
        showToast('Nominación eliminada', 'success');
        await updateUserStats();
        
        // Recargar modal
        const summary = await getMyNominations();
        renderMyNominations(summary);
    } else {
        showToast(result.error, 'error');
    }
};

// ============================================
// CLEANUP
// ============================================

// Limpiar suscripciones al salir
window.addEventListener('beforeunload', () => {
    if (nominationsSubscription) {
        nominationsSubscription.unsubscribe();
    }
});
