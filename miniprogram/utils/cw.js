/**
 * CW 音频与时序核心工具
 * 负责：Web Audio 合成 600Hz 正弦波、时序解析、Paddle 自动键逻辑
 */

// ==================== 常量定义 ====================

const UNIT_MS = 60                    // 点长（基础时间单位）
const DASH_MS = UNIT_MS * 3           // 划长 = 180ms
const INTRA_GAP_MS = UNIT_MS          // 点划间隔 = 60ms
const CHAR_GAP_MS = UNIT_MS * 3       // 字母间隔 = 180ms
const WORD_GAP_MS = UNIT_MS * 7       // 单词间隔 = 420ms
const TONE_FREQ = 600                 // 音频频率 600Hz

// ==================== Web Audio 上下文 ====================

let audioCtx = null

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = wx.createWebAudioContext()
  }
  return audioCtx
}

// ==================== 音频播放 ====================

/**
 * 播放单个音（点或划）
 * @param {number} durationMs - 音长（ms）
 * @param {number} startTime - 开始时间（AudioContext 时间轴）
 */
function playTone(durationMs, startTime) {
  const ctx = getAudioContext()
  const now = startTime || ctx.currentTime
  const duration = durationMs / 1000

  // 振荡器
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.value = TONE_FREQ

  // 增益节点（包络）
  const gain = ctx.createGain()

  // 包络：快速 attack/decay 避免爆音
  const attack = 0.005
  const release = 0.005
  const sustainLevel = 0.3

  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(sustainLevel, now + attack)
  gain.gain.setValueAtTime(sustainLevel, now + duration - release)
  gain.gain.linearRampToValueAtTime(0, now + duration)

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.start(now)
  osc.stop(now + duration)
}

/**
 * 解析并播放 CW 时序文本
 * @param {string} code - 时序文本，如 ".-/-.../.-."
 * @param {number} wpm - 发报速度（默认 20）
 * @returns {Promise} 播放完成时 resolve
 */
function playCode(code, wpm = 20) {
  return new Promise((resolve) => {
    const ctx = getAudioContext()
    const speedRatio = 20 / wpm  // WPM 越大，实际时长越短
    const unit = UNIT_MS * speedRatio / 1000
    const intraGap = INTRA_GAP_MS * speedRatio / 1000

    let currentTime = ctx.currentTime + 0.05  // 预留 50ms 准备时间

    for (let i = 0; i < code.length; i++) {
      const char = code[i]

      switch (char) {
        case '.':
          // 点：60ms 音 + 60ms 静音
          playTone(UNIT_MS * speedRatio, currentTime)
          currentTime += unit + intraGap
          break

        case '-':
          // 划：180ms 音 + 60ms 静音
          playTone(DASH_MS * speedRatio, currentTime)
          currentTime += unit * 3 + intraGap
          break

        case '/':
          // 字母间隔：追加 120ms 静音（总间隔 180ms）
          // 前面已有 60ms 静音，再追加 120ms
          currentTime += unit * 2
          break

        case '|':
          // 单词间隔：追加 360ms 静音（总间隔 420ms）
          // 前面已有 60ms 静音，再追加 360ms
          currentTime += unit * 6
          break

        default:
          // 忽略非法字符
          break
      }
    }

    // 计算总播放时长，到时 resolve
    const totalDuration = (currentTime - ctx.currentTime) * 1000
    setTimeout(resolve, totalDuration + 100)
  })
}

// ==================== Paddle 自动键逻辑 ====================

/**
 * Paddle 状态机
 * 左桨发点(dit)，右桨发划(dah)，按住连续发送，松手即停
 * 支持 Iambic B 模式
 */
class PaddleKeyer {
  constructor(options = {}) {
    this.onTimingUpdate = options.onTimingUpdate || (() => {})  // 时序文本更新回调
    this.onToneStart = options.onToneStart || (() => {})        // 音开始回调
    this.onToneEnd = options.onToneEnd || (() => {})            // 音结束回调

    this.unitMs = options.unitMs || UNIT_MS
    this.iambicMode = options.iambicMode || 'B'  // Iambic B 模式

    // 状态
    this.timingText = ''           // 当前时序文本
    this.isLeftPressed = false     // 左桨按下状态
    this.isRightPressed = false    // 右桨按下状态
    this.isTransmitting = false    // 是否正在发报
    this.currentElement = null     // 当前正在发的元素: 'dit' | 'dah'

    // 间隔计时
    this.gapTimer = null
    this.lastReleaseTime = 0
  }

