export async function postMessageToSlack(message) {
    // 🔧 Substitua pela URL completa do webhook Slack:
    const webhookUrl = 'https://hooks.slack.com/services/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';

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: message,
            }),
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
