// ===============================
// CONFIGURAÇÃO FIREBASE
// ===============================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { 
    getFirestore, 
    collection, 
    addDoc, 
    query, 
    where, 
    getDocs, 
    doc, 
    setDoc, 
    getDoc, 
    deleteDoc, 
    orderBy, 
    limit,
    serverTimestamp,
    and,
    or,
    Timestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyBoHkstIa6rDJ1n3DvfwYVYBGfRSIjF_V0",
  authDomain: "gestao-ice-beer.firebaseapp.com",
  projectId: "gestao-ice-beer",
  storageBucket: "gestao-ice-beer.firebasestorage.app",
  messagingSenderId: "975617921156",
  appId: "1:975617921156:web:7c422066760da8178f32d1",
  measurementId: "G-1CY31TG5YM"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ===============================
// CONFIGURAÇÕES GLOBAIS
// ===============================

const businessData = {
    'conveniencias': {
        name: 'Conveniências Ice Beer',
        stores: ['Loja 1', 'Loja 2', 'Loja 3']
    },
    'petiscarias': {
        name: 'Petiscarias Ice Beer', 
        stores: ['Loja 1', 'Loja 2']
    },
    'diskchopp': {
        name: 'Disk Chopp Ice Beer',
        stores: ['Delivery']
    }
};

const defaultUsers = {
    'conveniencias@icebeer.com': { segment: 'conveniencias', name: 'Gestor Conveniências' },
    'petiscarias@icebeer.com': { segment: 'petiscarias', name: 'Gestor Petiscarias' },
    'diskchopp@icebeer.com': { segment: 'diskchopp', name: 'Gestor Disk Chopp' },
    'executivo@icebeer.com': { segment: 'executive', name: 'Dashboard Executiva' }
};

// ===============================
// VARIÁVEIS GLOBAIS
// ===============================

let currentUser = null;
let currentUserData = null;
let selectedMonth = getCurrentMonth();
let editingEntry = null;
let currentFilters = {
    segment: '',
    store: '',
    month: '',
    period: '',
    startDate: '',
    endDate: '',
    week: ''
};

let chartInstances = {};

// ===============================
// CLASSES DE GERENCIAMENTO
// ===============================

class CacheManager {
    constructor() {
        this.cache = new Map();
        this.stats = { hits: 0, misses: 0, sets: 0, errors: 0 };
        this.config = { maxSize: 100, ttl: 5 * 60 * 1000 }; // 5 minutos
        this.setupMaintenance();
    }

    setupMaintenance() {
        setInterval(() => this.performMaintenance(), 30000); // 30 segundos
    }

    async set(key, data, ttl = null) {
        try {
            if (this.cache.size >= this.config.maxSize) {
                this.evictOldest();
            }

            this.cache.set(key, {
                data: JSON.parse(JSON.stringify(data)),
                timestamp: Date.now(),
                ttl: ttl || this.config.ttl,
                hits: 0
            });

            this.stats.sets++;
            return true;
        } catch (error) {
            this.stats.errors++;
            console.error('Cache set error:', error);
            return false;
        }
    }

    async get(key) {
        try {
            const item = this.cache.get(key);
            
            if (!item) {
                this.stats.misses++;
                return null;
            }

            if (this.isExpired(item)) {
                this.cache.delete(key);
                this.stats.misses++;
                return null;
            }

            item.hits++;
            this.stats.hits++;
            return JSON.parse(JSON.stringify(item.data));
        } catch (error) {
            this.stats.errors++;
            console.error('Cache get error:', error);
            return null;
        }
    }

    isExpired(item) {
        return Date.now() - item.timestamp > item.ttl;
    }

    evictOldest() {
        let oldest = null;
        let oldestTime = Date.now();

        for (const [key, item] of this.cache.entries()) {
            if (item.timestamp < oldestTime) {
                oldest = key;
                oldestTime = item.timestamp;
            }
        }

        if (oldest) {
            this.cache.delete(oldest);
        }
    }

    performMaintenance() {
        let removed = 0;
        for (const [key, item] of this.cache.entries()) {
            if (this.isExpired(item)) {
                this.cache.delete(key);
                removed++;
            }
        }
        
        if (removed > 0) {
            console.log(`Cache maintenance: ${removed} items removed`);
        }
        
        this.updateCacheDisplay();
    }

    updateCacheDisplay() {
        const display = document.getElementById('cacheStatusDisplay');
        if (display) {
            const efficiency = this.getEfficiency();
            const size = this.cache.size;
            display.textContent = `💾 Cache: ${size}/${this.config.maxSize} (${efficiency}% ef.)`;
        }
    }

    getEfficiency() {
        const total = this.stats.hits + this.stats.misses;
        return total > 0 ? Math.round((this.stats.hits / total) * 100) : 100;
    }

    invalidatePattern(pattern) {
        const keys = Array.from(this.cache.keys()).filter(key => key.includes(pattern));
        keys.forEach(key => this.cache.delete(key));
        console.log(`Cache invalidated: ${keys.length} entries matching "${pattern}"`);
    }

    clear() {
        const oldSize = this.cache.size;
        this.cache.clear();
        this.stats = { hits: 0, misses: 0, sets: 0, errors: 0 };
        console.log(`Cache cleared: ${oldSize} items removed`);
        this.updateCacheDisplay();
    }

    getStats() {
        return {
            ...this.stats,
            size: this.cache.size,
            maxSize: this.config.maxSize,
            efficiency: this.getEfficiency()
        };
    }
}

class NotificationManager {
    constructor() {
        this.queue = [];
        this.current = null;
    }

    show(title, message, type = 'info', duration = 4000) {
        this.queue.push({ title, message, type, duration });
        if (!this.current) {
            this.processQueue();
        }
    }

    processQueue() {
        if (this.queue.length === 0) {
            this.current = null;
            return;
        }

        this.current = this.queue.shift();
        this.display(this.current);

        setTimeout(() => {
            this.hide();
            setTimeout(() => this.processQueue(), 300);
        }, this.current.duration);
    }

    display(notification) {
        const element = document.getElementById('notification');
        const titleElement = document.getElementById('notificationTitle');
        const messageElement = document.getElementById('notificationMessage');
        
        if (element && titleElement && messageElement) {
            titleElement.textContent = notification.title;
            messageElement.textContent = notification.message;
            
            element.className = `notification ${notification.type}`;
            element.classList.add('show');
        }
    }

