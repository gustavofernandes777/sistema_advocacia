// Variáveis globais
import { postMessageToSlack } from './postToSlack.js'
import { CONFIG } from "./config.js";
let currentRecord = null;
let currentUser = null;
const apiBaseUrl = CONFIG.API_URL;

// FUNÇÕES DE AUTENTICAÇÃO E API FETCH DO DASHBOARD.JS
function getTokenInfo() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));

    const token = localStorage.getItem('access_token')
               || localStorage.getItem('token')
               || localStorage.getItem('auth_token')
               || null;

    const tokenType = localStorage.getItem('token_type') || 'Bearer';
    return { token, tokenType };
}

async function checkAuth() {
    const { token, tokenType } = getTokenInfo();

    if (!token) {
        console.warn('❌ Nenhum token no localStorage — redirecionando');
        window.location.href = 'login.html';
        return false;
    }

    try {
        const authHeader = `Bearer ${token}`;
        const resp = await fetch(`${apiBaseUrl}/users/me/`, {
            method: 'GET',
            mode: 'cors',
            cache: 'no-store',
            credentials: 'omit',
            headers: {
                'Authorization': authHeader,
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'Ngrok-Skip-Browser-Warning': 'true',
                'User-Agent': 'MyApp/1.0'
            }
        });

        const text = await resp.text();
        if (text.includes('ngrok') || text.includes('<!DOCTYPE')) {
            console.error('❌ Ngrok interceptando a requisição');
            throw new Error('Ngrok bloqueando acesso');
        }

        try {
            const data = JSON.parse(text);
            
            if (!resp.ok) {
                throw new Error(data.detail || `Erro HTTP ${resp.status}`);
            }

            currentUser = data;
            return true;
            
        } catch (jsonError) {
            console.error('❌ Falha ao parsear JSON:', jsonError);
            throw new Error('Resposta inválida do servidor');
        }
        
    } catch (err) {
        console.error('❌ Erro na autenticação:', err.message);
        
        localStorage.removeItem('access_token');
        localStorage.removeItem('token');
        localStorage.removeItem('token_type');
        
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1000);
        
        return false;
    }
}

async function apiFetch(url, options = {}) {
    const { token, tokenType } = getTokenInfo();
    const authHeader = `Bearer ${token}`;

    const defaultHeaders = {
        'Authorization': authHeader,
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'Ngrok-Skip-Browser-Warning': 'true',
        'User-Agent': 'MyApp/1.0'
    };

    if (!(options.body instanceof FormData)) {
        defaultHeaders['Content-Type'] = 'application/json';
    }

    const mergedHeaders = { ...defaultHeaders, ...options.headers };

    try {
        const resp = await fetch(url, {
            ...options,
            mode: 'cors',
            credentials: 'omit',
            headers: mergedHeaders
        });

        const contentType = resp.headers.get('content-type') || '';
        const text = await resp.text();

        if (text.includes('ngrok') || text.includes('<!DOCTYPE')) {
            throw new Error('Ngrok bloqueando acesso - página HTML recebida');
        }

        if (!contentType.includes('application/json')) {
            throw new Error(`Content-Type inesperado: ${contentType}`);
        }

        const data = JSON.parse(text);

        if (!resp.ok) {
            throw new Error(data.detail || `HTTP Error ${resp.status}`);
        }

        return data;

    } catch (error) {
        console.error('❌ apiFetch error:', error);
        throw error;
    }
}

