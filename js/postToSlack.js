export async function postMessageToSlack(message) {
    const webhookUrl = 'https://hooks.slack.com/services/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';

    fetch(webhookUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
    })
        .then(response => {
            if (response.ok) {
                console.log('Slack message sent successfully!');
            } else {
                console.error('Failed to send Slack message:', response.status, response.statusText);
            }
        })
        .catch(error => {
            console.error('Error sending Slack message:', error);
        });
}
