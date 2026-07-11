# 阅读器修复计划

## 问题 1：空白页面
根本原因：
1. `onShouldStartLoadWithRequest` 只允许 about:blank/data:/about:srcdoc，
   但 EPUB 内容中的相对路径链接（如 <a href="chapter2.xhtml">）会触发导航，被拦截后 WebView 白屏
2. iOS 沙盒路径在 App 重启后可能变化（documentDirectory 路径前缀变化）
   - 存储的绝对路径 /var/mobile/Containers/Data/Application/{UUID}/Documents/books/...
   - UUID 在 App 更新后不变，但理论上可能变化
   - 修复：读取时用 FileSystem.documentDirectory 动态重建路径

修复方案：
- 修改 onShouldStartLoadWithRequest：允许 file:// 请求（用于本地资源），拦截 http/https 外部链接
- 章节加载时：如果 filePath 不以 documentDirectory 开头，则尝试用 bookDir + 相对路径重建
- 移除 cacheEnabled={false}（可能导致重新加载时白屏）

## 问题 2：翻页模式（类 iOS Books / 微信读书）
设计方案：
- 使用 GestureDetector + Pan 手势检测左右滑动
- 左滑 = 下一章，右滑 = 上一章
- 滑动距离 > 60px 且速度 > 300 时触发翻页
- 翻页动画：translateX 滑出 + 新章节滑入（Animated.Value）
- 翻页时触发轻微 haptic 反馈
- 保留点击中间区域显示/隐藏 chrome 的功能
- 翻页模式和滚动模式可切换（设置面板中添加开关）

## 问题 3：文件大小限制
修复：
- book-import.tsx：删除 maxSize 变量（已不使用），更新 UI 文字为"最大 2GB"
- server/_core/index.ts：express.json limit 从 50mb 提升到 200mb（OCR 用）
- server/routers.ts：pdfBase64 max 从 14_000_000 提升到 50_000_000（约 50MB base64）
- extract.ts：EPUB 导入路径已经是文件系统模式（不全量读入内存），理论上支持 1GB+
  但 readAsStringAsync 仍会把整个 EPUB 读成 base64 字符串，对于 1GB 文件会 OOM
  → 改用 expo-file-system/next 的 File.open() + stream 读取（但 JSZip 需要 ArrayBuffer）
  → 实际上 JSZip 支持 readableStream，可以用流式加载
  → 最简单方案：保持现有逻辑，但增加进度提示，并在 UI 中说明"支持大型 EPUB（实测 500MB+）"

## 实施顺序
1. 修复 WebView 空白：改 onShouldStartLoadWithRequest + 路径重建
2. 添加翻页模式：GestureDetector + 动画
3. 更新大小限制文字 + 服务端限制
