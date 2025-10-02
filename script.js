// --- GERENCIAMENTO DE DADOS ---
let sources = [];
let projects = [];
let activeCharts = []; // Para rastrear e destruir gráficos antigos
let currentProjectId = null;
let historyFilters = { period: 'week', sector: 'all', subsector: 'all' };
let dashboardPeriodFilter = 'week';
let projectDashboardViewMode = 'bars';
let sectorDashboardViewMode = 'bars';
const subsectorsBySector = {
    'all': ['Todos os Subsetores'],
    'Financeiro': ['Todos', 'Investimento', 'Planejamento', 'Recursos'],
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
        carousel.innerHTML = `<div class="project-card flex-shrink-0 w-full max-w-xs mx-auto p-6 snap-center"><div class="flex flex-col items-center justify-center text-center h-full"><svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg><h3 class="font-bold text-lg">Nenhum projeto ainda</h3><p class="text-gray-500">Clique em "Criar Projeto" para começar.</p></div></div>`;
        return;
    }

    projects.forEach(project => {
        const totalRevenue = project.transactions.filter(t => t.type === 'revenue').reduce((sum, t) => sum + t.amount, 0);
        const totalCost = project.transactions.filter(t => t.type === 'cost').reduce((sum, t) => sum + t.amount, 0);
        const projectBalance = totalRevenue - totalCost;

        const card = document.createElement('div');
        let borderColorClass = 'card-neutral';
        if (projectBalance > 0) {
            borderColorClass = 'card-positive';
        } else if (projectBalance < 0) {
            borderColorClass = 'card-negative';
        }
        
        card.className = `project-card ${borderColorClass} flex-shrink-0 w-full max-w-xs mx-auto snap-center cursor-pointer hover:shadow-xl transition`;
        card.setAttribute('onclick', `switchView('sectors-view', '${project.id}')`);
        card.innerHTML = `
            <h3 class="font-bold text-xl text-gray-800 mb-2">${project.name}</h3>
            <div class="space-y-2 text-sm border-t pt-2 mt-2">
                <div class="flex justify-between">
                    <span class="text-gray-500">Receita</span>
                    <span class="font-semibold text-green-500">${formatCurrency(totalRevenue)}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-500">Custo</span>
                    <span class="font-semibold text-red-500">${formatCurrency(totalCost)}</span>
                </div>
                <div class="flex justify-between border-t pt-2 mt-2">
                    <span class="font-bold text-gray-700">Resultado</span>
                    <span class="font-bold ${projectBalance >= 0 ? 'text-green-500' : 'text-red-500'}">${formatCurrency(projectBalance)}</span>
                </div>
            </div>`;
        carousel.appendChild(card);
    });
};

