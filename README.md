# 🩺 Doctolib Scraper - Alerte de Rendez-Vous

Un outil automatisé de surveillance pour détecter les créneaux disponibles sur Doctolib et envoyer une notification push en temps réel sur smartphone.

## 🚀 Fonctionnalités

*   **Surveillance Automatisée :** Vérification de l'agenda à intervalles réguliers via GitHub Actions (Cron).
*   **Navigation Headless :** Utilisation de Playwright pour interpréter le JavaScript et simuler un navigateur réel.
*   **Contournement Anti-Bot :** Détection et évitement des boucliers de protection (Cloudflare / Datadome) pour prévenir le bannissement de l'IP.
*   **Notifications Push :** Intégration de l'API Ntfy pour des alertes instantanées avec gestion des priorités.
*   **Monitoring :** Système de "Heartbeat" pour confirmer le bon fonctionnement du script de manière journalière.

## 🛠️ Stack Technique

*   **Langage :** JavaScript (Node.js)
*   **Framework de scraping :** Playwright
*   **Requêtes HTTP :** Axios
*   **Infrastructure :** GitHub Actions (CI/CD)
*   **Notifications :** Ntfy.sh
