// --- GERENCIAMENTO DE DADOS ---
let sources = [];
let projects = [];
let chartInstance = null;
let currentProjectId = null;

// --- FUNÇÕES UTILITÁRIAS ---

// Formata um número para o padrão de moeda brasileira (R$)
const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

// Salva os dados atuais (fontes e projetos) no armazenamento local do navegador
const saveData = () => {
    localStorage.setItem('projectManagerData', JSON.stringify({ sources, projects }));
};

// Carrega os dados do armazenamento local ao iniciar o app (mais robusto)
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

// --- FUNÇÕES DE RENDERIZAÇÃO (Exibição na tela) ---

// Atualiza o saldo total consolidado no cabeçalho
const renderTotalBalance = () => {
    const total = sources.reduce((sum, source) => sum + parseFloat(source.balance), 0);
    document.getElementById('total-balance').textContent = formatCurrency(total);
};

// Desenha ou redesenha os cards de projeto no carrossel da tela inicial
const renderProjects = () => {
    const carousel = document.getElementById('project-carousel');
    carousel.innerHTML = ''; 

    if (projects.length === 0) {
        carousel.innerHTML = `
            <div class="flex-shrink-0 w-full max-w-xs mx-auto bg-white rounded-xl shadow-lg flex flex-col items-center justify-center text-center p-6 snap-center aspect-[1080/1220]">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
                <h3 class="font-bold text-lg">Nenhum projeto ainda</h3>
                <p class="text-gray-500">Clique em "Criar Projeto" para começar.</p>
            </div>`;
        return;
    }
    
    projects.forEach(project => {
        const projectCosts = project.transactions.filter(t => t.type === 'cost').reduce((sum, t) => sum + t.amount, 0);
        const projectRevenue = project.transactions.filter(t => t.type === 'revenue').reduce((sum, t) => sum + t.amount, 0);
        const projectBalance = projectRevenue - projectCosts;
        
        const card = document.createElement('div');
        card.className = "flex-shrink-0 w-full max-w-xs mx-auto bg-white rounded-xl shadow-lg flex flex-col p-6 snap-center cursor-pointer hover:shadow-xl transition aspect-[1080/1220]";
        card.setAttribute('onclick', `switchView('sectors-view', '${project.id}')`);
        card.innerHTML = `
            <div class="flex-grow flex flex-col justify-center">
                <h3 class="font-bold text-2xl text-gray-800">${project.name}</h3>
                <p class="text-sm text-gray-400 mt-2">Balanço do Projeto</p>
                <p class="text-4xl font-bold ${projectBalance >= 0 ? 'text-green-500' : 'text-red-500'} mt-2">${formatCurrency(projectBalance)}</p>
            </div>
            <div class="text-xs text-center text-indigo-500 font-semibold mt-4">CLIQUE PARA VER SETORES</div>
        `;
        carousel.appendChild(card);
    });
};

// Desenha o gráfico de resultados com base no período (semana/mês)
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
        options: {
            scales: { y: { beginAtZero: true } },
            responsive: true,
            plugins: { legend: { display: false } }
        }
    });
};

// --- CONTROLE DA INTERFACE DO USUÁRIO (UI) ---

// Funções para abrir e fechar modais
const openModal = (modalId) => document.getElementById(modalId).classList.remove('hidden');
const closeModal = (modalId) => document.getElementById(modalId).classList.add('hidden');

// Abre o modal de transação, preenchendo informações do projeto e setor
const openTransactionModal = (sector, subSector) => {
    const project = projects.find(p => p.id === currentProjectId);
    if (!project) return;

    document.getElementById('transaction-project-name').textContent = `${project.name} / ${sector} / ${subSector}`;
    document.getElementById('transaction-sector').value = sector;
    document.getElementById('transaction-subsector').value = subSector;
    document.getElementById('transaction-date').valueAsDate = new Date();
    
    const sourceSelect = document.getElementById('transaction-source');
    sourceSelect.innerHTML = ''; // Limpa opções antigas
    if (sources.length === 0) {
         sourceSelect.innerHTML = '<option disabled>Crie uma fonte primeiro</option>';
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

// Alterna entre as "páginas" (views) do aplicativo
const switchView = (viewId, projectId = null) => {
    if (projectId) currentProjectId = projectId;
    
    const views = ['home-view', 'dashboard-view', 'sectors-view'];
    views.forEach(id => document.getElementById(id).classList.add('hidden'));
    document.getElementById(viewId).classList.remove('hidden');

    const dashBtn = document.querySelector('.nav-btn-dash');
    
    dashBtn.classList.toggle('text-indigo-600', viewId === 'dashboard-view');
    dashBtn.classList.toggle('text-gray-500', viewId !== 'dashboard-view');

    if (viewId === 'dashboard-view') renderChart();
    if (viewId === 'sectors-view') {
         const project = projects.find(p => p.id === currentProjectId);
         if(project) document.getElementById('sectors-project-name').textContent = project.name;
    }
};

// Filtra os dados do gráfico por período e atualiza o estilo dos botões
const filterChart = (period) => {
    renderChart(period);
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('bg-indigo-600', 'text-white');
        btn.classList.add('bg-white', 'text-gray-700');
    });
    const activeButton = document.querySelector(`.filter-btn[onclick="filterChart('${period}')"]`);
    activeButton.classList.add('bg-indigo-600', 'text-white');
    activeButton.classList.remove('bg-white', 'text-gray-700');
}

// --- EVENT LISTENERS E INICIALIZAÇÃO ---

// Roda quando o conteúdo da página é carregado pela primeira vez
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    renderTotalBalance();
    renderProjects();

    // Formulário de adicionar Fonte de Investimento
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
        closeModal('source-modal');
        e.target.reset();
    });

    // Formulário de adicionar Projeto
    document.getElementById('project-form').addEventListener('submit', (e) => {
        e.preventDefault();
        projects.push({
            id: `proj_${Date.now()}`,
            name: document.getElementById('project-name').value,
            transactions: []
        });
        saveData();
        renderProjects();
        closeModal('project-modal');
        e.target.reset();
    });

    // Formulário de adicionar Transação
    document.getElementById('transaction-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const type = document.getElementById('transaction-type').value;
        const amount = parseFloat(document.getElementById('transaction-amount').value);
        const sourceId = document.getElementById('transaction-source').value;
        
        const project = projects.find(p => p.id === currentProjectId);
        const source = sources.find(s => s.id === sourceId);

        if(!project || !source) {
            console.error('Erro: Projeto ou fonte de investimento não encontrada. A transação não foi salva.');
            return;
        }

        project.transactions.push({
            type: type,
            description: document.getElementById('transaction-description').value,
            amount: amount,
            sector: document.getElementById('transaction-sector').value,
            subSector: document.getElementById('transaction-subsector').value,
            sourceId: sourceId,
            date: document.getElementById('transaction-date').value
        });
        
        // Atualiza o saldo da fonte de investimento
        if (type === 'revenue') {
            source.balance += amount;
        } else { // cost
            source.balance -= amount;
        }

        saveData();
        renderProjects();
        renderTotalBalance();
        closeModal('transaction-modal');
        e.target.reset();
    });
});

