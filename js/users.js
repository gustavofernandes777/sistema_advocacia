const apiBaseUrl = 'https://c58879383f23.ngrok-free.app';
let currentUser = null;

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

        loadUserData();
        loadUsersList();

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

function loadUserData() {
    if (!currentUser) return;

    document.getElementById('navbar-username').textContent = currentUser.name;
    document.getElementById('sidenav-username').textContent = `${currentUser.name} (${currentUser.type})`;
}

async function loadUsersList() {
    const loadingElement = document.getElementById('loading-users');
    const tableBody = document.getElementById('users-body');

    try {
        loadingElement.style.display = 'flex';
        tableBody.innerHTML = '';

        const token = localStorage.getItem('access_token');
        const response = await safeFetch(`${apiBaseUrl}/users/`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response) {
            throw new Error('Erro ao carregar usuários');
        }

        const users = response;
        renderUsers(users);

    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: error.message
        });
    } finally {
        loadingElement.style.display = 'none';
    }
}

function renderUsers(users) {
    const tableBody = document.getElementById('users-body');
    tableBody.innerHTML = '';

    users.forEach(user => {
        if (user.id !== currentUser.id) {


            const row = document.createElement('tr');

            row.innerHTML = `
            <td>${user.id}</td>
            <td>${user.name} ${user.last_name}</td>
            <td>${user.email}</td>
            <td><span class="badge ${user.type === 'admin' ? 'bg-danger' : 'bg-info'}">${user.type}</span></td>
            <td>${new Date(user.birthday).toLocaleDateString('pt-BR')}</td>
            <td>
                <button class="btn btn-sm btn-warning reset-password-btn" data-id="${user.id}" data-name="${user.name}">
                    <i class="fas fa-key"></i> Restaurar Senha
                </button>
            </td>
        `;

            tableBody.appendChild(row);
        }
    });

    // Adicionar event listeners aos botões
    document.querySelectorAll('.reset-password-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const userId = this.getAttribute('data-id');
            const userName = this.getAttribute('data-name');
            resetPassword(userId, userName);
        });
    });
}

async function resetPassword(userId, userName) {
    Swal.fire({
        title: 'Restaurar Senha',
        text: `Deseja restaurar a senha de ${userName} para "12345678"?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sim, restaurar!',
        cancelButtonText: 'Cancelar'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                const token = localStorage.getItem('access_token');
                const response = await safeFetch(`${apiBaseUrl}/users/${userId}/reset-password`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        new_password: '12345678'
                    })
                });

                if (!response) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || 'Erro ao restaurar senha');
                }

                Swal.fire({
                    icon: 'success',
                    title: 'Sucesso!',
                    text: `Senha de ${userName} restaurada para "12345678"`
                });

            } catch (error) {
                Swal.fire({
                    icon: 'error',
                    title: 'Erro',
                    text: error.message
                });
            }
        }
    });
}

function logout() {
    localStorage.removeItem('access_token');
    window.location.href = 'login.html';
}

// Event Listeners
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    document.querySelector('.logout-btn').addEventListener('click', logout);
});