/**
 * 从文档文件提取标题结构，自动生成模板骨架
 * 支持 .docx（mammoth 提取 HTML 标题）和 .md（解析 # 标题行）
 */
import { invoke } from '@tauri-apps/api/core'
import { readTextFile } from '@tauri-apps/plugin-fs'
import { createSectionNode } from './template-presets.js'

/**
 * 从文件路径解析标题结构并生成模板章节树
 * @param {string} filePath
 * @returns {Promise<{name: string, sections: object[]}>}
 */
export async function generateTemplateFromFile(filePath) {
    const fileName = filePath.split(/[/\\]/).pop()
    const ext = fileName.includes('.') ? '.' + fileName.split('.').pop().toLowerCase() : ''

    let headings = []

    switch (ext) {
        case '.docx':
            headings = await extractDocxHeadings(filePath)
            break
        case '.md':
            headings = await extractMdHeadings(filePath)
            break
        default:
            throw new Error(`不支持从 ${ext} 文件提取模板结构，请使用 .docx 或 .md 文件`)
    }

    if (headings.length === 0) {
        throw new Error('未能从文档中提取到任何标题，请确保文档使用了标题样式')
    }

    const sections = buildSectionsFromHeadings(headings)
    const templateName = fileName.replace(/\.[^.]+$/, '')

    return { name: templateName, sections }
}

/**
 * 从 docx 文件提取标题
 * 使用 mammoth 转 HTML，然后解析 <h1>-<h6> 标签
 */
async function extractDocxHeadings(filePath) {
    const mammoth = await import('mammoth')
    const bytes = await invoke('plugin:fs|read_file', { path: filePath })
    const arrayBuffer = new Uint8Array(bytes).buffer

    // 使用 mammoth 转换为 HTML（保留标题标签）
    const result = await mammoth.convertToHtml({ arrayBuffer })
    const html = result.value || ''

    // 解析 HTML 中的 h1-h6 标签
    const headings = []
    const headingRegex = /<h(\d)[^>]*>(.*?)<\/h\d>/gi
    let match
    while ((match = headingRegex.exec(html)) !== null) {
        const level = parseInt(match[1])
        // 去除 HTML 标签，只保留纯文本
        const text = match[2].replace(/<[^>]+>/g, '').trim()
        if (text) {
            headings.push({ level, text })
        }
    }

    return headings
}

/**
 * 从 Markdown 文件提取标题
 */
async function extractMdHeadings(filePath) {
    const content = await readTextFile(filePath)
    const lines = content.split('\n')
    const headings = []

    for (const line of lines) {
        const match = line.match(/^(#{1,6})\s+(.+)/)
        if (match) {
            headings.push({
                level: match[1].length,
                text: match[2].trim(),
            })
        }
    }

    return headings
}

/**
 * 从扁平的标题列表构建嵌套的章节树
 * @param {{level: number, text: string}[]} headings
 * @returns {object[]}
 */
function buildSectionsFromHeadings(headings) {
    // 找到最小的标题级别作为根级别
    const minLevel = Math.min(...headings.map(h => h.level))

    const root = []
    const stack = [{ children: root, level: minLevel - 1 }]
    const counters = {} // level -> counter

    for (const heading of headings) {
        const { level, text } = heading

        // 清理编号前缀（如 "1.1 目的" → "目的"）
        const cleanTitle = text.replace(/^[\d.]+\s*/, '').trim() || text

        // 尝试提取已有编号
        const numMatch = text.match(/^([\d.]+)\s/)
        const existingNumber = numMatch ? numMatch[1].replace(/\.$/, '') : null

        // 回退到正确的父级层
        while (stack.length > 1 && stack[stack.length - 1].level >= level) {
            stack.pop()
        }

        const parent = stack[stack.length - 1]

        // 计算章节编号
        if (!counters[level]) counters[level] = 0
        // 当切换到更高级别时，重置低级别计数
        for (const key of Object.keys(counters)) {
            if (parseInt(key) > level) delete counters[key]
        }
        counters[level] = (counters[level] || 0) + 1

        const number = existingNumber || String(parent.children.length + 1)

        const node = createSectionNode({
            title: cleanTitle,
            number: number,
            type: guessContentType(cleanTitle),
            prompt: `请根据项目代码分析，编写"${cleanTitle}"章节的内容。`,
            children: [],
        })

        parent.children.push(node)
        stack.push({ children: node.children, level })
    }

    // 最后重新编号，确保编号层级正确
    renumberTree(root, '')

    return root
}

/**
 * 根据章节标题猜测内容类型
 */
function guessContentType(title) {
    const lower = title.toLowerCase()
    if (/架构图|流程图|拓扑图|er\s*图|类图|时序图|部署图/.test(lower)) return 'diagram'
    if (/表|列表|清单|对照|配置项|技术选型/.test(lower)) return 'table'
    return 'text'
}

/**
 * 递归重新编号
 */
function renumberTree(nodes, prefix) {
    nodes.forEach((node, idx) => {
        const num = prefix ? `${prefix}.${idx + 1}` : String(idx + 1)
        node.number = num
        if (node.children && node.children.length > 0) {
            renumberTree(node.children, num)
        }
    })
}
