const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const MAX_LIMIT = 50

exports.main = async (event, context) => {
  const { limit = 20, offset = 0 } = event

  // 参数校验
  const limitNum = parseInt(limit)
  const offsetNum = parseInt(offset)

  if (isNaN(limitNum) || limitNum <= 0 || limitNum > MAX_LIMIT) {
    return { success: false, errMsg: `limit 必须在 1-${MAX_LIMIT} 之间` }
  }

  if (isNaN(offsetNum) || offsetNum < 0) {
    return { success: false, errMsg: 'offset 不能为负数' }
  }

  try {
    const result = await db.collection('cw_messages')
      .orderBy('timestamp', 'desc')
      .skip(offsetNum)
      .limit(limitNum)
      .field({
        _id: true,
        code: true,
        wpm: true,
        timestamp: true
        // 注意：不返回 sender 字段，保持匿名
      })
      .get()

    return {
      success: true,
      list: result.data || []
    }
  } catch (err) {
    console.error('数据库查询失败', err)
    return { success: false, errMsg: '服务器错误，请稍后再试' }
  }
}