// FUNÇÕES ORIGINAIS DO EDIT_RECORD.JS (mantidas)
const attachmentTemplate = (index, data = null) => {
    const title = data?.title || '';
    const description = data?.description || '';
    const isExisting = data !== null;

    return `
    <div class="cost-expense-group mb-4 p-3 border rounded" data-title="${title}" data-type="attachment">
        <div class="row mb-3">
            <div class="col-md-4">
                <label class="form-label">Título</label>
                ${isExisting ?
            `<div class="form-control-plaintext">${title}</div>` :
            `<input type="text" class="form-control attachment-title-input" placeholder="Título do anexo" required>`
        }
            </div>
            <div class="col-md-4">
                <label class="form-label">Descrição</label>
                ${isExisting ?
            `<div class="form-control-plaintext">${description}</div>` :
            `<input type="text" class="form-control attachment-description-input" placeholder="Descrição (opcional)">`
        }
            </div>
            <div class="col-md-4 d-flex align-items-end">
                <button type="button" class="btn btn-danger btn-sm remove-item" 
                        data-type="attachment" data-title="${title}">
                    <i class="fas fa-trash"></i> Remover
                </button>
            </div>
        </div>
        
        ${isExisting ? `
            <div class="file-preview mb-3">
                ${data?.file_url ? `
                    <div class="mb-2">
                        <strong>Arquivo:</strong>
                        <a href="${apiBaseUrl}${data.file_url}" target="_blank" class="ms-2">Visualizar</a>
                    </div>
                ` : '<span class="text-muted">Sem arquivo</span>'}
            </div>
        ` : `
            <div class="mb-3">
                <label class="form-label">Adicionar Arquivo</label>
                <input type="file" class="form-control attachment-file-input" required>
            </div>
        `}
        
        ${!isExisting ? '<div class="text-info"><small><i class="fas fa-info-circle"></i> Novo anexo - preencha os dados</small></div>' : ''}
    </div>`;
};

const costExpenseTemplate = (type, index, data = null) => {
    const title = data?.title || '';
    const value = data?.value || '';
    const isExisting = data !== null;
    const labelPlaceholder = type === 'cost' ? 'custa' : 'despesa';

    return `
    <div class="cost-expense-group mb-4 p-3 border rounded" data-title="${title}" data-type="${type}">
        <div class="row mb-3">
            <div class="col-md-4">
                <label class="form-label">Título</label>
                ${isExisting ?
            `<div class="form-control-plaintext">${title}</div>` :
            `<input type="text" class="form-control ${type}-title-input" placeholder="Título da ${labelPlaceholder}" required>`
        }
            </div>
            <div class="col-md-4">
                <label class="form-label">Valor</label>
                ${isExisting ?
            `<div class="form-control-plaintext">${value}</div>` :
            `<input type="text" class="form-control ${type}-value-input" placeholder="Valor" required>`
        }
            </div>
            <div class="col-md-4 d-flex align-items-end">
                <button type="button" class="btn btn-danger btn-sm remove-item" 
                        data-type="${type}" data-title="${title}">
                    <i class="fas fa-trash"></i> Remover
                </button>
            </div>
        </div>
        
        ${isExisting ? `
            <div class="file-preview mb-3">
                ${data?.file_url ? `
                    <div class="mb-2">
                        <strong>Arquivo:</strong>
                        <a href="${apiBaseUrl}${data.file_url}" target="_blank" class="ms-2">Visualizar</a>
                    </div>
                ` : '<span class="text-muted">Sem arquivo</span>'}
            </div>
        ` : `
            <div class="mb-3">
                <label class="form-label">Adicionar Arquivo</label>
                <input type="file" class="form-control ${type}-file-input" required>
            </div>
        `}
        
        ${!isExisting ? '<div class="text-info"><small><i class="fas fa-info-circle"></i> Novo item - preencha os dados</small></div>' : ''}
    </div>`;
};

async function loadRecordData(recordId) {
    try {
        const response = await apiFetch(`${apiBaseUrl}/records/${recordId}`);
        currentRecord = response;

        if (!currentRecord.costs || currentRecord.costs === null) {
            currentRecord.costs = [];
        }
        if (!currentRecord.expenses || currentRecord.expenses === null) {
            currentRecord.expenses = [];
        }

        populateForm();
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: error.message
        }).then(() => window.location.href = 'index.html');
    }
}

