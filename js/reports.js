// Variáveis globais
let charts = {};
let allData = [];
let filteredData = [];
let previousPeriodData = [];
let currentPeriodData = [];
let comparisonPeriod = 'month'; // month, quarter, year
const apiBaseUrl = 'https://c1b8d2bcf4e1.ngrok-free.app';

const statusMap = {
    'ativa': 'Ativa',
    'suspensa': 'Suspensa',
    'entregue': 'Entregue',
    'finalizada': 'Finalizada',
    'fechada': 'Fechada'
};

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    setupEventListeners();
    loadDataFromAPI();
});

async function safeFetch(url, options = {}) {
    try {
        // Fazer a requisição
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                ...options.headers
            },
            credentials: 'include',
            ...options
        });

        // Verificar se response é válido
        if (!response) {
            throw new Error('Nenhuma resposta recebida do servidor');
        }

        // Verificar se headers existe
        if (!response.headers) {
            throw new Error('Resposta sem headers do servidor');
        }

        // Verificar tipo de conteúdo
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            
            if (text.includes('<!DOCTYPE') || text.includes('<html')) {
                throw new Error(`Servidor retornou HTML em vez de JSON. Status: ${response.status}`);
            }
            
            throw new Error(`Resposta inesperada: ${contentType}. Status: ${response.status}`);
        }
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
        }
        
        return response.json();
        
    } catch (error) {
        console.error('Erro no safeFetch:', error);
        throw error; // Re-lançar o erro para ser tratado pelo chamador
    }
}

async function loadDataFromAPI() {
    showLoading();

    try {
        const token = localStorage.getItem('access_token');
        if (!token) {
            throw new Error('Token de autenticação não encontrado');
        }

        // Buscar registros e clientes em paralelo
        const [recordsResponse, clientsResponse, usersResponse] = await Promise.all([
            safeFetch(`${apiBaseUrl}/records/reports/`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }),
            safeFetch(`${apiBaseUrl}/clients/`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }),
            safeFetch(`${apiBaseUrl}/users/`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            })
        ]);

        const records = await recordsResponse.json();
        const clients = clientsResponse.ok ? await clientsResponse.json() : [];
        const users = usersResponse.ok ? await usersResponse.json() : [];

        // Transformar dados
        allData = await transformRecordsData(records);
        filteredData = [...allData];

        // Atualizar filtro de clientes
        updateClientFilter(clients);
        updateProviderFilter(users);

        updateDashboard();
        createCharts();
        hideLoading();

    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        hideLoading();
        showNotification('Erro ao carregar dados: ' + error.message, 'error');
    }
}

// Transformar dados da API para o formato do relatório
async function transformRecordsData(records) {
    const token = localStorage.getItem('access_token');
    const transformedData = [];

    for (const record of records) {
        try {
            // Buscar informações financeiras se o registro estiver finalizado
            let financialData = null;
            if (record.status === 'finalizada' || record.status === 'fechada') {
                try {
                    const financialResponse = await fetch(`${apiBaseUrl}/records/${record.id}/financial`, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });

                    if (financialResponse.ok) {
                        financialData = await financialResponse.json();
                    } else {
                        console.warn(`Erro ao buscar dados financeiros para registro ${record.id}: ${financialResponse.status}`);
                    }
                } catch (error) {
                    console.error('Erro ao buscar dados financeiros:', error);
                }
            }

            // Calcular totais de despesas (excluindo custas)
            const totalExpenses = record.expenses && record.expenses.length > 0
                ? record.expenses.reduce((sum, expense) => sum + parseFloat(expense.value || 0), 0)
                : 0;

            transformedData.push({
                id: record.id,
                record_id: record.record_id,
                date: record.register_date,
                company: record.client.name,
                city: record.city,
                state: record.state,
                expense: totalExpenses,
                status: record.status,
                document_type: record.document_type,
                provider: record.provider.name,
                researchedName: record.researchedName,
                researchedCpf_cnpj: record.researchedCpf_cnpj,
                info: record.info,
                priority: record.priority,
                last_update: record.last_update,
                financial: financialData,
                expenses: record.expenses || []
            });

        } catch (error) {
            console.error('Erro ao transformar registro:', record.id, error);
        }
    }

    return transformedData;
}

// Buscar dados adicionais da API quando necessário
async function fetchAdditionalData() {
    try {
        const token = localStorage.getItem('access_token');
        if (!token) return;

        // Buscar clientes para filtro
        const clientsResponse = await fetch(`${apiBaseUrl}/clients/`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const usersResponse = await fetch(`${apiBaseUrl}/users/`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (clientsResponse.ok) {
            const clients = await clientsResponse.json();
            updateClientFilter(clients);
        } else {
            console.warn('Erro ao buscar clientes para filtro');
        }

        if (usersResponse.ok) {
            const users = await usersResponse.json();
            updateProviderFilter(users);
        } else {
            console.warn('Erro ao buscar usuários para filtro');
        }

    } catch (error) {
        console.error('Erro ao buscar dados adicionais:', error);
    }
}

// Atualizar filtro de clientes
function updateClientFilter(clients) {
    const empresaSelect = document.getElementById('empresa');

    // Limpar opções exceto "Todas as Empresas"
    while (empresaSelect.options.length > 1) {
        empresaSelect.remove(1);
    }

    // Adicionar clientes
    clients.forEach(client => {
        const option = document.createElement('option');
        option.value = client.id;
        option.textContent = client.name;
        empresaSelect.appendChild(option);
    });
}

// Atualizar filtro de provedor
function updateProviderFilter(users) {
    const provedorSelect = document.getElementById('provedor');

    // Limpar opções exceto "Todos os Provedores"
    while (provedorSelect.options.length > 1) {
        provedorSelect.remove(1);
    }

    // Adicionar clientes
    users.forEach(client => {
        const option = document.createElement('option');
        option.value = client.id;
        option.textContent = client.name;
        provedorSelect.appendChild(option);
    });
}

// Aplicar filtros (simplificada para cálculo mensal)
function applyFilters() {
    showLoading();

    setTimeout(() => {
        const periodo = document.getElementById('periodo').value;
        const dataInicio = document.getElementById('dataInicio').value;
        const dataFim = document.getElementById('dataFim').value;
        const status = document.getElementById('status').value
        const empresa = document.getElementById('empresa').value;
        const estado = document.getElementById('estado').value;
        const provedor = document.getElementById('provedor').value;

        filteredData = allData.filter(item => {
            // Filtrar por empresa
            if (empresa !== 'todas') {
                const empresaSelect = document.getElementById('empresa');
                const empresaNome = empresaSelect.options[empresaSelect.selectedIndex].text;
                if (item.company !== empresaNome) return false;
            }

            // Filtrar por status
            if (status !== 'todos') {
                const statusSelect = document.getElementById('status').value;
                if (item.status !== statusSelect) return false;
            }

            // Filtrar por estado
            if (estado !== 'todos') {
                const estadoSelect = document.getElementById('estado').value;
                if (item.state.toLowerCase() !== estadoSelect) return false;
            }

            // Filtrar por prestador(provedor)
            if (provedor !== 'todas') {
                const provedorSelect = document.getElementById('provedor');
                const provedorNome = provedorSelect.options[provedorSelect.selectedIndex].text;
                if (item.provider !== provedorNome) return false;
            }

            // Filtrar por período
            const itemDate = new Date(item.date);
            let startDate, endDate;

            if (periodo === 'custom') {
                if (!dataInicio || !dataFim) return true;
                startDate = new Date(dataInicio);
                endDate = new Date(dataFim);
                endDate.setHours(23, 59, 59);
            } else {
                endDate = new Date();
                startDate = new Date();
                startDate.setDate(startDate.getDate() - parseInt(periodo));
            }

            return itemDate >= startDate && itemDate <= endDate;
        });

        updateDashboard();
        updateCharts();
        hideLoading();
    }, 500);
}

// Verificar autenticação
async function checkAuth() {
    console.log('🔐 Verificando autenticação...');
    
    const token = localStorage.getItem('access_token');
    console.log('📦 Token no localStorage:', token ? `Encontrado (${token.length} chars)` : 'Não encontrado');
    
    if (!token) {
        console.log('❌ Nenhum token encontrado, redirecionando para login...');
        window.location.href = 'login.html';
        return false;
    }

    try {
        console.log('🌐 Testando token com API...');
        const response = await fetch(`${apiBaseUrl}/users/me/`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            credentials: 'include' // 🔥 IMPORTANTE!
        });

        console.log('📊 Status da resposta:', response.status);
        
        if (!response.ok) {
            if (response.status === 401) {
                console.log('❌ Token inválido ou expirado (401)');
                throw new Error('Token inválido');
            }
            throw new Error(`Erro HTTP: ${response.status}`);
        }

        const userData = await response.json();
        console.log('✅ Autenticação válida! Usuário:', userData.email);
        currentUser = userData;

        if (currentUser.type !== 'admin') {
            alert('Acesso restrito a administradores');
            window.location.href = 'index.html';
            return;
        }

        return true;
        
    } catch (error) {
        console.error('❌ Erro na verificação de autenticação:', error);
        
        // Mostrar feedback para o usuário
        showError('Sessão expirada. Faça login novamente.');
        
        // Limpar token inválido
        localStorage.removeItem('access_token');
        
        // Redirecionar para login
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);
        
        return false;
    }
}

