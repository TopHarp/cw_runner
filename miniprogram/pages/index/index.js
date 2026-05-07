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
    cloudEnabled: CLOUD_ENABLED,
    audioReady: false,
    // 分页相关
    pageOffset: 0,
    hasMore: true,
    loadMoreStatus: '',
    loadMoreText: ''
  },

  paddleKeyer: null,

  async onLoad() {
    // 初始化 Paddle 自动键（等待音频文件加载）
    try {
      this.paddleKeyer = new PaddleKeyer({
        unitMs: Math.round(1200 / this.data.wpm),
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
      // 等待音频初始化完成（新 cw.js 使用 init() 方法）
      await this.paddleKeyer.init()
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
  },

  onUnload() {
    if (this.paddleKeyer) {
      this.paddleKeyer.clear()
    }
  },

  // ==================== Paddle 事件 ====================

  onLeftPress() {
    if (!this.paddleKeyer || !this.paddleKeyer.isReady()) return
    this.setData({ isLeftPressed: true })
    this.paddleKeyer.pressLeft()
  },

  onLeftRelease() {
    if (!this.paddleKeyer) return
    this.setData({ isLeftPressed: false })
    this.paddleKeyer.releaseLeft()
  },

  onRightPress() {
    if (!this.paddleKeyer || !this.paddleKeyer.isReady()) return
    this.setData({ isRightPressed: true })
    this.paddleKeyer.pressRight()
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

  onClear() {
    if (this.paddleKeyer) {
      this.paddleKeyer.clear()
    }
    this.setData({ timingText: '' })
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
