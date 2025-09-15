// Variáveis globais
let currentUser = null;
let clientsData = [];
let recordsData = [];
let dataTable;
const apiBaseUrl = 'http://localhost:8000';

// Verifica autenticação
async function checkAuth() {
    const token = localStorage.getItem('access_token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    try {
        const response = await fetch(`${apiBaseUrl}/users/me/`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Não autorizado');
        }

        currentUser = await response.json();
    } catch (error) {
        logout();
    }
}

// Carrega dados do usuário
async function loadUserData() {
    if (!currentUser) return;

    document.getElementById('navbar-username').textContent = currentUser.name;
    document.getElementById('sidenav-username').textContent = `${currentUser.name} (${currentUser.type})`;

    // Controle de visibilidade baseado no tipo de usuário
    // const isAdmin = currentUser.type === 'admin';

    // Elementos que só admin pode ver
    //document.getElementById('newUserBtn').style.display = isAdmin ? 'block' : 'none';

    // Esconde funcionalidades de admin se necessário
    if (currentUser.type !== 'admin') {
        document.getElementById('adminLink').style.display = 'none';
        document.getElementById('newUserBtn').style.display = 'none';
        document.getElementById('addRecordBtn').style.display = 'none';
        document.getElementById('newRecordBtn').style.display = 'none';
        document.getElementById('reportsLink').style.display = 'none';
        document.getElementById('userListLink').style.display = 'none';

    }
}

// Função de logout
function logout() {
    localStorage.removeItem('access_token');
    window.location.href = 'login.html';
}

// Função para criar usuário
async function createUser() {
    const userData = {
        name: document.getElementById('user_name').value,
        last_name: document.getElementById('user_last_name').value,
        email: document.getElementById('user_email').value,
        password: document.getElementById('user_password').value,
        password_confirmation: document.getElementById('user_password_confirm').value,
        type: document.getElementById('user_type').value,
        birthday: document.getElementById('user_birthday').value
    };

    // Validação básica no frontend
    if (userData.password !== userData.password_confirmation) {
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: 'As senhas não coincidem'
        });
        return;
    }

    try {
        const response = await fetch(`${apiBaseUrl}/users/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`
            },
            body: JSON.stringify(userData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Erro ao criar usuário');
        }

        const result = await response.json();

        Swal.fire({
            icon: 'success',
            title: 'Sucesso!',
            text: 'Usuário criado com sucesso'
        });

        // Fecha o modal
        bootstrap.Modal.getInstance(document.getElementById('userModal')).hide();

    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: error.message
        });
    }
}

function openUserModal() {
    const modal = new bootstrap.Modal(document.getElementById('userModal'));
    document.getElementById('userForm').reset();
    modal.show();
}