// Configurar event listeners
function setupEventListeners() {
    // Filtro de período
    document.getElementById('periodo').addEventListener('change', function () {
        toggleCustomDateFields(this.value === 'custom');
        if (this.value !== 'custom') {
            applyFilters();
        }
    });

    // Botão aplicar filtros
    document.getElementById('applyFilters').addEventListener('click', applyFilters);

    // Botão limpar filtros
    document.getElementById('clearFilters').addEventListener('click', clearFilters);

    // Botões de exportação
    document.getElementById('exportExcel').addEventListener('click', exportToExcel);
    document.getElementById('exportPDF').addEventListener('click', exportToPDF);
}

// Alternar visibilidade dos campos de data personalizada
function toggleCustomDateFields(show) {
    const customDateFields = document.querySelectorAll('.custom-date-fields');
    customDateFields.forEach(field => {
        field.style.display = show ? 'block' : 'none';
    });
}

// Limpar filtros
function clearFilters() {
    document.getElementById('periodo').value = '30';
    document.getElementById('status').value = 'todos';
    document.getElementById('empresa').value = 'todas';
    document.getElementById('dataInicio').value = '';
    document.getElementById('dataFim').value = '';
    toggleCustomDateFields(false);

    // Limpar dados anteriores também
    previousPeriodData = [];
    filteredData = [...allData];

    updateDashboard();
    updateCharts();
}

// Atualizar tabela
function updateTable() {
    const tbody = document.querySelector('#detalhesTable tbody');
    tbody.innerHTML = '';

    filteredData.forEach(item => {
        const tr = document.createElement('tr');
        const statusClass = `badge-${item.status}`;
        const statusText = getStatusText(item.status);

        // Calcular totais de despesas (excluindo custas)
        const totalExpenses = item.expenses && item.expenses.length > 0
            ? item.expenses.reduce((sum, expense) => sum + parseFloat(expense.value || 0), 0)
            : 0;

        // Colunas básicas para todos os registros
        tr.innerHTML = `
            <td>${formatDate(item.date)}</td>
            <td>${item.company}</td>
            <td>${item.city}/${item.state.toUpperCase()}</td>
            <td>${item.provider}</td>
            <td><span class="badge ${statusClass}">${statusText}</span></td>
            <td>
                <button class="btn btn-sm btn-outline-primary view-btn view-details" data-id="${item.id}">
                    <i class="bi bi-eye"></i>
                </button>
            </td>
            <td>R$ ${totalExpenses.toLocaleString('pt-BR')}</td>
        `;

        // Colunas financeiras para registros FINALIZADA ou FECHADA
        if (item.status === 'finalizada' || item.status === 'fechada') {
            const financialInfo = item.financial;

            // Para registros FECHADA, mostrar valores como somente leitura
            if (item.status === 'fechada') {
                tr.innerHTML += `
                    <td>${financialInfo ? `R$ ${financialInfo.provider_payment.toLocaleString('pt-BR')}` : 'R$ 0,00'}</td>
                    <td>${financialInfo ? `R$ ${financialInfo.diligence_value.toLocaleString('pt-BR')}` : 'R$ 0,00'}</td>
                    <td class="profit-cell">${financialInfo ? `R$ ${financialInfo.profit.toLocaleString('pt-BR')}` : 'R$ 0,00'}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-secondary" disabled>
                            <i class="bi bi-lock-fill"></i> Fechado
                        </button>
                    </td>
                `;
            }
            // Para registros FINALIZADA, mostrar inputs editáveis
            else {
                tr.innerHTML += `
                    <td>${financialInfo ? `R$ ${financialInfo.provider_payment.toLocaleString('pt-BR')}` :
                        `<input type="number" step="0.01" class="form-control form-control-sm provider-payment" 
                               placeholder="R$ 0,00" data-id="${item.id}" style="width: 100px;">`}
                    </td>
                    <td>${financialInfo ? `R$ ${financialInfo.diligence_value.toLocaleString('pt-BR')}` :
                        `<input type="number" step="0.01" class="form-control form-control-sm diligence-value" 
                               placeholder="R$ 0,00" data-id="${item.id}" style="width: 100px;">`}
                    </td>
                    <td class="profit-cell">${financialInfo ? `R$ ${financialInfo.profit.toLocaleString('pt-BR')}` : 'R$ 0,00'}</td>
                    <td>
                        ${financialInfo ?
                        `<button class="btn btn-sm btn-outline-secondary" disabled>
                                <i class="bi bi-lock"></i> Fechado
                            </button>` :
                        `<button class="btn btn-sm btn-outline-warning configure-financial" data-id="${item.id}">
                                <i class="bi bi-currency-dollar"></i> Configurar
                            </button>`}
                    </td>
                `;
            }
        } else {
            // Colunas vazias para registros não finalizados
            tr.innerHTML += '<td>-</td><td>-</td><td>-</td><td>-</td>';
        }

        if (item.status === 'fechada') {
            tr.setAttribute('data-status', 'fechada');
        }

        tbody.appendChild(tr);
    });

    // Adicionar event listeners
    addTableEventListeners();

    // Adicionar event listeners para os campos de input (apenas para FINALIZADA)
    addFinancialInputListeners();
}

function addFinancialInputListeners() {
    // Calcular lucro automaticamente quando os valores forem digitados (apenas para FINALIZADA)
    document.querySelectorAll('.diligence-value, .provider-payment').forEach(input => {
        input.addEventListener('input', function () {
            const recordId = this.getAttribute('data-id');
            const record = filteredData.find(item => item.id == recordId);

            if (record && record.status !== 'fechada') {
                calculateProfit(this);
            }
        });
    });
}

function calculateProfit(input) {
    const recordId = input.getAttribute('data-id');
    const row = input.closest('tr');

    // Verificar se o registro não está fechado
    const record = filteredData.find(item => item.id == recordId);
    if (record && record.status === 'fechada') {
        return; // Não calcular para registros fechados
    }

    const diligenceValueInput = row.querySelector('.diligence-value');
    const providerPaymentInput = row.querySelector('.provider-payment');
    const profitCell = row.querySelector('.profit-cell');

    if (diligenceValueInput && providerPaymentInput && profitCell) {
        const diligenceValue = parseFloat(diligenceValueInput.value) || 0;
        const providerPayment = parseFloat(providerPaymentInput.value) || 0;

        // Buscar valor total de despesas deste registro
        const totalExpenses = record.expenses && record.expenses.length > 0
            ? record.expenses.reduce((sum, expense) => sum + parseFloat(expense.value || 0), 0)
            : 0;

        // Calcular lucro: LUCRO = VALOR_DILIGÊNCIA - DESPESAS - PAGAMENTO_PRESTADOR
        const profit = diligenceValue - totalExpenses - providerPayment;

        profitCell.textContent = `R$ ${profit.toLocaleString('pt-BR')}`;

        // Destacar lucro negativo
        if (profit < 0) {
            profitCell.classList.add('text-danger');
            profitCell.classList.remove('text-success');
        } else {
            profitCell.classList.add('text-success');
            profitCell.classList.remove('text-danger');
        }
    }
}

