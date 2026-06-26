# 京保保 (JingBaoBao) - 京东价保助手

京价保是一款专为JD用户设计的浏览器插件，旨在帮助用户监控已购买商品的价格波动，并在发现降价时自动提交价格保护（价保）申请，以实现自动退差价。此外，它还集成了每日签到领京豆、购物车降价提醒、商品价格走势图等实用功能。

## 核心功能

*   **自动价格保护**：定期自动检查最近购买的商品，若发现符合价保条件且价格下降，将自动向京东系统提交价保申请，帮用户挽回损失。
*   **每日京豆签到**：每日自动在京东后台进行签到，领取京豆。
*   **购物车降价提醒**：实时/定期检查购物车中的商品价格，如果发现降价，会通过浏览器通知用户。
*   **历史价格走势图**：在JD商品详情页嵌入直观的价格走势图表（基于 AntV G2），帮助用户识别虚假促销，理性消费。


## 偏好与隐私说明
*   **数据安全**：所有订单数据、签到数据与任务日志均存储在本地浏览器的 IndexedDB 中，不会上传至第三方服务器。
*   **价格走势**：为了绘制商品价格走势图，本扩展会获取当前商品的 SKU 编码。如果用户在设置中关闭了“价格走势图”功能，扩展将完全停止上报与加载此类数据。
*   **高度可配置性**：
    *   **通知与免打扰**：支持夜间免打扰模式（24:00 - 06:00 暂停通知）、通知隐藏商品敏感信息、自定义提示音效等。
    *   **价保策略**：支持设置触发自动申请的最小价格差额，以及生鲜价保的原返/品类券优先模式。
    *   **PLUS 会员适配**：支持针对 PLUS 会员专属价进行比价。
    *   **隐私模式**：支持关闭价格走势图


## 核心架构设计

项目采用 Chrome Extension Manifest V3 规范。由于 MV3 对 Service Worker 的限制（如无法访问 DOM、不能使用 `localStorage`、无法直接播放音频等），本项目采用了“Service Worker + Offscreen Document”的双通道协作架构：

1.  **Service Worker (`service_worker.js`)**：
    *   作为整个扩展的控制枢纽和常驻后台。
    *   利用 `chrome.alarms` 定时唤醒，注册和触发定时任务。
    *   捕获通知点击、右键菜单等浏览器系统事件。
    *   通过 `chrome.offscreen` 自动创建并管理一个“离屏文档”（Offscreen Document），并将定时任务和事件调度代理转发给它。
2.  **Offscreen Document (`background.js`)**：
    *   运行在不可见的 DOM 环境中，完整保留了 DOM 解析、AJAX 网络请求（带 Cookie 状态）、`localStorage` 读写以及音频播放能力。
    *   承载了定时任务（如价保、签到、购物车降价）的具体实现、IndexedDB 本地存储读写、网络数据请求以及声音警报的触发。

## 技术栈

*   **框架与核心库**：
    *   **Vue.js 3**：用于构建 Popup 面板及设置页面的用户界面。
    *   **Dexie.js (IndexedDB)**：高性能、轻量级的本地数据库包装库，用于存储订单快照、历史通知、任务运行日志等。
    *   **jQuery**：主要用于 Content Scripts 中进行高效的 DOM 解析与交互。
    *   **Luxon**：现代化的 JavaScript 日期时间处理库。
    *   **@antv/g2**：阿里开源的现代化可视化引擎，用于绘制商品历史价格曲线。
*   **UI 样式**：
    *   **WeUI**：微信官方的 UI 样式库，提供极简且直观的用户操作界面。
    *   **Less**：CSS 预处理器。
*   **构建系统**：
    *   **Webpack 5**：负责打包服务工作线程、内容脚本和 UI 组件。
    *   **Babel**：将现代 JavaScript 转译为兼容的 ES 版本。
*   **浏览器规范**：
    *   **Manifest V3 (MV3)**：采用最新的 Chrome 扩展标准，核心调度使用 Service Worker，部分需要 DOM 解析和音频播放的遗留逻辑在 Offscreen Document 中运行，在合规前提下保证功能完备性。


