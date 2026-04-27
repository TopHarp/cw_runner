/**
 * 云开发封装工具
 * 负责：CW 文本上传、云端列表获取
 * DEBUG_MODE 下使用本地 Mock 数据
 */

const { DEBUG_MODE } = require('./config.js')

const DB_NAME = 'cw_messages'

// 本地调试用的 Mock 数据
const MOCK_LIST = [
  { _id: 'mock_1', code: '.-/-.../.-.', wpm: 20, timestamp: Math.floor(Date.now() / 1000) - 300 },
  { _id: 'mock_2', code: '--./.-..', wpm: 18, timestamp: Math.floor(Date.now() / 1000) - 900 },
  { _id: 'mock_3', code: '.../---/...', wpm: 25, timestamp: Math.floor(Date.now() / 1000) - 1800 }
]

/**
 * 上传 CW 时序文本到云端
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

    // 校验合法字符
    const validPattern = /^[.\-/|]+$/
    if (!validPattern.test(code)) {
      reject({ success: false, errMsg: '时序文本包含非法字符' })
      return
    }

    // 长度限制
    if (code.length > 500) {
      reject({ success: false, errMsg: '时序文本超过最大长度 500' })
      return
    }

    // DEBUG 模式：模拟上传成功，写入本地 Mock
    if (DEBUG_MODE) {
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

    wx.cloud.callFunction({
      name: 'uploadCW',
      data: {
        code: code,
        wpm: wpm
      }
    }).then(res => {
      if (res.result && res.result.success) {
        resolve({
          success: true,
          id: res.result.id
        })
      } else {
        reject({
          success: false,
          errMsg: res.result.errMsg || '上传失败'
        })
      }
    }).catch(err => {
      reject({
        success: false,
        errMsg: err.message || '网络错误'
      })
    })
  })
}

/**
 * 获取云端 CW 列表
 * @param {number} limit - 每页数量（默认 20）
 * @param {number} offset - 偏移量（默认 0）
 * @returns {Promise<{success: boolean, list?: Array, errMsg?: string}>}
 */
function getCWList(limit = 20, offset = 0) {
  return new Promise((resolve, reject) => {
    // DEBUG 模式：返回本地 Mock 数据
    if (DEBUG_MODE) {
      resolve({
        success: true,
        list: MOCK_LIST.slice(offset, offset + limit)
      })
      return
    }

    wx.cloud.callFunction({
      name: 'getCWList',
      data: {
        limit: limit,
        offset: offset
      }
    }).then(res => {
      if (res.result && res.result.success) {
        resolve({
          success: true,
          list: res.result.list || []
        })
      } else {
        reject({
          success: false,
          errMsg: res.result.errMsg || '获取列表失败'
        })
      }
    }).catch(err => {
      reject({
        success: false,
        errMsg: err.message || '网络错误'
      })
    })
  })
}

/**
 * 直接通过数据库获取列表（备用，无需云函数时）
 * @param {number} limit - 每页数量
 * @returns {Promise<Array>}
 */
function getCWListDirect(limit = 20) {
  if (DEBUG_MODE) {
    return Promise.resolve(MOCK_LIST.slice(0, limit))
  }

  const db = wx.cloud.database()
  return db.collection(DB_NAME)
    .orderBy('timestamp', 'desc')
    .limit(limit)
    .get()
    .then(res => res.data)
}

module.exports = {
  uploadCW,
  getCWList,
  getCWListDirect
}
