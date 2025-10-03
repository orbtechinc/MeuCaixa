import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, onAuthStateChanged, createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, signOut, sendPasswordResetEmail,
    GoogleAuthProvider,
    signInWithPopup 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, doc, onSnapshot, collection, 
    addDoc, updateDoc, deleteDoc, writeBatch, arrayUnion, setDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- REFERÊNCIAS GLOBAIS ---
const firebaseConfig = {
    apiKey: "AIzaSyCs1D4sMSpQKeg9GrfWKSf2-11xyHIBTGY",
    authDomain: "meu-caixa-e53c8.firebaseapp.com",
    projectId: "meu-caixa-e53c8",
    storageBucket: "meu-caixa-e53c8.firebasestorage.app",
    messagingSenderId: "200778166957",
    appId: "1:200778166957:web:f27f1fdc04af35a8c60c24"
};
// --- INICIALIZAÇÃO E LÓGICA DO APP ---
let app;
let auth;
let db;
let userId = null;
let localTestMode = false; // Esta variável não é mais usada, mas não causa erro.
let unsubscribeProjects = () => {};
let unsubscribeSources = () => {};

// --- LÓGICA DE TEMA (CLARO/ESCURO) ---
const themeToggle = document.getElementById('theme-toggle');
const applyTheme = (theme) => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
};
const savedTheme = localStorage.getItem('theme') || 'light';
applyTheme(savedTheme);

themeToggle.addEventListener('click', () => {
    const newTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
});

// --- LÓGICA DE AUTENTICAÇÃO E UI ---
const authContainer = document.getElementById('auth-container');
const loadingView = document.getElementById('loading-view');
const appContainer = document.getElementById('app-container');

const switchAuthView = (viewId) => {
    ['landing-view', 'signup-view', 'login-view', 'forgot-password-view'].forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });
    document.getElementById(viewId).classList.remove('hidden');
};

// >>> GARANTA QUE SUA FUNÇÃO 'handleSignup' ESTEJA ASSIM <<<
const handleSignup = async (email, password, name, phone) => {
    if (!auth) return;

    try {
        // 1. Cria o usuário no Firebase Authentication
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 2. Cria um documento de perfil no Firestore
        // O caminho será "users/{ID_DO_NOVO_USUARIO}"
        await setDoc(doc(db, "users", user.uid), {
            name: name,
            phone: phone,
            email: email,
            createdAt: new Date() // Boa prática
        });

    } catch (error) {
        console.error("Erro no cadastro:", error);
        alert(`Erro no cadastro: ${error.message}`);
    }
};
const handleLogin = (email, password) => {
    if (!auth) return;
    signInWithEmailAndPassword(auth, email, password)
        .catch(error => alert(`Erro no login: ${error.message}`));
};
const handlePasswordReset = (email) => {
    if (!auth) return;
    sendPasswordResetEmail(auth, email)
        .then(() => alert('Link de redefinição enviado para o seu e-mail.'))
        .catch(error => alert(`Erro ao enviar e-mail: ${error.message}`));
};
const handleLogout = () => {
    if (!auth) return;
    signOut(auth).catch(error => console.error('Erro no logout:', error));
};

// >>> ADICIONE ESTA NOVA FUNÇÃO <<<
const handleProfilePasswordReset = () => {
    if (!auth || !auth.currentUser) {
        return alert("Você precisa estar logado para trocar a senha.");
    }

    // Verifica se o usuário logou com email/senha
    const isEmailUser = auth.currentUser.providerData.some(
        (provider) => provider.providerId === 'password'
    );

    if (!isEmailUser) {
        return alert("Esta função está disponível apenas para usuários cadastrados com e-mail e senha.");
    }

    const userEmail = auth.currentUser.email;
    if (confirm(`Enviaremos um link de redefinição de senha para ${userEmail}. Deseja continuar?`)) {
        sendPasswordResetEmail(auth, userEmail)
            .then(() => {
                alert("Link enviado! Verifique sua caixa de entrada.");
            })
            .catch((error) => {
                console.error("Erro ao enviar e-mail de redefinição:", error);
                alert(`Ocorreu um erro: ${error.message}`);
            });
    }
};

const handleGoogleLogin = () => {
    if (!auth) return;
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider)
        .then((result) => {
            // O onAuthStateChanged vai cuidar do resto.
            console.log("Usuário logado com Google:", result.user.displayName);
        }).catch((error) => {
            console.error("Erro no login com Google:", error);
            alert(`Erro ao tentar logar com Google: ${error.message}`);
        });
};

// --- LÓGICA DO FIRESTORE E DO APLICATIVO PRINCIPAL ---
let sources = [];
let projects = [];
let activeCharts = [];
let currentProjectId = null;
let historyFilters = { period: 'week', sector: 'all', subsector: 'all' };
let dashboardPeriodFilter = 'week';
let projectDashboardViewMode = 'bars';
let sectorDashboardViewMode = 'bars';
const subsectorsBySector = { 'all': ['Todos os Subsetores'], 'Financeiro': ['Todos', 'Investimento', 'Planejamento', 'Recursos'], 'Operacional': ['Todos', 'Treinamento', 'Armazenamento', 'Produção'], 'Comercial': ['Todos', 'Marketing', 'Relacionamento', 'Vendas'] };

const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

