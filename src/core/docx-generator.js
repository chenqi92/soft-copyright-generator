/**
 * Word 文档生成器 - 生成符合软著规范的 .docx 文件 (Browser-side)
 *
 * 使用显式 PageBreak 精确控制每页行数。
 * 当自然页容量 > 设定行数时，PageBreak 强制提前换页。
 * 当自然页容量 < 设定行数时，底部空白较多但行数精确。
 */
import {
    Document, Packer, Paragraph, TextRun,
    Header, Footer, PageNumber,
    AlignmentType, PageBreak,
    convertMillimetersToTwip
} from 'docx'

const DEFAULTS = {
    PAGE_MARGIN_TOP: convertMillimetersToTwip(25.4),
    PAGE_MARGIN_BOTTOM: convertMillimetersToTwip(25.4),
    PAGE_MARGIN_LEFT: convertMillimetersToTwip(31.8),
    PAGE_MARGIN_RIGHT: convertMillimetersToTwip(31.8),
    MAX_PAGES: 80,
    FONT_NAME: '宋体',
    FONT_SIZE: 10, // 八号字体 = 5pt = 10 half-points
}

/**
 * 根据字号（half-points）估算 A4 纸每页自然行数
 */
export function estimateLinesPerPage(fontSizeHalfPt) {
    const fontSizePt = fontSizeHalfPt / 2
    const availableHeightPt = 613
    const lineHeightPt = fontSizePt * 1.3
    return Math.floor(availableHeightPt / lineHeightPt)
}

function createHeader(softwareName, version, fontName) {
    return new Header({
        children: [
            new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                    new TextRun({
                        text: `${softwareName} V${version}`,
                        font: { name: fontName, eastAsia: fontName },
                        size: 18,
                    }),
                ],
            }),
        ],
    })
}

function createFooter(fontName) {
    return new Footer({
        children: [
            new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                    new TextRun({ text: '第 ', font: { name: fontName, eastAsia: fontName }, size: 18 }),
                    new TextRun({ children: [PageNumber.CURRENT], font: { name: fontName, eastAsia: fontName }, size: 18 }),
                    new TextRun({ text: ' 页 共 ', font: { name: fontName, eastAsia: fontName }, size: 18 }),
                    new TextRun({ children: [PageNumber.TOTAL_PAGES], font: { name: fontName, eastAsia: fontName }, size: 18 }),
                    new TextRun({ text: ' 页', font: { name: fontName, eastAsia: fontName }, size: 18 }),
                ],
            }),
        ],
    })
}

function createCodeParagraph(line, fontName, fontSize) {
    return new Paragraph({
        spacing: { line: 240, before: 0, after: 0 },
        children: [
            new TextRun({
                text: line || ' ',
                font: { name: fontName, eastAsia: fontName },
                size: fontSize,
            }),
        ],
    })
}

/**
 * 截取代码行
 */
export function truncateCode(allLines, linesPerPage, maxPages) {
    const totalPages = Math.ceil(allLines.length / linesPerPage)
    if (totalPages <= maxPages) {
        return { lines: allLines, totalPages, isTruncated: false }
    }
    const frontPages = Math.floor(maxPages / 2)
    const backPages = maxPages - frontPages
    const frontLines = allLines.slice(0, frontPages * linesPerPage)
    const backLines = allLines.slice(allLines.length - backPages * linesPerPage)
    return { lines: [...frontLines, ...backLines], totalPages: maxPages, isTruncated: true }
}

/**
 * 将代码行按每页 N 行分组，在每页最后一行附加 PageBreak
 * 这样确保每页精确 N 行代码，不受 Word 自然排版影响
 */
function buildParagraphs(lines, linesPerPage, fontName, fontSize) {
    const paragraphs = []
    for (let i = 0; i < lines.length; i++) {
        const isLastLineOfPage = (i + 1) % linesPerPage === 0
        const isLastLine = i === lines.length - 1

        if (isLastLineOfPage && !isLastLine) {
            // 在这一行的段落中附加 PageBreak，强制换页
            paragraphs.push(new Paragraph({
                spacing: { line: 240, before: 0, after: 0 },
                children: [
                    new TextRun({
                        text: lines[i] || ' ',
                        font: { name: fontName, eastAsia: fontName },
                        size: fontSize,
                    }),
                    new PageBreak(),
                ],
            }))
        } else {
            paragraphs.push(createCodeParagraph(lines[i], fontName, fontSize))
        }
    }
    return paragraphs
}

/**
 * 生成 docx 的 Uint8Array buffer
 */
export async function generateDocxBuffer(config) {
    const {
        softwareName = '软件名称',
        version = '1.0',
        codeLines = [],
        linesPerPage = 50,
        maxPages = DEFAULTS.MAX_PAGES,
        fontName = DEFAULTS.FONT_NAME,
        fontSize = DEFAULTS.FONT_SIZE,
    } = config

    const truncResult = truncateCode(codeLines, linesPerPage, maxPages)
    const paragraphs = buildParagraphs(truncResult.lines, linesPerPage, fontName, fontSize)

    const doc = new Document({
        sections: [{
            properties: {
                page: {
                    margin: {
                        top: DEFAULTS.PAGE_MARGIN_TOP,
                        bottom: DEFAULTS.PAGE_MARGIN_BOTTOM,
                        left: DEFAULTS.PAGE_MARGIN_LEFT,
                        right: DEFAULTS.PAGE_MARGIN_RIGHT,
                    },
                    size: {
                        width: convertMillimetersToTwip(210),
                        height: convertMillimetersToTwip(297),
                    },
                },
            },
            headers: { default: createHeader(softwareName, version, fontName) },
            footers: { default: createFooter(fontName) },
            children: paragraphs,
        }],
    })

    const blob = await Packer.toBlob(doc)
    const arrayBuffer = await blob.arrayBuffer()
    return {
        buffer: new Uint8Array(arrayBuffer),
        totalPages: truncResult.totalPages,
        isTruncated: truncResult.isTruncated,
        totalLines: truncResult.lines.length,
        originalLines: codeLines.length,
        linesPerPage,
    }
}
