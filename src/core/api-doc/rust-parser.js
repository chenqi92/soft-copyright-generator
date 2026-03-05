/**
 * Rust 项目解析器
 * 支持 Actix-web / Axum / Rocket 框架
 * 提取宏注解路由、doc comment、struct 字段
 */

/**
 * 解析 Rust doc comment (/// 注释)
 */
function parseDocComment(lines, targetLineIdx) {
    const commentLines = []
    for (let i = targetLineIdx - 1; i >= 0; i--) {
        const line = lines[i].trim()
        if (line.startsWith('///')) {
            commentLines.unshift(line.replace(/^\/\/\/\s?/, ''))
        } else if (line.startsWith('#[') || line.startsWith('#![')) {
            // 属性宏，跳过继续往上找注释
            continue
        } else if (line === '') {
            break
        } else {
            break
        }
    }
    return commentLines
}

/**
 * Actix 路由属性宏: #[get("/path")], #[post("/path")] 等
 */
const ACTIX_ROUTE = /#\[(get|post|put|delete|patch|head)\s*\(\s*"([^"]+)"/
const ACTIX_ROUTE_METHOD = /#\[route\s*\(\s*"([^"]+)"\s*,\s*method\s*=\s*"(\w+)"/

/**
 * Rocket 路由: #[get("/path")], #[post("/path")]
 */
const ROCKET_ROUTE = /#\[(get|post|put|delete|patch|head)\s*\(\s*"([^"]+)"/

/**
 * 解析 Rust struct 字段
 */
function parseRustStruct(content) {
    const structs = new Map()
    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        // pub struct Name {
        const structMatch = line.match(/(?:pub\s+)?struct\s+(\w+)(?:<[^>]*>)?\s*\{/)
        if (!structMatch) continue

        const structName = structMatch[1]
        const fields = []
        let braceDepth = 1

        for (let j = i + 1; j < lines.length && braceDepth > 0; j++) {
            const fl = lines[j]
            const trimmed = fl.trim()

            for (const ch of trimmed) {
                if (ch === '{') braceDepth++
                if (ch === '}') braceDepth--
            }
            if (braceDepth <= 0) break

            // pub field_name: Type,
            const fieldMatch = trimmed.match(/^(?:pub\s+)?(\w+)\s*:\s*([^,]+)/)
            if (fieldMatch) {
                const fname = fieldMatch[1]
                const ftype = fieldMatch[2].trim().replace(/,$/, '')

                // 查找字段上方的 doc comment
                const docLines = parseDocComment(lines, j)
                const desc = docLines.join(' ')

                // 查找 serde rename
                let actualName = fname
                const renameMatch = lines.slice(Math.max(0, j - 3), j).join('\n').match(/#\[serde\(rename\s*=\s*"([^"]+)"\)/)
                if (renameMatch) actualName = renameMatch[1]

                const isOption = ftype.startsWith('Option<')
                fields.push({
                    name: actualName,
                    type: ftype.replace(/^Option<(.+)>$/, '$1'),
                    required: !isOption,
                    description: desc,
                })
            }
        }

        if (fields.length > 0) {
            structs.set(structName, { name: structName, fields })
        }
    }

    return structs
}

/**
 * 解析 Axum 路由 (Router::new().route("/path", get(handler)))
 */
function parseAxumRoutes(content) {
    const routes = []
    // .route("/path", get(handler))  .route("/path", post(handler).get(handler2))
    const routeRegex = /\.route\s*\(\s*"([^"]+)"\s*,\s*([\w\s().]+)\)/g
    let match

    while ((match = routeRegex.exec(content)) !== null) {
        const path = match[1]
        const handlers = match[2]

        // 提取 get(handler), post(handler) 等
        const methodRegex = /(get|post|put|delete|patch|head)\s*\(\s*(\w+)\s*\)/g
        let hm
        while ((hm = methodRegex.exec(handlers)) !== null) {
            routes.push({
                method: hm[1].toUpperCase(),
                path,
                handlerName: hm[2],
            })
        }
    }

    return routes
}

/**
 * 解析整个 Rust 项目
 * @param {Array<{name: string, relative_path: string, content: string}>} rsFiles
 * @param {function} [onProgress]
 * @returns {Promise<{ modules: Array }>}
 */