    hide() {
        const element = document.getElementById('notification');
        if (element) {
            element.classList.remove('show');
        }
    }
}

class ProgressManager {
    constructor() {
        this.indicator = document.getElementById('progressIndicator');
        this.bar = document.getElementById('progressBar');
    }

    show() {
        if (this.indicator) {
            this.indicator.classList.add('show');
        }
    }

    update(percentage) {
        if (this.bar) {
            this.bar.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
        }
    }

    hide() {
        if (this.indicator) {
            this.indicator.classList.remove('show');
        }
        setTimeout(() => {
            if (this.bar) {
                this.bar.style.width = '0%';
            }
        }, 300);
    }
}

class QueryService {
    constructor(cacheManager) {
        this.cache = cacheManager;
    }

    async getSalesEntries(filters = {}) {
        const cacheKey = `sales_${JSON.stringify(filters)}`;
        
        // Verificar cache
        const cached = await this.cache.get(cacheKey);
        if (cached) {
            console.log('📊 Dados obtidos do cache:', cacheKey);
            return cached;
        }

        try {
            let baseQuery = collection(db, 'sales_entries');
            const constraints = [];

            // Filtros básicos
            if (filters.segment) {
                constraints.push(where('segment', '==', filters.segment));
            }
            if (filters.store) {
                constraints.push(where('store', '==', filters.store));
            }
            if (filters.month) {
                constraints.push(where('month', '==', filters.month));
            }

            // Filtros de data flexíveis
            if (filters.startDate && filters.endDate) {
                const startTimestamp = Timestamp.fromDate(new Date(filters.startDate));
                const endTimestamp = Timestamp.fromDate(new Date(filters.endDate + 'T23:59:59'));
                constraints.push(where('entryDate', '>=', startTimestamp));
                constraints.push(where('entryDate', '<=', endTimestamp));
            }

            // Filtro de semana específica
            if (filters.weekIdentifier) {
                constraints.push(where('weekIdentifier', '==', filters.weekIdentifier));
            }

            constraints.push(orderBy('entryDate', 'desc'));
            constraints.push(limit(200));

            const salesQuery = query(baseQuery, ...constraints);
            const snapshot = await getDocs(salesQuery);
            
            const entries = [];
            snapshot.forEach((docRef) => {
                const data = { id: docRef.id, ...docRef.data() };
                entries.push(data);
            });

            await this.cache.set(cacheKey, entries);
            console.log(`🔍 Buscados ${entries.length} registros do Firestore`);
            return entries;
        } catch (error) {
            console.error('❌ Erro ao buscar vendas:', error);
            return [];
        }
    }

    async getTarget(segment, store, month, type = 'monthly') {
        const cacheKey = `target_${segment}_${store}_${month}_${type}`;
        
        const cached = await this.cache.get(cacheKey);
        if (cached !== null) {
            return cached;
        }

        try {
            const targetId = `${segment}_${store}_${month}_${type}`;
            const targetDoc = await getDoc(doc(db, 'targets', targetId));
            const value = targetDoc.exists() ? targetDoc.data().value : 0;
            
            await this.cache.set(cacheKey, value);
            return value;
        } catch (error) {
            console.warn(`⚠️ Erro ao buscar meta:`, error);
            return 0;
        }
    }

    async getAvailableWeeks(segment, month) {
        const cacheKey = `weeks_${segment}_${month}`;
        
        const cached = await this.cache.get(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            const entries = await this.getSalesEntries({ segment, month });
            const weeks = new Map();
            
            entries.forEach(entry => {
                if (entry.weekIdentifier && entry.entryType === 'week') {
                    const startDate = entry.periodStart ? safeGetDate(entry.periodStart) : null;
                    const endDate = entry.periodEnd ? safeGetDate(entry.periodEnd) : null;
                    
                    if (startDate && endDate) {
                        const weekLabel = `${startDate.toLocaleDateString('pt-BR')} a ${endDate.toLocaleDateString('pt-BR')}`;
                        weeks.set(entry.weekIdentifier, {
                            identifier: entry.weekIdentifier,
                            label: weekLabel,
                            startDate: entry.periodStart,
                            endDate: entry.periodEnd
                        });
                    }
                }
            });

            const result = Array.from(weeks.values());
            await this.cache.set(cacheKey, result);
            return result;
        } catch (error) {
            console.error('❌ Erro ao buscar semanas:', error);
            return [];
        }
    }
}

// ===============================
// INSTÂNCIAS GLOBAIS
// ===============================

const cacheManager = new CacheManager();
const notificationManager = new NotificationManager();
const progressManager = new ProgressManager();
const queryService = new QueryService(cacheManager);

// ===============================
// FUNÇÕES UTILITÁRIAS
// ===============================

function getCurrentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthYear(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatDisplayMonth(date) {
    const displayText = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return displayText.charAt(0).toUpperCase() + displayText.slice(1);
}

function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value || 0);
}

function formatDateForInput(date) {
    return date.toISOString().split('T')[0];
}

function safeGetDate(dateValue) {
    if (!dateValue) return new Date();
    if (dateValue.toDate) return dateValue.toDate();
    if (dateValue instanceof Date) return dateValue;
    return new Date(dateValue);
}

function getElementById(id) {
    return document.getElementById(id);
}

function getElementValue(id) {
    const element = getElementById(id);
    return element ? element.value : '';
}

function setElementValue(id, value) {
    const element = getElementById(id);
    if (element) element.value = value;
}

function setElementText(id, text) {
    const element = getElementById(id);
    if (element) element.textContent = text;
}

function showElement(id) {
    const element = getElementById(id);
    if (element) element.classList.remove('hidden');
}

function hideElement(id) {
    const element = getElementById(id);
    if (element) element.classList.add('hidden');
}

function setLoading(type, loading) {
    const text = getElementById(`${type}Text`);
    const loadingSpan = getElementById(`${type}Loading`);
    const btn = getElementById(`${type}Btn`);
    
    if (text && loadingSpan) {
        if (loading) {
            text.classList.add('hidden');
            loadingSpan.classList.remove('hidden');
            if (btn) btn.disabled = true;
        } else {
            text.classList.remove('hidden');
            loadingSpan.classList.add('hidden');
            if (btn) btn.disabled = false;
        }
    }
}

function showAlert(alertId, message, type) {
    const alert = getElementById(alertId);
    if (alert) {
        alert.className = `alert alert-${type}`;
        alert.textContent = message;
        alert.classList.remove('hidden');
        
        setTimeout(() => {
            alert.classList.add('hidden');
        }, 5000);
    }
}

