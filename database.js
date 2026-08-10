// database.js
// Ce module gère la connexion à la base de données locale SQLite via 'better-sqlite3'
// ainsi que les opérations de lecture/écriture (CRUD) pour les produits, transactions et utilisateurs.

import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';

// Chemin absolu vers le fichier de base de données SQLite
const dbPath = path.resolve('boutique.db');
const db = new Database(dbPath);

/**
 * Hache un mot de passe en utilisant un sel unique généré aléatoirement
 * et l'algorithme standard PBKDF2 de Node.js.
 * @param {string} password - Le mot de passe en clair.
 * @returns {object} Un objet contenant le sel généré et le mot de passe haché (hex).
 */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

/**
 * Vérifie si le mot de passe fourni correspond au hachage stocké en base de données.
 * @param {string} password - Le mot de passe saisi.
 * @param {string} salt - Le sel associé à l'utilisateur.
 * @param {string} hash - Le hachage enregistré.
 * @returns {boolean} True si le mot de passe est correct, false sinon.
 */
export function verifyPassword(password, salt, hash) {
  const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return verifyHash === hash;
}

/**
 * Initialise le schéma de la base de données (tables) et injecte les données de base (seed)
 * si les tables correspondantes sont vides lors du premier démarrage.
 */
export function dbInit() {
  // 1. Table des produits en vente
  db.prepare(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      nom TEXT NOT NULL,
      prix REAL NOT NULL,
      desc TEXT,
      image TEXT
    )
  `).run();

  // 2. Table des transactions Stripe
  db.prepare(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      email TEXT,
      amount REAL NOT NULL,
      status TEXT NOT NULL,
      items TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // Migration de la table transactions : s'assure que les colonnes de livraison sont présentes
  try {
    db.prepare(`ALTER TABLE transactions ADD COLUMN shipping_name TEXT`).run();
  } catch (e) {}
  try {
    db.prepare(`ALTER TABLE transactions ADD COLUMN shipping_address TEXT`).run();
  } catch (e) {}
  try {
    db.prepare(`ALTER TABLE transactions ADD COLUMN phone TEXT`).run();
  } catch (e) {}

  // 3. Table des utilisateurs (Accès Administration)
  db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      status TEXT NOT NULL DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // Migration de sécurité : s'assure que la colonne 'status' est présente si la table existait déjà.
  try {
    db.prepare(`ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'`).run();
  } catch (e) {
    // La colonne existe déjà, on ignore l'erreur
  }

  // Insertion de produits de test par défaut si le catalogue est vide
  const count = db.prepare('SELECT COUNT(*) as count FROM products').get();
  if (count.count === 0) {
    const seedProducts = [
      { 
        id: "ccm-b45", 
        nom: "Bâton de hockey CCM B45", 
        prix: 125.00, 
        desc: "Bâton en composite ultra-léger pour joueur senior avec manche renforcé.", 
        image: "images/stick.jpg" 
      },
      { 
        id: "casque-tacks", 
        nom: "Casque CCM Tacks", 
        prix: 85.00, 
        desc: "Protection maximale avec mousse multi-densité et grille de protection en acier.", 
        image: "images/helmet.jpg" 
      },
      { 
        id: "patins-jetspeed", 
        nom: "Patins JetSpeed", 
        prix: 350.00, 
        desc: "Conçus pour une accélération maximale avec lame en acier inoxydable poli.", 
        image: "images/skates.jpg" 
      }
    ];

    const insert = db.prepare(`
      INSERT INTO products (id, nom, prix, desc, image) 
      VALUES (@id, @nom, @prix, @desc, @image)
    `);

    // Utilisation d'une transaction SQLite pour une insertion rapide
    const insertMany = db.transaction((prods) => {
      for (const prod of prods) insert.run(prod);
    });

    insertMany(seedProducts);
    console.log('📦 Base de données initialisée et produits de test insérés.');
  } else {
    console.log('📦 Base de données SQLite connectée.');
  }

  // Création du compte administrateur initial si aucun utilisateur n'existe
  const usersCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (usersCount.count === 0) {
    const { salt, hash } = hashPassword('admin');
    db.prepare(`
      INSERT INTO users (username, password_hash, salt, role)
      VALUES (?, ?, ?, 'admin')
    `).run('admin', hash, salt);
    console.log('👤 Compte administrateur par défaut créé : admin / admin');
  }
}

