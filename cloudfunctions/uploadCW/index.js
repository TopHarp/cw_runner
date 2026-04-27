const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const MAX_CODE_LENGTH = 500
const MAX_UPLOAD_PER_HOUR = 50

exports.main = async (event, context) => {
  const { code, wpm = 20 } = event
  const { OPENID } = cloud.getWXContext()

  // 参数校验
  if (!code || typeof code !== 'string') {
    return { success: false, errMsg: 'code 不能为空' }
  }

  if (code.length === 0) {
    return { success: false, errMsg: 'code 不能为空' }
  }

  if (code.length > MAX_CODE_LENGTH) {
    return { success: false, errMsg: `code 长度不能超过 ${MAX_CODE_LENGTH}` }
  }

  // 校验合法字符：仅允许 . - / |
  const validPattern = /^[.\-/|]+$/
  if (!validPattern.test(code)) {
    return { success: false, errMsg: 'code 包含非法字符，仅允许 . - / |' }
  }

  // WPM 校验
  const wpmNum = parseInt(wpm)
  if (isNaN(wpmNum) || wpmNum < 5 || wpmNum > 60) {
    return { success: false, errMsg: 'wpm 必须在 5-60 之间' }
  }

  // 频率限制：每小时最多 50 条
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  try {
    const recentCount = await db.collection('cw_messages')
      .where({
        sender: OPENID,
        timestamp: db.command.gt(Math.floor(oneHourAgo.getTime() / 1000))
      })
      .count()

    if (recentCount.total >= MAX_UPLOAD_PER_HOUR) {
      return { success: false, errMsg: '上传过于频繁，请稍后再试' }
    }
  } catch (err) {
    console.error('频率检查失败', err)
    // 频率检查失败不阻断，继续上传
  }

  // 生成匿名 sender ID（取 openid 前 16 位哈希）
  const senderId = OPENID.substring(0, 16)

  // 写入数据库
  try {
    const result = await db.collection('cw_messages').add({
      data: {
        code: code,
        wpm: wpmNum,
        timestamp: Math.floor(Date.now() / 1000),
        sender: senderId
      }
    })

    return {
      success: true,
      id: result._id
    }
  } catch (err) {
    console.error('数据库写入失败', err)
    return { success: false, errMsg: '服务器错误，请稍后再试' }
  }
}
