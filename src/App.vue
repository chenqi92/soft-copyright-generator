<template>
  <div class="app-container" :class="{ 'light-theme': theme === 'light' }" style="height:100vh;display:flex;">
    <!-- Toast -->
    <div v-if="toast.show" :class="['message-toast', toast.type]">{{ toast.message }}</div>

    <!-- 左侧导航栏 -->
    <nav class="app-left-nav">
      <div class="left-nav-top">
        <img src="./assets/logo.svg" class="left-nav-logo" alt="logo" />
        <button
          v-for="tab in tabs" :key="tab.id"
          :class="['left-nav-item', { active: activeTab === tab.id }]"
          @click="activeTab = tab.id"
          :title="tab.label"
        >
          <component :is="tab.icon" :size="18" />
          <span class="left-nav-label">{{ tab.label }}</span>
        </button>
      </div>
      <div class="left-nav-bottom">
        <button
          :class="['left-nav-item', { active: guideEnabled }]"
          @click="toggleGuide"
          :title="guideEnabled ? '关闭引导' : '开启引导'"
        >
          <HelpCircle :size="18" />
          <span class="left-nav-label">引导</span>
        </button>
        <button class="left-nav-item" @click="toggleTheme" :title="theme === 'dark' ? '浅色' : '深色'">
          <Sun v-if="theme === 'dark'" :size="18" />
          <Moon v-else :size="18" />
          <span class="left-nav-label">{{ theme === 'dark' ? '浅色' : '深色' }}</span>
        </button>
      </div>
    </nav>

    <!-- 右侧主区域 -->
    <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;">
      <!-- 主体 + 右侧栏 -->
      <div style="flex:1;display:flex;overflow:hidden;">
        <div style="flex:1;overflow:auto;">
          <keep-alive>
            <component :is="currentView" :key="activeTab" style="height:100%;" />
          </keep-alive>
        </div>
        <AiSidebar />
      </div>
    </div>
  </div>
</template>

<script>
import { Sun, Moon, FileCode, Plug, Database, Bot, HelpCircle } from 'lucide-vue-next'
import { markRaw } from 'vue'
import AiSidebar from './components/AiSidebar.vue'
import CopyrightGenerator from './views/CopyrightGenerator.vue'
import ApiDocGenerator from './views/ApiDocGenerator.vue'
import DbDocGenerator from './views/DbDocGenerator.vue'
import AiSettings from './views/AiSettings.vue'

export default {
  name: 'App',
  components: { AiSidebar, Sun, Moon, HelpCircle, CopyrightGenerator, ApiDocGenerator, DbDocGenerator, AiSettings },
  provide() {
    return {
      showToast: this.showToast,
      getGuideEnabled: () => this.guideEnabled,
    }
  },
  data() {
    return {
      activeTab: 'copyright',
      theme: 'light',
      guideEnabled: localStorage.getItem('guideEnabled') !== 'false',
      toast: { show: false, message: '', type: 'info' },
      tabs: [
        { id: 'copyright', label: '软著代码', icon: markRaw(FileCode) },
        { id: 'api-doc',   label: '接口文档', icon: markRaw(Plug) },
        { id: 'db-doc',    label: '数据库文档', icon: markRaw(Database) },
        { id: 'ai-settings', label: 'AI 设置', icon: markRaw(Bot) },
      ],
      viewMap: {
        'copyright': 'CopyrightGenerator',
        'api-doc': 'ApiDocGenerator',
        'db-doc': 'DbDocGenerator',
        'ai-settings': 'AiSettings',
      },
    }
  },
  computed: {
    currentView() {
      return this.viewMap[this.activeTab] || 'CopyrightGenerator'
    },
  },
  methods: {
    toggleTheme() {
      this.theme = this.theme === 'dark' ? 'light' : 'dark'
    },
    toggleGuide() {
      this.guideEnabled = !this.guideEnabled
      localStorage.setItem('guideEnabled', this.guideEnabled)
      window.dispatchEvent(new CustomEvent('guide-toggle', { detail: this.guideEnabled }))
    },
    showToast(message, type = 'info') {
      this.toast = { show: true, message, type }
      setTimeout(() => { this.toast.show = false }, 3000)
    },
  },
}
</script>
