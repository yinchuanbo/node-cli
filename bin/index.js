#!/usr/bin/env node

const { program } = require('commander');
const { startServer } = require('../lib/server');
const { stagedCommand } = require('../lib/commands/staged');

let server;

program
    .command('staged')
    .description('View git staged and working files with a beautiful diff viewer')
    .option('-p, --path <path>', 'repository path', process.cwd())
    .action(async (options) => {
        // 启动服务器
        try {
            server = await startServer();
            await stagedCommand(options);
        } catch (error) {
            console.error('Error:', error.message);
        }
    });

program.parse(process.argv);

// 清理函数
function cleanup() {
    if (server) {
        server.close(() => {
            process.exit(0);
        });
    } else {
        process.exit(0);
    }
}

// 注册清理函数
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
