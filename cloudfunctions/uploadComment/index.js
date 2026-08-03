const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const MAX_CONTENT_LENGTH = 300
const MAX_UPLOAD_PER_HOUR = 20
const EXPIRE_SECONDS = 200 * 60 * 60  // 200小时过期

exports.main = async (event, context) => {
  const { content } = event
  const { OPENID } = cloud.getWXContext()

  // 参数校验
  if (!content || typeof content !== 'string') {
    return { success: false, errMsg: '留言内容不能为空' }
  }

  const trimmed = content.trim()
  if (trimmed.length === 0) {
    return { success: false, errMsg: '留言内容不能为空' }
  }

  if (trimmed.length > MAX_CONTENT_LENGTH) {
    return { success: false, errMsg: `留言内容不能超过 ${MAX_CONTENT_LENGTH} 字` }
  }

  const now = Math.floor(Date.now() / 1000)
  const expireTime = now - EXPIRE_SECONDS

  // 频率限制：每小时最多 20 条
  try {
    const recentCount = await db.collection('cw_comments')
      .where({
        sender: OPENID,
        timestamp: db.command.gt(Math.floor(now - 60 * 60))
      })
      .count()

    if (recentCount.total >= MAX_UPLOAD_PER_HOUR) {
      return { success: false, errMsg: '留言过于频繁，请稍后再试' }
    }
  } catch (err) {
    console.error('频率检查失败', err)
  }

  // 写入数据库
  try {
    const result = await db.collection('cw_comments').add({
      data: {
        content: trimmed,
        timestamp: now,
        expireAt: now + EXPIRE_SECONDS,
        sender: OPENID.substring(0, 16)
      }
    })

    // 被动清理过期数据
    try {
      await db.collection('cw_comments')
        .where({
          timestamp: db.command.lt(expireTime)
        })
        .remove()
    } catch (e) {
      console.error('清理过期留言失败', e)
    }

    return {
      success: true,
      id: result._id
    }
  } catch (err) {
    console.error('留言写入失败', err)
    return { success: false, errMsg: '服务器错误，请稍后再试' }
  }
}
