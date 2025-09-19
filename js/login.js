import { CONFIG } from "../js/config";
const apiBaseUrl = CONFIG.API_URL;

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    try {
        const resp = await fetch(`${apiBaseUrl}/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ username: email, password })
        });

        if (!resp.ok) {
            const txt = await resp.text().catch(() => null);
            console.error('Login falhou. status:', resp.status, 'body:', txt);
            document.getElementById('loginError').textContent = 'Usuário ou senha inválidos.';
            document.getElementById('loginError').classList.remove('d-none');
            return;
        }

        const data = await resp.json();
        console.log('Token recebido:', data);

        // salvar com chaves alternativas — ajuda a evitar mismatch entre páginas
        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('token_type', data.token_type || 'Bearer');
        localStorage.setItem('token_timestamp', Date.now().toString());

        console.log('localStorage keys após login:', Object.keys(localStorage));
        window.location.href = 'index.html';
    } catch (err) {
        console.error('Erro no fetch do /token:', err);
        document.getElementById('loginError').textContent = 'Erro ao conectar com o servidor.';
        document.getElementById('loginError').classList.remove('d-none');
    }
});