# AGENTS.md — CW Runner

CW Runner is a WeChat Mini Program for Morse code (CW) practice. Users tap a virtual dual-paddle keyer to build timing strings, upload them to WeChat CloudBase, and listen back asynchronously.

## Build / Test / Lint

This project runs inside **WeChat DevTools** (微信开发者工具). There are no CLI build steps — the IDE handles compilation, preview, and cloud function deployment.

- **Open project**: Launch WeChat DevTools, open this directory. The `miniprogramRoot` is `miniprogram/`; `cloudfunctionRoot` is `cloudfunctions/`.
- **Run**: Click "Compile" in the IDE, then preview on device or simulator.
- **Deploy cloud functions**: Right-click each folder under `cloudfunctions/` → "Upload and Deploy".
- **Local mock mode**: Set `CLOUD_ENABLED = false` in `miniprogram/utils/config.js` to bypass cloud dependencies during development.

## Architecture

```
User taps paddle buttons (index page)
  → PaddleKeyer (cw.js) records "." / "-" / "|" into timingText
  → User taps Save → uploadCW (cloud.js → cloud function → CloudBase DB)
  → getCWList pulls paginated list, sorted by timestamp desc
  → User taps ▶ on any item → playCode() schedules WebAudio gain envelope
```

### Component tree

| Layer | File(s) | Role |
|-------|---------|------|
| **Audio engine** | `miniprogram/utils/cw.js` | WebAudio oscillator + gain node (600 Hz sine). Exports `PaddleKeyer` class, `playCode()`, `playTone()`, `stopTone()`, audio init/activation helpers. Single global oscillator — never stopped, toggled via `gainNode.gain`. |
| **Cloud wrapper** | `miniprogram/utils/cloud.js` | `uploadCW()` and `getCWList()` with dual-mode dispatch: real cloud functions when `CLOUD_ENABLED=true`, in-memory mock array otherwise. |
| **Config gate** | `miniprogram/utils/config.js` | Single constant `CLOUD_ENABLED` (boolean). Controls entire cloud-vs-mock switch. |
| **App entry** | `miniprogram/app.js` | Initializes `wx.cloud` (env: `cloud1-d6ghxthrlbd200729`), fetches openid. |
| **Index page** | `miniprogram/pages/index/index.*` | Main UI: paddle buttons, timing display, WPM/word-gap sliders, toggle switches (audio/vibrate), CW list with play buttons, infinite scroll. |
| **Play page** | `miniprogram/pages/play/play.*` | Standalone player for a single CW code string (navigated to from list). |
| **Help page** | `miniprogram/pages/help/help.*` | Static help content. |
| **Cloud functions** | `cloudfunctions/{uploadCW,getCWList,getOpenid}/` | Node.js runtime. `uploadCW`: validate + write to `cw_messages` collection. `getCWList`: passive expire (delete records older than 48h), then paginated query (by `timestamp` desc). `getOpenid`: returns `wxContext.OPENID`. |

### Data model (CloudBase collection `cw_messages`)

```json
{ "_id": "auto", "code": "-.-.|--.-", "wpm": 15, "timestamp": 1713862800, "sender": "openid_xxx" }
```

- `sender` is stored server-side but **never returned to clients** (anonymous list).
- Expiry: 48 hours, cleaned passively on `getCWList` calls.

### PaddleKeyer timing

- `unit = 1200 / WPM` ms (15 WPM → 80 ms)
- dit = 1 unit, dah = 3 units, inter-element gap = 1 unit
- Word gap `|` appended after release when idle > `wordGapUnits × unit` (2–6, default 2; controlled by `setWordGapUnits()`)
- Simultaneous left+right press: Iambic B alternating

## Key Files & Directories

