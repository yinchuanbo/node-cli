const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const open = require('open');
const os = require('os');
const { parse: parseDiff, html: diff2html } = require('diff2html');
const chalk = require('chalk');

// 获取变更文件列表
async function getChangedFiles(repoPath) {
    const workingFiles = await new Promise((resolve, reject) => {
        exec('git diff --name-status', { cwd: repoPath }, (error, stdout) => {
            if (error) reject(error);
            else {
                const files = stdout.trim().split('\n')
                    .filter(line => line)
                    .map(line => {
                        const [status, file] = line.split('\t');
                        return { status, file, staged: false };
                    });
                resolve(files);
            }
        });
    });

    const stagedFiles = await new Promise((resolve, reject) => {
        exec('git diff --staged --name-status', { cwd: repoPath }, (error, stdout) => {
            if (error) reject(error);
            else {
                const files = stdout.trim().split('\n')
                    .filter(line => line)
                    .map(line => {
                        const [status, file] = line.split('\t');
                        return { status, file, staged: true };
                    });
                resolve(files);
            }
        });
    });

    return { workingFiles, stagedFiles };
}

// 获取文件差异
async function getFileDiff(repoPath, fileInfo) {
    const command = fileInfo.staged ? 
        `git diff --staged -- "${fileInfo.file}"` :
        `git diff -- "${fileInfo.file}"`;

    const diff = await new Promise((resolve, reject) => {
        exec(command, { cwd: repoPath }, (error, stdout) => {
            if (error) reject(error);
            else resolve(stdout);
        });
    });

    return {
        ...fileInfo,
        diff
    };
}

