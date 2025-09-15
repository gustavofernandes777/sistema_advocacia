// Variáveis globais
let currentRecord = null;
const apiBaseUrl = 'https://c1b8d2bcf4e1.ngrok-free.app';

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

// Template modificado para novos itens - CORRIGIDO
const costExpenseTemplate = (type, index, data = null) => {
    const title = data?.title || '';
    const value = data?.value || '';
    const isExisting = data !== null;
    let labelPlaceholder;

    if (type == 'cost'){
        labelPlaceholder = 'custa'
    } else{
        labelPlaceholder = 'despesa'
    }

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

// Carrega os dados do registro
async function loadRecordData(recordId) {
    try {
        const response = await fetch(`${apiBaseUrl}/records/${recordId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`
            }
        });

        if (!response.ok) throw new Error('Erro ao carregar registro');

        currentRecord = await response.json();

        // CORREÇÃO: Garante que sempre são arrays
        if (!currentRecord.costs || currentRecord.costs === null) {
            currentRecord.costs = [];
        }
        if (!currentRecord.expenses || currentRecord.expenses === null) {
            currentRecord.expenses = [];
        }

        console.log('Registro carregado (corrigido):', currentRecord);
        populateForm();
    } catch (error) {
        console.error('Erro ao carregar registro:', error);
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: error.message
        }).then(() => window.location.href = 'index.html');
    }
}

function setupRemoveGroupEvents() {
    document.querySelectorAll('.remove-cost-group').forEach(btn => {
        btn.addEventListener('click', function () {
            this.closest('.cost-expense-group').remove();
        });
    });

    document.querySelectorAll('.remove-expense-group').forEach(btn => {
        btn.addEventListener('click', function () {
            this.closest('.cost-expense-group').remove();
        });
    });
}

// Modifique a função populateForm
function populateForm() {
    // Limpa validações anteriores
    clearValidations();

    // Campos básicos
    document.getElementById('record-id').textContent = currentRecord.record_id;
    document.getElementById('edit-record-id').value = currentRecord.record_id;
    document.getElementById('edit-name').value = currentRecord.name;
    document.getElementById('edit-status').value = currentRecord.status;
    document.getElementById('edit-priority').value = currentRecord.priority;
    document.getElementById('edit-register-date').value = currentRecord.register_date;

    // Novos campos
    if (currentRecord.last_update) {
        const lastUpdate = new Date(currentRecord.last_update);
        document.getElementById('edit-last-update').value = lastUpdate.toLocaleString('pt-BR');
    }
    document.getElementById('edit-document-type').value = currentRecord.document_type || '';
    document.getElementById('edit-state').value = currentRecord.state.toLowerCase() || ''; //estado aqui
    document.getElementById('edit-city').value = currentRecord.city || '';
    document.getElementById('edit-researched-name').value = currentRecord.researchedName || '';
    document.getElementById('edit-researched-cpf-cnpj').value = currentRecord.researchedCpf_cnpj || '';
    document.getElementById('edit-info').value = currentRecord.info || '';

    // Cliente e Prestador
    const clientSelect = document.getElementById('edit-client-id');
    const providerSelect = document.getElementById('edit-provider-id');

    if (currentRecord.client && currentRecord.client.id) {
        clientSelect.value = currentRecord.client.id;
    }
    if (currentRecord.provider && currentRecord.provider.id) {
        providerSelect.value = currentRecord.provider.id;
    }

    // Controle de permissão para status "finalizada" - VERIFICA SE currentUser EXISTE
    const statusSelect = document.getElementById('edit-status');
    if (currentUser && currentUser.type !== 'admin') {
        // Remove a opção "finalizada" para não-admins
        setupProviderUI();
        const finalizadaOption = statusSelect.querySelector('option[value="finalizada"]');
        if (finalizadaOption) {
            finalizadaOption.disabled = true;
            finalizadaOption.title = 'Apenas administradores podem finalizar registros';
        }

        // Se o registro já está finalizado, desabilita o select
        if (currentRecord.status === 'finalizada') {
            statusSelect.disabled = true;
            statusSelect.title = 'Registro finalizado - apenas administradores podem modificar';
        }

        const providerSelect = document.getElementById('edit-provider-id');
        if (providerSelect) {
            providerSelect.disabled = true;
            providerSelect.title = 'Você é o prestador deste registro';

            // Seleciona automaticamente o próprio usuário como prestador
            providerSelect.value = currentUser.id;
        }
    }

    // Arquivo principal
    const mainFilePreview = document.getElementById('main-file-preview');
    if (currentRecord.file_url) {
        const filename = currentRecord.file_url.split('/').pop();
        mainFilePreview.innerHTML = `
            <a href="${apiBaseUrl}${currentRecord.file_url}" target="_blank">${filename}</a>
        `;
    }

    // Anexos
    const attachmentsContainer = document.getElementById('attachments-container');
    attachmentsContainer.innerHTML = '';
    if (currentRecord.attachments && currentRecord.attachments.length > 0) {
        currentRecord.attachments.forEach((attachment, index) => {
            attachmentsContainer.innerHTML += attachmentTemplate(index, attachment);
        });
    }

    // Custas e despesas
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

    // Configura event listeners após criar os elementos
    setTimeout(() => {
        setupEventListeners();
        console.log('Event listeners configurados');
    }, 100);
}

