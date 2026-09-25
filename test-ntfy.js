const axios = require('axios');

const NTFY_TOPIC = 'stock_jouets_romain';

async function sendTestNotification() {
    console.log(`🚀 Envoi d'une notification de test vers ntfy.sh/${NTFY_TOPIC}...`);

    try {
        const response = await axios.post(`https://ntfy.sh/${NTFY_TOPIC}`, 
            "Ceci est un test manuel de notification depuis le workflow dédié sur GitHub Actions.", 
            {
                headers: {
                    'Title': '🧪 Test Workflow Dédié NTFY',
                    'Priority': 'high',
                    'Tags': 'bell,white_check_mark'
                }
            }
        );

        console.log("✅ Notification de test envoyée avec succès ! Code HTTP :", response.status);
    } catch (error) {
        console.error("❌ Erreur lors de l'envoi de la notification :", error.message);
        process.exit(1); // Fait échouer le job si l'API ntfy répond mal
    }
}

sendTestNotification();