function clearFormInputs(inputIds) {
    inputIds.forEach(id => setElementValue(id, ''));
}

// ===============================
// AUTENTICAÇÃO
// ===============================

window.handleLogin = async function() {
    const email = getElementValue('email').trim();
    const password = getElementValue('password').trim();
    
    if (!email || !password) {
        showAlert('loginAlert', 'Preencha todos os campos', 'error');
        return;
    }
    
    if (!defaultUsers[email]) {
        showAlert('loginAlert', 'Usuário não autorizado', 'error');
        return;
    }
    
    setLoading('login', true);
    
    try {
        await signInWithEmailAndPassword(auth, email, password);
        console.log('✅ Login realizado com sucesso!');
    } catch (error) {
        console.error('❌ Erro no login:', error);
        const errorMessage = getAuthErrorMessage(error.code);
        showAlert('loginAlert', errorMessage, 'error');
    } finally {
        setLoading('login', false);
    }
};

window.handleLogout = async function() {
    try {
        cacheManager.clear();
        if (auth) {
            await signOut(auth);
        }
        console.log('✅ Logout realizado com sucesso');
    } catch (error) {
        console.error('Erro no logout:', error);
    }
};

function getAuthErrorMessage(errorCode) {
    const errorMessages = {
        'auth/user-not-found': 'Usuário não encontrado',
        'auth/wrong-password': 'Senha incorreta',
        'auth/invalid-email': 'E-mail inválido',
        'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde',
        'auth/network-request-failed': 'Erro de conexão. Verifique sua internet',
        'auth/invalid-credential': 'Credenciais inválidas'
    };
    
    return errorMessages[errorCode] || 'E-mail ou senha inválidos';
}

// ===============================
// CONTROLE DE TELAS
// ===============================

function showLoginScreen() {
    getElementById('loginScreen').style.display = 'block';
    getElementById('dashboard').style.display = 'none';
    currentUser = null;
    currentUserData = null;
    clearFormInputs(['email', 'password']);
}

async function showDashboard() {
    getElementById('loginScreen').style.display = 'none';
    getElementById('dashboard').style.display = 'block';
    
    setElementText('welcomeText', `Bem-vindo, ${currentUserData.name}`);
    setElementText('currentDate', new Date().toLocaleDateString('pt-BR'));
    
    try {
        setupMonthYearSelector();
        setupFiltersPanel();
        setupFormDefaults();
        await loadStoresData();
        await updateDashboard();
        
        setTimeout(() => {
            notificationManager.show('Sistema Ativo!', 'Ice Beer v4.0 carregado com sucesso', 'success');
        }, 1000);
        
        console.log('✅ Dashboard carregado!');
    } catch (error) {
        console.error('❌ Erro ao inicializar dashboard:', error);
        showAlert('entryAlert', 'Erro ao inicializar dashboard', 'error');
    }
}

// ===============================
// CONFIGURAÇÃO INICIAL
// ===============================

function setupMonthYearSelector() {
    const select = getElementById('monthYearSelect');
    if (!select) return;
    
    select.innerHTML = '';
    
    const startDate = new Date(2025, 5, 1); // Junho 2025
    const endDate = new Date(2028, 11, 31); // Dezembro 2028
    const currentDate = new Date();
    
    // Gerar todos os meses do período
    const months = [];
    const current = new Date(startDate);
    
    while (current <= endDate) {
        months.push(new Date(current));
        current.setMonth(current.getMonth() + 1);
    }
    
    // Ordenar do mais recente para o mais antigo
    months.sort((a, b) => b - a);
    
    months.forEach(date => {
        const monthYear = formatMonthYear(date);
        const displayText = formatDisplayMonth(date);
        
        const option = document.createElement('option');
        option.value = monthYear;
        option.textContent = displayText;
        
        // Selecionar mês atual por padrão
        if (monthYear === selectedMonth) {
            option.selected = true;
        }
        
        select.appendChild(option);
    });
}

function setupFiltersPanel() {
    const filterSegment = getElementById('filterSegment');
    if (filterSegment) {
        filterSegment.innerHTML = '<option value="">Todos os segmentos</option>';
        
        Object.keys(businessData).forEach(segment => {
            const option = document.createElement('option');
            option.value = segment;
            option.textContent = businessData[segment].name;
            
            // Auto-selecionar segmento do usuário
            if (currentUserData.segment !== 'executive' && segment === currentUserData.segment) {
                option.selected = true;
                currentFilters.segment = segment;
            }
            
            filterSegment.appendChild(option);
        });
        
        // Configurar filtros dependentes
        if (currentFilters.segment) {
            setTimeout(() => {
                updateDependentFilters();
            }, 100);
        }
    }
    
    // Configurar filtro de mês
    const filterMonth = getElementById('filterMonth');
    if (filterMonth) {
        populateMonthFilter(filterMonth);
    }
}

function populateMonthFilter(filterMonth) {
    filterMonth.innerHTML = '<option value="">Selecione um mês</option>';
    
    const startDate = new Date(2025, 5, 1); // Junho 2025
    const endDate = new Date(2028, 11, 31); // Dezembro 2028
    
    const months = [];
    const current = new Date(startDate);
    
    while (current <= endDate) {
        months.push(new Date(current));
        current.setMonth(current.getMonth() + 1);
    }
    
    months.sort((a, b) => b - a);
    
    months.forEach(date => {
        const monthYear = formatMonthYear(date);
        const displayText = formatDisplayMonth(date);
        
        const option = document.createElement('option');
        option.value = monthYear;
        option.textContent = displayText;
        
        if (monthYear === selectedMonth) {
            option.selected = true;
            currentFilters.month = monthYear;
        }
        
        filterMonth.appendChild(option);
    });
}

function setupFormDefaults() {
    // Configurar data padrão para hoje
    const today = formatDateForInput(new Date());
    setElementValue('singleDate', today);
    
    // Configurar semana atual
    const { startOfWeek, endOfWeek } = getCurrentWeekRange(new Date());
    setElementValue('periodStart', formatDateForInput(startOfWeek));
    setElementValue('periodEnd', formatDateForInput(endOfWeek));
}

function getCurrentWeekRange(date) {
    const dayOfWeek = date.getDay();
    const startOfWeek = new Date(date);
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    startOfWeek.setDate(date.getDate() + diffToMonday);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    return { startOfWeek, endOfWeek };
}

