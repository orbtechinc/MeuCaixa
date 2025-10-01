// --- GERENCIAMENTO DE DADOS ---
let sources = [];
let projects = [];
let activeCharts = []; // Para rastrear e destruir gráficos antigos
let currentProjectId = null;
let transactionTypeSelectListener = null; 
let historyFilters = { period: 'week', sector: 'all', subsector: 'all' };
let dashboardPeriodFilter = 'week';
const subsectorsBySector = {
    'all': ['Todos os Subsetores'],
    'Financeiro': ['Todos', 'Planejamento', 'Captação', 'Recursos'],
    'Operacional': ['Todos', 'Treinamento', 'Armazenamento', 'Produção'],
    'Comercial': ['Todos', 'Marketing', 'Relacionamento', 'Vendas']
};

// --- FUNÇÕES UTILITÁRIAS ---
const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
};

const saveData = () => {
    localStorage.setItem('projectManagerData', JSON.stringify({ sources, projects }));
};

const loadData = () => {
    try {
        const data = JSON.parse(localStorage.getItem('projectManagerData'));
        if (data) {
            sources = data.sources || [];
            projects = data.projects || [];
        }
    } catch (e) {
        console.error("Erro ao carregar dados. Os dados foram resetados.", e);
        sources = [];
        projects = [];
    }
};

// --- FUNÇÕES DE RENDERIZAÇÃO PRINCIPAIS ---
const renderTotalBalance = () => {
    const total = sources.reduce((sum, source) => sum + parseFloat(source.balance), 0);
    document.getElementById('total-balance').textContent = formatCurrency(total);
};

const renderProjects = () => {
    const carousel = document.getElementById('project-carousel');
    carousel.innerHTML = ''; 

    if (projects.length === 0) {
        carousel.innerHTML = `<div class="flex-shrink-0 w-full max-w-xs mx-auto bg-white rounded-xl shadow-lg flex flex-col items-center justify-center text-center p-6 snap-center aspect-[1080/1220]"><svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg><h3 class="font-bold text-lg">Nenhum projeto ainda</h3><p class="text-gray-500">Clique em "Criar Projeto" para começar.</p></div>`;
        return;
    }
    
    projects.forEach(project => {
        const projectBalance = project.transactions.reduce((bal, t) => bal + (t.type === 'revenue' ? t.amount : -t.amount), 0);
        const card = document.createElement('div');
        card.className = "flex-shrink-0 w-full max-w-xs mx-auto bg-white rounded-xl shadow-lg flex flex-col p-6 snap-center cursor-pointer hover:shadow-xl transition aspect-[1080/1220]";
        card.setAttribute('onclick', `switchView('sectors-view', '${project.id}')`);
        card.innerHTML = `<div class="flex-grow flex flex-col justify-center"><h3 class="font-bold text-2xl text-gray-800">${project.name}</h3><p class="text-sm text-gray-400 mt-2">Balanço do Projeto</p><p class="text-4xl font-bold ${projectBalance >= 0 ? 'text-green-500' : 'text-red-500'} mt-2">${formatCurrency(projectBalance)}</p></div><div class="text-xs text-center text-indigo-500 font-semibold mt-4">CLIQUE PARA VER SETORES</div>`;
        carousel.appendChild(card);
    });
};

const renderInvestmentSources = () => {
    const list = document.getElementById('investment-sources-list');
    list.innerHTML = '';
    if (sources.length === 0) {
        list.innerHTML = `<p class="text-gray-500 text-center">Nenhuma fonte de recurso cadastrada.</p>`;
        return;
    }
    sources.forEach(source => {
        const item = document.createElement('div');
        item.className = 'source-item';
        item.innerHTML = `
            <div>
                <p class="font-bold text-gray-800">${source.name}</p>
                <p class="text-sm text-gray-500">${source.type}</p>
            </div>
            <p class="font-bold text-lg ${source.balance >= 0 ? 'text-green-600' : 'text-red-600'}">${formatCurrency(source.balance)}</p>
        `;
        list.appendChild(item);
    });
};

// --- FUNÇÕES DE GRÁFICOS ---

const destroyActiveCharts = () => {
    activeCharts.forEach(chart => chart.destroy());
    activeCharts = [];
};

