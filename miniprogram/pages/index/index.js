const { PaddleKeyer, playCode } = require('../../utils/cw.js')
const { uploadCW, getCWList } = require('../../utils/cloud.js')
const { CLOUD_ENABLED } = require('../../utils/config.js')

Page({
  data: {
    timingText: '',
    wpm: 20,
    cwList: [],
    isLeftPressed: false,
    isRightPressed: false,
    playingId: '',
    loading: false,
    cloudEnabled: CLOUD_ENABLED
  },

  paddleKeyer: null,

  onLoad() {
    // 初始化 Paddle 自动键
    this.paddleKeyer = new PaddleKeyer({
      unitMs: 1200 / this.data.wpm,
      onTimingUpdate: (text) => {
        this.setData({ timingText: text })
      },
      onToneStart: (element) => {
        // 音开始，可添加视觉反馈
      },
      onToneEnd: (element) => {
        // 音结束
      }
    })

    // 加载列表
    this.loadCWList()

    if (!CLOUD_ENABLED) {
      console.log('[本地模式] 云端存储已关闭，报文仅保存到本地 Mock')
    }
  },

  onUnload() {
    if (this.paddleKeyer) {
      this.paddleKeyer.clear()
    }
  },

  // ==================== Paddle 事件 ====================

  onLeftPress() {
    this.setData({ isLeftPressed: true })
    this.paddleKeyer.pressLeft()
  },

  onLeftRelease() {
    this.setData({ isLeftPressed: false })
    this.paddleKeyer.releaseLeft()
  },

  onRightPress() {
    this.setData({ isRightPressed: true })
    this.paddleKeyer.pressRight()
  },

  onRightRelease() {
    this.setData({ isRightPressed: false })
    this.paddleKeyer.releaseRight()
  },

  // ==================== 操作按钮 ====================

  onWpmChange(e) {
    const newWpm = e.detail.value
    this.setData({ wpm: newWpm })
    if (this.paddleKeyer) {
      this.paddleKeyer.unitMs = Math.round(1200 / newWpm)
    }
  },

  onClear() {
    this.paddleKeyer.clear()
    this.setData({ timingText: '' })
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
        this.loadCWList()
      })
      .catch(err => {
        wx.hideLoading()
        wx.showToast({ title: err.errMsg || '保存失败', icon: 'none' })
      })
  },

  // ==================== 列表操作 ====================

  onRefresh() {
    this.loadCWList()
  },

  loadCWList() {
    this.setData({ loading: true })

    getCWList(20, 0)
      .then(res => {
        const list = res.list.map(item => ({
          ...item,
          timeStr: this.formatTime(item.timestamp)
        }))
        this.setData({
          cwList: list,
          loading: false
        })
      })
      .catch(err => {
        console.error('获取列表失败', err)
        this.setData({ loading: false })
        wx.showToast({ title: '获取列表失败', icon: 'none' })
      })
  },

  onPlay(e) {
    const { id, code, wpm } = e.currentTarget.dataset
    if (!code || this.data.playingId === id) return

    this.setData({ playingId: id })

    playCode(code, wpm || 20)
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
    const date = new Date(timestamp * 1000)
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