function populateForm() {
    clearValidations();

    document.getElementById('record-id').textContent = currentRecord.record_id;
    document.getElementById('edit-record-id').value = currentRecord.record_id;
    document.getElementById('edit-agency').value = currentRecord.agency;
    document.getElementById('edit-status').value = currentRecord.status;
    document.getElementById('edit-priority').value = currentRecord.priority;
    document.getElementById('edit-register-date').value = currentRecord.register_date;
    // Novos campos
    if (currentRecord.last_update) {
        const lastUpdate = new Date(currentRecord.last_update);
        document.getElementById('edit-last-update').value = lastUpdate.toLocaleString('pt-BR');
    }
    document.getElementById('edit-document-type').value = currentRecord.document_type || '';
    document.getElementById('edit-state').value = currentRecord.state.toLowerCase() || '';
    document.getElementById('edit-city').value = currentRecord.city || '';
    document.getElementById('edit-researched-name').value = currentRecord.researchedName || '';
    document.getElementById('edit-researched-cpf-cnpj').value = currentRecord.researchedCpf_cnpj || '';
    document.getElementById('edit-info').value = currentRecord.info || '';

    const clientSelect = document.getElementById('edit-client-id');
    const providerSelect = document.getElementById('edit-provider-id');

    if (currentRecord.client && currentRecord.client.id) {
        clientSelect.value = currentRecord.client.id;
    }
    if (currentRecord.provider && currentRecord.provider.id) {
        providerSelect.value = currentRecord.provider.id;
    }

    const statusSelect = document.getElementById('edit-status');
    if (currentUser && currentUser.type !== 'admin') {
        setupProviderUI();
        const finalizadaOption = statusSelect.querySelector('option[value="finalizada"]');
        if (finalizadaOption) {
            finalizadaOption.disabled = true;
            finalizadaOption.title = 'Apenas administradores podem finalizar registros';
        }

        if (currentRecord.status === 'finalizada') {
            statusSelect.disabled = true;
            statusSelect.title = 'Registro finalizado - apenas administradores podem modificar';
        }

        if (providerSelect) {
            providerSelect.disabled = true;
            providerSelect.title = 'Você é o prestador deste registro';
            providerSelect.value = currentUser.id;
        }
    }

    const mainFilePreview = document.getElementById('main-file-preview');
    if (currentRecord.file_url) {
        const filename = currentRecord.file_url.split('/').pop();
        mainFilePreview.innerHTML = `
            <a href="${apiBaseUrl}${currentRecord.file_url}" target="_blank">${filename}</a>
        `;
    }

    const attachmentsContainer = document.getElementById('attachments-container');
    attachmentsContainer.innerHTML = '';
    if (currentRecord.attachments && currentRecord.attachments.length > 0) {
        currentRecord.attachments.forEach((attachment, index) => {
            attachmentsContainer.innerHTML += attachmentTemplate(index, attachment);
        });
    }

    const costsContainer = document.getElementById('costs-container');
    costsContainer.innerHTML = '';
    if (currentRecord.costs && currentRecord.costs.length > 0) {
        currentRecord.costs.forEach((cost, index) => {
            costsContainer.innerHTML += costExpenseTemplate('cost', index, cost);
        });
    }

    const expensesContainer = document.getElementById('expenses-container');
    expensesContainer.innerHTML = '';
    if (currentRecord.expenses && currentRecord.expenses.length > 0) {
        currentRecord.expenses.forEach((expense, index) => {
            expensesContainer.innerHTML += costExpenseTemplate('expense', index, expense);
        });
    }

    setTimeout(() => {
        setupEventListeners();
    }, 100);
}

async function removeItem(type, title) {
    try {
        const endpoint = type === 'cost' ? 'costs' : type === 'expense' ? 'expenses' : 'attachments';
        const paramName = type === 'cost' ? 'cost_title' : type === 'expense' ? 'expense_title' : 'attachment_title';
        
        const response = await apiFetch(`${apiBaseUrl}/records/${currentRecord.id}/${endpoint}/?${paramName}=${encodeURIComponent(title)}`, {
            method: 'DELETE'
        });

        return response;
    } catch (error) {
        throw error;
    }
}

