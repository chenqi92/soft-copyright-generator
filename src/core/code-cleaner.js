/**
 * 代码清理器 - 移除空行、行尾空白等
 */

const COPYRIGHT_PATTERNS = [
    /copyright/i, /license/i, /all rights reserved/i,
    /licensed under/i, /permission is hereby granted/i,
    /\(c\)\s*\d{4}/i, /©\s*\d{4}/i,
]

export function cleanCode(code, options = {}) {
    const {
        removeEmptyLines = true,
        removeTrailingWhitespace = true,
        removeImports = false,
        removeCopyrightHeaders = true,
    } = options

    code = code.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    let lines = code.split('\n')
    if (removeCopyrightHeaders) lines = removeCopyrightBlock(lines)
    if (removeImports) lines = lines.filter(l => !isImportLine(l))
    if (removeTrailingWhitespace) lines = lines.map(l => l.replace(/\s+$/, ''))
    if (removeEmptyLines) lines = lines.filter(l => l.trim().length > 0)
    return lines.join('\n')
}

function isImportLine(line) {
    const t = line.trim()
    if (/^import\s+/.test(t)) return true
    if (/^(const|let|var)\s+.*=\s*require\s*\(/.test(t)) return true
    if (/^from\s+\S+\s+import\s+/.test(t)) return true
    if (/^#include\s+/.test(t)) return true
    if (/^using\s+[\w.]+;?\s*$/.test(t)) return true
    if (/^use\s+[\w:]+/.test(t)) return true
    return false
}

function removeCopyrightBlock(lines) {
    let end = -1, inBlock = false
    for (let i = 0; i < Math.min(lines.length, 30); i++) {
        const line = lines[i].trim()
        if (COPYRIGHT_PATTERNS.some(p => p.test(line))) {
            inBlock = true; end = i
        } else if (inBlock) {
            if (line.startsWith('*') || line.startsWith('//') || line.startsWith('#') || line === '*/' || line === '') {
                end = i
            } else break
        }
    }
    return end >= 0 ? lines.slice(end + 1) : lines
}

export function getCodeStats(original, cleaned) {
    const origLines = original.split('\n')
    const cleanLines = cleaned.split('\n').filter(l => l.trim().length > 0)
    const empty = origLines.filter(l => l.trim().length === 0).length
    return {
        originalLineCount: origLines.length,
        cleanedLineCount: cleanLines.length,
        emptyLinesRemoved: empty,
        commentLinesRemoved: Math.max(0, origLines.length - empty - cleanLines.length),
        reductionPercentage: origLines.length > 0 ? Math.round((1 - cleanLines.length / origLines.length) * 100) : 0,
    }
}
