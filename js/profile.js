const apiBaseUrl = 'https://c1b8d2bcf4e1.ngrok-free.app';
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
        const response = await safeFetch(`${apiBaseUrl}/users/me/`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            credentials: 'include' // 🔥 IMPORTANTE!
        });

        console.log('📊 Status da resposta:', response.status);
        
        if (!response) {
            if (response.status === 401) {
                console.log('❌ Token inválido ou expirado (401)');
                throw new Error('Token inválido');
            }
            throw new Error(`Erro HTTP: ${response.status}`);
        }

        const userData = response;
        console.log('✅ Autenticação válida! Usuário:', userData.email);
        currentUser = userData;
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

    // Preencher formulário com dados do usuário
    document.getElementById('userName').value = currentUser.name;
    document.getElementById('userLastName').value = currentUser.last_name;
    document.getElementById('userEmail').value = currentUser.email;
    document.getElementById('userBirthday').value = currentUser.birthday;
}

async function updateUserProfile() {
    const userData = {
        name: document.getElementById('userName').value,
        last_name: document.getElementById('userLastName').value,
        email: document.getElementById('userEmail').value,
        birthday: document.getElementById('userBirthday').value
    };

    try {
        const token = localStorage.getItem('access_token');
        const response = await safeFetch(`${apiBaseUrl}/users/${currentUser.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
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
        const token = localStorage.getItem('access_token');
        const response = await safeFetch(`${apiBaseUrl}/users/${currentUser.id}/password`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
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
document.addEventListener('DOMContentLoaded', function () {
    checkAuth();

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