async function removeFile(fileUrl, type, id = null) {
    try {
        const response = await fetch(`${apiBaseUrl}/records/${currentRecord.id}/files`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`
            },
            body: JSON.stringify({
                file_url: fileUrl,
                type: type,
                id: id
            })
        });

        if (!response.ok) {
            throw new Error('Erro ao remover arquivo');
        }

        // Atualiza a interface
        if (type === 'main') {
            currentRecord.file_url = null;
            document.getElementById('main-file-preview').innerHTML = '';
        } else {
            // Atualiza o grupo específico
            const group = document.querySelector(`.cost-expense-group[data-id="${id}"]`);
            if (group) {
                group.querySelector('.file-preview').innerHTML = '';

                // Corrige a busca no array
                if (type === 'cost') {
                    const costIndex = currentRecord.costs.findIndex(c => c.id == id);
                    if (costIndex !== -1) {
                        currentRecord.costs[costIndex].file_url = null;
                    }
                } else {
                    const expenseIndex = currentRecord.expenses.findIndex(e => e.id == id);
                    if (expenseIndex !== -1) {
                        currentRecord.expenses[expenseIndex].file_url = null;
                    }
                }
            }
        }

        Swal.fire({
            icon: 'success',
            title: 'Sucesso!',
            text: 'Arquivo removido com sucesso'
        });
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: error.message
        });
    }
}

async function removeAttachment(attachmentTitle) {
    try {
        const response = await fetch(`${apiBaseUrl}/records/${currentRecord.id}/attachments/?attachment_title=${encodeURIComponent(attachmentTitle)}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Erro ao remover anexo');
        }

        return await response.json();
    } catch (error) {
        console.error('Erro ao remover anexo:', error);
        throw error;
    }
}

// Função para remover custa pelo título - CORRIGIDA
async function removeCost(costTitle) {
    try {
        console.log(`Removendo custa: ${costTitle}`);

        const response = await fetch(`${apiBaseUrl}/records/${currentRecord.id}/costs/?cost_title=${encodeURIComponent(costTitle)}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`
            }
        });

        console.log('Resposta da remoção:', response.status);

        if (!response.ok) {
            let errorDetail = 'Erro ao remover custa';
            try {
                const errorData = await response.json();
                errorDetail = errorData.detail || errorDetail;
            } catch (e) {
                errorDetail = `HTTP ${response.status} - ${response.statusText}`;
            }
            throw new Error(errorDetail);
        }

        return await response.json();
    } catch (error) {
        console.error('Erro ao remover custa:', error);
        throw error;
    }
}

// Função para remover despesa pelo título - CORRIGIDA
async function removeExpense(expenseTitle) {
    try {
        console.log(`Removendo despesa: ${expenseTitle}`);

        const response = await fetch(`${apiBaseUrl}/records/${currentRecord.id}/expenses/?expense_title=${encodeURIComponent(expenseTitle)}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`
            }
        });

        console.log('Resposta da remoção:', response.status);

        if (!response.ok) {
            let errorDetail = 'Erro ao remover despesa';
            try {
                const errorData = await response.json();
                errorDetail = errorData.detail || errorDetail;
            } catch (e) {
                errorDetail = `HTTP ${response.status} - ${response.statusText}`;
            }
            throw new Error(errorDetail);
        }

        return await response.json();
    } catch (error) {
        console.error('Erro ao remover despesa:', error);
        throw error;
    }
}

