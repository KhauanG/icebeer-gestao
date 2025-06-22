// ===============================
// 🔥 ICE BEER v4.0 - SISTEMA COMPLETO CORRIGIDO
// Firebase Integrado + Cache Otimizado + Bug Fixes
// ===============================

// ===============================
// IMPORTS FIREBASE
// ===============================

const firebaseConfig = {
    apiKey: "AIzaSyBoHkstIa6rDJ1n3DvfwYVYBGfRSIjF_V0",
    authDomain: "gestao-ice-beer.firebaseapp.com",
    projectId: "gestao-ice-beer",
    storageBucket: "gestao-ice-beer.firebasestorage.app",
    messagingSenderId: "975617921156",
    appId: "1:975617921156:web:7c422066760da8178f32d1",
    measurementId: "G-1CY31TG5YM"
};

// Variáveis globais para Firebase
let app, auth, db;
let isFirebaseInitialized = false;

// ===============================
// INICIALIZAÇÃO FIREBASE
// ===============================

async function initializeFirebase() {
    try {
        if (isFirebaseInitialized) return { app, auth, db };

        console.log('🔥 Inicializando Firebase...');
        
        // Carregar módulos Firebase dinamicamente
        const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
        const { 
            getAuth, 
            signInWithEmailAndPassword, 
            signOut, 
            onAuthStateChanged 
        } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
        const { 
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
            Timestamp,
            updateDoc
        } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');

        // Inicializar Firebase
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);

        // Expor globalmente
        window.firebase = {
            app, auth, db,
            signInWithEmailAndPassword,
            signOut,
            onAuthStateChanged,
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
            Timestamp,
            updateDoc
        };

        isFirebaseInitialized = true;
        console.log('✅ Firebase inicializado com sucesso!');
        
        return { app, auth, db };
    } catch (error) {
        console.error('❌ Erro ao inicializar Firebase:', error);
        showError('Erro ao conectar com Firebase. Verifique sua conexão.');
        throw error;
    }
}

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
    weekIdentifier: ''
};

let chartInstances = {};

// ===============================
// CLASSES DE GERENCIAMENTO
// ===============================

class CacheManager {
    constructor() {
        this.cache = new Map();
        this.stats = { hits: 0, misses: 0, sets: 0, errors: 0 };
        this.config = { maxSize: 100, ttl: 5 * 60 * 1000 };
        this.setupMaintenance();
    }