async function addNewItem(type, title, value, file, description = '') {
    try {
        const formData = new FormData();
        formData.append('title', title);
        
        if (type !== 'attachment') {
            formData.append('value', value);
        } else {
            formData.append('description', description);
        }
        
        if (file) {
            formData.append('file', file);
        }

        const endpoint = type === 'cost' ? 'costs' : type === 'expense' ? 'expenses' : 'attachments';
        
        const response = await apiFetch(`${apiBaseUrl}/records/${currentRecord.id}/${endpoint}/`, {
            method: 'POST',
            body: formData
        });

        return response;
    } catch (error) {
        throw error;
    }
}

async function saveBasicChanges() {
    const formData = new FormData();

    const recordData = {
        record_id: document.getElementById('edit-record-id').value,
        agency: document.getElementById('edit-agency').value,
        status: document.getElementById('edit-status').value,
        priority: document.getElementById('edit-priority').value,
        document_type: document.getElementById('edit-document-type').value,
        state: document.getElementById('edit-state').value,
        city: document.getElementById('edit-city').value,
        researchedName: document.getElementById('edit-researched-name').value,
        researchedCpf_cnpj: document.getElementById('edit-researched-cpf-cnpj').value,
        info: document.getElementById('edit-info').value,
        register_date: document.getElementById('edit-register-date').value,
        client_id: document.getElementById('edit-client-id').value,
        provider_id: document.getElementById('edit-provider-id').value,
        original_costs: currentRecord.costs || [],
        original_expenses: currentRecord.expenses || []
    };

    formData.append('record_data', JSON.stringify(recordData));
    Object.keys(recordData).forEach(key => {
        if (key !== 'original_costs' && key !== 'original_expenses') {
            formData.append(key, recordData[key]);
        }
    });

    try {
        const response = await apiFetch(`${apiBaseUrl}/records/${currentRecord.id}`, {
            method: 'PUT',
            body: formData
        });

        return response;
    } catch (error) {
        throw error;
    }
}

async function loadClients() {
    try {
        const response = await apiFetch(`${apiBaseUrl}/clients/`);
        const clients = response;
        const clientSelect = document.getElementById('edit-client-id');

        clients.forEach(client => {
            const option = document.createElement('option');
            option.value = client.id;
            option.textContent = `${client.name} (${client.cpf_cnpj})`;
            clientSelect.appendChild(option);
        });

        if (currentRecord.client && currentRecord.client.id) {
            clientSelect.value = currentRecord.client.id;
        } 
        
    } catch (error) {
        console.error('Erro ao carregar clientes:', error);
    }
}

async function loadProviders() {
    try {
        const response = await apiFetch(`${apiBaseUrl}/users/`);
        const users = response;
        const providerSelect = document.getElementById('edit-provider-id');

        providerSelect.innerHTML = '<option value="">Selecione um prestador</option>';

        users.forEach(user => {
            if (user.type === 'provedor' || user.type === 'admin') {
                const option = document.createElement('option');
                option.value = user.id;
                option.textContent = `${user.name} ${user.last_name} (${user.type})`;
                providerSelect.appendChild(option);
            }
        });

        if (currentRecord.provider && currentRecord.provider.id) {
            providerSelect.value = currentRecord.provider.id;
        } else if (currentUser && currentUser.type !== 'admin') {
            providerSelect.value = currentUser.id;
        }
    } catch (error) {
        console.error('Erro ao carregar prestadores:', error);
    }
}

