import { CONFIG } from "./config.js";
const apiBaseUrl = CONFIG.API_URL;

function getTokenInfo() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
    console.log('DEBUG origin:', location.origin, 'href:', location.href);
    console.log('DEBUG localStorage keys:', keys);

    const token = localStorage.getItem('access_token')
        || localStorage.getItem('token')
        || localStorage.getItem('auth_token')
        || null;

    const tokenType = localStorage.getItem('token_type') || 'Bearer';
    console.log('DEBUG token found?', !!token, 'tokenType:', tokenType);
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

        // PARA DELETE: se for 204 ou sem corpo, retorne null ou response direto
        if (resp.status === 204) {
            return null;
        } else {
            if (!contentType.includes('application/json')) {
                throw new Error(`Content-Type inesperado: ${contentType}`);
            }

            const data = JSON.parse(text);

            if (!resp.ok) {
                throw new Error(data.detail || `HTTP Error ${resp.status}`);
            }

            return data;
        }

    } catch (error) {
        console.error('❌ apiFetch error:', error);
        throw error;
    }
}

export async function postMessageToSlack(mensagem) {
    try {
        const response = await apiFetch(`${apiBaseUrl}/api/slack`, {
            method: "POST",
            body: JSON.stringify(mensagem),
        });

        Swal.fire({
            icon: 'success',
            title: 'Sucesso!',
            text: 'Mensagem enviada com sucesso!'
        });

        if (response.ok && result.success) {
            console.log("✅ Mensagem enviada com sucesso!");
        } else {
            console.error("❌ Falha:", result.detail || result.message);
        }
    } catch (error) {
        console.error("🚨 Erro na requisição:", error);
    }
}
