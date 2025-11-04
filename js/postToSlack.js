export async function postMessageToSlack(mensagem) {
    try {
        const response = await fetch("/api/slack", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: mensagem }),
        });

        const result = await response.json();
        if (response.ok && result.success) {
            console.log("✅ Mensagem enviada com sucesso!");
        } else {
            console.error("❌ Falha:", result.detail || result.message);
        }
    } catch (error) {
        console.error("🚨 Erro na requisição:", error);
    }
}
