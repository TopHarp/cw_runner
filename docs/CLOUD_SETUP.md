# CW Runner - 云开发环境配置指南

## 1. 开通云开发环境

如果你还没有开通：

1. 打开微信开发者工具
2. 点击工具栏上的「云开发」按钮
3. 按提示开通（有免费额度）
4. 记录「环境 ID」（形如：`cw-runner-xxx`）

## 2. 代码修改（3 处）

### 2.1 开启云端存储开关

文件：`miniprogram/utils/config.js`

```javascript
const CLOUD_ENABLED = true  // false → true
```

### 2.2 填入你的云环境 ID

文件：`miniprogram/app.js`

```javascript
wx.cloud.init({
  env: '你的环境ID',  // 替换为实际环境 ID，如 'cw-runner-5g5k2k8k'
  traceUser: true
})
```

### 2.3 配置 project.config.json（添加 cloudfunctionRoot）

文件：`project.config.json`

在根级别添加：

```json
{
  "compileType": "miniprogram",
  "miniprogramRoot": "miniprogram/",
  "cloudfunctionRoot": "cloudfunctions/",
  ...
}
```

## 3. 创建云数据库集合

1. 微信开发者工具 → 云开发 → 数据库
2. 点击「添加集合」
3. 集合名称：`cw_messages`
4. 权限设置：选择「仅创建者可读写，所有人可读」或「所有用户可读，仅创建者可写」

## 4. 部署云函数

### 4.1 安装依赖

对每个云函数目录执行：

```bash
cd /home/owen/file/awosome/my_agent/cw_runner/cloudfunctions/uploadCW
npm install

cd /home/owen/file/awosome/my_agent/cw_runner/cloudfunctions/getCWList
npm install

cd /home/owen/file/awesome/my_agent/cw_runner/cloudfunctions/getOpenid
npm install
```

> 如果系统没有 npm，在微信开发者工具中右键云函数文件夹 →「在终端中打开」→ 执行 `npm install`

### 4.2 部署到云端

在微信开发者工具中：

1. 右键 `cloudfunctions/uploadCW` 文件夹 →「创建并部署：云端安装依赖」
2. 右键 `cloudfunctions/getCWList` 文件夹 →「创建并部署：云端安装依赖」
3. 右键 `cloudfunctions/getOpenid` 文件夹 →「创建并部署：云端安装依赖」

## 5. 验证测试

1. 重新编译项目（Ctrl+R 或点击编译按钮）
2. 打开模拟器，确认「本地模式」横幅已消失
3. 用 Paddle 输入一段电码，点击「保存」
4. 观察：
   - Console 无报错
   - 列表自动刷新，出现新保存的报文
   - 云开发 → 数据库 → `cw_messages` 集合中能看到新记录

## 6. 常见问题

### Q1：保存时报错 "cloud.callFunction:fail Error: errCode: -404011"

云函数未部署或部署失败。重新右键云函数文件夹 →「创建并部署」。

### Q2：保存时报错 "未找到对应的环境"

`app.js` 中的 `env` 值不正确。确认填写的是完整环境 ID（不是名称）。

### Q3：数据库中看不到数据

检查数据库集合名称是否为 `cw_messages`（注意大小写）。

### Q4：云开发按钮是灰色的

确认小程序 AppID 是正式号（不是测试号）。测试号无法使用云开发。
