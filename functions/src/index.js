import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { onRequest } from 'firebase-functions/v2/https';
import functions from 'firebase-functions';
import { initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { participants } from './config/participants.js';

// Firebase Admin
initializeApp();
const db = getFirestore();

// Config (env ou runtime config do Firebase)
const runtimeConfig = (functions && typeof functions.config === 'function') ? functions.config() : {};
const appConfig = (runtimeConfig && runtimeConfig.app) ? runtimeConfig.app : {};

const JWT_SECRET = process.env.JWT_SECRET || appConfig.jwt_secret || 'dev-secret-override-me';
let USERS_JSON = {};
try {
    const usersRaw = process.env.USERS_JSON || appConfig.users_json || '{}';
    USERS_JSON = JSON.parse(usersRaw);
} catch (e) {
    USERS_JSON = {};
}

// Helpers
function signToken(username) {
    return jwt.sign({ sub: username }, JWT_SECRET, { expiresIn: '1d' });
}

function verifyToken(token) {
    return jwt.verify(token, JWT_SECRET);
}

function requireAuth(req, res, next) {
    const header = req.headers['authorization'] || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Não autorizado' });
    try {
        const payload = verifyToken(token);
        req.user = { username: payload.sub };
        next();
    } catch (e) {
        return res.status(401).json({ error: 'Token inválido ou expirado' });
    }
}

// Derangement utils
function shuffle(array) {
    const a = array.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function generateDerangement(items) {
    // Gera uma permutação sem pontos fixos; tenta até encontrar
    // Como lista é pequena, tentativa simples é ok
    for (let attempt = 0; attempt < 10000; attempt++) {
        const perm = shuffle(items);
        let ok = true;
        for (let i = 0; i < items.length; i++) {
            if (perm[i] === items[i]) { ok = false; break; }
        }
        if (ok) {
            const map = {};
            for (let i = 0; i < items.length; i++) {
                map[items[i]] = perm[i];
            }
            return map;
        }
    }
    throw new Error('Falha ao gerar derangement');
}

async function getOrCreateConfig() {
    const cfgRef = db.collection('secretsanta').doc('config');
    const snap = await cfgRef.get();
    if (snap.exists) return snap.data();
    const createdAt = new Date().toISOString();
    const mapping = generateDerangement(participants);
    const cfg = { createdAt, participants, mapping, version: 1 };
    await cfgRef.set(cfg);
    return cfg;
}

// Express app
const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Health
app.get('/', (_req, res) => res.json({ ok: true }));

// Auth
app.post('/login', async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Credenciais inválidas' });
    const normalized = username.toString().trim();
    const expected = USERS_JSON[normalized];
    if (!expected || expected !== password) {
        return res.status(401).json({ error: 'Usuário ou senha inválidos' });
    }
    if (!participants.includes(normalized)) {
        return res.status(400).json({ error: 'Usuário não está na lista de participantes' });
    }
    const token = signToken(normalized);
    res.json({ token });
});

// Me
app.get('/me', requireAuth, async (req, res) => {
    const username = req.user.username;
    const docRef = db.collection('secretsanta').doc('assignments').collection('byUser').doc(username);
    const snap = await docRef.get();
    const data = snap.exists ? snap.data() : null;
    res.json({ username, assignedTo: data?.assignedTo || null, assignedAt: data?.assignedAt || null });
});

// Draw
app.post('/draw', requireAuth, async (req, res) => {
    const username = req.user.username;
    const cfg = await getOrCreateConfig();
    const assignCol = db.collection('secretsanta').doc('assignments').collection('byUser');
    const reverseCol = db.collection('secretsanta').doc('assignments').collection('takenByTarget');

    // Idempotência: se já existe, retorna
    const myRef = assignCol.doc(username);
    const mySnap = await myRef.get();
    if (mySnap.exists) {
        const data = mySnap.data();
        return res.json({ assignedTo: data.assignedTo, assignedAt: data.assignedAt });
    }

    // Transação para garantir exclusividade de alvo
    try {
        const result = await db.runTransaction(async (tx) => {
            const target = cfg.mapping[username];
            if (!target) throw new Error('Configuração inválida para este usuário');

            const targetRef = reverseCol.doc(target);
            const targetSnap = await tx.get(targetRef);
            if (targetSnap.exists) {
                // Alvo já foi tomado — isso não deve acontecer com derangement+idempotência, mas checamos
                throw new Error('Alvo já foi sorteado por outra pessoa');
            }

            const assignedAt = new Date().toISOString();
            const metadata = {
                ip: req.headers['x-forwarded-for'] || req.ip || null,
                userAgent: req.headers['user-agent'] || null
            };

            tx.set(myRef, { assignedTo: target, assignedAt, metadata });
            tx.set(targetRef, { takenBy: username, assignedAt });
            return { assignedTo: target, assignedAt };
        });
        return res.json(result);
    } catch (e) {
        return res.status(409).json({ error: e.message || 'Conflito ao sortear' });
    }
});

// Status (agregado, sem expor pares)
app.get('/status', async (_req, res) => {
    const cfg = await getOrCreateConfig();
    const assignCol = db.collection('secretsanta').doc('assignments').collection('byUser');
    const snaps = await assignCol.get();
    const total = cfg.participants.length;
    const done = snaps.size;
    res.json({ total, done, remaining: total - done, createdAt: cfg.createdAt });
});

export const api = onRequest({ region: 'southamerica-east1', cors: true }, app);


