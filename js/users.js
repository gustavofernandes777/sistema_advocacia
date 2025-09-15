const apiBaseUrl = 'https://c1b8d2bcf4e1.ngrok-free.app';
let currentUser = null;

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

        // Verificar se é admin
        if (currentUser.type !== 'admin') {
            alert('Acesso restrito a administradores');
            window.location.href = 'index.html';
            return;
        }

        loadUserData();
        loadUsersList();
    } catch (error) {
        logout();
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
        const response = await fetch(`${apiBaseUrl}/users/`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Erro ao carregar usuários');
        }

        const users = await response.json();
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
                const response = await fetch(`${apiBaseUrl}/users/${userId}/reset-password`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        new_password: '12345678'
                    })
                });

                if (!response.ok) {
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
document.addEventListener('DOMContentLoaded', function () {
    checkAuth();
    document.querySelector('.logout-btn').addEventListener('click', logout);
});