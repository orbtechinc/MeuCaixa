// --- GERENCIAMENTO DE DADOS ---
let sources = [];
let projects = [];
let chartInstance = null;
let currentProjectId = null;
let transactionTypeSelectListener = null; // To manage event listeners

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
    // Chart rendering logic remains the same
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

// --- CONTROLE DA UI ---
const openModal = (modalId) => document.getElementById(modalId).classList.remove('hidden');
const closeModal = (modalId) => document.getElementById(modalId).classList.add('hidden');

const openTransactionModal = (sector, subSector) => {
    const project = projects.find(p => p.id === currentProjectId);
    if (!project) return;

    document.getElementById('transaction-project-name').textContent = `${project.name} / ${sector} / ${subSector}`;
    document.getElementById('transaction-sector').value = sector;
    document.getElementById('transaction-subsector').value = subSector;
    document.getElementById('transaction-date').valueAsDate = new Date();
    
    const captacaoFields = document.getElementById('captacao-fields');
    const transactionSourceWrapper = document.getElementById('transaction-source-wrapper');
    const transactionTypeSelect = document.getElementById('transaction-type');
    
    if (transactionTypeSelectListener) {
        transactionTypeSelect.removeEventListener('change', transactionTypeSelectListener);
    }

    if (sector === 'Financeiro' && subSector === 'Captação') {
        captacaoFields.classList.remove('hidden');
        
        transactionTypeSelectListener = () => {
            if (transactionTypeSelect.value === 'revenue') {
                transactionSourceWrapper.classList.add('hidden');
            } else {
                transactionSourceWrapper.classList.remove('hidden');
            }
        };
        transactionTypeSelect.addEventListener('change', transactionTypeSelectListener);
        transactionTypeSelectListener(); // Initial check
    } else {
        captacaoFields.classList.add('hidden');
        transactionSourceWrapper.classList.remove('hidden');
    }

    const sourceSelect = document.getElementById('transaction-source');
    sourceSelect.innerHTML = '';
    const relevantSources = (sector === 'Financeiro' && subSector === 'Captação')
        ? sources.filter(s => ['Investidor', 'Empréstimo', 'Crédito'].includes(s.type))
        : sources;
    
    if (relevantSources.length === 0) {
        sourceSelect.innerHTML = '<option disabled>Nenhuma fonte aplicável</option>';
    } else {
        relevantSources.forEach(source => {
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
    
    ['home-view', 'dashboard-view', 'sectors-view'].forEach(id => document.getElementById(id).classList.add('hidden'));
    document.getElementById(viewId).classList.remove('hidden');

    if (viewId === 'dashboard-view') renderChart();
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
        if (!project) return;

        let sourceId;

        if (sector === 'Financeiro' && subSector === 'Captação' && type === 'revenue') {
            const newSource = {
                id: `src_${Date.now()}`,
                name: description,
                type: document.getElementById('captacao-source-type').value,
                balance: amount
            };
            sources.push(newSource);
            sourceId = newSource.id;
        } else {
            sourceId = document.getElementById('transaction-source').value;
            const source = sources.find(s => s.id === sourceId);
            if (!source) {
                console.error('Fonte de investimento não selecionada ou inválida.');
                return;
            }
            source.balance += (type === 'revenue' ? amount : -amount);
        }

        project.transactions.push({ type, description, amount, sector, subSector, sourceId, date });
        
        saveData();
        renderProjects();
        renderTotalBalance();
        renderInvestmentSources();
        closeModal('transaction-modal');
        e.target.reset();
    });
});

