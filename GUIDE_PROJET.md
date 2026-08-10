# Guide de Projet : Boutique E-Commerce locale Avancée pour Tests d'Agents

## Objectif
Ce document décrit la structure, la configuration et les procédures de validation de la **Boutique E-Commerce locale Avancée**. Ce projet a été pensé pour simuler de manière réaliste un site marchand moderne sécurisé avec persistance de données (SQLite) et intégration de la passerelle de paiement **Stripe Embedded Checkout** (sans redirection externe).

---

## 📁 1. Structure Globale du Projet

Le projet a été architecturé en séparant proprement la logique serveur (Back-end) et les fichiers statiques servis au client (Front-end SPA) :

```text
boutique-ecommerce/
├── boutique.db              <-- Base de données locale SQLite persistante
├── boutique-server.js       <-- Serveur Express principal (API, Stripe, Sessions)
├── database.js              <-- Logique d'accès aux données SQLite (better-sqlite3)
├── package.json             <-- Script de démarrage et dépendances npm
├── .env                     <-- Fichier de configuration des clés secrètes
└── public/                  <-- Répertoire public servi au navigateur (Front-end SPA)
    ├── index.html           <-- Structure HTML unique de la SPA (Aesthetic Mode)
    ├── app.css              <-- Design système moderne (Dark Mode, Glassmorphism)
    ├── app.js               <-- Logique JavaScript client (Routage client, Stripe SDK)
    └── images/              <-- Images des produits (CCM, uploaded-...)
```

---

## 📦 2. Initialisation et Dépendances

Pour installer le projet et toutes ses dépendances sur votre machine locale, exécutez les commandes suivantes dans votre terminal :

```bash
# Se placer dans le dossier du projet
cd boutique-ecommerce

# Installer l'ensemble des modules requis
npm install express express-session stripe multer better-sqlite3 dotenv
```

### Script de Démarrage (`package.json`)
Assurez-vous que votre fichier [package.json](file:///Users/madbrain/Documents/Lab/boutique-ecommerce/package.json) contient la configuration suivante pour activer les modules ES6 et le script de lancement rapide :

```json
{
  "name": "boutique-ecommerce",
  "version": "1.0.0",
  "type": "module",
  "main": "boutique-server.js",
  "scripts": {
    "start": "node boutique-server.js"
  },
  "dependencies": {
    "better-sqlite3": "^9.0.0",
    "dotenv": "^16.4.5",
    "express": "^4.21.2",
    "express-session": "^1.18.1",
    "multer": "^1.4.5-lts.1",
    "stripe": "^14.0.0"
  }
}
```

---

## 🔑 3. Configuration de l'Environnement (`.env`)

Créez un fichier `.env` à la racine du dossier `boutique-ecommerce` avec les variables suivantes :

```env
# Clé secrète de test Stripe (récupérée sur votre tableau de bord développeur Stripe)
STRIPE_SECRET_KEY=sk_test_51...VotreCleSecreteIci

# Port d'écoute optionnel (par défaut 8080)
PORT_BOUTIQUE=8080
```

> [!NOTE]
> La clé publique Stripe (`STRIPE_PUBLISHABLE_KEY`) est automatiquement détectée et générée par le serveur back-end à partir de votre clé secrète, vous n'avez donc pas besoin de la configurer manuellement.

---

## ⚙️ 4. Architecture de Persistance (Base de données SQLite)

Le projet utilise **better-sqlite3** pour stocker les entités de façon persistante dans `boutique.db`. 

### Schéma Relationnel SQLite

```mermaid
erDiagram
    users {
        int id PK
        text username UNIQUE
        text password_hash
        text salt
        text role "admin | read-only"
        text status "active | blocked"
        datetime created_at
    }
    products {
        text id PK "slug-unique"
        text nom
        real prix
        text desc
        text image "chemin/relatif.jpg"
    }
    transactions {
        text id PK "stripe_session_id"
        text email "facturation"
        real amount
        text status "pending | paid"
        text items "Format JSON"
        datetime created_at
    }
```

* **Sécurité des mots de passe** : Tous les mots de passe sont salés et hachés via l'algorithme standard cryptographique `PBKDF2` (SHA512, 1000 itérations).
* **Révocation de Session en Temps Réel** : Si un administrateur suspend (bloque) un compte utilisateur, la session active du navigateur concerné est immédiatement révoquée et détruite lors de la requête suivante.

---

## 💳 5. Intégration Stripe Embedded Checkout

Au lieu de rediriger l'utilisateur vers une page hébergée par Stripe, l'application utilise **Stripe Embedded Checkout** dans un conteneur intégré au site marchand.

### Parcours Transactionnel
1. L'utilisateur clique sur **Procéder au paiement** dans la vue panier.
2. Le back-end génère une `Checkout Session` Stripe en mode `embedded_page` et renvoie un `clientSecret` au client.
3. Le SDK JavaScript Stripe client charge le formulaire de paiement sécurisé directement dans l'iframe `#checkout-container`.
4. Une fois le paiement validé, Stripe redirige vers `/checkout/succes`, qui vide le panier et renvoie vers la page de succès SPA.
5. Le serveur met à jour le statut de la transaction locale à `paid` et enregistre l'email du client.

---

## 🛠️ 6. Guide de Validation Manuelle et Tests d'Agents

Pour valider le fonctionnement complet de l'application, suivez les étapes de test suivantes :

### Étape 1 : Lancement du serveur
```bash
npm start
```
Vous devriez voir s'afficher :
`📦 Base de données SQLite connectée.`
`🛒 Boutique Express complète en ligne sur http://localhost:8080`

### Étape 2 : Achat et paiement test
1. Ouvrez `http://localhost:8080` dans votre navigateur.
2. Ajoutez un produit au panier et modifiez les quantités ou retirez des articles.
3. Cliquez sur **Procéder au paiement**.
4. Remplissez le formulaire Stripe intégré en saisissant une adresse email et le numéro de carte de test standard Stripe `4242 4242 4242 4242`.
5. Validez le paiement. Vous devriez être redirigé vers l'écran de succès de notre application avec les confettis !

### Étape 3 : Administration et gestion du catalogue
1. Allez sur l'onglet **Admin** et connectez-vous avec les identifiants par défaut : **`admin` / `admin`**.
2. **Onglet Transactions** : Cliquez sur **Voir** à côté de votre transaction Stripe. Le reçu détaillé des articles achetés et des prix s'affiche.
3. **Onglet Produits** :
   * Modifiez un produit existant en cliquant sur le bouton d'édition ✏️. Remplissez le formulaire et cliquez sur **Mettre à jour** (l'image est facultative).
   * Supprimez un produit du catalogue en cliquant sur le bouton de suppression 🗑️.
   * Créez un nouveau produit en complétant l'ID (slug), le nom, le prix et en téléversant un véritable fichier image depuis votre ordinateur.
4. **Onglet Utilisateurs** :
   * Créez un compte utilisateur de test (ex: rôle `Lecture seule`).
   * Éditez cet utilisateur pour changer son statut sur **Bloqué / Suspendu** ou changer son mot de passe.
   * Tentez de vous connecter avec le compte bloqué pour vérifier l'interdiction d'accès.
