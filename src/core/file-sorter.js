/**
 * 智能文件排序器 - 确保代码开头是程序起始部分，结尾是程序结束部分
 *
 * 软著规范要求：
 *  - 代码开头必须是程序的起始部分（入口文件）
 *  - 代码结尾必须是程序的结束部分
 *
 * 排序策略：
 *  1. 入口文件（main, index, app）排最前
 *  2. 配置文件排第二
 *  3. 核心逻辑文件居中
 *  4. 工具/辅助文件排后
 *  5. 测试文件排最末
 */

// 入口文件名（优先级从高到低）
const ENTRY_POINT_NAMES = [
    'main', 'index', 'app', 'application', 'program',
    'server', 'bootstrap', 'startup', 'init', 'entry',
]

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

// 配置文件名模式
const CONFIG_PATTERNS = [
    /^vite\.config/, /^webpack\.config/, /^rollup\.config/,
    /^tsconfig/, /^babel\.config/, /^\.env/,
    /^next\.config/, /^nuxt\.config/,
    /^tailwind\.config/, /^postcss\.config/,
    /^jest\.config/, /^vitest\.config/,
    /config\.(js|ts|json|yaml|yml)$/i,
    /settings\.(py|js|ts)$/i,
]

// 测试文件模式（排最后）
const TEST_PATTERNS = [
    /\.test\.(js|ts|jsx|tsx)$/i,
    /\.spec\.(js|ts|jsx|tsx)$/i,
    /test_.*\.py$/i, /.*_test\.py$/i,
    /.*_test\.go$/i, /.*Test\.java$/i,
    /^tests?\//i, /^__tests__\//i, /^spec\//i,
]

/**
 * 计算文件排序权重（越小越前）
 */
function getFileSortWeight(relativePath, fileName) {
    // 0: 精确匹配的入口文件
    if (ENTRY_EXACT_NAMES.includes(fileName)) {
        const idx = ENTRY_EXACT_NAMES.indexOf(fileName)
        return 0 + idx * 0.01 // 按定义顺序细分
    }

    // 1: 根目录下的入口文件名
    const nameWithoutExt = fileName.replace(/\.[^.]+$/, '').toLowerCase()
    const depth = relativePath.split('/').length - 1

    if (ENTRY_POINT_NAMES.includes(nameWithoutExt)) {
        return 100 + depth * 10 // 目录越浅，优先级越高
    }

    // 2: 配置文件
    if (CONFIG_PATTERNS.some(p => p.test(fileName) || p.test(relativePath))) {
        return 200
    }

    // 3: 路由文件
    if (/router|routes|routing/i.test(fileName)) {
        return 300
    }

    // 4: 布局/页面文件
    if (/layout|page|view/i.test(relativePath)) {
        return 400 + depth * 5
    }

    // 5: 组件文件
    if (/component|widget|module/i.test(relativePath)) {
        return 500 + depth * 5
    }

    // 6: 服务/API文件
    if (/service|api|repository|dao|mapper/i.test(relativePath)) {
        return 600 + depth * 5
    }

    // 7: 工具/辅助文件
    if (/util|helper|lib|common|shared|constant|enum|type/i.test(relativePath)) {
        return 700 + depth * 5
    }

    // 8: 样式文件
    if (/\.(css|scss|sass|less|styl)$/i.test(fileName)) {
        return 800
    }

    // 9: 测试文件（排最后）
    if (TEST_PATTERNS.some(p => p.test(fileName) || p.test(relativePath))) {
        return 900 + depth * 5
    }

    // 默认：按目录深度排序
    return 500 + depth * 5
}

/**
 * 智能排序文件列表
 * @param {Array} files - 文件列表，每个对象需包含 relative_path 和 name
 * @returns {Array} 排序后的文件列表
 */
export function smartSortFiles(files) {
    return [...files].sort((a, b) => {
        const wa = getFileSortWeight(a.relative_path, a.name)
        const wb = getFileSortWeight(b.relative_path, b.name)
        if (wa !== wb) return wa - wb
        // 同权重按路径字母排序
        return a.relative_path.localeCompare(b.relative_path)
    })
}
