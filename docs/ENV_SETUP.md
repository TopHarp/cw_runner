# CW Runner - 微信小程序开发环境配置文档

## 1. 当前系统环境扫描结果

| 项目 | 状态 | 版本/路径 | 说明 |
|------|------|-----------|------|
| 操作系统 | ✅ | Ubuntu 24.04.3 LTS (Noble) | x86_64 |
| Node.js | ✅ | v18.19.1 | 系统 apt 自带，满足小程序开发 |
| npm | ✅ | v9.2.0 | 随 Node.js 安装 |
| Python3 | ✅ | v3.12.3 | 系统自带 |
| Git | ✅ | 已安装 | 系统自带 |
| VS Code | ✅ | v1.116.0 | 已安装 |
| **微信开发者工具（Linux 社区版）** | ✅ | **v2.01.2510290-2** | **已安装于 `/home/owen/my_app/weixin_tool/WeChat_Dev_Tools_v2.01.2510290-2_x86_64_linux/`** |
| **小程序项目** | ✅ | **已初始化** | **路径 `/home/owen/file/awosome/my_agent/cw_runner/`，AppID: `wx8d12b93475c45e2c`** |
| VS Code 小程序扩展 | ✅ | `qiu8310.minapp-vscode` v2.4.14 | WXML 语言服务 |
| VS Code 小程序扩展 | ✅ | `cnyballk.wxml-vscode` v0.1.2 | WXML 格式化与高亮 |
| nvm/fnm/volta | ❌ | 未安装 | 可选，当前 Node 版本已够用 |

> **当前开发模式**：VS Code（Kimi Code）写代码 → 外部微信开发者工具仿真运行。

---

## 2. 环境架构

```
+-----------------------------------------------------------+
|                      开发环境架构                          |
+-----------------------------------------------------------+
|                                                           |
|   ┌─────────────┐         ┌─────────────────────────┐    |
|   │   VS Code   │         │   微信开发者工具         │    |
|   │  (Kimi Code)│         │   (Linux 社区版)         │    |
|   │             │         │                         │    |
|   │ • 代码编辑   │ ──────► │ • 模拟器预览             │    |
|   │ • 语法高亮   │  监听   │ • 真机调试               │    |
|   │ • 智能补全   │  文件   │ • 云开发控制台           │    |
|   │ • AI 辅助   │  变更   │ • 上传/发布              │    |
|   └──────┬──────┘         └─────────────────────────┘    |
│          │                                                |
│          ▼                                                |
│   ┌─────────────┐                                        |
│   │  项目目录    │                                        |
│   │  cw_runner/ │                                        |
│   │             │                                        |
│   │ • miniprogram/     小程序前端代码                     |
│   │ • cloudfunctions/  云函数（待创建）                    |
│   │ • docs/            文档                               |
│   └─────────────┘                                        |
│                                                           |
+-----------------------------------------------------------+
```

---

## 3. 微信开发者工具（Linux 社区版）

### 3.1 安装信息

| 属性 | 值 |
|------|-----|
| 版本 | v2.01.2510290-2 |
| 路径 | `/home/owen/my_app/weixin_tool/WeChat_Dev_Tools_v2.01.2510290-2_x86_64_linux/` |
| 启动脚本 | `/home/owen/my_app/weixin_tool/WeChat_Dev_Tools_v2.01.2510290-2_x86_64_linux/bin/wechat-devtools` |
| CLI 工具 | `/home/owen/my_app/weixin_tool/WeChat_Dev_Tools_v2.01.2510290-2_x86_64_linux/bin/wechat-devtools-cli` |
| 数据目录 | `~/.config/微信web开发者工具/` |

### 3.2 启动方式

```bash
# 方式一：直接运行启动脚本
/home/owen/my_app/weixin_tool/WeChat_Dev_Tools_v2.01.2510290-2_x86_64_linux/bin/wechat-devtools

# 方式二：创建快捷命令（推荐，添加到 ~/.bashrc）
alias wechat-devtools='/home/owen/my_app/weixin_tool/WeChat_Dev_Tools_v2.01.2510290-2_x86_64_linux/bin/wechat-devtools'

# 方式三：创建桌面快捷方式
cat > ~/.local/share/applications/wechat-devtools.desktop << 'EOF'
[Desktop Entry]
Name=微信开发者工具
Name[zh_CN]=微信开发者工具
Comment=WeChat Mini Program DevTools (Linux)
Exec=/home/owen/my_app/weixin_tool/WeChat_Dev_Tools_v2.01.2510290-2_x86_64_linux/bin/wechat-devtools %F
Type=Application
Icon=/home/owen/my_app/weixin_tool/WeChat_Dev_Tools_v2.01.2510290-2_x86_64_linux/package.nw/dist/weapp/images/logo.png
Categories=Development;IDE;
Terminal=false
StartupNotify=true
EOF
update-desktop-database ~/.local/share/applications/
```