    setupMaintenance() {
        setInterval(() => this.performMaintenance(), 30000);
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

    // Método melhorado para invalidação de cache
    invalidatePattern(pattern) {
        const keys = Array.from(this.cache.keys()).filter(key => key.includes(pattern));
        keys.forEach(key => this.cache.delete(key));
        console.log(`Cache invalidated: ${keys.length} entries matching "${pattern}"`);
    }

    // Novo método para invalidar cache relacionado a um segmento específico
    invalidateSegmentCache(segment) {
        // Invalida todas as entradas relacionadas ao segmento
        this.invalidatePattern(`"segment":"${segment}"`);
        this.invalidatePattern(`weeks_${segment}`);
        this.invalidatePattern(`target_${segment}`);
        console.log(`Cache do segmento ${segment} invalidado`);
    }

    // Novo método para invalidar cache de um mês específico
    invalidateMonthCache(month) {
        this.invalidatePattern(`"month":"${month}"`);
        this.invalidatePattern(`_${month}_`);
        console.log(`Cache do mês ${month} invalidado`);
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
    /* 1️⃣  ── Pula o cache se veio a flag _noCache ─ */
    const useCache = !filters._noCache;

    const cacheKey = this.createCacheKey('sales', filters);

    /* 2️⃣  ── Tenta ler do cache ──────────────────── */
    if (useCache) {
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        console.log('📊 Dados obtidos do cache:', cacheKey);
        return cached;
      }
    }

    /* 3️⃣  ── Consulta no Firestore ───────────────── */
    try {
      const { collection, query, where, orderBy, limit, getDocs } = window.firebase;
      const baseQuery   = collection(db, 'sales_entries');
      const constraints = [];

      // SEGMENTO
      if (currentUserData.segment !== 'executive') {
        constraints.push(where('segment', '==', currentUserData.segment));
      } else if (filters.segment) {
        constraints.push(where('segment', '==', filters.segment));
      }

      // LOJA
      if (filters.store) {
        constraints.push(where('store', '==', filters.store));
      }

      // MÊS
      if (filters.month) {
        constraints.push(where('month', '==', filters.month));
      }

      // INTERVALO DE DATAS
      if (filters.startDate && filters.endDate) {
        const startTS = window.firebase.Timestamp.fromDate(new Date(filters.startDate));
        const endTS   = window.firebase.Timestamp.fromDate(new Date(filters.endDate + 'T23:59:59'));
        constraints.push(where('entryDate', '>=', startTS));
        constraints.push(where('entryDate', '<=', endTS));
      }

      // SEMANA
      if (filters.weekIdentifier) {
        constraints.push(where('weekIdentifier', '==', filters.weekIdentifier));
      }

      constraints.push(orderBy('entryDate', 'desc'));
      constraints.push(limit(200));

      const salesQuery = query(baseQuery, ...constraints);
      const snapshot   = await getDocs(salesQuery);

      const entries = [];
      snapshot.forEach(docRef => entries.push({ id: docRef.id, ...docRef.data() }));

      /* 4️⃣  ── Grava no cache, se permitido ──────── */
      if (useCache) {
        await this.cache.set(cacheKey, entries);
      }

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
            const { doc, getDoc } = window.firebase;
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
        if (cached && cached.length > 0) {
            return cached;
        }

        try {
            // Buscar apenas entradas do tipo 'week' para o segmento e mês
            const entries = await this.getSalesEntries({ 
                segment, 
                month,
                // Não usar cache para esta consulta interna
                _noCache: true 
            });
            
            const weeks = new Map();
            
            entries.forEach(entry => {
                if (entry.weekIdentifier && entry.entryType === 'week') {
                    const startDate = entry.periodStart ? safeGetDate(entry.periodStart) : null;
                    const endDate = entry.periodEnd ? safeGetDate(entry.periodEnd) : null;
                    
                    if (startDate && endDate) {
                        const weekLabel = `${formatDateBR(startDate)} a ${formatDateBR(endDate)}`;
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
            if (result.length > 0) {
                await this.cache.set(cacheKey, result);
            }
            return result;
        } catch (error) {
            console.error('❌ Erro ao buscar semanas:', error);
            return [];
        }
    }

    // Método auxiliar para criar chaves de cache consistentes
    createCacheKey(prefix, filters) {
        const cleanFilters = {};
        Object.keys(filters).forEach(key => {
            if (filters[key] && key !== '_noCache') {
                cleanFilters[key] = filters[key];
            }
        });
        return `${prefix}_${JSON.stringify(cleanFilters)}`;
    }
}

// ===============================
// INSTÂNCIAS GLOBAIS
// ===============================

const cacheManager = new CacheManager();
const notificationManager = new NotificationManager();
const progressManager = new ProgressManager();
const queryService = new QueryService(cacheManager);

// Expor globalmente para debug
window.queryService = queryService;
window.cacheManager = cacheManager;

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

function formatDateBR(date) {
    // Formata data para DD/MM/AAAA com GMT-3
    const options = { 
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    };
    return date.toLocaleDateString('pt-BR', options);
}

function formatDateForInput(date) {
    // Ajusta para GMT-3 antes de formatar
    const adjusted = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
    return adjusted.toISOString().split('T')[0];
}

function safeGetDate(value) {
    if (!value) return null;
    if (value.toDate) return value.toDate();
    if (value instanceof Date) return value;
    if (typeof value === 'string' && value.length >= 8) {
        const d = new Date(value);
        return isNaN(d) ? null : d;
    }
    return null;
}

function getUserSegment(email) {
    const userSegments = {
        'conveniencias@icebeer.com': 'conveniencias',
        'petiscarias@icebeer.com': 'petiscarias',
        'diskchopp@icebeer.com': 'diskchopp',
        'executivo@icebeer.com': 'executive'
    };
    return userSegments[email] || null;
}

function getFirstStoreForSegment(segment) {
    const stores = {
        'conveniencias': 'Loja 1',
        'petiscarias': 'Loja 1', 
        'diskchopp': 'Delivery'
    };
    return stores[segment] || 'Loja 1';
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

function showError(message) {
    notificationManager.show('Erro', message, 'error');
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
        await initializeFirebase();
        await window.firebase.signInWithEmailAndPassword(auth, email, password);
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
        // Limpar completamente o cache ao fazer logout
        cacheManager.clear();
        
        if (auth) {
            await window.firebase.signOut(auth);
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
    // Resetar filtros ao mostrar dashboard
    currentFilters = {
        segment: (currentUserData.segment !== 'executive') ? currentUserData.segment : '',
        store: '',
        month: selectedMonth,
        period: '',
        startDate: '',
        endDate: '',
        weekIdentifier: ''
    };
    
    // Limpar elementos de filtro
    hideElement('weekFilter');
    hideElement('customDateRange');
    
    const filterWeek = getElementById('filterWeek');
    if (filterWeek) {
        filterWeek.innerHTML = '<option value="">Todas as semanas</option>';
    }
    
    getElementById('loginScreen').style.display = 'none';
    getElementById('dashboard').style.display = 'block';
    
    setElementText('welcomeText', `Bem-vindo, ${currentUserData.name}`);
    setElementText('currentDate', formatDateBR(new Date()));
    
    try {
        setupMonthYearSelector();
        setupFiltersPanel();
        setupFormDefaults();
        await loadStoresData();
        await checkAndInitializeData();
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
    
    const startDate = new Date(2025, 5, 1);
    const endDate = new Date(2028, 11, 31);
    
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
        }
        
        select.appendChild(option);
    });
}

function setupFiltersPanel() {
    const filterSegment = getElementById('filterSegment');
    if (filterSegment) {
        filterSegment.innerHTML = '<option value="">Todos os segmentos</option>';
        
        // Se não for executivo, esconde o seletor de segmento
        if (currentUserData.segment !== 'executive') {
            filterSegment.parentElement.style.display = 'none';
            currentFilters.segment = currentUserData.segment;
        } else {
            filterSegment.parentElement.style.display = 'block';
            Object.keys(businessData).forEach(segment => {
                const option = document.createElement('option');
                option.value = segment;
                option.textContent = businessData[segment].name;
                filterSegment.appendChild(option);
            });
        }
        
        if (currentFilters.segment) {
            setTimeout(() => {
                updateDependentFilters();
            }, 100);
        }
    }
    
    const filterMonth = getElementById('filterMonth');
    if (filterMonth) {
        populateMonthFilter(filterMonth);
    }
}

function populateMonthFilter(filterMonth) {
    filterMonth.innerHTML = '<option value="">Selecione um mês</option>';
    
    const startDate = new Date(2025, 5, 1);
    const endDate = new Date(2028, 11, 31);
    
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
    const today = formatDateForInput(new Date());
    setElementValue('singleDate', today);
    
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
        Object.keys(businessData).forEach(segmentKey => {
            const segment = businessData[segmentKey];
            stores = [...stores, ...segment.stores.map(store => ({
                display: `${segment.name} - ${store}`,
                value: store,
                segment: segmentKey
            }))];
        });
    } else {
        stores = businessData[userSegment]?.stores.map(store => ({
            display: store,
            value: store,
            segment: userSegment
        })) || [];
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
                option.value = store.value;
                option.textContent = store.display;
                option.dataset.segment = store.segment;
                select.appendChild(option);
            });
        }
    });
}

