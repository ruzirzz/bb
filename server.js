// Simpan sebagai server.js
const express = require('express');
const app = express();
const cors = require('cors');

app.use(cors());
app.use(express.json());
// Menyajikan file HTML statis (pastikan file index.html ada di folder 'public')
app.use(express.static('public')); 

const GITHUB_API_URL = `https://api.github.com/repos/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/contents/${process.env.GITHUB_PATH}`;
const HEADERS = {
    'Authorization': `token ${process.env.GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'NodeJS-Railway-App'
};

// Endpoint untuk mengambil data tp.lua dari GitHub
app.get('/api/github', async (req, res) => {
    try {
        const response = await fetch(GITHUB_API_URL, { headers: HEADERS });
        if (!response.ok) throw new Error('Gagal mengambil data dari GitHub');
        
        const data = await response.json();
        // Decode dari base64
        const content = Buffer.from(data.content, 'base64').toString('utf-8');
        res.json({ content, sha: data.sha });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint untuk melakukan commit / save ke GitHub
app.post('/api/github', async (req, res) => {
    try {
        const { content, sha, message } = req.body;
        // Encode kembali ke base64
        const encodedContent = Buffer.from(content, 'utf-8').toString('base64');
        
        const response = await fetch(GITHUB_API_URL, {
            method: 'PUT',
            headers: HEADERS,
            body: JSON.stringify({
                message: message,
                content: encodedContent,
                sha: sha
            })
        });

        if (!response.ok) throw new Error('Gagal menyimpan ke GitHub');
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server berjalan di port ${PORT}`));