async function addNewAttachment(title, description, file) {
    try {
        const formData = new FormData();
        formData.append('title', title);
        formData.append('description', description || '');
        if (file) {
            formData.append('file', file);
        }

        const response = await fetch(`${apiBaseUrl}/records/${currentRecord.id}/attachments/`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`
            },
            body: formData
        });

        if (!response.ok) {
            throw new Error('Erro ao adicionar anexo');
        }

        return await response.json();
    } catch (error) {
        console.error('Erro ao adicionar anexo:', error);
        throw error;
    }
}

// Funções para adicionar novos itens
async function addNewCost(title, value, file) {
    try {
        const formData = new FormData();
        formData.append('title', title);
        formData.append('value', value);
        if (file) {
            formData.append('file', file);
        }

        const response = await fetch(`${apiBaseUrl}/records/${currentRecord.id}/costs/`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`
            },
            body: formData
        });

        if (!response.ok) {
            throw new Error('Erro ao adicionar custa');
        }

        return await response.json();
    } catch (error) {
        console.error('Erro ao adicionar custa:', error);
        throw error;
    }
}

async function addNewExpense(title, value, file) {
    try {
        const formData = new FormData();
        formData.append('title', title);
        formData.append('value', value);
        if (file) {
            formData.append('file', file);
        }

        const response = await fetch(`${apiBaseUrl}/records/${currentRecord.id}/expenses/`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`
            },
            body: formData
        });

        if (!response.ok) {
            throw new Error('Erro ao adicionar despesa');
        }

        return await response.json();
    } catch (error) {
        console.error('Erro ao adicionar despesa:', error);
        throw error;
    }
}

// Inicialização da página
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const recordId = urlParams.get('id');

    if (!recordId) {
        window.location.href = 'index.html';
        return;
    }

    try {
        // 1. Primeiro carrega o usuário atual
        await loadCurrentUser();

        // 2. Depois carrega tudo em paralelo
        await Promise.all([
            loadRecordData(recordId),
            loadClients(),
            loadProviders()
        ]);

        console.log('Página carregada completamente');
    } catch (error) {
        console.error('Erro ao carregar página:', error);
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: 'Não foi possível carregar a página de edição'
        }).then(() => {
            window.location.href = 'index.html';
        });
    }

    // Botão para adicionar Anexo
    document.getElementById('add-attachment-btn').addEventListener('click', () => {
        const attachmentsContainer = document.getElementById('attachments-container');
        const index = attachmentsContainer.querySelectorAll('.attachment-group').length;
        attachmentsContainer.innerHTML += attachmentTemplate(index);
    });

    // Botão para adicionar custa
    document.getElementById('add-cost-btn').addEventListener('click', () => {
        const costsContainer = document.getElementById('costs-container');
        const index = costsContainer.querySelectorAll('.cost-expense-group').length;

        // Adiciona novo grupo com inputs editáveis
        costsContainer.innerHTML += costExpenseTemplate('cost', index);

        console.log('Novo custa adicionado');
    });

    document.getElementById('add-expense-btn').addEventListener('click', () => {
        const expensesContainer = document.getElementById('expenses-container');
        const index = expensesContainer.querySelectorAll('.cost-expense-group').length;

        // Adiciona novo grupo com inputs editáveis
        expensesContainer.innerHTML += costExpenseTemplate('expense', index);

        console.log('Nova despesa adicionada');
    });

    // Botão cancelar
    document.getElementById('cancel-edit').addEventListener('click', () => {
        // Redireciona SEM enviar dados para o backend
        window.location.href = 'index.html';
    });


});

function handleFileUpload(input, type, groupId) {
    if (input.files.length > 0) {
        // Esconde o link do arquivo anterior
        const group = document.querySelector(`.cost-expense-group[data-id="${groupId}"]`);
        const preview = group.querySelector('.file-preview');
        preview.querySelector('a')?.style.setProperty('display', 'none');

        // Adiciona mensagem de arquivo novo
        const newFileMsg = document.createElement('div');
        newFileMsg.className = 'text-success';
        newFileMsg.innerHTML = '<i class="fas fa-check"></i> Novo arquivo selecionado';
        preview.appendChild(newFileMsg);
    }
}

function setupRemoveCompleteEvents() {
    // Remover custa completo
    document.querySelectorAll('.remove-cost-complete').forEach(btn => {
        btn.addEventListener('click', function () {
            const group = this.closest('.cost-expense-group');
            group.style.display = 'none';
            group.setAttribute('data-removed', 'true');
        });
    });

    // Remover despesa completa
    document.querySelectorAll('.remove-expense-complete').forEach(btn => {
        btn.addEventListener('click', function () {
            const group = this.closest('.cost-expense-group');
            group.style.display = 'none';
            group.setAttribute('data-removed', 'true');
        });
    });
}

// Função para salvar as alterações
async function saveBasicChanges() {
    const formData = new FormData();

    // Todos os campos do registro
    const recordData = {
        record_id: document.getElementById('edit-record-id').value,
        name: document.getElementById('edit-name').value,
        status: document.getElementById('edit-status').value,
        priority: document.getElementById('edit-priority').value,
        document_type: document.getElementById('edit-document-type').value,
        state: document.getElementById('edit-state').value, //estado aqui
        city: document.getElementById('edit-city').value,
        researchedName: document.getElementById('edit-researched-name').value,
        researchedCpf_cnpj: document.getElementById('edit-researched-cpf-cnpj').value,
        info: document.getElementById('edit-info').value,
        register_date: document.getElementById('edit-register-date').value,  // Nova linha
        client_id: document.getElementById('edit-client-id').value,
        provider_id: document.getElementById('edit-provider-id').value,
        original_costs: currentRecord.costs || [],
        original_expenses: currentRecord.expenses || []
    };

    // Adiciona todos os campos ao FormData
    formData.append('record_data', JSON.stringify(recordData));
    formData.append('name', recordData.name);
    formData.append('status', recordData.status);
    formData.append('priority', recordData.priority);
    formData.append('document_type', recordData.document_type);
    formData.append('state', recordData.state);
    formData.append('city', recordData.city);
    formData.append('researched_name', recordData.researchedName);
    formData.append('researched_cpf_cnpj', recordData.researchedCpf_cnpj);
    formData.append('info', recordData.info);
    formData.append('register_date', recordData.register_date);  // Nova linha
    formData.append('client_id', recordData.client_id);
    formData.append('provider_id', recordData.provider_id);

    try {
        const response = await fetch(`${apiBaseUrl}/records/${currentRecord.id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`
            },
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Erro ao atualizar registro');
        }

        return await response.json();
    } catch (error) {
        console.error('Erro ao salvar dados básicos:', error);
        throw error;
    }
}

async function loadClients() {
    try {
        const response = await fetch(`${apiBaseUrl}/clients/`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`
            }
        });

        if (!response.ok) throw new Error('Erro ao carregar clientes');

        const clients = await response.json();
        const clientSelect = document.getElementById('edit-client-id');

        clients.forEach(client => {
            const option = document.createElement('option');
            option.value = client.id;
            option.textContent = `${client.name} (${client.cpf_cnpj})`;
            clientSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Erro ao carregar clientes:', error);
    }
}

async function loadProviders() {
    try {
        const response = await fetch(`${apiBaseUrl}/users/`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`
            }
        });

        if (!response.ok) throw new Error('Erro ao carregar prestadores');

        const users = await response.json();
        const providerSelect = document.getElementById('edit-provider-id');

        // Limpa options existentes
        providerSelect.innerHTML = '<option value="">Selecione um prestador</option>';

        users.forEach(user => {
            if (user.type === 'provedor' || user.type === 'admin') {
                const option = document.createElement('option');
                option.value = user.id;
                option.textContent = `${user.name} ${user.last_name} (${user.type})`;
                providerSelect.appendChild(option);
            }
        });

        // DEFINE O VALOR APÓS CARREGAR AS OPÇÕES - CRÍTICO
        if (currentRecord.provider && currentRecord.provider.id) {
            providerSelect.value = currentRecord.provider.id;
        } else if (currentUser && currentUser.type !== 'admin') {
            // Para prestadores, define automaticamente
            providerSelect.value = currentUser.id;
        }

        console.log('Prestador selecionado:', providerSelect.value);
    } catch (error) {
        console.error('Erro ao carregar prestadores:', error);
    }
}

function validateAllFields() {
    const errors = [];
    const requiredFields = [
        { id: 'edit-record-id', name: 'ID do Registro' },  // Nova linha
        { id: 'edit-name', name: 'Nome do registro' },
        { id: 'edit-document-type', name: 'Tipo de Documento' },
        { id: 'edit-state', name: 'Estado' }, //estado aqui
        { id: 'edit-city', name: 'Cidade' },
        { id: 'edit-researched-name', name: 'Nome do Pesquisado' },
        { id: 'edit-researched-cpf-cnpj', name: 'CPF/CNPJ do Pesquisado' },
        { id: 'edit-register-date', name: 'Data de Registro' },  // Nova linha
        { id: 'edit-client-id', name: 'Cliente' },
        { id: 'edit-provider-id', name: 'Prestador' }
    ];

    requiredFields.forEach(field => {
        const element = document.getElementById(field.id);
        if (element && !element.value.trim()) {
            errors.push(`${field.name} é obrigatório`);

            // Destaca visualmente o campo com erro
            element.classList.add('is-invalid');
        } else if (element) {
            element.classList.remove('is-invalid');
        }
    });

    // Validação específica para record_id (não pode estar vazio)
    const recordIdField = document.getElementById('edit-record-id');
    if (recordIdField && !recordIdField.value.trim()) {
        errors.push('ID do Registro é obrigatório');
        recordIdField.classList.add('is-invalid');
    }

    // Validação específica para data de registro
    const registerDateField = document.getElementById('edit-register-date');
    if (registerDateField && !registerDateField.value) {
        errors.push('Data de Registro é obrigatória');
        registerDateField.classList.add('is-invalid');
    }

    // Validação específica para Estado (2 caracteres)
    const stateField = document.getElementById('edit-state'); //estado aqui
    if (stateField && stateField.value.trim() && stateField.value.trim().length !== 2) {
        errors.push('Estado deve ter exatamente 2 caracteres');
        stateField.classList.add('is-invalid');
    }

    // Validação específica para CPF/CNPJ
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
    // Remove classes de erro de todos os campos
    document.querySelectorAll('.is-invalid').forEach(element => {
        element.classList.remove('is-invalid');
    });

    // Esconde mensagens de erro
    document.querySelectorAll('.invalid-feedback').forEach(element => {
        element.style.display = 'none';
    });
}

// Função principal de salvamento

// Função para validar novos itens antes de salvar
function validateNewItems() {
    const errors = [];

    // Validar novos custas
    const newCostGroups = document.querySelectorAll('.cost-expense-group[data-type="cost"]:not([data-removed="true"])');
    newCostGroups.forEach((group, index) => {
        const titleInput = group.querySelector('.cost-title-input');
        const valueInput = group.querySelector('.cost-value-input');
        const existingTitle = group.getAttribute('data-title');

        if ((!existingTitle || existingTitle === '') && titleInput && valueInput) {
            if (!titleInput.value.trim()) {
                errors.push(`Custas ${index + 1}: Título é obrigatório`);
            }
            if (!valueInput.value.trim()) {
                errors.push(`Custas ${index + 1}: Valor é obrigatório`);
            }
        }
    });

    // Validar novas despesas
    const newExpenseGroups = document.querySelectorAll('.cost-expense-group[data-type="expense"]:not([data-removed="true"])');
    newExpenseGroups.forEach((group, index) => {
        const titleInput = group.querySelector('.expense-title-input');
        const valueInput = group.querySelector('.expense-value-input');
        const existingTitle = group.getAttribute('data-title');

        if ((!existingTitle || existingTitle === '') && titleInput && valueInput) {
            if (!titleInput.value.trim()) {
                errors.push(`Despesa ${index + 1}: Título é obrigatório`);
            }
            if (!valueInput.value.trim()) {
                errors.push(`Despesa ${index + 1}: Valor é obrigatório`);
            }
        }
    });

    return errors;
}

// Função para carregar o usuário atual
async function loadCurrentUser() {
    try {
        const token = localStorage.getItem('access_token');
        if (!token) {
            window.location.href = 'login.html';
            return;
        }

        const response = await fetch(`${apiBaseUrl}/users/me/`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Erro ao carregar usuário');
        }

        currentUser = await response.json();
        console.log('Usuário carregado:', currentUser);

        if (currentUser.type !== 'admin') {
            document.getElementById('adminLink').style.display = 'none';
            document.getElementById('reportsLink').style.display = 'none';
            document.getElementById('userListLink').style.display = 'none';
        }
    } catch (error) {
        console.error('Erro ao carregar usuário:', error);
        logout();
    }
}

function setupProviderUI() {
    if (currentUser && currentUser.type !== 'admin') {
        // Adiciona badge informativo
        const cardHeaders = document.querySelectorAll('.card-header');
        cardHeaders.forEach(header => {
            const badge = document.createElement('span');
            badge.className = 'badge bg-info ms-2';
            badge.textContent = 'Modo Prestador';
            badge.title = 'Você está editando como prestador - algumas opções estão limitadas';
            header.appendChild(badge);
        });

        // Mensagem informativa
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

        // Insere a mensagem no início do formulário
        const form = document.getElementById('editRecordForm');
        form.insertBefore(alertDiv, form.firstChild);
    }
}

async function saveAllChanges() {
    try {
        console.log('Iniciando salvamento completo...');
        if (currentUser && currentUser.type !== 'admin') {
            // Prestadores não podem alterar o prestador do registro
            const providerSelect = document.getElementById('edit-provider-id');
            if (providerSelect.value != currentUser.id) {
                throw new Error('Você só pode ser atribuído como prestador dos seus próprios registros');
            }

            // Prestadores não podem finalizar registros
            const statusSelect = document.getElementById('edit-status');
            if (statusSelect.value === 'finalizada') {
                throw new Error('Apenas administradores podem finalizar registros');
            }
        }

        // Limpa validações anteriores
        clearValidations();

        // VALIDAÇÃO: Chama a função de validação
        const validationErrors = validateAllFields();
        if (validationErrors.length > 0) {
            throw new Error(`Erros de validação:\n${validationErrors.join('\n')}`);
        }

        // 1. Salva dados básicos
        console.log('Salvando dados básicos...');
        const result = await saveBasicChanges();
        console.log('Dados básicos salvos:', result);

        // 2. Processa NOVAS custas e despesas
        console.log('Processando novos itens...');
        await processNewItems();

        // 3. Remove custas/despesas marcados para remoção
        console.log('Removendo itens marcados...');
        await removeMarkedItems();

        console.log('Salvamento completo realizado com sucesso!');

        Swal.fire({
            icon: 'success',
            title: 'Sucesso!',
            text: 'Registro atualizado com sucesso'
        }).then(() => {
            window.location.href = 'index.html';
        });
    } catch (error) {
        console.error('Erro no salvamento completo:', error);

        // Mostra erros de validação de forma mais amigável
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

// Processa novos itens adicionados
async function processNewItems() {
    try {
        // Novos anexos
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
                    console.log('Adicionando novo anexo:', title);
                    const result = await addNewAttachment(title, description, file);
                    console.log('Anexo adicionado:', result);
                }
            }
        }

        // Novos custas
        const newCostGroups = document.querySelectorAll('.cost-expense-group[data-type="cost"]:not([data-removed="true"])');

        for (const group of newCostGroups) {
            const titleInput = group.querySelector('.cost-title-input');
            const valueInput = group.querySelector('.cost-value-input');
            const fileInput = group.querySelector('.cost-file-input');

            // Verifica se é um novo item (sem título definido no data-title)
            const existingTitle = group.getAttribute('data-title');
            if ((!existingTitle || existingTitle === '') && titleInput && valueInput) {
                const title = titleInput.value.trim();
                const value = valueInput.value.trim();
                const file = fileInput?.files[0];

                if (title && value) {
                    console.log('Adicionando novo custa:', title, value);
                    const result = await addNewCost(title, value, file);
                    console.log('Custa adicionado:', result);
                }
            }
        }

        // Novas despesas
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
                    console.log('Adicionando nova despesa:', title, value);
                    const result = await addNewExpense(title, value, file);
                    console.log('Despesa adicionada:', result);
                }
            }
        }
    } catch (error) {
        console.error('Erro ao processar novos itens:', error);
        throw error;
    }
}

// Remove itens marcados
async function removeMarkedItems() {
    const removedGroups = document.querySelectorAll('.cost-expense-group[data-removed="true"]');
    console.log('Itens para remover:', removedGroups.length);

    for (const group of removedGroups) {
        const title = group.getAttribute('data-title');
        const type = group.getAttribute('data-type');

        // Só remove itens existentes (que têm título)
        if (title && title !== '') {
            console.log(`Processando remoção: ${type} "${title}"`);

            try {
                if (type === 'cost') {
                    await removeCost(title);
                    console.log(`Custa "${title}" removido`);
                } else if (type === 'expense') {
                    await removeExpense(title);
                    console.log(`Despesa "${title}" removida`);
                } else if (type === 'attachment') {
                    await removeAttachment(title);
                    console.log(`Anexo "${title}" removido`);
                }
            } catch (error) {
                console.error(`Erro ao remover ${type} "${title}":`, error);
            }
        } else {
            console.log(`Item novo ${type} - apenas removendo visualmente`);
        }
    }
}

// Configuração de eventos - CORRIGIDA
function setupEventListeners() {
    console.log('Configurando event listeners...');

    // Remove event listeners antigos para evitar duplicação
    const oldSaveButton = document.getElementById('save-edit');
    if (oldSaveButton) {
        oldSaveButton.replaceWith(oldSaveButton.cloneNode(true));
    }

    // Evento para o botão salvar - CORRIGIDO
    const saveButton = document.getElementById('save-edit');
    if (saveButton) {
        saveButton.addEventListener('click', async (e) => {
            e.preventDefault();
            console.log('Botão salvar clicado - evento funcionando!');
            await saveAllChanges();
        });
    }

    // Evento para o formulário - CORRIGIDO
    const form = document.getElementById('editRecordForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('Formulário submetido - evento funcionando!');
            await saveAllChanges();
        });
    }

    // Evento para remover itens - CORRIGIDO (delegation)
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

            console.log('Botão remover clicado:', type, title);

            Swal.fire({
                title: 'Confirmar remoção?',
                text: `Deseja remover ${type === 'cost' ? 'a custa' : type === 'expense' ? 'a despesa' : 'o anexo'} "${title}"?`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Sim, remover!',
                cancelButtonText: 'Cancelar'
            }).then((result) => {
                if (result.isConfirmed) {
                    // Encontra o grupo pai usando a classe correta
                    const group = button.closest('.cost-expense-group');
                    if (group) {
                        group.style.display = 'none';
                        group.setAttribute('data-removed', 'true');

                        // Feedback imediato
                        button.disabled = true;
                        button.innerHTML = '<i class="fas fa-check"></i> Será removido';
                        button.classList.remove('btn-danger');
                        button.classList.add('btn-secondary');

                        Swal.fire('Marcado para remoção!', 'O item será removido quando você salvar as alterações.', 'success');
                    } else {
                        console.error('Grupo não encontrado para remoção');
                        Swal.fire('Erro', 'Não foi possível encontrar o item para remover.', 'error');
                    }
                }
            });
        }


        if (e.target.closest('.remove-item')) {
            e.preventDefault();
            const button = e.target.closest('.remove-item');
            const type = button.getAttribute('data-type');
            const title = button.getAttribute('data-title');

            console.log('Botão remover clicado:', type, title);

            // Verificação de segurança - garante que o grupo existe
            const group = button.closest('.cost-expense-group');
            if (!group) {
                console.error('Grupo não encontrado para remoção');
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

                    // Feedback imediato
                    button.disabled = true;
                    button.innerHTML = '<i class="fas fa-check"></i> Será removido';
                    button.classList.remove('btn-danger');
                    button.classList.add('btn-secondary');

                    Swal.fire('Marcado para remoção!', 'O item será removido quando você salvar as alterações.', 'success');
                }
            });
        }
    });


    console.log('Event listeners configurados com sucesso');
}

// Função de debug para testar as rotas - CORRIGIDA
async function testRemoveFunctions() {
    console.log('=== TESTANDO FUNÇÕES DE REMOÇÃO ===');

    if (currentRecord.costs && currentRecord.costs.length > 0) {
        const testCost = currentRecord.costs[0];
        console.log('Testando remoção de custa:', testCost.title);

        try {
            const result = await removeCost(testCost.title);
            console.log('Teste de custa bem-sucedido:', result);
        } catch (error) {
            console.error('Teste de custa falhou:', error.message);
        }
    } else {
        console.log('Nenhum custa para testar');
    }

    if (currentRecord.expenses && currentRecord.expenses.length > 0) {
        const testExpense = currentRecord.expenses[0];
        console.log('Testando remoção de despesa:', testExpense.title);

        try {
            const result = await removeExpense(testExpense.title);
            console.log('Teste de despesa bem-sucedido:', result);
        } catch (error) {
            console.error('Teste de despesa falhou:', error.message);
        }
    } else {
        console.log('Nenhuma despesa para testar');
    }
}

// Chame testRemoveFunctions() no console para testar

// Função para debug da estrutura dos dados
function debugDataStructure() {
    console.log('=== ESTRUTURA DOS DADOS ===');
    console.log('Current Record:', currentRecord);

    if (currentRecord.costs && currentRecord.costs.length > 0) {
        console.log('Primeiro custa:', currentRecord.costs[0]);
        console.log('Tipo do ID do custa:', typeof currentRecord.costs[0].id);
        console.log('ID do primeiro custa:', currentRecord.costs[0].id);
    } else {
        console.log('Nenhum custa encontrado');
    }

    if (currentRecord.expenses && currentRecord.expenses.length > 0) {
        console.log('Primeira despesa:', currentRecord.expenses[0]);
        console.log('Tipo do ID da despesa:', typeof currentRecord.expenses[0].id);
        console.log('ID da primeira despesa:', currentRecord.expenses[0].id);
    } else {
        console.log('Nenhuma despesa encontrada');
    }
}

// Chame debugDataStructure() no console

function debugEventListeners() {
    console.log('=== DEBUG EVENT LISTENERS ===');

    // Verifica se os botões existem
    const saveButton = document.getElementById('save-edit');
    const removeButtons = document.querySelectorAll('.remove-item');

    console.log('Botão salvar encontrado:', !!saveButton);
    console.log('Botões remover encontrados:', removeButtons.length);

    // Verifica se os event listeners estão configurados
    if (saveButton) {
        const clickEvents = getEventListeners(saveButton).click;
        console.log('Event listeners no botão salvar:', clickEvents ? clickEvents.length : 0);
    }
}

// Teste manual dos event listeners
function testEventListeners() {
    console.log('=== TESTANDO EVENT LISTENERS ===');

    // Simula clique no botão salvar
    const saveButton = document.getElementById('save-edit');
    if (saveButton) {
        console.log('Testando botão salvar...');
        saveButton.click();
    } else {
        console.log('Botão salvar não encontrado');
    }

    // Simula clique em um botão remover
    const removeButton = document.querySelector('.remove-item');
    if (removeButton) {
        console.log('Testando botão remover...');
        removeButton.click();
    } else {
        console.log('Botão remover não encontrado');
    }
}

// Debug para verificar novos itens
function debugNewItems() {
    console.log('=== NOVOS ITENS ===');

    const newCostInputs = document.querySelectorAll('.cost-title-input, .cost-value-input');
    const newExpenseInputs = document.querySelectorAll('.expense-title-input, .expense-value-input');

    console.log('Inputs de novos custas:', newCostInputs.length);
    console.log('Inputs de novas despesas:', newExpenseInputs.length);

    newCostInputs.forEach(input => {
        console.log('Input custas:', input.className, input.value);
    });

    newExpenseInputs.forEach(input => {
        console.log('Input despesa:', input.className, input.value);
    });
}

// Função de logout
function logout() {
    localStorage.removeItem('access_token');
    window.location.href = 'login.html';
}