// ===============================
// AUTO-INICIALIZAÇÃO DE DADOS
// ===============================

async function checkAndInitializeData() {
    try {
        // Verificar se já existem dados iniciais
        const { collection, query, limit, getDocs } = window.firebase;
        const checkQuery = query(collection(db, 'initialization'), limit(1));
        const snapshot = await getDocs(checkQuery);
        
        if (snapshot.empty) {
            console.log('🤖 Sistema não inicializado. Criando estrutura inicial...');
            await initializeSystemData();
        } else {
            console.log('✅ Sistema já inicializado');
        }
    } catch (error) {
        console.error('❌ Erro ao verificar inicialização:', error);
    }
}

async function initializeSystemData() {
    try {
        progressManager.show();
        progressManager.update(10);
        
        // Marcar sistema como inicializado
        await window.firebase.setDoc(window.firebase.doc(db, 'initialization', 'system'), {
            initialized: true,
            date: window.firebase.serverTimestamp(),
            version: '4.0'
        });
        
        progressManager.update(30);
        
        // Criar configurações padrão
        await createDefaultSettings();
        
        progressManager.update(50);
        
        // Criar metas iniciais para o mês atual
        await createInitialTargets();
        
        progressManager.update(70);
        
        // Criar alguns dados de exemplo
        await createSampleSalesData();
        
        progressManager.update(100);
        
        notificationManager.show('Sistema Inicializado', 'Estrutura inicial criada com sucesso!', 'success');
        
        setTimeout(() => progressManager.hide(), 500);
    } catch (error) {
        console.error('❌ Erro na inicialização:', error);
        progressManager.hide();
    }
}

async function createDefaultSettings() {
    const settings = {
        businessHours: { open: '08:00', close: '22:00' },
        currency: 'BRL',
        timezone: 'America/Sao_Paulo',
        lastUpdate: window.firebase.serverTimestamp()
    };
    
    await window.firebase.setDoc(window.firebase.doc(db, 'system_settings', 'defaults'), settings);
}

async function createInitialTargets() {
    const currentMonth = getCurrentMonth();
    const targets = [
        { segment: 'conveniencias', store: 'Loja 1', value: 50000 },
        { segment: 'conveniencias', store: 'Loja 2', value: 45000 },
        { segment: 'conveniencias', store: 'Loja 3', value: 40000 },
        { segment: 'petiscarias', store: 'Loja 1', value: 35000 },
        { segment: 'petiscarias', store: 'Loja 2', value: 30000 },
        { segment: 'diskchopp', store: 'Delivery', value: 60000 }
    ];
    
    for (const target of targets) {
        const targetId = `${target.segment}_${target.store}_${currentMonth}_monthly`;
        await window.firebase.setDoc(window.firebase.doc(db, 'targets', targetId), {
            ...target,
            month: currentMonth,
            type: 'monthly',
            date: window.firebase.serverTimestamp(),
            user: currentUser.email
        });
    }
}

