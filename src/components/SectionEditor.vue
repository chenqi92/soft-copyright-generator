<template>
  <div class="section-editor">
    <!-- 错误状态提示条 + 重试按钮 -->
    <div v-if="section.error" class="section-error-bar">
      <div class="section-error-text">
        <span class="section-error-icon">✕</span>
        <span>生成失败: {{ section.error }}</span>
      </div>
      <button class="btn btn-primary btn-sm section-retry-btn" @click="$emit('generate-single', section.id)">
        <RefreshCw :size="12" /> 重试
      </button>
    </div>

    <!-- 正在生成中 -->
    <div v-if="section.generating" class="section-generating-bar">
      <span class="spinner"></span>
      <span>正在生成...</span>
    </div>

    <!-- 操作按钮行 -->
    <div class="section-editor-toolbar">
      <button class="btn btn-secondary btn-sm" @click="$emit('generate-single', section.id)" title="单独生成此章节">
        <Bot :size="12" /> {{ section.error ? '重新生成' : '生成' }}
      </button>
      <button
        v-if="section.type === 'diagram' || section.type === 'image'"
        class="btn btn-secondary btn-sm"
        @click="triggerImageUpload"
        title="上传图片"
      >
        <ImageIcon :size="12" /> 上传图片
      </button>
      <input
        ref="imageInput"
        type="file"
        accept="image/*"
        style="display:none;"
        @change="handleImageUpload"
      />
    </div>

    <!-- 图表类型: Mermaid 预览 -->
    <template v-if="section.type === 'diagram'">
      <!-- Mermaid 编辑器 -->
      <div class="mermaid-editor-wrapper" v-if="editing">
        <textarea
          class="mermaid-editor"
          :value="localMermaidCode"
          @input="localMermaidCode = $event.target.value"
          @blur="saveMermaid"
          placeholder="输入 Mermaid 代码..."
          rows="8"
        ></textarea>
        <button class="btn btn-primary btn-sm" style="margin-top:4px;" @click="saveMermaid">
          确认并渲染
        </button>
      </div>

      <!-- Mermaid 渲染结果 -->
      <div v-if="renderedSvg" class="mermaid-preview" v-html="renderedSvg" @click="editing = true"></div>
      <div v-else-if="section.mermaidCode && !editing && !mermaidError" class="mermaid-placeholder" @click="editing = true">
        <span class="spinner" style="margin-right:6px;"></span> 渲染中...
      </div>
      <div v-else-if="!editing && !mermaidError" class="mermaid-placeholder" @click="editing = true">
        <ImageIcon :size="20" style="opacity:0.3;" />
        <span>点击编辑 Mermaid 代码，或使用 AI 生成</span>
      </div>

      <!-- Mermaid 渲染错误 — 醒目的错误条 + 重试/编辑按钮 -->
      <div v-if="mermaidError" class="mermaid-error-block">
        <div class="mermaid-error-header">
          <span class="section-error-icon">⚠</span>
          <span>Mermaid 图表渲染失败</span>
        </div>
        <div class="mermaid-error-detail">{{ mermaidError }}</div>
        <div class="mermaid-error-actions">
          <button class="btn btn-primary btn-sm" @click="$emit('generate-single', section.id)" title="让AI重新生成此图表">
            <RefreshCw :size="12" /> 重新生成
          </button>
          <button class="btn btn-secondary btn-sm" @click="editing = true">
            <Edit3 :size="12" /> 编辑代码
          </button>
          <button class="btn btn-secondary btn-sm" @click="triggerImageUpload">
            <ImageIcon :size="12" /> 上传替代图片
          </button>
        </div>
      </div>

      <!-- 用户上传的图片 -->
      <div v-if="section.imageData" class="uploaded-image-wrapper">
        <img :src="section.imageData" class="uploaded-image" />
        <button class="btn btn-danger btn-sm btn-icon uploaded-image-remove" @click="removeImage">
          <X :size="12" />
        </button>
      </div>
    </template>

    <!-- 图片类型 -->
    <template v-else-if="section.type === 'image'">
      <div v-if="section.imageData" class="uploaded-image-wrapper">
        <img :src="section.imageData" class="uploaded-image" />
        <button class="btn btn-danger btn-sm btn-icon uploaded-image-remove" @click="removeImage">
          <X :size="12" />
        </button>
      </div>
      <div v-else class="image-placeholder" @click="triggerImageUpload">
        <ImageIcon :size="24" style="opacity:0.3;" />
        <span>点击上传图片</span>
      </div>
    </template>

    <!-- 文本/表格内容编辑 -->
    <div class="content-editor-wrapper">
      <div v-if="!section.content && !editing" class="content-empty" @click="editing = true">
        <span style="color:var(--text-muted);font-size:13px;">{{ section.type === 'diagram' ? '图表说明文字（可选）' : '点击编辑内容，或使用 AI 生成' }}</span>
      </div>
      <textarea
        v-else-if="editing"
        class="content-textarea"
        :value="localContent"
        @input="localContent = $event.target.value"
        @blur="saveContent"
        :placeholder="section.type === 'diagram' ? '输入图表说明文字...' : '输入章节内容...'"
        :rows="Math.max(4, (localContent || '').split('\n').length + 1)"
      ></textarea>
      <div
        v-else
        class="content-preview"
        @click="startEdit"
        v-html="renderMarkdown(section.content)"
      ></div>
    </div>
  </div>
