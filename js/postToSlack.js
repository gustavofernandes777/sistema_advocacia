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

export async function postMessageToSlack(message) {
    // 🔧 Substitua pela URL completa do webhook Slack:
    const webhookUrl = 'https://hooks.slack.com/services/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';

    try {

        const response = await apiFetch(webhookUrl, {
            method: 'POST',
            body: JSON.stringify({
                text: message,
            })
        });

        if (!response.ok) {
            const text = await response.text();
            console.error(`❌ Falha ao enviar mensagem: ${response.status} ${response.statusText} - ${text}`);
        } else {
            console.log('✅ Mensagem enviada ao Slack com sucesso!');
        }
    } catch (error) {
        console.error('🚨 Erro ao enviar mensagem para o Slack:', error);
    }
}
