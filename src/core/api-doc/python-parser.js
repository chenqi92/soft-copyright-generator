/**
 * Python 项目解析器
 * 支持 FastAPI / Flask / Django REST 框架
 * 提取装饰器路由、docstring、type hint
 */

/**
 * 路由装饰器模式
 */
const FASTAPI_DECORATORS = /^\s*@(?:app|router|api_router)\.(get|post|put|delete|patch|head|options)\s*\(\s*["']([^"']+)["']/
const FLASK_DECORATORS = /^\s*@(?:app|bp|blueprint)\.(route|get|post|put|delete|patch)\s*\(\s*["']([^"']+)["']/
const FLASK_METHODS_PATTERN = /methods\s*=\s*\[([^\]]+)\]/

/**
 * 提取 Python 函数的 docstring
 */
function extractDocstring(lines, funcLineIdx) {
    // 从函数定义行之后查找 docstring
    for (let i = funcLineIdx + 1; i < Math.min(funcLineIdx + 5, lines.length); i++) {
        const trimmed = lines[i].trim()
        if (trimmed === '') continue
        if (trimmed.startsWith('"""') || trimmed.startsWith("'''")) {
            const quote = trimmed.substring(0, 3)
            // 单行 docstring
            if (trimmed.endsWith(quote) && trimmed.length > 6) {
                return trimmed.slice(3, -3).trim()
            }
            // 多行 docstring
            const docLines = [trimmed.slice(3)]
            for (let j = i + 1; j < Math.min(i + 30, lines.length); j++) {
                const dl = lines[j].trim()
                if (dl.endsWith(quote) || dl.includes(quote)) {
                    const endIdx = dl.indexOf(quote)
                    if (endIdx >= 0) docLines.push(dl.substring(0, endIdx))
                    return docLines.join('\n').trim()
                }
                docLines.push(dl)
            }
        }
        break // 非 docstring 则退出
    }
    return ''
}

/**
 * 提取函数上方的注释行
 */
function extractPythonComment(lines, funcLineIdx) {
    const commentLines = []
    for (let i = funcLineIdx - 1; i >= 0; i--) {
        const line = lines[i].trim()
        if (line.startsWith('#')) {
            commentLines.unshift(line.replace(/^#\s*/, ''))
        } else if (line === '') {
            if (i > 0 && lines[i - 1].trim().startsWith('#')) continue
            break
        } else {
            break
        }
    }
    return commentLines.join(' ')
}

/**
 * 解析 Python 函数参数（简单 type hint 提取）
 */
function parsePythonParams(paramStr) {
    const params = []
    if (!paramStr || !paramStr.trim()) return params

    const parts = paramStr.split(',')
    for (const part of parts) {
        const trimmed = part.trim()
        if (!trimmed) continue

        // 跳过 self, request, db 等常见框架参数
        if (/^(self|cls|request|response|db|session|current_user|background_tasks)$/.test(trimmed.split(/[:\s=]/)[0].trim())) continue

        // name: Type = default
        const match = trimmed.match(/^(\w+)\s*(?::\s*([\w\[\], |.]+))?\s*(?:=\s*(.+))?$/)
        if (match) {
            const name = match[1]
            const type = match[2] || 'any'
            const hasDefault = !!match[3]

            // 跳过依赖注入参数 Depends(...)
            if (match[3] && match[3].includes('Depends')) continue

            params.push({
                name,
                type: type.replace(/Optional\[(.+)\]/, '$1'),
                required: !hasDefault && !type.includes('Optional'),
                description: '',
            })
        }
    }
    return params
}

/**
 * 解析 Pydantic model / dataclass
 */
function parsePythonModels(content) {
    const models = new Map()
    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        // class MyModel(BaseModel): or @dataclass
        const classMatch = line.match(/^class\s+(\w+)\s*\(.*(?:BaseModel|Schema|Serializer).*\)\s*:/)
        if (!classMatch) continue

        const className = classMatch[1]
        const fields = []
        const indent = line.match(/^(\s*)/)[1].length

        for (let j = i + 1; j < lines.length; j++) {
            const fieldLine = lines[j]
            const fieldTrimmed = fieldLine.trim()

            // 空行或减少缩进 → 类结束
            if (fieldTrimmed && !fieldLine.startsWith(' '.repeat(indent + 1)) && !fieldLine.startsWith('\t')) break
            if (!fieldTrimmed || fieldTrimmed.startsWith('#') || fieldTrimmed.startsWith('class ') ||
                fieldTrimmed.startsWith('def ') || fieldTrimmed.startsWith('@')) {
                if (fieldTrimmed.startsWith('class ') || (fieldTrimmed.startsWith('def ') && !fieldTrimmed.startsWith('def __'))) break
                continue
            }

            // field_name: Type = Field(...)  or  field_name: Type
            const fieldMatch = fieldTrimmed.match(/^(\w+)\s*:\s*([\w\[\], |.]+)/)
            if (fieldMatch) {
                const fname = fieldMatch[1]
                const ftype = fieldMatch[2]

                // 从 Field(description="...") 或行尾注释提取描述
                let desc = ''
                const fieldDescMatch = fieldTrimmed.match(/description\s*=\s*["']([^"']+)["']/)
                if (fieldDescMatch) desc = fieldDescMatch[1]

                const commentMatch = fieldTrimmed.match(/#\s*(.+)$/)
                if (!desc && commentMatch) desc = commentMatch[1]

                fields.push({ name: fname, type: ftype, required: !ftype.includes('Optional'), description: desc })
            }
        }

        if (fields.length > 0) {
            models.set(className, { name: className, fields })
        }
    }

    return models
}

/**
 * 解析整个 Python 项目
 * @param {Array<{name: string, relative_path: string, content: string}>} pyFiles
 * @param {function} [onProgress]
 * @returns {Promise<{ modules: Array }>}
 */
export async function parsePythonProject(pyFiles, onProgress) {
    const modules = new Map()
    let totalApis = 0

    if (onProgress) onProgress('正在分析 Python 代码结构...', 0)

    for (let fi = 0; fi < pyFiles.length; fi++) {
        const file = pyFiles[fi]
        const content = file.content
        const lines = content.split('\n')

        // 提取模块名
        const moduleName = file.relative_path
            .replace(/\\/g, '/')
            .replace(/\.py$/, '')
            .replace(/\//g, '.')
            .replace(/^\.+/, '') || file.name.replace('.py', '')

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i]
            let httpMethod = null
            let routePath = null
            let isFlask = false

            // FastAPI 路由
            const fastapiMatch = line.match(FASTAPI_DECORATORS)
            if (fastapiMatch) {
                httpMethod = fastapiMatch[1].toUpperCase()
                routePath = fastapiMatch[2]
            }

            // Flask 路由
            if (!httpMethod) {
                const flaskMatch = line.match(FLASK_DECORATORS)
                if (flaskMatch) {
                    isFlask = true
                    routePath = flaskMatch[2]
                    if (flaskMatch[1] === 'route') {
                        // 从 methods=[] 提取
                        const methodsMatch = line.match(FLASK_METHODS_PATTERN)
                        httpMethod = methodsMatch
                            ? methodsMatch[1].replace(/["'\s]/g, '').split(',')[0].toUpperCase()
                            : 'GET'
                    } else {
                        httpMethod = flaskMatch[1].toUpperCase()
                    }
                }
            }

            if (!httpMethod || !routePath) continue

            // 查找装饰器之后的函数定义
            let funcName = ''
            let funcLineIdx = -1
            let paramStr = ''

            for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
                const fl = lines[j].trim()
                if (fl.startsWith('@')) continue  // 跳过其他装饰器
                const funcMatch = fl.match(/^(?:async\s+)?def\s+(\w+)\s*\((.*)/)
                if (funcMatch) {
                    funcName = funcMatch[1]
                    funcLineIdx = j
                    paramStr = funcMatch[2]
                    if (!paramStr.includes(')')) {
                        for (let k = j + 1; k < Math.min(j + 10, lines.length); k++) {
                            paramStr += ' ' + lines[k].trim()
                            if (lines[k].includes(')')) break
                        }
                    }
                    const parenEnd = paramStr.indexOf(')')
                    if (parenEnd >= 0) paramStr = paramStr.substring(0, parenEnd)
                    break
                }
            }

            if (!funcName) continue

            // 提取文档
            const docstring = funcLineIdx >= 0 ? extractDocstring(lines, funcLineIdx) : ''
            const comment = extractPythonComment(lines, i)
            const summary = docstring.split('\n')[0] || comment || funcName

            // 参数
            const params = parsePythonParams(paramStr)

            const modKey = moduleName
            if (!modules.has(modKey)) {
                modules.set(modKey, { name: modKey, className: modKey, apis: [] })
            }

            modules.get(modKey).apis.push({
                method: httpMethod,
                path: routePath,
                summary,
                description: docstring.includes('\n') ? docstring.split('\n').slice(1).join(' ').trim() : '',
                methodName: funcName,
                params,
                requestBody: null,
                response: null,
            })

            totalApis++
        }

        if (onProgress && fi % 20 === 0) {
            onProgress(`扫描文件 ${fi + 1}/${pyFiles.length}...`, Math.round((fi / pyFiles.length) * 100))
        }
        await new Promise(r => setTimeout(r, 0))
    }

    if (onProgress) onProgress(`解析完成，发现 ${totalApis} 个接口`, 100)

    return { modules: Array.from(modules.values()).filter(m => m.apis.length > 0) }
}
