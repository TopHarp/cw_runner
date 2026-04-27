App({
  globalData: {
    userInfo: null,
    openid: ''
  },

  onLaunch() {
    // 初始化云开发
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        env: 'cw-runner-env',
        traceUser: true
      })
    }

    // 获取用户 openid
    this.getOpenid()
  },

  getOpenid() {
    wx.cloud.callFunction({
      name: 'getOpenid'
    }).then(res => {
      this.globalData.openid = res.result.openid
    }).catch(err => {
      console.error('获取 openid 失败', err)
    })
  }
})
