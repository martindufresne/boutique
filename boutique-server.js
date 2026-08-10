// boutique-server.js
// Serveur Express principal gérant le routage de l'API REST de la boutique,
// l'intégration de Stripe (Embedded Checkout), et la sécurité du panneau d'administration.

import express from 'express';
import session from 'express-session';
import Stripe from 'stripe';
import multer from 'multer';
import path from 'path';
import 'dotenv/config';
import {
  dbInit,
  getAllProducts,
  getProductById,
  addProduct,
  addTransaction,
  getAllTransactions,
  updateTransactionStatus,
  verifyPassword,
  getUserByUsername,
  getAllUsers,
  createUser,
  deleteUser,
  updateProduct,
  deleteProduct,
  getUserById,
  updateUser
} from './database.js';

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const PORT = process.env.PORT_BOUTIQUE || 8080;

// Génère la clé publique Stripe dynamiquement si non fournie dans le fichier .env
const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY || 
  process.env.STRIPE_SECRET_KEY.replace('sk_test_', 'pk_test_').replace('sk_live_', 'pk_live_');

// Initialise le schéma et les données par défaut de la base SQLite
dbInit();

// ==========================================
// CONFIGURATION DE L'UPLOAD D'IMAGES (Multer)
// ==========================================

// Définition de l'emplacement et de la règle de nommage des fichiers téléchargés
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/images/'); // Sauvegarde les images dans le dossier public/images/
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'uploaded-' + uniqueSuffix + path.extname(file.originalname)); // Préserve l'extension d'origine
  }
});

// Middleware Multer avec filtre pour n'autoriser que les fichiers images
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Seules les images sont autorisées.'), false);
    }
    cb(null, true);
  }
});

// ==========================================
// CONFIGURATION DES MIDDLEWARES EXPRESS
// ==========================================

// Parseurs pour décoder les corps de requêtes JSON et URL-encodés
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Configuration des sessions Express pour stocker l'état du panier client et les connexions admin
app.use(session({
  secret: 'madbrain-boutique-token-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24 } // Session expirant après 24 heures
}));

// Sert tous les fichiers statiques de l'interface client (HTML, CSS, JS, images)
app.use(express.static('public'));

// ==========================================
// MIDDLEWARE DE SÉCURITÉ (AUTHENTIFICATION)
// ==========================================

/**
 * Middleware express protégeant les routes d'API d'administration.
 * Vérifie que la session est active, que le compte n'est pas bloqué et que le rôle requis est respecté.
 * En cas de compte suspendu ('blocked'), détruit immédiatement la session active.
 * @param {string} [role] - Le rôle obligatoire pour accéder à la route (ex: 'admin').
 */
function requireAuth(role) {
  return (req, res, next) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Non authentifié. Veuillez vous connecter.' });
    }
    
    try {
      const user = getUserById(req.session.userId);
      if (!user || user.status === 'blocked') {
        req.session.destroy(); // Déconnecte instantanément l'utilisateur banni
        return res.status(401).json({ error: 'Votre compte a été suspendu ou supprimé. Accès refusé.' });
      }

      if (role && user.role !== role) {
        return res.status(403).json({ error: 'Accès interdit. Rôle insuffisant.' });
      }
      next();
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  };
}

// ==========================================
// ROUTAGE API REST - AUTHENTIFICATION
// ==========================================

// Route de connexion de l'utilisateur
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Identifiant et mot de passe requis' });
  }

  try {
    const user = getUserByUsername(username);
    if (!user || !verifyPassword(password, user.salt, user.password_hash)) {
      return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' });
    }

    if (user.status === 'blocked') {
      return res.status(403).json({ error: 'Votre compte a été suspendu par un administrateur.' });
    }

    // Sauvegarde les informations de session
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;

    res.json({ success: true, user: { username: user.username, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Route de déconnexion
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Erreur lors de la déconnexion' });
    }
    res.json({ success: true });
  });
});

