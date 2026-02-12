# 软著代码生成器

> 一键生成符合软件著作权申请规范的 Word 源代码文档

基于 **Tauri 2 + Vue 3 + docx** 构建的桌面应用，支持 Windows / macOS。

## ✨ 功能特性

- **多目录扫描** — 支持添加多个源代码目录，按比例分配代码行数
- **智能文件检测** — 自动检测目录中的文件类型，一键筛选代码文件
- **代码清洗** — 移除注释、空行、行尾空白、import 语句、版权声明
- **精确分页** — 使用 PageBreak 精确控制每页代码行数，支持自定义字体和字号
- **Word 预览** — 实时分页预览，模拟 Word 文档效果（页眉、页脚、页码）
- **前后截取** — 超过最大页数时，自动截取前 N 页 + 后 N 页
- **配置导入/导出** — 保存和加载配置文件，方便重复使用
- **深色/浅色主题** — 支持主题切换
- **忽略规则** — 支持 .gitignore 和自定义忽略模式

## 📸 截图

<!-- ![主界面](screenshots/main.png) -->

## 🚀 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) >= 18
- [Rust](https://www.rust-lang.org/tools/install) >= 1.70
- [Tauri 2 CLI](https://v2.tauri.app/start/prerequisites/)

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run tauri:dev
```

> 自动检测可用端口（从 51420 开始），避免端口冲突。

### 构建发布

```bash
npm run tauri:build
```

## 📦 项目结构

```
soft-copyright-generator/
├── src/                      # 前端源码
│   ├── App.vue               # 主界面组件
│   ├── core/
│   │   ├── docx-generator.js # Word 文档生成（docx 库）
│   │   ├── ratio-allocator.js# 代码行清洗与处理
│   │   └── file-sorter.js    # 文件智能排序
│   └── styles/
│       └── index.css         # 全局样式（深色/浅色主题）
├── src-tauri/                # Rust 后端
│   ├── src/
│   │   ├── commands.rs       # Tauri 命令（文件扫描、读取）
│   │   └── lib.rs            # 应用入口
│   └── tauri.conf.json       # Tauri 配置
├── scripts/
│   ├── tauri-dev.mjs         # 自动端口检测启动脚本
│   └── generate-icons.mjs    # 图标生成脚本
└── .github/workflows/
    ├── release.yml           # 构建发布（v* tag 触发）
    └── version-release.yml   # 版本变更自动打 tag
```

## 🔧 配置说明

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| 字体 | 微软雅黑 | 支持中文字体、英文字体、等宽字体 |
| 字号 | 五号 (10.5pt) | 支持初号到八号及常用磅值 |
| 每页行数 | 50 | 通过 PageBreak 精确控制 |
| 最大页数 | 80 | 超出时自动前后截取 |
| 页面边距 | 上下 25.4mm / 左右 31.8mm | A4 标准边距 |

## 📋 发布流程

修改 `package.json` 中的 `version` 字段并推送到 `main` 分支，CI 会自动：

1. 检测版本号变更
2. 同步更新 `tauri.conf.json` 和 `Cargo.toml` 的版本号
3. 创建 `v{version}` tag
4. 触发 `release.yml` 构建 Windows / macOS 安装包
5. 创建 GitHub Release（草稿）

## 📄 License

MIT