async function createSampleSalesData() {
    const today = new Date();
    const samples = [];
    
    // Criar dados para os últimos 7 dias
    for (let i = 0; i < 7; i++) {
        const sampleDate = new Date(today);
        sampleDate.setDate(today.getDate() - i);
        
        if (currentUserData.segment === 'conveniencias' || currentUserData.segment === 'executive') {
            samples.push({
                segment: 'conveniencias',
                store: 'Loja 1',
                value: 1500 + Math.random() * 1000,
                entryDate: window.firebase.Timestamp.fromDate(sampleDate),
                month: formatMonthYear(sampleDate),
                entryType: 'single',
                user: currentUser.email,
                createdAt: window.firebase.serverTimestamp()
            });
        }
        
        if (currentUserData.segment === 'petiscarias' || currentUserData.segment === 'executive') {
            samples.push({
                segment: 'petiscarias',
                store: 'Loja 1',
                value: 1200 + Math.random() * 800,
                entryDate: window.firebase.Timestamp.fromDate(sampleDate),
                month: formatMonthYear(sampleDate),
                entryType: 'single',
                user: currentUser.email,
                createdAt: window.firebase.serverTimestamp()
            });
        }
        
        if (currentUserData.segment === 'diskchopp' || currentUserData.segment === 'executive') {
            samples.push({
                segment: 'diskchopp',
                store: 'Delivery',
                value: 2000 + Math.random() * 1500,
                entryDate: window.firebase.Timestamp.fromDate(sampleDate),
                month: formatMonthYear(sampleDate),
                entryType: 'single',
                user: currentUser.email,
                createdAt: window.firebase.serverTimestamp()
            });
        }
    }
    
    // Salvar todos os dados de exemplo
    for (const sample of samples) {
        await window.firebase.addDoc(window.firebase.collection(db, 'sales_entries'), sample);
    }
}

// ===============================
// DASHBOARD E ANÁLISE
// ===============================