export async function parseRustProject(rsFiles, onProgress) {
    const modules = new Map()
    let totalApis = 0

    if (onProgress) onProgress('正在分析 Rust 代码结构...', 0)

    // Phase 1: 收集所有 struct
    const allStructs = new Map()
    for (const file of rsFiles) {
        const structs = parseRustStruct(file.content)
        for (const [name, def] of structs) {
            allStructs.set(name, def)
        }
    }

    if (onProgress) onProgress(`发现 ${allStructs.size} 个 struct 定义`, 20)

    // Phase 2: 扫描路由
    for (let fi = 0; fi < rsFiles.length; fi++) {
        const file = rsFiles[fi]
        const content = file.content
        const lines = content.split('\n')

        const moduleName = file.relative_path
            .replace(/\\/g, '/')
            .replace(/\.rs$/, '')
            .replace(/\//g, '::')
            .replace(/^\.+/, '') || file.name.replace('.rs', '')

        // 1. Actix/Rocket 属性宏路由
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim()

            let httpMethod = null
            let routePath = null

            // #[get("/path")] / #[post("/path")]
            const actixMatch = line.match(ACTIX_ROUTE)
            if (actixMatch) {
                httpMethod = actixMatch[1].toUpperCase()
                routePath = actixMatch[2]
            }

            // #[route("/path", method = "GET")]
            if (!httpMethod) {
                const routeMethodMatch = line.match(ACTIX_ROUTE_METHOD)
                if (routeMethodMatch) {
                    routePath = routeMethodMatch[1]
                    httpMethod = routeMethodMatch[2].toUpperCase()
                }
            }

            if (!httpMethod || !routePath) continue

            // 查找下一个 fn 声明
            let funcName = ''
            let funcLineIdx = -1
            for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
                const fl = lines[j].trim()
                if (fl.startsWith('#[')) continue  // 跳过其他属性
                const fnMatch = fl.match(/(?:pub\s+)?(?:async\s+)?fn\s+(\w+)\s*\(/)
                if (fnMatch) {
                    funcName = fnMatch[1]
                    funcLineIdx = j
                    break
                }
            }

            if (!funcName) continue

            // 提取 doc comment
            const docLines = parseDocComment(lines, i) // 注释在宏之前
            const summary = docLines[0] || funcName
            const description = docLines.length > 1 ? docLines.slice(1).join(' ') : ''

            if (!modules.has(moduleName)) {
                modules.set(moduleName, { name: moduleName, className: moduleName, apis: [] })
            }

            modules.get(moduleName).apis.push({
                method: httpMethod,
                path: routePath,
                summary,
                description,
                methodName: funcName,
                params: [],
                requestBody: null,
                response: null,
            })

            totalApis++
        }

        // 2. Axum Router 路由
        const axumRoutes = parseAxumRoutes(content)
        for (const route of axumRoutes) {
            // 查找 handler 函数
            const fnRegex = new RegExp(`(?:pub\\s+)?(?:async\\s+)?fn\\s+${route.handlerName}\\s*\\(`)
            const fnMatch = fnRegex.exec(content)

            let summary = route.handlerName
            let description = ''

            if (fnMatch) {
                const fnLineIdx = content.substring(0, fnMatch.index).split('\n').length - 1
                const docLines = parseDocComment(lines, fnLineIdx)
                if (docLines.length > 0) {
                    summary = docLines[0]
                    description = docLines.slice(1).join(' ')
                }
            }

            // 避免重复
            const existing = Array.from(modules.values())
                .flatMap(m => m.apis)
                .find(a => a.path === route.path && a.method === route.method)
            if (existing) continue

            if (!modules.has(moduleName)) {
                modules.set(moduleName, { name: moduleName, className: moduleName, apis: [] })
            }

            modules.get(moduleName).apis.push({
                method: route.method,
                path: route.path,
                summary,
                description,
                methodName: route.handlerName,
                params: [],
                requestBody: null,
                response: null,
            })

            totalApis++
        }

        if (onProgress && fi % 10 === 0) {
            onProgress(`扫描文件 ${fi + 1}/${rsFiles.length}...`, 20 + Math.round((fi / rsFiles.length) * 80))
        }
        await new Promise(r => setTimeout(r, 0))
    }

    if (onProgress) onProgress(`解析完成，发现 ${totalApis} 个接口`, 100)

    return { modules: Array.from(modules.values()).filter(m => m.apis.length > 0) }
}
