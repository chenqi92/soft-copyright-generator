/**
 * 代码比例分配器
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
    const stats = getCodeStats(original, code)
    return { lines, lineCount: lines.length, stats }
}

/**
 * 按比例分配代码
 */
export function allocateByRatio(directories, totalLinesNeeded) {
    const totalRatio = directories.reduce((s, d) => s + d.ratio, 0)
    if (totalRatio === 0) return { directories: [], totalLines: 0 }

    // 计算每个目录应分配的行数，处理不足情况
    let remaining = totalLinesNeeded
    const results = directories.map(dir => ({
        ...dir,
        idealLines: Math.round(totalLinesNeeded * (dir.ratio / totalRatio)),
        allocatedLines: 0,
        lines: [],
    }))

    // 先处理代码量不足的目录
    const sorted = [...results].sort((a, b) => a.totalLines - b.totalLines)
    const usedRatio = new Set()

    for (const dir of sorted) {
        const allocated = Math.min(dir.idealLines, dir.totalLines, remaining)
        dir.allocatedLines = allocated
        dir.lines = dir.allLines.slice(0, allocated)
        remaining -= allocated
        usedRatio.add(dir.path)
    }

    // 如果还有剩余行数需要分配（某些目录不足）
    if (remaining > 0) {
        for (const dir of sorted.reverse()) {
            if (dir.totalLines > dir.allocatedLines) {
                const extra = Math.min(remaining, dir.totalLines - dir.allocatedLines)
                dir.allocatedLines += extra
                dir.lines = dir.allLines.slice(0, dir.allocatedLines)
                remaining -= extra
                if (remaining <= 0) break
            }
        }
    }

    return {
        directories: results,
        totalLines: results.reduce((s, d) => s + d.allocatedLines, 0),
    }
}

/**
 * 合并分配后的代码
 */
export function mergeAllocatedCode(allocationResult) {
    const allLines = []
    for (const dir of allocationResult.directories) {
        allLines.push(...dir.lines)
    }
    return allLines
}
