function initializeManagerApp() {
    // --- STATE MANAGEMENT ---
    let appData = JSON.parse(localStorage.getItem('appData')) || { sources: [], projects: [] };
    let currentProjectId = null;
    let currentView = 'projects';
    let currentSector = null;
    const subcategories = { Comercial: ['Marketing', 'Relacionamento', 'Vendas'], Operacional: ['Treinamentos', 'Armazenamento', 'Produção'], Financeiro: ['Planejamento', 'Investimento', 'Resultado'] };
    let chartInstances = {}; 
    let globalChartType = 'bar';
    let projectChartType = 'bar';
    
    // --- ELEMENT GETTERS ---
    const projectsView = document.getElementById('projects-view');
    const mainView = document.getElementById('main-view');
    const reportsView = document.getElementById('reports-view');
    const historyView = document.getElementById('history-view');
    const globalReportsView = document.getElementById('global-reports-view');
    const bottomNav = document.getElementById('bottom-nav');
    const allModals = document.querySelectorAll('.modal');
    const cancelModalBtns = document.querySelectorAll('.cancel-modal-btn');
    const addProjectModal = document.getElementById('add-project-modal');
    const addSourceModal = document.getElementById('add-source-modal');
    const addTransactionModal = document.getElementById('add-transaction-modal');
    const calculatorModal = document.getElementById('calculator-modal');
    const addProjectForm = document.getElementById('add-project-form');
    const addSourceForm = document.getElementById('add-source-form');
    const addTransactionForm = document.getElementById('add-transaction-form');

    // --- HELPER & UTILITY FUNCTIONS ---
    const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    const saveToLocalStorage = () => localStorage.setItem('appData', JSON.stringify(appData));
    const showModal = (modalEl) => modalEl.classList.remove('hidden');
    const hideModals = () => allModals.forEach(modal => modal.classList.add('hidden'));
    const getCurrentProject = () => appData.projects.find(p => p.id === currentProjectId);

    // --- CAROUSEL FACTORY (REVISED) ---
    function createCarousel(containerId, trackId, dotsId) {
        const container = document.getElementById(containerId);
        const track = document.getElementById(trackId);
        const dotsContainer = document.getElementById(dotsId);
        if (!container || !track) return { update: () => {} };

        const prevBtn = document.getElementById(`${containerId.split('-')[0]}-prev-btn`);
        const nextBtn = document.getElementById(`${containerId.split('-')[0]}-next-btn`);

        let state = {
            currentIndex: 0,
            totalSlides: 0,
            isDragging: false,
            startX: 0,
            currentTranslate: 0,
            prevTranslate: 0,
        };

        function getSlidesInView() {
            if (window.innerWidth >= 1024) return 3;
            if (window.innerWidth >= 768) return 2;
            return 1;
        }

        function updateUI() {
            if (state.totalSlides === 0 || !track.children[0]) return;

            const slidesInView = getSlidesInView();
            const maxIndex = Math.max(0, state.totalSlides - slidesInView);

            state.currentIndex = Math.max(0, Math.min(state.currentIndex, maxIndex));
            
            const slideWidth = track.children[0].offsetWidth;
            state.currentTranslate = state.currentIndex * -slideWidth;
            state.prevTranslate = state.currentTranslate;
            
            track.style.transform = `translateX(${state.currentTranslate}px)`;
            
            if (dotsContainer) {
                dotsContainer.innerHTML = '';
                for (let i = 0; i < state.totalSlides; i++) {
                    const dot = document.createElement('div');
                    dot.classList.add('dot');
                    if (i === state.currentIndex) dot.classList.add('active');
                    dotsContainer.appendChild(dot);
                }
            }

            if (prevBtn && nextBtn && window.innerWidth >= 768) {
                 prevBtn.classList.toggle('hidden', state.currentIndex <= 0);
                 nextBtn.classList.toggle('hidden', state.currentIndex >= maxIndex);
            }
        }
        
        function move(direction) {
            state.currentIndex += direction;
            track.style.transition = 'transform 0.3s ease-in-out';
            updateUI();
        }

        function dragStart(e) {
            state.isDragging = true;
            container.classList.add('grabbing');
            state.startX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
            track.style.transition = 'none';
        }

        function dragMove(e) {
            if (!state.isDragging) return;
            e.preventDefault();
            const currentPosition = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
            state.currentTranslate = state.prevTranslate + currentPosition - state.startX;
            track.style.transform = `translateX(${state.currentTranslate}px)`;
        }
        
        function dragEnd(e) {
            if (!state.isDragging) return;
            state.isDragging = false;
            container.classList.remove('grabbing');
            const movedBy = state.currentTranslate - state.prevTranslate;
            
            const slidesInView = getSlidesInView();
            const maxIndex = Math.max(0, state.totalSlides - slidesInView);

            if (movedBy < -50 && state.currentIndex < maxIndex) {
                 move(1);
            } else if (movedBy > 50 && state.currentIndex > 0) {
                 move(-1);
            } else {
                 track.style.transition = 'transform 0.3s ease-in-out';
                 track.style.transform = `translateX(${state.prevTranslate}px)`;
            }
        }

        container.addEventListener('touchstart', dragStart, { passive: true });
        container.addEventListener('touchend', dragEnd);
        container.addEventListener('touchmove', dragMove, { passive: false });
        container.addEventListener('mousedown', dragStart);
        container.addEventListener('mouseup', dragEnd);
        container.addEventListener('mouseleave', dragEnd);
        container.addEventListener('mousemove', dragMove);

        if(prevBtn) prevBtn.addEventListener('click', () => move(-1));
        if(nextBtn) nextBtn.addEventListener('click', () => move(1));
        
        window.addEventListener('resize', updateUI);
        
        return {
            update: (numSlides) => {
                state.totalSlides = numSlides > 0 ? numSlides : 0;
                setTimeout(() => {
                    state.currentIndex = 0;
                    updateUI();
                }, 0);
            },
            get currentIndex() { return state.currentIndex; }
        };
    }
    const projectsCarousel = createCarousel('projects-carousel-container', 'projects-carousel-track', 'projects-carousel-dots');
    const sectorsCarousel = createCarousel('sectors-carousel-container', 'sectors-carousel-track', 'sectors-carousel-dots');
    
    // --- CHART FUNCTIONS ---
    const getDateRange = (period) => {
        const now = new Date();
        let start = new Date(now);
        let end = new Date(now);

        if (period === 'week') {
            const day = now.getDay();
            start.setDate(now.getDate() - day + (day === 0 ? -6 : 1)); 
            end.setDate(start.getDate() + 6);
        } else if (period === 'month') {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        } else if (period === 'year') {
            start = new Date(now.getFullYear(), 0, 1);
            end = new Date(now.getFullYear(), 11, 31);
        }
        
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return { start, end };
    };

    const renderChart = (canvasId, chartKey, type, labels, data) => {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (chartInstances[chartKey]) {
            chartInstances[chartKey].destroy();
        }

        if (type === 'bar') {
             const chartData = (typeof data[0] === 'object') ? data.map(d => d.value) : data;
             const backgroundColors = chartData.map(value => value >= 0 ? 'rgba(34, 197, 94, 0.6)' : 'rgba(239, 68, 68, 0.6)');
             const borderColors = chartData.map(value => value >= 0 ? 'rgba(34, 197, 94, 1)' : 'rgba(239, 68, 68, 1)');
             chartInstances[chartKey] = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Resultado Líquido',
                        data: chartData,
                        backgroundColor: backgroundColors,
                        borderColor: borderColors,
                        borderWidth: 1
                    }]
                },
                options: { scales: { y: { beginAtZero: false } } }
            });
        } else if (type === 'pie') {
            const positiveData = data.filter(d => d.value > 0);
            
             if (positiveData.length === 0) {
                ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
                ctx.font = "14px Inter";
                ctx.fillStyle = "#64748b";
                ctx.textAlign = "center";
                ctx.fillText("Nenhum resultado positivo para exibir.", ctx.canvas.width / 2, ctx.canvas.height / 2);
                return;
            }

            const pieLabels = positiveData.map(d => d.label);
            const pieData = positiveData.map(d => d.value);
            const backgroundColors = pieLabels.map(() => `rgba(${Math.floor(Math.random()*255)}, ${Math.floor(Math.random()*255)}, ${Math.floor(Math.random()*255)}, 0.7)`);
            
             chartInstances[chartKey] = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: pieLabels,
                    datasets: [{
                        label: 'Resultado Líquido',
                        data: pieData,
                        backgroundColor: backgroundColors,
                        hoverOffset: 4
                    }]
                },
                options: {
                    plugins: {
                        title: {
                            display: true,
                            text: 'Composição do Resultado Positivo'
                        }
                    }
                }
            });
        }
    };
    
    const updateGlobalChart = (period = 'month') => {
        const { start, end } = getDateRange(period);
        const grid = document.getElementById('global-charts-grid');
        grid.innerHTML = '';

        if(globalChartType === 'pie'){
            const data = [];
            (appData.projects || []).forEach(project => {
                 const filtered = (project.transactions || []).filter(t => new Date(t.date) >= start && new Date(t.date) <= end);
                 const revenue = filtered.reduce((sum, t) => sum + (t.revenues || []).reduce((s, r) => s + r.amount, 0), 0);
                 const investment = filtered.reduce((sum, t) => sum + (t.investments || []).reduce((s, i) => s + i.amount, 0), 0);
                 const net = revenue - investment;
                 if (net > 0) {
                     data.push({label: project.name, value: net});
                 }
            });
            const canvasId = 'global-chart-pie';
            grid.className = 'grid grid-cols-1';
            grid.innerHTML = `<div class="lg:col-span-1 mx-auto max-w-lg"><canvas id="${canvasId}"></canvas></div>`;
            renderChart(canvasId, 'global', 'pie', null, data);
            return;
        }

        grid.className = 'grid grid-cols-1 lg:grid-cols-2 gap-6';
        (appData.projects || []).forEach(project => {
            const card = document.createElement('div');
            card.className = 'p-2 border rounded-lg bg-white';
            const canvasId = `chart-project-${project.id}`;
            card.innerHTML = `<h4 class="text-sm font-semibold text-center mb-2">${project.name}</h4><canvas id="${canvasId}"></canvas>`;
            grid.appendChild(card);
            
            const filtered = (project.transactions || []).filter(t => new Date(t.date) >= start && new Date(t.date) <= end);
            let labels = [];
            let data = [];

             if(period === 'week') {
                 labels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                 data = Array(7).fill(0);
                 filtered.forEach(t => {
                     const dayIndex = new Date(t.date).getDay();
                     data[dayIndex] += (t.revenues || []).reduce((s, r) => s + r.amount, 0) - (t.investments || []).reduce((s, i) => s + i.amount, 0);
                 });
            } else if (period === 'month') {
                 const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
                 labels = Array.from({length: daysInMonth}, (_, i) => i + 1);
                 data = Array(daysInMonth).fill(0);
                  filtered.forEach(t => {
                     const dayIndex = new Date(t.date).getDate() - 1;
                     data[dayIndex] += (t.revenues || []).reduce((s, r) => s + r.amount, 0) - (t.investments || []).reduce((s, i) => s + i.amount, 0);
                 });
            } else if (period === 'year') {
                 labels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                 data = Array(12).fill(0);
                  filtered.forEach(t => {
                     const monthIndex = new Date(t.date).getMonth();
                     data[monthIndex] += (t.revenues || []).reduce((s, r) => s + r.amount, 0) - (t.investments || []).reduce((s, i) => s + i.amount, 0);
                 });
            }

            renderChart(canvasId, canvasId, 'bar', labels, data);
        });
    };

    const updateProjectChart = (period = 'month') => {
        const project = getCurrentProject();
        if (!project) return;
        
        const grid = document.getElementById('project-charts-grid');
        grid.innerHTML = '';
        
        const { start, end } = getDateRange(period);
        const allSubcategories = [...subcategories.Comercial, ...subcategories.Operacional, ...subcategories.Financeiro];

        if(projectChartType === 'pie'){
            const data = [];
            allSubcategories.forEach(sub => {
                const filtered = (project.transactions || []).filter(t => t.subcategory === sub && new Date(t.date) >= start && new Date(t.date) <= end);
                const net = filtered.reduce((sum, t) => sum + ((t.revenues || []).reduce((s, r) => s + r.amount, 0) - (t.investments || []).reduce((s, i) => s + i.amount, 0)), 0);
                if (net > 0) {
                    data.push({label: sub, value: net});
                }
            });
            const canvasId = 'project-chart-pie';
            grid.className = 'grid grid-cols-1';
            grid.innerHTML = `<div class="lg:col-span-1 mx-auto max-w-lg"><canvas id="${canvasId}"></canvas></div>`;
            renderChart(canvasId, 'project', 'pie', null, data);
            return;
        }

        grid.className = 'grid grid-cols-1 lg:grid-cols-3 gap-6';
        allSubcategories.forEach((sub) => {
            const card = document.createElement('div');
            card.className = 'p-2 border rounded-lg bg-white';
            const canvasId = `chart-${sub.replace(/\s/g, '-')}`;
            card.innerHTML = `<h4 class="text-sm font-semibold text-center mb-2">${sub}</h4><canvas id="${canvasId}"></canvas>`;
            grid.appendChild(card);
            
            const transactionsForSub = (project.transactions || []).filter(t => t.subcategory === sub && new Date(t.date) >= start && new Date(t.date) <= end);
            let labels = [];
            let data = [];
            
             if(period === 'week') {
                 labels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                 data = Array(7).fill(0);
                 transactionsForSub.forEach(t => {
                     const dayIndex = new Date(t.date).getDay();
                     data[dayIndex] += (t.revenues || []).reduce((s, r) => s + r.amount, 0) - (t.investments || []).reduce((s, i) => s + i.amount, 0);
                 });
            } else if (period === 'month') {
                 const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
                 labels = Array.from({length: daysInMonth}, (_, i) => i + 1);
                 data = Array(daysInMonth).fill(0);
                  transactionsForSub.forEach(t => {
                     const dayIndex = new Date(t.date).getDate() - 1;
                     data[dayIndex] += (t.revenues || []).reduce((s, r) => s + r.amount, 0) - (t.investments || []).reduce((s, i) => s + i.amount, 0);
                 });
            } else if (period === 'year') {
                 labels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                 data = Array(12).fill(0);
                  transactionsForSub.forEach(t => {
                     const monthIndex = new Date(t.date).getMonth();
                     data[monthIndex] += (t.revenues || []).reduce((s, r) => s + r.amount, 0) - (t.investments || []).reduce((s, i) => s + i.amount, 0);
                 });
            }
            
            renderChart(canvasId, canvasId, 'bar', labels, data);
        });
    };

    const renderGlobalTotalBalance = () => {
        const total = (appData.sources || []).reduce((sum, source) => sum + source.balance, 0);
        document.getElementById('total-balance').textContent = formatCurrency(total);
        document.getElementById('total-balance-projects').textContent = formatCurrency(total);
    };
    
    const renderGlobalSources = () => {
        const container = document.getElementById('global-sources-list');
        container.innerHTML = '';
        if (!appData.sources || appData.sources.length === 0) {
            container.innerHTML = `<p class="text-center text-slate-500">Nenhuma fonte de capital adicionada. Clique no botão vermelho abaixo para começar.</p>`;
            return;
        }
        appData.sources.forEach(source => {
            const el = document.createElement('div');
            el.className = 'flex justify-between items-center p-3 bg-slate-50 rounded-lg border';
            el.innerHTML = `
                <div>
                    <span class="font-semibold">${source.name} <span class="text-xs text-slate-500">(${source.type})</span></span>
                    <p class="font-medium text-lg">${formatCurrency(source.balance)}</p>
                </div>
            `;
            container.appendChild(el);
        });
    };

    const renderProjects = () => {
        const track = document.getElementById('projects-carousel-track');
        track.innerHTML = '';
        if (appData.projects.length === 0) {
             track.innerHTML = `<div class="w-full flex-shrink-0 px-2"><div class="card text-center"><p class="text-slate-500">Nenhum projeto criado. Clique em "Novo Projeto" para começar.</p></div></div>`;
             projectsCarousel.update(1);
             return;
        }
        appData.projects.forEach(project => {
            const slide = document.createElement('div');
            slide.className = 'w-full md:w-1/2 lg:w-1/3 flex-shrink-0 px-2';
            const totalRevenue = (project.transactions || []).reduce((sum, t) => sum + (t.revenues || []).reduce((s, r) => s + r.amount, 0), 0);
            const totalInvestment = (project.transactions || []).reduce((sum, t) => sum + (t.investments || []).reduce((s, i) => s + i.amount, 0), 0);
            const projectResult = totalRevenue - totalInvestment;

            slide.innerHTML = `<div class="card h-full cursor-pointer hover:bg-slate-50 transition-colors"><h3 class="text-2xl font-bold text-slate-800">${project.name}</h3><p class="text-slate-600 mt-2">Resultado do Projeto</p><p class="text-3xl font-bold ${projectResult >= 0 ? 'text-green-600' : 'text-red-600'}">${formatCurrency(projectResult)}</p></div>`;
            slide.addEventListener('click', () => switchView('main', {projectId: project.id}));
            track.appendChild(slide);
        });
        projectsCarousel.update(appData.projects.length);
    };
    
    const renderFilteredOperations = () => {
        const project = getCurrentProject();
        if (!project || !project.transactions) return;

        const container = document.getElementById('history-operations-list');
        const dateFilter = document.getElementById('history-filter-date').value;
        const areaFilter = document.getElementById('history-filter-area').value;
        const subFilter = document.getElementById('history-filter-subcategory').value;

        let filtered = [...(project.transactions || [])];

        if(dateFilter) {
            const filterDate = new Date(dateFilter);
            filterDate.setMinutes(filterDate.getMinutes() + filterDate.getTimezoneOffset());
            filtered = filtered.filter(t => new Date(t.date).toDateString() === filterDate.toDateString());
        }
        if(areaFilter) {
            filtered = filtered.filter(t => t.area === areaFilter);
        }
        if(subFilter) {
            filtered = filtered.filter(t => t.subcategory === subFilter);
        }

        container.innerHTML = '';
        if (filtered.length === 0) {
            container.innerHTML = '<p class="text-slate-500">Nenhuma operação encontrada para os filtros selecionados.</p>';
            return;
        }
        [...filtered].reverse().forEach(t => {
            const totalRevenue = (t.revenues || []).reduce((s, r) => s + r.amount, 0);
            const totalInvestment = (t.investments || []).reduce((s, i) => s + i.amount, 0);
            const net = totalRevenue - totalInvestment;
            const el = document.createElement('div');
            el.className = 'border-b pb-2';
            el.innerHTML = `
                <div class="flex justify-between items-start">
                   <p class="font-semibold">${t.description}</p>
                   <p class="font-bold text-sm ${net >= 0 ? 'text-green-600' : 'text-red-600'}">${formatCurrency(net)}</p>
                </div>
                <p class="text-xs text-slate-500">${new Date(t.date).toLocaleDateString('pt-BR')} &bull; ${t.subcategory}</p>
            `;
            container.appendChild(el);
        });
    };

    const renderSectorPanels = () => {
        const project = getCurrentProject();
        const transactions = project ? project.transactions || [] : [];
        
        ['Comercial', 'Operacional', 'Financeiro'].forEach(sector => {
            const sectorData = transactions.filter(t => t.area === sector);
            const sectorLower = sector.toLowerCase();

            let totalRevenue = 0;
            let totalInvestment = 0;
            const subcategoryTotals = {};
            
            subcategories[sector].forEach(sub => subcategoryTotals[sub] = {revenue: 0, investment: 0});

            sectorData.forEach(t => {
                const rev = (t.revenues || []).reduce((s, i) => s + i.amount, 0);
                const inv = (t.investments || []).reduce((s, i) => s + i.amount, 0);
                totalRevenue += rev;
                totalInvestment += inv;
                if(subcategoryTotals[t.subcategory]) {
                   subcategoryTotals[t.subcategory].revenue += rev;
                   subcategoryTotals[t.subcategory].investment += inv;
                }
            });

            document.getElementById(`${sectorLower}-revenue`).textContent = formatCurrency(totalRevenue);
            document.getElementById(`${sectorLower}-investment`).textContent = formatCurrency(totalInvestment);
            document.getElementById(`${sectorLower}-net`).textContent = formatCurrency(totalRevenue - totalInvestment);

            const subContainer = document.getElementById(`${sectorLower}-subcategories`);
            subContainer.innerHTML = '';
             Object.entries(subcategoryTotals).forEach(([name, data]) => {
                 const net = data.revenue - data.investment;
                 const el = document.createElement('div');
                 el.innerHTML = `<p class="flex justify-between text-sm"><span>${name}</span> <span class="font-semibold ${net >= 0 ? 'text-slate-700' : 'text-red-600'}">${formatCurrency(net)}</span></p>`;
                 subContainer.appendChild(el);
             });
        });
    };
    
    const renderProjectData = () => {
        const project = getCurrentProject();
        if (!project) return;
        
        document.getElementById('project-title-main').textContent = project.name;
        const totalRevenue = (project.transactions || []).reduce((sum, t) => sum + (t.revenues || []).reduce((s, r) => s + r.amount, 0), 0);
        const totalInvestment = (project.transactions || []).reduce((sum, t) => sum + (t.investments || []).reduce((s, i) => s + i.amount, 0), 0);
        const projectResult = totalRevenue - totalInvestment;
        document.getElementById('project-balance').textContent = formatCurrency(projectResult);
        
        renderSectorPanels();
        sectorsCarousel.update(3);
    };
    
    const renderHistoryView = () => {
        document.getElementById('history-title').textContent = `Histórico do Projeto`;
        
        const filterArea = document.getElementById('history-filter-area');
        filterArea.innerHTML = '<option value="">Todas as Áreas</option>';
        Object.keys(subcategories).forEach(s => filterArea.innerHTML += `<option value="${s}">${s}</option>`);

        const filterSub = document.getElementById('history-filter-subcategory');
        filterSub.innerHTML = '<option value="">Todas Subcategorias</option>';
        Object.values(subcategories).flat().forEach(s => filterSub.innerHTML += `<option value="${s}">${s}</option>`);
        
        renderFilteredOperations();
    };
    
    const populateSubcategories = (areaSelect, subcategorySelect) => {
         const selectedArea = areaSelect.value;
         subcategorySelect.innerHTML = '';
         subcategorySelect.disabled = true;
         if (selectedArea && subcategories[selectedArea]) {
             subcategories[selectedArea].forEach(sub => {
                 const option = document.createElement('option');
                 option.value = sub;
                 option.textContent = sub;
                 subcategorySelect.appendChild(option);
             });
             subcategorySelect.disabled = false;
         } else {
             subcategorySelect.innerHTML = '<option>Selecione a área</option>';
         }
     };
    
    const setupDynamicFields = (containerId, buttonId) => {
         const container = addTransactionForm.querySelector(`#${containerId}`);
         const button = addTransactionForm.querySelector(`#${buttonId}`);
        
         const addField = () => {
             const fieldDiv = document.createElement('div');
             fieldDiv.className = 'flex items-center gap-2';
             fieldDiv.innerHTML = `
                 <input type="text" placeholder="Descrição" class="block w-full rounded-md border-slate-300 shadow-sm text-sm p-1">
                 <input type="number" step="0.01" placeholder="Valor" class="block w-40 rounded-md border-slate-300 shadow-sm text-sm p-1">
                 <button type="button" class="remove-field-btn text-red-500 hover:text-red-700">&times;</button>
             `;
             fieldDiv.querySelector('.remove-field-btn').addEventListener('click', () => fieldDiv.remove());
             container.appendChild(fieldDiv);
         };
        
         button.addEventListener('click', addField);
         addField(); 
     };
    
    const getFieldsData = (containerId) => {
         const container = addTransactionForm.querySelector(`#${containerId}`);
         return Array.from(container.children).map(div => {
             const inputs = div.querySelectorAll('input');
             return {
                 description: inputs[0].value,
                 amount: parseFloat(inputs[1].value) || 0
             };
         }).filter(item => item.description && item.amount > 0);
     };
     
    const renderAddTransactionForm = () => {
         addTransactionForm.innerHTML = `
            <div><label for="transaction-description" class="block text-sm font-medium text-slate-700">Descrição Geral da Operação</label><input type="text" id="transaction-description" placeholder="Ex: Campanha de Marketing Digital" required class="mt-1 block w-full rounded-md border-slate-300 shadow-sm"></div>
            <div><label class="block text-sm font-medium text-slate-700">Receitas</label><div id="revenue-fields-container" class="space-y-2 mt-1 bg-slate-50 p-3 rounded-md"></div><button type="button" id="add-revenue-btn" class="mt-2 text-sm text-indigo-600 hover:text-indigo-800 font-semibold">+ Adicionar Receita</button></div>
            <div><label class="block text-sm font-medium text-slate-700">Investimentos / Custos</label><div id="investment-fields-container" class="space-y-2 mt-1 bg-slate-50 p-3 rounded-md"></div><button type="button" id="add-investment-btn" class="mt-2 text-sm text-indigo-600 hover:text-indigo-800 font-semibold">+ Adicionar Custo</button></div>
            <div class="grid grid-cols-2 gap-4">
                <div><label for="transaction-area" class="block text-sm font-medium text-slate-700">Área</label><select id="transaction-area" required class="mt-1 block w-full rounded-md border-slate-300 shadow-sm"><option value="" disabled selected>Selecione</option><option value="Comercial">Comercial</option><option value="Operacional">Operacional</option><option value="Financeiro">Financeiro</option></select></div>
                <div><label for="transaction-subcategory" class="block text-sm font-medium text-slate-700">Subcategoria</label><select id="transaction-subcategory" required class="mt-1 block w-full rounded-md border-slate-300 shadow-sm disabled:bg-slate-100" disabled><option>Selecione a área</option></select></div>
            </div>
            <div><label for="transaction-source-account" class="block text-sm font-medium text-slate-700">Fonte do Capital (Origem/Destino)</label><select id="transaction-source-account" required class="mt-1 block w-full rounded-md border-slate-300 shadow-sm"></select></div>
            <div class="mt-6 flex justify-end gap-4"><button type="button" class="cancel-modal-btn bg-slate-200 text-slate-800 font-bold py-2 px-4 rounded-md">Cancelar</button><button type="submit" class="bg-green-600 text-white font-bold py-2 px-4 rounded-md">Registrar</button></div>`;

        const areaSelect = addTransactionForm.querySelector('#transaction-area');
        const subcategorySelect = addTransactionForm.querySelector('#transaction-subcategory');
        areaSelect.addEventListener('change', () => populateSubcategories(areaSelect, subcategorySelect));

        setupDynamicFields('revenue-fields-container', 'add-revenue-btn');
        setupDynamicFields('investment-fields-container', 'add-investment-btn');
        
        const sourceSelect = addTransactionForm.querySelector('#transaction-source-account');
        sourceSelect.innerHTML = (appData.sources || []).map(s => `<option value="${s.id}">${s.name} (${formatCurrency(s.balance)})</option>`).join('');

        addTransactionForm.querySelector('.cancel-modal-btn').addEventListener('click', hideModals);
    };

    const renderUI = () => {
        renderGlobalTotalBalance();
        if (currentView === 'projects') {
            renderProjects();
            renderGlobalSources();
        } else if (currentView === 'main' && currentProjectId) {
            renderProjectData();
        } else if (currentView === 'global-reports') {
            updateGlobalChart(document.querySelector('#global-chart-filters .active')?.dataset.period);
        } else if (currentView === 'reports' && currentProjectId) {
            updateProjectChart(document.querySelector('#project-chart-filters .active')?.dataset.period);
        } else if (currentView === 'history' && currentProjectId) {
            renderHistoryView();
        }
    };
    
    // --- CORE LOGIC & NAVIGATION ---
    const switchView = (viewName, options = {}) => {
        currentProjectId = options.projectId !== undefined ? options.projectId : currentProjectId;
        currentSector = options.sector !== undefined ? options.sector : null; // Reset sector when not explicitly passed

        [projectsView, mainView, globalReportsView, reportsView, historyView].forEach(v => v.classList.add('hidden'));
        
        if (viewName === 'projects') {
            projectsView.classList.remove('hidden');
            currentProjectId = null;
        } else if (viewName === 'main') mainView.classList.remove('hidden');
        else if (viewName === 'reports') reportsView.classList.remove('hidden');
        else if (viewName === 'global-reports') globalReportsView.classList.remove('hidden');
        else if (viewName === 'history') historyView.classList.remove('hidden');
        
        currentView = viewName;
        updateBottomNav();
        renderUI();
    };

    const updateBottomNav = () => {
        const nav = document.getElementById('bottom-nav');
        nav.innerHTML = ''; // Clear previous buttons

        let buttons = '';
        if (currentView === 'projects' || currentView === 'global-reports') {
            buttons = `
                <button id="nav-add-source-btn" class="flex flex-col items-center text-red-600 p-2 rounded-lg"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path d="M4 10.781c.524 1.637 1.976 2.77 3.553 2.872.223.014.448.028.675.045v-1.15c-.212-.016-.416-.03-.611-.045-1.29-.086-2.288-.934-2.614-2.06H1.5v1h2.5zm10 0v-1h-2.5c-.326 1.126-1.324-1.974-2.614 2.06-.195.015-.399.029-.611.045v1.15c.227-.017.452-.03.675-.045C10.024 13.55 11.477 12.417 12 10.781h2.5zM10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0m-2.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3M1.5 5.034h2.5c.334-1.232 1.453-2.148 2.842-2.235.215-.015.435-.028.662-.04v-1.15A12 12 0 0 0 8 1.516a12 12 0 0 0-.504.032v1.15c.227.012.447.025.662.04C9.547 2.886 10.666 3.802 11 5.034h2.5v-1H12c-.524-1.637-1.976-2.77-3.553-2.872a12 12 0 0 0-.894-.045v1.15c.212.016.416.03.611.045C9.676 2.37 10.674 3.218 11 4.348h2.5v-1H12c-.326-1.126-1.324-1.974-2.614-2.06A12 12 0 0 0 8 2.226v-1.15c-.227.017-.452-.03-.675-.045C5.976 1.23 4.523 2.363 4 4.034H1.5z"/></svg><span class="text-xs font-semibold">Fonte</span></button>
                <button id="nav-add-project" class="flex flex-col items-center text-blue-600 p-2 rounded-lg"><svg class="h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 16"><path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4"/></svg><span class="text-xs font-semibold">Novo Projeto</span></button>
                <button id="nav-global-results" class="flex flex-col items-center text-green-600 p-2 rounded-lg"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path d="M11 2a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v12h.5a.5.5 0 0 1 0 1H.5a.5.5 0 0 1 0-1H1v-3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v3h1V7a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v7h1z"/></svg><span class="text-xs font-semibold">Resultados</span></button>
            `;
        } else if (currentView === 'main' || currentView === 'reports' || currentView === 'history') {
            buttons = `
                <button id="open-add-source-modal-btn" class="flex flex-col items-center text-red-600 p-2 rounded-lg"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path d="M4 10.781c.524 1.637 1.976 2.77 3.553 2.872.223.014.448.028.675.045v-1.15c-.212-.016-.416-.03-.611-.045-1.29-.086-2.288-.934-2.614-2.06H1.5v1h2.5zm10 0v-1h-2.5c-.326 1.126-1.324-1.974-2.614 2.06-.195.015-.399.029-.611.045v1.15c.227-.017.452-.03.675-.045C10.024 13.55 11.477 12.417 12 10.781h2.5zM10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0m-2.5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3M1.5 5.034h2.5c.334-1.232 1.453-2.148 2.842-2.235.215-.015.435-.028.662-.04v-1.15A12 12 0 0 0 8 1.516a12 12 0 0 0-.504.032v1.15c.227.012.447.025.662.04C9.547 2.886 10.666 3.802 11 5.034h2.5v-1H12c-.524-1.637-1.976-2.77-3.553-2.872a12 12 0 0 0-.894-.045v1.15c.212.016.416.03.611.045C9.676 2.37 10.674 3.218 11 4.348h2.5v-1H12c-.326-1.126-1.324-1.974-2.614-2.06A12 12 0 0 0 8 2.226v-1.15c-.227.017-.452-.03-.675-.045C5.976 1.23 4.523 2.363 4 4.034H1.5z"/></svg><span class="text-xs font-semibold">Fonte</span></button>
                <button id="nav-history-btn" class="flex flex-col items-center text-blue-600 p-2 rounded-lg"><svg class="h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M5 11.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5m-2-4A.5.5 0 0 1 3.5 7h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5m-2-4A.5.5 0 0 1 1.5 3h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5"/></svg><span class="text-xs font-semibold">Histórico</span></button>
                <button id="nav-btn-results" class="flex flex-col items-center text-green-600 p-2 rounded-lg"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path d="M11 2a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v12h.5a.5.5 0 0 1 0 1H.5a.5.5 0 0 1 0-1H1v-3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v3h1V7a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v7h1z"/></svg><span class="text-xs font-semibold">Resultados</span></button>
            `;
        }
        nav.innerHTML = buttons;
        
        // Re-attach listeners
        if (currentView === 'projects' || currentView === 'global-reports') {
            document.getElementById('nav-add-source-btn').addEventListener('click', () => showModal(addSourceModal));
            document.getElementById('nav-add-project').addEventListener('click', () => showModal(addProjectModal));
            document.getElementById('nav-global-results').addEventListener('click', () => switchView('global-reports'));
        } else if (currentView === 'main' || currentView === 'reports' || currentView === 'history') {
            document.getElementById('open-add-source-modal-btn').addEventListener('click', () => showModal(addSourceModal));
            document.getElementById('nav-history-btn').addEventListener('click', () => switchView('history'));
            document.getElementById('nav-btn-results').addEventListener('click', () => switchView('reports'));
        }
    };

    // --- EVENT LISTENERS ---
    addProjectForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const projectNameInput = document.getElementById('project-name');
        const projectName = projectNameInput.value.trim();
        if (projectName) {
            appData.projects.push({ id: Date.now(), name: projectName, transactions: [] });
            saveToLocalStorage();
            switchView('projects'); 
            hideModals();
            projectNameInput.value = '';
        }
    });

    addSourceForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const sourceName = document.getElementById('source-name').value;
        const sourceType = document.getElementById('source-type').value;
        const initialBalance = parseFloat(document.getElementById('initial-balance').value);

        if(sourceName && sourceType && !isNaN(initialBalance)){
            if (!appData.sources) appData.sources = [];
            appData.sources.push({id: Date.now(), name: sourceName, type: sourceType, balance: initialBalance});
            saveToLocalStorage();
            renderUI();
            hideModals();
            addSourceForm.reset();
        }
    });

    addTransactionForm.addEventListener('submit', e => {
        e.preventDefault();
        const project = getCurrentProject();
        const sourceIdInput = addTransactionForm.querySelector('#transaction-source-account');
        if (!sourceIdInput.value) {
            alert("Por favor, adicione uma fonte de capital primeiro.");
            return;
        }
        const sourceId = parseInt(sourceIdInput.value);
        const source = appData.sources.find(s => s.id === sourceId);

        if(!project || !source) {
            alert('Projeto ou Fonte de Capital inválida.');
            return;
        }
        
        const revenues = getFieldsData('revenue-fields-container');
        const investments = getFieldsData('investment-fields-container');
        const totalRevenue = revenues.reduce((s, i) => s + i.amount, 0);
        const totalInvestment = investments.reduce((s, i) => s + i.amount, 0);
        
        source.balance += totalRevenue - totalInvestment;

        if(!project.transactions) project.transactions = [];
        project.transactions.push({
            id: Date.now(),
            description: addTransactionForm.querySelector('#transaction-description').value,
            revenues,
            investments,
            area: addTransactionForm.querySelector('#transaction-area').value,
            subcategory: addTransactionForm.querySelector('#transaction-subcategory').value,
            sourceAccountId: sourceId,
            date: new Date().toISOString()
        });

        saveToLocalStorage();
        renderUI();
        hideModals();
    });
    
    mainView.addEventListener('click', (e) => {
        const card = e.target.closest('.card[data-sector]');
        if (card) {
            const sector = card.dataset.sector;
            renderAddTransactionForm();
            const areaSelect = addTransactionForm.querySelector('#transaction-area');
            areaSelect.value = sector;
            areaSelect.dispatchEvent(new Event('change'));
            showModal(addTransactionModal);
        }
    });

    document.getElementById('back-to-projects-btn').addEventListener('click', () => switchView('projects'));
    document.getElementById('back-to-projects-from-global-btn').addEventListener('click', () => switchView('projects'));
    document.getElementById('back-to-main-from-reports-btn')?.addEventListener('click', () => switchView('main'));
    document.getElementById('back-to-main-from-history-btn').addEventListener('click', () => switchView('main'));
    cancelModalBtns.forEach(btn => btn.addEventListener('click', hideModals));
    document.getElementById('open-calculator-btn').addEventListener('click', () => showModal(calculatorModal));
    document.getElementById('close-calculator-btn').addEventListener('click', () => hideModals());
    document.getElementById('copy-calculator-btn').addEventListener('click', () => {
        const display = document.getElementById('calculator-display');
        const copyBtn = document.getElementById('copy-calculator-btn');
        navigator.clipboard.writeText(display.textContent).then(() => {
            copyBtn.textContent = 'Copiado!';
            setTimeout(() => { copyBtn.textContent = 'Copiar'; }, 1500);
        });
    });


    document.getElementById('history-filter-date').addEventListener('change', renderFilteredOperations);
    document.getElementById('history-filter-area').addEventListener('change', renderFilteredOperations);
    document.getElementById('history-filter-subcategory').addEventListener('change', renderFilteredOperations);
    
    document.getElementById('global-chart-filters').addEventListener('click', (e) => {
        if(e.target.tagName === 'BUTTON') {
            document.querySelectorAll('#global-chart-filters .filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            updateGlobalChart(e.target.dataset.period);
        }
    });
    document.getElementById('global-chart-type-filters').addEventListener('click', (e) => {
        if(e.target.tagName === 'BUTTON') {
            document.querySelectorAll('#global-chart-type-filters .filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            globalChartType = e.target.dataset.type;
            updateGlobalChart(document.querySelector('#global-chart-filters .active').dataset.period);
        }
    });
    document.getElementById('project-chart-filters').addEventListener('click', (e) => {
        if(e.target.tagName === 'BUTTON') {
            document.querySelectorAll('#project-chart-filters .filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            updateProjectChart(e.target.dataset.period);
        }
    });
    document.getElementById('project-chart-type-filters').addEventListener('click', (e) => {
        if(e.target.tagName === 'BUTTON') {
            document.querySelectorAll('#project-chart-type-filters .filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            projectChartType = e.target.dataset.type;
            updateProjectChart(document.querySelector('#project-chart-filters .active').dataset.period);
        }
    });
    
    allModals.forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                hideModals();
            }
        });
    });

    // --- INITIAL LOAD ---
    switchView('projects');
}

initializeManagerApp();
