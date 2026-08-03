const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const MAX_LIMIT = 100
const EXPIRE_SECONDS = 200 * 60 * 60  // 200小时过期

exports.main = async (event, context) => {
  const { limit = 50 } = event

  const limitNum = parseInt(limit)

  if (isNaN(limitNum) || limitNum <= 0 || limitNum > MAX_LIMIT) {
    return { success: false, errMsg: `limit 必须在 1-${MAX_LIMIT} 之间` }
  }

  const now = Math.floor(Date.now() / 1000)
  const expireTime = now - EXPIRE_SECONDS

  try {
    // 被动清理过期数据
    try {
      const expiredRes = await db.collection('cw_comments')
        .where({
          timestamp: db.command.lt(expireTime)
        })
        .remove()

      if (expiredRes.stats && expiredRes.stats.removed > 0) {
        console.log(`已清理 ${expiredRes.stats.removed} 条过期留言`)
      }
    } catch (e) {
      console.error('清理过期留言失败', e)
    }

    // 查询有效数据
    const result = await db.collection('cw_comments')
      .where({
        timestamp: db.command.gte(expireTime)
      })
      .orderBy('timestamp', 'desc')
      .limit(limitNum)
      .field({
        _id: true,
        content: true,
        timestamp: true
      })
      .get()

    return {
      success: true,
      list: result.data || []
    }
  } catch (err) {
    console.error('留言查询失败', err)
    return { success: false, errMsg: '服务器错误，请稍后再试' }
  }
}