| Path | Purpose |
|------|---------|
| `miniprogram/utils/cw.js` | Core audio synthesis + `PaddleKeyer` class. 377 lines. Modify this for any timing, tone, or keyer behavior changes. |
| `miniprogram/utils/cloud.js` | Cloud/mock dispatch for upload and list. Client-side validation (code pattern, length ≤ 500). |
| `miniprogram/utils/config.js` | `CLOUD_ENABLED` switch. |
| `miniprogram/pages/index/index.js` | Main page logic: paddle events, WPM/word-gap sliders, list loading, play-from-list, vibrate. 327 lines. |
| `miniprogram/pages/play/play.js` | Standalone player page. |
| `cloudfunctions/uploadCW/index.js` | Server-side upload with validation + rate limiting (50/hour). |
| `cloudfunctions/getCWList/index.js` | Server-side list with expiry cleanup + pagination (max 50 per page). |
| `cloudfunctions/getCWList/package.json` | Cloud function dependency: `wx-server-sdk`. |
| `docs/DESIGN.md` | Full design doc (architecture, timing specs, UI layouts, security). |
| `project.config.json` | IDE project config. `miniprogramRoot: "miniprogram/"`, `cloudfunctionRoot: "cloudfunctions/"`, `appid: "wx8d12b93475c45e2c"`. |

## Coding Conventions

- **Language**: JavaScript ES6, CommonJS modules (`require` / `module.exports`).
- **Framework**: WeChat Mini Program native — `Page({…})` for pages, `App({…})` in `app.js`.
- **Async**: Promises throughout. Cloud functions are `async (event, context)`.
- **Naming**: `camelCase` for variables/functions, `UPPER_SNAKE_CASE` for constants, `_leadingUnderscore` for private members.
- **Section headers**: `// ==================== Section Name ====================` inside `cw.js` and `index.js`.
- **Error handling**: `.then/.catch` chains or `try/catch` with `wx.showToast({ icon: 'none' })` for user-facing errors. Cloud functions return `{ success: bool, errMsg?: string }`.
- **No TypeScript**, no build pipeline (beyond WeChat IDE's built-in ES6→ES5 transpile).
- **Styles**: Dark theme (`#1a1a2e`, `#16213e`), defined per-page in `.wxss` files.

## Git Workflow

- Branch: `feature/*` (current: `feature/tone_use_gain_260508`).
- Commit messages: Chinese, short descriptive lines (e.g. "增加提示页面，提示振动侧音", "修复回放报文后侧音失效问题").
- Remote: `https://github.com/TopHarp/cw_runner.git`.

## Tips for AI Agents

- **Cloud vs mock mode**: `config.js` `CLOUD_ENABLED` is the master switch. When troubleshooting upload/list issues, check this first. Mock data lives in `cloud.js` `MOCK_LIST` array (max 20 items).
- **Audio must be user-gesture-activated**: `activateAudio()` calls `audioCtx.resume()` and must be triggered by a touch event. The `_ensureAudioActivated()` pattern in `index.js` handles this on first paddle press. If audio is silent, check `_audioEnabled` and that `activateAudio()` was called.
- **PaddleKeyer lifecycle**: Instantiated in `index.js` `onLoad()`, cleared in `onUnload()`. The `_cancelGapTimer()` method should be called before mutating `timingText` externally (e.g. delete button).
- **playCode is always audible**: `playCode()` bypasses the `_audioEnabled` gate — it calls `audioCtx.resume()` and directly schedules gain. This is intentional (list playback should work regardless of side-tone toggle).
- **Timing string characters**: Valid set is `. - / |`. The `/` is legacy (old letter separator), no longer generated by `PaddleKeyer` but still parsed by `playCode()`.
- **Expiry is 48 hours**: `EXPIRE_SECONDS = 48 * 60 * 60` in cloud functions. Client-side validation limits code to 500 chars, wpm 5–60, and rate-limits to 50 uploads/user/hour.
- **Edits touch `cw.js` carefully**: The single global oscillator/gainNode pattern means any change to audio routing or timing affects both real-time keying and list playback. Test both paths.
- **No WXSS changes without checking dark theme**: Background `#16213e`, nav bar `#1a1a2e`, white text. Keep visual consistency across pages.
