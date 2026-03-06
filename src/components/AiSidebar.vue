<template>
  <div class="ai-sidebar">
    <!-- 面板（在 Tab 左侧，IDEA 风格） -->
    <div :class="['ai-sidebar-panel', { open: !!activeTab }]">
      <!-- 日志面板 -->
      <div v-show="activeTab === 'logs'" class="ai-sidebar-content">
        <div class="ai-sidebar-panel-header">
          <span><ClipboardList :size="14" style="vertical-align:-2px;margin-right:4px;" /> 实时日志</span>
          <button class="chat-clear-btn" @click="logs = []" title="清空日志">
            <Trash2 :size="12" />
          </button>
        </div>
        <div class="ai-sidebar-log-list" ref="logListRef">
          <div v-if="logs.length === 0" class="ai-sidebar-empty">
            <ClipboardList :size="28" style="opacity:0.3;" />
            <p>暂无日志，AI 补充时将在此显示进度</p>
          </div>
          <div v-for="(log, i) in logs" :key="i" :class="['ai-log-item', 'ai-log-' + log.level]">
            <span class="ai-log-time">{{ log.time }}</span>
            <span>{{ log.msg }}</span>
          </div>
        </div>
      </div>

      <!-- 对话面板 -->
      <div v-show="activeTab === 'chat'" class="ai-sidebar-content">
        <div class="ai-sidebar-panel-header">
          <span><MessageCircle :size="14" style="vertical-align:-2px;margin-right:4px;" /> AI 对话</span>
          <button class="chat-clear-btn" @click="chatMessages = []; chatImages = []" title="清空对话">
            <Trash2 :size="12" />
          </button>
        </div>
        <div class="chat-messages" ref="chatMessagesRef">
          <div v-if="chatMessages.length === 0" class="chat-empty">
            <Bot :size="28" style="opacity:0.3;" />
            <p>选择模型后开始对话</p>
          </div>
          <div v-for="(msg, i) in chatMessages" :key="i" :class="['chat-msg', msg.role]">
            <div v-if="msg.role === 'user'" class="chat-msg-bubble user">
              <!-- 用户图片 -->
              <div v-if="msg.images && msg.images.length" class="chat-user-images">
                <img v-for="(img, j) in msg.images" :key="j" :src="img" class="chat-user-img" @click="previewImage(img)" />
              </div>
              {{ msg.content }}
            </div>
            <div v-else class="chat-msg-bubble assistant">
              <details v-if="msg.thinking" class="chat-thinking-block">
                <summary><Brain :size="12" /> 思考过程</summary>
                <div class="chat-thinking-content" v-html="renderMd(msg.thinking)"></div>
              </details>
              <div class="chat-md-content" v-html="renderMd(msg.content)"></div>
            </div>
          </div>
          <div v-if="chatLoading" class="chat-msg assistant">
            <div class="chat-msg-bubble assistant chat-loading">
              <span class="chat-dot-pulse"></span> 正在思考...
            </div>
          </div>
        </div>
        <!-- 模型选择 + 思考模式（同一行） -->
        <div class="chat-model-bar">
          <select class="chat-model-select" v-model="selectedProviderId" @change="onProviderSelect" title="选择厂商">
            <option :value="null" disabled>厂商...</option>
            <option v-for="p in providerConfigs" :key="p.id" :value="p.id">{{ p.label }}</option>
          </select>
          <select class="chat-model-select" v-model="selectedModelId" :title="selectedModelId || '选择模型'">
            <option v-for="m in currentProviderModels" :key="m.id" :value="m.id">{{ m.id }}</option>
          </select>
          <label class="chat-think-toggle" title="思考模式">
            <input type="checkbox" v-model="thinkingMode" />
            <Brain :size="12" />
          </label>
        </div>
        <!-- 图片预览条 -->
        <div v-if="chatImages.length > 0" class="chat-image-preview-bar">
          <div v-for="(img, i) in chatImages" :key="i" class="chat-image-thumb-wrap">
            <img :src="img" class="chat-image-thumb" />
            <button class="chat-image-remove" @click="chatImages.splice(i, 1)" title="移除">
              <X :size="10" />
            </button>
          </div>
        </div>
        <div class="chat-input-area">
          <button class="chat-attach-btn" @click="pickImage" :disabled="chatLoading" title="添加图片">
            <ImagePlus :size="16" />
          </button>
          <textarea ref="chatInputRef" class="chat-input" v-model="chatInput"
            placeholder="输入消息... (Enter 发送)" rows="1"
            @keydown="onChatKeydown" @input="autoResizeChat" :disabled="chatLoading"
            @paste="onPaste"
          ></textarea>
          <button class="chat-send-btn" @click="sendChat"
            :disabled="(!chatInput.trim() && chatImages.length === 0) || chatLoading || !selectedProviderId || !selectedModelId" title="发送">
            <Send :size="16" />
          </button>
        </div>
        <input type="file" ref="imageInputRef" accept="image/*" multiple style="display:none;" @change="onImageSelected" />
      </div>
    </div>

    <!-- 纵向标签按钮（始终最右侧，IDEA 风格） -->
    <div class="ai-sidebar-tabs">
      <button
        :class="['ai-sidebar-tab', { active: activeTab === 'logs' }]"
        @click="toggleTab('logs')"
        title="实时日志"
      >
        <ClipboardList :size="16" />
        <span class="ai-sidebar-tab-label">日志</span>
      </button>
      <button
        :class="['ai-sidebar-tab', { active: activeTab === 'chat' }]"
        @click="toggleTab('chat')"
        title="AI 对话"
      >
        <MessageCircle :size="16" />
        <span class="ai-sidebar-tab-label">对话</span>
      </button>
    </div>
  </div>