function startFirestoreListeners() {
    unsubscribeProjects();
    unsubscribeSources();
    if (!userId || !db) return;

    const projectsCollectionPath = `/users/${userId}/projects`;
    const sourcesCollectionPath = `/users/${userId}/sources`;

    const projectsCollection = collection(db, projectsCollectionPath);
    unsubscribeProjects = onSnapshot(projectsCollection, (snapshot) => {
        projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderAll();
        loadingView.classList.add('hidden');
        appContainer.classList.remove('hidden');
        switchView('home-view'); // Garante que o estado ativo do menu seja atualizado no primeiro load
    });

    const sourcesCollection = collection(db, sourcesCollectionPath);
    unsubscribeSources = onSnapshot(sourcesCollection, (snapshot) => {
        sources = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderAll();
    });
}

// --- FUNÇÕES DE RENDERIZAÇÃO E DADOS ---
const saveDataToLocalStorage = () => {
    localStorage.setItem('projectManagerData', JSON.stringify({ sources, projects }));
};

const loadDataFromLocalStorage = () => {
    try {
        const data = JSON.parse(localStorage.getItem('projectManagerData'));
        if (data) {
            sources = data.sources || [];
            projects = data.projects || [];
        }
    } catch (e) {
        console.error("Erro ao carregar dados locais. Os dados foram resetados.", e);
        sources = [];
        projects = [];
    }
};

const renderTotalBalance = () => { document.getElementById('total-balance').textContent = formatCurrency(sources.filter(s => !s.deleted).reduce((sum, source) => sum + parseFloat(source.balance), 0)); };

const renderProjects = () => {
    const carousel = document.getElementById('project-carousel');
    carousel.innerHTML = '';
    const activeProjects = projects.filter(p => !p.deleted);

    if (activeProjects.length === 0) {
        carousel.innerHTML = `<div class="project-card flex-shrink-0 w-full max-w-xs mx-auto p-6 snap-center"><div class="flex flex-col items-center justify-center text-center h-full"><svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg><h3 class="font-bold text-lg">Nenhum projeto ainda</h3><p class="text-gray-500 dark:text-gray-400">Clique em "Criar Projeto" para começar.</p></div></div>`;
        return;
    }

    activeProjects.forEach(project => {
        const totalRevenue = (project.transactions || []).filter(t => t.type === 'revenue').reduce((sum, t) => sum + t.amount, 0);
        const totalCost = (project.transactions || []).filter(t => t.type === 'cost').reduce((sum, t) => sum + t.amount, 0);
        const projectBalance = totalRevenue - totalCost;

        const card = document.createElement('div');
        let borderColorClass = 'card-neutral';
        if (projectBalance > 0) borderColorClass = 'card-positive';
        else if (projectBalance < 0) borderColorClass = 'card-negative';
        
        card.className = `project-card ${borderColorClass} flex-shrink-0 w-full max-w-xs mx-auto snap-center cursor-pointer hover:shadow-xl transition relative`;
        card.setAttribute('onclick', `switchView('sectors-view', '${project.id}')`);
        card.innerHTML = `
            <button onclick="moveItemToTrash(event, 'project', '${project.id}')" class="absolute top-2 right-2 text-gray-400 hover:text-red-500"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
            <h3 class="font-bold text-xl mb-2">${project.name}</h3>
            <div class="space-y-2 text-sm border-t pt-2 mt-2 dark:border-gray-700">
                <div class="flex justify-between"><span class="text-gray-500 dark:text-gray-400">Receita</span><span class="font-semibold text-green-500">${formatCurrency(totalRevenue)}</span></div>
                <div class="flex justify-between"><span class="text-gray-500 dark:text-gray-400">Custo</span><span class="font-semibold text-red-500">${formatCurrency(totalCost)}</span></div>
                <div class="flex justify-between border-t pt-2 mt-2 dark:border-gray-700"><span class="font-bold">Resultado</span><span class="font-bold ${projectBalance >= 0 ? 'text-green-500' : 'text-red-500'}">${formatCurrency(projectBalance)}</span></div>
            </div>`;
        carousel.appendChild(card);
    });
};
const renderInvestmentSources = () => {
    const list = document.getElementById('investment-sources-list');
    list.innerHTML = '';
    const activeSources = sources.filter(s => !s.deleted);

    if (activeSources.length === 0) {
        list.innerHTML = `<p class="text-gray-500 dark:text-gray-400 text-center">Nenhuma fonte de investimento cadastrada.</p>`;
        return;
    }
    activeSources.forEach(source => {
        const item = document.createElement('div');
        item.className = 'source-item';
        item.innerHTML = `
            <div class="flex-grow">
                <p class="font-bold">${source.name}</p>
                <p class="text-sm text-gray-500 dark:text-gray-400">${source.type}</p>
            </div>
            <p class="font-bold text-lg ${source.balance >= 0 ? 'text-green-600' : 'text-red-600'} mr-4">${formatCurrency(source.balance)}</p>
            <button onclick="moveItemToTrash(null, 'source', '${source.id}')" class="text-gray-400 hover:text-red-500"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>`;
        list.appendChild(item);
    });
};
const renderSectorIndicators = () => {
    const project = projects.find(p => p.id === currentProjectId);
    if (!project) return;

    ['Financeiro', 'Operacional', 'Comercial'].forEach(sector => {
        const transactions = project.transactions || [];
        const sectorTransactions = transactions.filter(t => t.sector === sector);
        const totalRevenue = sectorTransactions.filter(t => t.type === 'revenue').reduce((sum, t) => sum + t.amount, 0);
        const totalCost = sectorTransactions.filter(t => t.type === 'cost').reduce((sum, t) => sum + t.amount, 0);
        const result = totalRevenue - totalCost;
        
        const indicatorDiv = document.getElementById(`${sector.toLowerCase()}-indicators`);
        if (indicatorDiv) {
            indicatorDiv.innerHTML = `
                <div class="flex justify-between"><span class="text-gray-500 dark:text-gray-400">Receita</span><span class="font-semibold text-green-500">${formatCurrency(totalRevenue)}</span></div>
                <div class="flex justify-between"><span class="text-gray-500 dark:text-gray-400">Custo</span><span class="font-semibold text-red-500">${formatCurrency(totalCost)}</span></div>
                 <div class="flex justify-between border-t mt-2 pt-2 dark:border-gray-700"><span class="font-bold">Resultado</span><span class="font-bold ${result >= 0 ? 'text-green-600' : 'text-red-600'}">${formatCurrency(result)}</span></div>`;
        }
    });
};

