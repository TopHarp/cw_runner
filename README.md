# CW Runner - 微信小程序

CW Runner 是一款用于等幅电报（CW, Continuous Wave）模拟练习的微信小程序。用户可通过虚拟自动电键（Paddle）输入莫尔斯电码，上传至云端与他人进行异步练习。

## 核心特性

- **虚拟自动键（Paddle）**：双桨设计，左桨发"点"（dit），右桨发"划"（dah），按住连续发送，松手即停，内置 Iambic B 模式。
- **侧音可开关**：WebAudio API 实时合成 600Hz 正弦波侧音，默认静音，可随时开关。
- **振动反馈**：每次发点/划可触发手机短振动（可开关，需手机开启"触摸时振动"）。
- **视觉反馈**：Paddle 区域上方有 `·` 和 `−` 指示灯，发报时对应闪烁。
- **报文间隔可调**：单词间隔支持 2-6 倍点长可调（默认 2），适应不同听抄节奏。
- **伪联网异步练习**：用户上传 CW 电码文本至云端，他人可随时点击播放。
- **完全匿名**：云端列表仅展示 CW 文本项，不展示发送者身份，避免 UGC 内容审核风险。
- **滚动分页**：报文列表滚动触底自动加载更多。
- **帮助页面**：内置使用说明。

## 技术栈

- **前端**：微信小程序原生框架
- **音频**：WebAudio API（`wx.createWebAudioContext()`）— OscillatorNode + GainNode 实时合成 600Hz 正弦波，延迟 < 1ms
- **后端**：微信云开发（云数据库 + 云函数）

## 快速开始

```bash
# 使用微信开发者工具打开本项目
# 填入你的小程序 AppID，开启云开发
```

## 项目结构

```
.
├── miniprogram/          # 小程序前端代码
│   ├── pages/
│   │   ├── index/        # 首页（电键输入 + 云端列表）
│   │   ├── play/         # 播放页
│   │   └── help/         # 帮助页
│   ├── utils/
│   │   ├── cw.js         # CW 音频合成 + Paddle 自动键逻辑
│   │   ├── cloud.js      # 云开发封装（含本地 Mock）
│   │   └── config.js     # 全局配置（CLOUD_ENABLED 开关）
│   └── app.js
├── cloudfunctions/       # 云函数
│   ├── uploadCW/         # 上传 CW 文本
│   ├── getCWList/        # 获取云端列表（含被动过期清理）
│   └── getOpenid/        # 获取用户 openid
├── docs/
│   ├── DESIGN.md         # 详细设计文档
│   ├── ENV_SETUP.md      # 环境配置文档
│   └── CLOUD_SETUP.md    # 云开发配置文档
└── README.md
```

## 时序规范

### 发报端（PaddleKeyer）

| 操作 | 行为 | 时序记录 |
|------|------|----------|
| 点下左桨 | 发点，若按住则自动连续发点 | 追加 `.` |
| 点下右桨 | 发划，若按住则自动连续发划 | 追加 `-` |
| 左右同时按 | 优先后发（Iambic B 模式） | 按实际输出记录 |
| 松手后 > wordGapUnits × unit | 单词间隔 | 追加 `\|` |

- 点长 (unit) = 1200 / WPM ms（如 15 WPM 时 80ms，20 WPM 时 60ms）
- 划长 = 3 × unit
- 点划间隔 = 1 × unit
- 单词间隔 = wordGapUnits × unit（2-6 可调，默认 2）
- 默认 WPM = 15

### 播放端解析（playCode）

遍历 `code` 字符串，使用 WebAudio `gainNode.gain.setValueAtTime()` 精确调度：

- `.` → 发声 unit 时长 + 静音 unit 时长
- `-` → 发声 3×unit 时长 + 静音 unit 时长
- `\|` → 静音 wordGapUnits×unit 时长
- `/` → 静音 2×unit 时长（仅兼容旧数据）

## 数据格式

```json
{
  "_id": "auto_generated",
  "code": "-.-.|--.-",
  "wpm": 15,
  "timestamp": 1713862800,
  "sender": "openid_xxx"
}
```

注：`sender` 仅在服务端存储，客户端列表不返回此字段。

## 本地开发模式

通过 `miniprogram/utils/config.js` 中的 `CLOUD_ENABLED` 控制：

- `true`（默认）：使用微信云数据库，多用户共享报文
- `false`：使用内存 Mock 数组，无需云环境即可调试

## License

MIT