function renderDashboardCharts(period = 'week') {
    destroyActiveCharts();
    const container = document.getElementById('charts-container');
    container.innerHTML = '';

    // Render Pie Charts
    const pieData = projects.reduce((acc, project) => {
        const revenue = project.transactions.filter(t => t.type === 'revenue').reduce((sum, t) => sum + t.amount, 0);
        const cost = project.transactions.filter(t => t.type === 'cost').reduce((sum, t) => sum + t.amount, 0);
        if (revenue > 0) acc.revenues.data.push(revenue);
        if (revenue > 0) acc.revenues.labels.push(project.name);
        if (cost > 0) acc.costs.data.push(cost);
        if (cost > 0) acc.costs.labels.push(project.name);
        return acc;
    }, { revenues: { labels: [], data: [] }, costs: { labels: [], data: [] } });

    if (pieData.revenues.data.length > 0) {
        container.innerHTML += `<div class="chart-card"><h2>Eficiência de Receita por Projeto</h2><canvas id="revenuePieChart"></canvas></div>`;
        const revenueCtx = document.getElementById('revenuePieChart').getContext('2d');
        activeCharts.push(new Chart(revenueCtx, { type: 'pie', data: { labels: pieData.revenues.labels, datasets: [{ data: pieData.revenues.data, backgroundColor: ['#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B'] }] } }));
    }
     if (pieData.costs.data.length > 0) {
        container.innerHTML += `<div class="chart-card"><h2>Eficiência de Custo por Projeto</h2><canvas id="costPieChart"></canvas></div>`;
        const costCtx = document.getElementById('costPieChart').getContext('2d');
        activeCharts.push(new Chart(costCtx, { type: 'pie', data: { labels: pieData.costs.labels, datasets: [{ data: pieData.costs.data, backgroundColor: ['#F44336', '#E91E63', '#9C27B0', '#673AB7'] }] } }));
    }

    // Render Bar Charts per Project
    projects.forEach(project => {
        const chartId = `projectChart_${project.id}`;
        container.innerHTML += `<div class="chart-card"><h2>Desempenho: ${project.name}</h2><canvas id="${chartId}"></canvas></div>`;
        const ctx = document.getElementById(chartId).getContext('2d');
        
        const data = aggregateDataForPeriod(project.transactions, period);

        activeCharts.push(new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [
                    { label: 'Receita', data: data.revenues, backgroundColor: 'rgba(75, 192, 192, 0.6)' },
                    { label: 'Custo', data: data.costs, backgroundColor: 'rgba(255, 99, 132, 0.6)' }
                ]
            },
            options: { scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } } }
        }));
    });
}

function renderSubsectorCharts() {
    destroyActiveCharts();
    const container = document.getElementById('subsector-charts-container');
    container.innerHTML = '';
    const project = projects.find(p => p.id === currentProjectId);
    if (!project) return;

    const dataBySubsector = project.transactions.reduce((acc, t) => {
        if (!acc[t.subSector]) acc[t.subSector] = { revenue: 0, cost: 0 };
        if (t.type === 'revenue') acc[t.subSector].revenue += t.amount;
        else acc[t.subSector].cost += t.amount;
        return acc;
    }, {});
    
    for (const subsector in dataBySubsector) {
        const chartId = `subsectorChart_${subsector.replace(/\s+/g, '')}`;
        container.innerHTML += `<div class="chart-card"><h3>Desempenho: ${subsector}</h3><canvas id="${chartId}"></canvas></div>`;
        const ctx = document.getElementById(chartId).getContext('2d');
        activeCharts.push(new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Receita', 'Custo'],
                datasets: [{
                    label: subsector,
                    data: [dataBySubsector[subsector].revenue, dataBySubsector[subsector].cost],
                    backgroundColor: ['rgba(75, 192, 192, 0.6)', 'rgba(255, 99, 132, 0.6)']
                }]
            },
            options: { indexAxis: 'y', scales: { y: { beginAtZero: true } } }
        }));
    }
}