// Função para carregar clientes
async function loadClients() {
    try {
        const response = await fetch(`${apiBaseUrl}/clients/`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`
            }
        });

        if (!response.ok) throw new Error('Erro ao carregar clientes');

        clientsData = await response.json();
        updateClientSelect();
    } catch (error) {
        showError(error);
    }
}

// Função para criar cliente
async function createClient() {
    const clientData = {
        name: document.getElementById('client_name').value,
        cpf_cnpj: document.getElementById('client_cpf_cnpj').value
    };

    try {
        const response = await fetch(`${apiBaseUrl}/clients/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`
            },
            body: JSON.stringify(clientData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Erro ao criar cliente');
        }

        const result = await response.json();

        Swal.fire({
            icon: 'success',
            title: 'Sucesso!',
            text: 'Cliente criado com sucesso'
        });

        // Atualiza a lista de clientes
        await loadClients();
        // Fecha o modal
        bootstrap.Modal.getInstance(document.getElementById('clientModal')).hide();

    } catch (error) {
        showError(error);
    }
}

// Carrega Registros da API
async function loadRecords() {
    const loadingElement = document.getElementById('loading-records');
    const tableBody = document.getElementById('records-body');

    try {
        loadingElement.style.display = 'flex';
        tableBody.innerHTML = '';

        const response = await fetch(`${apiBaseUrl}/records/`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Erro ao carregar registros');
        }

        recordsData = await response.json();

        // Filtra os registros no frontend também para consistência
        if (currentUser && currentUser.type !== 'admin') {
            recordsData = recordsData.filter(record =>
                record.provider?.id === currentUser.id
            );
        }

        renderRecords(recordsData);
        updateStatusCounts();

    } catch (error) {
        showError(error);
    } finally {
        loadingElement.style.display = 'none';
    }
}
// Renderiza registros na tabela (corrigido)
function renderRecords(records) {
    const tableBody = document.getElementById('records-body');
    if (!tableBody) {
        console.error('Elemento records-body não encontrado');
        return;
    }

    tableBody.innerHTML = '';

    records.forEach(record => {
        const row = document.createElement('tr');

        // Mapeia status para classes CSS
        const statusClass = `badge-${record.status}`

        // Mapeia prioridade para ícones
        const priorityIcon = {
            'baixa': 'fa-arrow-down',
            'media': 'fa-equals',
            'alta': 'fa-arrow-up'
        }[record.priority] || '';

        const capitalized =
            record.status.charAt(0).toUpperCase()
            + record.status.slice(1)

        row.innerHTML = `
<td>${record.record_id}</td>
    <td><span class="badge ${statusClass}">${capitalized}</span></td>
    <td>${record.provider?.name || 'N/A'}</td>
    <td><i class="fas ${priorityIcon}"></i> ${record.priority}</td>
    <td>${record.document_type}</td>
    <td>${record.client.name}</td>
    <td>${record.researchedName}</td>
    <td>${new Date(record.register_date).toLocaleDateString('pt-BR')}</td>
    <td>${record.last_update ? new Date(record.last_update).toLocaleString('pt-BR') : 'N/A'}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary view-btn" data-id="${record.id}">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-warning edit-btn" data-id="${record.id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        ${currentUser?.type === 'admin' ? `
                        <button class="btn btn-sm btn-outline-danger delete-btn" data-id="${record.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                        ` : ''}
                    </td>
                `;
        tableBody.appendChild(row);
    });
}

// Inicializa DataTable
function initDataTable() {
    dataTable = new simpleDatatables.DataTable("#recordsTable", {
        perPage: 10,
        labels: {
            placeholder: "Pesquisar...",
            perPage: "{select} registros por página",
            noRows: "Nenhum registro encontrado",
            info: "Mostrando {start} a {end} de {rows} registros",
        }
    });
}

// Carrega prestadores para o select
async function loadProviders() {
    try {
        const response = await fetch(`${apiBaseUrl}/users/`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`
            }
        });

        if (!response.ok) throw new Error('Erro ao carregar prestadores');

        const users = await response.json();
        const providerSelect = document.getElementById('provider_id');

        users.forEach(user => {
            if (user.type === 'provedor' || user.type === 'admin') {
                const option = document.createElement('option');
                option.value = user.id;
                option.textContent = `${user.name} (${user.type})`;
                providerSelect.appendChild(option);
            }
        });
    } catch (error) {
        console.error('Erro ao carregar prestadores:', error);
    }
}