// Função para adicionar event listeners à tabela
function addTableEventListeners() {
    // Botões de detalhes
    document.querySelectorAll('.view-details').forEach(btn => {
        btn.addEventListener('click', function () {
            const recordId = this.getAttribute('data-id');
            viewRecordDetails(recordId);
        });
    });

    // Botões de configurar finanças
    document.querySelectorAll('.configure-financial').forEach(btn => {
        btn.addEventListener('click', function () {
            const recordId = this.getAttribute('data-id');
            showFinancialModal(recordId);
        });
    });

    // Botões de fechar relatório
    document.querySelectorAll('.close-report').forEach(btn => {
        btn.addEventListener('click', function () {
            const recordId = this.getAttribute('data-id');
            const isClosed = this.classList.contains('btn-outline-secondary');

            if (!isClosed) {
                showFinancialModal(recordId);
            } else {
                showNotification('Relatório já está fechado', 'info');
            }
        });
    });
}


// Função para visualizar detalhes do registro
async function viewRecordDetails(recordId) {
    showLoading();

    try {
        const token = localStorage.getItem('access_token');
        if (!token) {
            throw new Error('Token de autenticação não encontrado');
        }

        const response = await fetch(`${apiBaseUrl}/records/${recordId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Erro ao carregar detalhes: ${response.status}`);
        }

        const record = await response.json();
        showRecordModal(record);

    } catch (error) {
        console.error('Erro ao carregar detalhes:', error);
        showNotification('Erro ao carregar detalhes do registro: ' + error.message, 'error');
    }

    hideLoading();
}
// Função para mostrar modal com detalhes do registro
function showRecordModal(record) {
    // Calcular totais
    const totalCosts = record.costs && record.costs.length > 0
        ? record.costs.reduce((sum, cost) => sum + parseFloat(cost.value || 0), 0)
        : 0;

    const totalExpenses = record.expenses && record.expenses.length > 0
        ? record.expenses.reduce((sum, expense) => sum + parseFloat(expense.value || 0), 0)
        : 0;

    // Construir o HTML do modal corretamente
    const modalHTML = `
        <div class="modal fade" id="recordModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Detalhes do Registro: ${record.record_id}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="row">
                            <div class="col-md-6">
                                <h6>Informações Básicas</h6>
                                <p><strong>Nome:</strong> ${record.name}</p>
                                <p><strong>Status:</strong> <span class="badge badge-${record.status}">${getStatusText(record.status)}</span></p>
                                <p><strong>Prioridade:</strong> ${record.priority}</p>
                                <p><strong>Tipo Documento:</strong> ${record.document_type}</p>
                            </div>
                            <div class="col-md-6">
                                <h6>Localização</h6>
                                <p><strong>Cidade/Estado:</strong> ${record.city}/${record.state.toUpperCase()}</p>
                                <p><strong>Pesquisado:</strong> ${record.researchedName}</p>
                                <p><strong>CPF/CNPJ:</strong> ${record.researchedCpf_cnpj}</p>
                            </div>
                        </div>
                        
                        <div class="row mt-3">
                            <div class="col-12">
                                <h6>Informações Adicionais</h6>
                                <p>${record.info || 'Nenhuma informação adicional'}</p>
                            </div>
                        </div>
                        
                        <div class="row mt-3">
                            <div class="col-md-6">
                                <h6>Financeiro</h6>
                                <p><strong>Total custas:</strong> R$ ${totalCosts.toLocaleString('pt-BR')}</p>
                                <p><strong>Total Despesas:</strong> R$ ${totalExpenses.toLocaleString('pt-BR')}</p>
                                ${record.status === 'fechada' && record.financial ? `
                                    <div class="alert alert-secondary">
                                        <strong><i class="bi bi-lock-fill"></i> Registro Fechado</strong>
                                        <p>Este registro foi fechado e não pode mais ser alterado.</p>
                                    </div>
                                    <p><strong>Valor da Diligência:</strong> R$ ${record.financial.diligence_value.toLocaleString('pt-BR')}</p>
                                    <p><strong>Pagamento do Prestador:</strong> R$ ${record.financial.provider_payment.toLocaleString('pt-BR')}</p>
                                    <p><strong>Lucro:</strong> R$ ${record.financial.profit.toLocaleString('pt-BR')}</p>
                                ` : ''}
                            </div>
                            <div class="col-md-6">
                                <h6>Responsáveis</h6>
                                <p><strong>Cliente:</strong> ${record.client.name}</p>
                                <p><strong>Prestador:</strong> ${record.provider.name}</p>
                                <p><strong>Data Registro:</strong> ${record.register_date}</p>
                                ${record.last_update ? `<p><strong>Última Atualização:</strong> ${new Date(record.last_update).toLocaleString('pt-BR')}</p>` : ''}
                            </div>
                        </div>
                        
                        <!-- Adicionar seção financeira se o registro estiver finalizado -->
                        ${record.status === 'finalizada' && !record.financial ? `
                        <div class="row mt-3">
                            <div class="col-12">
                                <h6>Informações Financeiras</h6>
                                <p class="text-muted">Informações financeiras não configuradas</p>
                                <button class="btn btn-sm btn-outline-primary configure-financial" data-id="${record.id}">
                                    <i class="bi bi-currency-dollar"></i> Configurar Finanças
                                </button>
                            </div>
                        </div>
                        ` : ''}
                        
                        <!-- Seção de custas e Despesas -->
                        <div class="row mt-4">
                            <div class="col-12">
                                <h6>Custas e Despesas</h6>
                                ${(record.costs && record.costs.length > 0) || (record.expenses && record.expenses.length > 0) ? `
                                    <div class="table-responsive">
                                        <table class="table table-sm">
                                            <thead>
                                                <tr>
                                                    <th>Tipo</th>
                                                    <th>Descrição</th>
                                                    <th>Valor</th>
                                                    <th>Arquivo</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${record.costs ? record.costs.map(cost => `
                                                    <tr>
                                                        <td><span class="badge bg-info">Custa</span></td>
                                                        <td>${cost.title}</td>
                                                        <td>R$ ${parseFloat(cost.value || 0).toLocaleString('pt-BR')}</td>
                                                        <td>${cost.file_url ? `<a href="${apiBaseUrl}${cost.file_url}" target="_blank">Ver</a>` : 'Nenhum'}</td>
                                                    </tr>
                                                `).join('') : ''}
                                                ${record.expenses ? record.expenses.map(expense => `
                                                    <tr>
                                                        <td><span class="badge bg-warning text-dark">Despesa</span></td>
                                                        <td>${expense.title}</td>
                                                        <td>R$ ${parseFloat(expense.value || 0).toLocaleString('pt-BR')}</td>
                                                        <td>${expense.file_url ? `<a href="${apiBaseUrl}${expense.file_url}" target="_blank">Ver</a>` : 'Nenhum'}</td>
                                                    </tr>
                                                `).join('') : ''}
                                            </tbody>
                                        </table>
                                    </div>
                                ` : '<p class="text-muted">Nenhuma Custa ou despesa registrada</p>'}
                            </div>
                        </div>
                        
                        <!-- Seção de Anexos -->
                        ${record.attachments && record.attachments.length > 0 ? `
                        <div class="row mt-4">
                            <div class="col-12">
                                <h6>Anexos</h6>
                                <div class="d-flex flex-wrap gap-2">
                                    ${record.attachments.map(attachment => `
                                        <div class="card" style="width: 200px;">
                                            <div class="card-body">
                                                <h6 class="card-title">${attachment.title}</h6>
                                                <p class="card-text">${attachment.description || 'Sem descrição'}</p>
                                                ${attachment.file_url ? `
                                                    <a href="${apiBaseUrl}${attachment.file_url}" target="_blank" class="btn btn-sm btn-primary">
                                                        <i class="bi bi-download"></i> Baixar
                                                    </a>
                                                ` : ''}
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                        ` : ''}
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button>
                        ${record.status === 'finalizada' && !record.financial ? `
                            <button type="button" class="btn btn-primary configure-financial" data-id="${record.id}">
                                <i class="bi bi-currency-dollar"></i> Configurar Finanças
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        </div>
    `;

    // Adicionar modal ao DOM
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHTML;
    document.body.appendChild(modalContainer);

    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('recordModal'));
    modal.show();

    // Adicionar event listener para o botão de configurar finanças
    setTimeout(() => {
        document.querySelectorAll('.configure-financial').forEach(btn => {
            btn.addEventListener('click', function () {
                const recordId = this.getAttribute('data-id');
                bootstrap.Modal.getInstance(document.getElementById('recordModal')).hide();
                showFinancialModal(recordId);
            });
        });
    }, 100);

    // Remover modal do DOM quando fechado
    document.getElementById('recordModal').addEventListener('hidden.bs.modal', function () {
        setTimeout(() => {
            if (modalContainer.parentNode) {
                modalContainer.remove();
            }
        }, 300);
    });
}

function getStatusText(status) {
    return statusMap[status] || status;
}

// Criar gráficos
function createCharts() {
    // Gráfico de Evolução Mensal
    const evolucaoCtx = document.getElementById('evolucaoMensalChart').getContext('2d');
    charts.evolucao = new Chart(evolucaoCtx, {
        type: 'line',
        data: getEvolucaoMensalData(),
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: false }
            }
        }
    });

    // Gráfico de Distribuição por Empresa
    const distribuicaoCtx = document.getElementById('distribuicaoEmpresaChart').getContext('2d');
    charts.distribuicao = new Chart(distribuicaoCtx, {
        type: 'doughnut',
        data: getDistribuicaoEmpresaData(),
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });

    // Gráfico de Status das Diligências
    const statusCtx = document.getElementById('statusDiligenciasChart').getContext('2d');
    charts.status = new Chart(statusCtx, {
        type: 'pie',
        data: getStatusDiligenciasData(),
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });

    // Gráfico de Top Estados
    const estadosCtx = document.getElementById('topEstadosChart').getContext('2d');
    charts.estados = new Chart(estadosCtx, {
        type: 'bar',
        data: getTopEstadosData(),
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

// Atualizar gráficos
function updateCharts() {
    charts.evolucao.data = getEvolucaoMensalData();
    charts.evolucao.update();

    charts.distribuicao.data = getDistribuicaoEmpresaData();
    charts.distribuicao.update();

    charts.status.data = getStatusDiligenciasData();
    charts.status.update();

    charts.estados.data = getTopEstadosData();
    charts.estados.update();
}

// Dados para gráfico de evolução mensal
function getEvolucaoMensalData() {
    // Agrupar dados por mês
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const currentYear = new Date().getFullYear();

    const pedidosPorMes = Array(12).fill(0);
    const valorPorMes = Array(12).fill(0);

    filteredData.forEach(item => {
        const date = new Date(item.date);
        if (date.getFullYear() === currentYear) {
            const mes = date.getMonth();
            pedidosPorMes[mes]++;
            valorPorMes[mes] += item.value;
        }
    });

    return {
        labels: meses,
        datasets: [{
            label: 'Pedidos Recebidos',
            data: pedidosPorMes,
            borderColor: '#6948D3',
            backgroundColor: 'rgba(13, 110, 253, 0.1)',
            fill: true,
            tension: 0.3
        }, {
            label: 'Valor Recebido (R$)',
            data: valorPorMes,
            borderColor: '#198754',
            backgroundColor: 'rgba(25, 135, 84, 0.1)',
            fill: true,
            tension: 0.3
        }]
    };
}

// Dados para gráfico de distribuição por empresa
function getDistribuicaoEmpresaData() {
    const empresas = {};

    filteredData.forEach(item => {
        empresas[item.company] = (empresas[item.company] || 0) + 1;
    });

    return {
        labels: Object.keys(empresas),
        datasets: [{
            data: Object.values(empresas),
            backgroundColor: ['#2d157cff', '#583bb9ff', '#7c5be6ff', '#9e81fcff'],
            borderWidth: 1
        }]
    };
}

// Dados para gráfico de status das diligências
function getStatusDiligenciasData() {
    const statusCount = {
        'ativa': 0,
        'suspensa': 0,
        'entregue': 0,
        'finalizada': 0,
        'fechada': 0
    };

    filteredData.forEach(item => {
        statusCount[item.status]++;
    });

    return {
        labels: ['Ativa', 'Suspensa', 'Entregue', 'Finalizada', 'Fechada'],
        datasets: [{
            data: Object.values(statusCount),
            backgroundColor: ['#6948D3', '#ffc107', '#198754', '#dc3545', '#6c757d'],
            borderWidth: 1
        }]
    };
}

// Dados para gráfico de top estados
function getTopEstadosData() {
    const estados = {};

    filteredData.forEach(item => {
        estados[item.state] = (estados[item.state] || 0) + 1;
    });

    // Ordenar e pegar top 5
    const topEstados = Object.entries(estados)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    return {
        labels: topEstados.map(item => item[0].toUpperCase()),
        datasets: [{
            label: 'Quantidade de Pedidos',
            data: topEstados.map(item => item[1]),
            backgroundColor: '#6948D3',
            borderWidth: 0
        }]
    };
}

// Funções utilitárias
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
}

function showLoading() {
    document.getElementById('loadingOverlay').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

// Exportar para Excel (ATUALIZADA)
async function exportToExcel() {
    showLoading();

    try {
        // Preparar dados para exportação
        const dataForExport = filteredData.map(item => {
            // Calcular totais de despesas
            const totalExpenses = item.expenses && item.expenses.length > 0
                ? item.expenses.reduce((sum, expense) => sum + parseFloat(expense.value || 0), 0)
                : 0;

            // Informações financeiras
            const diligenceValue = item.financial ? parseFloat(item.financial.diligence_value) || 0 : 0;
            const providerPayment = item.financial ? parseFloat(item.financial.provider_payment) || 0 : 0;
            const profit = item.financial ? parseFloat(item.financial.profit) || 0 : 0;

            return {
                'ID do Registro': item.record_id,
                'Data': formatDate(item.date),
                'Empresa': item.company,
                'Cidade': item.city,
                'Estado': item.state,
                'Status': statusMap[item.status] || item.status,
                'Tipo Documento': item.document_type,
                'Pesquisado': item.researchedName,
                'CPF/CNPJ Pesquisado': item.researchedCpf_cnpj,
                'Total Despesas (R$)': totalExpenses,
                'Valor Diligência (R$)': diligenceValue,
                'Pagamento Prestador (R$)': providerPayment,
                'Lucro (R$)': profit,
                'Prestador': item.provider,
                'Prioridade': item.priority,
                'Informações Adicionais': item.info || '',
                'Data de Registro': item.date,
                'Última Atualização': item.last_update ? formatDateTime(item.last_update) : ''
            };
        });

        // Adicionar estatísticas resumidas
        const totalDespesa = filteredData.reduce((sum, item) => sum + (parseFloat(item.expense) || 0), 0);

        const financialData = filteredData.filter(item =>
            item.status === 'finalizada' && item.financial
        );

        const totalDiligencia = financialData.reduce((sum, item) =>
            sum + (parseFloat(item.financial.diligence_value) || 0), 0
        );

        const totalProviderPayment = financialData.reduce((sum, item) =>
            sum + (parseFloat(item.financial.provider_payment) || 0), 0
        );

        const totalLucro = financialData.reduce((sum, item) =>
            sum + (parseFloat(item.financial.profit) || 0), 0
        );

        const summaryData = [
            {},
            { 'ID do Registro': 'RELATÓRIO RESUMIDO', 'Data': '', 'Empresa': '', 'Cidade': '', 'Estado': '', 'Status': '', 'Tipo Documento': '', 'Pesquisado': '', 'CPF/CNPJ Pesquisado': '', 'Total Despesas (R$)': '', 'Valor Diligência (R$)': '', 'Pagamento Prestador (R$)': '', 'Lucro (R$)': '', 'Prestador': '', 'Prioridade': '', 'Informações Adicionais': '', 'Data de Registro': '', 'Última Atualização': '' },
            { 'ID do Registro': 'Total de Pedidos', 'Data': filteredData.length, 'Empresa': '', 'Cidade': '', 'Estado': '', 'Status': '', 'Tipo Documento': '', 'Pesquisado': '', 'CPF/CNPJ Pesquisado': '', 'Total Despesas (R$)': '', 'Valor Diligência (R$)': '', 'Pagamento Prestador (R$)': '', 'Lucro (R$)': '', 'Prestador': '', 'Prioridade': '', 'Informações Adicionais': '', 'Data de Registro': '', 'Última Atualização': '' },
            { 'ID do Registro': 'Total Despesas', 'Data': '', 'Empresa': '', 'Cidade': '', 'Estado': '', 'Status': '', 'Tipo Documento': '', 'Pesquisado': '', 'CPF/CNPJ Pesquisado': '', 'Total Despesas (R$)': totalDespesa, 'Valor Diligência (R$)': '', 'Pagamento Prestador (R$)': '', 'Lucro (R$)': '', 'Prestador': '', 'Prioridade': '', 'Informações Adicionais': '', 'Data de Registro': '', 'Última Atualização': '' },
            { 'ID do Registro': 'Total Valor Diligências', 'Data': '', 'Empresa': '', 'Cidade': '', 'Estado': '', 'Status': '', 'Tipo Documento': '', 'Pesquisado': '', 'CPF/CNPJ Pesquisado': '', 'Total Despesas (R$)': '', 'Valor Diligência (R$)': totalDiligencia, 'Pagamento Prestador (R$)': '', 'Lucro (R$)': '', 'Prestador': '', 'Prioridade': '', 'Informações Adicionais': '', 'Data de Registro': '', 'Última Atualização': '' },
            { 'ID do Registro': 'Total Pagamento Prestadores', 'Data': '', 'Empresa': '', 'Cidade': '', 'Estado': '', 'Status': '', 'Tipo Documento': '', 'Pesquisado': '', 'CPF/CNPJ Pesquisado': '', 'Total Despesas (R$)': '', 'Valor Diligência (R$)': '', 'Pagamento Prestador (R$)': totalProviderPayment, 'Lucro (R$)': '', 'Prestador': '', 'Prioridade': '', 'Informações Adicionais': '', 'Data de Registro': '', 'Última Atualização': '' },
            { 'ID do Registro': 'Lucro Total', 'Data': '', 'Empresa': '', 'Cidade': '', 'Estado': '', 'Status': '', 'Tipo Documento': '', 'Pesquisado': '', 'CPF/CNPJ Pesquisado': '', 'Total Despesas (R$)': '', 'Valor Diligência (R$)': '', 'Pagamento Prestador (R$)': '', 'Lucro (R$)': totalLucro, 'Prestador': '', 'Prioridade': '', 'Informações Adicionais': '', 'Data de Registro': '', 'Última Atualização': '' },
            {}
        ];

        // Combinar dados
        const allData = [...summaryData, ...dataForExport];

        // Criar workbook
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(allData, { skipHeader: true });

        // Adicionar cabeçalhos manualmente
        const headers = [
            'ID do Registro', 'Data', 'Empresa', 'Cidade', 'Estado', 'Status',
            'Tipo Documento', 'Pesquisado', 'CPF/CNPJ Pesquisado', 'Total Despesas (R$)',
            'Valor Diligência (R$)', 'Pagamento Prestador (R$)', 'Lucro (R$)',
            'Prestador', 'Prioridade', 'Informações Adicionais', 'Data de Registro',
            'Última Atualização'
        ];

        XLSX.utils.sheet_add_aoa(ws, [headers], { origin: 'A1' });

        // Formatar células monetárias
        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let R = 1; R <= range.e.r; ++R) {
            // Colunas J, K, L, M (Despesas, Diligência, Pagamento, Lucro)
            ['J', 'K', 'L', 'M'].forEach(col => {
                const cell = XLSX.utils.encode_cell({ r: R, c: col.charCodeAt(0) - 65 });
                if (ws[cell] && typeof ws[cell].v === 'number') {
                    ws[cell].z = '"R$"#,##0.00';
                }
            });
        }

        // Formatar cabeçalhos
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const headerCell = XLSX.utils.encode_cell({ r: 0, c: C });
            if (!ws[headerCell]) continue;
            ws[headerCell].s = {
                font: { bold: true, color: { rgb: "FFFFFF" } },
                fill: { fgColor: { rgb: "4472C4" } }
            };
        }

        // Ajustar largura das colunas
        const colWidths = [
            { wch: 15 }, { wch: 12 }, { wch: 20 }, { wch: 15 }, { wch: 10 },
            { wch: 12 }, { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 15 },
            { wch: 15 }, { wch: 18 }, { wch: 15 }, { wch: 20 }, { wch: 12 },
            { wch: 25 }, { wch: 15 }, { wch: 20 }
        ];

        ws['!cols'] = colWidths;

        // Adicionar worksheet ao workbook
        XLSX.utils.book_append_sheet(wb, ws, "Relatório");

        // Gerar nome do arquivo com data atual
        const date = new Date();
        const fileName = `relatorio_financeiro_${date.getDate()}${date.getMonth() + 1}${date.getFullYear()}_${date.getHours()}${date.getMinutes()}.xlsx`;

        // Salvar arquivo
        XLSX.writeFile(wb, fileName);

        hideLoading();
        showNotification('Excel exportado com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao exportar Excel:', error);
        hideLoading();
        showNotification('Erro ao exportar Excel', 'error');
    }
}

