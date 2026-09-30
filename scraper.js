try {
    require('dotenv').config();
} catch (e) {
    // Ignoré silencieusement sur GitHub Actions
}

const { chromium } = require('playwright');
const axios = require('axios');

const DOCTOLIB_URL = 'https://www.doctolib.fr/dermatologue/val-de-briey/caroline-cotten';
const NTFY_TOPIC = process.env.NTFY_TOPIC; // ✅ Variable sécurisée via GitHub Secrets

async function sendNtfyAlert(message, title = "🚨 ALERTE DOCTOLIB 🚨", priority = "urgent", tags = "hospital,rotating_light") {
    if (!NTFY_TOPIC) {
        console.log("⚠️ NTFY_TOPIC non défini ! Impossible d'envoyer la notification.");
        return;
    }

    try {
        const response = await axios.post(`https://ntfy.sh/${NTFY_TOPIC}`, message, {
            headers: { 
                'Title': title, 
                'Priority': priority, 
                'Tags': tags 
            }
        });
        if (response.status === 200) {
            console.log("✅ Alerte Ntfy envoyée avec succès !");
        }
    } catch (error) {
        console.error("❌ Erreur lors de l'envoi de l'alerte Ntfy :", error.message);
    }
}

async function checkDoctolib() {
    console.log("🚀 Lancement du navigateur de vérification...");
    const browser = await chromium.launch({ 
        headless: true, 
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--window-size=1280,720'
        ] 
    });

    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 720 },
        locale: 'fr-FR',
        extraHTTPHeaders: {
            'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7' // Renforce l'empreinte humaine
        }
    });

    const page = await context.newPage();
    let agendaOpen = false;

    try {
        console.log(`🌐 Navigation vers : ${DOCTOLIB_URL}`);
        await page.goto(DOCTOLIB_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // 🛡️ Bouclier Anti-Bot : Vérification de la présence de Datadome / Cloudflare
        const isBlocked = await page.evaluate(() => {
            const text = document.body.innerText.toLowerCase();
            return text.includes('prouver que vous êtes un humain') || text.includes('datadome') || text.includes('access denied');
        }).catch(() => false);

        if (isBlocked) {
            console.warn("⚠️ Blocage anti-bot (Datadome/Cloudflare) détecté. Annulation du cycle pour éviter le ban IP.");
            return; // On stoppe l'exécution ici pour ce cycle
        }

        // Gestion des cookies
        try {
            const cookieBtn = page.locator('button#didomi-notice-agree-button, text=Accepter et fermer').first();
            if (await cookieBtn.isVisible({ timeout: 4000 })) {
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
            return el.classList.contains('Tappable-inactive') || el.hasAttribute('disabled');
        });

        if (isDisabled) {
            console.log("🔒 Agenda fermé : Le bouton 'Prendre rendez-vous' est inactif/grisé.");
        } else {
            await appointmentBtn.click({ force: true });
            console.log("🖱️ Clic effectué sur 'Prendre rendez-vous'.");

            await page.waitForTimeout(3000);

            // Gestion de l'option nouveau patient
            try {
                const newPatientOption = page.locator('text=Nouveau patient').first();
                if (await newPatientOption.isVisible({ timeout: 4000 })) {
                    await newPatientOption.click();
                    console.log("👤 Option 'Nouveau patient' sélectionnée.");
                    await page.waitForTimeout(2000);
                }
            } catch (e) {}

            // Sélection du premier motif de consultation
            try {
                const firstMotive = page.locator('.dl-consultation-motive-list-item, [data-test*="motive"]').first();
                if (await firstMotive.isVisible({ timeout: 4000 })) {
                    await firstMotive.click();
                    console.log("📋 Motif de consultation sélectionné.");
                    await page.waitForTimeout(3000);
                }
            } catch (e) {}

            // 🎯 Vérification robuste de la présence de créneaux (waitFor + catch)
            const calendarView = page.locator('.dl-calendar-day, .dl-availability-slot, [data-test*="slot"]').first();
            const hasSlots = await calendarView.waitFor({ state: 'visible', timeout: 6000 })
                .then(() => true)
                .catch(() => false);

            if (hasSlots) {
                agendaOpen = true;
                console.log("🎉 ALERTE : DES CRÉNEAUX SEMBLENT DISPONIBLES !");
                await sendNtfyAlert(
                    `L'agenda du Dr. Caroline Cotten est ouvert !\nFonce vite réserver : ${DOCTOLIB_URL}`,
                    "🔥 CRÉNEAU DISPONIBLE DR COTTEN !",
                    "urgent",
                    "hospital,rotating_light"
                );
            } else {
                console.log("🔍 Bouton cliqué, mais aucun créneau visible dans le calendrier pour l'instant.");
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

    console.log(`🕒 Heure évaluée (Paris) : ${hours}h${minutes < 10 ? '0' : ''}${minutes}`);

    const isScheduledReportHour = [8, 22].includes(hours) && minutes < 15;
    
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
