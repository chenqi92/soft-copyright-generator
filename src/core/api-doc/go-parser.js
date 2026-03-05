/**
 * Go 项目解析器
 * 支持 Gin / Echo / net/http 框架
 * 支持 swaggo 注释 和 普通函数注释
 */

import { PLACEHOLDER_PREFIX, PLACEHOLDER_SUFFIX } from './spring-boot-parser.js'

function makePlaceholder(type, context) {
    return `${PLACEHOLDER_PREFIX}${type}-${context}${PLACEHOLDER_SUFFIX}`
}

/**
 * 路由注册模式
 */
const ROUTE_PATTERNS = [
    // Gin: r.GET("/path", handler)  group.POST("/path", handler)
    /\.(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s*\(\s*"([^"]+)"\s*,\s*(\w[\w.]*)/g,
    // Echo: e.GET("/path", handler)
    /\.(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s*\(\s*"([^"]+)"\s*,\s*(\w[\w.]*)/g,
    // http.HandleFunc / Handle
    /(?:HandleFunc|Handle)\s*\(\s*"([^"]+)"\s*,\s*(\w[\w.]*)/g,
]

/**
 * 解析 Go 函数上方的注释（支持 swaggo 和普通注释）
 */
function parseGoComment(content, funcStartIdx) {
    const before = content.substring(0, funcStartIdx)
    const lines = before.split('\n')

    // 从函数声明向上收集连续的注释行
    const commentLines = []
    for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim()
        if (line.startsWith('//')) {
            commentLines.unshift(line.replace(/^\/\/\s?/, ''))
        } else if (line === '') {
            // 允许一个空行
            if (i > 0 && lines[i - 1].trim().startsWith('//')) continue
            break
        } else {
            break
        }
    }

    const result = {
        summary: '',
        description: '',
        params: [],
        returnDoc: '',
        tags: [],
    }

    // 解析 swaggo 风格注释
    let hasSwaggo = false
    const plainLines = []

    for (const line of commentLines) {
        if (line.startsWith('@Summary ')) {
            result.summary = line.substring(9).trim()
            hasSwaggo = true
        } else if (line.startsWith('@Description ')) {
            result.description = line.substring(13).trim()
            hasSwaggo = true
        } else if (line.startsWith('@Param ')) {
            // @Param name  paramType  dataType  required  "comment"
            const parts = line.substring(7).trim().split(/\s+/)
            if (parts.length >= 3) {
                const descMatch = line.match(/"([^"]*)"/)
                result.params.push({
                    name: parts[0],
                    in: parts[1] || 'query',
                    type: parts[2] || 'string',
                    required: parts[3] === 'true',
                    description: descMatch ? descMatch[1] : '',
                })
            }
            hasSwaggo = true
        } else if (line.startsWith('@Success ') || line.startsWith('@Failure ')) {
            hasSwaggo = true
        } else if (line.startsWith('@Tags ')) {
            result.tags = line.substring(6).trim().split(',').map(s => s.trim())
            hasSwaggo = true
        } else if (line.startsWith('@Router ')) {
            hasSwaggo = true
        } else {
            plainLines.push(line)
        }
    }

    // 如果没有 swaggo 注释，用普通注释作为 summary
    if (!hasSwaggo && plainLines.length > 0) {
        result.summary = plainLines[0]
        if (plainLines.length > 1) {
            result.description = plainLines.slice(1).join(' ')
        }
    } else if (!result.summary && plainLines.length > 0) {
        result.summary = plainLines[0]
    }

    return result
}

/**
 * 解析 Go struct 的字段
 */