// 生成HTML报告
function generateHTML(workingFiles, stagedFiles, repoPath) {
    const workingDiffs = workingFiles.map(file => {
        const diffHtml = diff2html(parseDiff(file.diff), {
            drawFileList: false,
            matching: 'lines',
            outputFormat: 'side-by-side'
        });
        return { ...file, diffHtml };
    });

    const stagedDiffs = stagedFiles.map(file => {
        const diffHtml = diff2html(parseDiff(file.diff), {
            drawFileList: false,
            matching: 'lines',
            outputFormat: 'side-by-side'
        });
        return { ...file, diffHtml };
    });

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Git Changes</title>
            <link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/npm/diff2html/bundles/css/diff2html.min.css">
            <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital@0;1&display=swap" rel="stylesheet">
            <style>
                body {
                    margin: 0;
                    padding: 20px;
                    font-family: 'JetBrains Mono', monospace;
                    background-color: #f8f9fa;
                    color: #212529;
                }
                .container {
                    max-width: 1200px;
                    margin: 0 auto;
                }
                .page-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 30px;
                    padding-bottom: 20px;
                    border-bottom: 2px solid #e9ecef;
                }
                .page-header h1 {
                    margin: 0;
                    font-size: 28px;
                    color: #2d3748;
                }
                .commit-button {
                    padding: 6px 12px;
                    border: none;
                    border-radius: 4px;
                    background-color: #28a745;
                    color: white;
                    cursor: pointer;
                    font-family: inherit;
                    font-size: 12px;
                    margin-top: 16px;
                    transition: background-color 0.2s;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .commit-button svg {
                    width: 20px;
                    height: 20px;
                }
                .commit-button:hover {
                    background-color: #218838;
                }
                .commit-button:disabled {
                    background-color: #6c757d;
                    cursor: not-allowed;
                }
                .modal {
                    display: none;
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: rgba(0, 0, 0, 0.5);
                    z-index: 1000;
                    backdrop-filter: blur(4px);
                }
                .modal-content {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background-color: white;
                    padding: 24px;
                    border-radius: 12px;
                    width: 400px;
                    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
                    animation: modalFadeIn 0.2s ease-out;
                    font-family: 'JetBrains Mono', monospace;
                }
                @keyframes modalFadeIn {
                    from {
                        opacity: 0;
                        transform: translate(-50%, -48%);
                    }
                    to {
                        opacity: 1;
                        transform: translate(-50%, -50%);
                    }
                }
                .modal-title {
                    margin: 0 0 24px 0;
                    font-size: 20px;
                    font-weight: 600;
                    color: #2d3748;
                }
                .form-group {
                    margin-bottom: 20px;
                }
                .form-group:last-of-type {
                    margin-bottom: 24px;
                }
                .form-group label {
                    display: block;
                    margin-bottom: 8px;
                    font-weight: 500;
                    color: #4a5568;
                    font-size: 14px;
                }
                .form-group select,
                .form-group input {
                    padding: 10px 12px;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 14px;
                    color: #2d3748;
                    background-color: #f8f9fa;
                    transition: all 0.2s;
                }
                .form-group input {
                    width: calc(100% - 24px);
                }
                .form-group select {
                    width: 100%;
                }
                .form-group select {
                    appearance: none;
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%234a5568' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
                    background-repeat: no-repeat;
                    background-position: right 12px center;
                    background-size: 16px;
                    padding-right: 40px;
                }
                .form-group select option {
                    padding: 8px;
                }
                .form-group input:focus,
                .form-group select:focus {
                    outline: none;
                    border-color: #0d6efd;
                    background-color: white;
                    box-shadow: 0 0 0 3px rgba(13, 110, 253, 0.1);
                }
                .form-group input::placeholder {
                    color: #a0aec0;
                }
                .modal-buttons {
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                }
                .modal-button {
                    padding: 10px 20px;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 14px;
                    font-weight: 500;
                    transition: all 0.2s;
                }
                .modal-button.primary {
                    background-color: #0d6efd;
                    color: white;
                }
                .modal-button.primary:hover:not(:disabled) {
                    background-color: #0b5ed7;
                    transform: translateY(-1px);
                }
                .modal-button.primary:active:not(:disabled) {
                    transform: translateY(0);
                }
                .modal-button.primary:disabled {
                    background-color: #e2e8f0;
                    color: #a0aec0;
                    cursor: not-allowed;
                    transform: none;
                }
                .modal-button.secondary {
                    background-color: #f8f9fa;
                    color: #4a5568;
                    border: 1px solid #e2e8f0;
                }
                .modal-button.secondary:hover {
                    background-color: #e9ecef;
                    border-color: #dee2e6;
                }
                .modal-button.secondary:active {
                    background-color: #dee2e6;
                }
                .section {
                    margin-bottom: 30px;
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
                    overflow: hidden;
                }
                .section-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 20px;
                    background-color: #f8f9fa;
                    border-bottom: 1px solid #e9ecef;
                }
                .section-title {
                    margin: 0;
                    font-size: 18px;
                    font-weight: 600;
                    color: #2d3748;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .section-title .count {
                    font-size: 14px;
                    color: #6c757d;
                    font-weight: normal;
                }
                .batch-button {
                    padding: 8px 16px;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-family: inherit;
                    font-size: 13px;
                    font-weight: 500;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .batch-button svg {
                    width: 14px;
                    height: 14px;
                    fill: currentColor;
                }
                .batch-button.stage-all {
                    background-color: #0d6efd;
                    color: white;
                }
                .batch-button.stage-all:hover:not(:disabled) {
                    background-color: #0b5ed7;
                    transform: translateY(-1px);
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .batch-button.undo-all {
                    background-color: #dc3545;
                    color: white;
                }
                .batch-button.undo-all:hover:not(:disabled) {
                    background-color: #bb2d3b;
                    transform: translateY(-1px);
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .batch-button:disabled {
                    background-color: #e9ecef;
                    color: #adb5bd;
                    cursor: not-allowed;
                    transform: none;
                    box-shadow: none;
                }
                .batch-button:active:not(:disabled) {
                    transform: translateY(0);
                }
                .stats {
                    display: flex;
                    gap: 20px;
                    padding: 15px 20px;
                    background-color: #f8f9fa;
                    border-bottom: 1px solid #e9ecef;
                }
                .stat-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 13px;
                    color: #6c757d;
                }
                .stat-item strong {
                    color: #2d3748;
                }
                .stat-item span {
                    background-color: #e9ecef;
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                }
                .file-list {
                    list-style: none;
                    margin: 0;
                    padding: 0;
                }
                .file-item {
                    border-bottom: 1px solid #e9ecef;
                }
                .file-header {
                    padding: 12px 20px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .file-header:hover {
                    background-color: #f8f9fa;
                }
                .file-number {
                    background-color: #6c757d;
                    color: white;
                    padding: 2px 8px;
                    border-radius: 12px;
                    font-size: 12px;
                    min-width: 24px;
                    display: inline-block;
                    text-align: center;
                    margin-right: 10px;
                }
                .file-name {
                    flex-grow: 1;
                    font-family: 'JetBrains Mono', monospace;
                    font-style: italic;
                }
                .file-status {
                    padding: 2px 8px;
                    border-radius: 12px;
                    font-size: 12px;
                    margin-left: auto;
                }
                .status-M { 
                    background-color: #ffc107;
                    color: #000;
                }
                .status-A { 
                    background-color: #28a745;
                    color: white;
                }
                .status-D { 
                    background-color: #dc3545;
                    color: white;
                }
                .diff-content {
                    display: none;
                    padding: 15px;
                    border-bottom: 1px solid #e9ecef;
                    background: #fafafa;
                }
                .diff-content.active {
                    display: block;
                }
                .d2h-wrapper {
                    margin: 0 !important;
                    font-family: 'JetBrains Mono', monospace !important;
                }
                .d2h-file-header {
                    display: none;
                }
                .d2h-code-line-ctn {
                    font-style: italic;
                }
                .d2h-code-line {
                    font-family: 'JetBrains Mono', monospace !important;
                }
                .d2h-code-side-line {
                    font-family: 'JetBrains Mono', monospace !important;
                }
                strong {
                    font-style: italic;
                }
                .undo-button {
                    padding: 4px 8px;
                    border: none;
                    border-radius: 4px;
                    background-color: #dc3545;
                    color: white;
                    cursor: pointer;
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 12px;
                    margin-left: 10px;
                    transition: background-color 0.2s;
                }
                .undo-button:hover {
                    background-color: #c82333;
                }
                .stage-button {
                    padding: 4px 8px;
                    border: none;
                    border-radius: 4px;
                    background-color: #17a2b8;
                    color: white;
                    cursor: pointer;
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 12px;
                    margin-left: 10px;
                    transition: background-color 0.2s;
                }
                .stage-button:hover {
                    background-color: #138496;
                }
                .loading {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(255, 255, 255, 0.8);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 1000;
                    font-size: 1.2em;
                    color: #2c3e50;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                .loading::after {
                    content: '';
                    width: 24px;
                    height: 24px;
                    border: 3px solid #2c3e50;
                    border-top: 3px solid transparent;
                    border-radius: 50%;
                    margin-left: 10px;
                    animation: spin 1s linear infinite;
                }
                #refreshButton {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    padding: 8px 16px;
                    background-color: #28a745;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 14px;
                    z-index: 1000;
                    display: flex;
                    align-items: center;
                    gap: 5px;
                }
                #refreshButton:hover {
                    background-color: #218838;
                }
                #refreshButton svg {
                    width: 16px;
                    height: 16px;
                    fill: currentColor;
                }
                .commit-button {
                    padding: 8px 16px;
                    border: none;
                    border-radius: 4px;
                    background-color: #28a745;
                    color: white;
                    cursor: pointer;
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 14px;
                    margin-top: 20px;
                    transition: background-color 0.2s;
                }
                .commit-button:hover {
                    background-color: #218838;
                }
                .commit-button:disabled {
                    background-color: #6c757d;
                    cursor: not-allowed;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="page-header">
                    <h1>Git Changes</h1>
                    <button id="commitButton" class="commit-button" onclick="openCommitModal()">
                        <svg viewBox="0 0 24 24">
                            <path fill="currentColor" d="M17,12C17,14.76 14.76,17 12,17C9.24,17 7,14.76 7,12C7,9.24 9.24,7 12,7C14.76,7 17,9.24 17,12M12,9C10.34,9 9,10.34 9,12C9,13.66 10.34,15 12,15C13.66,15 15,13.66 15,12C15,10.34 13.66,9 12,9M7,2H17L22,7V17L17,22H7L2,17V7L7,2M4,8V16L8,20H16L20,16V8L16,4H8L4,8Z"/>
                        </svg>
                        Commit Changes
                    </button>
                </div>
                <div class="section">
                    <div class="section-header">
                        <h2 class="section-title">
                            Staged Changes
                            <span class="count">(${stagedDiffs.length} files)</span>
                        </h2>
                        <button class="batch-button undo-all" onclick="undoAllWorkingChanges()" ${stagedDiffs.length === 0 ? 'disabled' : ''}>
                            <svg viewBox="0 0 24 24">
                                <path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/>
                            </svg>
                            Undo All Changes
                        </button>
                    </div>
                    <div class="stats">
                        <div class="stat-item">
                            <strong>Modified:</strong>
                            <span>${stagedDiffs.filter(f => f.status === 'M').length}</span>
                        </div>
                        <div class="stat-item">
                            <strong>Added:</strong>
                            <span>${stagedDiffs.filter(f => f.status === 'A').length}</span>
                        </div>
                        <div class="stat-item">
                            <strong>Deleted:</strong>
                            <span>${stagedDiffs.filter(f => f.status === 'D').length}</span>
                        </div>
                    </div>
                    <div class="file-list">
                        ${stagedDiffs.map((file, index) => `
                            <div class="file-item">
                                <div class="file-header" onclick="toggleDiff('staged-${index}')">
                                    <span class="file-number">#${index + 1}</span>
                                    <span class="file-name">${file.file}</span>
                                    <span class="file-status status-${file.status}">${
                                        file.status === 'M' ? 'Modified' :
                                        file.status === 'A' ? 'Added' :
                                        file.status === 'D' ? 'Deleted' : 'Unknown'
                                    }</span>
                                    <button class="undo-button" onclick="event.stopPropagation(); undoChanges('${file.file}', 'staged')">
                                        Undo Changes
                                    </button>
                                </div>
                                <div id="staged-${index}" class="diff-content">
                                    ${file.diffHtml}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="section">
                    <div class="section-header">
                        <h2 class="section-title">
                            Working Changes
                            <span class="count">(${workingDiffs.length} files)</span>
                        </h2>
                        <button class="batch-button stage-all" onclick="stageAllFiles()" ${workingDiffs.length === 0 ? 'disabled' : ''}>
                            <svg viewBox="0 0 24 24">
                                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                            </svg>
                            Stage All Changes
                        </button>
                    </div>
                    <div class="stats">
                        <div class="stat-item">
                            <strong>Modified:</strong>
                            <span>${workingDiffs.filter(f => f.status === 'M').length}</span>
                        </div>
                        <div class="stat-item">
                            <strong>Added:</strong>
                            <span>${workingDiffs.filter(f => f.status === 'A').length}</span>
                        </div>
                        <div class="stat-item">
                            <strong>Deleted:</strong>
                            <span>${workingDiffs.filter(f => f.status === 'D').length}</span>
                        </div>
                    </div>
                    <div class="file-list">
                        ${workingDiffs.map((file, index) => `
                            <div class="file-item">
                                <div class="file-header" onclick="toggleDiff('working-${index}')">
                                    <span class="file-number">#${index + 1}</span>
                                    <span class="file-name">${file.file}</span>
                                    <span class="file-status status-${file.status}">${
                                        file.status === 'M' ? 'Modified' :
                                        file.status === 'A' ? 'Added' :
                                        file.status === 'D' ? 'Deleted' : 'Unknown'
                                    }</span>
                                    <button class="undo-button" onclick="event.stopPropagation(); undoChanges('${file.file}', 'working')">
                                        Undo Changes
                                    </button>
                                    <button class="stage-button" onclick="event.stopPropagation(); stageFile('${file.file}')">
                                        Stage
                                    </button>
                                </div>
                                <div id="working-${index}" class="diff-content">
                                    ${file.diffHtml}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>

            <!-- Commit Modal -->
            <div id="commitModal" class="modal">
                <div class="modal-content">
                    <h2 class="modal-title">Create Commit</h2>
                    <div class="form-group">
                        <label for="commitType">Type</label>
                        <select id="commitType">
                            <option value="feat">feat - 新功能</option>
                            <option value="fix">fix - Bug修复</option>
                            <option value="docs">docs - 文档更新</option>
                            <option value="style">style - 代码格式</option>
                            <option value="refactor">refactor - 代码重构</option>
                            <option value="test">test - 测试相关</option>
                            <option value="chore">chore - 构建/工具</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="commitMessage">Message</label>
                        <input type="text" id="commitMessage" 
                               placeholder="输入提交信息..."
                               oninput="validateCommitForm()">
                    </div>
                    <div class="modal-buttons">
                        <button class="modal-button secondary" onclick="closeCommitModal()">取消</button>
                        <button id="createCommitButton" class="modal-button primary" 
                                onclick="createCommit()" disabled>创建提交</button>
                    </div>
                </div>
            </div>

            <script>
                // 使用固定的 repoPath
                const repoPath = 'D:/PROJECT/pc.makevideoclip.com';
                const serverUrl = 'http://localhost:3000';

                // 初始化 diff2html
                function initializeDiffToHtml() {
                    const diffElements = document.querySelectorAll('.d2h-wrapper');
                    diffElements.forEach(element => {
                        const diffContent = element.getAttribute('data-diff-content');
                        if (diffContent) {
                            const diff2html = new Diff2HtmlUI({
                                diff: diffContent
                            });
                            diff2html.draw();
                        }
                    });
                }

                // 添加文件点击事件监听器
                function addFileClickListeners() {
                    document.querySelectorAll('.file-header').forEach(header => {
                        header.onclick = function() {
                            const id = this.getAttribute('data-target');
                            toggleDiff(id);
                        };
                    });
                }

                // 创建刷新按钮
                const refreshButton = document.createElement('button');
                refreshButton.id = 'refreshButton';
                refreshButton.innerHTML = '<svg viewBox="0 0 24 24"><path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>';
                refreshButton.onclick = () => refreshContent(true);
                document.body.appendChild(refreshButton);

                // 刷新内容
                async function refreshContent(showLoading = false) {
                    let loading;
                    if (showLoading) {
                        loading = document.createElement('div');
                        loading.className = 'loading';
                        loading.textContent = 'Refreshing...';
                        document.body.appendChild(loading);
                    }

                    try {
                        const response = await fetch(serverUrl + '/refresh?repoPath=' + encodeURIComponent(repoPath));
                        if (!response.ok) {
                            throw new Error('Failed to refresh changes');
                        }
                        const html = await response.text();
                        
                        // 保存滚动位置
                        const scrollPos = {
                            x: window.scrollX,
                            y: window.scrollY
                        };
                        
                        // 更新内容
                        const parser = new DOMParser();
                        const newDoc = parser.parseFromString(html, 'text/html');
                        document.body.innerHTML = newDoc.body.innerHTML;
                        
                        // 恢复滚动位置
                        window.scrollTo(scrollPos.x, scrollPos.y);
                        
                        // 重新创建刷新按钮
                        const newRefreshButton = document.createElement('button');
                        newRefreshButton.id = 'refreshButton';
                        newRefreshButton.innerHTML = '<svg viewBox="0 0 24 24"><path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>';
                        newRefreshButton.onclick = () => refreshContent(true);
                        document.body.appendChild(newRefreshButton);

                        // 重新初始化事件监听器
                        initializeDiffToHtml();
                        addFileClickListeners();
                    } catch (error) {
                        console.error('Error refreshing:', error);
                        alert('Failed to refresh: ' + error.message);
                    } finally {
                        if (loading) {
                            loading.remove();
                        }
                    }
                }

                function toggleDiff(id) {
                    const content = document.getElementById(id);
                    if (content.classList.contains('active')) {
                        content.classList.remove('active');
                    } else {
                        content.classList.add('active');
                    }
                }

                async function undoChanges(file, area) {
                    const loading = document.createElement('div');
                    loading.className = 'loading';
                    loading.textContent = 'Undoing changes...';
                    document.body.appendChild(loading);

                    try {
                        const command = area === 'staged' ? 
                            'git reset HEAD ' + file :
                            'git checkout -- ' + file;

                        const response = await fetch(serverUrl + '/undo', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                command,
                                repoPath,
                                file
                            })
                        });

                        if (!response.ok) {
                            throw new Error('Failed to undo changes');
                        }

                        await refreshContent(false);
                    } catch (error) {
                        console.error('Error:', error);
                        alert('Failed to undo changes: ' + error.message);
                    } finally {
                        loading.remove();
                    }
                }

                async function stageFile(file) {
                    const loading = document.createElement('div');
                    loading.className = 'loading';
                    loading.textContent = 'Staging file...';
                    document.body.appendChild(loading);

                    try {
                        const response = await fetch(serverUrl + '/stage', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                repoPath,
                                file
                            })
                        });

                        if (!response.ok) {
                            throw new Error('Failed to stage file');
                        }

                        await refreshContent(false);
                    } catch (error) {
                        console.error('Error:', error);
                        alert('Failed to stage file: ' + error.message);
                    } finally {
                        loading.remove();
                    }
                }

                async function stageAllFiles() {
                    if (!confirm('Are you sure you want to stage all changes?')) {
                        return;
                    }

                    const loading = document.createElement('div');
                    loading.className = 'loading';
                    loading.textContent = 'Staging all changes...';
                    document.body.appendChild(loading);

                    try {
                        const response = await fetch(serverUrl + '/stage-all', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                repoPath
                            })
                        });

                        if (!response.ok) {
                            throw new Error('Failed to stage changes');
                        }

                        await refreshContent(false);
                    } catch (error) {
                        console.error('Error:', error);
                        alert('Failed to stage changes: ' + error.message);
                    } finally {
                        loading.remove();
                    }
                }

                async function undoAllWorkingChanges() {
                    if (!confirm('Are you sure you want to undo all working changes? This cannot be undone!')) {
                        return;
                    }

                    const loading = document.createElement('div');
                    loading.className = 'loading';
                    loading.textContent = 'Undoing all changes...';
                    document.body.appendChild(loading);

                    try {
                        const response = await fetch(serverUrl + '/undo-all-working', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                repoPath
                            })
                        });

                        if (!response.ok) {
                            throw new Error('Failed to undo changes');
                        }

                        await refreshContent(false);
                    } catch (error) {
                        console.error('Error:', error);
                        alert('Failed to undo changes: ' + error.message);
                    } finally {
                        loading.remove();
                    }
                }

                // Commit Modal Functions
                function openCommitModal() {
                    // Get all elements with class 'working-file'
                    const workingFiles = document.querySelectorAll('.working-file');
                    
                    // Check if there are any working changes
                    if (workingFiles.length > 0) {
                        alert('Please stage all working changes before committing.');
                        return;
                    }
                    
                    // If no working changes, show the modal
                    document.getElementById('commitModal').style.display = 'block';
                    document.getElementById('commitMessage').value = '';
                    validateCommitForm();
                }

                function closeCommitModal() {
                    document.getElementById('commitModal').style.display = 'none';
                }

                function validateCommitForm() {
                    const message = document.getElementById('commitMessage').value.trim();
                    document.getElementById('createCommitButton').disabled = !message;
                }

                async function createCommit() {
                    const type = document.getElementById('commitType').value;
                    const message = document.getElementById('commitMessage').value.trim();
                    
                    const loading = document.createElement('div');
                    loading.className = 'loading';
                    loading.textContent = 'Creating commit...';
                    document.body.appendChild(loading);

                    try {
                        const response = await fetch(serverUrl + '/commit', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                repoPath,
                                type,
                                message
                            })
                        });

                        if (!response.ok) {
                            const data = await response.json();
                            throw new Error(data.error || 'Failed to create commit');
                        }

                        closeCommitModal();
                        await refreshContent(false);
                    } catch (error) {
                        console.error('Error:', error);
                        alert(error.message);
                    } finally {
                        loading.remove();
                    }
                }

                // Close modal when clicking outside
                window.onclick = function(event) {
                    const modal = document.getElementById('commitModal');
                    if (event.target === modal) {
                        closeCommitModal();
                    }
                }

                // 初始化页面
                initializeDiffToHtml();
                addFileClickListeners();

                // 页面加载完成后自动刷新
                window.addEventListener('load', () => {
                    refreshContent(true);
                });
            </script>
        </body>
        </html>
    `;
}

async function stagedCommand(options) {
    try {
        const repoPath = options.path || process.cwd();
        console.log('Checking repository at:', repoPath);

        // 获取所有变更文件
        const { workingFiles, stagedFiles } = await getChangedFiles(repoPath);

        // 获取每个文件的详细差异
        const workingFilesWithDiff = await Promise.all(workingFiles.map(file => getFileDiff(repoPath, file)));
        const stagedFilesWithDiff = await Promise.all(stagedFiles.map(file => getFileDiff(repoPath, file)));

        // 生成HTML报告
        const html = generateHTML(workingFilesWithDiff, stagedFilesWithDiff, repoPath);

        // 保存HTML文件
        const tempFile = path.join(os.tmpdir(), 'git-changes.html');
        fs.writeFileSync(tempFile, html);

        // 在浏览器中打开
        open(tempFile);
    } catch (error) {
        console.error('Error:', error.message);
    }
}

module.exports = {
    stagedCommand,
    getChangedFiles,
    getFileDiff,
    generateHTML
};