// Adicionar esta função para formatar dados completos
function prepareCompleteExportData() {
    return filteredData.map(item => {
        const saldo = item.value - item.expense;

        return {
            'ID do Registro': item.record_id,
            'Data': formatDate(item.date),
            'Empresa': item.company,
            'Cidade': item.city,
            'Estado': item.state,
            'Tipo Documento': item.document_type,
            'Valor Recebido (R$)': item.value,
            'Despesa (R$)': item.expense,
            'Saldo Líquido (R$)': saldo,
            'Status': statusMap[item.status] || item.status,
            'Pesquisado': item.researchedName,
            'CPF/CNPJ': item.researchedCpf_cnpj,
            'Prestador': item.provider,
            'Prioridade': item.priority,
            'Informações': item.info
        };
    });
}

// Exportar para PDF (ATUALIZADA)
async function exportToPDF() {
    showLoading();

    try {
        // Usar jsPDF com autoTable
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Adicionar título
        doc.setFontSize(18);
        doc.setTextColor(40, 40, 40);
        doc.text('Relatório Financeiro de Pedidos', 14, 22);

        // Adicionar data de emissão
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`Emitido em: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`, 14, 30);

        // Adicionar estatísticas resumidas
        const totalDespesa = filteredData.reduce((sum, item) => sum + (parseFloat(item.expense) || 0), 0);

        const financialData = filteredData.filter(item =>
            item.status === 'finalizada' && item.financial
        );

        const totalDiligencia = financialData.reduce((sum, item) =>
            sum + (parseFloat(item.financial.diligence_value) || 0), 0
        );

        const totalProviderPayment = financialData.reduce((sum, item) =>
            sum + (parseFloat(item.financial.provider_payment) || 0), 0
        );

        const totalLucro = financialData.reduce((sum, item) =>
            sum + (parseFloat(item.financial.profit) || 0), 0
        );

        doc.setFontSize(12);
        doc.setTextColor(40, 40, 40);
        doc.text(`Total de Pedidos: ${filteredData.length}`, 14, 45);
        doc.text(`Total Despesas: R$ ${totalDespesa.toLocaleString('pt-BR')}`, 14, 55);
        doc.text(`Total Valor Diligências: R$ ${totalDiligencia.toLocaleString('pt-BR')}`, 14, 65);
        doc.text(`Total Pagamento Prestadores: R$ ${totalProviderPayment.toLocaleString('pt-BR')}`, 14, 75);
        doc.text(`Lucro Total: R$ ${totalLucro.toLocaleString('pt-BR')}`, 14, 85);

        // Preparar dados para a tabela
        const tableData = filteredData.map(item => {
            // Calcular totais de despesas
            const totalExpenses = item.expenses && item.expenses.length > 0
                ? item.expenses.reduce((sum, expense) => sum + parseFloat(expense.value || 0), 0)
                : 0;

            // Informações financeiras
            const diligenceValue = item.financial ? parseFloat(item.financial.diligence_value) || 0 : 0;
            const providerPayment = item.financial ? parseFloat(item.financial.provider_payment) || 0 : 0;
            const profit = item.financial ? parseFloat(item.financial.profit) || 0 : 0;

            return [
                item.record_id,
                formatDate(item.date),
                item.company,
                `${item.city}/${item.state}`,
                statusMap[item.status] || item.status,
                `R$ ${totalExpenses.toLocaleString('pt-BR')}`,
                `R$ ${diligenceValue.toLocaleString('pt-BR')}`,
                `R$ ${providerPayment.toLocaleString('pt-BR')}`,
                `R$ ${profit.toLocaleString('pt-BR')}`,
                item.provider
            ];
        });

        // Adicionar tabela
        doc.autoTable({
            startY: 95,
            head: [['ID', 'Data', 'Empresa', 'Local', 'Status', 'Despesas (R$)', 'Diligência (R$)', 'Pagamento (R$)', 'Lucro (R$)', 'Prestador']],
            body: tableData,
            theme: 'grid',
            headStyles: {
                fillColor: [65, 114, 196],
                textColor: 255,
                fontStyle: 'bold'
            },
            alternateRowStyles: {
                fillColor: [240, 240, 240]
            },
            styles: {
                fontSize: 8,
                cellPadding: 2,
                overflow: 'linebreak'
            },
            margin: { left: 14, right: 14 },
            columnStyles: {
                0: { cellWidth: 15 },
                1: { cellWidth: 15 },
                2: { cellWidth: 20 },
                3: { cellWidth: 20 },
                4: { cellWidth: 15 },
                5: { cellWidth: 15 },
                6: { cellWidth: 15 },
                7: { cellWidth: 15 },
                8: { cellWidth: 15 },
                9: { cellWidth: 20 }
            }
        });

        // Adicionar gráficos ao PDF
        await addChartsToPDF(doc);

        // Adicionar número de páginas
        const totalPages = doc.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text(`Página ${i} de ${totalPages}`, doc.internal.pageSize.width - 40, doc.internal.pageSize.height - 10);
        }

        // Gerar nome do arquivo com data atual
        const date = new Date();
        const fileName = `relatorio_financeiro_${date.getDate()}${date.getMonth() + 1}${date.getFullYear()}_${date.getHours()}${date.getMinutes()}.pdf`;

        // Salvar PDF
        doc.save(fileName);

        hideLoading();
        showNotification('PDF exportado com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao exportar PDF:', error);
        hideLoading();
        showNotification('Erro ao exportar PDF', 'error');
    }
}

