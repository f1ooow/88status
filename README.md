# 88CODE 状态栏

一个简洁的 Chrome 扩展，用于实时监控 88code 积分使用情况和智能管理每日重置。

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Chrome](https://img.shields.io/badge/Chrome-120+-green.svg)](https://www.google.com/chrome/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

> 基于 [88code-smart-reset](https://github.com/Rogers-F/88code-smart-reset) 重新设计，采用极简界面，专注核心功能。

## ✨ 特性

### 核心功能
- **实时用量显示**：一目了然地查看已用和剩余积分
- **智能重置管理**：自动在每日 18:50 和 23:55 重置积分
- **冷却保护**：5小时冷却期自动禁用按钮并显示倒计时
- **次数追踪**：清晰显示剩余重置次数（X/2）
- **PAYGO 保护**：自动跳过按量付费订阅，防止误操作

### 界面设计
- **极简风格**：受 Apple 设计启发的简洁界面
- **信息密度优化**：关键信息一屏呈现，无需滚动
- **智能状态提示**：
  - 连接状态实时显示
  - 下次重置时间（标注 1st/2nd）
  - 冷却倒计时直接显示在按钮上

## 📸 界面预览

**弹窗界面**：
- 顶部：品牌标识 + 设置入口
- 中部：已用 / 剩余积分 + 使用百分比 + 剩余次数
- 底部：重置按钮 + 连接状态 + 下次重置时间

**设置页面**：
- 账号管理：添加/删除 API Key
- 定时设置：自定义重置时间
- 日志记录：查看操作历史

## 🚀 快速开始

### 安装

1. **克隆仓库**
   ```bash
   git clone <your-repo-url>
   cd 88code-smart-reset
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **构建扩展**
   ```bash
   npm run build
   ```

4. **加载到 Chrome**
   - 打开 `chrome://extensions/`
   - 启用"开发者模式"
   - 点击"加载已解压的扩展程序"
   - 选择项目中的 `dist` 文件夹

### 配置

1. **获取 API Key**
   - 访问 [88code.org](https://www.88code.org)
   - 进入个人设置 → API 密钥
   - 复制您的密钥

2. **添加到扩展**
   - 右键点击扩展图标 → 选项
   - 在"账号管理"中粘贴 API 密钥
   - 输入账号名称（如"主账号"）
   - 点击"保存"并"测试连接"

3. **启用自动重置**（可选）
   - 进入"定时设置"
   - 勾选"启用自动重置"
   - 默认时间为 18:50 和 23:55（可自定义）

## 💡 使用说明

### 查看用量
点击扩展图标即可查看：
- **已用积分**：当前计费周期已消耗的积分
- **剩余积分**：还可以使用的积分
- **使用百分比**：用量占比
- **剩余次数**：今日还可手动重置几次（X/2）

### 手动重置
- 点击"Reset"按钮立即重置积分
- **冷却限制**：每次重置后需等待 5 小时
- **冷却期间**：按钮显示倒计时和下次可用时间，如 `4h 28m (11/22 18:15)`
- **次数限制**：每日最多 2 次，用完后显示 `No resets left`

### 自动重置
扩展会在以下时间自动重置：
- **18:50**（首次）- 需要剩余次数 ≥ 2
- **23:55**（二次）- 需要剩余次数 ≥ 1

**重置逻辑**：
- 重置机会在每日 00:00 过期（不使用即失效）
- 积分余额会结转到次日
- 因此建议在到期前用完所有重置机会

### 查看状态
底部状态栏显示：
- **连接状态**：绿点表示已连接
- **下次重置**：显示时间和类型（1st/2nd）
  - `1st Today 18:50` - 首次重置
  - `2nd Tomorrow 23:55` - 二次重置

## 🛡️ 安全特性

- **API 密钥加密**：使用 AES-256 加密存储
- **PAYGO 双重保护**：多重检查防止误重置按量付费订阅
- **日志脱敏**：自动隐藏敏感信息
- **速率限制**：防止频繁 API 调用

## 🛠️ 技术栈

- **框架**：TypeScript + Chrome Extension Manifest V3
- **构建工具**：Vite
- **核心服务**：
  - APIClient - 88code API 交互
  - ResetService - 重置逻辑和冷却检查
  - Scheduler - 定时任务管理
  - StorageService - 加密存储

## 📁 项目结构

```
88code-smart-reset/
├── src/
│   ├── background/         # Service Worker
│   ├── core/
│   │   ├── services/       # 核心服务（API、重置、调度）
│   │   └── utils/          # 工具函数
│   ├── storage/            # 加密存储服务
│   ├── ui/
│   │   ├── popup/          # 弹窗界面
│   │   └── options/        # 设置页面
│   └── types/              # TypeScript 类型定义
├── dist/                   # 构建输出
└── public/                 # 静态资源
```

## 🔧 开发

```bash
# 安装依赖
npm install

# 开发模式（监听文件变化）
npm run dev

# 构建生产版本
npm run build

# 代码检查
npm run lint

# 类型检查
npm run type-check
```

## 📝 更新日志

### v1.3.0 - 极简重设计
- ✨ 全新极简界面，Apple 风格设计语言
- 🎯 优化信息密度，关键数据一屏呈现
- 🔥 冷却状态直接显示在按钮上，无需点击查看
- 🏷️ 重置时间标注类型（1st/2nd）
- 📊 实时显示剩余重置次数（X/2）
- 🐛 修复 API 数据解析问题（response.data）
- 🐛 修复 GET_STATUS 在剩余次数不足时显示错误时间的问题

### 历史版本
基于 [88code-smart-reset](https://github.com/Rogers-F/88code-smart-reset) 开源项目。

## 📄 License

MIT License - 在遵守许可证的前提下可自由使用和修改。

## 🙏 致谢

- 原项目：[88code-smart-reset](https://github.com/Rogers-F/88code-smart-reset) by [@Rogers-F](https://github.com/Rogers-F)
- 设计灵感：Apple Human Interface Guidelines

---

**Note**: 本项目仅供学习交流使用，请遵守 88code 服务条款。
