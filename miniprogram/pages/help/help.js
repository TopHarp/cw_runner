const { uploadComment, getCommentList } = require('../../utils/cloud.js')

const COMMENT_PREVIEW_LENGTH = 40

Page({
  data: {
    commentText: '',
    commentList: [],
    showCommentModal: false,
    selectedComment: {}
  },

  onLoad() {
    this.loadComments()
  },

  onBack() {
    wx.navigateBack()
  },

  // ==================== 留言板 ====================

  onCommentInput(e) {
    const value = e.detail.value || ''
    this.setData({ commentText: value })
  },

  async onSubmitComment() {
    const { commentText } = this.data
    const trimmed = (commentText || '').trim()
    if (!trimmed) {
      wx.showToast({ title: '留言不能为空', icon: 'none' })
      return
    }

    wx.showLoading({ title: '保存中...', mask: true })
    try {
      await uploadComment(trimmed)
      wx.hideLoading()
      wx.showToast({ title: '留言成功', icon: 'success' })
      this.setData({ commentText: '' })
      await this.loadComments()
    } catch (err) {
      wx.hideLoading()
      wx.showToast({
        title: err.errMsg || err.message || '保存失败',
        icon: 'none'
      })
    }
  },

  async loadComments() {
    try {
      const res = await getCommentList(50)
      if (res.success) {
        const list = (res.list || []).map(item => ({
          ...item,
          preview: this._preview(item.content),
          timeStr: this._formatTime(item.timestamp)
        }))
        this.setData({ commentList: list })
      }
    } catch (err) {
      console.error('加载留言失败', err)
    }
  },

  onCommentTap(e) {
    const index = e.currentTarget.dataset.index
    const item = this.data.commentList[index]
    if (!item) return
    this.setData({
      selectedComment: item,
      showCommentModal: true
    })
  },

  closeCommentModal() {
    this.setData({ showCommentModal: false })
  },

  onModalBackdropTap() {
    this.setData({ showCommentModal: false })
  },

  onModalContentTap() {
    // 阻止冒泡，避免点击内容区关闭弹窗
  },

  _preview(content) {
    if (!content) return ''
    if (content.length <= COMMENT_PREVIEW_LENGTH) return content
    return content.substring(0, COMMENT_PREVIEW_LENGTH) + '...'
  },

  _formatTime(timestamp) {
    if (!timestamp) return ''
    const date = new Date(timestamp * 1000)
    const now = new Date()
    const diff = Math.floor((now - date) / 1000)

    if (diff < 60) return '刚刚'
    if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
    if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`

    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    const hour = date.getHours().toString().padStart(2, '0')
    const minute = date.getMinutes().toString().padStart(2, '0')
    return `${month}-${day} ${hour}:${minute}`
  }
})
