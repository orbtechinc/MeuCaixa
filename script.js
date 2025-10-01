// --- GERENCIAMENTO DE DADOS ---
let sources = [];
let projects = [];
let chartInstance = null;
let currentProjectId = null;
let transactionTypeSelectListener = null; 
let historyFilters = { period: 'week', sector: 'all', subsector: 'all' };
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

// --- FUNÇÕES DE RENDERIZAÇÃO ---
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

const renderChart = (period = 'week') => {
    const ctx = document.getElementById('resultsChart').getContext('2d');
    const now = new Date();
    let startDate;

    if (period === 'week') {
        startDate = new Date(now.setDate(now.getDate() - now.getDay()));
    } else { // month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    startDate.setHours(0, 0, 0, 0);

    const labels = projects.map(p => p.name);
    const data = projects.map(project => {
        return project.transactions
            .filter(t => new Date(t.date) >= startDate)
            .reduce((balance, t) => balance + (t.type === 'revenue' ? t.amount : -t.amount), 0);
    });
    
    const backgroundColors = data.map(value => value >= 0 ? 'rgba(75, 192, 192, 0.6)' : 'rgba(255, 99, 132, 0.6)');
    const borderColors = data.map(value => value >= 0 ? 'rgba(75, 192, 192, 1)' : 'rgba(255, 99, 132, 1)');

    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Resultado (Receitas - Custos)',
                data: data,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 1
            }]
        },
        options: { scales: { y: { beginAtZero: true } }, responsive: true, plugins: { legend: { display: false } } }
    });
};

const renderHistory = () => {
    const list = document.getElementById('history-list');
    list.innerHTML = '';
    
    let allTransactions = [];
    projects.forEach(p => {
        p.transactions.forEach(t => {
            allTransactions.push({ ...t, projectName: p.name });
        });
    });

    const now = new Date();
    let startDate;
    if (historyFilters.period === 'week') {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1));
    } else if (historyFilters.period === 'month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else { // year
        startDate = new Date(now.getFullYear(), 0, 1);
    }
    startDate.setHours(0, 0, 0, 0);

    let filteredTransactions = allTransactions.filter(t => new Date(t.date) >= startDate);
    
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

    // Lógica para trocar os botões de navegação
    if (viewId === 'sectors-view') {
        createProjectBtn.classList.add('hidden');
        historyBtn.classList.remove('hidden');
    } else {
        createProjectBtn.classList.remove('hidden');
        historyBtn.classList.add('hidden');
    }

    // Lógica específica de cada view
    if (viewId === 'dashboard-view') renderChart();
    if (viewId === 'history-view') {
        populateFilters();
        renderHistory();
    }
    if (viewId === 'sectors-view') {
         const project = projects.find(p => p.id === currentProjectId);
         if(project) document.getElementById('sectors-project-name').textContent = project.name;
    }
};

const filterChart = (period) => {
    renderChart(period);
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('bg-indigo-600', btn.textContent.toLowerCase().includes(period));
        btn.classList.toggle('text-white', btn.textContent.toLowerCase().includes(period));
        btn.classList.toggle('bg-white', !btn.textContent.toLowerCase().includes(period));
        btn.classList.toggle('text-gray-700', !btn.textContent.toLowerCase().includes(period));
    });
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

// --- INICIALIZAÇÃO E EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    renderTotalBalance();
    renderProjects();
    renderInvestmentSources();

    document.getElementById('source-form').addEventListener('submit', (e) => {
        e.preventDefault();
        sources.push({
            id: `src_${Date.now()}`,
            name: document.getElementById('source-name').value,
            type: document.getElementById('source-type').value,
            balance: parseFloat(document.getElementById('source-balance').value)
        });
        saveData();
        renderTotalBalance();
        renderInvestmentSources();
        closeModal('source-modal');
        e.target.reset();
    });

    document.getElementById('project-form').addEventListener('submit', (e) => {
        e.preventDefault();
        projects.push({ id: `proj_${Date.now()}`, name: document.getElementById('project-name').value, transactions: [] });
        saveData();
        renderProjects();
        closeModal('project-modal');
        e.target.reset();
    });

    document.getElementById('transaction-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const sector = document.getElementById('transaction-sector').value;
        const subSector = document.getElementById('transaction-subsector').value;
        const type = document.getElementById('transaction-type').value;
        const amount = parseFloat(document.getElementById('transaction-amount').value);
        const description = document.getElementById('transaction-description').value;
        const date = document.getElementById('transaction-date').value;
        const project = projects.find(p => p.id === currentProjectId);

        if (!project) {
             console.error('Projeto inválido.');
             return;
        }

        if (sector === 'Financeiro' && subSector === 'Captação' && type === 'revenue') {
            const newSource = {
                id: `src_${Date.now()}`, name: description,
                type: document.getElementById('captacao-source-type').value, balance: amount
            };
            sources.push(newSource);
            project.transactions.push({ 
                type, description, amount, sector, subSector, 
                sourceId: newSource.id, date, captacaoType: newSource.type
            });
        } else {
            const sourceId = document.getElementById('transaction-source').value;
            const source = sources.find(s => s.id === sourceId);
            if (!source) {
                console.error('Fonte de Recurso inválida.');
                return;
            }
            source.balance += (type === 'revenue' ? amount : -amount);
            const newTransaction = { type, description, amount, sector, subSector, sourceId, date };
            if (sector === 'Financeiro' && subSector === 'Captação') {
                newTransaction.captacaoType = document.getElementById('captacao-source-type').value;
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

