const { playCode } = require('../../utils/cw.js')

Page({
  data: {
    code: '',
    wpm: 20,
    isPlaying: false
  },

  onLoad(options) {
    if (options.code) {
      this.setData({
        code: decodeURIComponent(options.code),
        wpm: parseInt(options.wpm) || 20
      })
    }
  },

  onWpmChange(e) {
    this.setData({ wpm: e.detail.value })
  },

  onPlay() {
    const { code, wpm, isPlaying } = this.data
    if (!code || isPlaying) return

    this.setData({ isPlaying: true })

    playCode(code, wpm)
      .then(() => {
        this.setData({ isPlaying: false })
      })
      .catch(err => {
        console.error('播放失败', err)
        this.setData({ isPlaying: false })
        wx.showToast({ title: '播放失败', icon: 'none' })
      })
  }
})
