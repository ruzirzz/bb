const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

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

// Endpoint untuk MENYIMPAN data (Commit)
app.post('/api/github', async (req, res) => {
    try {
        const { content, sha, message } = req.body;
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
            throw new Error(`GitHub API Error (${response.status}): ${errText}`);
        }
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server berjalan di port ${PORT}`));
