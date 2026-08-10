# 🛒 Boutique E-Commerce Moderne (Sandbox & Test)

Une application web e-commerce moderne, légère et robuste, conçue pour servir d'environnement de test (Sandbox) pour l'intégration de services de paiement (**Stripe Embedded Checkout**), d'administration de catalogue et d'automatisation par des **Agents IA** (avec Playwright/Puppeteer).

Le projet utilise **Node.js/Express** pour le backend, une base de données **SQLite** pour la persistance, et du HTML/CSS/JS natif avec un design soigné en **Glassmorphism / Dark Mode** pour le frontend.

---

## ✨ Fonctionnalités clés

* **💳 Paiement Sécurisé Stripe** : Intégration complète de l'**Embedded Checkout** de Stripe (le formulaire de paiement s'affiche directement sur la page sans redirection).
* **📦 Catalogue Dynamique** : Affichage, ajout, modification et suppression de produits avec téléversement d'images (via `multer`).
* **👥 Gestion des Utilisateurs** : Authentification et sécurité par session avec gestion de rôles (Administrateur, Lecteur) et blocage de comptes.
* **🛡️ Espace Admin Sécurisé** : Panel d'administration pour gérer les stocks de produits, suivre les transactions Stripe en temps réel et gérer les accès utilisateurs.
* **📊 Persistance SQLite** : Base de données locale légère (`better-sqlite3`) qui s'auto-initialise avec des données de test au premier démarrage.
* **🤖 Conçu pour l'automatisation** : Les sélecteurs HTML et le flux d'achat sont optimisés pour être facilement parcourus et automatisés par des agents autonomes ou des tests end-to-end (Playwright).

---

## 📁 Structure du projet

```text
├── boutique-server.js   # Serveur Express principal (API, Sessions, Stripe, Uploads)
├── database.js          # Couche d'accès aux données (better-sqlite3) & Seeds
├── package.json         # Dépendances npm et script de démarrage
├── .gitignore           # Configuration Git pour ignorer les fichiers locaux (.env, DB)
├── README.md            # Présentation et documentation du projet
└── public/              # Fichiers statiques servis au navigateur (Frontend SPA)
    ├── index.html       # Structure HTML5 sémantique (SPA)
    ├── app.css          # Styles premium (Glassmorphism, Dark mode, Gradients)
    ├── app.js           # Routage client, appels API et SDK Stripe Client
    └── images/          # Images des produits (CCM, uploads)
```

---

## ⚡ Prérequis

* **Node.js** (version 18 ou supérieure recommandée)
* Un compte **Stripe** (en mode de test / developer)

---

## 🚀 Installation & Démarrage

### 1. Cloner le projet et installer les dépendances
```bash
npm install
```

### 2. Configuration des Variables d'Environnement
Créez un fichier `.env` à la racine de l'application :
```env
# Clé secrète de test Stripe (commence par sk_test_...)
STRIPE_SECRET_KEY=sk_test_...VotreCleStripeIci...

# Port d'écoute du serveur (optionnel, 8080 par défaut)
PORT_BOUTIQUE=8080
```
> 💡 *Note : La clé publique Stripe (`pk_test_...`) est extraite et configurée automatiquement par le serveur à partir de votre clé secrète, aucune configuration supplémentaire n'est requise.*

### 3. Démarrer l'application
```bash
npm start
```
L'application est maintenant accessible sur [http://localhost:8080](http://localhost:8080).

---

## 👤 Accès Administrateur par défaut

Au premier démarrage, la base de données SQLite (`boutique.db`) se crée automatiquement et injecte un utilisateur administrateur par défaut :
* **Identifiant** : `admin`
* **Mot de passe** : `admin`

*Il est fortement recommandé de modifier ce mot de passe ou de créer un nouvel administrateur depuis l'onglet d'administration une fois connecté.*

---

## ☁️ Déploiement en ligne gratuit (Render / Railway)

Cette application est prête à être déployée sur les plateformes Cloud prenant en charge Node.js :

### Déploiement sur Render.com (Gratuit) :
1. Créez un compte sur **Render** en vous connectant avec votre compte GitHub.
2. Créez un nouveau **Web Service** et liez ce dépôt.
3. Configurez les paramètres suivants :
   * **Root Directory** : *Laissez vide*
   * **Runtime** : `Node`
   * **Build Command** : `npm install`
   * **Start Command** : `npm start`
4. Ajoutez vos variables d'environnement dans l'onglet **Environment** :
   * `STRIPE_SECRET_KEY` = `votre_cle_stripe_de_test`
   * `PORT_BOUTIQUE` = `10000`
5. Cliquez sur **Deploy Web Service**.
