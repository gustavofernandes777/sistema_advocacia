import { CONFIG } from "./config.js";
const apiBaseUrl = CONFIG.API_URL;
let currentUser = null;

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

    // Não adicionar Content-Type para FormData
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

        // Verificar se é página do ngrok
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

async function checkAuth() {
    const { token, tokenType } = getTokenInfo();

    if (!token) {
        console.warn('❌ Nenhum token no localStorage — redirecionando');
        window.location.href = 'login.html';
        return false;
    }

    try {
        const authHeader = `Bearer ${token}`;

        // Headers específicos para evitar a página do ngrok
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

        // Verificar se é a página do ngrok
        if (text.includes('ngrok') || text.includes('<!DOCTYPE')) {
            console.error('❌ Ngrok interceptando a requisição');
            throw new Error('Ngrok bloqueando acesso');
        }

        // Tentar parsear como JSON
        try {
            const data = JSON.parse(text);
            
            if (!resp.ok) {
                throw new Error(data.detail || `Erro HTTP ${resp.status}`);
            }

            currentUser = data;

            if (currentUser.type !== 'admin') {
                alert('Acesso restrito a administradores');
                window.location.href = 'index.html';
                return;
            }

            loadUserData();
            loadUsersList();
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

function loadUserData() {
    if (!currentUser) return;
    document.getElementById('navbar-username').textContent = currentUser.name;
}

async function loadUsersList() {
    const loadingElement = document.getElementById('loading-users');
    const tableBody = document.getElementById('users-body');

    try {
        loadingElement.style.display = 'flex';
        tableBody.innerHTML = '';

        const token = localStorage.getItem('access_token');
        const response = await apiFetch(`${apiBaseUrl}/users/`);

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
                const response = await apiFetch(`${apiBaseUrl}/users/${userId}/reset-password`, {
                    method: 'POST',
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