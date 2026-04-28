const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const MAX_LIMIT = 50
const EXPIRE_SECONDS = 5 * 60  // 5 分钟过期

exports.main = async (event, context) => {
  const { limit = 20, offset = 0 } = event

  const limitNum = parseInt(limit)
  const offsetNum = parseInt(offset)

  if (isNaN(limitNum) || limitNum <= 0 || limitNum > MAX_LIMIT) {
    return { success: false, errMsg: `limit 必须在 1-${MAX_LIMIT} 之间` }
  }

  if (isNaN(offsetNum) || offsetNum < 0) {
    return { success: false, errMsg: 'offset 不能为负数' }
  }

  const now = Math.floor(Date.now() / 1000)
  const expireTime = now - EXPIRE_SECONDS

  try {
    // 第一步：删除过期数据（被动清理）
    // 云数据库一次最多删除 100 条，这里用 where + remove
    const expiredRes = await db.collection('cw_messages')
      .where({
        timestamp: db.command.lt(expireTime)
      })
      .remove()

    if (expiredRes.stats && expiredRes.stats.removed > 0) {
      console.log(`已清理 ${expiredRes.stats.removed} 条过期报文`)
    }

    // 第二步：查询有效数据
    const result = await db.collection('cw_messages')
      .where({
        timestamp: db.command.gte(expireTime)
      })
      .orderBy('timestamp', 'desc')
      .skip(offsetNum)
      .limit(limitNum)
      .field({
        _id: true,
        code: true,
        wpm: true,
        timestamp: true
      })
      .get()

    return {
      success: true,
      list: result.data || []
    }
  } catch (err) {
    console.error('数据库操作失败', err)
    return { success: false, errMsg: '服务器错误，请稍后再试' }
  }
}
