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
          <div class="chat-header-actions">
            <label class="chat-think-toggle" title="思考模式">
              <input type="checkbox" v-model="thinkingMode" />
              <Brain :size="12" />
              <span>思考</span>
            </label>
            <button class="chat-clear-btn" @click="chatMessages = []" title="清空对话">
              <Trash2 :size="12" />
            </button>
          </div>
        </div>
        <div class="chat-model-bar">
          <select class="chat-model-select" v-model="selectedConfigId">
            <option :value="null" disabled>选择模型...</option>
            <option v-for="c in configs" :key="c.id" :value="c.id">{{ c.name || c.model }}</option>
          </select>
        </div>
        <div class="chat-messages" ref="chatMessagesRef">
          <div v-if="chatMessages.length === 0" class="chat-empty">
            <Bot :size="28" style="opacity:0.3;" />
            <p>选择模型后开始对话</p>
          </div>
          <div v-for="(msg, i) in chatMessages" :key="i" :class="['chat-msg', msg.role]">
            <div v-if="msg.role === 'user'" class="chat-msg-bubble user">{{ msg.content }}</div>
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
        <div class="chat-input-area">
          <textarea ref="chatInputRef" class="chat-input" v-model="chatInput"
            placeholder="输入消息... (Enter 发送)" rows="1"
            @keydown="onChatKeydown" @input="autoResizeChat" :disabled="chatLoading"
          ></textarea>
          <button class="chat-send-btn" @click="sendChat"
            :disabled="!chatInput.trim() || chatLoading || !selectedConfigId" title="发送">
            <Send :size="16" />
          </button>
        </div>
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
import { ClipboardList, MessageCircle, Bot, Send, Brain, Trash2 } from 'lucide-vue-next'
import { invoke } from '@tauri-apps/api/core'
import { loadAllConfigs, loadActiveConfigId } from '../core/llm/llm-service.js'
import { marked } from 'marked'

marked.setOptions({ breaks: true, gfm: true })

export default {
  name: 'AiSidebar',
  components: { ClipboardList, MessageCircle, Bot, Send, Brain, Trash2 },
  data() {
    return {
      activeTab: null,
      logs: [],
      configs: [],
      selectedConfigId: null,
      chatMessages: [],
      chatInput: '',
      chatLoading: false,
      thinkingMode: false,
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
  methods: {
    toggleTab(tab) {
      this.activeTab = this.activeTab === tab ? null : tab
      if (tab === 'chat' && this.configs.length === 0) this.loadConfigs()
    },
    async loadConfigs() {
      this.configs = await loadAllConfigs()
      const activeId = await loadActiveConfigId()
      if (activeId && this.configs.find(c => c.id === activeId)) {
        this.selectedConfigId = activeId
      } else if (this.configs.length > 0) {
        this.selectedConfigId = this.configs[0].id
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
    async sendChat() {
      const text = this.chatInput.trim()
      if (!text || this.chatLoading || !this.selectedConfigId) return
      const config = this.configs.find(c => c.id === this.selectedConfigId)
      if (!config) return
      this.chatMessages.push({ role: 'user', content: text })
      this.chatInput = ''
      this.$nextTick(() => { if (this.$refs.chatInputRef) this.$refs.chatInputRef.style.height = 'auto' })
      this.scrollChatBottom()
      this.chatLoading = true
      try {
        const msgs = this.chatMessages.filter(m => m.role === 'user' || m.role === 'assistant').map(m => ({ role: m.role, content: m.content }))
        const result = await this.callChatLlm(config, msgs)
        this.chatMessages.push({ role: 'assistant', content: result.content || '', thinking: result.thinking || null })
      } catch (err) {
        this.chatMessages.push({ role: 'assistant', content: `**错误**：${err.message || err}` })
      } finally {
        this.chatLoading = false
        this.scrollChatBottom()
      }
    },
    async callChatLlm(config, messages) {
      const { baseUrl, apiKey, model, providerId } = config
      const base = baseUrl.replace(/\/+$/, '')
      const isGemini = providerId === 'gemini' || base.includes('generativelanguage.googleapis.com')
      const reqBody = { model, messages, temperature: 0.7, max_tokens: 8192 }
      if (this.thinkingMode && (providerId === 'deepseek' || model.includes('deepseek'))) reqBody.enable_thinking = true
      const result = await invoke('llm_request', { req: { url: `${base}/chat/completions`, apiKey, body: JSON.stringify(reqBody), isGemini } })
      if (!result.success) throw new Error(result.error || `API 错误 (${result.status})`)
      if (!result.body || !result.body.trim()) throw new Error('返回空响应')
      const data = JSON.parse(result.body)
      if (!data.choices || data.choices.length === 0) throw new Error('返回空结果')
      const msg = data.choices[0].message || {}
      return { content: msg.content || msg.reasoning_content || msg.text || '', thinking: msg.reasoning_content || msg.thinking || null }
    },
  },
}
</script>