function validateAllFields() {
    const errors = [];
    const requiredFields = [
        { id: 'edit-record-id', name: 'ID da deligência' },
        { id: 'edit-document-type', name: 'Tipo de Documento' },
        { id: 'edit-agency', name: 'Órgão da deligência' },
        { id: 'edit-state', name: 'Estado' },
        { id: 'edit-city', name: 'Cidade' },
        { id: 'edit-researched-name', name: 'Nome do Pesquisado' },
        { id: 'edit-researched-cpf-cnpj', name: 'CPF/CNPJ do Pesquisado' },
        { id: 'edit-register-date', name: 'Data de Registro' },
        { id: 'edit-client-id', name: 'Cliente' },
        { id: 'edit-provider-id', name: 'Prestador' }
    ];

    requiredFields.forEach(field => {
        const element = document.getElementById(field.id);
        if (element && !element.value.trim()) {
            errors.push(`${field.name} é obrigatório`);
            element.classList.add('is-invalid');
        } else if (element) {
            element.classList.remove('is-invalid');
        }
    });

    const recordIdField = document.getElementById('edit-record-id');
    if (recordIdField && !recordIdField.value.trim()) {
        errors.push('ID do Registro é obrigatório');
        recordIdField.classList.add('is-invalid');
    }

    const registerDateField = document.getElementById('edit-register-date');
    if (registerDateField && !registerDateField.value) {
        errors.push('Data de Registro é obrigatória');
        registerDateField.classList.add('is-invalid');
    }

    const stateField = document.getElementById('edit-state');
    if (stateField && stateField.value.trim() && stateField.value.trim().length !== 2) {
        errors.push('Estado deve ter exatamente 2 caracteres');
        stateField.classList.add('is-invalid');
    }

    const cpfCnpjField = document.getElementById('edit-researched-cpf-cnpj');
    if (cpfCnpjField && cpfCnpjField.value.trim()) {
        const value = cpfCnpjField.value.trim();
        if (value.length < 11 || value.length > 20) {
            errors.push('CPF/CNPJ deve ter entre 11 e 20 caracteres');
            cpfCnpjField.classList.add('is-invalid');
        }
    }

    return errors;
}

function clearValidations() {
    document.querySelectorAll('.is-invalid').forEach(element => {
        element.classList.remove('is-invalid');
    });
}

async function loadCurrentUser() {
    try {
        if (currentUser.type !== 'admin') {
            document.getElementById('reportsLink').style.display = 'none';
            document.getElementById('userListLink').style.display = 'none';
        }
    } catch (error) {
        logout();
    }
}

function setupProviderUI() {
    if (currentUser && currentUser.type !== 'admin') {
        const cardHeaders = document.querySelectorAll('.card-header');
        cardHeaders.forEach(header => {
            const badge = document.createElement('span');
            badge.className = 'badge bg-info ms-2';
            badge.textContent = 'Modo Prestador';
            badge.title = 'Você está editando como prestador - algumas opções estão limitadas';
            header.appendChild(badge);
        });

        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-info';
        alertDiv.innerHTML = `
            <strong><i class="fas fa-info-circle"></i> Modo Prestador</strong>
            <p>Você está editando este registro como prestador. Algumas funcionalidades estão limitadas:</p>
            <ul>
                <li>Você é automaticamente definido como prestador do registro</li>
                <li>Não pode finalizar registros</li>
                <li>Só pode editar registros atribuídos a você</li>
                <li>Registros finalizados são somente leitura</li>
            </ul>
        `;

        const form = document.getElementById('editRecordForm');
        form.insertBefore(alertDiv, form.firstChild);
    }
}