// ==========================================
// GESTION DU CATALOGUE (PRODUITS)
// ==========================================

// Récupère tous les produits de la boutique
export function getAllProducts() {
  return db.prepare('SELECT * FROM products').all();
}

// Récupère un produit par son identifiant unique (slug)
export function getProductById(id) {
  return db.prepare('SELECT * FROM products WHERE id = ?').get(id);
}

// Insère un nouveau produit
export function addProduct(id, nom, prix, desc, image) {
  return db.prepare(`
    INSERT INTO products (id, nom, prix, desc, image) 
    VALUES (?, ?, ?, ?, ?)
  `).run(id, nom, prix, desc, image);
}

// Modifie les attributs d'un produit existant
export function updateProduct(id, nom, prix, desc, image) {
  return db.prepare(`
    UPDATE products 
    SET nom = ?, prix = ?, desc = ?, image = ?
    WHERE id = ?
  `).run(nom, prix, desc, image, id);
}

// Supprime un produit du catalogue
export function deleteProduct(id) {
  return db.prepare('DELETE FROM products WHERE id = ?').run(id);
}

// ==========================================
// GESTION DES TRANSACTIONS (STRIPE)
// ==========================================

// Ajoute une nouvelle transaction en statut 'pending'
export function addTransaction(id, email, amount, status, items) {
  return db.prepare(`
    INSERT INTO transactions (id, email, amount, status, items) 
    VALUES (?, ?, ?, ?, ?)
  `).run(id, email, amount, status, JSON.stringify(items));
}

// Liste toutes les transactions Stripe de la plus récente à la plus ancienne
export function getAllTransactions() {
  return db.prepare('SELECT * FROM transactions ORDER BY created_at DESC').all();
}

// Met à jour le statut d'une transaction (ex: 'paid' après succès de paiement) et associe l'email, le nom, l'adresse de livraison et le téléphone
export function updateTransactionStatus(id, status, email, shippingName, shippingAddress, phone) {
  return db.prepare(`
    UPDATE transactions 
    SET status = ?, email = ?, shipping_name = ?, shipping_address = ?, phone = ?
    WHERE id = ?
  `).run(status, email, shippingName, shippingAddress, phone, id);
}

// ==========================================
// GESTION DES UTILISATEURS (ADMINISTRATION)
// ==========================================

// Trouve un utilisateur par son nom d'utilisateur (pour la connexion)
export function getUserByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

// Liste tous les comptes enregistrés sans divulguer le hash ou le sel
export function getAllUsers() {
  return db.prepare('SELECT id, username, role, status, created_at FROM users').all();
}

// Trouve un utilisateur par son identifiant unique
export function getUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

// Enregistre un nouvel utilisateur
export function createUser(username, password, role) {
  const { salt, hash } = hashPassword(password);
  return db.prepare(`
    INSERT INTO users (username, password_hash, salt, role, status)
    VALUES (?, ?, ?, ?, 'active')
  `).run(username, hash, salt, role);
}

// Modifie un compte utilisateur (avec modification optionnelle du mot de passe)
export function updateUser(id, username, role, status, password) {
  if (password && password.trim() !== '') {
    const { salt, hash } = hashPassword(password);
    return db.prepare(`
      UPDATE users 
      SET username = ?, role = ?, status = ?, password_hash = ?, salt = ?
      WHERE id = ?
    `).run(username, role, status, hash, salt, id);
  } else {
    return db.prepare(`
      UPDATE users 
      SET username = ?, role = ?, status = ?
      WHERE id = ?
    `).run(username, role, status, id);
  }
}

// Supprime définitivement un compte utilisateur
export function deleteUser(id) {
  return db.prepare('DELETE FROM users WHERE id = ?').run(id);
}