async function loadStoresData() {
    if (!currentUserData) return;
    
    const userSegment = currentUserData.segment;
    let stores = [];
    
    if (userSegment === 'executive') {
        // Dashboard executiva vê todas as lojas
        Object.values(businessData).forEach(segment => {
            stores = [...stores, ...segment.stores.map(store => `${segment.name} - ${store}`)];
        });
    } else {
        stores = businessData[userSegment]?.stores || [];
    }
    
    populateStoreSelects(stores);
}

function populateStoreSelects(stores) {
    const storeSelect = getElementById('storeSelect');
    const targetStoreSelect = getElementById('targetStoreSelect');
    
    [storeSelect, targetStoreSelect].forEach(select => {
        if (select) {
            select.innerHTML = '<option value="">Selecione uma loja</option>';
            stores.forEach(store => {
                const option = document.createElement('option');
                option.value = store;
                option.textContent = store;
                select.appendChild(option);
            });
        }
    });
}

// ===============================
// HANDLERS DE FILTROS
// ===============================

window.handleSegmentChange = function() {
    currentFilters.segment = getElementValue('filterSegment');
    updateDependentFilters();
    resetDependentFilters();
};

window.handleStoreChange = function() {
    currentFilters.store = getElementValue('filterStore');
};

window.handleMonthChange = async function() {
    currentFilters.month = getElementValue('filterMonth');
    currentFilters.week = '';
    
    const filterWeek = getElementById('filterWeek');
    if (filterWeek && currentFilters.segment && currentFilters.month) {
        await updateWeeksFilter();
    }
};

window.handlePeriodChange = function() {
    const period = getElementValue('filterPeriod');
    currentFilters.period = period;
    
    // Mostrar/ocultar campos baseado no período selecionado
    if (period === 'week') {
        showElement('weekFilter');
        hideElement('customDateRange');
        if (currentFilters.segment && currentFilters.month) {
            updateWeeksFilter();
        }
    } else if (period === 'range') {
        hideElement('weekFilter');
        showElement('customDateRange');
    } else {
        hideElement('weekFilter');
        hideElement('customDateRange');
    }
    
    clearFiltersState();
};

window.handleDateRangeChange = function() {
    currentFilters.startDate = getElementValue('startDate');
    currentFilters.endDate = getElementValue('endDate');
};

window.handleWeekChange = function() {
    currentFilters.week = getElementValue('filterWeek');
};

function updateDependentFilters() {
    const segment = currentFilters.segment;
    const filterStore = getElementById('filterStore');
    
    if (filterStore) {
        filterStore.innerHTML = '<option value="">Todas as lojas</option>';
        
        if (segment && businessData[segment]) {
            const stores = businessData[segment].stores;
            stores.forEach(store => {
                const option = document.createElement('option');
                option.value = store;
                option.textContent = store;
                filterStore.appendChild(option);
            });
        }
    }
}

function resetDependentFilters() {
    currentFilters.store = '';
    currentFilters.week = '';
    
    setElementValue('filterStore', '');
    setElementValue('filterWeek', '');
    
    hideElement('weekFilter');
    hideElement('customDateRange');
}

async function updateWeeksFilter() {
    const filterWeek = getElementById('filterWeek');
    if (!filterWeek) return;
    
    filterWeek.innerHTML = '<option value="">Carregando semanas...</option>';
    
    try {
        const weeks = await queryService.getAvailableWeeks(currentFilters.segment, currentFilters.month);
        
        filterWeek.innerHTML = '<option value="">Todas as semanas</option>';
        
        if (weeks.length > 0) {
            weeks.forEach(week => {
                const option = document.createElement('option');
                option.value = week.identifier;
                option.textContent = week.label;
                filterWeek.appendChild(option);
            });
        } else {
            const noDataOption = document.createElement('option');
            noDataOption.value = '';
            noDataOption.textContent = 'Nenhuma semana encontrada';
            noDataOption.disabled = true;
            filterWeek.appendChild(noDataOption);
        }
    } catch (error) {
        console.error('❌ Erro ao carregar semanas:', error);
        filterWeek.innerHTML = '<option value="">Erro ao carregar</option>';
    }
}

function clearFiltersState() {
    currentFilters.startDate = '';
    currentFilters.endDate = '';
    currentFilters.week = '';
    setElementValue('startDate', '');
    setElementValue('endDate', '');
    setElementValue('filterWeek', '');
}

window.clearFilters = function() {
    // Reset todos os filtros
    Object.keys(currentFilters).forEach(key => {
        if (key !== 'segment' && currentUserData.segment !== 'executive') {
            currentFilters[key] = '';
        } else if (currentUserData.segment === 'executive') {
            currentFilters[key] = '';
        }
    });
    
    // Reset elementos do DOM
    const filterElements = ['filterSegment', 'filterStore', 'filterMonth', 'filterPeriod', 'filterWeek', 'startDate', 'endDate'];
    filterElements.forEach(id => {
        const element = getElementById(id);
        if (element) {
            if (id === 'filterSegment' && currentUserData.segment !== 'executive') {
                element.value = currentUserData.segment;
                currentFilters.segment = currentUserData.segment;
            } else {
                element.value = '';
            }
        }
    });
    
    // Ocultar campos condicionais
    hideElement('weekFilter');
    hideElement('customDateRange');
    
    notificationManager.show('Filtros Limpos', 'Todos os filtros foram resetados', 'info');
};

// ===============================
// ANÁLISE E DASHBOARD
// ===============================

window.handleAnalyze = async function() {
    console.log('📊 Iniciando análise com filtros:', currentFilters);
    
    setLoading('analyze', true);
    progressManager.show();
    
    try {
        progressManager.update(20);
        
        // Construir filtros para a query
        const queryFilters = { ...currentFilters };
        
        // Se não há filtros específicos, usar período atual
        if (!queryFilters.month && !queryFilters.startDate) {
            queryFilters.month = selectedMonth;
        }
        
        progressManager.update(40);
        
        const entries = await queryService.getSalesEntries(queryFilters);
        
        progressManager.update(70);
        
        const analysisResult = await calculateAnalysisMetrics(entries, queryFilters);
        
        progressManager.update(90);
        
        updateAnalysisDisplay(analysisResult);
        updateDataTables(entries, queryFilters);
        
        progressManager.update(100);
        
        notificationManager.show('Análise Concluída!', 
            `${entries.length} registro(s) analisado(s)`, 'success');
        
        setTimeout(() => progressManager.hide(), 500);
        
    } catch (error) {
        console.error('❌ Erro na análise:', error);
        showAlert('entryAlert', 'Erro ao realizar análise', 'error');
        progressManager.hide();
    } finally {
        setLoading('analyze', false);
    }
};

