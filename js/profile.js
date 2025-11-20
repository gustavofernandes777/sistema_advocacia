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
            loadUserData()
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

    // Preencher formulário com dados do usuário
    document.getElementById('userName').value = currentUser.name;
    document.getElementById('userLastName').value = currentUser.last_name;
    document.getElementById('userEmail').value = currentUser.email;
    document.getElementById('userBirthday').value = currentUser.birthday;

    if (currentUser.type !== 'admin') {
        document.getElementById('reportsLink').style.display = 'none';
        document.getElementById('adminDropdown').style.display = 'none';
    }
}

async function updateUserProfile() {
    const userData = {
        name: document.getElementById('userName').value,
        last_name: document.getElementById('userLastName').value,
        email: document.getElementById('userEmail').value,
        birthday: document.getElementById('userBirthday').value
    };

    try {
        const response = await apiFetch(`${apiBaseUrl}/users/${currentUser.id}`, {
            method: 'PUT',
            body: JSON.stringify(userData)
        });

        if (!response) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Erro ao atualizar perfil');
        }

        Swal.fire({
            icon: 'success',
            title: 'Sucesso!',
            text: 'Perfil atualizado com sucesso'
        });

    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: error.message
        });
    }
}

async function changePassword() {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (newPassword !== confirmPassword) {
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: 'As novas senhas não coincidem'
        });
        return;
    }

    try {
        const response = await apiFetch(`${apiBaseUrl}/users/${currentUser.id}/password`, {
            method: 'PUT',
            body: JSON.stringify({
                current_password: currentPassword,
                new_password: newPassword
            })
        });

        if (!response) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Erro ao alterar senha');
        }

        Swal.fire({
            icon: 'success',
            title: 'Sucesso!',
            text: 'Senha alterada com sucesso'
        });

        // Limpar formulário
        document.getElementById('passwordForm').reset();

    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: error.message
        });
    }
}

function logout() {
    localStorage.removeItem('access_token');
    window.location.href = 'login.html';
}

// Event Listeners
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();

    document.getElementById('userSettingsForm').addEventListener('submit', function (e) {
        e.preventDefault();
        updateUserProfile();
    });

    document.getElementById('passwordForm').addEventListener('submit', function (e) {
        e.preventDefault();
        changePassword();
    });

    document.querySelector('.logout-btn').addEventListener('click', logout);
});