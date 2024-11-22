const express = require('express');
const { exec } = require('child_process');
const { getChangedFiles, getFileDiff, generateHTML } = require('./commands/staged');
const cors = require('cors');

const app = express();
app.use(cors());  
app.use(express.json());

app.post('/undo', (req, res) => {
    const { command, repoPath, file } = req.body;
    
    exec(command, { cwd: repoPath }, (error) => {
        if (error) {
            res.status(500).json({ error: error.message });
        } else {
            res.json({ success: true });
        }
    });
});

app.post('/stage', (req, res) => {
    const { repoPath, file } = req.body;
    
    exec(`git add "${file}"`, { cwd: repoPath }, (error) => {
        if (error) {
            res.status(500).json({ error: error.message });
        } else {
            res.json({ success: true });
        }
    });
});

app.post('/stage-all', (req, res) => {
    const { repoPath } = req.body;
    
    exec('git add .', { cwd: repoPath }, (error) => {
        if (error) {
            res.status(500).json({ error: error.message });
        } else {
            res.json({ success: true });
        }
    });
});

app.post('/undo-all-working', (req, res) => {
    const { repoPath } = req.body;
    
    exec('git checkout -- .', { cwd: repoPath }, (error) => {
        if (error) {
            res.status(500).json({ error: error.message });
        } else {
            res.json({ success: true });
        }
    });
});

app.post('/commit', (req, res) => {
    const { repoPath, type, message } = req.body;
    
    // First check if there are any working changes
    exec('git diff --name-only', { cwd: repoPath }, (error, stdout) => {
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        
        if (stdout.trim()) {
            return res.status(400).json({ error: 'There are unstaged changes. Please stage all changes before committing.' });
        }

        // If no working changes, proceed with commit
        const commitMessage = `${type}: ${message}`;
        exec(`git commit -m "${commitMessage}"`, { cwd: repoPath }, (error) => {
            if (error) {
                res.status(500).json({ error: error.message });
            } else {
                res.json({ success: true });
            }
        });
    });
});

app.get('/refresh', async (req, res) => {
    const { repoPath } = req.query;
    
    try {
        const { workingFiles, stagedFiles } = await getChangedFiles(repoPath);
        const workingFilesWithDiff = await Promise.all(workingFiles.map(file => getFileDiff(repoPath, file)));
        const stagedFilesWithDiff = await Promise.all(stagedFiles.map(file => getFileDiff(repoPath, file)));
        
        const html = generateHTML(workingFilesWithDiff, stagedFilesWithDiff, repoPath);
        res.send(html);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

function startServer(port = 6000) {
    return new Promise((resolve, reject) => {
        const server = app.listen(port, () => {
            console.log(`Server running on port ${port}`);
            resolve(server);
        }).on('error', reject);
    });
}

module.exports = { startServer };
