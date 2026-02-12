<template>
  <div class="app-container" :class="{ 'light-theme': theme === 'light' }" style="height:100vh;display:flex;flex-direction:column;">
    <!-- Toast -->
    <div v-if="toast.show" :class="['message-toast', toast.type]">{{ toast.message }}</div>

    <!-- 头部 -->
    <header class="app-header">
      <h1><img src="./assets/logo.svg" class="app-logo" alt="logo" /> 软著代码生成器</h1>
      <div class="header-actions">
        <span v-if="generating" style="display:flex;align-items:center;gap:6px;color:var(--text-secondary);font-size:12px;">
          <span class="spinner"></span> 生成中...
        </span>
        <span v-else-if="lastResult" style="font-size:12px;color:var(--success-500);">
          <Check :size="12" /> {{ lastResult.totalPages }}页 {{ fmt(lastResult.totalLines) }}行
        </span>
        <button class="btn btn-primary btn-sm" @click="generateDocument" :disabled="generating">
          <FileDown :size="14" /> 生成 Word 文档
        </button>
        <button class="btn btn-secondary btn-sm" @click="toggleTheme" :title="theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'">
          <Sun v-if="theme === 'dark'" :size="14" />
          <Moon v-else :size="14" />
        </button>
        <button class="btn btn-secondary btn-sm" @click="importConfig"><FolderOpen :size="14" /> 导入配置</button>
        <button class="btn btn-secondary btn-sm" @click="exportConfig"><Save :size="14" /> 导出配置</button>
      </div>
    </header>

    <!-- 主体 -->
    <div class="app-body">
      <!-- 左侧配置面板 -->
      <aside class="config-panel">
        <!-- 软件信息 -->
        <div class="card">
          <div class="card-header"><h3><Pin :size="14" /> 软件信息</h3></div>
          <div class="card-body">
            <div class="form-group">
              <label class="form-label">软件全称</label>
              <input class="form-input" v-model="config.softwareName" placeholder="例：XX管理系统" />
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">版本号</label>
                <input class="form-input" v-model="config.version" placeholder="1.0" />
              </div>
              <div class="form-group">
                <label class="form-label">每页行数</label>
                <input class="form-input" type="number" v-model.number="config.linesPerPage" min="30" max="80" />
              </div>
              <div class="form-group">
                <label class="form-label">最大页数</label>
                <input class="form-input" type="number" v-model.number="config.maxPages" min="1" max="120" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group" style="flex:2;">
                <label class="form-label">字体</label>
                <select class="form-input" v-model="config.fontName">
                  <optgroup label="中文字体">
                    <option value="宋体">宋体</option>
                    <option value="仿宋">仿宋</option>
                    <option value="楷体">楷体</option>
                    <option value="黑体">黑体</option>
                    <option value="微软雅黑">微软雅黑</option>
                    <option value="华文宋体">华文宋体</option>
                    <option value="华文仿宋">华文仿宋</option>
                    <option value="华文楷体">华文楷体</option>
                    <option value="华文中宋">华文中宋</option>
                  </optgroup>
                  <optgroup label="英文等宽字体">
                    <option value="Courier New">Courier New</option>
                    <option value="Consolas">Consolas</option>
                    <option value="Lucida Console">Lucida Console</option>
                    <option value="Monaco">Monaco</option>
                  </optgroup>
                  <optgroup label="英文字体">
                    <option value="Times New Roman">Times New Roman</option>
                    <option value="Arial">Arial</option>
                    <option value="Calibri">Calibri</option>
                    <option value="Cambria">Cambria</option>
                    <option value="Georgia">Georgia</option>
                    <option value="Verdana">Verdana</option>
                    <option value="Tahoma">Tahoma</option>
                  </optgroup>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">字号</label>
                <select class="form-input" v-model.number="config.fontSize">
                  <optgroup label="中文字号">
                    <option :value="84">初号 (42pt)</option>
                    <option :value="72">小初 (36pt)</option>
                    <option :value="52">一号 (26pt)</option>
                    <option :value="48">小一 (24pt)</option>
                    <option :value="44">二号 (22pt)</option>
                    <option :value="36">小二 (18pt)</option>
                    <option :value="32">三号 (16pt)</option>
                    <option :value="30">小三 (15pt)</option>
                    <option :value="28">四号 (14pt)</option>
                    <option :value="24">小四 (12pt)</option>
                    <option :value="21">五号 (10.5pt)</option>
                    <option :value="18">小五 (9pt)</option>
                    <option :value="15">六号 (7.5pt)</option>
                    <option :value="13">小六 (6.5pt)</option>
                    <option :value="11">七号 (5.5pt)</option>
                    <option :value="10">八号 (5pt)</option>
                  </optgroup>
                  <optgroup label="磅值">
                    <option :value="144">72pt</option>
                    <option :value="112">56pt</option>
                    <option :value="108">54pt</option>
                    <option :value="96">48pt</option>
                    <option :value="56">28pt</option>
                    <option :value="40">20pt</option>
                    <option :value="22">11pt</option>
                    <option :value="20">10pt</option>
                    <option :value="16">8pt</option>
                    <option :value="14">7pt</option>
                  </optgroup>
                </select>
              </div>
            </div>
          </div>
        </div>

        <!-- 目录选择 -->
        <div class="card">
          <div class="card-header">
            <h3><FolderOpen :size="14" /> 代码目录</h3>
            <button class="btn btn-primary btn-sm" @click="addDirectory"><Plus :size="14" /> 添加目录</button>
          </div>
          <div class="card-body">
            <div v-if="config.directories.length === 0" class="tip">
              <Lightbulb :size="14" class="tip-icon" />
              <span>点击"添加目录"选择源代码文件夹，支持多目录。</span>
            </div>
            <div v-for="(dir, i) in config.directories" :key="i" class="dir-item">
              <div class="dir-item-header">
                <span class="dir-path" :title="dir.path">{{ dir.path }}</span>
                <button class="btn btn-danger btn-sm btn-icon" @click="removeDirectory(i)"><X :size="14" /></button>
              </div>
              <div class="dir-ratio">
                <label>比例：</label>
                <input class="ratio-input" type="number" v-model.number="dir.ratio" min="1" max="100" />
                <span style="color:var(--text-muted);font-size:12px;">%</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 文件类型 -->
        <div class="card">
          <div class="card-header">
            <h3><FileText :size="14" /> 文件类型</h3>
            <button class="btn btn-secondary btn-sm" @click="detectTypes" :disabled="config.directories.length===0 || detecting">
              {{ detecting ? '检测中...' : '' }}<Search :size="14" v-if="!detecting" /> {{ detecting ? '' : '检测类型' }}
            </button>
          </div>
          <div class="card-body">
            <div v-if="fileTypes.length===0" class="tip">
              <Lightbulb :size="14" class="tip-icon" /><span>添加目录后点击"检测类型"。</span>
            </div>
            <template v-else>
              <div class="select-actions">
                <span class="select-action" @click="selectAllTypes">全选</span>
                <span class="select-action" @click="deselectAllTypes">全不选</span>
                <span class="select-action" @click="selectCodeTypes">仅代码</span>
              </div>
              <div class="file-type-grid-scroll">
                <div class="file-type-grid">
                  <div v-for="ft in sortedFileTypes" :key="ft.ext"
                    :class="['file-type-tag',{active:config.selectedExtensions.includes(ft.ext)}]"
                    @click="toggleFileType(ft.ext)">
                    {{ ft.ext }} <span class="count">{{ ft.count }}</span>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>

        <!-- 忽略规则 -->
        <div class="card">
          <div class="card-header"><h3><Ban :size="14" /> 忽略规则</h3></div>
          <div class="card-body">
            <label class="toggle" @click="config.useGitignore = !config.useGitignore">
              <span class="toggle-track">
                <span class="toggle-thumb" :style="config.useGitignore ? 'transform:translateX(16px)' : ''"></span>
              </span>
              <span :style="{color:config.useGitignore ? 'var(--primary-300)' : ''}">读取 .gitignore</span>
            </label>
            <div class="divider" style="margin:6px 0;"></div>
            <div class="ignore-tags">
              <div v-for="(p,i) in config.customIgnorePatterns" :key="i" class="ignore-tag">
                {{ p }} <span class="remove-btn" @click="config.customIgnorePatterns.splice(i,1)"><X :size="12" /></span>
              </div>
            </div>
            <div class="ignore-input-row">
              <input class="form-input" v-model="newIgnore" placeholder="输入忽略规则" @keyup.enter="addIgnore" />
              <button class="btn btn-secondary btn-sm" @click="addIgnore">添加</button>
            </div>
          </div>
        </div>

        <!-- 清理选项 -->
        <div class="card">
          <div class="card-header"><h3><Eraser :size="14" /> 清理选项</h3></div>
          <div class="card-body">
            <div class="clean-options">
              <label class="checkbox-label"><input type="checkbox" v-model="config.cleanOptions.removeComments" /> 移除注释</label>
              <label class="checkbox-label"><input type="checkbox" v-model="config.cleanOptions.removeEmptyLines" /> 移除空行</label>
              <label class="checkbox-label"><input type="checkbox" v-model="config.cleanOptions.removeTrailingWhitespace" /> 移除行尾空白</label>
              <label class="checkbox-label"><input type="checkbox" v-model="config.cleanOptions.removeImports" /> 移除 import 语句</label>
              <label class="checkbox-label"><input type="checkbox" v-model="config.cleanOptions.removeCopyrightHeaders" /> 移除版权声明</label>
            </div>
          </div>
        </div>
      </aside>

      <!-- 右侧内容区域 -->
      <main class="content-panel">
        <div v-if="config.directories.length===0" class="empty-state" style="flex:1;">
          <FolderOpen :size="48" style="opacity:0.3;margin-bottom:16px;" />
          <p>尚未添加任何代码目录</p>
          <p class="hint">请在左侧添加源代码目录，然后检测文件类型并生成文档。</p>
        </div>

        <template v-else>
          <!-- 统计 -->
          <div class="stats-grid">
            <div class="stat-card"><div class="stat-value">{{ stats.totalFiles }}</div><div class="stat-label">文件数量</div></div>
            <div class="stat-card"><div class="stat-value">{{ fmt(stats.totalLines) }}</div><div class="stat-label">代码行数</div></div>
            <div class="stat-card"><div class="stat-value">{{ stats.estimatedPages }}</div><div class="stat-label">预计页数</div></div>
            <div class="stat-card"><div class="stat-value">{{ config.selectedExtensions.length }}</div><div class="stat-label">已选类型</div></div>
          </div>

          <!-- 预览 -->
          <div class="card" style="flex:1;display:flex;flex-direction:column;">
            <div class="card-header">
              <h3><Eye :size="14" /> 代码预览</h3>
              <button class="btn btn-secondary btn-sm" @click="refreshPreview" :disabled="previewing || config.selectedExtensions.length===0">
                <RefreshCw :size="14" v-if="!previewing" /> {{ previewing ? '加载中...' : '刷新预览' }}
              </button>
            </div>
            <!-- 进度条 -->
            <div v-if="processing" class="progress-container">
              <div class="progress-bar"><div class="progress-fill" :style="{width:progress+'%'}"></div></div>
              <div class="progress-text">{{ progressText }}</div>
            </div>
            <div class="card-body" style="flex:1;overflow:hidden;display:flex;flex-direction:column;">
              <div v-if="!previewData && !processing" class="tip" style="margin-bottom:12px;">
                <Lightbulb :size="14" class="tip-icon" /><span>选择文件类型后点击"刷新预览"查看生成效果。</span>
              </div>
              <div v-if="previewData" style="margin-bottom:12px;display:flex;gap:12px;flex-wrap:wrap;">
                <span class="badge badge-primary">总计 {{ fmt(previewData.totalLines) }} 行</span>
                <span class="badge badge-success">共 {{ previewPages.length }} 页</span>
                <span v-if="previewData.totalPages > config.maxPages" class="badge badge-warning">
                  将截取前{{ Math.floor(config.maxPages/2) }}页 + 后{{ config.maxPages - Math.floor(config.maxPages/2) }}页
                </span>
              </div>
              <!-- Word 分页预览 -->
              <div v-if="previewData" class="word-preview-scroll">
                <div v-for="(page, pi) in previewPages" :key="pi" class="word-page">
                  <div class="word-page-header">
                    <span></span>
                    <span>{{ config.softwareName || '软件名称' }} V{{ config.version }}</span>
                  </div>
                  <div class="word-page-body">
                    <div v-for="(line, li) in page" :key="li" class="code-line">
                      <span class="line-number">{{ pi * config.linesPerPage + li + 1 }}</span>
                      <span class="line-content">{{ line }}</span>
                    </div>
                  </div>
                  <div class="word-page-footer">
                    第 {{ pi + 1 }} 页 共 {{ previewPages.length }} 页
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </main>
    </div>
  </div>