// Carrega clientes para o select
async function loadClients() {
    try {
        const response = await fetch(`${apiBaseUrl}/clients/`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`
            }
        });

        if (!response.ok) throw new Error('Erro ao carregar clientes');

        clientsData = await response.json();
        updateClientSelect();
    } catch (error) {
        showError(error);
    }
}

// Atualiza o select de clientes
function updateClientSelect() {
    const select = document.getElementById('client_id');
    select.innerHTML = '<option value="">Selecione um cliente</option>';

    clientsData.forEach(client => {
        const option = document.createElement('option');
        option.value = client.id;
        option.textContent = `${client.name} (${client.cpf_cnpj})`;
        select.appendChild(option);
    });
}

// Atualiza contadores de status
function updateStatusCounts() {
    const counts = {
        'ativa': 0,
        'suspensa': 0,
        'entregue': 0,
        'finalizada': 0
    };

    recordsData.forEach(record => {
        counts[record.status]++;
    });

    document.getElementById('active-count').textContent = counts['ativa'];
    document.getElementById('suspended-count').textContent = counts['suspensa'];
    document.getElementById('delivered-count').textContent = counts['entregue'];
    document.getElementById('completed-count').textContent = counts['finalizada'];
}

// Filtra registros por status
function filterRecords(status) {
    const filtered = recordsData.filter(record => record.status === status);
    renderRecords(filtered);

    // Atualiza o título da tabela
    document.querySelector('.card-header i.fa-table').parentElement.textContent =
        `Registros - ${status.charAt(0).toUpperCase() + status.slice(1)}`;
}

// Inicialização quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await checkAuth();
        await loadUserData();
        await loadProviders();
        await loadClients();
        await loadRecords();
        setupEventListeners();
    } catch (error) {
        showError(error);
    }
});

// Configura event listeners
function setupEventListeners() {
    document.getElementById('record_id').addEventListener('blur', async function () {
        const recordId = this.value.trim();
        if (recordId) {
            // Verifica se o record_id já existe
            const exists = recordsData.some(record => record.record_id === recordId);
            if (exists) {
                this.classList.add('is-invalid');
                document.getElementById('record-id-feedback').textContent = 'Este ID já está em uso';
            } else {
                this.classList.remove('is-invalid');
            }
        }
    });
    // Botão de logout
    document.querySelector('.logout-btn').addEventListener('click', logout);

    // Botão de novo registro
    document.getElementById('addRecordBtn').addEventListener('click', () => {
        const modal = new bootstrap.Modal(document.getElementById('recordModal'));
        document.getElementById('recordForm').reset();
        modal.show();
    });

    document.getElementById('newRecordBtn').addEventListener('click', () => {
        const modal = new bootstrap.Modal(document.getElementById('recordModal'));
        document.getElementById('recordForm').reset();
        modal.show();
    });

    document.getElementById('newUserBtn')?.addEventListener('click', openUserModal);

    document.querySelectorAll('#addClientBtn, #newClientBtn').forEach(element => {
        element.addEventListener('click', () => {
            const modal = new bootstrap.Modal(document.getElementById('clientModal'));
            document.getElementById('clientForm').reset();
            modal.show();
        });
    });


    document.getElementById('saveClientBtn')?.addEventListener('click', createClient);

    // Botão de salvar registro
    document.getElementById('saveRecordBtn').addEventListener('click', async () => {
        const formData = new FormData();

        // Dados básicos do registro
        const recordData = {
            record_id: document.getElementById('record_id').value,
            name: document.getElementById('name').value,
            researchedName: document.getElementById('researchedName').value,
            document_type: document.getElementById('document_type').value,
            state: document.getElementById('state').value,
            city: document.getElementById('city').value,
            researchedCpf_cnpj: document.getElementById('researchedCpf_cnpj').value,
            info: document.getElementById('info').value,
            status: document.getElementById('status').value,
            priority: document.getElementById('priority').value
        };

        formData.append('record_data', JSON.stringify(recordData));
        formData.append('provider_id', document.getElementById('provider_id').value);
        formData.append('client_id', document.getElementById('client_id').value);
        formData.append('register_date', document.getElementById('register_date').value);  // Nova linha

        // Anexos
        const attachmentGroups = document.querySelectorAll('.attachment-group');
        attachmentGroups.forEach(group => {
            formData.append('attachment_titles', group.querySelector('.attachment-title').value);
            formData.append('attachment_descriptions', group.querySelector('.attachment-description').value || '');
            const file = group.querySelector('.attachment-file').files[0];
            if (file) {
                formData.append('attachment_files', file);
            }
        });

        // Custas
        const costGroups = document.querySelectorAll('.cost-group');
        costGroups.forEach(group => {
            formData.append('cost_titles', group.querySelector('.cost-title').value);
            formData.append('cost_values', group.querySelector('.cost-value').value);
            const file = group.querySelector('.cost-file').files[0];
            if (file) {
                formData.append('cost_files', file);
            }
        });

        // Despesas
        const expenseGroups = document.querySelectorAll('.expense-group');
        expenseGroups.forEach(group => {
            formData.append('expense_titles', group.querySelector('.expense-title').value);
            formData.append('expense_values', group.querySelector('.expense-value').value);
            const file = group.querySelector('.expense-file').files[0];
            if (file) {
                formData.append('expense_files', file);
            }
        });

        try {
            const response = await fetch(`${apiBaseUrl}/records/`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                },
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Erro ao criar registro');
            }

            const newRecord = await response.json();
            console.log('Registro criado:', newRecord); // Para depuração

            Swal.fire({
                icon: 'success',
                title: 'Sucesso!',
                text: 'Registro criado com sucesso'
            });

            bootstrap.Modal.getInstance(document.getElementById('recordModal')).hide();
            await loadRecords();
        } catch (error) {
            console.error('Erro detalhado:', error);
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: error.message
            });
        }
    });

    // Delegation para botões de ação na tabela
    document.getElementById('records-body').addEventListener('click', async (e) => {
        const recordId = e.target.closest('button')?.dataset?.id;
        if (!recordId) return;

        const record = recordsData.find(r => r.id == recordId);
        if (!record) return;

        if (e.target.closest('.view-btn')) {
            let fileLink = '';

            // Mostrar anexos
            if (record.attachments && Array.isArray(record.attachments)) {
                fileLink += `<p><strong>Anexos:</strong></p><ul>`;
                record.attachments.forEach(attachment => {
                    if (attachment && attachment.file_url) {
                        const decodedUrl = decodeURIComponent(attachment.file_url);
                        const filename = decodedUrl.split('/').pop();
                        fileLink += `<li>${attachment.title || 'Sem título'} - ${attachment.description || 'Sem descrição'} 
                                <a href="${apiBaseUrl}${attachment.file_url}" target="_blank" download="${filename}">(Download)</a></li>`;
                    }
                });
                fileLink += `</ul>`;
            }

            // Mostrar custas - verifica se existe e se é array
            if (record.costs && Array.isArray(record.costs)) {
                fileLink += `<p><strong>Custas:</strong></p><ul>`;
                record.costs.forEach(cost => {
                    if (cost && cost.file_url) {
                        console.log("cost: ", cost)
                        // Decodificar a URL para mostrar corretamente
                        const decodedUrl = decodeURIComponent(cost.file_url);
                        // Extrair o nome do arquivo para exibição
                        const filename = decodedUrl.split('/').pop();
                        fileLink += `<li>${cost.title || 'Sem título'} - R$ ${cost.value || 'N/A'} 
                <a href="${apiBaseUrl}${cost.file_url}" target="_blank" download="${filename}">(Comprovante)</a></li>`;
                    }
                });
                fileLink += `</ul>`;
            }

            // Mostrar despesas - verifica se existe e se é array
            if (record.expenses && Array.isArray(record.expenses)) {
                fileLink += `<p><strong>Despesas:</strong></p><ul>`;
                record.expenses.forEach(expense => {
                    if (expense && expense.file_url) {  // Verificação adicional
                        fileLink += `<li>${expense.title || 'Sem título'} - R$ ${expense.value || 'N/A'} 
                <a href="${apiBaseUrl}${expense.file_url}" target="_blank">(Comprovante)</a></li>`;
                    }
                });
                fileLink += `</ul>`;
            } else {
                console.log('Despesas não encontradas ou não é array:', record.expenses);
            }

            showRecordModal(record);
        }
        else if (e.target.closest('.edit-btn')) {
            const recordId = e.target.closest('button').dataset.id;
            window.location.href = `edit_record.html?id=${recordId}`;
        }
        else if (e.target.closest('.delete-btn') && currentUser.type === 'admin') {
            const record = recordsData.find(r => r.id == recordId);
            let message = `Deseja realmente excluir o registro ${record.record_id}?`;

            // Adiciona aviso sobre arquivos que serão deletados
            if (record.file_url || record.cost?.file_url || record.expense?.file_url) {
                message += "\n\nEsta ação também excluirá permanentemente:";
                if (record.file_url) message += "\n- Arquivo principal do registro";
                if (record.cost?.file_url) message += `\n- Arquivo de custa: ${record.cost.title}`;
                if (record.expense?.file_url) message += `\n- Arquivo de despesa: ${record.expense.title}`;
            }

            const result = await Swal.fire({
                title: 'Confirmar exclusão completa?',
                text: message,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Sim, excluir tudo!',
                cancelButtonText: 'Cancelar'
            });

            if (result.isConfirmed) {
                try {
                    const response = await fetch(`${apiBaseUrl}/records/${record.id}`, {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                        }
                    });

                    if (!response.ok) throw new Error('Erro ao excluir registro');

                    Swal.fire({
                        icon: 'success',
                        title: 'Excluído!',
                        text: 'registro e todos os arquivos associados foram removidos'
                    });

                    await loadRecords();
                } catch (error) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Erro',
                        text: error.message
                    });
                }
            }
        }
    });

    document.getElementById('saveUserBtn')?.addEventListener('click', createUser);
}

// Função para mostrar erro detalhado
// Modifique a função showError para:
function showError(error) {
    console.error('Erro completo:', error);

    let errorMessage = error.message;
    if (error.response) {
        try {
            error.response.json().then(data => {
                errorMessage += `<br><br>Detalhes: ${JSON.stringify(data.detail || data)}`;
                Swal.fire({
                    icon: 'error',
                    title: 'Erro',
                    html: errorMessage,
                    confirmButtonText: 'OK'
                });
            }).catch(() => {
                Swal.fire({
                    icon: 'error',
                    title: 'Erro',
                    text: errorMessage,
                    confirmButtonText: 'OK'
                });
            });
        } catch (e) {
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: errorMessage,
                confirmButtonText: 'OK'
            });
        }
    } else {
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: errorMessage,
            confirmButtonText: 'OK'
        });
    }
}

document.getElementById('toggleAttachment').addEventListener('change', function () {
    const container = document.getElementById('attachmentsContainer');
    container.style.display = this.checked ? 'block' : 'none';
    if (!this.checked) {
        container.querySelectorAll('.attachment-group').forEach((group, index) => {
            if (index > 0) group.remove();
        });
    }
});

document.getElementById('toggleCost').addEventListener('change', function () {
    const container = document.getElementById('costsContainer');
    container.style.display = this.checked ? 'block' : 'none';
    if (!this.checked) {
        container.querySelectorAll('.cost-group').forEach((group, index) => {
            if (index > 0) group.remove();
        });
    }
});

document.getElementById('toggleExpense').addEventListener('change', function () {
    const container = document.getElementById('expensesContainer');
    container.style.display = this.checked ? 'block' : 'none';
    if (!this.checked) {
        container.querySelectorAll('.expense-group').forEach((group, index) => {
            if (index > 0) group.remove();
        });
    }
});

document.getElementById('addAttachmentBtn').addEventListener('click', function () {
    const container = document.getElementById('attachmentsContainer');
    const firstGroup = container.querySelector('.attachment-group');
    const newGroup = firstGroup.cloneNode(true);

    // Limpar valores
    newGroup.querySelector('.attachment-title').value = '';
    newGroup.querySelector('.attachment-description').value = '';
    newGroup.querySelector('.attachment-file').value = '';

    // Mostrar botão de remover
    newGroup.querySelector('.remove-attachment').style.display = 'block';

    // Adicionar evento de remoção
    newGroup.querySelector('.remove-attachment').addEventListener('click', function () {
        newGroup.remove();
    });

    container.insertBefore(newGroup, this);
});

document.getElementById('addCostBtn').addEventListener('click', function () {
    const container = document.getElementById('costsContainer');
    const firstGroup = container.querySelector('.cost-group');
    const newGroup = firstGroup.cloneNode(true);

    // Limpar valores
    newGroup.querySelector('.cost-title').value = '';
    newGroup.querySelector('.cost-value').value = '';
    newGroup.querySelector('.cost-file').value = '';

    // Mostrar botão de remover
    newGroup.querySelector('.remove-cost').style.display = 'block';

    // Adicionar evento de remoção
    newGroup.querySelector('.remove-cost').addEventListener('click', function () {
        newGroup.remove();
    });

    container.insertBefore(newGroup, this);
});

document.getElementById('addExpenseBtn').addEventListener('click', function () {
    const container = document.getElementById('expensesContainer');
    const firstGroup = container.querySelector('.expense-group');
    const newGroup = firstGroup.cloneNode(true);

    // Limpar valores
    newGroup.querySelector('.expense-title').value = '';
    newGroup.querySelector('.expense-value').value = '';
    newGroup.querySelector('.expense-file').value = '';

    // Mostrar botão de remover
    newGroup.querySelector('.remove-expense').style.display = 'block';

    // Adicionar evento de remoção
    newGroup.querySelector('.remove-expense').addEventListener('click', function () {
        newGroup.remove();
    });

    container.insertBefore(newGroup, this);
});

function showRecordModal(record) {
    // fallback para getStatusText (caso não exista no dashboard)
    const statusText = (typeof getStatusText === 'function')
        ? getStatusText(record.status)
        : ({ 'ativa': 'Ativa', 'suspensa': 'Suspensa', 'entregue': 'Entregue', 'finalizada': 'Finalizada' }[record.status] || record.status);

    // Construir o HTML do modal (sem bloco financeiro)
    const modalHTML = `
        <div class="modal fade" id="recordDetailsModal" tabindex="-1">
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
                                <p><strong>Nome:</strong> ${record.name || ''}</p>
                                <p><strong>Status:</strong> <span class="badge badge-${record.status}">${statusText}</span></p>
                                <p><strong>Prioridade:</strong> ${record.priority || ''}</p>
                                <p><strong>Tipo Documento:</strong> ${record.document_type || ''}</p>
                            </div>
                            <div class="col-md-6">
                                <h6>Localização</h6>
                                <p><strong>Cidade/Estado:</strong> ${record.city || ''}/${(record.state || '').toUpperCase()}</p>
                                <p><strong>Pesquisado:</strong> ${record.researchedName || ''}</p>
                                <p><strong>CPF/CNPJ:</strong> ${record.researchedCpf_cnpj || ''}</p>
                            </div>
                        </div>
                        
                        <div class="row mt-3">
                            <div class="col-12">
                                <h6>Informações Adicionais</h6>
                                <p>${record.info || 'Nenhuma informação adicional'}</p>
                            </div>
                        </div>

                        <div class="row mt-3">
                            <div class="col-md-12">
                                <h6>Responsáveis</h6>
                                <p><strong>Cliente:</strong> ${record.client.name}</p>
                                <p><strong>Prestador:</strong> ${record.provider.name}</p>
                                <p><strong>Data Registro:</strong> ${record.register_date}</p>
                                ${record.last_update ? `<p><strong>Última Atualização:</strong> ${new Date(record.last_update).toLocaleString('pt-BR')}</p>` : ''}
                            </div>

                        <div class="row mt-6">
                            <div class="col-12">
                                ${(record.costs && record.costs.length > 0) || (record.expenses && record.expenses.length > 0) ? `
                                    <h6>Custas e Despesas</h6>
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
                                                        <td>${cost.title || ''}</td>
                                                        <td>R$ ${parseFloat(cost.value || 0).toLocaleString('pt-BR')}</td>
                                                        <td>${cost.file_url ? `<a href="${apiBaseUrl}${cost.file_url}" target="_blank">Ver</a>` : 'Nenhum'}</td>
                                                    </tr>
                                                `).join('') : ''}
                                                ${record.expenses ? record.expenses.map(expense => `
                                                    <tr>
                                                        <td><span class="badge bg-warning text-dark">Despesa</span></td>
                                                        <td>${expense.title || ''}</td>
                                                        <td>R$ ${parseFloat(expense.value || 0).toLocaleString('pt-BR')}</td>
                                                        <td>${expense.file_url ? `<a href="${apiBaseUrl}${expense.file_url}" target="_blank">Ver</a>` : 'Nenhum'}</td>
                                                    </tr>
                                                `).join('') : ''}
                                            </tbody>
                                        </table>
                                    </div>
                                ` : '<p class="text-muted">Nenhuma custas ou despesa registrada</p>'}
                            </div>
                        </div>

                        ${record.attachments && record.attachments.length > 0 ? `
                        <div class="row mt-4">
                            <div class="col-12">
                                <h6>Anexos</h6>
                                <div class="d-flex flex-wrap gap-2">
                                    ${record.attachments.map(att => `
                                        <div class="card" style="width:200px;">
                                            <div class="card-body">
                                                <h6 class="card-title">${att.title || 'Sem título'}</h6>
                                                <p class="card-text">${att.description || 'Sem descrição'}</p>
                                                ${att.file_url ? `<a href="${apiBaseUrl}${att.file_url}" target="_blank" class="btn btn-sm btn-primary"><i class="bi bi-download"></i> Baixar</a>` : ''}
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
                    </div>
                </div>
            </div>
        </div>
    `;

    // Adiciona ao DOM e exibe (removerá o modal quando fechado)
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHTML;
    document.body.appendChild(modalContainer);

    const modalEl = document.getElementById('recordDetailsModal');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    modalEl.addEventListener('hidden.bs.modal', function () {
        setTimeout(() => {
            if (modalContainer.parentNode) modalContainer.remove();
        }, 300);
    });
}