### 3.3 项目导入

开发者工具已初始化项目，项目路径：

```
/home/owen/file/awosome/my_agent/cw_runner
```

如需重新导入：
1. 打开微信开发者工具
2. 点击"导入项目"
3. 选择 `/home/owen/file/awosome/my_agent/cw_runner`
4. 确认 AppID：`wx8d12b93475c45e2c`

### 3.4 热重载配置

开发者工具已启用 `compileHotReLoad`（见 `project.private.config.json`）。修改代码保存后，模拟器会自动刷新。

---

## 4. VS Code 开发环境

### 4.1 已安装扩展

| 扩展 ID | 版本 | 功能 |
|---------|------|------|
| `qiu8310.minapp-vscode` | v2.4.14 | WXML 语法高亮、标签/属性自动补全、自定义组件路径补全、跳转到定义 |
| `cnyballk.wxml-vscode` | v0.1.2 | WXML 格式化（基于 js-beautify）、保存自动格式化、代码片段 |

### 4.2 推荐补充扩展

以下扩展可进一步提升开发体验：

```bash
# ESLint - JavaScript 代码规范检查
code --install-extension dbaeumer.vscode-eslint

# Prettier - 代码格式化
code --install-extension esbenp.prettier-vscode

# Path Intellisense - 路径自动补全
code --install-extension christian-kohler.path-intellisense
```

### 4.3 工作区配置

建议创建 `.vscode/settings.json`：

```json
{
  "editor.tabSize": 2,
  "editor.insertSpaces": true,
  "editor.detectIndentation": false,
  "files.associations": {
    "*.wxml": "wxml",
    "*.wxss": "css"
  },
  "[javascript]": {
    "editor.defaultFormatter": "vscode.typescript-language-features"
  },
  "[json]": {
    "editor.defaultFormatter": "vscode.json-language-features"
  },
  "[wxml]": {
    "editor.defaultFormatter": "cnyballk.wxml-vscode",
    "editor.formatOnSave": true
  },
  "emmet.includeLanguages": {
    "wxml": "html"
  },
  "minapp-vscode.disableAutoConfig": false,
  "wxmlConfig.disableAutoConfig": false,
  "editor.quickSuggestions": {
    "strings": true
  }
}
```

### 4.4 调试配置（可选）

如需在 VS Code 中直接调用开发者工具 CLI：

```json
// .vscode/tasks.json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "预览小程序",
      "type": "shell",
      "command": "/home/owen/my_app/weixin_tool/WeChat_Dev_Tools_v2.01.2510290-2_x86_64_linux/bin/wechat-devtools-cli",
      "args": ["--preview", "--project", "${workspaceFolder}"],
      "group": "build"
    }
  ]
}
```

---

## 5. 项目结构

当前项目路径：`/home/owen/file/awosome/my_agent/cw_runner`

```
cw_runner/
├── README.md                      # 项目说明
├── project.config.json            # 项目配置（AppID 等）
├── project.private.config.json    # 私有项目配置（热重载等）
├── cw_pic.png                     # 项目图片资源
├── docs/                          # 文档目录
│   ├── DESIGN.md                  # 设计文档
│   └── ENV_SETUP.md               # 本文件
├── miniprogram/                   # 【待创建】小程序前端代码
│   ├── app.js
│   ├── app.json
│   ├── app.wxss
│   ├── sitemap.json
│   ├── pages/
│   │   ├── index/
│   │   │   ├── index.wxml
│   │   │   ├── index.wxss
│   │   │   ├── index.js
│   │   │   └── index.json
│   │   └── play/
│   │       ├── play.wxml
│   │       ├── play.wxss
│   │       ├── play.js
│   │       └── play.json
│   ├── utils/
│   │   ├── cw.js                  # CW 音频与时序工具
│   │   └── cloud.js               # 云开发封装
│   └── components/                # 自定义组件
└── cloudfunctions/                # 【待创建】云函数
    ├── uploadCW/
    └── getCWList/
```

---

## 6. 开发工作流

### 6.1 日常开发流程