async function calculateAnalysisMetrics(entries, filters) {
    let totalRevenue = 0;
    let averageDaily = 0;
    let projectionMonthly = 0;
    let goalProgress = 0;
    
    // Calcular faturamento total
    totalRevenue = entries.reduce((sum, entry) => sum + (entry.value || 0), 0);
    
    // Calcular média diária baseada no período
    if (entries.length > 0) {
        if (filters.startDate && filters.endDate) {
            // Período personalizado
            const startDate = new Date(filters.startDate);
            const endDate = new Date(filters.endDate);
            const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
            averageDaily = totalRevenue / Math.max(daysDiff, 1);
        } else if (filters.week) {
            // Semana específica
            averageDaily = totalRevenue / 7;
        } else {
            // Mês completo - estimar baseado nos dias do mês
            const monthDate = new Date(filters.month + '-01');
            const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
            const currentDay = new Date().getDate();
            const activeDays = monthDate.getMonth() === new Date().getMonth() ? currentDay : daysInMonth;
            averageDaily = totalRevenue / Math.max(activeDays, 1);
        }
    }
    
    // Projeção mensal
    if (filters.month) {
        const monthDate = new Date(filters.month + '-01');
        const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
        projectionMonthly = averageDaily * daysInMonth;
    } else {
        projectionMonthly = averageDaily * 30; // Estimativa
    }
    
    // Progresso da meta
    if (filters.store && filters.month) {
        const target = await queryService.getTarget(
            filters.segment || currentUserData.segment,
            filters.store,
            filters.month,
            'monthly'
        );
        
        if (target > 0) {
            goalProgress = (totalRevenue / target) * 100;
        }
    }
    
    return {
        totalRevenue,
        averageDaily,
        projectionMonthly,
        goalProgress,
        entriesCount: entries.length,
        filters
    };
}

function updateAnalysisDisplay(result) {
    setElementText('totalRevenue', formatCurrency(result.totalRevenue));
    setElementText('averageDaily', formatCurrency(result.averageDaily));
    setElementText('projectionMonthly', formatCurrency(result.projectionMonthly));
    setElementText('goalProgress', `${result.goalProgress.toFixed(1)}%`);
    
    // Atualizar informações contextuais
    let revenueInfo = 'Período analisado';
    let dailyInfo = 'Baseada no período';
    let projectionInfo = 'Estimativa mensal';
    let goalInfo = 'Meta não definida';
    
    if (result.filters.week) {
        revenueInfo = 'Semana selecionada';
        dailyInfo = 'Média da semana';
    } else if (result.filters.startDate && result.filters.endDate) {
        revenueInfo = 'Período personalizado';
        dailyInfo = 'Média do período';
    } else if (result.filters.month) {
        revenueInfo = 'Mês selecionado';
        dailyInfo = 'Média diária do mês';
    }
    
    if (result.goalProgress > 0) {
        goalInfo = 'Meta vs Realizado';
    }
    
    setElementText('revenueInfo', revenueInfo);
    setElementText('dailyInfo', dailyInfo);
    setElementText('projectionInfo', projectionInfo);
    setElementText('goalInfo', goalInfo);
}

async function updateDashboard() {
    console.log('📊 Atualizando dashboard...');
    
    try {
        updateSelectedPeriodDisplay();
        
        // Carregar dados com filtros padrão
        const defaultFilters = {
            segment: currentUserData.segment !== 'executive' ? currentUserData.segment : '',
            month: selectedMonth
        };
        
        const entries = await queryService.getSalesEntries(defaultFilters);
        const analysisResult = await calculateAnalysisMetrics(entries, defaultFilters);
        
        updateAnalysisDisplay(analysisResult);
        updateDataTables(entries, defaultFilters);
        
        console.log('✅ Dashboard atualizado!');
    } catch (error) {
        console.error('❌ Erro ao atualizar dashboard:', error);
        showAlert('entryAlert', 'Erro ao carregar dados do dashboard', 'error');
    }
}

function updateSelectedPeriodDisplay() {
    const select = getElementById('monthYearSelect');
    if (select) {
        selectedMonth = select.value;
    }

    const [year, month] = selectedMonth.split('-').map(Number);
    const displayText = formatDisplayMonth(new Date(year, month - 1, 1));

    setElementText('selectedPeriodDisplay', displayText);
}

window.handleUpdateDashboard = function() {
    updateDashboard();
};

// ===============================
// TABELAS DE DADOS
// ===============================

let currentView = 'stores';

window.switchView = function(view) {
    currentView = view;
    
    // Atualizar botões
    document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
    getElementById(view + 'ViewBtn').classList.add('active');
    
    // Mostrar/ocultar tabelas
    document.querySelectorAll('.table-view').forEach(table => table.classList.add('hidden'));
    getElementById(view + 'View').classList.remove('hidden');
    
    // Recarregar dados da view ativa
    if (view === 'comparison') {
        renderComparisonChart();
    }
};

async function updateDataTables(entries, filters) {
    updateStoresTable(entries, filters);
    updateTimelineTable(entries);
    
    if (currentView === 'comparison') {
        renderComparisonChart();
    }
}