async function saveAllChanges() {
    try {
        const statusSelect = document.getElementById('edit-status');
        const hasCostsDiv = document.getElementById('hasCostsDiv');
        const hasExpensesDiv = document.getElementById('hasExpensesDiv');
        const hasCosts = document.getElementById('hasCosts');
        const hasExpenses = document.getElementById('hasExpenses');

        const parentCost= document.getElementById('costs-container');
        const costChildrenCount = parentCost.children.length;
        const parentExpense= document.getElementById('expenses-container');
        const expenseChildrenCount = parentExpense.children.length;

        if (statusSelect.value === 'entregue' && hasCostsDiv && hasCosts.checked && costChildrenCount == 0 ) {
            throw new Error('Ao marcar a opção "Tem custas?", é obrigatório adicionar as custas mudar a diligências para "Entregue".');
        }

        if (statusSelect.value === 'entregue' && hasExpensesDiv && hasExpenses.checked && expenseChildrenCount == 0) {
            throw new Error('Ao marcar a opção "Tem despesas?", é obrigatório adicionar as despesas para mudar a diligências para "Entregue".');
        }

        if (currentUser && currentUser.type !== 'admin') {
            const providerSelect = document.getElementById('edit-provider-id');
            if (providerSelect.value != currentUser.id) {
                throw new Error('Você só pode ser atribuído como prestador dos seus próprios registros');
            }

            const statusSelect = document.getElementById('edit-status');

            if (statusSelect.value === 'finalizada') {
                throw new Error('Apenas administradores podem finalizar registros');
            }
        }

        clearValidations();

        const validationErrors = validateAllFields();
        if (validationErrors.length > 0) {
            throw new Error(`Erros de validação:\n${validationErrors.join('\n')}`);
        }

        await saveBasicChanges();
        await processNewItems();
        await removeMarkedItems();

        const record_id = document.getElementById('edit-record-id').value;
        const providerSelect = document.getElementById('edit-researched-name').value;
        const citySelect = document.getElementById('edit-city').value;
        const stateSelect = document.getElementById('edit-state').value;

        await postMessageToSlack('notificacao', `:pencil2: *Uma diligência foi editada*: ID: ${record_id}, Editor: *${currentUser.name}*`);
        if (statusSelect.value === 'entregue'){
            await postMessageToSlack('financeiro', `:check_box_with_check: *Uma diligência foi entregue*: ID: ${record_id}, Prestador: *${providerSelect}*, Cidade: ${citySelect}/${stateSelect}.`);
        }

        Swal.fire({
            icon: 'success',
            title: 'Sucesso!',
            text: 'Registro atualizado com sucesso'
        }).then(() => {
            window.location.href = 'index.html';
            
        });
    } catch (error) {
        if (error.message.includes('Erros de validação')) {
            Swal.fire({
                icon: 'warning',
                title: 'Campos obrigatórios',
                html: error.message.replace(/\n/g, '<br>'),
                confirmButtonText: 'Corrigir'
            });
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: error.message || 'Erro ao salvar alterações'
            });
        }
    }
}

async function processNewItems() {
    const newAttachmentGroups = document.querySelectorAll('.cost-expense-group[data-type="attachment"]:not([data-removed="true"])');
    for (const group of newAttachmentGroups) {
        const titleInput = group.querySelector('.attachment-title-input');
        const descriptionInput = group.querySelector('.attachment-description-input');
        const fileInput = group.querySelector('.attachment-file-input');

        const existingTitle = group.getAttribute('data-title');
        if ((!existingTitle || existingTitle === '') && titleInput) {
            const title = titleInput.value.trim();
            const description = descriptionInput?.value.trim() || '';
            const file = fileInput?.files[0];

            if (title && file) {
                await addNewItem('attachment', title, null, file, description);
            }
        }
    }

    const newCostGroups = document.querySelectorAll('.cost-expense-group[data-type="cost"]:not([data-removed="true"])');
    for (const group of newCostGroups) {
        const titleInput = group.querySelector('.cost-title-input');
        const valueInput = group.querySelector('.cost-value-input');
        const fileInput = group.querySelector('.cost-file-input');

        const existingTitle = group.getAttribute('data-title');
        if ((!existingTitle || existingTitle === '') && titleInput && valueInput) {
            const title = titleInput.value.trim();
            const value = valueInput.value.trim();
            const file = fileInput?.files[0];

            if (title && value) {
                await addNewItem('cost', title, value, file);
            }
        }
    }

    const newExpenseGroups = document.querySelectorAll('.cost-expense-group[data-type="expense"]:not([data-removed="true"])');
    for (const group of newExpenseGroups) {
        const titleInput = group.querySelector('.expense-title-input');
        const valueInput = group.querySelector('.expense-value-input');
        const fileInput = group.querySelector('.expense-file-input');

        const existingTitle = group.getAttribute('data-title');
        if ((!existingTitle || existingTitle === '') && titleInput && valueInput) {
            const title = titleInput.value.trim();
            const value = valueInput.value.trim();
            const file = fileInput?.files[0];

            if (title && value) {
                await addNewItem('expense', title, value, file);
            }
        }
    }
}