function aggregateDataForPeriod(transactions, period) {
    // This is a simplified aggregation. A real app might use a library like date-fns.
    const result = { labels: [], revenues: [], costs: [] };
    if (period === 'week') {
        result.labels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        result.revenues = Array(7).fill(0);
        result.costs = Array(7).fill(0);
        transactions.forEach(t => {
            const day = new Date(t.date).getUTCDay();
            if (t.type === 'revenue') result.revenues[day] += t.amount;
            else result.costs[day] += t.amount;
        });
    } else if (period === 'month') {
        const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
        result.labels = Array.from({ length: daysInMonth }, (_, i) => i + 1);
        result.revenues = Array(daysInMonth).fill(0);
        result.costs = Array(daysInMonth).fill(0);
         transactions.forEach(t => {
            const day = new Date(t.date).getUTCDate() - 1;
            if (t.type === 'revenue') result.revenues[day] += t.amount;
            else result.costs[day] += t.amount;
        });
    } else { // year
        result.labels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        result.revenues = Array(12).fill(0);
        result.costs = Array(12).fill(0);
         transactions.forEach(t => {
            const month = new Date(t.date).getUTCMonth();
            if (t.type === 'revenue') result.revenues[month] += t.amount;
            else result.costs[month] += t.amount;
        });
    }
    return result;
}


// --- CONTROLE DA UI ---
const openModal = (modalId) => document.getElementById(modalId).classList.remove('hidden');
const closeModal = (modalId) => document.getElementById(modalId).classList.add('hidden');

const openTransactionModal = (sector, subSector) => {
    const project = projects.find(p => p.id === currentProjectId);
    if (!project) return;
    
    document.getElementById('transaction-form').reset();
    document.getElementById('transaction-project-name').textContent = `${project.name} / ${sector} / ${subSector}`;
    document.getElementById('transaction-sector').value = sector;
    document.getElementById('transaction-subsector').value = subSector;
    document.getElementById('transaction-date').valueAsDate = new Date();
    
    const captacaoFields = document.getElementById('captacao-fields');
    const transactionSourceWrapper = document.getElementById('transaction-source-wrapper');
    const descriptionInput = document.getElementById('transaction-description');
    const transactionTypeSelect = document.getElementById('transaction-type');

    if (transactionTypeSelectListener) {
        transactionTypeSelect.removeEventListener('change', transactionTypeSelectListener);
    }
    
    if (sector === 'Financeiro' && subSector === 'Captação') {
        captacaoFields.classList.remove('hidden');
        descriptionInput.placeholder = "Ex: Investidor Anjo, Empréstimo BMG";
        transactionTypeSelectListener = () => {
            transactionSourceWrapper.classList.toggle('hidden', transactionTypeSelect.value === 'revenue');
        };
        transactionTypeSelect.addEventListener('change', transactionTypeSelectListener);
        transactionTypeSelectListener();
    } else {
        captacaoFields.classList.add('hidden');
        descriptionInput.placeholder = "Ex: Venda de licença";
        transactionSourceWrapper.classList.remove('hidden');
    }
    
    const sourceSelect = document.getElementById('transaction-source');
    sourceSelect.innerHTML = '';
    if (sources.length === 0) {
        sourceSelect.innerHTML = '<option value="" disabled selected>Nenhuma fonte criada</option>';
    } else {
        sources.forEach(source => {
            const option = document.createElement('option');
            option.value = source.id;
            option.textContent = `${source.name} (${source.type})`;
            sourceSelect.appendChild(option);
        });
    }
    openModal('transaction-modal');
};

const switchView = (viewId, projectId = null) => {
    if (projectId) currentProjectId = projectId;
    
    ['home-view', 'dashboard-view', 'sectors-view', 'history-view'].forEach(id => document.getElementById(id).classList.add('hidden'));
    document.getElementById(viewId).classList.remove('hidden');

    const createProjectBtn = document.getElementById('create-project-btn');
    const historyBtn = document.getElementById('history-btn');

    if (viewId === 'sectors-view') {
        createProjectBtn.classList.add('hidden');
        historyBtn.classList.remove('hidden');
    } else {
        createProjectBtn.classList.remove('hidden');
        historyBtn.classList.add('hidden');
    }

    destroyActiveCharts(); // Clear charts when switching views
    if (viewId === 'dashboard-view') renderDashboardCharts(dashboardPeriodFilter);
    if (viewId === 'history-view') {
        populateFilters();
        renderHistory();
    }
    if (viewId === 'sectors-view') {
         const project = projects.find(p => p.id === currentProjectId);
         if(project) document.getElementById('sectors-project-name').textContent = project.name;
         renderSubsectorCharts();
    }
};

