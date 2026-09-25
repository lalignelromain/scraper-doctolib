const { chromium } = require('playwright');
const axios = require('axios');

const DOCTOLIB_URL = 'https://www.doctolib.fr/dermatologue/val-de-briey/caroline-cotten';
const NTFY_TOPIC = 'cotten-rdv-veille';

async function sendNtfyAlert(message, title = "🚨 ALERTE DOCTOLIB 🚨", priority = "urgent", tags = "hospital,rotating_light") {
    try {
        await axios.post(`https://ntfy.sh/${NTFY_TOPIC}`, message, {
            headers: { 
                'Title': title, 
                'Priority': priority, 
                'Tags': tags 
            }
        });
        console.log("✅ Alerte Ntfy envoyée avec succès !");
    } catch (error) {
        console.error("❌ Erreur lors de l'envoi de l'alerte Ntfy :", error.message);
    }
}

async function checkDoctolib() {
    console.log("🚀 Lancement du navigateur de vérification...");
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    let agendaOpen = false;

    try {
        console.log(`🌐 Navigation vers : ${DOCTOLIB_URL}`);
        await page.goto(DOCTOLIB_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Cookies
        try {
            const cookieBtn = page.locator('button#didomi-notice-agree-button, text=Accepter et fermer').first();
            if (await cookieBtn.isVisible({ timeout: 5000 })) {
                await cookieBtn.click();
                console.log("🍪 Cookies acceptés.");
            }
        } catch (e) {
            console.log("ℹ️ Pas de bannière de cookies détectée.");
        }

        console.log("🔍 Recherche du bouton 'Prendre rendez-vous'...");
        const appointmentBtn = page.locator('a:has-text("Prendre rendez-vous"), button:has-text("Prendre rendez-vous")').first();
        
        await appointmentBtn.waitFor({ state: 'attached', timeout: 15000 });

        const isDisabled = await appointmentBtn.evaluate(el => {
            if (el.classList.contains('Tappable-inactive')) {
                return true;
            }
            if (el.hasAttribute('disabled')) {
                return true;
            }
            return false;
        });

        if (isDisabled) {
            console.log("🔒 Agenda fermé : Le bouton 'Prendre rendez-vous' est inactif/grisé.");
        } else {
            // Si le bouton est actif, on clique pour creuser
            await appointmentBtn.click({ force: true });
            console.log("🖱️ Clic effectué sur 'Prendre rendez-vous'.");

            await page.waitForTimeout(3000);

            try {
                const newPatientOption = page.locator('text=Nouveau patient').first();
                if (await newPatientOption.isVisible({ timeout: 5000 })) {
                    await newPatientOption.click();
                    await page.waitForTimeout(2000);
                }
            } catch (e) {}

            try {
                const firstMotive = page.locator('.dl-consultation-motive-list-item, [data-test*="motive"]').first();
                if (await firstMotive.isVisible({ timeout: 5000 })) {
                    await firstMotive.click();
                    await page.waitForTimeout(3000);
                }
            } catch (e) {}

            const calendarView = page.locator('.dl-calendar-day, .dl-availability-slot').first();
            const hasSlots = await calendarView.isVisible({ timeout: 5000 }).catch(() => false);

            if (hasSlots) {
                agendaOpen = true;
                console.log("🎉 ALERTE : DES CRÉNEAUX SEMBLENT DISPONIBLES !");
                await sendNtfyAlert(
                    `L'agenda du Dr. Caroline Cotten est ouvert !\nFonce vite réserver : ${DOCTOLIB_URL}`,
                    "🔥 CRÉNEAU DISPONIBLE DR COTTEN !",
                    "urgent",
                    "hospital,rotating_light"
                );
            }
        }

    } catch (error) {
        console.error("❌ Erreur durant le parcours Playwright :", error.message);
    } finally {
        await browser.close();
        console.log("🔒 Navigateur fermé.");
    }

    // --- GESTION DES STATUTS / HEARTBEAT ---
    const now = new Date();
    const hours = parseInt(now.toLocaleString('en-US', { timeZone: 'Europe/Paris', hour: 'numeric', hour12: false }), 10);
    const minutes = parseInt(now.toLocaleString('en-US', { timeZone: 'Europe/Paris', minute: 'numeric' }), 10);

    // DEBUG : Affichage de l'heure perçue par le script
    console.log(`🕒 Heure évaluée (Paris) : ${hours}h${minutes < 10 ? '0' : ''}${minutes}`);

    const isScheduledReportHour = [8, 12, 14, 16, 20].includes(hours) && minutes <= 30;
    
    if (isScheduledReportHour && !agendaOpen) {
        console.log(`📡 Envoi du rapport de statut programmé de ${hours}h...`);
        await sendNtfyAlert(
            `🟢 Veille active : Le script tourne correctement. L'agenda du Dr. Cotten est toujours fermé pour le moment.`,
            `Status Check (${hours}h) - Dr. Cotten`,
            "default",
            "white_check_mark,eyes"
        );
    }
}

checkDoctolib();
