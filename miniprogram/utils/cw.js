/**
 * CW 音频核心工具
 * 采用 WebAudio API 实时合成方案
 * 振荡器持续运行，通过增益节点控制发声/静音，延迟 < 1ms
 */

// ==================== 常量定义 ====================

const UNIT_MS = 60
const DASH_MS = UNIT_MS * 3
const TONE_FREQ = 600
const WORD_GAP_UNITS = 4  // 单词间隔 = 4 * unit，可调
const DEFAULT_WPM = 15    // 启动默认速度

// ==================== WebAudio 实时合成 ====================

let audioCtx = null
let oscillator = null
let gainNode = null
let _audioReady = false
let _audioEnabled = false

function initAudio() {
  return new Promise((resolve, reject) => {
    if (_audioReady) {
      resolve()
      return
    }

    if (!wx.createWebAudioContext) {
      reject(new Error('当前基础库不支持 WebAudio，请升级微信'))
      return
    }

    try {
      audioCtx = wx.createWebAudioContext()

      oscillator = audioCtx.createOscillator()
      oscillator.type = 'sine'
      oscillator.frequency.value = TONE_FREQ

      gainNode = audioCtx.createGain()
      gainNode.gain.value = 0 // 初始静音

      oscillator.connect(gainNode)
      gainNode.connect(audioCtx.destination)

      oscillator.start(0)
      _audioReady = true
      resolve()
    } catch (err) {
      console.error('WebAudio 初始化失败', err)
      reject(err)
    }
  })
}

function isAudioReady() {
  return _audioReady
}

function setAudioEnabled(enabled) {
  _audioEnabled = !!enabled
}

function isAudioEnabled() {
  return _audioEnabled
}

// 兼容旧接口名
const initAudioFiles = initAudio

/**
 * 显式激活音频上下文
 * 必须由用户手势触发调用（如触摸事件），并 await 其完成
 * 之后上下文保持 running，playTone 不再涉及异步
 */
async function activateAudio() {
  if (!_audioReady) {
    await initAudio()
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    await audioCtx.resume()
  }
}

// ==================== 音频播放 ====================

function playTone(type) {
  if (!_audioReady || !_audioEnabled) return
  // 尽力而为，不阻塞。正常情况下上下文已由 activateAudio() 提前激活
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume()
  }
  // 取消任何预设的增益调度（防止 playCode 的残留调度干扰）
  if (gainNode) {
    gainNode.gain.cancelScheduledValues(audioCtx.currentTime)
    gainNode.gain.value = 1
  }
}

function stopTone() {
  if (!_audioReady || !gainNode) return
  gainNode.gain.value = 0
}

/**
 * 播放完整 CW 电码时序
 * 使用 setValueAtTime 精确调度，由音频硬件时钟驱动，精度微秒级
 * @param {string} code - 如 ".-/-.../.-."
 * @param {number} wpm - 发报速度
 */
function playCode(code, wpm = DEFAULT_WPM) {
  return new Promise((resolve) => {
    if (!_audioReady) {
      console.warn('音频未就绪，跳过播放')
      resolve()
      return
    }

    const unitMs = Math.round(1200 / wpm)
    let totalMs = 0

    // 计算总时长（无论是否静音都需要）
    for (let i = 0; i < code.length; i++) {
      const char = code[i]
      switch (char) {
        case '.': totalMs += unitMs * 2; break
        case '-': totalMs += unitMs * 4; break
        case '/': totalMs += unitMs * 2; break
        case '|': totalMs += unitMs * (WORD_GAP_UNITS - 1); break
        default: break
      }
    }

    if (!_audioEnabled) {
      // 静音模式：只等待对应时长后 resolve
      setTimeout(resolve, totalMs + 50)
      return
    }

    // 尽力而为，不阻塞
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume()
    }

    const unitSec = unitMs / 1000
    let t = audioCtx.currentTime
    const startTime = t

    // 取消之前的调度，从当前时间重新开始
    gainNode.gain.cancelScheduledValues(t)
    gainNode.gain.setValueAtTime(0, t)

    for (let i = 0; i < code.length; i++) {
      const char = code[i]
      switch (char) {
        case '.':
          // 点：发声 unitSec，静音 unitSec
          gainNode.gain.setValueAtTime(1, t)
          gainNode.gain.setValueAtTime(0, t + unitSec)
          t += unitSec * 2
          break
        case '-':
          // 划：发声 3*unitSec，静音 unitSec
          gainNode.gain.setValueAtTime(1, t)
          gainNode.gain.setValueAtTime(0, t + unitSec * 3)
          t += unitSec * 4
          break
        case '/':
          // 兼容旧数据：原字母间隔，额外静音 2*unitSec
          t += unitSec * 2
          break
        case '|':
          // 单词间隔：额外静音 (WORD_GAP_UNITS - 1)*unitSec
          t += unitSec * (WORD_GAP_UNITS - 1)
          break
        default:
          break
      }
    }

    setTimeout(resolve, totalMs + 50)
  })
}