</template>

<script>
import { Bot, Image as ImageIcon, X, RefreshCw, Edit3 } from 'lucide-vue-next'
import mermaid from 'mermaid'

// 初始化 Mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
})

let mermaidIdCounter = 0

export default {
  name: 'SectionEditor',
  components: { Bot, ImageIcon, X, RefreshCw, Edit3 },
  props: {
    section: { type: Object, required: true },
  },
  emits: ['update-content', 'upload-image', 'generate-single'],
  data() {
    return {
      editing: false,
      localContent: '',
      localMermaidCode: '',
      renderedSvg: '',
      mermaidError: '',
    }
  },
  watch: {
    'section.content'(val) {
      if (!this.editing) this.localContent = val || ''
    },
    'section.mermaidCode': {
      immediate: true,
      handler(val) {
        if (val) {
          this.localMermaidCode = val
          this.renderMermaid(val)
        }
      },
    },
  },
  mounted() {
    this.localContent = this.section.content || ''
    this.localMermaidCode = this.section.mermaidCode || ''
    if (this.section.mermaidCode) {
      this.renderMermaid(this.section.mermaidCode)
    }
  },
  methods: {
    startEdit() {
      this.localContent = this.section.content || ''
      this.editing = true
    },
    saveContent() {
      this.editing = false
      this.$emit('update-content', {
        sectionId: this.section.id,
        content: this.localContent,
      })
    },
    saveMermaid() {
      this.editing = false
      this.$emit('update-content', {
        sectionId: this.section.id,
        mermaidCode: this.localMermaidCode,
      })
      if (this.localMermaidCode) {
        this.renderMermaid(this.localMermaidCode)
      }
    },
    async renderMermaid(code) {
      if (!code) return
      this.mermaidError = ''
      try {
        const id = `mermaid-${Date.now()}-${++mermaidIdCounter}`
        const { svg } = await mermaid.render(id, code)
        this.renderedSvg = svg
      } catch (e) {
        this.mermaidError = e.message || String(e)
        this.renderedSvg = ''
      }
    },
    triggerImageUpload() {
      this.$refs.imageInput?.click()
    },
    handleImageUpload(event) {
      const file = event.target.files[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (e) => {
        this.$emit('upload-image', {
          sectionId: this.section.id,
          imageData: e.target.result,
        })
      }
      reader.readAsDataURL(file)
      event.target.value = ''
    },
    removeImage() {
      this.$emit('upload-image', {
        sectionId: this.section.id,
        imageData: null,
      })
    },
    renderMarkdown(text) {
      if (!text) return ''
      let html = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
      html = this.renderMarkdownTable(html)
      html = html.replace(/^#### (.+)$/gm, '<h5 style="margin:8px 0 4px;font-size:13px;font-weight:600;">$1</h5>')
      html = html.replace(/^### (.+)$/gm, '<h4 style="margin:12px 0 4px;font-size:14px;font-weight:600;">$1</h4>')
      html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      html = html.replace(/^[-*] (.+)$/gm, '<li style="margin-left:16px;font-size:13px;">$1</li>')
      html = html.replace(/^\d+\. (.+)$/gm, '<li style="margin-left:16px;font-size:13px;">$1</li>')
      html = html.replace(/```[\w]*\n([\s\S]*?)```/g, '<pre style="background:var(--bg-tertiary);padding:8px;border-radius:4px;font-size:12px;overflow-x:auto;">$1</pre>')
      html = html.replace(/`([^`]+)`/g, '<code style="background:var(--bg-tertiary);padding:1px 4px;border-radius:3px;font-size:12px;">$1</code>')
      html = html.replace(/\n/g, '<br>')
      return html
    },
    renderMarkdownTable(text) {
      const lines = text.split('\n')
      let result = []
      let inTable = false
      let tableHtml = ''
      let isFirstRow = true

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        if (line.startsWith('|') && line.endsWith('|')) {
          if (/^\|[\s-|:]+\|$/.test(line)) continue
          if (!inTable) {
            inTable = true
            isFirstRow = true
            tableHtml = '<table class="detail-table" style="width:100%;margin:8px 0;"><thead>'
          }
          const cells = line.split('|').filter(c => c !== '').map(c => c.trim())
          if (isFirstRow) {
            tableHtml += '<tr>' + cells.map(c => `<th>${c}</th>`).join('') + '</tr></thead><tbody>'
            isFirstRow = false
          } else {
            tableHtml += '<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>'
          }
        } else {
          if (inTable) {
            tableHtml += '</tbody></table>'
            result.push(tableHtml)
            inTable = false
            tableHtml = ''
            isFirstRow = true
          }
          result.push(line)
        }
      }
      if (inTable) {
        tableHtml += '</tbody></table>'
        result.push(tableHtml)
      }
      return result.join('\n')
    },
  },
}
</script>

<style scoped>
.section-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
/* === 错误状态条 === */
.section-error-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--danger-50, #fef2f2);
  border: 1px solid var(--danger-200, #fecaca);
  border-radius: 8px;
  gap: 8px;
}
.section-error-text {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--danger-700, #b91c1c);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.section-error-icon {
  font-size: 14px;
  font-weight: 700;
  flex-shrink: 0;
}
.section-retry-btn {
  flex-shrink: 0;
  animation: pulse-attention 1.5s ease-in-out infinite;
}
@keyframes pulse-attention {
  0%, 100% { box-shadow: 0 0 0 0 rgba(var(--primary-rgb, 59, 130, 246), 0.4); }
  50% { box-shadow: 0 0 0 6px rgba(var(--primary-rgb, 59, 130, 246), 0); }
}
/* === 生成中状态 === */
.section-generating-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--info-50, #eff6ff);
  border: 1px solid var(--info-200, #bfdbfe);
  border-radius: 8px;
  font-size: 12px;
  color: var(--info-700, #1d4ed8);
}
/* === Mermaid 渲染错误块 === */
.mermaid-error-block {
  background: var(--danger-50, #fef2f2);
  border: 1px solid var(--danger-200, #fecaca);
  border-radius: 8px;
  padding: 12px;
}
.mermaid-error-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--danger-700, #b91c1c);
  margin-bottom: 4px;
}
.mermaid-error-detail {
  font-size: 11px;
  color: var(--danger-500, #ef4444);
  margin-bottom: 8px;
  max-height: 60px;
  overflow-y: auto;
  word-break: break-all;
  line-height: 1.4;
}
.mermaid-error-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
/* === 原有样式 === */
.section-editor-toolbar {
  display: flex;
  gap: 4px;
  align-items: center;
}
.mermaid-editor-wrapper {
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  padding: 8px;
  background: var(--bg-secondary);
}
.mermaid-editor {
  width: 100%;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  padding: 8px;
  background: var(--bg-primary);
  color: var(--text-primary);
  resize: vertical;
  line-height: 1.5;
}
.mermaid-preview {
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  padding: 16px;
  background: #fff;
  text-align: center;
  cursor: pointer;
  min-height: 60px;
  overflow-x: auto;
}
.mermaid-preview:hover {
  border-color: var(--primary-400);
}
.mermaid-preview :deep(svg) {
  max-width: 100%;
  height: auto;
}
.mermaid-placeholder {
  border: 2px dashed var(--border-primary);
  border-radius: 6px;
  padding: 24px;
  text-align: center;
  cursor: pointer;
  color: var(--text-muted);
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 60px;
}
.mermaid-placeholder:hover {
  border-color: var(--primary-400);
  color: var(--primary-500);
}
.uploaded-image-wrapper {
  position: relative;
  display: inline-block;
  margin: 8px 0;
}
.uploaded-image {
  max-width: 100%;
  max-height: 400px;
  border: 1px solid var(--border-primary);
  border-radius: 6px;
}
.uploaded-image-remove {
  position: absolute;
  top: 4px;
  right: 4px;
  opacity: 0;
  transition: opacity 0.15s;
}
.uploaded-image-wrapper:hover .uploaded-image-remove {
  opacity: 1;
}
.image-placeholder {
  border: 2px dashed var(--border-primary);
  border-radius: 6px;
  padding: 32px;
  text-align: center;
  cursor: pointer;
  color: var(--text-muted);
  font-size: 13px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.image-placeholder:hover {
  border-color: var(--primary-400);
  color: var(--primary-500);
}
.content-editor-wrapper {
  min-height: 40px;
}
.content-empty {
  padding: 12px;
  border: 1px dashed var(--border-primary);
  border-radius: 6px;
  cursor: pointer;
  text-align: center;
}
.content-empty:hover {
  border-color: var(--primary-400);
}
.content-textarea {
  width: 100%;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  line-height: 1.6;
  border: 1px solid var(--primary-400);
  border-radius: 6px;
  padding: 12px;
  background: var(--bg-primary);
  color: var(--text-primary);
  resize: vertical;
  outline: none;
}
.content-preview {
  padding: 8px 12px;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-primary);
  transition: border-color 0.15s;
}
.content-preview:hover {
  border-color: var(--border-primary);
  background: var(--bg-secondary);
}
</style>