const filterDashboardCharts = (period) => {
    dashboardPeriodFilter = period;
    document.querySelectorAll('.dashboard-filter-btn').forEach(btn => {
        const btnPeriod = btn.getAttribute('data-period');
        btn.classList.toggle('bg-indigo-600', btnPeriod === period);
        btn.classList.toggle('text-white', btnPeriod === period);
        btn.classList.toggle('bg-white', btnPeriod !== period);
        btn.classList.toggle('text-gray-700', btnPeriod !== period);
    });
    renderDashboardCharts(period);
};

const populateFilters = () => {
    const sectorSelect = document.getElementById('sector-filter');
    sectorSelect.innerHTML = '<option value="all">Todos os Setores</option>';
    Object.keys(subsectorsBySector).filter(s => s !== 'all').forEach(sector => {
        sectorSelect.innerHTML += `<option value="${sector}">${sector}</option>`;
    });
    sectorSelect.value = historyFilters.sector;
    updateSubsectorFilter();
};

const updateSubsectorFilter = () => {
    const sector = document.getElementById('sector-filter').value;
    const subsectorSelect = document.getElementById('subsector-filter');
    subsectorSelect.innerHTML = '';
    const subsectors = subsectorsBySector[sector] || [];
    subsectors.forEach(sub => {
        const value = sub.toLowerCase().includes('todos') ? 'all' : sub;
        subsectorSelect.innerHTML += `<option value="${value}">${sub}</option>`;
    });
    subsectorSelect.value = historyFilters.subsector;
};

const filterHistoryPeriod = (period) => {
    historyFilters.period = period;
    document.querySelectorAll('.history-filter-btn.period-btn').forEach(btn => {
        const btnPeriod = btn.getAttribute('data-period');
        btn.classList.toggle('bg-indigo-600', btnPeriod === period);
        btn.classList.toggle('text-white', btnPeriod === period);
        btn.classList.toggle('bg-white', btnPeriod !== period);
        btn.classList.toggle('text-gray-700', btnPeriod !== period);
    });
    renderHistory();
};

// --- INICIALIZAÇÃO E EVENT LISTENERS (transactions part is modified) ---
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    renderTotalBalance();
    renderProjects();
    renderInvestmentSources();

    document.getElementById('source-form').addEventListener('submit', (e) => {
        e.preventDefault();
        sources.push({
            id: `src_${Date.now()}`, name: e.target.elements['source-name'].value,
            type: e.target.elements['source-type'].value, balance: parseFloat(e.target.elements['source-balance'].value)
        });
        saveData();
        renderTotalBalance();
        renderInvestmentSources();
        closeModal('source-modal');
        e.target.reset();
    });

    document.getElementById('project-form').addEventListener('submit', (e) => {
        e.preventDefault();
        projects.push({ id: `proj_${Date.now()}`, name: e.target.elements['project-name'].value, transactions: [] });
        saveData();
        renderProjects();
        closeModal('project-modal');
        e.target.reset();
    });

    document.getElementById('transaction-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const form = e.target;
        const sector = form.elements['transaction-sector'].value;
        const subSector = form.elements['transaction-subsector'].value;
        const type = form.elements['transaction-type'].value;
        const amount = parseFloat(form.elements['transaction-amount'].value);
        const description = form.elements['transaction-description'].value;
        const date = form.elements['transaction-date'].value;
        const project = projects.find(p => p.id === currentProjectId);
        if (!project) return console.error('Projeto inválido.');

        if (sector === 'Financeiro' && subSector === 'Captação' && type === 'revenue') {
            const newSource = {
                id: `src_${Date.now()}`, name: description,
                type: form.elements['captacao-source-type'].value, balance: amount
            };
            sources.push(newSource);
            project.transactions.push({ 
                type, description, amount, sector, subSector, 
                sourceId: newSource.id, date, captacaoType: newSource.type
            });
        } else {
            const sourceId = form.elements['transaction-source'].value;
            const source = sources.find(s => s.id === sourceId);
            if (!source) return console.error('Fonte de Recurso inválida.');
            source.balance += (type === 'revenue' ? amount : -amount);
            const newTransaction = { type, description, amount, sector, subSector, sourceId, date };
            if (sector === 'Financeiro' && subSector === 'Captação') {
                newTransaction.captacaoType = form.elements['captacao-source-type'].value;
            }
            project.transactions.push(newTransaction);
        }
        
        saveData();
        renderProjects();
        renderTotalBalance();
        renderInvestmentSources();
        closeModal('transaction-modal');
    });

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