// ==================== Paddle 自动键逻辑 ====================

class PaddleKeyer {
  constructor(options = {}) {
    this.onTimingUpdate = options.onTimingUpdate || (() => {})
    this.onToneStart = options.onToneStart || (() => {})
    this.onToneEnd = options.onToneEnd || (() => {})

    this.unitMs = options.unitMs || UNIT_MS
    this.iambicMode = options.iambicMode || 'B'

    this.timingText = ''
    this.isLeftPressed = false
    this.isRightPressed = false
    this.isTransmitting = false
    this.currentElement = null

    this.gapTimer = null
    this.lastReleaseTime = 0

    this._ready = false
  }

  async init() {
    try {
      await initAudio()
      this._ready = true
    } catch (err) {
      console.error('音频初始化失败', err)
    }
  }

  async updateWpm(wpm) {
    this.unitMs = Math.round(1200 / wpm)
  }

  isReady() {
    return this._ready
  }

  pressLeft() {
    if (this.isLeftPressed) return
    this.isLeftPressed = true
    this._cancelGapTimer()
    this._scheduleTransmit()
  }

  pressRight() {
    if (this.isRightPressed) return
    this.isRightPressed = true
    this._cancelGapTimer()
    this._scheduleTransmit()
  }

  releaseLeft() {
    if (!this.isLeftPressed) return
    this.isLeftPressed = false
    this._startGapTimer()
  }

  releaseRight() {
    if (!this.isRightPressed) return
    this.isRightPressed = false
    this._startGapTimer()
  }

  getTimingText() {
    return this.timingText
  }

  clear() {
    this.timingText = ''
    this._cancelGapTimer()
    this.isLeftPressed = false
    this.isRightPressed = false
    this.isTransmitting = false
    this.currentElement = null
    this.onTimingUpdate('')
    stopTone()
  }

  restoreTiming(text) {
    this.timingText = text
    this.onTimingUpdate(text)
  }

  _scheduleTransmit() {
    if (this.isTransmitting) return
    this._transmitNext()
  }

  _transmitNext() {
    if (!this.isLeftPressed && !this.isRightPressed) {
      this.isTransmitting = false
      this.currentElement = null
      return
    }

    this.isTransmitting = true

    let element
    if (this.isLeftPressed && this.isRightPressed) {
      // Iambic B: 交替
      element = this.currentElement === 'dit' ? 'dah' : 'dit'
    } else if (this.isLeftPressed) {
      element = 'dit'
    } else {
      element = 'dah'
    }

    this.currentElement = element
    const duration = element === 'dit' ? this.unitMs : this.unitMs * 3
    const symbol = element === 'dit' ? '.' : '-'

    if (this._ready) {
      playTone(element)
    }
    this.onToneStart(element)

    this.timingText += symbol
    this.onTimingUpdate(this.timingText)

    setTimeout(() => {
      this.onToneEnd(element)
      stopTone()
      // 点划间隔 1 unit
      setTimeout(() => {
        this._transmitNext()
      }, this.unitMs)
    }, duration)
  }

  _startGapTimer() {
    this.lastReleaseTime = Date.now()
    this._cancelGapTimer()

    // WORD_GAP_UNITS * unit 后加单词间隔 |
    this.gapTimer = setTimeout(() => {
      this._appendWordGap()
    }, this.unitMs * WORD_GAP_UNITS)
  }

  _cancelGapTimer() {
    if (this.gapTimer) {
      clearTimeout(this.gapTimer)
      this.gapTimer = null
    }
  }

  _appendWordGap() {
    if (this.isLeftPressed || this.isRightPressed) return
    if (this.timingText.length > 0 && !this.timingText.endsWith('|')) {
      this.timingText += '|'
      this.onTimingUpdate(this.timingText)
    }
  }
}

module.exports = {
  UNIT_MS,
  DASH_MS,
  TONE_FREQ,
  WORD_GAP_UNITS,
  DEFAULT_WPM,
  playTone,
  playCode,
  initAudioFiles,
  isAudioReady,
  setAudioEnabled,
  isAudioEnabled,
  activateAudio,
  PaddleKeyer
}
