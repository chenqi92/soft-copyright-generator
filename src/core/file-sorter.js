/**
 * 智能文件排序器 - 确保代码开头是程序起始部分，结尾是程序结束部分
 *
 * 软著规范要求：
 *  - 代码开头必须是程序的起始部分（入口文件）
 *  - 代码结尾必须是程序的结束部分
 *
 * 排序策略：
 *  1. 入口文件（main, index, app）排最前
 *  2. 核心逻辑文件排第二
 *  3. 组件/服务居中
 *  4. 工具/辅助文件排后
 *  5. 配置/数据文件排末尾（非源代码）
 *  6. 测试文件排最末
 */

// 入口文件完整名（精确匹配，最高优先级）— 仅限源代码入口
const ENTRY_EXACT_NAMES = [
    'main.rs', 'main.go', 'main.py', 'main.c', 'main.cpp', 'main.java',
    'Main.java', 'Main.kt', 'App.java', 'Application.java',
    'main.js', 'main.ts', 'main.jsx', 'main.tsx',
    'index.js', 'index.ts', 'index.jsx', 'index.tsx',
    'index.html', 'index.htm',
    'App.vue', 'App.jsx', 'App.tsx', 'App.js', 'App.ts',
    'app.py', 'app.js', 'app.ts',
    'manage.py', 'wsgi.py', 'asgi.py',
    'server.js', 'server.ts', 'server.go',
    'Program.cs', 'Startup.cs',
    'lib.rs', 'mod.rs',
]

// 入口文件名（不含扩展名，模糊匹配）
const ENTRY_POINT_NAMES = [
    'main', 'index', 'app', 'application', 'program',
    'server', 'bootstrap', 'startup', 'init', 'entry',
]

// 非源代码的数据/配置扩展名 — 即使被用户选中，也应排到后面
const DATA_FILE_EXTS = [
    '.json', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf',
    '.xml', '.svg', '.csv', '.md', '.txt', '.log',
    '.lock', '.env',
]

// 测试文件模式（排最后）
const TEST_PATTERNS = [
    /\.test\.(js|ts|jsx|tsx|py)$/i,
    /\.spec\.(js|ts|jsx|tsx)$/i,
    /test_.*\.py$/i, /.*_test\.py$/i,
    /.*_test\.go$/i, /.*Test\.java$/i,
    /^tests?\//i, /^__tests__\//i, /^spec\//i,
]

/**
 * 标准化路径分隔符（兼容 Windows 反斜杠）
 */
function normalizePath(p) {
    return p.replace(/\\/g, '/')
}

/**
 * 计算文件排序权重（越小越前）
 */
function getFileSortWeight(rawRelativePath, fileName, ext) {
    const relativePath = normalizePath(rawRelativePath)
    const depth = relativePath.split('/').filter(Boolean).length - 1

    // 非源代码文件（JSON/YAML/XML 等） → 权重 850，接近末尾
    if (DATA_FILE_EXTS.includes(ext)) {
        return 850 + depth * 5
    }

    // 精确匹配入口文件 → 最高优先级
    if (ENTRY_EXACT_NAMES.includes(fileName)) {
        const idx = ENTRY_EXACT_NAMES.indexOf(fileName)
        return 0 + idx * 0.01 + depth * 0.001
    }

    // 入口文件名模式匹配
    const nameWithoutExt = fileName.replace(/\.[^.]+$/, '').toLowerCase()
    if (ENTRY_POINT_NAMES.includes(nameWithoutExt)) {
        return 100 + depth * 10
    }

    // 配置文件
    if (/^(vite|webpack|rollup|tsconfig|babel|next|nuxt|tailwind|postcss|jest|vitest)\.config/i.test(fileName) ||
        /config\.(js|ts)$/i.test(fileName) || /settings\.(py|js|ts)$/i.test(fileName)) {
        return 200
    }

    // 路由文件
    if (/router|routes|routing/i.test(fileName)) {
        return 300
    }

    // 布局/页面文件
    if (/layout|page|view/i.test(relativePath)) {
        return 400 + depth * 5
    }

    // 组件文件
    if (/component|widget|module/i.test(relativePath)) {
        return 500 + depth * 5
    }

    // 服务/API 文件
    if (/service|api|repository|dao|mapper/i.test(relativePath)) {
        return 600 + depth * 5
    }

    // 工具/辅助文件
    if (/util|helper|lib|common|shared|constant|enum|type/i.test(relativePath)) {
        return 700 + depth * 5
    }

    // 样式文件
    if (/\.(css|scss|sass|less|styl)$/i.test(fileName)) {
        return 800
    }

    // 测试文件（排最后）
    if (TEST_PATTERNS.some(p => p.test(fileName) || p.test(relativePath))) {
        return 900 + depth * 5
    }

    // 默认
    return 500 + depth * 5
}

/**
 * 智能排序文件列表
 * @param {Array} files - 文件列表，每个对象需包含 relative_path, name, ext
 * @returns {Array} 排序后的文件列表
 */
export function smartSortFiles(files) {
    return [...files].sort((a, b) => {
        const wa = getFileSortWeight(a.relative_path, a.name, a.ext)
        const wb = getFileSortWeight(b.relative_path, b.name, b.ext)
        if (wa !== wb) return wa - wb
        // 同权重按路径字母排序
        return normalizePath(a.relative_path).localeCompare(normalizePath(b.relative_path))
    })
}