const destroyActiveCharts = () => { activeCharts.forEach(chart => chart.destroy()); activeCharts = []; };

function createChart(container, title, chartConfig) { const card = document.createElement('div'); card.className = 'chart-card'; card.innerHTML = `<h2>${title}</h2><canvas></canvas>`; container.appendChild(card); const canvas = card.querySelector('canvas'); if (canvas) { activeCharts.push(new Chart(canvas.getContext('2d'), chartConfig)); } }

function renderProjectDashboardCharts(period = 'week') { destroyActiveCharts(); const container = document.getElementById('project-charts-container'); container.innerHTML = ''; const activeProjects = projects.filter(p => !p.deleted); if (projectDashboardViewMode === 'pizza') { const pieData = activeProjects.reduce((acc, project) => { const revenue = (project.transactions || []).filter(t => t.type === 'revenue' && isDateInPeriod(t.date, period)).reduce((sum, t) => sum + t.amount, 0); const cost = (project.transactions || []).filter(t => t.type === 'cost' && isDateInPeriod(t.date, period)).reduce((sum, t) => sum + t.amount, 0); if (revenue > 0) { acc.revenues.data.push(revenue); acc.revenues.labels.push(project.name); } if (cost > 0) { acc.costs.data.push(cost); acc.costs.labels.push(project.name); } return acc; }, { revenues: { labels: [], data: [] }, costs: { labels: [], data: [] } }); if (pieData.revenues.data.length > 0) createChart(container, 'Receita por Projeto', { type: 'pie', data: { labels: pieData.revenues.labels, datasets: [{ data: pieData.revenues.data, backgroundColor: ['#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107'] }] }, options: { responsive: true, maintainAspectRatio: false } }); if (pieData.costs.data.length > 0) createChart(container, 'Custo por Projeto', { type: 'pie', data: { labels: pieData.costs.labels, datasets: [{ data: pieData.costs.data, backgroundColor: ['#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5'] }] }, options: { responsive: true, maintainAspectRatio: false } }); } else { activeProjects.forEach(project => { const data = aggregateDataForPeriod(project.transactions || [], period); createChart(container, `Desempenho: ${project.name}`, { type: 'bar', data: { labels: data.labels, datasets: [{ label: 'Receita', data: data.revenues, backgroundColor: 'rgba(75, 192, 192, 0.6)' }, { label: 'Custo', data: data.costs, backgroundColor: 'rgba(255, 99, 132, 0.6)' }] }, options: { scales: { y: { beginAtZero: true } }, responsive: true, maintainAspectRatio: false } }); }); } }

function renderSectorDashboardCharts(period = 'week') { destroyActiveCharts(); const container = document.getElementById('sector-charts-container'); container.innerHTML = ''; const project = projects.find(p => p.id === currentProjectId); if (!project) return; const allSubsectors = ['Investimento', 'Planejamento', 'Recursos', 'Treinamento', 'Armazenamento', 'Produção', 'Marketing', 'Relacionamento', 'Vendas']; if (sectorDashboardViewMode === 'pizza') { const pieData = allSubsectors.reduce((acc, subsector) => { const revenue = (project.transactions || []).filter(t => t.subSector === subsector && t.type === 'revenue' && isDateInPeriod(t.date, period)).reduce((sum, t) => sum + t.amount, 0); const cost = (project.transactions || []).filter(t => t.subSector === subsector && t.type === 'cost' && isDateInPeriod(t.date, period)).reduce((sum, t) => sum + t.amount, 0); if (revenue > 0) { acc.revenues.data.push(revenue); acc.revenues.labels.push(subsector); } if (cost > 0) { acc.costs.data.push(cost); acc.costs.labels.push(subsector); } return acc; }, { revenues: { labels: [], data: [] }, costs: { labels: [], data: [] } }); if (pieData.revenues.data.length > 0) createChart(container, 'Receita por Subsetor', { type: 'pie', data: { labels: pieData.revenues.labels, datasets: [{ data: pieData.revenues.data, backgroundColor: ['#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#795548', '#607D8B', '#009688'] }] }, options: { responsive: true, maintainAspectRatio: false } }); if (pieData.costs.data.length > 0) createChart(container, 'Custo por Subsetor', { type: 'pie', data: { labels: pieData.costs.labels, datasets: [{ data: pieData.costs.data, backgroundColor: ['#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#2196F3', '#03A9F4', '#00BCD4', '#f43f5e'] }] }, options: { responsive: true, maintainAspectRatio: false } }); } else { allSubsectors.forEach(subsector => { const transactions = (project.transactions || []).filter(t => t.subSector === subsector && isDateInPeriod(t.date, period)); const data = aggregateDataForPeriod(transactions, period); createChart(container, `Desempenho: ${subsector}`, { type: 'bar', data: { labels: data.labels, datasets: [{ label: 'Receita', data: data.revenues, backgroundColor: 'rgba(75, 192, 192, 0.6)' }, { label: 'Custo', data: data.costs, backgroundColor: 'rgba(255, 99, 132, 0.6)' }] }, options: { scales: { y: { beginAtZero: true } }, responsive: true, maintainAspectRatio: false } }); }); } }