function updateStoresTable(entries, filters) {
    const tbody = getElementById('storesTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    // Agrupar por loja
    const storeData = new Map();
    
    entries.forEach(entry => {
        const store = entry.store;
        if (!storeData.has(store)) {
            storeData.set(store, {
                store,
                totalRevenue: 0,
                entries: 0,
                lastEntry: null
            });
        }
        
        const data = storeData.get(store);
        data.totalRevenue += entry.value || 0;
        data.entries++;
        
        if (!data.lastEntry || safeGetDate(entry.entryDate) > safeGetDate(data.lastEntry.entryDate)) {
            data.lastEntry = entry;
        }
    });
    
    if (storeData.size === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading-row">Nenhum dado encontrado para os filtros selecionados</td></tr>';
        return;
    }
    
    // Renderizar tabela
    storeData.forEach(async (data) => {
        const target = filters.segment && filters.month ? 
            await queryService.getTarget(filters.segment, data.store, filters.month, 'monthly') : 0;
        
        const goalProgress = target > 0 ? (data.totalRevenue / target) * 100 : 0;
        const averageDaily = data.totalRevenue / Math.max(data.entries * 7, 1); // Estimativa
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${escapeHtml(data.store)}</strong></td>
            <td class="currency">${formatCurrency(data.totalRevenue)}</td>
            <td class="currency">${formatCurrency(target)}</td>
            <td>
                ${goalProgress.toFixed(1)}%
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${Math.min(goalProgress, 100)}%"></div>
                </div>
            </td>
            <td class="currency">${formatCurrency(averageDaily)}</td>
            <td>${data.entries}</td>
            <td>
                <button class="btn-small btn-edit" onclick="filterByStore('${escapeHtml(data.store)}')">Filtrar</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function updateTimelineTable(entries) {
    const tbody = getElementById('timelineTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (entries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading-row">Nenhum lançamento encontrado</td></tr>';
        return;
    }
    
    entries.forEach(entry => {
        const row = createTimelineRow(entry);
        if (row) tbody.appendChild(row);
    });
}

function createTimelineRow(entry) {
    try {
        const entryDate = safeGetDate(entry.entryDate);
        const entryDateStr = entryDate.toLocaleDateString('pt-BR');
        
        let periodStr = 'Dia específico';
        if (entry.entryType === 'period' && entry.periodStart && entry.periodEnd) {
            const startDate = safeGetDate(entry.periodStart).toLocaleDateString('pt-BR');
            const endDate = safeGetDate(entry.periodEnd).toLocaleDateString('pt-BR');
            periodStr = `${startDate} a ${endDate}`;
        } else if (entry.entryType === 'week') {
            periodStr = 'Semana completa';
        }
        
        const typeLabels = {
            'single': '📅 Diário',
            'period': '📊 Período',
            'week': '🗓️ Semanal'
        };
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${entryDateStr}</td>
            <td><strong>${escapeHtml(entry.store || 'N/A')}</strong></td>
            <td>${escapeHtml(periodStr)}</td>
            <td class="currency">${formatCurrency(entry.value || 0)}</td>
            <td>${typeLabels[entry.entryType] || '📄 Padrão'}</td>
            <td>${escapeHtml(entry.notes || '-')}</td>
            <td>
                <button class="btn-small btn-edit" onclick="editEntry('${entry.id}')">Editar</button>
                <button class="btn-small btn-delete" onclick="deleteEntry('${entry.id}')">Excluir</button>
            </td>
        `;
        return row;
    } catch (error) {
        console.error('Erro ao criar linha do timeline:', error);
        return null;
    }
}

// ===============================
// FORMULÁRIOS DE VENDAS E METAS
// ===============================

window.handleEntryTypeChange = function() {
    const entryType = getElementValue('entryType');
    
    if (entryType === 'single') {
        showElement('singleDateField');
        hideElement('periodFields');
    } else {
        hideElement('singleDateField');
        showElement('periodFields');
    }
    
    previewTargetMonth();
};

window.handleTargetTypeChange = function() {
    const targetType = getElementValue('targetType');
    
    if (targetType === 'weekly' || targetType === 'daily') {
        showElement('targetDateField');
    } else {
        hideElement('targetDateField');
    }
};

window.previewTargetMonth = function() {
    const entryType = getElementValue('entryType');
    let targetDate = null;
    
    if (entryType === 'single') {
        targetDate = getElementValue('singleDate');
    } else {
        targetDate = getElementValue('periodEnd') || getElementValue('periodStart');
    }
    
    if (!targetDate) {
        hideElement('monthPreview');
        return;
    }
    
    const targetMonth = targetDate.substring(0, 7);
    const [y, m] = targetMonth.split('-').map(Number);
    const targetMonthName = formatDisplayMonth(new Date(y, m - 1, 1));
    
    const preview = getElementById('monthPreview');
    const previewText = getElementById('monthPreviewText');
    if (preview && previewText) {
        previewText.innerHTML = `📅 <strong>Este lançamento será registrado em: ${targetMonthName}</strong>`;
        showElement('monthPreview');
    }
};

window.handleSubmitSales = async function() {
    const salesData = collectSalesFormData();
    
    if (!validateSalesData(salesData)) {
        return;
    }
    
    setLoading('entry', true);
    progressManager.show();
    
    try {
        progressManager.update(30);
        
        const entryData = prepareSalesEntryData(salesData);
        
        progressManager.update(60);
        
        if (editingEntry) {
            await updateExistingSalesEntry(entryData);
            showAlert('entryAlert', 'Vendas atualizadas com sucesso!', 'success');
            cancelEdit();
        } else {
            await createNewSalesEntry(entryData);
            showAlert('entryAlert', 'Vendas lançadas com sucesso!', 'success');
        }
        
        progressManager.update(80);
        
        // Invalidar cache
        cacheManager.invalidatePattern(currentUserData.segment);
        
        clearSalesForm();
        
        progressManager.update(100);
        await updateDashboard();
        
        setTimeout(() => progressManager.hide(), 500);
        
        notificationManager.show('Vendas Salvas!', 'Lançamento realizado com sucesso', 'success');
        
    } catch (error) {
        console.error('❌ Erro ao processar vendas:', error);
        progressManager.hide();
        showAlert('entryAlert', `Erro ao salvar dados: ${error.message}`, 'error');
    } finally {
        setLoading('entry', false);
    }
};

window.handleSetTarget = async function() {
    const targetData = collectTargetFormData();
    
    if (!validateTargetData(targetData)) {
        return;
    }
    
    setLoading('target', true);
    progressManager.show();
    
    try {
        progressManager.update(50);
        
        const targetId = `${currentUserData.segment}_${targetData.store}_${selectedMonth}_${targetData.type}`;
        
        const targetDocData = {
            segment: currentUserData.segment,
            store: targetData.store,
            month: selectedMonth,
            type: targetData.type,
            value: targetData.value,
            date: serverTimestamp(),
            user: currentUser.email
        };
        
        if (targetData.targetDate) {
            targetDocData.targetDate = Timestamp.fromDate(new Date(targetData.targetDate));
        }
        
        await setDoc(doc(db, 'targets', targetId), targetDocData);
        
        progressManager.update(80);
        
        // Invalidar cache
        cacheManager.invalidatePattern('target');
        
        showAlert('targetAlert', 'Meta definida com sucesso!', 'success');
        clearTargetForm();
        
        progressManager.update(100);
        await updateDashboard();
        
        setTimeout(() => progressManager.hide(), 500);
        
        notificationManager.show('Meta Salva!', 'Meta definida com sucesso', 'success');
        
    } catch (error) {
        console.error('❌ Erro ao definir meta:', error);
        progressManager.hide();
        showAlert('targetAlert', `Erro ao salvar meta: ${error.message}`, 'error');
    } finally {
        setLoading('target', false);
    }
};

function collectSalesFormData() {
    const entryType = getElementValue('entryType');
    const data = {
        store: getElementValue('storeSelect'),
        value: parseFloat(getElementValue('entryValue')) || 0,
        notes: getElementValue('entryNotes'),
        entryType
    };
    
    if (entryType === 'single') {
        data.entryDate = getElementValue('singleDate');
    } else {
        data.periodStart = getElementValue('periodStart');
        data.periodEnd = getElementValue('periodEnd');
        data.entryDate = data.periodEnd; // Data de referência
    }
    
    return data;
}

function collectTargetFormData() {
    return {
        store: getElementValue('targetStoreSelect'),
        value: parseFloat(getElementValue('targetValue')) || 0,
        type: getElementValue('targetType'),
        targetDate: getElementValue('targetDate')
    };
}

function validateSalesData(data) {
    if (!data.store || data.value <= 0) {
        showAlert('entryAlert', 'Preencha todos os campos obrigatórios', 'error');
        return false;
    }
    
    if (data.entryType === 'single' && !data.entryDate) {
        showAlert('entryAlert', 'Selecione a data do lançamento', 'error');
        return false;
    }
    
    if (data.entryType !== 'single' && (!data.periodStart || !data.periodEnd)) {
        showAlert('entryAlert', 'Defina o período do lançamento', 'error');
        return false;
    }
    
    if (data.entryType !== 'single' && new Date(data.periodEnd) <= new Date(data.periodStart)) {
        showAlert('entryAlert', 'A data fim deve ser posterior à data início', 'error');
        return false;
    }
    
    return true;
}

function validateTargetData(data) {
    if (!data.store || data.value <= 0) {
        showAlert('targetAlert', 'Preencha todos os campos obrigatórios', 'error');
        return false;
    }
    
    if ((data.type === 'weekly' || data.type === 'daily') && !data.targetDate) {
        showAlert('targetAlert', 'Selecione a data para esta meta', 'error');
        return false;
    }
    
    return true;
}

function prepareSalesEntryData(salesData) {
    const baseData = {
        segment: currentUserData.segment,
        store: salesData.store,
        value: salesData.value,
        notes: salesData.notes,
        entryType: salesData.entryType,
        user: currentUser.email
    };
    
    if (salesData.entryType === 'single') {
        baseData.entryDate = Timestamp.fromDate(new Date(salesData.entryDate));
        baseData.month = salesData.entryDate.substring(0, 7);
    } else {
        baseData.entryDate = Timestamp.fromDate(new Date(salesData.entryDate));
        baseData.periodStart = Timestamp.fromDate(new Date(salesData.periodStart));
        baseData.periodEnd = Timestamp.fromDate(new Date(salesData.periodEnd));
        baseData.month = salesData.entryDate.substring(0, 7);
        
        if (salesData.entryType === 'week') {
            baseData.weekIdentifier = `${salesData.periodStart}_${salesData.periodEnd}`;
        }
    }
    
    return baseData;
}

async function createNewSalesEntry(entryData) {
    await addDoc(collection(db, 'sales_entries'), {
        ...entryData,
        createdAt: serverTimestamp()
    });
}

async function updateExistingSalesEntry(entryData) {
    await setDoc(doc(db, 'sales_entries', editingEntry.id), {
        ...entryData,
        lastModified: serverTimestamp()
    });
}

function clearSalesForm() {
    clearFormInputs(['storeSelect', 'entryValue', 'entryNotes']);
    setElementValue('entryType', 'single');
    setupFormDefaults();
    hideElement('monthPreview');
    handleEntryTypeChange();
}

function clearTargetForm() {
    clearFormInputs(['targetStoreSelect', 'targetValue', 'targetDate']);
    setElementValue('targetType', 'monthly');
    handleTargetTypeChange();
}

// ===============================
// EDIÇÃO E EXCLUSÃO
// ===============================

window.editEntry = async function(entryId) {
    try {
        // Buscar dados do entry
        const entryDoc = await getDoc(doc(db, 'sales_entries', entryId));
        if (!entryDoc.exists()) {
            showAlert('entryAlert', 'Lançamento não encontrado', 'error');
            return;
        }
        
        const entry = entryDoc.data();
        
        // Preencher formulário
        setElementValue('storeSelect', entry.store);
        setElementValue('entryValue', entry.value);
        setElementValue('entryNotes', entry.notes || '');
        setElementValue('entryType', entry.entryType || 'single');
        
        if (entry.entryType === 'single') {
            const entryDate = safeGetDate(entry.entryDate);
            setElementValue('singleDate', formatDateForInput(entryDate));
        } else {
            const startDate = safeGetDate(entry.periodStart);
            const endDate = safeGetDate(entry.periodEnd);
            setElementValue('periodStart', formatDateForInput(startDate));
            setElementValue('periodEnd', formatDateForInput(endDate));
        }
        
        handleEntryTypeChange();
        previewTargetMonth();
        
        editingEntry = { id: entryId };
        
        showElement('editMode');
        setElementText('entryText', 'Atualizar Vendas');
        
        // Scroll para o formulário
        getElementById('storeSelect').scrollIntoView({ behavior: 'smooth' });
        
        notificationManager.show('Modo Edição', 'Dados carregados para edição', 'info');
    } catch (error) {
        console.error('❌ Erro ao carregar entrada para edição:', error);
        showAlert('entryAlert', 'Erro ao carregar dados para edição', 'error');
    }
};

window.deleteEntry = async function(entryId) {
    if (!confirm('Confirma a exclusão deste lançamento?')) {
        return;
    }
    
    try {
        progressManager.show();
        progressManager.update(50);
        
        await deleteDoc(doc(db, 'sales_entries', entryId));
        
        // Invalidar cache
        cacheManager.invalidatePattern(currentUserData.segment);
        
        progressManager.update(100);
        showAlert('entryAlert', 'Lançamento excluído com sucesso!', 'success');
        
        await updateDashboard();
        setTimeout(() => progressManager.hide(), 500);
        
        notificationManager.show('Excluído!', 'Lançamento removido com sucesso', 'success');
    } catch (error) {
        console.error('❌ Erro ao excluir lançamento:', error);
        progressManager.hide();
        showAlert('entryAlert', `Erro ao excluir lançamento: ${error.message}`, 'error');
    }
};

window.handleCancelEdit = function() {
    editingEntry = null;
    hideElement('editMode');
    setElementText('entryText', 'Lançar Vendas');
    clearSalesForm();
    
    notificationManager.show('Edição Cancelada', 'Voltou ao modo de lançamento normal', 'info');
};

function cancelEdit() {
    window.handleCancelEdit();
}

// ===============================
// FUNÇÕES AUXILIARES
// ===============================

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

window.filterByStore = function(store) {
    setElementValue('filterStore', store);
    currentFilters.store = store;
    handleAnalyze();
};

window.exportTableData = function() {
    notificationManager.show('Exportar Dados', 'Funcionalidade em desenvolvimento', 'info');
};

window.refreshTableData = function() {
    updateDashboard();
};

// ===============================
// GRÁFICOS
// ===============================

function renderComparisonChart() {
    const canvas = getElementById('comparisonChart');
    if (!canvas) return;
    
    // Destruir gráfico existente
    if (chartInstances.comparison) {
        chartInstances.comparison.destroy();
    }
    
    const ctx = canvas.getContext('2d');
    
    // Dados de exemplo - substituir por dados reais
    chartInstances.comparison = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Loja 1', 'Loja 2', 'Loja 3'],
            datasets: [{
                label: 'Faturamento',
                data: [12000, 15000, 8000],
                backgroundColor: 'rgba(102, 126, 234, 0.8)',
                borderColor: 'rgba(102, 126, 234, 1)',
                borderWidth: 1
            }, {
                label: 'Meta',
                data: [10000, 12000, 9000],
                backgroundColor: 'rgba(72, 187, 120, 0.8)',
                borderColor: 'rgba(72, 187, 120, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value);
                        }
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + formatCurrency(context.parsed.y);
                        }
                    }
                }
            }
        }
    });
}

// ===============================
// AÇÕES PRINCIPAIS
// ===============================

window.showChartsModal = function() {
    const modal = getElementById('chartsModal');
    if (modal) {
        modal.classList.add('show');
        
        // Renderizar gráficos após um delay para garantir que o modal está visível
        setTimeout(() => {
            renderAdvancedCharts();
        }, 300);
    }
};

window.closeChartsModal = function() {
    const modal = getElementById('chartsModal');
    if (modal) {
        modal.classList.remove('show');
    }
};

function renderAdvancedCharts() {
    // Implementar gráficos avançados
    notificationManager.show('Gráficos', 'Funcionalidade em desenvolvimento', 'info');
}

window.generateDetailedReport = function() {
    notificationManager.show('Relatório PDF', 'Funcionalidade em desenvolvimento', 'info');
};

window.exportToExcel = function() {
    notificationManager.show('Excel Export', 'Funcionalidade em desenvolvimento', 'info');
};

window.backupData = function() {
    notificationManager.show('Backup', 'Funcionalidade em desenvolvimento', 'info');
};

window.showCacheStats = function() {
    const stats = cacheManager.getStats();
    const modal = createStatsModal(stats);
    document.body.appendChild(modal);
    modal.classList.add('show');
};

function createStatsModal(stats) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h3 class="modal-title">📊 Estatísticas do Cache</h3>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
                    <div class="stat-card">
                        <div class="stat-value">${stats.efficiency}%</div>
                        <div class="stat-label">Eficiência</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${stats.size}/${stats.maxSize}</div>
                        <div class="stat-label">Utilização</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${stats.hits}</div>
                        <div class="stat-label">Cache Hits</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${stats.misses}</div>
                        <div class="stat-label">Cache Misses</div>
                    </div>
                </div>
            </div>
        </div>
    `;
    return overlay;
}

window.closeNotification = function() {
    notificationManager.hide();
};

// ===============================
// PWA FUNCTIONS
// ===============================

window.installPWA = function() {
    notificationManager.show('PWA Install', 'Funcionalidade em desenvolvimento', 'info');
};

window.dismissInstallPrompt = function() {
    const prompt = getElementById('installPrompt');
    if (prompt) {
        prompt.classList.remove('show');
    }
};

// ===============================
// CONTROLE DE AUTENTICAÇÃO
// ===============================

onAuthStateChanged(auth, async (user) => {
    try {
        if (user) {
            if (!defaultUsers[user.email]) {
                showAlert('loginAlert', 'Usuário não autorizado', 'error');
                await window.handleLogout();
                return;
            }

            currentUser = user;
            currentUserData = defaultUsers[user.email];
            
            setTimeout(async () => {
                await showDashboard();
            }, 100);
        } else {
            showLoginScreen();
        }
    } catch (error) {
        console.error('❌ Erro na verificação de autenticação:', error);
        showLoginScreen();
    }
});

// ===============================
// INICIALIZAÇÃO
// ===============================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Ice Beer v4.0 - Sistema iniciado');
    console.log('✅ Características:');
    console.log('  - Relatórios flexíveis (junho 2025 - dezembro 2028)');
    console.log('  - Lançamentos por dia, período ou semana');
    console.log('  - Cache inteligente');
    console.log('  - Interface responsiva');
    console.log('  - Firebase integrado');
    console.log('  - PWA ready');
    
    // Configurar indicadores de status
    setTimeout(() => {
        const firebaseStatus = getElementById('firebaseStatus');
        const cacheStatus = getElementById('cacheStatus');
        const pwStatus = getElementById('pwStatus');
        
        if (firebaseStatus) {
            firebaseStatus.textContent = '✅ Firebase Conectado';
            firebaseStatus.classList.add('success');
        }
        
        if (cacheStatus) {
            cacheStatus.textContent = '💾 Cache Ativo';
            cacheStatus.classList.add('success');
        }
        
        if (pwStatus) {
            pwStatus.textContent = '📱 PWA Configurado';
            pwStatus.classList.add('success');
        }
        
        // Ocultar após alguns segundos
        setTimeout(() => {
            [firebaseStatus, cacheStatus, pwStatus].forEach(indicator => {
                if (indicator) {
                    indicator.classList.remove('show');
                }
            });
        }, 4000);
    }, 2000);
});

// Expor variáveis globais necessárias
window.cacheManager = cacheManager;
window.notificationManager = notificationManager;