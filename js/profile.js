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
        loadUserData();
    } catch (error) {
        logout();
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
        const response = await fetch(`${apiBaseUrl}/users/${currentUser.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(userData)
        });

        if (!response.ok) {
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
        const response = await fetch(`${apiBaseUrl}/users/${currentUser.id}/password`, {
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

        if (!response.ok) {
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