function isDateInPeriod(dateString, period) { const date = new Date(dateString); const now = new Date(); let startDate = new Date(); if (period === 'week') { startDate.setDate(now.getDate() - now.getDay()); startDate.setHours(0, 0, 0, 0); } else if (period === 'month') { startDate = new Date(now.getFullYear(), now.getMonth(), 1); } else { startDate = new Date(now.getFullYear(), 0, 1); } return date >= startDate; }

function aggregateDataForPeriod(transactions, period) { const result = { labels: [], revenues: [], costs: [] }; const filtered = transactions.filter(t => isDateInPeriod(t.date, period)); if (period === 'week') { result.labels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']; result.revenues = Array(7).fill(0); result.costs = Array(7).fill(0); filtered.forEach(t => { const day = new Date(t.date).getUTCDay(); if (t.type === 'revenue') result.revenues[day] += t.amount; else result.costs[day] += t.amount; }); } else if (period === 'month') { const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate(); result.labels = Array.from({ length: daysInMonth }, (_, i) => i + 1); result.revenues = Array(daysInMonth).fill(0); result.costs = Array(daysInMonth).fill(0); filtered.forEach(t => { const day = new Date(t.date).getUTCDate() - 1; if (t.type === 'revenue') result.revenues[day] += t.amount; else result.costs[day] += t.amount; }); } else { result.labels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']; result.revenues = Array(12).fill(0); result.costs = Array(12).fill(0); filtered.forEach(t => { const month = new Date(t.date).getUTCMonth(); if (t.type === 'revenue') result.revenues[month] += t.amount; else result.costs[month] += t.amount; }); } return result; }

const openModal = (modalId) => document.getElementById(modalId).classList.remove('hidden'); 
const closeModal = (modalId) => document.getElementById(modalId).classList.add('hidden'); 

function closeModalOnOutsideClick(event) { if (event.target.id.endsWith('-modal')) { closeModal(event.target.id); } }

const openTransactionModal = (sector, subSector) => { const project = projects.find(p => p.id === currentProjectId); if (!project) return; const form = document.getElementById('transaction-form'); form.reset(); document.getElementById('transaction-project-name').textContent = `${project.name} / ${sector} / ${subSector}`; form.elements['transaction-sector'].value = sector; form.elements['transaction-subsector'].value = subSector; form.elements['transaction-date'].valueAsDate = new Date(); const sourceSelect = document.getElementById('transaction-source'); sourceSelect.innerHTML = ''; if (sources.filter(s => !s.deleted).length === 0) { sourceSelect.innerHTML = '<option value="" disabled selected>Nenhuma fonte criada</option>'; } else { sources.filter(s => !s.deleted).forEach(source => { const option = document.createElement('option'); option.value = source.id; option.textContent = `${source.name} (${source.type})`; sourceSelect.appendChild(option); }); } openModal('transaction-modal'); };

const openInvestmentModal = () => { const project = projects.find(p => p.id === currentProjectId); if (!project) { return alert("Por favor, selecione um projeto na tela inicial antes de realizar uma ação de investimento."); } document.getElementById('investment-form').reset(); document.getElementById('investment-project-name').textContent = `${project.name} / Financeiro / Investimento`; const sourceSelect = document.getElementById('inv-cost-source'); sourceSelect.innerHTML = ''; if (sources.filter(s => !s.deleted).length === 0) { sourceSelect.innerHTML = '<option value="" disabled selected>Nenhuma fonte criada</option>'; } else { sources.filter(s => !s.deleted).forEach(source => { const option = document.createElement('option'); option.value = source.id; option.textContent = `${source.name} (${source.type})`; sourceSelect.appendChild(option); }); } document.getElementById('inv-cost-date').valueAsDate = new Date(); updateInvestmentFormUI(); openModal('investment-modal'); };

const updateInvestmentFormUI = () => { const actionType = document.getElementById('investment-action-type').value; const sourceFields = document.getElementById('investment-source-fields'); const costFields = document.getElementById('investment-cost-fields'); if (actionType === 'source') { sourceFields.classList.remove('hidden'); costFields.classList.add('hidden'); } else { sourceFields.classList.add('hidden'); costFields.classList.remove('hidden'); } };

const updateNavActiveState = (activeViewId) => {
    const navButtons = {
        history: document.getElementById('nav-history'),
        results: document.getElementById('nav-results'),
        trash: document.getElementById('nav-trash')
    };

    const viewToButtonMap = {
        'history-view': 'history',
        'project-dashboard-view': 'results',
        'sector-dashboard-view': 'results',
        'trash-view': 'trash'
    };

    const activeClasses = ['bg-indigo-600', 'text-white', 'p-2', 'rounded-lg'];
    const inactiveClasses = ['text-gray-500', 'hover:bg-gray-100', 'dark:hover:bg-gray-800', 'p-2', 'rounded-lg'];

    for (const key in navButtons) {
        if (navButtons[key]) {
            navButtons[key].classList.remove(...activeClasses);
            navButtons[key].classList.add(...inactiveClasses);
        }
    }

    const activeButtonKey = viewToButtonMap[activeViewId];
    if (activeButtonKey && navButtons[activeButtonKey]) {
        const button = navButtons[activeButtonKey];
        button.classList.remove(...inactiveClasses);
        button.classList.add(...activeClasses);
    }
};