function parseGoStruct(content) {
    const structs = new Map()
    const structRegex = /type\s+(\w+)\s+struct\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g
    let match

    while ((match = structRegex.exec(content)) !== null) {
        const structName = match[1]
        const body = match[2]
        const fields = []

        const lines = body.split('\n')
        for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*')) continue

            // fieldName Type `json:"name" ...`
            const fieldMatch = trimmed.match(/^(\w+)\s+([\w.*[\]]+)\s*(?:`([^`]*)`)?/)
            if (fieldMatch) {
                const fieldName = fieldMatch[1]
                const fieldType = fieldMatch[2]
                const tags = fieldMatch[3] || ''

                // JSON tag
                const jsonTag = tags.match(/json:"([^"]*)"/)
                const jsonName = jsonTag ? jsonTag[1].split(',')[0] : fieldName

                // 行尾注释
                const commentMatch = trimmed.match(/\/\/\s*(.+)$/)
                const description = commentMatch ? commentMatch[1].trim() : ''

                if (jsonName !== '-') {
                    fields.push({
                        name: jsonName,
                        type: fieldType,
                        required: !tags.includes('omitempty'),
                        description,
                    })
                }
            }
        }

        structs.set(structName, { name: structName, fields })
    }

    return structs
}

/**
 * 解析函数参数
 */
function parseGoFuncParams(content, funcName) {
    const regex = new RegExp(`func\\s+(?:\\([^)]*\\)\\s+)?${funcName}\\s*\\(([^)]*)\\)`)
    const match = content.match(regex)
    if (!match) return []

    const paramStr = match[1]
    if (!paramStr.trim()) return []

    const params = []
    const parts = paramStr.split(',')
    for (const part of parts) {
        const trimmed = part.trim()
        // name Type or name, name2 Type
        const pm = trimmed.match(/(\w+)\s+([\w.*[\]]+)/)
        if (pm) {
            // 跳过 context 参数
            if (pm[2].includes('Context') || pm[2].includes('context') ||
                pm[2] === 'http.ResponseWriter' || pm[2] === '*http.Request') continue

            params.push({
                name: pm[1],
                type: pm[2],
                required: true,
                description: '',
            })
        }
    }
    return params
}

/**
 * 解析整个 Go 项目
 * @param {Array<{name: string, relative_path: string, content: string}>} goFiles
 * @param {function} [onProgress]
 * @returns {Promise<{ modules: Array }>}
 */
export async function parseGoProject(goFiles, onProgress) {
    const modules = new Map()
    const allStructs = new Map()

    if (onProgress) onProgress('正在分析 Go 代码结构...', 0)

    // Phase 1: 收集所有 struct
    for (const file of goFiles) {
        const structs = parseGoStruct(file.content)
        for (const [name, def] of structs) {
            allStructs.set(name, def)
        }
    }

    if (onProgress) onProgress(`发现 ${allStructs.size} 个 struct 定义`, 20)

    // Phase 2: 扫描路由注册和 handler 函数
    let totalApis = 0
    for (let fi = 0; fi < goFiles.length; fi++) {
        const file = goFiles[fi]
        const content = file.content

        // 提取包名作为模块名
        const pkgMatch = content.match(/^package\s+(\w+)/m)
        const packageName = pkgMatch ? pkgMatch[1] : 'main'

        // 查找路由注册
        const routeRegex = /\.(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s*\(\s*"([^"]+)"\s*,\s*([\w.]+)/g
        let routeMatch

        while ((routeMatch = routeRegex.exec(content)) !== null) {
            const httpMethod = routeMatch[1]
            const path = routeMatch[2]
            const handlerRef = routeMatch[3]
            const handlerName = handlerRef.split('.').pop()

            // 查找 handler 函数定义及其注释
            const funcRegex = new RegExp(`func\\s+(?:\\([^)]*\\)\\s+)?${handlerName}\\s*\\(`, 'g')
            let funcMatch = funcRegex.exec(content)

            // 也在其他文件中搜索
            let handlerContent = content
            if (!funcMatch) {
                for (const f of goFiles) {
                    funcMatch = new RegExp(`func\\s+(?:\\([^)]*\\)\\s+)?${handlerName}\\s*\\(`).exec(f.content)
                    if (funcMatch) {
                        handlerContent = f.content
                        break
                    }
                }
            }

            const comment = funcMatch
                ? parseGoComment(handlerContent, funcMatch.index)
                : { summary: handlerName, description: '', params: [], tags: [] }

            const summary = comment.summary || handlerName
            const moduleName = comment.tags.length > 0 ? comment.tags[0] : packageName

            if (!modules.has(moduleName)) {
                modules.set(moduleName, {
                    name: moduleName,
                    className: moduleName,
                    apis: [],
                })
            }

            // 合并 swaggo params 和函数参数
            const params = comment.params.length > 0
                ? comment.params.map(p => ({
                    name: p.name,
                    type: p.type,
                    required: p.required,
                    description: p.description || makePlaceholder('参数描述', p.name),
                    in: p.in,
                }))
                : []

            modules.get(moduleName).apis.push({
                method: httpMethod,
                path,
                summary,
                description: comment.description || '',
                methodName: handlerName,
                params,
                requestBody: null,
                response: null,
            })

            totalApis++
        }

        // 也搜索 swaggo @Router 注释中的路由
        const funcDecls = content.matchAll(/func\s+(?:\([^)]*\)\s+)?(\w+)\s*\(/g)
        for (const decl of funcDecls) {
            const funcName = decl[1]
            const comment = parseGoComment(content, decl.index)

            // 检查是否有 @Router 注释
            const routerLine = content.substring(Math.max(0, decl.index - 2000), decl.index)
            const routerMatch = routerLine.match(/@Router\s+(\S+)\s+\[(\w+)\]/i)
            if (!routerMatch) continue

            const routerPath = routerMatch[1]
            const routerMethod = routerMatch[2].toUpperCase()

            // 避免重复
            const existingApi = Array.from(modules.values())
                .flatMap(m => m.apis)
                .find(a => a.path === routerPath && a.method === routerMethod)
            if (existingApi) continue

            const moduleName = comment.tags.length > 0 ? comment.tags[0] : packageName

            if (!modules.has(moduleName)) {
                modules.set(moduleName, { name: moduleName, className: moduleName, apis: [] })
            }

            modules.get(moduleName).apis.push({
                method: routerMethod,
                path: routerPath,
                summary: comment.summary || funcName,
                description: comment.description || '',
                methodName: funcName,
                params: comment.params.map(p => ({
                    name: p.name, type: p.type, required: p.required,
                    description: p.description || '', in: p.in,
                })),
                requestBody: null,
                response: null,
            })

            totalApis++
        }

        if (onProgress && fi % 20 === 0) {
            onProgress(`扫描文件 ${fi + 1}/${goFiles.length}...`, 20 + Math.round((fi / goFiles.length) * 80))
        }
        await new Promise(r => setTimeout(r, 0))
    }

    if (onProgress) onProgress(`解析完成，发现 ${totalApis} 个接口`, 100)

    return { modules: Array.from(modules.values()).filter(m => m.apis.length > 0) }
}
