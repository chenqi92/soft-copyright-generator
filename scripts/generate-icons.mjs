/**
 * 图标生成脚本
 *
 * 从 logo.svg 生成:
 *  - icon-win.png  — 1024x1024, 无内边距 (Windows)
 *  - icon-mac.png  — 1024x1024, 带 ~15% 内边距 (macOS)
 *  - icon.png      — 通用 1024x1024 (Tauri 默认)
 */
import sharp from 'sharp'
import { readFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SVG_PATH = join(ROOT, 'src', 'assets', 'logo.svg')
const ICONS_DIR = join(ROOT, 'src-tauri', 'icons')

const SIZE = 1024
// macOS 图标内边距比例 (每边约 15%)
const MAC_PADDING_RATIO = 0.15

async function generateWindowsIcon() {
    const svgBuf = readFileSync(SVG_PATH)

    // Windows: 满铺，无内边距
    const winPng = await sharp(svgBuf, { density: 400 })
        .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer()

    const outPath = join(ICONS_DIR, 'icon-win.png')
    await sharp(winPng).toFile(outPath)
    console.log(`✅ Windows icon: ${outPath}`)
    return outPath
}

async function generateMacIcon() {
    const svgBuf = readFileSync(SVG_PATH)

    const padding = Math.round(SIZE * MAC_PADDING_RATIO)
    const innerSize = SIZE - padding * 2 // 内容区域大小

    // 1. 先将 SVG 渲染到内容区域大小
    const innerPng = await sharp(svgBuf, { density: 400 })
        .resize(innerSize, innerSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer()

    // 2. 放到透明画布中央（添加内边距）
    const macPng = await sharp({
        create: {
            width: SIZE,
            height: SIZE,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
    })
        .composite([{ input: innerPng, left: padding, top: padding }])
        .png()
        .toFile(join(ICONS_DIR, 'icon-mac.png'))

    console.log(`✅ macOS icon: ${join(ICONS_DIR, 'icon-mac.png')}`)
}

async function generateGenericIcon() {
    const svgBuf = readFileSync(SVG_PATH)

    // 通用：无内边距（和 Windows 一样，作为 Tauri 默认 icon.png）
    await sharp(svgBuf, { density: 400 })
        .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toFile(join(ICONS_DIR, 'icon.png'))

    console.log(`✅ Generic icon: ${join(ICONS_DIR, 'icon.png')}`)
}

async function main() {
    console.log('🎨 Generating icons from SVG...\n')

    mkdirSync(ICONS_DIR, { recursive: true })

    await generateWindowsIcon()
    await generateMacIcon()
    await generateGenericIcon()

    console.log('\n🎉 All icons generated! Run `npx tauri icon` next to generate platform-specific formats.')
}

main().catch(console.error)