const switchView = (viewId, projectId = null) => {
    updateNavActiveState(viewId);

    if (['home-view', 'project-dashboard-view', 'history-view', 'trash-view'].includes(viewId)) {
        currentProjectId = null;
    }
    if (projectId) {
        currentProjectId = projectId;
    }

    ['home-view', 'project-dashboard-view', 'sector-dashboard-view', 'sectors-view', 'history-view', 'trash-view'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });

    const viewToShow = document.getElementById(viewId);
    if (!viewToShow) {
        console.error(`A view com o ID "${viewId}" não foi encontrada.`);
        return switchView('home-view');
    }
    viewToShow.classList.remove('hidden');

    const footer = document.getElementById('footer-nav');
    const homeNav = document.getElementById('home-nav');
    const sectorsNav = document.getElementById('sectors-nav');

    footer.classList.remove('hidden');

    if (viewId === 'sectors-view') {
        homeNav.classList.add('hidden');
        sectorsNav.classList.remove('hidden');
    } else {
        homeNav.classList.remove('hidden');
        sectorsNav.classList.add('hidden');
    }

    destroyActiveCharts();
    if (viewId === 'project-dashboard-view') renderProjectDashboardCharts(dashboardPeriodFilter);
    if (viewId === 'sector-dashboard-view') renderSectorDashboardCharts(dashboardPeriodFilter);
    if (viewId === 'history-view') {
        populateFilters();
        renderHistory();
    }
    if (viewId === 'trash-view') {
        renderTrash();
    }
    if (viewId === 'sectors-view') {
        const project = projects.find(p => p.id === currentProjectId);
        if (project) {
            document.getElementById('sectors-project-name').textContent = project.name;
            renderSectorIndicators();
        }
    }
};

const showResults = () => { if (currentProjectId) { switchView('sector-dashboard-view'); } else { switchView('project-dashboard-view'); } };

const filterDashboardCharts = (period) => { dashboardPeriodFilter = period; document.querySelectorAll('.dashboard-filter-btn').forEach(btn => { const btnPeriod = btn.getAttribute('data-period'); btn.classList.toggle('bg-indigo-600', btnPeriod === period); btn.classList.toggle('text-white', btnPeriod === period); btn.classList.toggle('bg-white', btnPeriod !== period); btn.classList.toggle('text-gray-700', btnPeriod !== period); }); renderProjectDashboardCharts(period); };

const filterSectorDashboardCharts = (period) => { dashboardPeriodFilter = period; document.querySelectorAll('.sector-dashboard-filter-btn').forEach(btn => { const btnPeriod = btn.getAttribute('data-period'); btn.classList.toggle('bg-indigo-600', btnPeriod === period); btn.classList.toggle('text-white', btnPeriod === period); btn.classList.toggle('bg-white', btnPeriod !== period); btn.classList.toggle('text-gray-700', btnPeriod !== period); }); renderSectorDashboardCharts(period); };

const filterDashboardView = (mode) => { projectDashboardViewMode = mode; document.querySelectorAll('.dashboard-view-btn').forEach(btn => { const btnView = btn.getAttribute('data-view'); btn.classList.toggle('bg-indigo-600', btnView === mode); btn.classList.toggle('text-white', btnView === mode); btn.classList.toggle('bg-white', btnView !== mode); btn.classList.toggle('text-gray-700', btnView !== mode); }); renderProjectDashboardCharts(dashboardPeriodFilter); };

const filterSectorView = (mode) => { sectorDashboardViewMode = mode; document.querySelectorAll('.sector-view-btn').forEach(btn => { const btnView = btn.getAttribute('data-view'); btn.classList.toggle('bg-indigo-600', btnView === mode); btn.classList.toggle('text-white', btnView === mode); btn.classList.toggle('bg-white', btnView !== mode); btn.classList.toggle('text-gray-700', btnView !== mode); }); renderSectorDashboardCharts(dashboardPeriodFilter); };

const filterHistoryPeriod = (period) => { historyFilters.period = period; document.querySelectorAll('.history-filter-btn.period-btn').forEach(btn => { const btnPeriod = btn.getAttribute('data-period'); btn.classList.toggle('bg-indigo-600', btnPeriod === period); btn.classList.toggle('text-white', btnPeriod === period); btn.classList.toggle('bg-white', btnPeriod !== period); btn.classList.toggle('text-gray-700', btnPeriod !== period); }); renderHistory(); };

const populateFilters = () => { const sectorSelect = document.getElementById('sector-filter'); sectorSelect.innerHTML = '<option value="all">Todos os Setores</option>'; Object.keys(subsectorsBySector).filter(s => s !== 'all').forEach(sector => { sectorSelect.innerHTML += `<option value="${sector}">${sector}</option>`; }); sectorSelect.value = historyFilters.sector; updateSubsectorFilter(); };