</template>

<script>
import { invoke } from '@tauri-apps/api/core'
import { open, save } from '@tauri-apps/plugin-dialog'
import { writeFile, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { processFileContent } from './core/ratio-allocator.js'
import { generateDocxBuffer, truncateCode, estimateLinesPerPage } from './core/docx-generator.js'
import { smartSortFiles } from './core/file-sorter.js'
import {
  FolderOpen, Save, Pin, Plus, X, FileText, Search,
  Lightbulb, Ban, Eraser, Eye, RefreshCw, Check, FileDown,
  Sun, Moon
} from 'lucide-vue-next'

const NON_CODE_EXTS = ['.json','.yaml','.yml','.toml','.ini','.cfg','.conf','.md','.txt','.csv','.log','.xml','.svg']
const BATCH_SIZE = 50

export default {
  name: 'App',
  components: {
    FolderOpen, Save, Pin, Plus, X, FileText, Search,
    Lightbulb, Ban, Eraser, Eye, RefreshCw, Check, FileDown,
    Sun, Moon
  },
  data() {
    return {
      config: {
        softwareName: '', version: '1.0', linesPerPage: 50, maxPages: 80,
        fontName: '微软雅黑', fontSize: 21,
        directories: [], selectedExtensions: [], customIgnorePatterns: [],
        useGitignore: true,
        cleanOptions: {
          removeComments: true, removeEmptyLines: true, removeTrailingWhitespace: true,
          removeImports: false, removeCopyrightHeaders: true,
        },
      },
      fileTypes: [], newIgnore: '',
      detecting: false, previewing: false, generating: false, processing: false,
      progress: 0, progressText: '',
      stats: { totalFiles: 0, totalLines: 0, estimatedPages: 0 },
      previewData: null, previewLines: [],
      lastResult: null,
      theme: 'dark',
      toast: { show: false, message: '', type: 'info' },
      allCodeLines: [],
    }
  },
  computed: {
    previewPages() {
      if (!this.previewLines.length) return []
      const pages = []
      const lpp = this.config.linesPerPage || 50
      for (let i = 0; i < this.previewLines.length; i += lpp) {
        pages.push(this.previewLines.slice(i, i + lpp))
      }
      return pages
    },
    sortedFileTypes() {
      return [...this.fileTypes].sort((a, b) => {
        const aSelected = this.config.selectedExtensions.includes(a.ext) ? 0 : 1
        const bSelected = this.config.selectedExtensions.includes(b.ext) ? 0 : 1
        if (aSelected !== bSelected) return aSelected - bSelected
        return b.count - a.count
      })
    },
  },
  methods: {
    // ===== 主题切换 =====
    toggleTheme() {
      this.theme = this.theme === 'dark' ? 'light' : 'dark'
    },
    // ===== 目录 =====
    async addDirectory() {
      const dir = await open({ directory: true, multiple: false, title: '选择代码目录' })
      if (!dir) return
      if (this.config.directories.find(d => d.path === dir)) {
        this.showToast('该目录已添加', 'warning'); return
      }
      this.config.directories.push({ path: dir, ratio: 50 })
      this.rebalance()
      this.showToast('目录已添加', 'success')
    },
    removeDirectory(i) {
      this.config.directories.splice(i, 1)
      this.rebalance()
      if (!this.config.directories.length) {
        this.fileTypes = []; this.config.selectedExtensions = []
        this.previewData = null; this.allCodeLines = []
        this.stats = { totalFiles: 0, totalLines: 0, estimatedPages: 0 }
      }
    },
    rebalance() {
      const n = this.config.directories.length
      if (!n) return
      const each = Math.floor(100 / n), rem = 100 - each * n
      this.config.directories.forEach((d, i) => { d.ratio = each + (i === 0 ? rem : 0) })
    },

    // ===== 文件类型检测 =====
    async detectTypes() {
      this.detecting = true
      try {
        const result = await invoke('detect_file_types', {
          dirPaths: this.config.directories.map(d => d.path),
          customIgnore: this.config.customIgnorePatterns,
          useGitignore: this.config.useGitignore,
        })
        if (result.success) {
          this.fileTypes = result.types
          this.selectCodeTypes()
          this.showToast(`检测到 ${result.types.length} 种文件类型`, 'success')
        }
      } catch (e) { this.showToast(String(e), 'error') }
      this.detecting = false
    },
    toggleFileType(ext) {
      const idx = this.config.selectedExtensions.indexOf(ext)
      idx >= 0 ? this.config.selectedExtensions.splice(idx, 1) : this.config.selectedExtensions.push(ext)
    },
    selectAllTypes() { this.config.selectedExtensions = this.fileTypes.map(ft => ft.ext) },
    deselectAllTypes() { this.config.selectedExtensions = [] },
    selectCodeTypes() {
      this.config.selectedExtensions = this.fileTypes
        .filter(ft => !NON_CODE_EXTS.includes(ft.ext) && ft.language !== 'Unknown')
        .map(ft => ft.ext)
    },

    // ===== 忽略规则 =====
    addIgnore() {
      const p = this.newIgnore.trim()
      if (p && !this.config.customIgnorePatterns.includes(p)) {
        this.config.customIgnorePatterns.push(p)
        this.newIgnore = ''
      }
    },

    // ===== 核心处理流程 =====
    async processAllFiles() {
      this.processing = true; this.progress = 0; this.progressText = '正在扫描目录...'

      const dirFiles = []
      for (const dir of this.config.directories) {
        const result = await invoke('scan_directory', {
          dirPath: dir.path,
          customIgnore: this.config.customIgnorePatterns,
          useGitignore: this.config.useGitignore,
        })
        const filtered = result.files.filter(f => this.config.selectedExtensions.includes(f.ext))
        const sorted = smartSortFiles(filtered)
        dirFiles.push({ path: dir.path, ratio: dir.ratio, files: sorted })
      }

      const totalFiles = dirFiles.reduce((s, d) => s + d.files.length, 0)
      if (totalFiles === 0) {
        this.processing = false
        this.showToast('未找到匹配的代码文件', 'warning')
        return null
      }

      let processedCount = 0
      const dirResults = []

      for (const dir of dirFiles) {
        const allLines = []
        for (let i = 0; i < dir.files.length; i += BATCH_SIZE) {
          const batch = dir.files.slice(i, i + BATCH_SIZE)
          this.progressText = `正在处理: ${dir.path.split(/[/\\]/).pop()} (${processedCount}/${totalFiles})`

          const readResult = await invoke('read_files_content', {
            files: batch.map(f => ({ path: f.path, relative_path: f.relative_path, name: f.name, ext: f.ext }))
          })

          for (const fc of readResult.files) {
            if (fc.error || !fc.content) continue
            const result = processFileContent(fc.content, fc.ext, this.config.cleanOptions)
            allLines.push(...result.lines)
            processedCount++
          }
          this.progress = Math.round((processedCount / totalFiles) * 100)
        }
        dirResults.push({ path: dir.path, ratio: dir.ratio, totalLines: allLines.length, allLines })
      }

      // 按比例分配
      const totalLinesNeeded = this.config.maxPages * this.config.linesPerPage
      const totalRatio = dirResults.reduce((s, d) => s + d.ratio, 0)
      let remaining = totalLinesNeeded
      const finalLines = []

      for (const dir of dirResults) {
        const idealLines = Math.round(totalLinesNeeded * (dir.ratio / totalRatio))
        const allocated = Math.min(idealLines, dir.totalLines, remaining)
        finalLines.push(...dir.allLines.slice(0, allocated))
        remaining -= allocated
      }
      if (remaining > 0) {
        for (const dir of dirResults) {
          const used = Math.min(Math.round(totalLinesNeeded * (dir.ratio / totalRatio)), dir.totalLines)
          if (dir.totalLines > used) {
            const extra = Math.min(remaining, dir.totalLines - used)
            finalLines.push(...dir.allLines.slice(used, used + extra))
            remaining -= extra
            if (remaining <= 0) break
          }
        }
      }

      // 防御性过滤：代码开头不可能是独立的闭合符号
      // 跳过开头处的 } ] ) , 等不可能作为程序起始的行
      while (finalLines.length > 0) {
        const first = finalLines[0].trim()
        if (/^[}\])\,;]+$/.test(first)) {
          finalLines.shift()
        } else {
          break
        }
      }

      this.allCodeLines = finalLines
      this.stats = {
        totalFiles,
        totalLines: finalLines.length,
        estimatedPages: Math.ceil(finalLines.length / this.config.linesPerPage),
      }

      this.processing = false
      this.progress = 100
      this.progressText = '处理完成'

      return {
        totalLines: finalLines.length,
        totalPages: Math.ceil(finalLines.length / this.config.linesPerPage),
        totalFiles,
        dirResults,
      }
    },

    // ===== 预览 =====
    async refreshPreview() {
      this.previewing = true
      try {
        const result = await this.processAllFiles()
        if (!result) { this.previewing = false; return }

        this.previewData = {
          totalLines: this.allCodeLines.length,
          totalPages: Math.ceil(this.allCodeLines.length / this.config.linesPerPage),
        }
        this.previewLines = this.allCodeLines
        this.showToast('预览已刷新', 'success')
      } catch (e) { this.showToast(String(e), 'error') }
      this.previewing = false
    },

    // ===== 生成文档 =====
    async generateDocument() {
      // 验证必填项
      if (!this.config.directories.length) {
        this.showToast('请先添加代码目录', 'warning'); return
      }
      if (!this.config.selectedExtensions.length) {
        this.showToast('请先检测并选择文件类型', 'warning'); return
      }
      if (!this.config.softwareName.trim()) {
        this.showToast('请填写软件全称', 'warning'); return
      }

      const outputPath = await save({
        title: '保存文档',
        defaultPath: `${this.config.softwareName}_源代码.docx`,
        filters: [{ name: 'Word 文档', extensions: ['docx'] }],
      })
      if (!outputPath) return

      this.generating = true
      try {
        if (this.allCodeLines.length === 0) {
          const result = await this.processAllFiles()
          if (!result) { this.generating = false; return }
        }

        this.progressText = '正在生成 Word 文档...'
        this.processing = true; this.progress = 50

        const genResult = await generateDocxBuffer({
          softwareName: this.config.softwareName,
          version: this.config.version,
          codeLines: this.allCodeLines,
          linesPerPage: this.config.linesPerPage,
          maxPages: this.config.maxPages,
          fontName: this.config.fontName,
          fontSize: this.config.fontSize,
        })

        this.progress = 80
        this.progressText = '正在保存文件...'

        await writeFile(outputPath, genResult.buffer)

        this.lastResult = {
          totalPages: genResult.totalPages,
          totalLines: genResult.totalLines,
          isTruncated: genResult.isTruncated,
        }

        this.progress = 100
        this.processing = false
        this.showToast(`文档生成成功！共 ${genResult.totalPages} 页`, 'success')
      } catch (e) {
        this.showToast(String(e), 'error')
        this.processing = false
      }
      this.generating = false
    },

    // ===== 配置导入导出 =====
    async exportConfig() {
      const path = await save({
        title: '导出配置', defaultPath: '软著配置.json',
        filters: [{ name: 'JSON', extensions: ['json'] }],
      })
      if (!path) return
      await writeTextFile(path, JSON.stringify(this.config, null, 2))
      this.showToast('配置已导出', 'success')
    },
    async importConfig() {
      const path = await open({
        title: '导入配置',
        filters: [{ name: 'JSON', extensions: ['json'] }],
      })
      if (!path) return
      try {
        const content = await readTextFile(path)
        const loaded = JSON.parse(content)
        this.config = { ...this.config, ...loaded }
        this.showToast('配置已导入', 'success')
        if (this.config.directories.length > 0) this.detectTypes()
      } catch (e) { this.showToast('配置文件格式错误', 'error') }
    },

    // ===== 工具 =====
    fmt(n) { return n ? n.toLocaleString() : '0' },
    showToast(message, type = 'info') {
      this.toast = { show: true, message, type }
      setTimeout(() => { this.toast.show = false }, 3000)
    },
  },
}
</script>
