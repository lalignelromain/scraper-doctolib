const { chromium } = require('playwright');
const axios = require('axios');

const DOCTOLIB_URL = 'https://www.doctolib.fr/dermatologue/val-de-briey/caroline-cotten';
const NTFY_TOPIC = 'stock_jouets_romain';

async function sendNtfyAlert(message, title = "🚨 ALERTE DOCTOLIB 🚨") {
    try {
        await axios.post(`https://ntfy.sh/${NTFY_TOPIC}`, message, {
            headers: { 'Title': title, 'Priority': 'urgent', 'Tags': 'hospital,rotating_light' }
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

        // On vérifie si le bouton est désactivé (cas où l'agenda est fermé)
        const isDisabled = await appointmentBtn.evaluate(el => el.classList.contains('Tappable-inactive') || el.hasAttribute('disabled'));

        if (isDisabled) {
            console.log("🔒 Agenda fermé : Le bouton 'Prendre rendez-vous' est inactif/grisé.");
            return; // On arrête proprement le script ici, tout va bien
        }

        // Si le bouton est actif, on clique !
        await appointmentBtn.click({ force: true });
        console.log("🖱️ Clic effectué sur 'Prendre rendez-vous'.");

        await page.waitForTimeout(3000);

        // Étapes suivantes (Patient / Motif / Agenda)
        try {
            const newPatientOption = page.locator('text=Nouveau patient').first();
            if (await newPatientOption.isVisible({ timeout: 5000 })) {
                await newPatientOption.click();
                console.log("🖱️ Sélection de 'Nouveau patient'.");
                await page.waitForTimeout(2000);
            }
        } catch (e) {}

        try {
            const firstMotive = page.locator('.dl-consultation-motive-list-item, [data-test*="motive"]').first();
            if (await firstMotive.isVisible({ timeout: 5000 })) {
                await firstMotive.click();
                console.log("🖱️ Clic sur le motif de consultation.");
                await page.waitForTimeout(3000);
            }
        } catch (e) {}

        // Vérification finale des créneaux
        const calendarView = page.locator('.dl-calendar-day, .dl-availability-slot').first();
        const hasSlots = await calendarView.isVisible({ timeout: 5000 }).catch(() => false);

        if (hasSlots) {
            console.log("🎉 ALERTE : DES CRÉNEAUX SEMBLENT DISPONIBLES !");
            await sendNtfyAlert(
                `L'agenda du Dr. Caroline Cotten est ouvert !\nFonce vite réserver : ${DOCTOLIB_URL}`,
                "🔥 CRÉNEAU DISPONIBLE DR COTTEN !"
            );
        } else {
            console.log("⚠️ Bouton cliqué mais aucun créneau visible pour l'instant.");
        }

    } catch (error) {
        console.error("❌ Erreur durant le parcours Playwright :", error.message);
    } finally {
        await browser.close();
        console.log("🔒 Navigateur fermé.");
    }
}

checkDoctolib();