```
1. 启动微信开发者工具
   $ /home/owen/my_app/weixin_tool/WeChat_Dev_Tools_v2.01.2510290-2_x86_64_linux/bin/wechat-devtools

2. 在 VS Code 中打开项目
   $ code /home/owen/file/awosome/my_agent/cw_runner

3. 编写代码（VS Code + Kimi Code）
   - 修改 WXML / WXSS / JS / JSON
   - 保存时自动格式化

4. 实时预览（开发者工具）
   - 模拟器自动热重载
   - 查看效果、调试 Console

5. 真机调试（需要时）
   - 开发者工具点击"真机调试"
   - 手机微信扫码
```

### 6.2 文件变更监听

开发者工具会监听项目目录的文件变更，保存后自动编译。确保开发者工具中已打开本项目。

---

## 7. 项目配置详情

### 7.1 project.config.json

```json
{
  "setting": {
    "es6": true,
    "postcss": true,
    "minified": true,
    "uglifyFileName": false,
    "enhance": true,
    "packNpmRelationList": [],
    "babelSetting": {
      "ignore": [],
      "disablePlugins": [],
      "outputPath": ""
    },
    "useCompilerPlugins": false,
    "minifyWXML": true
  },
  "compileType": "miniprogram",
  "simulatorPluginLibVersion": {},
  "packOptions": {
    "ignore": [],
    "include": []
  },
  "appid": "wx8d12b93475c45e2c",
  "editorSetting": {}
}
```

### 7.2 project.private.config.json

```json
{
  "libVersion": "3.15.2",
  "projectname": "cw_runner",
  "setting": {
    "urlCheck": true,
    "coverView": true,
    "lazyloadPlaceholderEnable": false,
    "skylineRenderEnable": false,
    "preloadBackgroundData": false,
    "autoAudits": false,
    "showShadowRootInWxmlPanel": true,
    "compileHotReLoad": true
  }
}
```

| 配置项 | 值 | 说明 |
|--------|-----|------|
| `libVersion` | 3.15.2 | 基础库版本 |
| `projectname` | cw_runner | 项目名称 |
| `compileHotReLoad` | true | **启用热重载**，保存自动刷新模拟器 |
| `urlCheck` | true | 检查安全域名 |

---

## 8. 可选增强

### 8.1 fnm（Node 版本管理）

```bash
curl -fsSL https://fnm.vercel.app/install | bash
source ~/.bashrc
fnm install 20
fnm use 20
```

### 8.2 云开发 CLI

```bash
npm install -g @cloudbase/cli
```

### 8.3 miniprogram-ci

```bash
npm install -g miniprogram-ci
```

---

## 9. 常见问题

### Q1：开发者工具提示"当前系统为 Linux"

社区版基于 Wine 运行，此提示为正常行为。如遇到渲染问题，尝试：
- 开发者工具设置 → 项目设置 → 关闭"开启硬件加速"
- 或设置 → 外观 → 调整缩放比例

### Q2：VS Code 修改后开发者工具未自动刷新

检查：
1. `project.private.config.json` 中 `compileHotReLoad` 是否为 `true`
2. 开发者工具是否已导入本项目
3. 开发者工具模拟器是否处于开启状态

### Q3：Kimi Code 生成的代码格式混乱

确保 `.vscode/settings.json` 中已配置：
```json
"[wxml]": {
  "editor.defaultFormatter": "cnyballk.wxml-vscode",
  "editor.formatOnSave": true
}
```
保存文件时自动格式化。

### Q4：自定义组件路径补全不生效

`minapp-vscode` 需要遍历组件文件，首次打开项目时可能需要几秒索引时间。如长期不生效，检查：
1. 扩展是否启用
2. 项目根目录是否存在 `project.config.json`
3. 组件是否按标准目录结构存放（`components/组件名/组件名.js`）

---

## 10. 参考链接

- [微信开发者工具官方文档](https://developers.weixin.qq.com/miniprogram/dev/devtools/devtools.html)
- [wechat-web-devtools-linux (GitHub)](https://github.com/msojocs/wechat-web-devtools-linux)
- [WXML - Language Service (VS Code)](https://marketplace.visualstudio.com/items?itemName=qiu8310.minapp-vscode)
- [wxml VS Code 扩展](https://marketplace.visualstudio.com/items?itemName=cnyballk.wxml-vscode)
- [微信小程序开发文档](https://developers.weixin.qq.com/miniprogram/dev/framework/)
- [微信云开发文档](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html)