window.handleAnalyze = async function() {
    console.log('📊 Iniciando análise com filtros:', currentFilters);
    
    setLoading('analyze', true);
    progressManager.show();
    
    try {
        progressManager.update(20);
        
        const queryFilters = { ...currentFilters };
        
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
    
    totalRevenue = entries.reduce((sum, entry) => sum + (entry.value || 0), 0);
    
    if (entries.length > 0) {
        if (filters.startDate && filters.endDate) {
            const startDate = new Date(filters.startDate);
            const endDate = new Date(filters.endDate);
            const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
            averageDaily = totalRevenue / Math.max(daysDiff, 1);
        } else if (filters.weekIdentifier) {
            averageDaily = totalRevenue / 7;
        } else {
            const monthDate = new Date(filters.month + '-01');
            const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
            const currentDay = new Date().getDate();
            const activeDays = monthDate.getMonth() === new Date().getMonth() ? currentDay : daysInMonth;
            averageDaily = totalRevenue / Math.max(activeDays, 1);
        }
    }
    
    if (filters.month) {
        const monthDate = new Date(filters.month + '-01');
        const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
        projectionMonthly = averageDaily * daysInMonth;
    } else {
        projectionMonthly = averageDaily * 30;
    }
    
    if (filters.store && filters.month) {
        const segment = filters.segment || currentUserData.segment;
        const target = await queryService.getTarget(segment, filters.store, filters.month, 'monthly');
        
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
    
    let revenueInfo = 'Período analisado';
    let dailyInfo = 'Baseada no período';
    let projectionInfo = 'Estimativa mensal';
    let goalInfo = 'Meta não definida';
    
    if (result.filters.weekIdentifier) {
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
    
    document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
    getElementById(view + 'ViewBtn').classList.add('active');
    
    document.querySelectorAll('.table-view').forEach(table => table.classList.add('hidden'));
    getElementById(view + 'View').classList.remove('hidden');
    
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

async function updateStoresTable(entries, filters) {
    const tbody = getElementById('storesTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    const storeData = new Map();
    
    entries.forEach(entry => {
        const store = entry.store;
        if (!storeData.has(store)) {
            storeData.set(store, {
                store,
                segment: entry.segment,
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
    
    for (const [store, data] of storeData) {
        const segment = data.segment || filters.segment || currentUserData.segment;
        const target = filters.month ? 
            await queryService.getTarget(segment, data.store, filters.month, 'monthly') : 0;
        
        const goalProgress = target > 0 ? (data.totalRevenue / target) * 100 : 0;
        const averageDaily = data.totalRevenue / Math.max(data.entries, 1);
        
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
    }
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
        const entryDateStr = entryDate ? formatDateBR(entryDate) : '—';
        
        let periodStr = 'Dia específico';
        if (entry.entryType === 'period' && entry.periodStart && entry.periodEnd) {
            const startDate = safeGetDate(entry.periodStart);
            const endDate = safeGetDate(entry.periodEnd);
            periodStr = `${formatDateBR(startDate)} a ${formatDateBR(endDate)}`;
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
// HANDLERS
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
    currentFilters.weekIdentifier = '';
    
    // Limpar o seletor de semanas
    const filterWeek = getElementById('filterWeek');
    if (filterWeek) {
        filterWeek.innerHTML = '<option value="">Todas as semanas</option>';
    }
    
    // Se semana está visível e temos segmento e mês, atualizar
    if (currentFilters.period === 'week' && currentFilters.segment && currentFilters.month) {
        await updateWeeksFilter();
    }
};

window.handlePeriodChange = function() {
    const period = getElementValue('filterPeriod');
    currentFilters.period = period;
    
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
    currentFilters.weekIdentifier = getElementValue('filterWeek');
};

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

// ===============================
// FUNÇÕES AUXILIARES
// ===============================

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
    currentFilters.weekIdentifier = '';
    
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
    currentFilters.weekIdentifier = '';
    setElementValue('startDate', '');
    setElementValue('endDate', '');
    setElementValue('filterWeek', '');
}

window.clearFilters = function() {
    Object.keys(currentFilters).forEach(key => {
        if (key !== 'segment' && currentUserData.segment !== 'executive') {
            currentFilters[key] = '';
        } else if (currentUserData.segment === 'executive') {
            currentFilters[key] = '';
        }
    });
    
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
    
    hideElement('weekFilter');
    hideElement('customDateRange');
    
    notificationManager.show('Filtros Limpos', 'Todos os filtros foram resetados', 'info');
};

window.filterByStore = function(store) {
    setElementValue('filterStore', store);
    currentFilters.store = store;
    handleAnalyze();
};

window.refreshTableData = function() {
    updateDashboard();
};

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===============================
// VENDAS E METAS
// ===============================

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
        
        // Invalidar cache de forma mais inteligente
        cacheManager.invalidateSegmentCache(entryData.segment);
        cacheManager.invalidateMonthCache(entryData.month);
        
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
        
        const segment = currentUserData.segment !== 'executive' ? 
            currentUserData.segment : 
            (getElementById('targetStoreSelect').selectedOptions[0]?.dataset.segment || currentUserData.segment);
        
        const targetId = `${segment}_${targetData.store}_${selectedMonth}_${targetData.type}`;
        
        const targetDocData = {
            segment: segment,
            store: targetData.store,
            month: selectedMonth,
            type: targetData.type,
            value: targetData.value,
            date: window.firebase.serverTimestamp(),
            user: currentUser.email
        };
        
        if (targetData.targetDate) {
            targetDocData.targetDate = window.firebase.Timestamp.fromDate(new Date(targetData.targetDate));
        }
        
        await window.firebase.setDoc(window.firebase.doc(db, 'targets', targetId), targetDocData);
        
        progressManager.update(80);
        
        // Invalidar cache de targets
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
        data.entryDate = data.periodEnd;
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
    const segment = currentUserData.segment !== 'executive' ? 
        currentUserData.segment : 
        (getElementById('storeSelect').selectedOptions[0]?.dataset.segment || currentUserData.segment);
    
    const baseData = {
        segment: segment,
        store: salesData.store,
        value: salesData.value,
        notes: salesData.notes,
        entryType: salesData.entryType,
        user: currentUser.email
    };
    
    if (salesData.entryType === 'single') {
        baseData.entryDate = window.firebase.Timestamp.fromDate(new Date(salesData.entryDate));
        baseData.month = salesData.entryDate.substring(0, 7);
    } else {
        baseData.entryDate = window.firebase.Timestamp.fromDate(new Date(salesData.entryDate));
        baseData.periodStart = window.firebase.Timestamp.fromDate(new Date(salesData.periodStart));
        baseData.periodEnd = window.firebase.Timestamp.fromDate(new Date(salesData.periodEnd));
        baseData.month = salesData.entryDate.substring(0, 7);
        
        if (salesData.entryType === 'week') {
            baseData.weekIdentifier = `${salesData.periodStart}_${salesData.periodEnd}`;
        }
    }
    
    return baseData;
}

async function createNewSalesEntry(entryData) {
    await window.firebase.addDoc(window.firebase.collection(db, 'sales_entries'), {
        ...entryData,
        createdAt: window.firebase.serverTimestamp()
    });
}

async function updateExistingSalesEntry(entryData) {
    await window.firebase.setDoc(window.firebase.doc(db, 'sales_entries', editingEntry.id), {
        ...entryData,
        lastModified: window.firebase.serverTimestamp()
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
        const entryDoc = await window.firebase.getDoc(window.firebase.doc(db, 'sales_entries', entryId));
        if (!entryDoc.exists()) {
            showAlert('entryAlert', 'Lançamento não encontrado', 'error');
            return;
        }
        
        const entry = entryDoc.data();
        
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
        progressManager.update(40);

        // Buscar o documento para obter informações antes de deletar
        const docRef = window.firebase.doc(db, 'sales_entries', entryId);
        const docSnap = await window.firebase.getDoc(docRef);
        
        let segment = currentUserData.segment;
        let month = selectedMonth;
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            segment = data.segment || segment;
            month = data.month || month;
        }

        // Deletar o documento
        await window.firebase.deleteDoc(docRef);

        // Invalidar cache de forma inteligente
        cacheManager.invalidateSegmentCache(segment);
        cacheManager.invalidateMonthCache(month);

        progressManager.update(100);
        showAlert('entryAlert', 'Lançamento excluído com sucesso!', 'success');

        await updateDashboard();
    } catch (error) {
        console.error('❌ Erro ao excluir lançamento:', error);
        showAlert('entryAlert', `Erro ao excluir lançamento: ${error.message}`, 'error');
    } finally {
        progressManager.hide();
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
// GRÁFICOS
// ===============================

function renderComparisonChart() {
    const canvas = getElementById('comparisonChart');
    if (!canvas || !window.Chart) return;
    
    if (chartInstances.comparison) {
        chartInstances.comparison.destroy();
    }
    
    const ctx = canvas.getContext('2d');
    
    // Coletar dados atuais da tabela
    const labels = [];
    const revenues = [];
    const targets = [];
    
    const rows = document.querySelectorAll('#storesTableBody tr');
    rows.forEach(row => {
        const cells = row.cells;
        if (cells.length >= 3) {
            labels.push(cells[0].textContent.trim());
            
            const revenueText = cells[1].textContent.replace(/[^\d,]/g, '').replace(',', '.');
            revenues.push(parseFloat(revenueText) || 0);
            
            const targetText = cells[2].textContent.replace(/[^\d,]/g, '').replace(',', '.');
            targets.push(parseFloat(targetText) || 0);
        }
    });
    
    chartInstances.comparison = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Faturamento',
                data: revenues,
                backgroundColor: 'rgba(102, 126, 234, 0.8)',
                borderColor: 'rgba(102, 126, 234, 1)',
                borderWidth: 1
            }, {
                label: 'Meta',
                data: targets,
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
// RELATÓRIOS FUNCIONAIS
// ===============================

window.showSalesReport = async function() {
    const modal = getElementById('reportModal');
    const content = getElementById('reportContent');
    
    if (!modal || !content) return;
    
    content.innerHTML = '<div class="loading-row">Gerando relatório de vendas...</div>';
    modal.classList.add('show');
    
    try {
        const entries = await queryService.getSalesEntries({
            segment: currentUserData.segment !== 'executive' ? currentUserData.segment : '',
            month: selectedMonth
        });
        
        let html = `
            <h4>📊 Relatório de Vendas - ${formatDisplayMonth(new Date(selectedMonth + '-01'))}</h4>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Data</th>
                        <th>Loja</th>
                        <th>Valor</th>
                        <th>Tipo</th>
                        <th>Observações</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        let total = 0;
        entries.forEach(entry => {
            const date = formatDateBR(safeGetDate(entry.entryDate));
            total += entry.value || 0;
            
            html += `
                <tr>
                    <td>${date}</td>
                    <td>${escapeHtml(entry.store)}</td>
                    <td class="currency">${formatCurrency(entry.value)}</td>
                    <td>${entry.entryType === 'single' ? 'Diário' : entry.entryType === 'week' ? 'Semanal' : 'Período'}</td>
                    <td>${escapeHtml(entry.notes || '-')}</td>
                </tr>
            `;
        });
        
        html += `
                </tbody>
                <tfoot>
                    <tr>
                        <th colspan="2">Total</th>
                        <th class="currency">${formatCurrency(total)}</th>
                        <th colspan="2">${entries.length} lançamento(s)</th>
                    </tr>
                </tfoot>
            </table>
        `;
        
        content.innerHTML = html;
    } catch (error) {
        content.innerHTML = '<div class="alert alert-error">Erro ao gerar relatório</div>';
    }
};

window.showTargetsReport = async function() {
    const modal = getElementById('reportModal');
    const content = getElementById('reportContent');
    
    if (!modal || !content) return;
    
    content.innerHTML = '<div class="loading-row">Gerando relatório de metas...</div>';
    modal.classList.add('show');
    
    try {
        const segments = currentUserData.segment === 'executive' ? 
            Object.keys(businessData) : [currentUserData.segment];
        
        let html = `
            <h4>🎯 Relatório de Metas - ${formatDisplayMonth(new Date(selectedMonth + '-01'))}</h4>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Segmento</th>
                        <th>Loja</th>
                        <th>Meta</th>
                        <th>Realizado</th>
                        <th>% Atingido</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        let totalTarget = 0;
        let totalRevenue = 0;
        
        for (const segment of segments) {
            const stores = businessData[segment].stores;
            
            for (const store of stores) {
                const target = await queryService.getTarget(segment, store, selectedMonth, 'monthly');
                
                const entries = await queryService.getSalesEntries({
                    segment: segment,
                    store: store,
                    month: selectedMonth
                });
                
                const revenue = entries.reduce((sum, entry) => sum + (entry.value || 0), 0);
                const percentage = target > 0 ? (revenue / target) * 100 : 0;
                
                totalTarget += target;
                totalRevenue += revenue;
                
                html += `
                    <tr>
                        <td>${businessData[segment].name}</td>
                        <td>${store}</td>
                        <td class="currency">${formatCurrency(target)}</td>
                        <td class="currency">${formatCurrency(revenue)}</td>
                        <td>${percentage.toFixed(1)}%</td>
                    </tr>
                `;
            }
        }
        
        const totalPercentage = totalTarget > 0 ? (totalRevenue / totalTarget) * 100 : 0;
        
        html += `
                </tbody>
                <tfoot>
                    <tr>
                        <th colspan="2">Total</th>
                        <th class="currency">${formatCurrency(totalTarget)}</th>
                        <th class="currency">${formatCurrency(totalRevenue)}</th>
                        <th>${totalPercentage.toFixed(1)}%</th>
                    </tr>
                </tfoot>
            </table>
        `;
        
        content.innerHTML = html;
    } catch (error) {
        content.innerHTML = '<div class="alert alert-error">Erro ao gerar relatório</div>';
    }
};

window.showComparativeAnalysis = async function() {
    const modal = getElementById('reportModal');
    const content = getElementById('reportContent');
    
    if (!modal || !content) return;
    
    content.innerHTML = '<div class="loading-row">Gerando análise comparativa...</div>';
    modal.classList.add('show');
    
    try {
        const currentMonth = new Date(selectedMonth + '-01');
        const previousMonth = new Date(currentMonth);
        previousMonth.setMonth(previousMonth.getMonth() - 1);
        const previousMonthStr = formatMonthYear(previousMonth);
        
        const segments = currentUserData.segment === 'executive' ? 
            Object.keys(businessData) : [currentUserData.segment];
        
        let html = `
            <h4>📊 Análise Comparativa - ${formatDisplayMonth(currentMonth)} vs ${formatDisplayMonth(previousMonth)}</h4>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Segmento/Loja</th>
                        <th>${formatDisplayMonth(previousMonth)}</th>
                        <th>${formatDisplayMonth(currentMonth)}</th>
                        <th>Variação</th>
                        <th>%</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        let totalPrevious = 0;
        let totalCurrent = 0;
        
        for (const segment of segments) {
            const stores = businessData[segment].stores;
            
            for (const store of stores) {
                const entriesPrevious = await queryService.getSalesEntries({
                    segment: segment,
                    store: store,
                    month: previousMonthStr
                });
                
                const entriesCurrent = await queryService.getSalesEntries({
                    segment: segment,
                    store: store,
                    month: selectedMonth
                });
                
                const revenuePrevious = entriesPrevious.reduce((sum, entry) => sum + (entry.value || 0), 0);
                const revenueCurrent = entriesCurrent.reduce((sum, entry) => sum + (entry.value || 0), 0);
                const variation = revenueCurrent - revenuePrevious;
                const percentage = revenuePrevious > 0 ? (variation / revenuePrevious) * 100 : 0;
                
                totalPrevious += revenuePrevious;
                totalCurrent += revenueCurrent;
                
                const variationClass = variation >= 0 ? 'positive' : 'negative';
                const arrow = variation >= 0 ? '↑' : '↓';
                
                html += `
                    <tr>
                        <td>${businessData[segment].name} - ${store}</td>
                        <td class="currency">${formatCurrency(revenuePrevious)}</td>
                        <td class="currency">${formatCurrency(revenueCurrent)}</td>
                        <td class="currency ${variationClass}">${arrow} ${formatCurrency(Math.abs(variation))}</td>
                        <td class="${variationClass}">${percentage.toFixed(1)}%</td>
                    </tr>
                `;
            }
        }
        
        const totalVariation = totalCurrent - totalPrevious;
        const totalPercentage = totalPrevious > 0 ? (totalVariation / totalPrevious) * 100 : 0;
        const totalClass = totalVariation >= 0 ? 'positive' : 'negative';
        const totalArrow = totalVariation >= 0 ? '↑' : '↓';
        
        html += `
                </tbody>
                <tfoot>
                    <tr>
                        <th>Total</th>
                        <th class="currency">${formatCurrency(totalPrevious)}</th>
                        <th class="currency">${formatCurrency(totalCurrent)}</th>
                        <th class="currency ${totalClass}">${totalArrow} ${formatCurrency(Math.abs(totalVariation))}</th>
                        <th class="${totalClass}">${totalPercentage.toFixed(1)}%</th>
                    </tr>
                </tfoot>
            </table>
            
            <style>
                .positive { color: #48bb78; }
                .negative { color: #e53e3e; }
            </style>
        `;
        
        content.innerHTML = html;
    } catch (error) {
        content.innerHTML = '<div class="alert alert-error">Erro ao gerar análise</div>';
    }
};

window.exportCurrentData = async function() {
    try {
        const entries = await queryService.getSalesEntries({
            segment: currentUserData.segment !== 'executive' ? currentUserData.segment : '',
            month: selectedMonth
        });
        
        let csv = 'Data,Loja,Valor,Tipo,Observações\n';
        
        entries.forEach(entry => {
            const date = formatDateBR(safeGetDate(entry.entryDate));
            csv += `"${date}","${entry.store}","${entry.value}","${entry.entryType}","${entry.notes || ''}"\n`;
        });
        
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `ice-beer-vendas-${selectedMonth}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        notificationManager.show('Exportação Concluída', 'Arquivo CSV baixado com sucesso!', 'success');
    } catch (error) {
        console.error('❌ Erro ao exportar:', error);
        notificationManager.show('Erro', 'Erro ao exportar dados', 'error');
    }
};

window.closeReportModal = function() {
    const modal = getElementById('reportModal');
    if (modal) {
        modal.classList.remove('show');
    }
};

window.showCacheStats = function() {
    const stats = cacheManager.getStats();
    const modal = createStatsModal(stats);
    document.body.appendChild(modal);
    modal.classList.add('show');
};

function createStatsModal(stats) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay show';
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
                <div style="margin-top: 20px; text-align: center;">
                    <button class="action-btn secondary" onclick="window.cacheManager.clear(); window.location.reload();">
                        🗑️ Limpar Cache e Recarregar
                    </button>
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
// INICIALIZAÇÃO E CONTROLE DE AUTH
// ===============================

async function setupAuthStateListener() {
    await initializeFirebase();
    
    window.firebase.onAuthStateChanged(auth, async (user) => {
        try {
            if (user) {
                if (!defaultUsers[user.email]) {
                    showAlert('loginAlert', 'Usuário não autorizado', 'error');
                    await window.handleLogout();
                    return;
                }

                currentUser = user;
                currentUserData = defaultUsers[user.email];
                
                console.log('🔑 Usuário autenticado:', currentUserData.name);
                
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
}

// ===============================
// INICIALIZAÇÃO PRINCIPAL
// ===============================

document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Ice Beer v4.0 - Sistema iniciado');
    console.log('✅ Características:');
    console.log('  - 🔥 Firebase Rules configuradas');
    console.log('  - 🤖 Auto Setup ativo');
    console.log('  - 💾 Cache inteligente CORRIGIDO');
    console.log('  - 📊 Relatórios funcionais');
    console.log('  - 📅 Formato DD/MM/AAAA com GMT-3');
    console.log('  - 🔒 Isolamento por segmento');
    console.log('  - 🐛 Bugs de cache resolvidos');
    
    try {
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
                pwStatus.textContent = '📱 Sistema Pronto';
                pwStatus.classList.add('success');
            }
            
            setTimeout(() => {
                [firebaseStatus, cacheStatus, pwStatus].forEach(indicator => {
                    if (indicator) {
                        indicator.classList.remove('show');
                    }
                });
            }, 4000);
        }, 2000);
        
        // Inicializar Firebase e Auth
        await setupAuthStateListener();
        
        // Expor globalmente para debug
        window.cacheManager = cacheManager;
        window.notificationManager = notificationManager;
        
        console.log('✅ Sistema pronto para uso!');
        
    } catch (error) {
        console.error('❌ Erro na inicialização:', error);
        showError('Erro ao inicializar sistema. Recarregue a página.');
    }
});

// Expor variáveis globais necessárias
window.cacheManager = cacheManager;
window.notificationManager = notificationManager;