</template>

<script>
import { ClipboardList, MessageCircle, Bot, Send, Brain, Trash2, ImagePlus, X } from 'lucide-vue-next'
import { invoke } from '@tauri-apps/api/core'
import { loadProviderConfigs, loadActiveSelection, getResolvedConfig } from '../core/llm/llm-service.js'
import { marked } from 'marked'

marked.setOptions({ breaks: true, gfm: true })

export default {
  name: 'AiSidebar',
  components: { ClipboardList, MessageCircle, Bot, Send, Brain, Trash2, ImagePlus, X },
  data() {
    return {
      activeTab: null,
      logs: [],
      providerConfigs: [],
      selectedProviderId: null,
      selectedModelId: null,
      chatMessages: [],
      chatInput: '',
      chatLoading: false,
      thinkingMode: false,
      chatImages: [],   // base64 data URLs for pending images
    }
  },
  mounted() {
    this._logHandler = (e) => {
      this.logs.push(e.detail)
      if (this.activeTab === 'logs') {
        this.$nextTick(() => {
          const el = this.$refs.logListRef
          if (el) el.scrollTop = el.scrollHeight
        })
      }
    }
    window.addEventListener('ai-log', this._logHandler)

    this._aiStartHandler = () => {
      this.activeTab = 'logs'
    }
    window.addEventListener('ai-fill-start', this._aiStartHandler)
  },
  beforeUnmount() {
    if (this._logHandler) window.removeEventListener('ai-log', this._logHandler)
    if (this._aiStartHandler) window.removeEventListener('ai-fill-start', this._aiStartHandler)
  },
  computed: {
    currentProviderModels() {
      const p = this.providerConfigs.find(p => p.id === this.selectedProviderId)
      return p ? p.models : []
    },
    currentModelMultimodal() {
      const m = this.currentProviderModels.find(m => m.id === this.selectedModelId)
      return m?.capabilities?.multimodal || false
    },
  },
  methods: {
    toggleTab(tab) {
      this.activeTab = this.activeTab === tab ? null : tab
      if (tab === 'chat' && this.providerConfigs.length === 0) this.loadConfigs()
    },
    onProviderSelect() {
      const p = this.providerConfigs.find(p => p.id === this.selectedProviderId)
      if (p && p.models.length > 0) {
        this.selectedModelId = p.activeModelId || p.models[0].id
      }
    },
    async loadConfigs() {
      this.providerConfigs = await loadProviderConfigs()
      const { providerId, modelId } = await loadActiveSelection()
      if (providerId) {
        const found = this.providerConfigs.find(p => p.id === providerId)
        if (found) {
          this.selectedProviderId = found.id
          this.selectedModelId = modelId || found.activeModelId || (found.models[0]?.id || '')
        }
      }
      if (!this.selectedProviderId && this.providerConfigs.length > 0) {
        this.selectedProviderId = this.providerConfigs[0].id
        this.selectedModelId = this.providerConfigs[0].models[0]?.id || ''
      }
    },
    renderMd(text) {
      if (!text) return ''
      try { return marked.parse(text) }
      catch { return text.replace(/</g, '&lt;').replace(/\n/g, '<br>') }
    },
    autoResizeChat() {
      const el = this.$refs.chatInputRef
      if (!el) return
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, 120) + 'px'
    },
    onChatKeydown(e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendChat() }
    },
    scrollChatBottom() {
      this.$nextTick(() => { const el = this.$refs.chatMessagesRef; if (el) el.scrollTop = el.scrollHeight })
    },

    // ========= 图片相关 =========
    pickImage() {
      this.$refs.imageInputRef?.click()
    },
    onImageSelected(e) {
      const files = Array.from(e.target.files || [])
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue
        this.readFileAsDataUrl(file)
      }
      e.target.value = ''
    },
    onPaste(e) {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          const file = item.getAsFile()
          if (file) this.readFileAsDataUrl(file)
        }
      }
    },
    readFileAsDataUrl(file) {
      // 压缩图片：限制最大尺寸 1024px，JPEG quality 0.7
      // 避免大图 base64 过大导致本地模型 OOM/503
      const maxDim = 1024
      const quality = 0.7
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(url)
        let w = img.width, h = img.height
        if (w > maxDim || h > maxDim) {
          if (w > h) { h = Math.round(h * maxDim / w); w = maxDim }
          else { w = Math.round(w * maxDim / h); h = maxDim }
        }
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, w, h)
        const dataUrl = canvas.toDataURL('image/jpeg', quality)
        if (this.chatImages.length < 5) {
          this.chatImages.push(dataUrl)
        }
      }
      img.onerror = () => URL.revokeObjectURL(url)
      img.src = url
    },
    previewImage(src) {
      window.open(src, '_blank')
    },

    // ========= 发送消息 =========
    async sendChat() {
      const text = this.chatInput.trim()
      const images = [...this.chatImages]
      if ((!text && images.length === 0) || this.chatLoading || !this.selectedProviderId || !this.selectedModelId) return
      const provider = this.providerConfigs.find(p => p.id === this.selectedProviderId)
      if (!provider) return
      const config = getResolvedConfig(provider, this.selectedModelId)
      this.chatMessages.push({ role: 'user', content: text, images: images.length > 0 ? images : undefined })
      this.chatInput = ''
      this.chatImages = []
      this.$nextTick(() => { if (this.$refs.chatInputRef) this.$refs.chatInputRef.style.height = 'auto' })
      this.scrollChatBottom()
      this.chatLoading = true
      try {
        const msgs = this.buildApiMessages()
        const result = await this.callChatLlm(config, msgs)
        this.chatMessages.push({ role: 'assistant', content: result.content || '', thinking: result.thinking || null })
      } catch (err) {
        this.chatMessages.push({ role: 'assistant', content: `**错误**：${err.message || err}` })
      } finally {
        this.chatLoading = false
        this.scrollChatBottom()
      }
    },

    buildApiMessages() {
      return this.chatMessages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => {
          if (m.role === 'user' && m.images && m.images.length > 0) {
            // 多模态格式
            const content = []
            for (const img of m.images) {
              const match = img.match(/^data:(image\/\w+);base64,(.+)$/)
              if (match) {
                content.push({
                  type: 'image_url',
                  image_url: { url: img }
                })
              }
            }
            if (m.content) {
              content.push({ type: 'text', text: m.content })
            }
            return { role: 'user', content }
          }
          return { role: m.role, content: m.content }
        })
    },

    async callChatLlm(config, messages) {
      const { baseUrl, apiKey, model, providerId } = config
      const base = baseUrl.replace(/\/+$/, '')
      const isGemini = providerId === 'gemini' || base.includes('generativelanguage.googleapis.com')
      const isLocal = providerId === 'ollama' || providerId === 'lmstudio' || providerId === 'vllm'

      // 检测是否包含图片消息
      const hasImages = messages.some(m => Array.isArray(m.content) && m.content.some(c => c.type === 'image_url'))

      const reqBody = {
        model,
        messages,
        temperature: 0.7,
        max_tokens: hasImages ? 4096 : 8192,
        stream: false, // 显式禁用流式，Ollama 中避免意外超时
      }

      // 本地 Ollama 视觉模型不支持 response_format 等额外参数
      if (this.thinkingMode && (providerId === 'deepseek' || model.includes('deepseek'))) reqBody.enable_thinking = true

      const result = await invoke('llm_request', { req: { url: `${base}/chat/completions`, apiKey, body: JSON.stringify(reqBody), isGemini } })

      if (!result.success) {
        // 解析 Ollama 的详细错误信息
        let errMsg = `API 错误 (${result.status})`
        if (result.error) {
          // 尝试解析 JSON 错误体
          try {
            const errBody = JSON.parse(result.error.replace(/^HTTP \d+: /, ''))
            errMsg = errBody.error?.message || errBody.error || errMsg
          } catch {
            errMsg = result.error
          }
        }
        if (result.status === 503) errMsg += '\n\n💡 503 通常表示模型正在加载或显存不足。请等待模型加载完成，或尝试使用更小的图片/更简短的提示。'
        throw new Error(errMsg)
      }
      if (!result.body || !result.body.trim()) throw new Error('返回空响应')
      const data = JSON.parse(result.body)
      if (!data.choices || data.choices.length === 0) throw new Error('返回空结果')
      const msg = data.choices[0].message || {}
      return { content: msg.content || msg.reasoning_content || msg.text || '', thinking: msg.reasoning_content || msg.thinking || null }
    },
  },
}
</script>

<style scoped>
/* 图片预览条 */
.chat-image-preview-bar {
  display: flex;
  gap: 6px;
  padding: 6px 10px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
  flex-wrap: wrap;
}
.chat-image-thumb-wrap {
  position: relative;
  width: 48px;
  height: 48px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--border-color);
}
.chat-image-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.chat-image-remove {
  position: absolute;
  top: -1px;
  right: -1px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--danger-500);
  color: #fff;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  opacity: 0;
  transition: opacity 0.15s;
}
.chat-image-thumb-wrap:hover .chat-image-remove {
  opacity: 1;
}

/* 附件按钮 */
.chat-attach-btn {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  flex-shrink: 0;
}
.chat-attach-btn:hover:not(:disabled) {
  border-color: var(--primary-400);
  color: var(--primary-400);
}
.chat-attach-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* 用户消息中的图片 */
.chat-user-images {
  display: flex;
  gap: 4px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}
.chat-user-img {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 6px;
  cursor: pointer;
  border: 1px solid rgba(255,255,255,0.2);
  transition: transform 0.15s;
}
.chat-user-img:hover {
  transform: scale(1.05);
}
</style>