const updateSubsectorFilter = () => { const sector = document.getElementById('sector-filter').value; const subsectorSelect = document.getElementById('subsector-filter'); subsectorSelect.innerHTML = ''; (subsectorsBySector[sector] || []).forEach(sub => { const value = sub.toLowerCase().includes('todos') ? 'all' : sub; subsectorSelect.innerHTML += `<option value="${value}">${sub}</option>`; }); subsectorSelect.value = historyFilters.subsector; };

async function moveItemToTrash(event, type, id) { if (event) event.stopPropagation(); if(localTestMode){if(type==='project'){const project=projects.find(p=>p.id===id);if(project)project.deleted=true}else if(type==='source'){const source=sources.find(s=>s.id===id);if(source)source.deleted=true}saveDataToLocalStorage();renderAll();return}if(!userId)return;const collectionName=type==='project'?'projects':'sources';const docRef=doc(db,`users/${userId}/${collectionName}`,id);try{await updateDoc(docRef,{deleted:true})}catch(error){console.error(`Erro ao mover ${type} para a lixeira:`,error)}}

async function restoreItem(type, id) { if(localTestMode){if(type==='project'){const project=projects.find(p=>p.id===id);if(project)project.deleted=false}else if(type==='source'){const source=sources.find(s=>s.id===id);if(source)source.deleted=false}saveDataToLocalStorage();renderAll();renderTrash();return}if(!userId)return;const collectionName=type==='project'?'projects':'sources';const docRef=doc(db,`users/${userId}/${collectionName}`,id);try{await updateDoc(docRef,{deleted:false})}catch(error){console.error(`Erro ao restaurar ${type}:`,error)}}

function confirmDeletePermanently(type, id) { const item = type === 'project' ? projects.find(p => p.id === id) : sources.find(s => s.id === id); if (!item) return; if (confirm(`EXCLUIR PERMANENTEMENTE "${item.name}"? Esta ação é irreversível.`)) { deleteItemPermanently(type, id); } }

async function deleteItemPermanently(type, id) { if(localTestMode){if(type==='project'){projects=projects.filter(p=>p.id!==id)}else if(type==='source'){sources=sources.filter(s=>s.id!==id)}saveDataToLocalStorage();renderAll();renderTrash();return}if(!userId)return;const collectionName=type==='project'?'projects':'sources';const docRef=doc(db,`users/${userId}/${collectionName}`,id);try{await deleteDoc(docRef)}catch(error){console.error(`Erro ao excluir ${type} permanentemente:`,error)}}

function confirmClearTrash() { if (confirm("Tem certeza que deseja esvaziar a lixeira? Todos os itens serão excluídos permanentemente.")) { clearTrash(); } }

async function clearTrash() { if(localTestMode){projects=projects.filter(p=>!p.deleted);sources=sources.filter(s=>!s.deleted);saveDataToLocalStorage();renderAll();renderTrash();return}if(!userId)return;const batch=writeBatch(db);projects.filter(p=>p.deleted).forEach(p=>{const docRef=doc(db,`users/${userId}/projects`,p.id);batch.delete(docRef)});sources.filter(s=>s.deleted).forEach(s=>{const docRef=doc(db,`users/${userId}/sources`,s.id);batch.delete(docRef)});try{await batch.commit()}catch(error){console.error("Erro ao esvaziar a lixeira:",error)}}

const renderAll = () => { renderTotalBalance(); renderProjects(); renderInvestmentSources(); if (currentProjectId) { renderSectorIndicators(); } };