// Récupère les métadonnées de la session de l'utilisateur actuel
app.get('/api/auth/me', (req, res) => {
  if (req.session.userId) {
    res.json({ loggedIn: true, user: { username: req.session.username, role: req.session.role } });
  } else {
    res.json({ loggedIn: false });
  }
});

// ==========================================
// ROUTAGE API REST - BOUTIQUE PUBLIQUE & PANIER
// ==========================================

// Récupère le catalogue complet formaté sous forme d'objet associatif (clé: ID produit)
app.get('/api/products', (req, res) => {
  try {
    const products = getAllProducts();
    const productObject = {};
    products.forEach(p => {
      productObject[p.id] = p;
    });
    res.json(productObject);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Récupère les articles présents dans le panier en session
app.get('/api/cart', (req, res) => {
  res.json(req.session.panier || {});
});

// Ajoute ou incrémente un article dans le panier en session
app.post('/api/cart', (req, res) => {
  const { productId, quantity } = req.body;
  
  try {
    const prod = getProductById(productId);
    if (!prod) {
      return res.status(404).json({ error: 'Produit introuvable' });
    }

    if (!req.session.panier) {
      req.session.panier = {};
    }

    const qteValide = Math.max(1, parseInt(quantity) || 1);
    req.session.panier[productId] = (req.session.panier[productId] || 0) + qteValide;
    
    res.json(req.session.panier);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Met à jour la quantité d'un produit dans le panier (remplace l'ancienne valeur)
app.put('/api/cart', (req, res) => {
  const { productId, quantity } = req.body;
  
  try {
    const prod = getProductById(productId);
    if (!prod) {
      return res.status(404).json({ error: 'Produit introuvable' });
    }

    if (!req.session.panier) {
      req.session.panier = {};
    }

    const qteValide = Math.max(1, parseInt(quantity) || 1);
    req.session.panier[productId] = qteValide;
    
    res.json(req.session.panier);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Retire complètement un produit du panier en session
app.delete('/api/cart/:productId', (req, res) => {
  const { productId } = req.params;
  if (req.session.panier && req.session.panier[productId] !== undefined) {
    delete req.session.panier[productId];
  }
  res.json(req.session.panier || {});
});

// ==========================================
// ROUTAGE API REST - PASSERELLE STRIPE
// ==========================================

// Récupère la clé publique Stripe requise par l'Embedded Checkout SDK côté client
app.get('/api/config', (req, res) => {
  res.json({ publishableKey: STRIPE_PUBLISHABLE_KEY });
});

// Initialise une session Stripe Embedded Checkout et enregistre la transaction SQLite en 'pending'
app.post('/api/checkout', async (req, res) => {
  const panier = req.session.panier || {};
  
  if (Object.keys(panier).length === 0) {
    return res.status(400).json({ error: 'Le panier est vide' });
  }

  const lineItemsStripe = [];
  const purchaseItems = [];

  try {
    // Parcourt le panier de session pour construire la commande Stripe
    for (const id in panier) {
      const prod = getProductById(id);
      const qte = panier[id];
      if (prod && qte > 0) {
        lineItemsStripe.push({
          price_data: {
            currency: 'cad',
            product_data: {
              name: prod.nom,
              description: prod.desc
            },
            unit_amount: Math.round(prod.prix * 100), // Montant requis en cents par l'API Stripe
          },
          quantity: qte,
        });

        // Enregistre les détails du produit acheté pour notre historique local de transaction
        purchaseItems.push({
          id: prod.id,
          nom: prod.nom,
          prix: prod.prix,
          quantity: qte
        });
      }
    }

    // Instanciation de l'instance sécurisée Embedded Checkout chez Stripe (mode embedded_page)
    const sessionStripe = await stripe.checkout.sessions.create({
      ui_mode: 'embedded_page',
      payment_method_types: ['card'],
      line_items: lineItemsStripe,
      mode: 'payment',
      shipping_address_collection: {
        allowed_countries: ['CA', 'US', 'FR'],
      },
      phone_number_collection: {
        enabled: true,
      },
      return_url: `http://localhost:${PORT}/checkout/succes?session_id={CHECKOUT_SESSION_ID}`,
    });

    // Enregistre la transaction en attente de paiement dans la base SQLite locale
    const totalAmount = lineItemsStripe.reduce((sum, item) => sum + (item.price_data.unit_amount * item.quantity), 0) / 100;
    addTransaction(sessionStripe.id, null, totalAmount, 'pending', purchaseItems);

    res.json({ clientSecret: sessionStripe.client_secret });
  } catch (erreur) {
    console.error('Erreur Stripe Checkout Session creation:', erreur);
    res.status(500).json({ error: erreur.message });
  }
});

// Redirection de succès de Stripe : vide le panier de session et renvoie vers la page de succès client
app.get('/checkout/succes', (req, res) => {
  const sessionId = req.query.session_id;
  req.session.panier = {}; // Vide le panier après l'achat initié
  res.redirect(`/?session_id=${sessionId}`);
});

// Récupère le statut finalisé de la session Stripe et met à jour SQLite si payé
app.get('/api/session-status', async (req, res) => {
  const sessionId = req.query.session_id;
  if (!sessionId) {
    return res.status(400).json({ error: 'session_id requis' });
  }

  try {
    const sessionStripe = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (sessionStripe.status === 'complete' && sessionStripe.payment_status === 'paid') {
      const email = sessionStripe.customer_details ? sessionStripe.customer_details.email : 'client@stripe.com';
      
      const shippingDetails = sessionStripe.shipping_details || 
        (sessionStripe.collected_information ? sessionStripe.collected_information.shipping_details : null);

      const shippingName = shippingDetails ? shippingDetails.name : null;
      let shippingAddress = null;
      if (shippingDetails && shippingDetails.address) {
        const addr = shippingDetails.address;
        const parts = [
          addr.line1,
          addr.line2,
          addr.city,
          addr.state,
          addr.postal_code,
          addr.country
        ].filter(Boolean);
        shippingAddress = parts.join(', ');
      }
      const phone = sessionStripe.customer_details ? sessionStripe.customer_details.phone : null;

      // Marque la transaction comme payée et renseigne l'email final de facturation et les coordonnées de livraison
      updateTransactionStatus(sessionId, 'paid', email, shippingName, shippingAddress, phone);
    }

    res.json({
      status: sessionStripe.status,
      payment_status: sessionStripe.payment_status
    });
  } catch (erreur) {
    console.error('Erreur récupération session Stripe:', erreur);
    res.status(500).json({ error: erreur.message });
  }
});

// ==========================================
// API D'ADMINISTRATION DES PRODUITS (Sécurisée)
// ==========================================

// Liste toutes les transactions de la boutique (Rôle minimum requis : admin ou read-only)
app.get('/api/admin/transactions', requireAuth(), (req, res) => {
  try {
    const transactions = getAllTransactions();
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ajoute un produit (Rôle requis : admin, gère l'upload binaire de l'image via Multer)
app.post('/api/admin/products', requireAuth('admin'), upload.single('image'), (req, res) => {
  const { id, nom, prix, desc } = req.body;
  if (!id || !nom || !prix) {
    return res.status(400).json({ error: 'Champs requis manquants: id, nom, prix' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'Une image est obligatoire pour créer un produit' });
  }

  try {
    const parsedPrix = parseFloat(prix);
    if (isNaN(parsedPrix)) {
      return res.status(400).json({ error: 'Le prix doit être un nombre valide' });
    }

    // Empêche la duplication d'identifiant unique
    const existing = getProductById(id);
    if (existing) {
      return res.status(400).json({ error: 'Un produit avec cet identifiant existe déjà' });
    }

    const imgPath = 'images/' + req.file.filename;

    addProduct(id, nom, parsedPrix, desc || '', imgPath);
    res.status(201).json({ success: true, product: { id, nom, prix: parsedPrix, desc, image: imgPath } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Modifie un produit (Rôle requis : admin, upload d'image optionnel)
app.put('/api/admin/products/:productId', requireAuth('admin'), upload.single('image'), (req, res) => {
  const { productId } = req.params;
  const { nom, prix, desc } = req.body;

  if (!nom || !prix) {
    return res.status(400).json({ error: 'Champs requis manquants: nom, prix' });
  }

  try {
    const parsedPrix = parseFloat(prix);
    if (isNaN(parsedPrix)) {
      return res.status(400).json({ error: 'Le prix doit être un nombre valide' });
    }

    const existing = getProductById(productId);
    if (!existing) {
      return res.status(404).json({ error: 'Produit introuvable' });
    }

    // Réutilise le chemin d'image existant si aucune nouvelle image n'est fournie
    let imgPath = existing.image;
    if (req.file) {
      imgPath = 'images/' + req.file.filename;
    }

    updateProduct(productId, nom, parsedPrix, desc || '', imgPath);
    res.json({ success: true, product: { id: productId, nom, prix: parsedPrix, desc, image: imgPath } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Supprime un produit (Rôle requis : admin)
app.delete('/api/admin/products/:productId', requireAuth('admin'), (req, res) => {
  const { productId } = req.params;

  try {
    const existing = getProductById(productId);
    if (!existing) {
      return res.status(404).json({ error: 'Produit introuvable' });
    }

    deleteProduct(productId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// API D'ADMINISTRATION DES UTILISATEURS (Sécurisée)
// ==========================================

// Liste tous les utilisateurs enregistrés
app.get('/api/admin/users', requireAuth('admin'), (req, res) => {
  try {
    const users = getAllUsers();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Crée un nouvel utilisateur
app.post('/api/admin/users', requireAuth('admin'), (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ error: 'Champs requis manquants: username, password, role' });
  }

  try {
    const existing = getUserByUsername(username);
    if (existing) {
      return res.status(400).json({ error: 'Cet identifiant est déjà utilisé' });
    }

    createUser(username, password, role);
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Supprime un utilisateur (Interdit de supprimer son propre compte en cours de session)
app.delete('/api/admin/users/:id', requireAuth('admin'), (req, res) => {
  const { id } = req.params;
  const targetId = parseInt(id);

  if (isNaN(targetId)) {
    return res.status(400).json({ error: 'ID invalide' });
  }

  if (targetId === req.session.userId) {
    return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte admin' });
  }

  try {
    deleteUser(targetId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Modifie un compte utilisateur (Interdit de s'auto-suspendre ou de s'auto-demotiver)
app.put('/api/admin/users/:id', requireAuth('admin'), (req, res) => {
  const { id } = req.params;
  const { username, role, status, password } = req.body;
  const targetId = parseInt(id);

  if (isNaN(targetId)) {
    return res.status(400).json({ error: 'ID invalide' });
  }

  if (!username || !role || !status) {
    return res.status(400).json({ error: 'Champs requis manquants: username, role, status' });
  }

  // Contrôles de sécurité pour éviter de se verrouiller soi-même hors du système
  if (targetId === req.session.userId) {
    if (status === 'blocked') {
      return res.status(400).json({ error: 'Vous ne pouvez pas bloquer votre propre compte admin' });
    }
    if (role !== 'admin') {
      return res.status(400).json({ error: 'Vous ne pouvez pas vous retirer vous-même le rôle admin' });
    }
  }

  try {
    const existing = getUserByUsername(username);
    if (existing && existing.id !== targetId) {
      return res.status(400).json({ error: 'Ce nom d\'utilisateur est déjà pris' });
    }

    updateUser(targetId, username, role, status, password);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Démarrage du serveur web d'écoute
app.listen(PORT, () => {
  console.log(`🛒 Boutique Express complète en ligne sur http://localhost:${PORT}`);
});