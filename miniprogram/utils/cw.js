/**
 * CW 音频核心工具
 * 采用本地预生成音频文件方案
 * 音频文件路径: /assets/audio/dit.wav, /assets/audio/dah.wav
 */

// ==================== 常量定义 ====================

const UNIT_MS = 60
const DASH_MS = UNIT_MS * 3
const TONE_FREQ = 600

// ==================== 音频播放器池 ====================

const audioPool = []
const POOL_SIZE = 4

let ditSrc = ''
let dahSrc = ''
let _audioReady = false

function initAudioPool() {
  if (audioPool.length > 0) return
  for (let i = 0; i < POOL_SIZE; i++) {
    const audio = wx.createInnerAudioContext({
      useWebAudioImplement: true
    })
    audioPool.push(audio)
  }
}

let poolIndex = 0

function getAudioPlayer() {
  initAudioPool()
  const audio = audioPool[poolIndex]
  poolIndex = (poolIndex + 1) % POOL_SIZE
  return audio
}

// ==================== 音频预加载 ====================

/**
 * 预加载本地音频文件到播放器
 * 小程序启动时调用一次即可
 */
function initAudioFiles() {
  return new Promise((resolve, reject) => {
    if (_audioReady) {
      resolve()
      return
    }

    ditSrc = '/assets/audio/dit.wav'
    dahSrc = '/assets/audio/dah.wav'

    // 验证文件可加载
    const testAudio = wx.createInnerAudioContext({ useWebAudioImplement: true })
    let loaded = false

    testAudio.src = ditSrc
    testAudio.onCanplay(() => {
      if (!loaded) {
        loaded = true
        _audioReady = true
        testAudio.destroy()
        resolve()
      }
    })
    testAudio.onError((err) => {
      console.error('音频加载失败', err)
      reject(err)
    })

    // 超时保护
    setTimeout(() => {
      if (!loaded) {
        testAudio.destroy()
        reject(new Error('音频加载超时'))
      }
    }, 5000)
  })
}

function isAudioReady() {
  return _audioReady
}

// ==================== 音频播放 ====================

function playTone(type) {
  const src = type === 'dit' ? ditSrc : dahSrc
  if (!src || !_audioReady) {
    console.warn('音频未就绪')
    return
  }

  const audio = getAudioPlayer()
  audio.src = src
  audio.seek(0)
  audio.play()
}

/**
 * 播放完整 CW 电码时序
 * @param {string} code - 如 ".-/-.../.-."
 * @param {number} wpm - 发报速度
 */
function playCode(code, wpm = 20) {
  return new Promise((resolve) => {
    if (!_audioReady) {
      console.warn('音频未就绪，跳过播放')
      resolve()
      return
    }

    const unitMs = Math.round(1200 / wpm)
    let currentTime = 0
    const schedule = []

    for (let i = 0; i < code.length; i++) {
      const char = code[i]
      switch (char) {
        case '.':
          schedule.push({ type: 'dit', time: currentTime })
          currentTime += unitMs + unitMs  // 音长 + 间隔
          break
        case '-':
          schedule.push({ type: 'dah', time: currentTime })
          currentTime += unitMs * 3 + unitMs
          break
        case '/':
          currentTime += unitMs * 2  // 字母间隔额外 2unit (已有1unit在音后)
          break
        case '|':
          currentTime += unitMs * 6  // 单词间隔额外 6unit
          break
        default:
          break
      }
    }

    const startTime = Date.now()
    schedule.forEach(item => {
      setTimeout(() => {
        playTone(item.type)
      }, item.time)
    })

    setTimeout(resolve, currentTime + 50)
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
      initAudioPool()
      await initAudioFiles()
      this._ready = true
    } catch (err) {
      console.error('音频初始化失败', err)
    }
  }

  async updateWpm(wpm) {
    this.unitMs = Math.round(1200 / wpm)
    // 音频文件本身不变，只改变时序间隔
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
      // 点划间隔 1 unit
      setTimeout(() => {
        this._transmitNext()
      }, this.unitMs)
    }, duration)
  }

  _startGapTimer() {
    this.lastReleaseTime = Date.now()
    this._cancelGapTimer()

    // 3 unit 后加字母间隔 /
    this.gapTimer = setTimeout(() => {
      this._appendCharGap()
      // 再 4 unit 后（共7 unit）加单词间隔 |
      this.gapTimer = setTimeout(() => {
        this._appendWordGap()
      }, this.unitMs * 4)
    }, this.unitMs * 3)
  }

  _cancelGapTimer() {
    if (this.gapTimer) {
      clearTimeout(this.gapTimer)
      this.gapTimer = null
    }
  }

  _appendCharGap() {
    if (this.isLeftPressed || this.isRightPressed) return
    if (this.timingText.length > 0 && !this.timingText.endsWith('/') && !this.timingText.endsWith('|')) {
      this.timingText += '/'
      this.onTimingUpdate(this.timingText)
    }
  }

  _appendWordGap() {
    if (this.isLeftPressed || this.isRightPressed) return
    if (this.timingText.endsWith('/')) {
      this.timingText = this.timingText.slice(0, -1) + '|'
      this.onTimingUpdate(this.timingText)
    }
  }
}

module.exports = {
  UNIT_MS,
  DASH_MS,
  TONE_FREQ,
  playTone,
  playCode,
  initAudioFiles,
  isAudioReady,
  PaddleKeyer
}