  /**
   * 按下左桨（dit）
   */
  pressLeft() {
    if (this.isLeftPressed) return
    this.isLeftPressed = true
    this._cancelGapTimer()
    this._scheduleTransmit()
  }

  /**
   * 按下右桨（dah）
   */
  pressRight() {
    if (this.isRightPressed) return
    this.isRightPressed = true
    this._cancelGapTimer()
    this._scheduleTransmit()
  }

  /**
   * 松开左桨
   */
  releaseLeft() {
    if (!this.isLeftPressed) return
    this.isLeftPressed = false
    this._startGapTimer()
  }

  /**
   * 松开右桨
   */
  releaseRight() {
    if (!this.isRightPressed) return
    this.isRightPressed = false
    this._startGapTimer()
  }

  /**
   * 获取当前时序文本
   */
  getTimingText() {
    return this.timingText
  }

  /**
   * 清空时序文本
   */
  clear() {
    this.timingText = ''
    this._cancelGapTimer()
    this.isLeftPressed = false
    this.isRightPressed = false
    this.isTransmitting = false
    this.currentElement = null
    this.onTimingUpdate('')
  }

  // ------------------- 内部方法 -------------------

  _scheduleTransmit() {
    if (this.isTransmitting) return
    this._transmitNext()
  }

  _transmitNext() {
    // 两桨都松开，停止
    if (!this.isLeftPressed && !this.isRightPressed) {
      this.isTransmitting = false
      this.currentElement = null
      return
    }

    this.isTransmitting = true

    // Iambic B 模式：根据当前状态和按键决定发点还是发划
    let element
    if (this.isLeftPressed && this.isRightPressed) {
      // 双键：交替发送
      element = this.currentElement === 'dit' ? 'dah' : 'dit'
    } else if (this.isLeftPressed) {
      element = 'dit'
    } else {
      element = 'dah'
    }

    this.currentElement = element
    const duration = element === 'dit' ? this.unitMs : this.unitMs * 3
    const symbol = element === 'dit' ? '.' : '-'

    // 播放音
    playTone(duration)
    this.onToneStart(element)

    // 追加时序文本
    this.timingText += symbol
    this.onTimingUpdate(this.timingText)

    // 音结束后，等待点划间隔，然后继续
    setTimeout(() => {
      this.onToneEnd(element)
      // 点划间隔 60ms
      setTimeout(() => {
        this._transmitNext()
      }, this.unitMs)
    }, duration)
  }

  _startGapTimer() {
    this.lastReleaseTime = Date.now()

    // 清除旧的计时器
    this._cancelGapTimer()

    // 字母间隔检测（3 点长 = 180ms）
    this.gapTimer = setTimeout(() => {
      this._appendCharGap()

      // 单词间隔检测（7 点长 = 420ms）
      this.gapTimer = setTimeout(() => {
        this._appendWordGap()
      }, this.unitMs * 4)  // 额外 4 点长（240ms），总计 7 点长

    }, this.unitMs * 3)  // 3 点长（180ms）
  }

  _cancelGapTimer() {
    if (this.gapTimer) {
      clearTimeout(this.gapTimer)
      this.gapTimer = null
    }
  }

  _appendCharGap() {
    // 检查是否仍在等待（没有新按键）
    if (this.isLeftPressed || this.isRightPressed) return
    if (this.timingText.length > 0 && !this.timingText.endsWith('/') && !this.timingText.endsWith('|')) {
      this.timingText += '/'
      this.onTimingUpdate(this.timingText)
    }
  }

  _appendWordGap() {
    // 检查是否仍在等待（没有新按键）
    if (this.isLeftPressed || this.isRightPressed) return
    // 将最后一个 / 替换为 |
    if (this.timingText.endsWith('/')) {
      this.timingText = this.timingText.slice(0, -1) + '|'
      this.onTimingUpdate(this.timingText)
    }
  }
}

// ==================== 导出 ====================

module.exports = {
  UNIT_MS,
  DASH_MS,
  INTRA_GAP_MS,
  CHAR_GAP_MS,
  WORD_GAP_MS,
  TONE_FREQ,
  playTone,
  playCode,
  PaddleKeyer
}