// Função para adicionar gráficos ao PDF (ATUALIZADA)
async function addChartsToPDF(doc) {
    try {
        // Adicionar nova página para gráficos
        doc.addPage();
        doc.setFontSize(16);
        doc.text('Análise Financeira - Gráficos e Estatísticas', 14, 22);

        // Estatísticas financeiras
        const financialData = filteredData.filter(item =>
            item.status === 'finalizada' && item.financial
        );

        const totalDiligencia = financialData.reduce((sum, item) =>
            sum + (parseFloat(item.financial.diligence_value) || 0), 0
        );

        const totalProviderPayment = financialData.reduce((sum, item) =>
            sum + (parseFloat(item.financial.provider_payment) || 0), 0
        );

        const totalLucro = financialData.reduce((sum, item) =>
            sum + (parseFloat(item.financial.profit) || 0), 0
        );

        doc.setFontSize(12);
        doc.text('Resumo Financeiro:', 14, 40);
        doc.text(`Total Valor Diligências: R$ ${totalDiligencia.toLocaleString('pt-BR')}`, 20, 50);
        doc.text(`Total Pagamento Prestadores: R$ ${totalProviderPayment.toLocaleString('pt-BR')}`, 20, 60);
        doc.text(`Lucro Total: R$ ${totalLucro.toLocaleString('pt-BR')}`, 20, 70);

        // Distribuição por empresa
        doc.text('Distribuição por Empresa:', 14, 90);

        const empresas = {};
        financialData.forEach(item => {
            empresas[item.company] = (empresas[item.company] || 0) + 1;
        });

        let yPosition = 100;
        Object.entries(empresas).forEach(([empresa, quantidade], index) => {
            if (yPosition > 250) {
                doc.addPage();
                yPosition = 20;
            }
            doc.text(`${empresa}: ${quantidade} pedidos (${((quantidade / financialData.length) * 100).toFixed(1)}%)`, 20, yPosition);
            yPosition += 8;
        });

        // Análise de lucratividade por empresa
        if (financialData.length > 0) {
            yPosition += 15;
            if (yPosition > 250) {
                doc.addPage();
                yPosition = 20;
            }

            doc.text('Lucratividade por Empresa:', 14, yPosition);
            yPosition += 10;

            const lucroPorEmpresa = {};
            financialData.forEach(item => {
                if (!lucroPorEmpresa[item.company]) {
                    lucroPorEmpresa[item.company] = 0;
                }
                lucroPorEmpresa[item.company] += parseFloat(item.financial.profit) || 0;
            });

            Object.entries(lucroPorEmpresa).forEach(([empresa, lucro]) => {
                if (yPosition > 250) {
                    doc.addPage();
                    yPosition = 20;
                }
                const status = lucro >= 0 ? 'Lucro' : 'Prejuízo';
                doc.text(`${empresa}: R$ ${lucro.toLocaleString('pt-BR')} (${status})`, 20, yPosition);
                yPosition += 8;
            });
        }

    } catch (error) {
        console.error('Erro ao adicionar gráficos ao PDF:', error);
    }
}