const renderHistory = () => { const list = document.getElementById('history-list'); if (!list) return; list.innerHTML = ''; let allTransactions = []; projects.filter(p => !p.deleted).forEach(p => { (p.transactions || []).forEach(t => { allTransactions.push({ ...t, projectName: p.name }); }); }); let filteredTransactions = allTransactions.filter(t => isDateInPeriod(t.date, historyFilters.period)); if (historyFilters.sector !== 'all') { filteredTransactions = filteredTransactions.filter(t => t.sector === historyFilters.sector); } if (historyFilters.subsector !== 'all') { filteredTransactions = filteredTransactions.filter(t => t.subSector === historyFilters.subsector); } filteredTransactions.sort((a, b) => new Date(b.date) - new Date(a.date)); if (filteredTransactions.length === 0) { list.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-center col-span-full">Nenhuma operação encontrada.</p>'; return; } filteredTransactions.forEach(t => { const item = document.createElement('div'); const isRevenue = t.type === 'revenue'; item.className = `history-item ${isRevenue ? "history-item-revenue" : "history-item-cost"}`; item.innerHTML = `<div class="flex-grow pr-4"><p class="font-bold">${t.description}</p><p class="text-sm text-gray-500 dark:text-gray-400">${t.projectName} - ${new Date(t.date).toLocaleDateString("pt-BR")}</p><p class="text-xs text-gray-400 dark:text-gray-500">${t.sector} / ${t.subSector}</p></div><p class="font-bold text-lg whitespace-nowrap ${isRevenue ? "text-green-600" : "text-red-600"}">${isRevenue ? "+" : "-"} ${formatCurrency(t.amount)}</p>`; list.appendChild(item); }); };

const renderTrash = () => { const deletedProjectsList = document.getElementById('deleted-projects-list'); const deletedSourcesList = document.getElementById('deleted-sources-list'); deletedProjectsList.innerHTML = ''; deletedSourcesList.innerHTML = ''; const deletedProjects = projects.filter(p => p.deleted); const deletedSources = sources.filter(s => s.deleted); if (deletedProjects.length === 0) { deletedProjectsList.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-center">Nenhum projeto na lixeira.</p>'; } else { deletedProjects.forEach(p => { const item = document.createElement('div'); item.className = 'trash-item'; item.innerHTML = `<div class="flex-grow"><p class="font-bold">${p.name}</p></div><div class="flex gap-2"><button onclick="restoreItem('project', '${p.id}')" class="text-blue-500 hover:text-blue-700">Restaurar</button><button onclick="confirmDeletePermanently('project', '${p.id}')" class="text-red-500 hover:text-red-700">Excluir</button></div>`; deletedProjectsList.appendChild(item); }); } if (deletedSources.length === 0) { deletedSourcesList.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-center">Nenhuma fonte na lixeira.</p>'; } else { deletedSources.forEach(s => { const item = document.createElement('div'); item.className = 'trash-item'; item.innerHTML = `<div class="flex-grow"><p class="font-bold">${s.name}</p><p class="text-sm text-gray-500 dark:text-gray-400">${s.type}</p></div><div class="flex gap-2"><button onclick="restoreItem('source', '${s.id}')" class="text-blue-500 hover:text-blue-700">Restaurar</button><button onclick="confirmDeletePermanently('source', '${s.id}')" class="text-red-500 hover:text-red-700">Excluir</button></div>`; deletedSourcesList.appendChild(item); }); } };

// --- INICIALIZAÇÃO GERAL ---
document.addEventListener('DOMContentLoaded', () => {

    if (firebaseConfig.apiKey === "SUA_API_KEY") {
        document.getElementById('landing-buttons').classList.add('hidden');
        document.getElementById('firebase-config-error').classList.remove('hidden');
        
        const localTestButton = document.createElement('button');
        
        localTestButton.className = "w-full text-sm text-gray-500 dark:text-gray-400 font-semibold py-2 px-4 rounded-lg hover:underline";
        localTestButton.textContent = "Entrar sem Login (Teste Local)";
        document.getElementById('firebase-config-error').appendChild(localTestButton);
        return;
    }

    // Inicializa o Firebase
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);

    // Inicia o listener de autenticação
    onAuthStateChanged(auth, user => {
        if (user) {
            userId = user.uid;
            authContainer.classList.add('hidden');
            loadingView.classList.remove('hidden');
            document.getElementById('user-email-display').textContent = user.isAnonymous ? 'Modo Demonstração' : user.email;
            startFirestoreListeners();
        } else {
            userId = null;
            unsubscribeProjects();
            unsubscribeSources();
            appContainer.classList.add('hidden');
            loadingView.classList.add('hidden');
            authContainer.classList.remove('hidden');
            switchAuthView('landing-view');
        }
    });

    // --- LISTENERS DE EVENTOS DA UI ---
    document.getElementById('profile-button').addEventListener('click', () => { 
        document.getElementById('profile-menu').classList.toggle('hidden');
    });

    document.addEventListener('click', e => {
        const menu = document.getElementById('profile-menu');
        const button = document.getElementById('profile-button');
        if (!menu.classList.contains('hidden') && !button.contains(e.target) && !menu.contains(e.target)) {
            menu.classList.add('hidden');
        }
    });

    // --- FORM SUBMISSIONS ---
    document.getElementById('project-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const projectName = e.target.elements['project-name'].value;
        if (!projectName) return;
        
        if (localTestMode) {
            projects.push({ id: `proj_${Date.now()}`, name: projectName, transactions: [], deleted: false });
            saveDataToLocalStorage();
            renderAll();
        } else {
            if (!userId) return;
            const projectsCollectionPath = `/users/${userId}/projects`;
            try {
                await addDoc(collection(db, projectsCollectionPath), { name: projectName, transactions: [], deleted: false });
            } catch (error) { console.error("Erro ao criar projeto:", error); }
        }
        closeModal('project-modal');
        e.target.reset();
    });

    document.getElementById('signup-form').addEventListener('submit', e => {
    e.preventDefault();

    // Coleta todos os dados do formulário
    const name = document.getElementById('signup-name').value;
    const phone = document.getElementById('signup-phone').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm-password').value;

    // Validação de segurança no lado do cliente
    if (password !== confirmPassword) {
        alert("As senhas não coincidem. Por favor, tente novamente.");
        return; // Interrompe a execução se as senhas forem diferentes
    }

    // Se a validação passar, chama a função de cadastro
    handleSignup(email, password, name, phone);
});

    document.getElementById('login-form').addEventListener('submit', e => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        handleLogin(email, password);
    });

    document.getElementById('forgot-password-form').addEventListener('submit', e => {
        e.preventDefault();
        const email = document.getElementById('forgot-email').value;
        handlePasswordReset(email);
    });


    document.getElementById('investment-action-type').addEventListener('change', updateInvestmentFormUI);

    document.getElementById('investment-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const actionType = form.elements['investment-action-type'].value;
        const project = projects.find(p => p.id === currentProjectId);
        if (!project) return;

        if (localTestMode) {
             if (actionType === 'source') {
                const name = form.elements['inv-source-name'].value;
                const type = form.elements['inv-source-type'].value;
                const balance = parseFloat(form.elements['inv-source-balance'].value);
                if (!name || !type || isNaN(balance)) return;
                const newSource = { id: `src_${Date.now()}`, name, type, balance, deleted: false };
                sources.push(newSource);
                project.transactions.push({ type: 'revenue', description: `Nova Fonte: ${name}`, amount: balance, sector: 'Financeiro', subSector: 'Investimento', sourceId: newSource.id, date: new Date().toISOString().split('T')[0] });
            } else {
                const sourceId = form.elements['inv-cost-source'].value;
                const source = sources.find(s => s.id === sourceId);
                if (!sourceId || !source) return;
                const amount = parseFloat(form.elements['inv-cost-amount'].value);
                source.balance -= amount;
                project.transactions.push({ type: 'cost', description: form.elements['inv-cost-description'].value, amount: amount, sector: 'Financeiro', subSector: 'Investimento', sourceId: sourceId, date: form.elements['inv-cost-date'].value });
            }
            saveDataToLocalStorage();
            renderAll();
        } else {
             if (!userId) return;
             if (actionType === 'source') {
                const name = form.elements['inv-source-name'].value;
                const type = form.elements['inv-source-type'].value;
                const balance = parseFloat(form.elements['inv-source-balance'].value);
                if (!name || !type || isNaN(balance)) return;

                const sourcesCollectionPath = `/users/${userId}/sources`;
                const newSourceRef = await addDoc(collection(db, sourcesCollectionPath), { name, type, balance, deleted: false });

                const projectDocRef = doc(db, `users/${userId}/projects`, project.id);
                await updateDoc(projectDocRef, {
                    transactions: arrayUnion({ type: 'revenue', description: `Nova Fonte: ${name}`, amount: balance, sector: 'Financeiro', subSector: 'Investimento', sourceId: newSourceRef.id, date: new Date().toISOString().split('T')[0] })
                });
            } else { // 'cost'
                const sourceId = form.elements['inv-cost-source'].value;
                const source = sources.find(s => s.id === sourceId);
                if (!sourceId || !source) return;

                const amount = parseFloat(form.elements['inv-cost-amount'].value);
                const newBalance = source.balance - amount;
                
                const sourceDocRef = doc(db, `users/${userId}/sources`, sourceId);
                await updateDoc(sourceDocRef, { balance: newBalance });
                
                const projectDocRef = doc(db, `users/${userId}/projects`, project.id);
                await updateDoc(projectDocRef, {
                    transactions: arrayUnion({ type: 'cost', description: form.elements['inv-cost-description'].value, amount: amount, sector: 'Financeiro', subSector: 'Investimento', sourceId: sourceId, date: form.elements['inv-cost-date'].value })
                });
            }
        }
        closeModal('investment-modal');
    });

    document.getElementById('transaction-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const project = projects.find(p => p.id === currentProjectId);
        if (!project) return;
        
        const sourceId = form.elements['transaction-source'].value;
        const source = sources.find(s => s.id === sourceId);
        if (!source) return;

        const amount = parseFloat(form.elements['transaction-amount'].value);
        const type = form.elements['transaction-type'].value;
        const newBalance = source.balance + (type === 'revenue' ? amount : -amount);
        
        if (localTestMode) {
            source.balance = newBalance;
            project.transactions.push({
                type: type,
                description: form.elements['transaction-description'].value,
                amount: amount,
                sector: form.elements['transaction-sector'].value,
                subSector: form.elements['transaction-subsector'].value,
                sourceId: sourceId,
                date: form.elements['transaction-date'].value
            });
            saveDataToLocalStorage();
            renderAll();
        } else {
            if (!userId) return console.error('Usuário não logado.');
            const sourceDocRef = doc(db, `users/${userId}/sources`, sourceId);
            await updateDoc(sourceDocRef, { balance: newBalance });

            const projectDocRef = doc(db, `users/${userId}/projects`, project.id);
            await updateDoc(projectDocRef, {
                transactions: arrayUnion({
                    type: type,
                    description: form.elements['transaction-description'].value,
                    amount: amount,
                    sector: form.elements['transaction-sector'].value,
                    subSector: form.elements['transaction-subsector'].value,
                    sourceId: sourceId,
                    date: form.elements['transaction-date'].value
                })
            });
        }

        closeModal('transaction-modal');
    });

    // --- FILTER LISTENERS ---
    document.getElementById('sector-filter').addEventListener('change', (e) => {
        historyFilters.sector = e.target.value;
        historyFilters.subsector = 'all'; 
        updateSubsectorFilter();
        renderHistory();
    });
    document.getElementById('subsector-filter').addEventListener('change', (e) => {
        historyFilters.subsector = e.target.value;
        renderHistory();
    });
});

// Expondo funções para o escopo global para que os `onclick` no HTML funcionem
window.switchAuthView = switchAuthView;window.handleLogout = handleLogout;
window.handleGoogleLogin = handleGoogleLogin;window.handleProfilePasswordReset = handleProfilePasswordReset;window.switchView=switchView;window.openModal=openModal;window.closeModal=closeModal;window.closeModalOnOutsideClick=closeModalOnOutsideClick;window.openTransactionModal=openTransactionModal;window.openInvestmentModal=openInvestmentModal;window.showResults=showResults;window.filterDashboardCharts=filterDashboardCharts;window.filterDashboardView=filterDashboardView;window.filterSectorDashboardCharts=filterSectorDashboardCharts;window.filterSectorView=filterSectorView;window.filterHistoryPeriod=filterHistoryPeriod;window.moveItemToTrash=moveItemToTrash;window.restoreItem=restoreItem;window.confirmDeletePermanently=confirmDeletePermanently;window.confirmClearTrash=confirmClearTrash;

