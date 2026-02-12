/**
 * 版本发布脚本
 *
 * 用法：
 *   node scripts/bump-version.mjs patch    # 0.1.0 → 0.1.1
 *   node scripts/bump-version.mjs minor    # 0.1.0 → 0.2.0
 *   node scripts/bump-version.mjs major    # 0.1.0 → 1.0.0
 *   node scripts/bump-version.mjs 1.2.3    # 直接指定版本号
 *
 * 更新以下文件的版本号：
 *   - package.json
 *   - src-tauri/tauri.conf.json
 *   - src-tauri/Cargo.toml
 *
 * 然后自动 git commit + push，触发 CI 构建发布。
 */
import fs from 'fs'
import { execSync } from 'child_process'

const FILES = {
    PACKAGE: 'package.json',
    TAURI: 'src-tauri/tauri.conf.json',
    CARGO: 'src-tauri/Cargo.toml',
}

function readJSON(path) {
    return JSON.parse(fs.readFileSync(path, 'utf8'))
}

function writeJSON(path, data) {
    fs.writeFileSync(path, JSON.stringify(data, null, 2) + '\n')
}

function bumpVersion(current, type) {
    const [major, minor, patch] = current.split('.').map(Number)
    switch (type) {
        case 'major': return `${major + 1}.0.0`
        case 'minor': return `${major}.${minor + 1}.0`
        case 'patch': return `${major}.${minor}.${patch + 1}`
        default:
            // 直接指定版本号
            if (/^\d+\.\d+\.\d+$/.test(type)) return type
            console.error(`❌ 无效参数: ${type}`)
            console.error('用法: node scripts/bump-version.mjs [patch|minor|major|x.y.z]')
            process.exit(1)
    }
}

// ========== 主流程 ==========
const arg = process.argv[2]
if (!arg) {
    console.error('用法: node scripts/bump-version.mjs [patch|minor|major|x.y.z]')
    process.exit(1)
}

const pkg = readJSON(FILES.PACKAGE)
const oldVersion = pkg.version
const newVersion = bumpVersion(oldVersion, arg)

console.log(`\n📦 版本更新: ${oldVersion} → ${newVersion}\n`)

// 1. 更新 package.json
pkg.version = newVersion
writeJSON(FILES.PACKAGE, pkg)
console.log(`  ✅ ${FILES.PACKAGE}`)

// 2. 更新 tauri.conf.json
const tauri = readJSON(FILES.TAURI)
tauri.version = newVersion
writeJSON(FILES.TAURI, tauri)
console.log(`  ✅ ${FILES.TAURI}`)

// 3. 更新 Cargo.toml
let cargo = fs.readFileSync(FILES.CARGO, 'utf8')
cargo = cargo.replace(/^version = ".*"/m, `version = "${newVersion}"`)
fs.writeFileSync(FILES.CARGO, cargo)
console.log(`  ✅ ${FILES.CARGO}`)

// 4. Git commit + push
console.log(`\n🚀 提交并推送...\n`)
try {
    execSync('git add -A', { stdio: 'inherit' })
    execSync(`git commit -m "release: v${newVersion}"`, { stdio: 'inherit' })
    execSync('git push origin main', { stdio: 'inherit' })
    console.log(`\n✅ 已推送 v${newVersion}，CI 将自动创建 tag 并构建发布\n`)
} catch (e) {
    console.error('\n⚠️ Git 操作失败，请手动提交推送：')
    console.error(`  git add -A && git commit -m "release: v${newVersion}" && git push origin main\n`)
}