// Função para mostrar notificações
function showNotification(message, type = 'info') {
    // Remover notificações existentes
    const existingNotifications = document.querySelectorAll('.custom-notification');
    existingNotifications.forEach(notification => notification.remove());

    // Criar elemento de notificação
    const notification = document.createElement('div');
    notification.className = `custom-notification alert alert-${type} alert-dismissible fade show`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        min-width: 300px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;

    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    // Adicionar ao documento
    document.body.appendChild(notification);

    // Remover automaticamente após 5 segundos
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

// Adicione estas funções utilitárias se não existirem
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

// Atualize a função updateDashboard para incluir variações percentuais
function updateDashboard() {
    const totalPedidos = filteredData.length;

    // Calcular total de despesas
    const totalDespesa = filteredData.reduce((sum, item) => {
        return sum + (parseFloat(item.expense) || 0);
    }, 0);

    // Calcular totais financeiros apenas para registros finalizados com dados financeiros
    let totalDiligencia = 0;
    let totalProviderPayment = 0;
    let totalLucro = 0;

    filteredData.forEach(item => {
        if (item.status === 'fechada' && item.financial) {
            totalDiligencia += parseFloat(item.financial.diligence_value) || 0;
            totalProviderPayment += parseFloat(item.financial.provider_payment) || 0;
            totalLucro += parseFloat(item.financial.profit) || 0;
        }
    });

    // Garantir que não seja NaN
    totalDiligencia = isNaN(totalDiligencia) ? 0 : totalDiligencia;
    totalProviderPayment = isNaN(totalProviderPayment) ? 0 : totalProviderPayment;
    totalLucro = isNaN(totalLucro) ? 0 : totalLucro;

    // Calcular variações mensais
    const variacoes = calculateMonthlyVariations(
        totalPedidos,
        totalDespesa,
        totalDiligencia,
        totalProviderPayment,
        totalLucro
    );

    // Atualizar cards com valores e variações
    updateCard('[data-stat="pedidos"]', totalPedidos, variacoes.pedidos, 'pedidos', variacoes.hasPreviousData);
    updateCard('[data-stat="despesa"]', totalDespesa, variacoes.despesa, 'despesa', variacoes.hasPreviousData);
    updateCard('[data-stat="saldo"]', totalLucro, variacoes.lucro, 'lucro', variacoes.hasPreviousData);

    // Atualizar cards adicionais se existirem
    const diligenceCard = document.querySelector('[data-stat="diligencia"]');
    const providerCard = document.querySelector('[data-stat="provider-payment"]');

    if (diligenceCard) {
        updateCardElement(diligenceCard, totalDiligencia, variacoes.diligencia, 'diligencia', variacoes.hasPreviousData);
    }

    if (providerCard) {
        updateCardElement(providerCard, totalProviderPayment, variacoes.provider, 'provider', variacoes.hasPreviousData);
    }

    updateComparisonPeriod();

    // Atualizar tabela
    updateTable();
}

function updateComparisonPeriod() {
    const comparisonElement = document.getElementById('comparison-period');
    if (comparisonElement) {
        comparisonElement.textContent = getComparisonPeriodText();
    }
}

// Função para calcular variações mensais
function calculateMonthlyVariations(pedidos, despesa, diligencia, provider, lucro) {
    // Obter período atual dos filtros
    const periodoSelect = document.getElementById('periodo');
    const dataInicioInput = document.getElementById('dataInicio');
    const dataFimInput = document.getElementById('dataFim');

    let startDate, endDate;

    if (periodoSelect.value === 'custom' && dataInicioInput.value && dataFimInput.value) {
        // Período personalizado
        startDate = new Date(dataInicioInput.value);
        endDate = new Date(dataFimInput.value);
    } else {
        // Período padrão (últimos 30 dias)
        endDate = new Date();
        startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(periodoSelect.value || 30));
    }

    // Calcular período do mês anterior
    const previousMonthStart = new Date(startDate);
    previousMonthStart.setMonth(previousMonthStart.getMonth() - 1);

    const previousMonthEnd = new Date(endDate);
    previousMonthEnd.setMonth(previousMonthEnd.getMonth() - 1);

    // Filtrar dados do mês anterior
    const previousMonthData = allData.filter(item => {
        const itemDate = new Date(item.date);
        return itemDate >= previousMonthStart && itemDate <= previousMonthEnd;
    });

    // Se não há dados do mês anterior, retornar variação zero
    if (previousMonthData.length === 0) {
        return {
            pedidos: 0,
            despesa: 0,
            diligencia: 0,
            provider: 0,
            lucro: 0,
            hasPreviousData: false
        };
    }

    // Calcular totais do mês anterior
    const previousPedidos = previousMonthData.length;

    const previousDespesa = previousMonthData.reduce((sum, item) => {
        return sum + (parseFloat(item.expense) || 0);
    }, 0);

    const previousFinancialData = previousMonthData.filter(item =>
        item.status === 'finalizada' && item.financial
    );

    const previousDiligencia = previousFinancialData.reduce((sum, item) =>
        sum + (parseFloat(item.financial.diligence_value) || 0), 0
    );

    const previousProvider = previousFinancialData.reduce((sum, item) =>
        sum + (parseFloat(item.financial.provider_payment) || 0), 0
    );

    const previousLucro = previousFinancialData.reduce((sum, item) =>
        sum + (parseFloat(item.financial.profit) || 0), 0
    );

    // Calcular variações percentuais
    const calcularVariacao = (atual, anterior) => {
        if (anterior === 0) return atual > 0 ? 100 : 0;
        return ((atual - anterior) / anterior) * 100;
    };

    return {
        pedidos: Math.round(calcularVariacao(pedidos, previousPedidos)),
        despesa: Math.round(calcularVariacao(despesa, previousDespesa)),
        diligencia: Math.round(calcularVariacao(diligencia, previousDiligencia)),
        provider: Math.round(calcularVariacao(provider, previousProvider)),
        lucro: Math.round(calcularVariacao(lucro, previousLucro)),
        hasPreviousData: true
    };
}

