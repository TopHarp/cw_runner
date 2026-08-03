const { PaddleKeyer, playCode, setAudioEnabled, activateAudio, DEFAULT_WPM, setWordGapUnits, getWordGapUnits } = require('../../utils/cw.js')
const { uploadCW, getCWList } = require('../../utils/cloud.js')
const { CLOUD_ENABLED } = require('../../utils/config.js')

Page({
  data: {
    timingText: '',
    wpm: DEFAULT_WPM,
    cwList: [],
    isLeftPressed: false,
    isRightPressed: false,
    playingId: '',
    loading: false,
    cloudEnabled: CLOUD_ENABLED,
    audioReady: false,
    // 分页相关
    pageOffset: 0,
    hasMore: true,
    loadMoreStatus: '',
    loadMoreText: '',
    // 视觉反馈
    flashDit: false,
    flashDah: false,
    // 侧音开关
    audioEnabled: false,
    // 振动开关
    vibrateEnabled: false,
    wordGapUnits: getWordGapUnits()    // ← 新增：单词间隔默认值
  },

  paddleKeyer: null,
  audioActivated: false,

  async onLoad() {
    // 初始化 Paddle 自动键（等待音频文件加载）
    try {
      this.paddleKeyer = new PaddleKeyer({
        unitMs: Math.round(1200 / this.data.wpm),
        onTimingUpdate: (text) => {
          this.setData({ timingText: text })
        },
        onToneStart: (element) => {
          this.setData({
            flashDit: element === 'dit',
            flashDah: element === 'dah'
          })
        },
        onToneEnd: (element) => {
          this.setData({
            flashDit: false,
            flashDah: false
          })
        },
        onVibrate: (element) => {  // 新增振动
          if (this.data.vibrateEnabled) {
            this._doVibrate()
          }
        }
      })
      // 等待音频初始化完成（新 cw.js 使用 init() 方法）
      await this.paddleKeyer.init()
      setAudioEnabled(false) // 默认静音
      this.setData({ audioReady: true })
    } catch (err) {
      console.error('PaddleKeyer 初始化失败', err)
      wx.showToast({ title: '音频加载失败', icon: 'none' })
    }

    // 加载列表（异步，不阻塞渲染）
    this.loadCWList(false).catch(err => {
      console.error('初始加载列表失败', err)
    })

    if (!CLOUD_ENABLED) {
      console.log('[本地模式] 云端存储已关闭，报文仅保存到本地 Mock')
    }

    // 首次使用提示：建议使用振动侧音
    const hasShownVibrateTip = wx.getStorageSync('cw_vibrate_tip_shown')
    if (!hasShownVibrateTip) {
      wx.showModal({
        title: '使用建议',
        content: '由于音频有延迟，建议使用振动作为侧音效果最佳，打开页面侧音开关，并且手机设置中开启触摸振动',
        showCancel: false,
        confirmText: '知道了',
        success(res) {
          if (res.confirm) {
            wx.setStorageSync('cw_vibrate_tip_shown', true)
          }
        }
      })
    }
  },

  onUnload() {
    this._stopFastDelete()
    if (this.paddleKeyer) {
      this.paddleKeyer.clear()
    }
  },

  // ==================== Paddle 事件 ====================

  onLeftPress() {
    if (!this.paddleKeyer || !this.paddleKeyer.isReady()) return
    this._ensureAudioActivated()
    this.setData({ isLeftPressed: true })
    this.paddleKeyer.pressLeft()
  },

  _ensureAudioActivated() {
    if (this.audioActivated) return
    this.audioActivated = true
    activateAudio().catch(err => {
      console.error('音频激活失败', err)
      this.audioActivated = false
    })
  },

  onLeftRelease() {
    if (!this.paddleKeyer) return
    this.setData({ isLeftPressed: false })
    this.paddleKeyer.releaseLeft()
  },

  onRightPress() {
    if (!this.paddleKeyer || !this.paddleKeyer.isReady()) return
    this._ensureAudioActivated()
    this.setData({ isRightPressed: true })
    this.paddleKeyer.pressRight()
  },

  onFirstTouch() {
    this._ensureAudioActivated()
  },

  onRightRelease() {
    if (!this.paddleKeyer) return
    this.setData({ isRightPressed: false })
    this.paddleKeyer.releaseRight()
  },

  // ==================== 操作按钮 ====================

  onWpmChange(e) {
    const newWpm = e.detail.value
    this.setData({ wpm: newWpm })
    if (this.paddleKeyer) {
      this.paddleKeyer.updateWpm(newWpm)
    }
  },

  onWordGapChange(e) {    // ← 新增：滑动条改变时调用
    const units = parseInt(e.detail.value)
    this.setData({ wordGapUnits: units })
    setWordGapUnits(units)   // ← 同步修改 cw.js 中的全局值
  },

  onHelp() {
    wx.navigateTo({ url: '/pages/help/help' })
  },

  onAudioToggle() {
    const newState = !this.data.audioEnabled
    setAudioEnabled(newState)
    this.setData({ audioEnabled: newState })
  },

  onVibrateToggle() {
    const newState = !this.data.vibrateEnabled
    this.setData({ vibrateEnabled: newState })
    wx.showToast({ title: newState ? '振动已开启，需要手机开启“触摸时振动“' : '振动已关闭', icon: 'none' })
    // 立即测试一次，让用户感知
    if (newState) {
      this._doVibrate()
    }
  },

  _doVibrate() {
    wx.vibrateShort()
  },

  onClear() {
    this._stopFastDelete()
    if (this.paddleKeyer) {
      this.paddleKeyer.clear()
    }
    this.setData({ timingText: '', flashDit: false, flashDah: false })
  },

  onDelete() {
    if (!this.data.timingText || this.data.timingText.length === 0) {
      return
    }
    const newText = this.data.timingText.slice(0, -1)
    // 取消可能存在的间隔定时器
    if (this.paddleKeyer) {
      this.paddleKeyer._cancelGapTimer()
      // 恢复删除后的时序文本
      this.paddleKeyer.restoreTiming(newText)
    }
    this.setData({ timingText: newText })
  },

  onDeleteLongPress() {
    this._startFastDelete()
  },

  onDeleteLongEnd() {
    this._stopFastDelete()
  },

  _startFastDelete() {
    if (this._fastDeleteTimer) return
    // 先删除一次（长按触发时本身不执行 onDelete，所以这里补一次）
    this._doFastDeleteTick()
    this._fastDeleteTimer = setInterval(() => {
      this._doFastDeleteTick()
    }, 120)
  },

  _stopFastDelete() {
    if (this._fastDeleteTimer) {
      clearInterval(this._fastDeleteTimer)
      this._fastDeleteTimer = null
    }
  },

  _doFastDeleteTick() {
    if (!this.data.timingText || this.data.timingText.length === 0) {
      this._stopFastDelete()
      return
    }
    const newText = this.data.timingText.slice(0, -1)
    if (this.paddleKeyer) {
      this.paddleKeyer._cancelGapTimer()
      this.paddleKeyer.restoreTiming(newText)
    }
    this.setData({ timingText: newText })
  },


  onSend() {
    const { timingText, wpm } = this.data
    if (!timingText || timingText.length === 0) {
      wx.showToast({ title: '请先输入电码', icon: 'none' })
      return
    }

    wx.showLoading({ title: '保存中...' })

    uploadCW(timingText, wpm)
      .then(() => {
        wx.hideLoading()
        wx.showToast({ title: '保存成功', icon: 'success' })
        this.paddleKeyer.clear()
        this.setData({ timingText: '' })
        this.loadCWList(false)
      })
      .catch(err => {
        wx.hideLoading()
        wx.showToast({ title: err.errMsg || '保存失败', icon: 'none' })
      })
  },

  // ==================== 列表操作 ====================

  onRefresh() {
    this.loadCWList(false)
  },

  onLoadMore() {
    if (!this.data.hasMore || this.data.loadMoreStatus === 'loading') {
      return
    }
    this.loadCWList(true)
  },

  loadCWList(isAppend = false) {
    const offset = isAppend ? this.data.pageOffset : 0

    if (!isAppend) {
      this.setData({ loading: true })
    } else {
      this.setData({ loadMoreStatus: 'loading', loadMoreText: '加载中...' })
    }

    return getCWList(20, offset)
      .then(res => {
        const newList = (res.list || []).map(item => ({
          ...item,
          timeStr: this.formatTime(item.timestamp)
        }))

        const cwList = isAppend
          ? [...this.data.cwList, ...newList]
          : newList

        const hasMore = newList.length === 20

        this.setData({
          cwList,
          pageOffset: offset + newList.length,
          hasMore,
          loading: false,
          loadMoreStatus: hasMore ? '' : 'no-more',
          loadMoreText: hasMore ? '' : '没有更多了'
        })
      })
      .catch(err => {
        console.error('获取列表失败', err)
        if (!isAppend) {
          this.setData({
            cwList: [],
            loading: false,
            pageOffset: 0,
            hasMore: true,
            loadMoreStatus: '',
            loadMoreText: ''
          })
        } else {
          this.setData({
            loadMoreStatus: '',
            loadMoreText: '加载失败，请重试'
          })
        }
      })
  },

  onPlay(e) {
    const { id, code, wpm } = e.currentTarget.dataset
    if (!code || this.data.playingId === id) return

    this.setData({ playingId: id })

    playCode(code, wpm || DEFAULT_WPM)
      .then(() => {
        this.setData({ playingId: '' })
      })
      .catch(err => {
        console.error('播放失败', err)
        this.setData({ playingId: '' })
        wx.showToast({ title: '播放失败', icon: 'none' })
      })
  },

  // ==================== 工具方法 ====================

  formatTime(timestamp) {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    const now = new Date()
    const diff = Math.floor((now - date) / 1000)

    if (diff < 60) return '刚刚'
    if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
    if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`
    if (diff < 604800) return `${Math.floor(diff / 86400)}天前`

    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    const hour = date.getHours().toString().padStart(2, '0')
    const minute = date.getMinutes().toString().padStart(2, '0')
    return `${month}-${day} ${hour}:${minute}`
  }
})
