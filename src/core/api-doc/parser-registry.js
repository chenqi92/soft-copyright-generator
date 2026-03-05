/**
 * 解析器注册中心
 * 根据项目特征文件自动识别项目语言，调度对应解析器
 */

/**
 * 项目语言检测特征
 */
const PROJECT_SIGNATURES = [
    {
        id: 'spring-boot',
        label: 'Spring Boot (Java)',
        icon: '☕',
        markers: ['pom.xml', 'build.gradle', 'build.gradle.kts'],
        keywords: ['spring-boot', 'org.springframework'],
        sourceRoots: ['src/main/java'],
        sourceExt: '.java',
        ignorePatterns: ['**/src/test/**', '**/target/**', '**/build/**'],
    },
    {
        id: 'go',
        label: 'Go',
        icon: '🐹',
        markers: ['go.mod'],
        keywords: ['module'],
        sourceRoots: ['.'],
        sourceExt: '.go',
        ignorePatterns: ['**/vendor/**'],
    },
    {
        id: 'python',
        label: 'Python',
        icon: '🐍',
        markers: ['requirements.txt', 'pyproject.toml', 'setup.py', 'Pipfile'],
        keywords: ['fastapi', 'flask', 'django', 'starlette', 'sanic'],
        sourceRoots: ['.'],
        sourceExt: '.py',
        ignorePatterns: ['**/__pycache__/**', '**/venv/**', '**/.venv/**', '**/migrations/**'],
    },
    {
        id: 'rust',
        label: 'Rust',
        icon: '🦀',
        markers: ['Cargo.toml'],
        keywords: ['actix', 'axum', 'rocket', 'warp', 'tide'],
        sourceRoots: ['src'],
        sourceExt: '.rs',
        ignorePatterns: ['**/target/**'],
    },
]

/**
 * 检测项目语言
 * @param {string[]} fileList - 项目根目录下的文件名列表
 * @param {Object} fileContents - { filename: content } 特征文件内容（可选）
 * @returns {{ id: string, label: string, icon: string, sourceRoots: string[], sourceExt: string, ignorePatterns?: string[] } | null}
 */
export function detectProjectLanguage(fileList, fileContents = {}) {
    for (const sig of PROJECT_SIGNATURES) {
        const hasMarker = sig.markers.some(m => fileList.includes(m))
        if (!hasMarker) continue

        // 如果提供了文件内容，做二次验证
        if (sig.keywords.length > 0 && Object.keys(fileContents).length > 0) {
            const markerFile = sig.markers.find(m => fileContents[m])
            if (markerFile) {
                const content = fileContents[markerFile]
                const hasKeyword = sig.keywords.some(kw => content.toLowerCase().includes(kw.toLowerCase()))
                if (hasKeyword) {
                    return { id: sig.id, label: sig.label, icon: sig.icon, sourceRoots: sig.sourceRoots, sourceExt: sig.sourceExt, ignorePatterns: sig.ignorePatterns }
                }
            }
        }

        // 没有内容可验证时，仅凭特征文件匹配
        return { id: sig.id, label: sig.label, icon: sig.icon, sourceRoots: sig.sourceRoots, sourceExt: sig.sourceExt, ignorePatterns: sig.ignorePatterns }
    }
    return null
}

/**
 * 获取所有支持的项目类型
 */
export function getSupportedLanguages() {
    return PROJECT_SIGNATURES.map(s => ({ id: s.id, label: s.label, icon: s.icon }))
}

/**
 * 统一解析入口 — 根据语言 ID 动态调度对应解析器
 * @param {string} langId - 语言 ID (spring-boot/go/python/rust)
 * @param {Array<{name: string, relative_path: string, content: string}>} files - 源文件列表
 * @param {function} [onProgress] - 进度回调 (message: string, percent: number) => void
 * @returns {Promise<{ modules: Array }>}
 */
export async function parseProject(langId, files, onProgress) {
    switch (langId) {
        case 'spring-boot': {
            const { parseSpringBootProject } = await import('./spring-boot-parser.js')
            return parseSpringBootProject(files, onProgress)
        }
        case 'go': {
            const { parseGoProject } = await import('./go-parser.js')
            return parseGoProject(files, onProgress)
        }
        case 'python': {
            const { parsePythonProject } = await import('./python-parser.js')
            return parsePythonProject(files, onProgress)
        }
        case 'rust': {
            const { parseRustProject } = await import('./rust-parser.js')
            return parseRustProject(files, onProgress)
        }
        default:
            throw new Error(`不支持的项目类型: ${langId}`)
    }
}