// Função para atualizar um card individual
function updateCard(selector, valor, variacao, tipo, hasPreviousData) {
    const element = document.querySelector(selector);
    if (!element) return;

    updateCardElement(element, valor, variacao, tipo, hasPreviousData);
}

// Função para atualizar elemento do card
function updateCardElement(element, valor, variacao, tipo, hasPreviousData) {
    const card = element.closest('.card');
    const variationElement = card.querySelector('.variation');

    // Formatando o valor
    if (tipo === 'pedidos') {
        element.textContent = valor.toLocaleString('pt-BR');
    } else {
        element.textContent = `R$ ${valor.toLocaleString('pt-BR')}`;
    }

    // Atualizar variação
    if (variationElement) {
        updateVariationElement(variationElement, variacao, tipo, hasPreviousData);
    }
}

// Função para atualizar elemento de variação
function updateVariationElement(element, variacao, tipo, hasPreviousData) {
    if (!hasPreviousData) {
        element.innerHTML = '<i class="bi bi-dash-circle"></i> N/D';
        element.classList.add('text-warning');
        element.title = 'Não há dados do mês anterior para comparação';
        return;
    }

    const isNegative = tipo === 'despesa' ? variacao > 0 : variacao < 0;
    const isNeutral = variacao === 0;

    // Limpar classes anteriores
    element.classList.remove('text-success', 'text-danger', 'text-warning');

    if (isNeutral) {
        element.classList.add('text-warning');
        element.innerHTML = `<i class="bi bi-dash-circle"></i> ${variacao}%`;
        element.title = 'Sem variação em relação ao mês anterior';
    } else if (isNegative) {
        element.classList.add('text-danger');
        element.innerHTML = `<i class="bi bi-arrow-up"></i> ${Math.abs(variacao)}%`;
        element.title = `Aumento de ${Math.abs(variacao)}% em relação ao mês anterior`;
    } else {
        element.classList.add('text-success');
        element.innerHTML = `<i class="bi bi-arrow-up"></i> ${variacao}%`;
        element.title = `Crescimento de ${variacao}% em relação ao mês anterior`;
    }
}

// Função para formatar o período de comparação
function getComparisonPeriodText() {
    const periodoSelect = document.getElementById('periodo');
    const dataInicioInput = document.getElementById('dataInicio');
    const dataFimInput = document.getElementById('dataFim');

    if (periodoSelect.value === 'custom' && dataInicioInput.value && dataFimInput.value) {
        const startDate = new Date(dataInicioInput.value);
        const endDate = new Date(dataFimInput.value);

        const previousStart = new Date(startDate);
        previousStart.setMonth(previousStart.getMonth() - 1);

        const previousEnd = new Date(endDate);
        previousEnd.setMonth(previousEnd.getMonth() - 1);

        return `vs ${previousStart.toLocaleDateString('pt-BR')} - ${previousEnd.toLocaleDateString('pt-BR')}`;
    } else {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(periodoSelect.value || 30));

        const previousStart = new Date(startDate);
        previousStart.setMonth(previousStart.getMonth() - 1);

        const previousEnd = new Date(endDate);
        previousEnd.setMonth(previousEnd.getMonth() - 1);

        return `vs ${previousStart.toLocaleDateString('pt-BR')} - ${previousEnd.toLocaleDateString('pt-BR')}`;
    }
}

