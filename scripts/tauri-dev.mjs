/**
 * 自动端口检测的 Tauri 开发启动脚本
 *
 * 功能：
 * 1. 从 51420 开始探测可用端口（最多尝试 100 个）
 * 2. 通过 VITE_PORT 环境变量传递给 vite.config.js
 * 3. 通过 TAURI_CLI_CONFIG 环境变量动态覆盖 Tauri 的 devUrl
 */
import net from 'net'
import { spawn } from 'child_process'

const BASE_PORT = 51420

async function isPortFree(port) {
    return new Promise((resolve) => {
        const server = net.createServer()
        server.once('error', () => resolve(false))
        server.once('listening', () => {
            server.close()
            resolve(true)
        })
        server.listen(port, '127.0.0.1')
    })
}

async function findFreePort(start, maxAttempts = 100) {
    for (let i = 0; i < maxAttempts; i++) {
        const port = start + i
        if (await isPortFree(port)) return port
    }
    throw new Error(`无法在 ${start}-${start + maxAttempts} 范围内找到可用端口`)
}

const port = await findFreePort(BASE_PORT)
console.log(`\x1b[32m✓\x1b[0m 使用端口: ${port}${port !== BASE_PORT ? ` (默认端口 ${BASE_PORT} 已被占用)` : ''}`)

const env = {
    ...process.env,
    VITE_PORT: String(port),
    TAURI_CLI_CONFIG: JSON.stringify({
        build: { devUrl: `http://localhost:${port}` }
    }),
}

const child = spawn('npx', ['tauri', 'dev'], {
    env,
    stdio: 'inherit',
    shell: true,
    cwd: process.cwd(),
})

child.on('exit', (code) => process.exit(code ?? 0))
