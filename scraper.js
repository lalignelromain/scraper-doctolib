const { chromium } = require('playwright');
const axios = require('axios');

// Configuration
const DOCTOLIB_URL = 'https://www.doctolib.fr/dermatologue/val-de-briey/caroline-cotten';
const NTFY_TOPIC = 'stock_jouets_romain'; // Ton sujet ntfy existant

async function sendNtfyAlert(message, title = "🚨 ALERTE DOCTOLIB 🚨") {
    try {
        await axios.post(`https://ntfy.sh/${NTFY_TOPIC}`, message, {
            headers: {
                'Title': title,
                'Priority': 'urgent',
                'Tags': 'hospital,rotating_light'
            }
        });
        console.log("✅ Alerte Ntfy envoyée avec succès !");
    } catch (error) {
        console.error("❌ Erreur lors de l'envoi de l'alerte Ntfy :", error.message);
    }
}

async function checkDoctolib() {
    console.log("🚀 Lancement du navigateur de vérification...");
    
    // Lancement de Playwright en mode headless (invisible)
    const browser = await chromium.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    const page = await context.newPage();

    try {
        console.log(`🌐 Navigation vers : ${DOCTOLIB_URL}`);
        await page.goto(DOCTOLIB_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // 1. Accepter les cookies si la popup apparaît
        try {
            const cookieBtn = await page.locator('button#didomi-notice-agree-button').or(page.locator('text=Accepter et fermer'));
            if (await cookieBtn.isVisible({ timeout: 5000 })) {
                await cookieBtn.click();
                console.log("🍪 Cookies acceptés.");
            }
        } catch (e) {
            console.log("ℹ️ Pas de bannière de cookies détectée ou déjà acceptée.");
        }

        // 2. Cliquer sur le bouton principal "Prendre rendez-vous"
        console.log("🔍 Recherche du bouton 'Prendre rendez-vous'...");
        const appointmentBtn = page.locator('text=Prendre rendez-vous').first();
        await appointmentBtn.waitFor({ state: 'visible', timeout: 15000 });
        await appointmentBtn.click();
        console.log("🖱️ Clic sur 'Prendre rendez-vous'.");

        // Attente du chargement de la modale/étape suivante (choix du patient / motif)
        await page.waitForTimeout(3000);

        // 3. Gestion de l'étape "Déjà patient / Nouveau patient" (si elle s'affiche)
        try {
            const newPatientOption = page.locator('text=Nouveau patient').first();
            if (await newPatientOption.isVisible({ timeout: 5000 })) {
                await newPatientOption.click();
                console.log("🖱️ Sélection de 'Nouveau patient'.");
                await page.waitForTimeout(2000);
            }
        } catch (e) {
            console.log("ℹ️ Pas d'étape de sélection de patient détectée.");
        }

        // 4. Sélection du premier motif de consultation disponible si une liste apparaît
        try {
            const firstMotive = page.locator('.dl-consultation-motive-list-item, [data-test*="motive"]').first();
            if (await firstMotive.isVisible({ timeout: 5000 })) {
                await firstMotive.click();
                console.log("🖱️ Clic sur le motif de consultation.");
                await page.waitForTimeout(3000);
            }
        } catch (e) {
            console.log("ℹ️ Étape de sélection du motif ignorée ou non trouvée.");
        }

        // 5. Analyse de l'agenda final
        console.log("🔎 Vérification de la présence de créneaux sur l'agenda...");
        
        // On cherche des éléments typiques d'un calendrier ouvert (ex: des cellules de date cliquables ou un message d'indisponibilité)
        const noSlotMessage = page.locator('text=Aucun créneau de disponibilité');
        const isClosed = await noSlotMessage.isVisible({ timeout: 5000 }).catch(() => false);

        if (isClosed) {
            console.log("🔒 Agenda toujours fermé / Aucun créneau disponible.");
        } else {
            // S'il n'y a pas le message "aucun créneau", on vérifie s'il y a un calendrier actif
            const calendarView = page.locator('.dl-calendar-day, .dl-availability-slot').first();
            const hasSlots = await calendarView.isVisible({ timeout: 5000 }).catch(() => false);

            if (hasSlots) {
                console.log("🎉 ALERTE : DES CRÉNEAUX SEMBLENT DISPONIBLES !");
                await sendNtfyAlert(
                    `L'agenda du Dr. Caroline Cotten semble ouvert ou des créneaux sont apparus !\nFonce vite réserver : ${DOCTOLIB_URL}`,
                    "🔥 CRÉNEAU DISPONIBLE DR COTTEN !"
                );
            } else {
                console.log("⚠️ Situation incertaine, ni message de fermeture évident, ni créneau clair.");
            }
        }

    } catch (error) {
        console.error("❌ Erreur durant le parcours Playwright :", error.message);
    } finally {
        await browser.close();
        console.log("🔒 Navigateur fermé.");
    }
}

checkDoctolib();
