import { CONFIG } from "./config.js";
const apiBaseUrl = CONFIG.API_URL;

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
        throw error;
    }
}

export async function postMessageToSlack(type, mensagem) {
    try {
        const response = await apiFetch(`${apiBaseUrl}/api/slack`, {
            method: "POST",
            body: JSON.stringify({type: type, message: mensagem }),
        });

    } catch (error) {
        throw error;
    }
}
