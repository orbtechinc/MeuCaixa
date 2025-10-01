// Ativa os ícones do Lucide
lucide.createIcons();

document.addEventListener('DOMContentLoaded', () => {
    // --- STATE MANAGEMENT (Dados do App) ---
    let investments = [];
    let projects = [];
    let currentProjectIndex = 0;
    let currentSectorIndex = 0;
    let activeProjectId = null;
    let pendingOperationContext = null;
    let chartContext = 'projects'; // 'projects' or 'subsectors'
    let activeFilter = 'anual';
    let activeHistoryPeriod = 'todos';

    // --- ELEMENT SELECTORS ---
    const homePage = document.getElementById('home-page');
    const sectorsPage = document.getElementById('sectors-page');
    const historyPage = document.getElementById('history-page');
    const resultsPage = document.getElementById('results-page');
    const investmentModal = document.getElementById('investment-modal');
    const projectModal = document.getElementById('project-modal');
    const operationModal = document.getElementById('operation-modal');
    const projectChartContainer = document.getElementById('project-chart-container');
    const subsectorChartsContainer = document.getElementById('subsector-charts-container');

    const totalBalanceEl = document.getElementById('total-balance');
    const projectCarousel = document.getElementById('project-carousel');
    const carouselDots = document.getElementById('carousel-dots');
    const investmentList = document.getElementById('investment-list');
    const sectorsCarousel = document.getElementById('sectors-carousel');
    const sectorsCarouselDots = document.getElementById('sectors-carousel-dots');
    const operationList = document.getElementById('operation-list');
    
    const addInvestmentBtn = document.getElementById('add-investment-btn');
    const addProjectBtn = document.getElementById('add-project-btn');
    const showHistoryBtn = document.getElementById('show-history-btn');
    const showResultsBtn = document.getElementById('show-results-btn');
    const backToHomeBtn = document.getElementById('back-to-home-btn');
    const backToHomeFromSectorsBtn = document.getElementById('back-to-home-from-sectors-btn');
    const backToSectorsBtn = document.getElementById('back-to-sectors-btn');

    const investmentForm = document.getElementById('investment-form');
    const projectForm = document.getElementById('project-form');
    const operationForm = document.getElementById('operation-form');
    const bottomNav = document.getElementById('bottom-nav');


    // --- MODAL VISIBILITY FUNCTIONS ---
    function showModal(modal) {
        modal.classList.remove('invisible', 'opacity-0');
        modal.querySelector('.modal-content').classList.remove('scale-95');
    }
    function hideModal(modal) {
        modal.classList.add('opacity-0');
        modal.querySelector('.modal-content').classList.add('scale-95');
        setTimeout(() => modal.classList.add('invisible'), 300);
    }

    function toggleNavBar(show) {
        if (show) {
            bottomNav.classList.remove('hidden');
        } else {
            bottomNav.classList.add('hidden');
        }
    }

    // --- RENDER FUNCTIONS ---
    function updateTotalBalance() {
        const totalInitialBalance = investments.reduce((sum, inv) => sum + inv.initial_balance, 0);

        let totalRevenue = 0;
        let totalCost = 0;
        projects.forEach(project => {
            project.transactions.forEach(t => {
                if (t.type === 'revenue') {
                    totalRevenue += t.amount;
                } else if (t.type === 'cost') {
                    totalCost += t.amount;
                }
            });
        });

        const currentTotalBalance = totalInitialBalance + totalRevenue - totalCost;

        totalBalanceEl.textContent = currentTotalBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        totalBalanceEl.classList.toggle('text-green-400', currentTotalBalance >= 0);
        totalBalanceEl.classList.toggle('text-red-400', currentTotalBalance < 0);
    }

    function renderInvestments() {
        investmentList.innerHTML = '';
        if (investments.length === 0) {
            investmentList.innerHTML = `<p class="text-center text-sm text-gray-500 py-4">Nenhuma fonte cadastrada.</p>`;
            return;
        }

        const iconMap = {
            'Bancos': 'landmark',
            'Corretoras': 'area-chart',
            'Investidores': 'users',
            'Dinheiro Vivo': 'wallet'
        };

        investments.forEach(inv => {
            let currentSourceBalance = inv.initial_balance;
            projects.forEach(project => {
                project.transactions.forEach(t => {
                    if (t.source === inv.name) {
                        if (t.type === 'revenue') {
                            currentSourceBalance += t.amount;
                        } else if (t.type === 'cost') {
                            currentSourceBalance -= t.amount;
                        }
                    }
                });
            });

            const item = document.createElement('div');
            item.className = 'bg-gray-800/80 p-3 rounded-lg flex justify-between items-center';
            item.innerHTML = `
                <div class="flex items-center space-x-3">
                    <i data-lucide="${iconMap[inv.type] || 'piggy-bank'}" class="w-5 h-5 text-gray-400"></i>
                    <div>
                        <p class="font-semibold text-sm">${inv.name}</p>
                        <p class="text-xs text-gray-500">${inv.type}</p>
                    </div>
                </div>
                <span class="font-bold text-sm ${currentSourceBalance >= 0 ? 'text-green-400' : 'text-red-400'}">${currentSourceBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
            `;
            investmentList.appendChild(item);
        });
        lucide.createIcons();
    }

    function renderProjects() {
        projectCarousel.innerHTML = '';
        carouselDots.innerHTML = '';
        if (projects.length === 0) {
            projectCarousel.innerHTML = `
                <div class="w-full flex-shrink-0 h-full flex items-center justify-center">
                    <div class="text-center text-gray-500">
                        <i data-lucide="folder-search" class="w-16 h-16 mx-auto mb-2"></i>
                        <p>Nenhum projeto criado.</p>
                        <p>Clique em "Novo Projeto" para começar.</p>
                    </div>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        projects.forEach((project, index) => {
            const projectSlide = document.createElement('div');
            projectSlide.className = 'w-full flex-shrink-0 h-full flex items-center justify-center';

            const projectCard = document.createElement('div');
            projectCard.className = 'w-[80%] h-[90%] rounded-2xl shadow-lg cursor-pointer bg-gradient-to-br from-gray-700 to-gray-800 flex flex-col p-4 sm:p-6';
            projectCard.dataset.projectId = project.id;
            
            const revenue = project.transactions.filter(t => t.type === 'revenue').reduce((s, t) => s + t.amount, 0);
            const cost = project.transactions.filter(t => t.type === 'cost').reduce((s, t) => s + t.amount, 0);
            const result = revenue - cost;
            
            projectCard.innerHTML = `
                <h3 class="text-2xl font-bold text-white truncate text-center">${project.name}</h3>
                <div class="flex-grow flex flex-col justify-center items-center">
                    <span class="text-gray-400">Resultado</span>
                    <p class="text-4xl sm:text-5xl font-bold ${result >= 0 ? 'text-green-400' : 'text-red-400'}">
                        ${result.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                </div>
            `;

            projectCard.addEventListener('click', () => openSectorsPage(project.id));
            
            projectSlide.appendChild(projectCard);
            projectCarousel.appendChild(projectSlide);

            const dot = document.createElement('div');
            dot.className = `w-2 h-2 rounded-full transition-colors ${index === currentProjectIndex ? 'bg-indigo-500' : 'bg-gray-600'}`;
            dot.dataset.index = index;
            carouselDots.appendChild(dot);
        });

        lucide.createIcons();
        updateCarouselPosition();
    }

    function renderOperations(project) {
        operationList.innerHTML = '';

        // Get filter values
        const selectedSector = document.getElementById('history-sector-filter').value;
        const selectedSubSector = document.getElementById('history-subsector-filter').value;
        
        const now = new Date();
        let startDate;
        switch (activeHistoryPeriod) {
            case 'semana':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
                break;
            case 'mes':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'anual':
                startDate = new Date(now.getFullYear(), 0, 1);
                break;
            case 'todos':
            default:
                startDate = null; // No date filter
                break;
        }
        if(startDate) startDate.setHours(0,0,0,0);

        let filteredTransactions = project.transactions.filter(op => {
            const opDate = new Date(op.date);
            opDate.setMinutes(opDate.getMinutes() + opDate.getTimezoneOffset());

            const periodMatch = !startDate || opDate >= startDate;
            const sectorMatch = selectedSector === 'todos' || op.sector === selectedSector;
            const subSectorMatch = selectedSubSector === 'todos' || op.subsector === selectedSubSector;

            return periodMatch && sectorMatch && subSectorMatch;
        });

        if (filteredTransactions.length === 0) {
            operationList.innerHTML = `
                <div class="text-center text-gray-500 pt-16">
                    <i data-lucide="search-x" class="w-16 h-16 mx-auto mb-2"></i>
                    <p>Nenhuma operação encontrada com os filtros selecionados.</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        const sortedTransactions = filteredTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

        sortedTransactions.forEach(op => {
            const isRevenue = op.type === 'revenue';
            const item = document.createElement('div');
            item.className = 'bg-gray-800 p-3 rounded-lg flex items-center';
            item.innerHTML = `
                <div class="mr-3 p-2 rounded-full ${isRevenue ? 'bg-green-500/20' : 'bg-red-500/20'}">
                    <i data-lucide="${isRevenue ? 'arrow-up-right' : 'arrow-down-left'}" class="w-5 h-5 ${isRevenue ? 'text-green-400' : 'text-red-400'}"></i>
                </div>
                <div class="flex-grow">
                    <div class="flex justify-between items-center">
                        <p class="font-bold truncate pr-2">${op.name}</p>
                        <p class="font-bold text-sm ${isRevenue ? 'text-green-400' : 'text-red-400'}">
                            ${isRevenue ? '+' : '-'} ${op.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                    </div>
                    <div class="flex justify-between items-center text-xs text-gray-400 mt-1">
                        <span>${new Date(op.date).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</span>
                        <span>${op.sector} / ${op.subsector}</span>
                    </div>
                </div>
            `;
            operationList.appendChild(item);
        });
        lucide.createIcons();
    }
    
    function updateSectorTotals(projectId) {
        const project = projects.find(p => p.id == projectId);
        if (!project) return;

        const sectorIdMap = {
            'Financeiro': 'finance',
            'Operacional': 'operational',
            'Comercial': 'commercial'
        };

        Object.keys(sectorIdMap).forEach(sectorName => {
            const sectorTransactions = project.transactions.filter(t => t.sector === sectorName);
            const revenue = sectorTransactions.filter(t => t.type === 'revenue').reduce((s, t) => s + t.amount, 0);
            const cost = sectorTransactions.filter(t => t.type === 'cost').reduce((s, t) => s + t.amount, 0);
            const result = revenue - cost;
            const sectorId = sectorIdMap[sectorName];

            document.getElementById(`${sectorId}-revenue`).textContent = `+ ${revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
            document.getElementById(`${sectorId}-cost`).textContent = `- ${cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
            const resultEl = document.getElementById(`${sectorId}-result`);
            resultEl.textContent = result.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            resultEl.className = `font-bold ${result >= 0 ? 'text-green-400' : 'text-red-400'}`;
        });
    }


    // --- PAGE NAVIGATION & LOGIC ---
    function updateNav(page) {
        if (page === 'sectors') {
            addProjectBtn.classList.add('hidden');
            showHistoryBtn.classList.remove('hidden');
        } else { // 'home', 'results', 'history' etc. all revert to home nav
            addProjectBtn.classList.remove('hidden');
            showHistoryBtn.classList.add('hidden');
        }
    }

    function openSectorsPage(projectId) {
        activeProjectId = projectId;
        const project = projects.find(p => p.id == projectId);
        if (!project) return;
        
        document.getElementById('sectors-project-name').textContent = project.name;
        
        updateSectorTotals(projectId);
        
        homePage.classList.add('hidden');
        historyPage.classList.add('hidden');
        resultsPage.classList.add('hidden');
        sectorsPage.classList.remove('hidden');
        sectorsPage.classList.add('flex');
        updateNav('sectors');
        initializeSectorCarousel();
    }

    function openHistoryPage(projectId) {
        const project = projects.find(p => p.id == projectId);
        if (!project) return;

        document.getElementById('history-project-name').textContent = project.name;
        
        homePage.classList.add('hidden');
        sectorsPage.classList.add('hidden');
        resultsPage.classList.add('hidden');
        historyPage.classList.remove('hidden');
        historyPage.classList.add('flex');
        toggleNavBar(false);

        renderOperations(project);
    }

    function openOperationModal(sector, subsector) {
        document.getElementById('operation-sector-label').textContent = sector;
        document.getElementById('operation-subsector-label').textContent = subsector;
        document.getElementById('operation-sector').value = sector;
        document.getElementById('operation-subsector').value = subsector;

        const sourceSelect = document.getElementById('operation-source');
        sourceSelect.innerHTML = '';

        if (investments.length === 0) {
            sourceSelect.innerHTML = `<option value="" disabled selected>Nenhuma fonte cadastrada</option>`;
        } else {
            investments.forEach(inv => {
                const option = document.createElement('option');
                option.value = inv.name;
                option.textContent = `${inv.name} (${inv.type})`;
                sourceSelect.appendChild(option);
            });
        }
        
        const addNewOption = document.createElement('option');
        addNewOption.value = 'add_new';
        addNewOption.textContent = '＋ Adicionar nova fonte...';
        addNewOption.className = 'text-indigo-400 font-bold';
        sourceSelect.appendChild(addNewOption);
        
        document.getElementById('operation-date').valueAsDate = new Date();
        showModal(operationModal);
    }

    // --- EVENT LISTENERS ---
    addInvestmentBtn.addEventListener('click', () => showModal(investmentModal));
    document.getElementById('cancel-investment').addEventListener('click', () => {
        if (pendingOperationContext) {
            hideModal(investmentModal);
            openOperationModal(pendingOperationContext.sector, pendingOperationContext.subsector);
            pendingOperationContext = null;
        } else {
            hideModal(investmentModal);
        }
    });
    
    addProjectBtn.addEventListener('click', () => {
        document.getElementById('project-modal').querySelector('h2').textContent = 'Novo Projeto';
        showModal(projectModal)
    });
    document.getElementById('cancel-project').addEventListener('click', () => hideModal(projectModal));
    
    document.getElementById('cancel-operation').addEventListener('click', () => hideModal(operationModal));

    sectorsCarousel.addEventListener('click', (e) => {
        const card = e.target.closest('.sub-sector-card');
        if (card) {
            const { sector, subsector } = card.dataset;
            openOperationModal(sector, subsector);
        }
    });

    showHistoryBtn.addEventListener('click', () => {
        if (activeProjectId) {
            openHistoryPage(activeProjectId);
        }
    });

    document.getElementById('operation-source').addEventListener('change', (e) => {
        if (e.target.value === 'add_new') {
            pendingOperationContext = {
                sector: document.getElementById('operation-sector').value,
                subsector: document.getElementById('operation-subsector').value,
            };
            e.target.value = ''; 
            hideModal(operationModal);
            showModal(investmentModal);
        }
    });

    [investmentModal, projectModal, operationModal].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) hideModal(modal);
        });
    });

    showResultsBtn.addEventListener('click', () => {
        if (!sectorsPage.classList.contains('hidden')) {
            chartContext = 'subsectors';
        } else {
            chartContext = 'projects';
        }

        homePage.classList.add('hidden');
        sectorsPage.classList.add('hidden');
        historyPage.classList.add('hidden');
        resultsPage.classList.remove('hidden');
        resultsPage.classList.add('flex');
        toggleNavBar(false);
        renderActiveChart();
    });
    
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            filterButtons.forEach(btn => {
                btn.classList.remove('bg-indigo-600');
                btn.classList.add('bg-gray-700', 'hover:bg-gray-600');
            });
            button.classList.add('bg-indigo-600');
            button.classList.remove('bg-gray-700', 'hover:bg-gray-600');

            activeFilter = button.dataset.filter;
            renderActiveChart();
        });
    });

    backToHomeBtn.addEventListener('click', () => {
        resultsPage.classList.add('hidden');
        resultsPage.classList.remove('flex');
        toggleNavBar(true);
        if (chartContext === 'subsectors' && activeProjectId) {
            openSectorsPage(activeProjectId);
        } else {
            homePage.classList.remove('hidden');
            homePage.classList.add('flex');
            updateNav('home');
        }
    });
    backToHomeFromSectorsBtn.addEventListener('click', () => {
        sectorsPage.classList.add('hidden');
        sectorsPage.classList.remove('flex');
        homePage.classList.remove('hidden');
        homePage.classList.add('flex');
        renderProjects();
        updateNav('home');
        toggleNavBar(true);
    });
    backToSectorsBtn.addEventListener('click', () => {
        historyPage.classList.add('hidden');
        historyPage.classList.remove('flex');
        toggleNavBar(true);
        openSectorsPage(activeProjectId);
    });
    
    investmentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const newInvestment = {
            type: document.getElementById('investment-type').value,
            name: document.getElementById('investment-name').value,
            initial_balance: parseFloat(document.getElementById('investment-balance').value) || 0
        };
        if(newInvestment.name) {
            investments.push(newInvestment);
            updateTotalBalance();
            renderInvestments();
            investmentForm.reset();
            
            if (pendingOperationContext) {
                hideModal(investmentModal);
                openOperationModal(pendingOperationContext.sector, pendingOperationContext.subsector);
                pendingOperationContext = null; 
            } else {
                hideModal(investmentModal);
            }
        }
    });

    projectForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const projectName = document.getElementById('project-name').value;
        if(projectName) {
            const newProject = {
                id: Date.now(),
                name: projectName,
                transactions: []
            };
            projects.push(newProject);
            currentProjectIndex = projects.length - 1;
            renderProjects();
            projectForm.reset();
            hideModal(projectModal);
        }
    });

    operationForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const project = projects.find(p => p.id == activeProjectId);
        if (!project) return;
        
        const newTransaction = {
            id: Date.now(),
            name: document.getElementById('operation-name').value,
            date: document.getElementById('operation-date').value,
            type: document.getElementById('operation-type').value,
            amount: parseFloat(document.getElementById('operation-amount').value),
            source: document.getElementById('operation-source').value,
            sector: document.getElementById('operation-sector').value,
            subsector: document.getElementById('operation-subsector').value,
        };

        if (!newTransaction.source || newTransaction.source === 'add_new') {
            // Adicionar um alerta visual aqui no futuro
            console.error("Fonte de investimento inválida.");
            return;
        }
        
        project.transactions.push(newTransaction);
        
        updateTotalBalance();
        renderInvestments();
        updateSectorTotals(activeProjectId);

        operationForm.reset();
        hideModal(operationModal);
    });


    // --- History Page Filter Listeners ---
    document.querySelectorAll('.history-period-btn').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.history-period-btn').forEach(btn => {
                btn.classList.remove('bg-indigo-600');
                btn.classList.add('bg-gray-700', 'hover:bg-gray-600');
            });
            button.classList.add('bg-indigo-600');
            button.classList.remove('bg-gray-700', 'hover:bg-gray-600');
            activeHistoryPeriod = button.dataset.period;
            const project = projects.find(p => p.id == activeProjectId);
            if(project) renderOperations(project);
        });
    });

    const historySectorFilter = document.getElementById('history-sector-filter');
    const historySubSectorFilter = document.getElementById('history-subsector-filter');

    historySectorFilter.addEventListener('change', () => {
        const selectedSector = historySectorFilter.value;
        document.querySelectorAll('#history-subsector-filter optgroup').forEach(group => {
            group.hidden = !(selectedSector === 'todos' || group.label === selectedSector);
        });
        historySubSectorFilter.value = 'todos'; // Reset subsector filter
        const project = projects.find(p => p.id == activeProjectId);
        if(project) renderOperations(project);
    });

    historySubSectorFilter.addEventListener('change', () => {
        const project = projects.find(p => p.id == activeProjectId);
        if(project) renderOperations(project);
    });


    // --- CAROUSEL LOGIC ---
    function setupCarousel(carouselEl, dotsEl, indexState) {
        let isDragging = false, startPos = 0, currentTranslate = 0, prevTranslate = 0;
        let currentIndex = indexState.get();

        function updatePosition() {
            const container = carouselEl.parentElement;
            if (!container) return;
            const slideWidth = container.offsetWidth;
            currentTranslate = currentIndex * -slideWidth;
            carouselEl.style.transform = `translateX(${currentTranslate}px)`;
            prevTranslate = currentTranslate;
            updateDots();
        }

        function updateDots() {
            if (!dotsEl) return;
            Array.from(dotsEl.children).forEach((dot, index) => {
                dot.classList.toggle('bg-indigo-500', index === currentIndex);
                dot.classList.toggle('bg-gray-600', index !== currentIndex);
            });
        }

        carouselEl.addEventListener('touchstart', (e) => {
            if (carouselEl.children.length <= 1) return;
            isDragging = true;
            startPos = e.touches[0].clientX;
            carouselEl.style.transition = 'none';
        });

        carouselEl.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            const currentPosition = e.touches[0].clientX;
            currentTranslate = prevTranslate + currentPosition - startPos;
            carouselEl.style.transform = `translateX(${currentTranslate}px)`;
        });

        carouselEl.addEventListener('touchend', (e) => {
            if (!isDragging) return;
            isDragging = false;
            const movedBy = currentTranslate - prevTranslate;
            const slideWidth = carouselEl.parentElement.offsetWidth;

            if (movedBy < -slideWidth / 4 && currentIndex < carouselEl.children.length - 1) {
                currentIndex++;
            }
            if (movedBy > slideWidth / 4 && currentIndex > 0) {
                currentIndex--;
            }

            indexState.set(currentIndex);
            carouselEl.style.transition = 'transform 0.4s ease-in-out';
            updatePosition();
        });

        return { updatePosition };
    }

    const projectCarouselState = {
        get: () => currentProjectIndex,
        set: (val) => { currentProjectIndex = val; }
    };
     const sectorCarouselState = {
        get: () => currentSectorIndex,
        set: (val) => { currentSectorIndex = val; }
    };

    const { updatePosition: updateCarouselPosition } = setupCarousel(projectCarousel, carouselDots, projectCarouselState);
    const { updatePosition: updateSectorCarouselPosition } = setupCarousel(sectorsCarousel, sectorsCarouselDots, sectorCarouselState);

    function initializeSectorCarousel() {
        sectorsCarouselDots.innerHTML = '';
        const sectorCount = sectorsCarousel.children.length;
        for (let i = 0; i < sectorCount; i++) {
            const dot = document.createElement('div');
            dot.className = 'w-2 h-2 rounded-full transition-colors';
            sectorsCarouselDots.appendChild(dot);
        }
        sectorCarouselState.set(0);
        updateSectorCarouselPosition();
    }

    window.addEventListener('resize', () => {
        setTimeout(() => {
            updateCarouselPosition();
            updateSectorCarouselPosition();
        }, 100);
    });

    // --- CHART LOGIC ---
    let subSectorCharts = []; // for the individual sub-sector charts
    let projectCharts = [];

    const pieTooltipCallback = function(context) {
        const label = context.label || '';
        const value = context.raw;
        const total = context.chart.getDatasetMeta(0).total;
        const percentage = total > 0 ? ((value / total) * 100).toFixed(2) + '%' : '0%';
        return `${label}: ${value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (${percentage})`;
    };

    function getPeriodConfig(filter) {
        const now = new Date();
        const labels = [];
        let startDate;

        switch (filter) {
            case 'semana':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
                startDate.setHours(0, 0, 0, 0);
                for (let i = 0; i < 7; i++) {
                    const d = new Date(startDate);
                    d.setDate(d.getDate() + i);
                    labels.push(d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
                }
                break;
            case 'mes':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                for (let i = 1; i <= daysInMonth; i++) {
                    labels.push(i.toString());
                }
                break;
            case 'pizza': // Pizza chart uses full range, but we need a start date for filtering
            case 'anual':
            default:
                startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
                for (let i = 11; i >= 0; i--) {
                    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                    labels.push(d.toLocaleString('pt-BR', { month: 'short' }).replace('.', '') + '/' + d.getFullYear().toString().slice(-2));
                }
                break;
        }
        return { labels, startDate };
    }

    function destroyCharts() {
        subSectorCharts.forEach(chart => chart.destroy());
        subSectorCharts = [];
        projectCharts.forEach(chart => chart.destroy());
        projectCharts = [];
    }

    function renderActiveChart() {
        destroyCharts(); // Clear previous charts before rendering new ones
        if (chartContext === 'subsectors') {
            projectChartContainer.classList.add('hidden');
            subsectorChartsContainer.classList.remove('hidden');
            renderSubSectorCharts(activeProjectId);
        } else {
            subsectorChartsContainer.classList.add('hidden');
            projectChartContainer.classList.remove('hidden');
            renderProjectsChart();
        }
    }

    function renderSubSectorCharts(projectId) {
        const project = projects.find(p => p.id == projectId);
        if (!project) return;
        
        subsectorChartsContainer.innerHTML = ''; 
        const periodConfig = getPeriodConfig(activeFilter);
        
        const subSectors = [
            "Planejamento", "Captação", "Recursos",
            "Treinamento", "Armazenamento", "Produção",
            "Marketing", "Relacionamento", "Resultados"
        ];

        if (activeFilter === 'pizza') {
            subsectorChartsContainer.className = 'grid grid-cols-1 md:grid-cols-2 gap-4';
            
            const relevantTransactions = project.transactions.filter(t => new Date(t.date) >= periodConfig.startDate);

            const costData = { labels: [], data: [] };
            const revenueData = { labels: [], data: [] };

            subSectors.forEach(sub => {
                const cost = relevantTransactions.filter(t => t.subsector === sub && t.type === 'cost').reduce((sum, t) => sum + t.amount, 0);
                if (cost > 0) {
                    costData.labels.push(sub);
                    costData.data.push(cost);
                }
                const revenue = relevantTransactions.filter(t => t.subsector === sub && t.type === 'revenue').reduce((sum, t) => sum + t.amount, 0);
                if (revenue > 0) {
                    revenueData.labels.push(sub);
                    revenueData.data.push(revenue);
                }
            });

            const pieColors = ['#818cf8', '#60a5fa', '#34d399', '#a78bfa', '#f87171', '#fb923c', '#facc15', '#4ade80', '#2dd4bf'];

            if (revenueData.data.length > 0) {
                const revenueChartWrapper = document.createElement('div');
                revenueChartWrapper.className = 'bg-gray-800 p-4 rounded-xl';
                revenueChartWrapper.innerHTML = `<h3 class="text-lg font-semibold text-center mb-2">Receitas</h3><canvas id="revenue-pie-chart"></canvas>`;
                subsectorChartsContainer.appendChild(revenueChartWrapper);
                const revChart = new Chart(document.getElementById('revenue-pie-chart'), {
                    type: 'pie',
                    data: { labels: revenueData.labels, datasets: [{ data: revenueData.data, backgroundColor: pieColors }] },
                    options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#d1d5db' } }, tooltip: { callbacks: { label: pieTooltipCallback } } } }
                });
                subSectorCharts.push(revChart);
            }
            if (costData.data.length > 0) {
                const costChartWrapper = document.createElement('div');
                costChartWrapper.className = 'bg-gray-800 p-4 rounded-xl';
                costChartWrapper.innerHTML = `<h3 class="text-lg font-semibold text-center mb-2">Custos</h3><canvas id="cost-pie-chart"></canvas>`;
                subsectorChartsContainer.appendChild(costChartWrapper);
                const costChart = new Chart(document.getElementById('cost-pie-chart'), {
                    type: 'pie',
                    data: { labels: costData.labels, datasets: [{ data: costData.data, backgroundColor: pieColors }] },
                    options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#d1d5db' } }, tooltip: { callbacks: { label: pieTooltipCallback } } } }
                });
                subSectorCharts.push(costChart);
            }
            if (revenueData.data.length === 0 && costData.data.length === 0) {
                 subsectorChartsContainer.innerHTML = `<p class="text-center text-gray-500 pt-16 col-span-full">Nenhuma operação para exibir nos gráficos.</p>`;
            }

        } else {
            subsectorChartsContainer.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4';
            const chartLabels = periodConfig.labels;
            const now = new Date();
            
            subSectors.forEach((subSector, index) => {
                const chartId = `subsector-chart-${index}`;
                const chartWrapper = document.createElement('div');
                chartWrapper.className = 'bg-gray-800 p-2 rounded-xl flex flex-col';
                chartWrapper.innerHTML = `
                    <h3 class="text-xs sm:text-sm font-semibold text-center text-gray-300 truncate">${subSector}</h3>
                    <div class="flex-grow h-40">
                        <canvas id="${chartId}"></canvas>
                    </div>
                `;
                subsectorChartsContainer.appendChild(chartWrapper);
                
                const ctx = document.getElementById(chartId).getContext('2d');
                const relevantTransactions = project.transactions.filter(t => {
                    const transactionDate = new Date(t.date);
                    transactionDate.setMinutes(transactionDate.getMinutes() + transactionDate.getTimezoneOffset());
                    return t.subsector === subSector && transactionDate >= periodConfig.startDate;
                });
                
                const chartData = Array(chartLabels.length).fill(0);
                
                relevantTransactions.forEach(t => {
                    const transactionDate = new Date(t.date);
                    transactionDate.setMinutes(transactionDate.getMinutes() + transactionDate.getTimezoneOffset());
                    const value = t.type === 'revenue' ? t.amount : -t.amount;
                    
                    let idx = -1;
                    switch (activeFilter) {
                        case 'semana':
                            idx = Math.floor((transactionDate - periodConfig.startDate) / (1000 * 60 * 60 * 24));
                            break;
                        case 'mes':
                            if (transactionDate.getFullYear() === now.getFullYear() && transactionDate.getMonth() === now.getMonth()) idx = transactionDate.getDate() - 1;
                            break;
                        case 'anual':
                        default:
                            idx = (transactionDate.getFullYear() - periodConfig.startDate.getFullYear()) * 12 + (transactionDate.getMonth() - periodConfig.startDate.getMonth());
                            break;
                    }
                    if (idx >= 0 && idx < chartData.length) chartData[idx] += value;
                });

                const newChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: chartLabels,
                        datasets: [{ label: 'Resultado', data: chartData, borderColor: 'rgb(99, 102, 241)', tension: 0.2, pointRadius: 1, pointBackgroundColor: 'rgb(99, 102, 241)' }]
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        scales: {
                            y: { ticks: { display: true, color: '#9CA3AF', font: { size: 10 }, callback: (v) => (v/1000)+'k' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } },
                            x: { ticks: { display: true, color: '#9CA3AF', font: { size: 10 }, autoSkip: true, maxRotation: 45 }, grid: { display: false } }
                        },
                        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `R$ ${c.raw.toFixed(2)}` } } }
                    }
                });
                subSectorCharts.push(newChart);
            });
        }
        document.querySelector('#results-page h1').textContent = `Resultados: ${project.name}`;
    }

    function renderProjectsChart() {
        const periodConfig = getPeriodConfig(activeFilter);
        projectChartContainer.innerHTML = ''; // Clear container

        if (activeFilter === 'pizza') {
            projectChartContainer.className = 'grid grid-cols-1 md:grid-cols-2 gap-4';
            
            const revenueData = { labels: [], data: [] };
            const costData = { labels: [], data: [] };

             projects.forEach(p => {
                const relevantTransactions = p.transactions.filter(t => new Date(t.date) >= periodConfig.startDate);
                const revenue = relevantTransactions.filter(t => t.type === 'revenue').reduce((s, t) => s + t.amount, 0);
                if (revenue > 0) {
                    revenueData.labels.push(p.name);
                    revenueData.data.push(revenue);
                }
                const cost = relevantTransactions.filter(t => t.type === 'cost').reduce((s, t) => s + t.amount, 0);
                if (cost > 0) {
                    costData.labels.push(p.name);
                    costData.data.push(cost);
                }
            });

            const pieColors = ['#818cf8', '#60a5fa', '#34d399', '#a78bfa', '#f87171', '#fb923c', '#facc15', '#4ade80', '#2dd4bf'];

            if (revenueData.data.length > 0) {
                const revenueChartWrapper = document.createElement('div');
                revenueChartWrapper.className = 'bg-gray-800 p-4 rounded-xl';
                revenueChartWrapper.innerHTML = `<h3 class="text-lg font-semibold text-center mb-2">Receitas por Projeto</h3><canvas id="project-revenue-pie-chart"></canvas>`;
                projectChartContainer.appendChild(revenueChartWrapper);
                const revChart = new Chart(document.getElementById('project-revenue-pie-chart'), {
                    type: 'pie',
                    data: { labels: revenueData.labels, datasets: [{ data: revenueData.data, backgroundColor: pieColors }] },
                    options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#d1d5db' } }, tooltip: { callbacks: { label: pieTooltipCallback } } } }
                });
                projectCharts.push(revChart);
            }
             if (costData.data.length > 0) {
                const costChartWrapper = document.createElement('div');
                costChartWrapper.className = 'bg-gray-800 p-4 rounded-xl';
                costChartWrapper.innerHTML = `<h3 class="text-lg font-semibold text-center mb-2">Custos por Projeto</h3><canvas id="project-cost-pie-chart"></canvas>`;
                projectChartContainer.appendChild(costChartWrapper);
                const costChart = new Chart(document.getElementById('project-cost-pie-chart'), {
                    type: 'pie',
                    data: { labels: costData.labels, datasets: [{ data: costData.data, backgroundColor: pieColors }] },
                    options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#d1d5db' } }, tooltip: { callbacks: { label: pieTooltipCallback } } } }
                });
                projectCharts.push(costChart);
            }

            if (revenueData.data.length === 0 && costData.data.length === 0) {
                 projectChartContainer.innerHTML = `<p class="text-center text-gray-500 pt-16 col-span-full">Nenhuma operação para exibir nos gráficos.</p>`;
            }

        } else {
            projectChartContainer.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'; // Set grid layout
            const chartLabels = periodConfig.labels;
            const now = new Date();

            if (projects.length === 0) {
                projectChartContainer.innerHTML = `<p class="text-center text-gray-500 pt-16 col-span-full">Nenhum projeto para exibir nos gráficos.</p>`;
                return;
            }

            projects.forEach((project, index) => {
                const chartId = `project-chart-${index}`;
                const chartWrapper = document.createElement('div');
                chartWrapper.className = 'bg-gray-800 p-2 rounded-xl flex flex-col';
                chartWrapper.innerHTML = `
                    <h3 class="text-xs sm:text-sm font-semibold text-center text-gray-300 truncate">${project.name}</h3>
                    <div class="flex-grow h-40">
                        <canvas id="${chartId}"></canvas>
                    </div>
                `;
                projectChartContainer.appendChild(chartWrapper);
                
                const ctx = document.getElementById(chartId).getContext('2d');
                const relevantTransactions = project.transactions.filter(t => {
                    const transactionDate = new Date(t.date);
                    transactionDate.setMinutes(transactionDate.getMinutes() + transactionDate.getTimezoneOffset());
                    return transactionDate >= periodConfig.startDate;
                });
                
                const chartData = Array(chartLabels.length).fill(0);
                
                relevantTransactions.forEach(t => {
                    const transactionDate = new Date(t.date);
                    transactionDate.setMinutes(transactionDate.getMinutes() + transactionDate.getTimezoneOffset());
                    const value = t.type === 'revenue' ? t.amount : -t.amount;
                    
                    let idx = -1;
                    switch (activeFilter) {
                        case 'semana':
                            idx = Math.floor((transactionDate - periodConfig.startDate) / (1000 * 60 * 60 * 24));
                            break;
                        case 'mes':
                            if (transactionDate.getFullYear() === now.getFullYear() && transactionDate.getMonth() === now.getMonth()) idx = transactionDate.getDate() - 1;
                            break;
                        case 'anual':
                        default:
                            idx = (transactionDate.getFullYear() - periodConfig.startDate.getFullYear()) * 12 + (transactionDate.getMonth() - periodConfig.startDate.getMonth());
                            break;
                    }
                    if (idx >= 0 && idx < chartData.length) chartData[idx] += value;
                });

                const newChart = new Chart(ctx, {
                    type: '
