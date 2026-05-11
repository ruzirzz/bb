const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// --- Rate Limiting ---
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 menit
    max: 100, // max 100 request per IP per 15 menit
    message: { error: 'Terlalu banyak request. Coba lagi dalam 15 menit.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const writeLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 menit
    max: 20, // max 20 write per IP per 5 menit
    message: { error: 'Terlalu banyak operasi tulis. Coba lagi nanti.' },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use('/api/', apiLimiter);
app.use('/api/github', writeLimiter); // POST only gets extra limit via middleware order

// --- Request Logging ---
app.use('/api/', (req, res, next) => {
    const timestamp = new Date().toISOString();
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.log(`[${timestamp}] ${req.method} ${req.path} - IP: ${ip}`);
    next();
});

// --- Middleware Autentikasi ---
const API_KEY = process.env.API_KEY;

function authMiddleware(req, res, next) {
    if (!API_KEY) return next(); // Kalau API_KEY belum di-set, skip (dev mode)
    const key = req.headers['x-api-key'] || req.query.key;
    if (key !== API_KEY) {
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        console.warn(`[AUTH DENIED] IP: ${ip} - Invalid API key attempt`);
        return res.status(401).json({ error: 'Unauthorized: API key tidak valid.' });
    }
    next();
}

// Proteksi endpoint yang mengubah data (POST)
app.post('/api/*', authMiddleware);

// Endpoint untuk MENGAMBIL data (Load Database)
app.get('/api/github', async (req, res) => {
    try {
        const url = `https://api.github.com/repos/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/contents/${process.env.GITHUB_PATH}`;
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `token ${process.env.GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Railway-Node-App'
            }
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`GitHub API Error (${response.status}): ${errText}`);
        }
        
        const data = await response.json();
        const content = Buffer.from(data.content, 'base64').toString('utf-8');
        res.json({ content, sha: data.sha });
    } catch (error) {
        console.error("GET Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// --- Validasi CFrame format ---
function validateCFrameContent(content) {
    const cframes = content.match(/CFrame\.new\([^)]+\)/g);
    if (!cframes) return { valid: true };
    for (const cf of cframes) {
        const inner = cf.replace('CFrame.new(', '').replace(')', '');
        const parts = inner.split(',').map(s => s.trim());
        if (parts.length < 3 || parts.length > 12) {
            return { valid: false, reason: `CFrame invalid (${parts.length} params): ${cf.substring(0, 60)}...` };
        }
        for (const p of parts) {
            if (isNaN(Number(p))) {
                return { valid: false, reason: `Parameter bukan angka "${p}" di: ${cf.substring(0, 60)}...` };
            }
        }
    }
    return { valid: true };
}

// Endpoint untuk MENYIMPAN data (Commit)
app.post('/api/github', async (req, res) => {
    try {
        const { content, sha, message } = req.body;

        // Validasi format CFrame sebelum commit
        const validation = validateCFrameContent(content);
        if (!validation.valid) {
            return res.status(400).json({ error: `Validasi gagal: ${validation.reason}` });
        }

        const url = `https://api.github.com/repos/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/contents/${process.env.GITHUB_PATH}`;
        const encodedContent = Buffer.from(content, 'utf-8').toString('base64');
        
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${process.env.GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Railway-Node-App'
            },
            body: JSON.stringify({
                message: message,
                content: encodedContent,
                sha: sha
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            // SHA conflict detection
            if (response.status === 409) {
                return res.status(409).json({ 
                    error: 'Conflict: Data sudah diubah oleh orang lain. Silakan refresh dan coba lagi.',
                    conflict: true
                });
            }
            throw new Error(`GitHub API Error (${response.status}): ${errText}`);
        }

        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        console.log(`[COMMIT] IP: ${ip} - ${message}`);
        res.json({ success: true });
    } catch (error) {
        console.error("POST Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint untuk daftar semua map (autocomplete)
app.get('/api/allmaps', (req, res) => {
    try {
        const data = fs.readFileSync(path.join(__dirname, 'allmaps.txt'), 'utf-8');
        const maps = data.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        res.json(maps);
    } catch (err) {
        console.error('AllMaps Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Endpoint export/download tp.lua
app.get('/api/export', async (req, res) => {
    try {
        const url = `https://api.github.com/repos/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/contents/${process.env.GITHUB_PATH}`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `token ${process.env.GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Railway-Node-App'
            }
        });
        if (!response.ok) throw new Error('GitHub API error');
        const data = await response.json();
        const content = Buffer.from(data.content, 'base64').toString('utf-8');
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', 'attachment; filename="tp.lua"');
        res.send(content);
    } catch (err) {
        console.error('Export Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});

// Last update endpoint (last commit date for tp.lua)
app.get('/api/lastupdate', async (req, res) => {
    try {
        const url = `https://api.github.com/repos/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/commits?path=${process.env.GITHUB_PATH}&per_page=1`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `token ${process.env.GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Railway-Node-App'
            }
        });
        if (!response.ok) throw new Error('GitHub API error');
        const commits = await response.json();
        if (commits.length > 0) {
            res.json({
                date: commits[0].commit.committer.date,
                message: commits[0].commit.message,
                author: commits[0].commit.committer.name
            });
        } else {
            res.json({ date: null, message: null });
        }
    } catch (err) {
        console.error('LastUpdate Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- Graceful Shutdown ---
const server = app.listen(process.env.PORT || 3000, () => {
    console.log(`Server berjalan di port ${process.env.PORT || 3000}`);
});

process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        console.log('Server closed.');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received. Shutting down...');
    server.close(() => process.exit(0));
});
