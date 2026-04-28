const { playCode, initAudioFiles, isAudioReady } = require('../../utils/cw.js')

Page({
  data: {
    code: '',
    wpm: 20,
    isPlaying: false,
    audioReady: false
  },

  async onLoad(options) {
    // 预加载音频
    try {
      await initAudioFiles()
      this.setData({ audioReady: true })
    } catch (err) {
      console.error('音频加载失败', err)
      wx.showToast({ title: '音频加载失败', icon: 'none' })
    }

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

  async onPlay() {
    const { code, wpm, isPlaying } = this.data
    if (!code || isPlaying) return

    // 确保音频已就绪
    if (!isAudioReady()) {
      try {
        await initAudioFiles()
        this.setData({ audioReady: true })
      } catch (err) {
        wx.showToast({ title: '音频未就绪', icon: 'none' })
        return
      }
    }

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
