/**
 * Word 文档生成器 - 生成符合软著规范的 .docx 文件 (Browser-side)
 *
 * 核心机制：
 * 1. 使用精确行距（LineRuleType.EXACT）强制每行固定高度
 *    → 覆盖微软雅黑等字体内置行距过大的问题
 * 2. 使用文档网格（DocumentGridType.LINES）控制每页行数
 *    → Word「页面设置→文档网格→指定行数」
 * 3. 使用 PageBreak 在每页最后一行强制换页（三重保险）
 * 4. 启用连续行号
 *
 * 软著截取规则：前 N/2 页 + 后 N/2 页（确保结尾为程序结束部分）
 */
import {
    Document, Packer, Paragraph, TextRun,
    Header, Footer, PageNumber,
    AlignmentType, LineRuleType, DocumentGridType,
    convertMillimetersToTwip
} from 'docx'

const PAGE_HEIGHT_TWIP = convertMillimetersToTwip(297)
const DEFAULTS = {
    PAGE_MARGIN_TOP: convertMillimetersToTwip(25.4),
    PAGE_MARGIN_BOTTOM: convertMillimetersToTwip(25.4),
    PAGE_MARGIN_LEFT: convertMillimetersToTwip(31.8),
    PAGE_MARGIN_RIGHT: convertMillimetersToTwip(31.8),
    MAX_PAGES: 80,
    FONT_NAME: '微软雅黑',
    FONT_SIZE: 21, // 五号字体 = 10.5pt = 21 half-points
}

/**
 * 计算精确行距 (twips)
 * 确保 linesPerPage 行恰好填满一个 A4 页面
 */
function calcExactLineSpacing(linesPerPage) {
    const availableTwip = PAGE_HEIGHT_TWIP - DEFAULTS.PAGE_MARGIN_TOP - DEFAULTS.PAGE_MARGIN_BOTTOM
    return Math.floor(availableTwip / linesPerPage)
}

/**
 * 根据字号估算每页自然行数（仅供参考显示用）
 */
export function estimateLinesPerPage(fontSizeHalfPt) {
    const fontSizePt = fontSizeHalfPt / 2
    const availableTwip = PAGE_HEIGHT_TWIP - DEFAULTS.PAGE_MARGIN_TOP - DEFAULTS.PAGE_MARGIN_BOTTOM
    const availablePt = availableTwip / 20
    return Math.floor(availablePt / (fontSizePt * 1.3))
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

/**
 * 截取代码行 — 软著规范：前 N/2 页 + 后 N/2 页
 * 确保最后一页始终包含程序结尾代码
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
 * 构建段落列表
 * 使用 LineRuleType.EXACT 精确行高，Word 自然分页恰好 N 行/页
 * 不使用 PageBreak（会导致段落跨页产生空白行）
 */
function buildParagraphs(lines, linesPerPage, fontName, fontSize, lineSpacingTwip) {
    const paragraphs = []
    const spacingProps = {
        line: lineSpacingTwip,
        lineRule: LineRuleType.EXACT,
        before: 0,
        after: 0,
    }

    for (let i = 0; i < lines.length; i++) {
        paragraphs.push(new Paragraph({
            spacing: spacingProps,
            children: [
                new TextRun({
                    text: lines[i] || ' ',
                    font: { name: fontName, eastAsia: fontName },
                    size: fontSize,
                }),
            ],
        }))
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

    const lineSpacingTwip = calcExactLineSpacing(linesPerPage)
    const truncResult = truncateCode(codeLines, linesPerPage, maxPages)
    const paragraphs = buildParagraphs(truncResult.lines, linesPerPage, fontName, fontSize, lineSpacingTwip)

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
                // 文档网格 — Word「页面设置→文档网格→指定行数」
                grid: {
                    linePitch: lineSpacingTwip,
                    type: DocumentGridType.LINES,
                },
                // 连续行号 — Word「布局→行号→连续」
                lineNumbers: {
                    countBy: 1,
                    restart: "continuous",
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