async function removeMarkedItems() {
    const removedGroups = document.querySelectorAll('.cost-expense-group[data-removed="true"]');

    for (const group of removedGroups) {
        const title = group.getAttribute('data-title');
        const type = group.getAttribute('data-type');

        if (title && title !== '') {
            try {
                await removeItem(type, title);
            } catch (error) {
                console.error(`Erro ao remover ${type} "${title}":`, error);
            }
        }
    }
}

function setupEventListeners() {
    const saveButton = document.getElementById('save-edit');
    if (saveButton) {
        saveButton.addEventListener('click', async (e) => {
            e.preventDefault();
            await saveAllChanges();
        });
    }

    const form = document.getElementById('editRecordForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveAllChanges();
        });
    }

    document.addEventListener('click', function (e) {
        if (e.target.tagName === 'A' && e.target.getAttribute('href') === '#') {
            e.preventDefault();
        }
        if (e.target.tagName === 'BUTTON' && !e.target.type) {
            e.preventDefault();
        }

        if (e.target.closest('.remove-item')) {
            e.preventDefault();
            const button = e.target.closest('.remove-item');
            const type = button.getAttribute('data-type');
            const title = button.getAttribute('data-title');

            const group = button.closest('.cost-expense-group');
            if (!group) {
                Swal.fire('Erro', 'Não foi possível encontrar o item para remover.', 'error');
                return;
            }

            Swal.fire({
                title: 'Confirmar remoção?',
                text: `Deseja remover ${type === 'cost' ? 'a custa' : type === 'expense' ? 'a despesa' : 'o anexo'} "${title}"?`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Sim, remover!',
                cancelButtonText: 'Cancelar'
            }).then((result) => {
                if (result.isConfirmed) {
                    group.style.display = 'none';
                    group.setAttribute('data-removed', 'true');

                    button.disabled = true;
                    button.innerHTML = '<i class="fas fa-check"></i> Será removido';
                    button.classList.remove('btn-danger');
                    button.classList.add('btn-secondary');

                    Swal.fire('Marcado para remoção!', 'O item será removido quando você salvar as alterações.', 'success');
                }
            });
        }
    });
}

async function checkStatus() {
    let status = document.getElementById('edit-status').value;

    if (status === 'entregue') {
        document.getElementById('hasCostsDiv').style.display = 'block';
        document.getElementById('hasExpensesDiv').style.display = 'block';
    } else {
        document.getElementById('hasCostsDiv').style.display = 'none';
        document.getElementById('hasExpensesDiv').style.display = 'none';
    }
}
    
function logout() {
    localStorage.removeItem('access_token');
    window.location.href = 'login.html';
}

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const recordId = urlParams.get('id');

    if (!recordId) {
        window.location.href = 'index.html';
        return;
    }

    try {
        await checkAuth();
        await loadCurrentUser();
        await Promise.all([
            loadRecordData(recordId),
            loadClients(),
            loadProviders()
        ]);
        await checkStatus()
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: 'Não foi possível carregar a página de edição'
        }).then(() => {
            window.location.href = 'index.html';
        });
    }

    document.getElementById('edit-status').addEventListener('change', async () => {
        checkStatus()
    });
    
    document.getElementById('add-attachment-btn').addEventListener('click', () => {
        const attachmentsContainer = document.getElementById('attachments-container');
        const index = attachmentsContainer.querySelectorAll('.attachment-group').length;
        attachmentsContainer.innerHTML += attachmentTemplate(index);
    });

    document.getElementById('add-cost-btn').addEventListener('click', () => {
        const costsContainer = document.getElementById('costs-container');
        const index = costsContainer.querySelectorAll('.cost-expense-group').length;
        costsContainer.innerHTML += costExpenseTemplate('cost', index);
    });

    document.getElementById('add-expense-btn').addEventListener('click', () => {
        const expensesContainer = document.getElementById('expenses-container');
        const index = expensesContainer.querySelectorAll('.cost-expense-group').length;
        expensesContainer.innerHTML += costExpenseTemplate('expense', index);
    });

    document.getElementById('cancel-edit').addEventListener('click', () => {
        window.location.href = 'index.html';
    });
});