const renderInvestmentSources = () => {
    const list = document.getElementById('investment-sources-list');
    list.innerHTML = '';
    if (sources.length === 0) {
        list.innerHTML = `<p class="text-gray-500 text-center">Nenhuma fonte de investimento cadastrada.</p>`;
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

const renderSectorIndicators = () => {
    const project = projects.find(p => p.id === currentProjectId);
    if (!project) return;

    ['Financeiro', 'Operacional', 'Comercial'].forEach(sector => {
        const sectorTransactions = project.transactions.filter(t => t.sector === sector);
        const totalRevenue = sectorTransactions.filter(t => t.type === 'revenue').reduce((sum, t) => sum + t.amount, 0);
        const totalCost = sectorTransactions.filter(t => t.type === 'cost').reduce((sum, t) => sum + t.amount, 0);
        const result = totalRevenue - totalCost;
        
        const indicatorDiv = document.getElementById(`${sector.toLowerCase()}-indicators`);

        if (indicatorDiv) {
            indicatorDiv.innerHTML = `
                <div class="flex justify-between">
                    <span class="text-gray-500">Receita</span>
                    <span class="font-semibold text-green-500">${formatCurrency(totalRevenue)}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-500">Custo</span>
                    <span class="font-semibold text-red-500">${formatCurrency(totalCost)}</span>
                </div>
                 <div class="flex justify-between border-t mt-2 pt-2">
                    <span class="text-gray-700 font-bold">Resultado</span>
                    <span class="font-bold ${result >= 0 ? 'text-green-600' : 'text-red-600'}">${formatCurrency(result)}</span>
                </div>
            `;
        }
    });
};


// --- FUNÇÕES DE GRÁFICOS ---

const destroyActiveCharts = () => {
    activeCharts.forEach(chart => chart.destroy());
    activeCharts = [];
};

function createChart(container, title, chartConfig) {
    const card = document.createElement('div');
    card.className = 'chart-card';
    card.innerHTML = `<h2>${title}</h2><canvas></canvas>`;
    container.appendChild(card);
    const canvas = card.querySelector('canvas');
    if (canvas) {
        activeCharts.push(new Chart(canvas.getContext('2d'), chartConfig));
    }
}

function renderProjectDashboardCharts(period = 'week') {
    destroyActiveCharts();
    const container = document.getElementById('project-charts-container');
    container.innerHTML = '';

    if (projectDashboardViewMode === 'pizza') {
        const pieData = projects.reduce((acc, project) => {
            const revenue = project.transactions.filter(t => t.type === 'revenue' && isDateInPeriod(t.date, period)).reduce((sum, t) => sum + t.amount, 0);
            const cost = project.transactions.filter(t => t.type === 'cost' && isDateInPeriod(t.date, period)).reduce((sum, t) => sum + t.amount, 0);
            if (revenue > 0) { acc.revenues.data.push(revenue); acc.revenues.labels.push(project.name); }
            if (cost > 0) { acc.costs.data.push(cost); acc.costs.labels.push(project.name); }
            return acc;
        }, { revenues: { labels: [], data: [] }, costs: { labels: [], data: [] } });

        if (pieData.revenues.data.length > 0) createChart(container, 'Receita por Projeto', { type: 'pie', data: { labels: pieData.revenues.labels, datasets: [{ data: pieData.revenues.data, backgroundColor: ['#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107'] }] }, options: { responsive: true, maintainAspectRatio: false } });
        if (pieData.costs.data.length > 0) createChart(container, 'Custo por Projeto', { type: 'pie', data: { labels: pieData.costs.labels, datasets: [{ data: pieData.costs.data, backgroundColor: ['#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5'] }] }, options: { responsive: true, maintainAspectRatio: false } });
    } else { // 'bars'
        projects.forEach(project => {
            const data = aggregateDataForPeriod(project.transactions, period);
            createChart(container, `Desempenho: ${project.name}`, { type: 'bar', data: { labels: data.labels, datasets: [ { label: 'Receita', data: data.revenues, backgroundColor: 'rgba(75, 192, 192, 0.6)' }, { label: 'Custo', data: data.costs, backgroundColor: 'rgba(255, 99, 132, 0.6)' } ] }, options: { scales: { y: { beginAtZero: true } }, responsive: true, maintainAspectRatio: false }});
        });
    }
}

function renderSectorDashboardCharts(period = 'week') {
    destroyActiveCharts();
    const container = document.getElementById('sector-charts-container');
    container.innerHTML = '';
    const project = projects.find(p => p.id === currentProjectId);
    if (!project) return;

    const allSubsectors = ['Investimento', 'Planejamento', 'Recursos', 'Treinamento', 'Armazenamento', 'Produção', 'Marketing', 'Relacionamento', 'Vendas'];

     if (sectorDashboardViewMode === 'pizza') {
        const pieData = allSubsectors.reduce((acc, subsector) => {
            const revenue = project.transactions.filter(t => t.subSector === subsector && t.type === 'revenue' && isDateInPeriod(t.date, period)).reduce((sum, t) => sum + t.amount, 0);
            const cost = project.transactions.filter(t => t.subSector === subsector && t.type === 'cost' && isDateInPeriod(t.date, period)).reduce((sum, t) => sum + t.amount, 0);
            if (revenue > 0) { acc.revenues.data.push(revenue); acc.revenues.labels.push(subsector); }
            if (cost > 0) { acc.costs.data.push(cost); acc.costs.labels.push(subsector); }
            return acc;
        }, { revenues: { labels: [], data: [] }, costs: { labels: [], data: [] } });

        if (pieData.revenues.data.length > 0) createChart(container, 'Receita por Subsetor', { type: 'pie', data: { labels: pieData.revenues.labels, datasets: [{ data: pieData.revenues.data, backgroundColor: ['#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#795548', '#607D8B', '#009688'] }] }, options: { responsive: true, maintainAspectRatio: false } });
        if (pieData.costs.data.length > 0) createChart(container, 'Custo por Subsetor', { type: 'pie', data: { labels: pieData.costs.labels, datasets: [{ data: pieData.costs.data, backgroundColor: ['#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#2196F3', '#03A9F4', '#00BCD4', '#f43f5e'] }] }, options: { responsive: true, maintainAspectRatio: false } });

    } else { // 'bars'
        allSubsectors.forEach(subsector => {
            const transactions = project.transactions.filter(t => t.subSector === subsector && isDateInPeriod(t.date, period));
            const data = aggregateDataForPeriod(transactions, period);
            createChart(container, `Desempenho: ${subsector}`, { type: 'bar', data: { labels: data.labels, datasets: [{ label: 'Receita', data: data.revenues, backgroundColor: 'rgba(75, 192, 192, 0.6)' }, { label: 'Custo', data: data.costs, backgroundColor: 'rgba(255, 99, 132, 0.6)' }] }, options: { scales: { y: { beginAtZero: true } }, responsive: true, maintainAspectRatio: false }});
        });
    }
}

function isDateInPeriod(dateString, period) {
    const date = new Date(dateString);
    const now = new Date();
    let startDate = new Date();

    if (period === 'week') {
        startDate.setDate(now.getDate() - now.getDay());
        startDate.setHours(0,0,0,0);
    } else if (period === 'month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else { // year
        startDate = new Date(now.getFullYear(), 0, 1);
    }
    return date >= startDate;
}

function aggregateDataForPeriod(transactions, period) {
    const result = { labels: [], revenues: [], costs: [] };
    const filtered = transactions.filter(t => isDateInPeriod(t.date, period));

    if (period === 'week') {
        result.labels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        result.revenues = Array(7).fill(0);
        result.costs = Array(7).fill(0);
        filtered.forEach(t => {
            const day = new Date(t.date).getUTCDay();
            if (t.type === 'revenue') result.revenues[day] += t.amount;
            else result.costs[day] += t.amount;
        });
    } else if (period === 'month') {
        const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
        result.labels = Array.from({ length: daysInMonth }, (_, i) => i + 1);
        result.revenues = Array(daysInMonth).fill(0);
        result.costs = Array(daysInMonth).fill(0);
         filtered.forEach(t => {
            const day = new Date(t.date).getUTCDate() - 1;
            if (t.type === 'revenue') result.revenues[day] += t.amount;
            else result.costs[day] += t.amount;
        });
    } else { // year
        result.labels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        result.revenues = Array(12).fill(0);
        result.costs = Array(12).fill(0);
         filtered.forEach(t => {
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

function closeModalOnOutsideClick(event) {
    if (event.target.id.endsWith('-modal')) {
        closeModal(event.target.id);
    }
}

const openTransactionModal = (sector, subSector) => {
    const project = projects.find(p => p.id === currentProjectId);
    if (!project) return;
    
    const form = document.getElementById('transaction-form');
    form.reset();

    document.getElementById('transaction-project-name').textContent = `${project.name} / ${sector} / ${subSector}`;
    form.elements['transaction-sector'].value = sector;
    form.elements['transaction-subsector'].value = subSector;
    form.elements['transaction-date'].valueAsDate = new Date();

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

const openInvestmentModal = () => {
     const project = projects.find(p => p.id === currentProjectId);
    if (!project) {
        alert("Por favor, selecione um projeto na tela inicial antes de realizar uma ação de investimento.");
        return;
    }
    document.getElementById('investment-form').reset();
    document.getElementById('investment-project-name').textContent = `${project.name} / Financeiro / Investimento`;
    
    const sourceSelect = document.getElementById('inv-cost-source');
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
    document.getElementById('inv-cost-date').valueAsDate = new Date();
    updateInvestmentFormUI(); // Set initial state
    openModal('investment-modal');
}

const updateInvestmentFormUI = () => {
    const actionType = document.getElementById('investment-action-type').value;
    const sourceFields = document.getElementById('investment-source-fields');
    const costFields = document.getElementById('investment-cost-fields');

    if (actionType === 'source') {
        sourceFields.classList.remove('hidden');
        costFields.classList.add('hidden');
    } else { // cost
        sourceFields.classList.add('hidden');
        costFields.classList.remove('hidden');
    }
};

const switchView = (viewId, projectId = null) => {
    if (['home-view', 'project-dashboard-view', 'history-view'].includes(viewId)) {
        currentProjectId = null;
    }
    if (projectId) currentProjectId = projectId;
    
    ['home-view', 'project-dashboard-view', 'sector-dashboard-view', 'sectors-view', 'history-view'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    const viewToShow = document.getElementById(viewId);
    if(viewToShow) {
        viewToShow.classList.remove('hidden');
    } else {
        console.error(`A view com o ID "${viewId}" não foi encontrada.`);
        switchView('home-view'); // Fallback to home view
        return; 
    }

    const footer = document.getElementById('footer-nav');
    const homeNav = document.getElementById('home-nav');
    const sectorsNav = document.getElementById('sectors-nav');

    if (viewId === 'home-view') {
        footer.classList.remove('hidden');
        homeNav.classList.remove('hidden');
        sectorsNav.classList.add('hidden');
    } else if (viewId === 'sectors-view') {
        footer.classList.remove('hidden');
        homeNav.classList.add('hidden');
        sectorsNav.classList.remove('hidden');
    } else {
        footer.classList.add('hidden');
    }

    destroyActiveCharts();
    if (viewId === 'project-dashboard-view') renderProjectDashboardCharts(dashboardPeriodFilter);
    if (viewId === 'sector-dashboard-view') renderSectorDashboardCharts(dashboardPeriodFilter);
    if (viewId === 'history-view') {
        populateFilters();
        renderHistory();
    }
    if (viewId === 'sectors-view') {
         const project = projects.find(p => p.id === currentProjectId);
         if(project) {
            document.getElementById('sectors-project-name').textContent = project.name;
            renderSectorIndicators();
         }
    }
};

const showResults = () => {
    if (currentProjectId) {
        switchView('sector-dashboard-view');
    } else {
        switchView('project-dashboard-view');
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
    renderProjectDashboardCharts(period);
};

const filterSectorDashboardCharts = (period) => {
    dashboardPeriodFilter = period;
     document.querySelectorAll('.sector-dashboard-filter-btn').forEach(btn => {
        const btnPeriod = btn.getAttribute('data-period');
        btn.classList.toggle('bg-indigo-600', btnPeriod === period);
        btn.classList.toggle('text-white', btnPeriod === period);
        btn.classList.toggle('bg-white', btnPeriod !== period);
        btn.classList.toggle('text-gray-700', btnPeriod !== period);
    });
    renderSectorDashboardCharts(period);
}

const filterDashboardView = (mode) => {
    projectDashboardViewMode = mode;
    document.querySelectorAll('.dashboard-view-btn').forEach(btn => {
        const btnView = btn.getAttribute('data-view');
        btn.classList.toggle('bg-indigo-600', btnView === mode);
        btn.classList.toggle('text-white', btnView === mode);
        btn.classList.toggle('bg-white', btnView !== mode);
        btn.classList.toggle('text-gray-700', btnView !== mode);
    });
    renderProjectDashboardCharts(dashboardPeriodFilter);
}

const filterSectorView = (mode) => {
    sectorDashboardViewMode = mode;
    document.querySelectorAll('.sector-view-btn').forEach(btn => {
        const btnView = btn.getAttribute('data-view');
        btn.classList.toggle('bg-indigo-600', btnView === mode);
        btn.classList.toggle('text-white', btnView === mode);
        btn.classList.toggle('bg-white', btnView !== mode);
        btn.classList.toggle('text-gray-700', btnView !== mode);
    });
    renderSectorDashboardCharts(dashboardPeriodFilter);
}

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

// --- INICIALIZAÇÃO E EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    renderTotalBalance();
    renderProjects();
    renderInvestmentSources();

    document.getElementById('investment-action-type').addEventListener('change', updateInvestmentFormUI);

    document.getElementById('project-form').addEventListener('submit', (e) => {
        e.preventDefault();
        projects.push({ id: `proj_${Date.now()}`, name: e.target.elements['project-name'].value, transactions: [] });
        saveData();
        renderProjects();
        renderSectorIndicators();
        closeModal('project-modal');
        e.target.reset();
    });
    
    // Listener para o formulário de Investimento
    document.getElementById('investment-form').addEventListener('submit', e => {
        e.preventDefault();
        const form = e.target;
        const actionType = form.elements['investment-action-type'].value;
        const project = projects.find(p => p.id === currentProjectId);
        if (!project) return;


        if (actionType === 'source') {
            const name = form.elements['inv-source-name'].value;
            const type = form.elements['inv-source-type'].value;
            const balance = parseFloat(form.elements['inv-source-balance'].value);
            if (!name || !type || isNaN(balance)) return;

            const newSource = { id: `src_${Date.now()}`, name, type, balance };
            sources.push(newSource);
            
            project.transactions.push({
                type: 'revenue',
                description: `Nova Fonte: ${name}`,
                amount: balance,
                sector: 'Financeiro',
                subSector: 'Investimento',
                sourceId: newSource.id,
                date: new Date().toISOString().split('T')[0]
            });

        } else { // 'cost'
            const sourceId = form.elements['inv-cost-source'].value;
            const source = sources.find(s => s.id === sourceId);
            if (!sourceId || !source) return;

            const amount = parseFloat(form.elements['inv-cost-amount'].value);
            source.balance -= amount;

            project.transactions.push({
                type: 'cost',
                description: form.elements['inv-cost-description'].value,
                amount: amount,
                sector: 'Financeiro',
                subSector: 'Investimento',
                sourceId: sourceId,
                date: form.elements['inv-cost-date'].value
            });
        }
        
        saveData();
        renderTotalBalance();
        renderProjects();
        renderInvestmentSources();
        renderSectorIndicators();
        closeModal('investment-modal');
    });

    // Listener para o formulário de Transações Padrão
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

        const sourceId = form.elements['transaction-source'].value;
        const sourceSelect = form.elements['transaction-source'];
        if (!sourceId) {
            sourceSelect.classList.add('border-red-500', 'ring-2', 'ring-red-500');
            setTimeout(() => sourceSelect.classList.remove('border-red-500', 'ring-2', 'ring-red-500'), 2000);
            return;
        }
        const source = sources.find(s => s.id === sourceId);
        if (!source) return console.error('Fonte de Recurso inválida.');

        source.balance += (type === 'revenue' ? amount : -amount);
        const newTransaction = { type, description, amount, sector, subSector, sourceId, date };
        project.transactions.push(newTransaction);
        
        saveData();
        renderTotalBalance();
        renderProjects();
        renderInvestmentSources();
        renderSectorIndicators();
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

    // Close modals on outside click
    ['project-modal', 'investment-modal', 'transaction-modal'].forEach(modalId => {
        const modal = document.getElementById(modalId);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modalId);
            }
        });
    });
});

// History rendering
const renderHistory = () => {
    const list = document.getElementById('history-list');
    if(!list) return; // Add guard clause
    list.innerHTML = '';
    
    let allTransactions = [];
    projects.forEach(p => {
        p.transactions.forEach(t => {
            allTransactions.push({ ...t, projectName: p.name });
        });
    });

    let filteredTransactions = allTransactions.filter(t => isDateInPeriod(t.date, historyFilters.period));
    
    if (historyFilters.sector !== 'all') {
        filteredTransactions = filteredTransactions.filter(t => t.sector === historyFilters.sector);
    }
    
    if (historyFilters.subsector !== 'all') {
        filteredTransactions = filteredTransactions.filter(t => t.subSector === historyFilters.subsector);
    }

    filteredTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (filteredTransactions.length === 0) {
        list.innerHTML = `<p class="text-gray-500 text-center col-span-full">Nenhuma operação encontrada.</p>`;
        return;
    }

    filteredTransactions.forEach(t => {
        const item = document.createElement('div');
        const isRevenue = t.type === 'revenue';
        item.className = `history-item ${isRevenue ? 'history-item-revenue' : 'history-item-cost'}`;
        
        item.innerHTML = `
            <div class="flex-grow pr-4">
                <p class="font-bold text-gray-800">${t.description}</p>
                <p class="text-sm text-gray-500">${t.projectName} - ${new Date(t.date).toLocaleDateString('pt-BR')}</p>
                <p class="text-xs text-gray-400">${t.sector} / ${t.subSector}</p>
            </div>
            <p class="font-bold text-lg whitespace-nowrap ${isRevenue ? 'text-green-600' : 'text-red-600'}">${isRevenue ? '+' : '-'} ${formatCurrency(t.amount)}</p>
        `;
        list.appendChild(item);
    });
};
</script>
</body>
</html>