## 目录结构

```
├── .github/             # GitHub Actions 持续集成与配置
├── docs/                # 项目文档（架构设计、Vue3迁移报告、重构计划等）
│   ├── ARCHITECTURE.md                  # 架构设计说明文档
│   ├── CODE_REVIEW_REPORT.md            # 代码审查与改进建议
│   ├── COMPREHENSIVE_REFACTORING_PLAN.md # 综合重构与现代化演进计划
│   ├── VUE_MIGRATION_REPORT.md           # Vue 2 到 Vue 3 迁移评估
│   └── readme.md                        # 本文档
├── public/              # 扩展的静态资源模板与配置文件
│   ├── manifest.json                    # 扩展入口配置文件（Manifest V3）
│   ├── rules.json                       # 声明式网络请求拦截规则 (DNR)
│   ├── offscreen.html                   # Offscreen 离屏文档入口
│   ├── popup.html                       # Popup 弹出页面模板
│   └── start.html                       # 安装后的首次引导页
├── src/                 # 主要源代码目录
│   ├── components/                      # Vue 3 UI 组件
│   │   ├── App.vue                         # 插件 Popup 的核心主组件
│   │   ├── settings.vue                    # 任务与偏好设置组件
│   │   ├── task-setting.vue                # 具体任务项的单独配置组件
│   │   ├── guide.vue                       # 新功能/操作引导组件
│   │   ├── support.vue                     # 赞助与支持组件
│   │   ├── messageBox/                     # 封装的自定义对话框组件
│   │   └── toast/                          # 封装的自定义 Toast 提示组件
│   ├── config/                          # 动态配置（如选择器等，空目录留作扩展）
│   ├── shim/                            # 兼容层及 WeUI 组件的 Vue 适配
│   ├── service_worker.js                # MV3 核心服务工作线程，处理系统事件与闹钟调度
│   ├── background.js                    # 运行于 Offscreen 离屏文档的后台主逻辑（包含调度、网络请求与数据库交互）
│   ├── content_script.js                # 注入到京东页面的脚本，负责 DOM 分析、价保交互自动化
│   ├── priceChart.js                    # 注入到商品详情页，负责获取价格走势数据并渲染图表
│   ├── mobile_script.js                 # 注入到京东 M 端网页，模拟触控与修改 User Agent
│   ├── db.js                            # 本地 Dexie (IndexedDB) 数据库定义与 API
│   ├── tasks.js                         # 扩展支持的所有任务配置与定义
│   ├── account.js                       # 用户登录状态维护
│   ├── utils.js                         # 工具函数（日期格式化、设置读写等）
│   └── variables.js                     # 共享状态文本定义
├── static/              # 静态资源
│   ├── audio/                           # 提示音效文件（beans.ogg, price_protection.ogg）
│   └── image/                           # 图标、配图等静态资源
├── webpack.config.js    # Webpack 打包配置
└── package.json         # 项目依赖管理与编译指令
```

## 运行与编译

确保您的开发环境安装了 **Node.js** 和 **npm** (或 **yarn**)。

### 1. 安装项目依赖

在项目根目录下运行：

```bash
npm install
# 或者使用 yarn
yarn install
```

### 2. 开发模式

启动 Webpack 的监听模式，在修改代码后会自动进行热编译：

```bash
npm run dev
# 或者使用 yarn
yarn dev
```

### 3. 生成生产包

编译并打包出用于发布或直接加载的 Chrome 扩展文件包：

```bash
npm run build
# 或者使用 yarn
yarn build
```

打包完成后，生成的扩展程序文件将保存在根目录下的 **`dist/`** 目录中。

### 4. 在浏览器中加载

1.  打开 Chrome 浏览器，访问 `chrome://extensions/`。
2.  在右上角开启 **“开发者模式”** (Developer mode)。
3.  点击左上角 **“加载已解压的扩展程序”** (Load unpacked)。
4.  选择本项目根目录下的 **`dist`** 文件夹即可成功安装。