// Função para calcular variações percentuais
function calculateVariations(pedidos, despesa, diligencia, provider, lucro) {
    // Se não temos dados anteriores, retornar variação zero
    if (previousPeriodData.length === 0) {
        return {
            pedidos: 0,
            despesa: 0,
            diligencia: 0,
            provider: 0,
            lucro: 0
        };
    }

    // Calcular totais do período anterior
    const previousPedidos = previousPeriodData.length;

    const previousDespesa = previousPeriodData.reduce((sum, item) => {
        return sum + (parseFloat(item.expense) || 0);
    }, 0);

    const previousFinancialData = previousPeriodData.filter(item =>
        item.status === 'finalizada' && item.financial
    );

    const previousDiligencia = previousFinancialData.reduce((sum, item) =>
        sum + (parseFloat(item.financial.diligence_value) || 0), 0
    );

    const previousProvider = previousFinancialData.reduce((sum, item) =>
        sum + (parseFloat(item.financial.provider_payment) || 0), 0
    );

    const previousLucro = previousFinancialData.reduce((sum, item) =>
        sum + (parseFloat(item.financial.profit) || 0), 0
    );

    // Calcular variações percentuais
    const calcularVariacao = (atual, anterior) => {
        if (anterior === 0) return atual > 0 ? 100 : 0;
        return ((atual - anterior) / anterior) * 100;
    };

    return {
        pedidos: Math.round(calcularVariacao(pedidos, previousPedidos)),
        despesa: Math.round(calcularVariacao(despesa, previousDespesa)),
        diligencia: Math.round(calcularVariacao(diligencia, previousDiligencia)),
        provider: Math.round(calcularVariacao(provider, previousProvider)),
        lucro: Math.round(calcularVariacao(lucro, previousLucro))
    };
}

async function showFinancialModal(recordId) {
    const record = filteredData.find(item => item.id == recordId);
    if (!record) return;

    // Obter valores dos inputs da tabela
    const diligenceValueInput = document.querySelector(`.diligence-value[data-id="${recordId}"]`);
    const providerPaymentInput = document.querySelector(`.provider-payment[data-id="${recordId}"]`);

    const diligenceValue = diligenceValueInput ? parseFloat(diligenceValueInput.value) : 0;
    const providerPayment = providerPaymentInput ? parseFloat(providerPaymentInput.value) : 0;

    showFinancialFormModal(recordId, record.expense, {
        diligence_value: diligenceValue,
        provider_payment: providerPayment,
        profit: diligenceValue - record.expense - providerPayment
    });
}

// Função para mostrar formulário de finanças
function showFinancialFormModal(recordId, expense, financialData) {
    const modalHTML = `
        <div class="modal fade" id="financialModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Informações Financeiras e Fechamento</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="alert alert-info">
                            <i class="bi bi-info-circle"></i> 
                            <strong>Atenção:</strong> Ao salvar as informações financeiras, 
                            o registro será automaticamente fechado e não poderá mais ser editado.
                        </div>
                        
                        <form id="financialForm">
                            <div class="mb-3">
                                <label class="form-label">Valor da Diligência (R$)</label>
                                <input type="number" step="0.01" class="form-control" id="diligenceValue" 
                                       value="${financialData ? financialData.diligence_value : ''}" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Pagamento do Prestador (R$)</label>
                                <input type="number" step="0.01" class="form-control" id="providerPayment" 
                                       value="${financialData ? financialData.provider_payment : ''}" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Despesas</label>
                                <div>(R$) ${expense.toLocaleString('pt-BR')}</div>
                            </div>
                            ${financialData ? `
                            <div class="alert alert-info">
                                <strong>Lucro Calculado:</strong> R$ ${financialData.profit.toLocaleString('pt-BR')}
                            </div>
                            ` : ''}
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" id="saveFinancial">
                            <i class="bi bi-lock-fill"></i> Salvar e Fechar Registro
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Adicionar modal ao DOM
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHTML;
    document.body.appendChild(modalContainer);

    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('financialModal'));
    modal.show();

    // Event listener para salvar
    document.getElementById('saveFinancial').addEventListener('click', async () => {
        await saveFinancialData(recordId);
    });

    // Remover modal do DOM quando fechado
    document.getElementById('financialModal').addEventListener('hidden.bs.modal', function () {
        modalContainer.remove();
    });
}

// Função para salvar dados financeiros E fechar o registro
async function saveFinancialData(recordId) {
    const diligenceValue = parseFloat(document.getElementById('diligenceValue').value);
    const providerPayment = parseFloat(document.getElementById('providerPayment').value);

    // Validações
    if (!diligenceValue || diligenceValue <= 0) {
        showNotification('Valor da diligência deve ser maior que zero', 'error');
        return;
    }

    if (providerPayment < 0) {
        showNotification('Pagamento do prestador não pode ser negativo', 'error');
        return;
    }

    if (providerPayment > diligenceValue) {
        showNotification('Pagamento do prestador não pode ser maior que o valor da diligência', 'error');
        return;
    }

    showLoading();

    try {
        const token = localStorage.getItem('access_token');
        if (!token) {
            throw new Error('Token de autenticação não encontrado');
        }

        // Primeiro, salvar as informações financeiras
        const financialResponse = await fetch(`${apiBaseUrl}/records/${recordId}/financial`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                record_id: parseInt(recordId),
                diligence_value: diligenceValue,
                provider_payment: providerPayment
            })
        });

        // Verificar se a resposta é OK
        if (!financialResponse.ok) {
            let errorDetail = 'Erro ao salvar dados financeiros';
            try {
                const errorData = await financialResponse.json();
                errorDetail = errorData.detail || errorDetail;
            } catch (e) {
                errorDetail = `HTTP ${financialResponse.status} - ${financialResponse.statusText}`;
            }
            throw new Error(errorDetail);
        }

        // Depois de salvar as informações financeiras com sucesso, fechar o registro
        const closeResponse = await fetch(`${apiBaseUrl}/records/${recordId}/close`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        // Verificar se a resposta de fechamento é OK
        if (!closeResponse.ok) {
            let errorDetail = 'Erro ao fechar registro';
            try {
                const errorData = await closeResponse.json();
                errorDetail = errorData.detail || errorDetail;
            } catch (e) {
                errorDetail = `HTTP ${closeResponse.status} - ${closeResponse.statusText}`;
            }
            throw new Error(errorDetail);
        }

        // Fechar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('financialModal'));
        if (modal) {
            modal.hide();
        }

        showNotification('Informações financeiras salvas e registro fechado com sucesso!', 'success');

        // Recarregar dados para atualizar a interface
        setTimeout(() => {
            loadDataFromAPI();
        }, 1000);

    } catch (error) {
        console.error('Erro detalhado ao salvar dados financeiros:', error);
        
        let errorMessage = error.message;
        if (error.message.includes('Failed to fetch')) {
            errorMessage = 'Erro de conexão com o servidor. Verifique se a API está rodando.';
        } else if (error.message.includes('NetworkError')) {
            errorMessage = 'Erro de rede. Verifique sua conexão com a internet.';
        } else if (error.message.includes('401')) {
            errorMessage = 'Sessão expirada. Faça login novamente.';
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
        }

        showNotification(errorMessage, 'error');
    } finally {
        hideLoading();
    }
}

// Função para formatar data e hora
function formatDateTime(dateString) {
    if (!dateString) return '';

    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR');
}