/**
 * 代码比例分配器
 * 按目录比例分配页数，以完整文件为单位摘取代码
 * 确保类/函数的完整性 — 文件是天然的完整代码单元
 */
import { removeComments } from './comment-remover.js'
import { cleanCode, getCodeStats } from './code-cleaner.js'

/**
 * 处理单个文件内容
 */
export function processFileContent(content, ext, cleanOptions = {}) {
    const original = content
    let code = cleanOptions.removeComments !== false ? removeComments(content, ext) : content
    code = cleanCode(code, cleanOptions)
    const lines = code.split('\n').filter(l => l.trim().length > 0)

    // 防御性过滤：文件开头不可能是独立的闭合符号（注释移除后可能残留）
    while (lines.length > 0 && /^[}\])\s,;]*$/.test(lines[0].trim()) && lines[0].trim().length > 0) {
        lines.shift()
    }

    const stats = getCodeStats(original, code)
    return { lines, lineCount: lines.length, stats }
}

/**
 * 按比例分配页数并以完整文件为单位摘取代码
 *
 * 核心逻辑：
 * 1. 按 ratio 计算每个目录应分配的行数配额
 * 2. 逐个文件加入，直到配额用完（最后一个文件允许超出，保证完整）
 * 3. 如果某目录代码不足，将富余行数重新分配给其他目录
 * 4. 各目录代码无缝拼接
 *
 * @param {Array} dirResults - [{ path, ratio, files: [{ name, lines }], totalLines }]
 * @param {number} linesPerPage - 每页行数
 * @param {number} maxPages - 最大总页数
 * @returns {{ lines: string[], totalPages: number, isTruncated: boolean, dirAllocations: Array }}
 */
export function allocateCodeByRatio(dirResults, linesPerPage, maxPages) {
    if (!dirResults || dirResults.length === 0) {
        return { lines: [], totalPages: 0, isTruncated: false, dirAllocations: [] }
    }

    const totalRatio = dirResults.reduce((s, d) => s + d.ratio, 0)
    if (totalRatio === 0) {
        return { lines: [], totalPages: 0, isTruncated: false, dirAllocations: [] }
    }

    const maxTotalLines = maxPages * linesPerPage

    // 计算每个目录的行数配额
    const dirs = dirResults.map(d => ({
        path: d.path,
        ratio: d.ratio,
        files: d.files, // [{ name, lines, lineCount }]
        totalLines: d.totalLines,
        lineQuota: 0,        // 分配的行数配额
        collectedLines: [],   // 最终摘取的代码行
        collectedFiles: 0,    // 摘取的文件数
    }))

    // 第一轮：按比例计算行数配额
    dirs.forEach(d => {
        d.lineQuota = Math.round(maxTotalLines * (d.ratio / totalRatio))
    })

    // 修正四舍五入误差
    const quotaSum = dirs.reduce((s, d) => s + d.lineQuota, 0)
    if (quotaSum !== maxTotalLines) {
        const maxRatioDir = dirs.reduce((a, b) => a.ratio >= b.ratio ? a : b)
        maxRatioDir.lineQuota += maxTotalLines - quotaSum
    }

    // 第二轮：处理代码不足的目录，将富余行数重新分配
    let surplusLines = 0
    const sufficientDirs = []

    for (const d of dirs) {
        if (d.totalLines <= d.lineQuota) {
            // 代码不足，全部纳入
            surplusLines += d.lineQuota - d.totalLines
            d.lineQuota = d.totalLines
        } else {
            sufficientDirs.push(d)
        }
    }

    if (surplusLines > 0 && sufficientDirs.length > 0) {
        const sufficientRatio = sufficientDirs.reduce((s, d) => s + d.ratio, 0)
        let distributed = 0
        for (let i = 0; i < sufficientDirs.length; i++) {
            const d = sufficientDirs[i]
            if (i === sufficientDirs.length - 1) {
                d.lineQuota += surplusLines - distributed
            } else {
                const extra = Math.round(surplusLines * (d.ratio / sufficientRatio))
                d.lineQuota += extra
                distributed += extra
            }
            // 不能超过可用行数
            d.lineQuota = Math.min(d.lineQuota, d.totalLines)
        }
    }

    // 第三轮：以完整文件为单位摘取代码
    const allLines = []
    let isTruncated = false

    for (const d of dirs) {
        let currentLines = 0

        for (const file of d.files) {
            if (currentLines >= d.lineQuota) {
                // 配额已满，后续文件不再纳入
                isTruncated = true
                break
            }

            // 将整个文件纳入（即使超出配额也保证文件完整性）
            d.collectedLines.push(...file.lines)
            currentLines += file.lineCount
            d.collectedFiles++
        }

        allLines.push(...d.collectedLines)
    }

    const totalPages = Math.ceil(allLines.length / linesPerPage)

    return {
        lines: allLines,
        totalPages,
        isTruncated,
        dirAllocations: dirs.map(d => ({
            path: d.path,
            ratio: d.ratio,
            allocatedPages: Math.ceil(d.collectedLines.length / linesPerPage),
            allocatedLines: d.collectedLines.length,
            allocatedFiles: d.collectedFiles,
            totalFiles: d.files.length,
            totalLines: d.totalLines,
        })),
    }
}
