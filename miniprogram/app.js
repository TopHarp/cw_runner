const { CLOUD_ENABLED } = require('./utils/config.js')

App({
  globalData: {
    userInfo: null,
    openid: '',
    cloudEnabled: CLOUD_ENABLED
  },

  onLaunch() {
    if (CLOUD_ENABLED) {
      // 初始化云开发
      if (!wx.cloud) {
        console.error('请使用 2.2.3 或以上的基础库以使用云能力')
      } else {
        wx.cloud.init({
          env: 'cloud1-d6ghxthrlbd200729',
          traceUser: true
        })
      }
      // 获取用户 openid
      this.getOpenid()
    } else {
      console.log('[本地模式] 云端存储已关闭，报文仅保存到本地 Mock')
    }
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
