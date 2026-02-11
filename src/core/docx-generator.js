/**
 * Word 文档生成器 - 生成符合软著规范的 .docx 文件 (Browser-side)
 */
import {
    Document, Packer, Paragraph, TextRun,
    Header, Footer, PageNumber,
    AlignmentType,
    convertMillimetersToTwip
} from 'docx'

const SPEC = {
    PAGE_MARGIN_TOP: convertMillimetersToTwip(25.4),
    PAGE_MARGIN_BOTTOM: convertMillimetersToTwip(25.4),
    PAGE_MARGIN_LEFT: convertMillimetersToTwip(31.8),
    PAGE_MARGIN_RIGHT: convertMillimetersToTwip(31.8),
    LINES_PER_PAGE: 50,
    MAX_PAGES: 80,
    FRONT_PAGES: 40,
    BACK_PAGES: 40,
    FONT_NAME: 'Courier New',
    FONT_NAME_CN: '宋体',
    FONT_SIZE: 21, // 五号字体 = 10.5pt = 21 half-points
}

function createHeader(softwareName, version) {
    return new Header({
        children: [
            new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                    new TextRun({
                        text: `${softwareName} V${version}`,
                        font: { name: SPEC.FONT_NAME_CN },
                        size: 18,
                    }),
                ],
            }),
        ],
    })
}

function createFooter() {
    return new Footer({
        children: [
            new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                    new TextRun({ text: '第 ', font: { name: SPEC.FONT_NAME_CN }, size: 18 }),
                    new TextRun({ children: [PageNumber.CURRENT], font: { name: SPEC.FONT_NAME_CN }, size: 18 }),
                    new TextRun({ text: ' 页 共 ', font: { name: SPEC.FONT_NAME_CN }, size: 18 }),
                    new TextRun({ children: [PageNumber.TOTAL_PAGES], font: { name: SPEC.FONT_NAME_CN }, size: 18 }),
                    new TextRun({ text: ' 页', font: { name: SPEC.FONT_NAME_CN }, size: 18 }),
                ],
            }),
        ],
    })
}

function createCodeParagraph(line) {
    return new Paragraph({
        spacing: { line: 240, before: 0, after: 0 },
        children: [
            new TextRun({
                text: line || ' ',
                font: { name: SPEC.FONT_NAME, eastAsia: SPEC.FONT_NAME_CN },
                size: SPEC.FONT_SIZE,
            }),
        ],
    })
}

function createSectionLabel(text) {
    return new Paragraph({
        spacing: { before: 200, after: 200 },
        children: [
            new TextRun({
                text,
                bold: true,
                font: { name: SPEC.FONT_NAME_CN },
                size: SPEC.FONT_SIZE,
            }),
        ],
    })
}

export function truncateCode(allLines, linesPerPage = SPEC.LINES_PER_PAGE, maxPages = SPEC.MAX_PAGES) {
    const totalPages = Math.ceil(allLines.length / linesPerPage)
    if (totalPages <= maxPages) {
        return { lines: allLines, totalPages, isTruncated: false, frontLines: allLines, backLines: [] }
    }
    const frontPages = Math.floor(maxPages / 2)
    const backPages = maxPages - frontPages
    const frontLines = allLines.slice(0, frontPages * linesPerPage)
    const backLines = allLines.slice(allLines.length - backPages * linesPerPage)
    return { lines: [...frontLines, ...backLines], totalPages: maxPages, isTruncated: true, frontLines, backLines }
}

/**
 * 生成 docx 的 Uint8Array buffer
 */
export async function generateDocxBuffer(config) {
    const {
        softwareName = '软件名称',
        version = '1.0',
        codeLines = [],
        linesPerPage = SPEC.LINES_PER_PAGE,
        maxPages = SPEC.MAX_PAGES,
    } = config

    const truncResult = truncateCode(codeLines, linesPerPage, maxPages)
    const paragraphs = []

    if (truncResult.isTruncated) {
        // 前面的页 — 代码开头（程序起始部分）
        for (const line of truncResult.frontLines) {
            paragraphs.push(createCodeParagraph(line))
        }
        // 后面的页 — 代码结尾（程序结束部分）
        for (const line of truncResult.backLines) {
            paragraphs.push(createCodeParagraph(line))
        }
    } else {
        for (const line of truncResult.lines) {
            paragraphs.push(createCodeParagraph(line))
        }
    }

    const doc = new Document({
        sections: [{
            properties: {
                page: {
                    margin: {
                        top: SPEC.PAGE_MARGIN_TOP,
                        bottom: SPEC.PAGE_MARGIN_BOTTOM,
                        left: SPEC.PAGE_MARGIN_LEFT,
                        right: SPEC.PAGE_MARGIN_RIGHT,
                    },
                    size: {
                        width: convertMillimetersToTwip(210),
                        height: convertMillimetersToTwip(297),
                    },
                },
            },
            headers: { default: createHeader(softwareName, version) },
            footers: { default: createFooter() },
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
    }
}
