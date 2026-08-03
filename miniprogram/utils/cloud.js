/**
 * 云开发封装工具
 * 负责：CW 文本上传、云端列表获取、留言板
 * CLOUD_ENABLED=false 时使用本地 Mock 数据（无云环境权限时调试用）
 */

const { CLOUD_ENABLED } = require('./config.js')

const DB_NAME = 'cw_messages'
const COMMENT_DB_NAME = 'cw_comments'
const COMMENT_EXPIRE_SECONDS = 200 * 60 * 60  // 200小时

// 本地调试用的 Mock 数据
const MOCK_LIST = [
  { _id: 'mock_1', code: '.-/-.../.-.', wpm: 20, timestamp: Math.floor(Date.now() / 1000) - 300 },
  { _id: 'mock_2', code: '--./.-..', wpm: 18, timestamp: Math.floor(Date.now() / 1000) - 900 },
  { _id: 'mock_3', code: '.../---/...', wpm: 25, timestamp: Math.floor(Date.now() / 1000) - 1800 }
]

const MOCK_COMMENTS = []

/**
 * 上传 CW 时序文本
 * @param {string} code - 时序文本
 * @param {number} wpm - 发报速度（默认 20）
 * @returns {Promise<{success: boolean, id?: string, errMsg?: string}>}
 */
function uploadCW(code, wpm = 20) {
  return new Promise((resolve, reject) => {
    // 客户端校验
    if (!code || code.length === 0) {
      reject({ success: false, errMsg: '时序文本不能为空' })
      return
    }

    const validPattern = /^[.\-/|]+$/
    if (!validPattern.test(code)) {
      reject({ success: false, errMsg: '时序文本包含非法字符' })
      return
    }

    if (code.length > 500) {
      reject({ success: false, errMsg: '时序文本超过最大长度 500' })
      return
    }

    // 本地模式：写入 Mock 数组
    if (!CLOUD_ENABLED) {
      const mockItem = {
        _id: 'mock_' + Date.now(),
        code: code,
        wpm: wpm,
        timestamp: Math.floor(Date.now() / 1000)
      }
      MOCK_LIST.unshift(mockItem)
      if (MOCK_LIST.length > 20) MOCK_LIST.pop()
      resolve({ success: true, id: mockItem._id })
      return
    }

    // 云端模式：调用云函数
    wx.cloud.callFunction({
      name: 'uploadCW',
      data: { code, wpm }
    }).then(res => {
      if (res.result && res.result.success) {
        resolve({ success: true, id: res.result.id })
      } else {
        reject({ success: false, errMsg: res.result.errMsg || '上传失败' })
      }
    }).catch(err => {
      reject({ success: false, errMsg: err.message || '网络错误' })
    })
  })
}

/**
 * 获取 CW 列表
 * @param {number} limit - 每页数量（默认 20）
 * @param {number} offset - 偏移量（默认 0）
 * @returns {Promise<{success: boolean, list?: Array, errMsg?: string}>}
 */
function getCWList(limit = 20, offset = 0) {
  return new Promise((resolve, reject) => {
    // 本地模式：返回 Mock 数据
    if (!CLOUD_ENABLED) {
      resolve({
        success: true,
        list: MOCK_LIST.slice(offset, offset + limit)
      })
      return
    }

    // 云端模式：调用云函数
    wx.cloud.callFunction({
      name: 'getCWList',
      data: { limit, offset }
    }).then(res => {
      if (res.result && res.result.success) {
        resolve({ success: true, list: res.result.list || [] })
      } else {
        reject({ success: false, errMsg: res.result.errMsg || '获取列表失败' })
      }
    }).catch(err => {
      reject({ success: false, errMsg: err.message || '网络错误' })
    })
  })
}

/**
 * 直接通过数据库获取列表（备用，无需云函数时）
 * @param {number} limit - 每页数量
 * @returns {Promise<Array>}
 */
function getCWListDirect(limit = 20) {
  if (!CLOUD_ENABLED) {
    return Promise.resolve(MOCK_LIST.slice(0, limit))
  }

  const db = wx.cloud.database()
  return db.collection(DB_NAME)
    .orderBy('timestamp', 'desc')
    .limit(limit)
    .get()
    .then(res => res.data)
}

// ==================== 留言板 ====================

/**
 * 上传留言
 * @param {string} content - 留言内容
 * @returns {Promise<{success: boolean, id?: string, errMsg?: string}>}
 */
function uploadComment(content) {
  return new Promise((resolve, reject) => {
    if (!content || typeof content !== 'string') {
      reject({ success: false, errMsg: '留言内容不能为空' })
      return
    }

    const trimmed = content.trim()
    if (trimmed.length === 0) {
      reject({ success: false, errMsg: '留言内容不能为空' })
      return
    }

    if (trimmed.length > 300) {
      reject({ success: false, errMsg: '留言内容不能超过 300 字' })
      return
    }

    const now = Math.floor(Date.now() / 1000)

    // 本地模式
    if (!CLOUD_ENABLED) {
      // 清理过期 Mock 数据
      const expireTime = now - COMMENT_EXPIRE_SECONDS
      for (let i = MOCK_COMMENTS.length - 1; i >= 0; i--) {
        if (MOCK_COMMENTS[i].timestamp < expireTime) {
          MOCK_COMMENTS.splice(i, 1)
        }
      }
      const mockItem = {
        _id: 'comment_' + Date.now(),
        content: trimmed,
        timestamp: now
      }
      MOCK_COMMENTS.unshift(mockItem)
      if (MOCK_COMMENTS.length > 50) MOCK_COMMENTS.pop()
      resolve({ success: true, id: mockItem._id })
      return
    }

    // 云端模式
    wx.cloud.callFunction({
      name: 'uploadComment',
      data: { content: trimmed }
    }).then(res => {
      if (res.result && res.result.success) {
        resolve({ success: true, id: res.result.id })
      } else {
        reject({ success: false, errMsg: res.result.errMsg || '保存失败' })
      }
    }).catch(err => {
      reject({ success: false, errMsg: err.message || '网络错误' })
    })
  })
}

/**
 * 获取留言列表
 * @param {number} limit - 每页数量（默认 50）
 * @returns {Promise<{success: boolean, list?: Array, errMsg?: string}>}
 */
function getCommentList(limit = 50) {
  return new Promise((resolve, reject) => {
    if (!CLOUD_ENABLED) {
      const now = Math.floor(Date.now() / 1000)
      const expireTime = now - COMMENT_EXPIRE_SECONDS
      const list = MOCK_COMMENTS.filter(item => item.timestamp >= expireTime)
      resolve({ success: true, list })
      return
    }

    wx.cloud.callFunction({
      name: 'getCommentList',
      data: { limit }
    }).then(res => {
      if (res.result && res.result.success) {
        resolve({ success: true, list: res.result.list || [] })
      } else {
        reject({ success: false, errMsg: res.result.errMsg || '获取留言失败' })
      }
    }).catch(err => {
      reject({ success: false, errMsg: err.message || '网络错误' })
    })
  })
}

module.exports = {
  uploadCW,
  getCWList,
  getCWListDirect,
  uploadComment,
  getCommentList
}
