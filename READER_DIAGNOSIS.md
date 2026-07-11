# 阅读器诊断结果

## 空白问题根本原因
1. **onShouldStartLoadWithRequest 拦截了 file:// URL**
   - 位置: book-reader.tsx 第 219-221 行
   - 当前只允许: about:blank, data:, about:srcdoc
   - 问题: baseUrl 是 file:// 路径，WebView 加载内联 HTML 时，相对路径资源（图片/CSS）会被拦截导致空白
   - 实际上 WebView source={html} 本身不会被拦截，但某些 EPUB 的 HTML 内容可能包含 file:// 链接

2. **更可能的空白原因：文件路径问题**
   - extractEpubToFileSystem 将文件写入 documentDirectory/books/{bookId}/content/
   - 但读取时 filePath 可能在 app 重启后失效（iOS 沙盒路径变化）
   - 解决方案：动态重建路径，用 bookDir + 相对路径

3. **大文件内存问题**
   - extract.ts 第 249-256 行：readAsStringAsync 读取整个 EPUB 为 base64，然后 atob() 转换
   - 对于 200MB+ 文件，这会占用 600MB+ 内存（base64 膨胀 + 转换缓冲区）
   - 需要使用 expo-file-system 的流式解压或分块处理

## 翻页模式设计
- 当前：WebView scrollEnabled=true，垂直滚动
- 目标：类 iOS Books / 微信读书的左右翻页
- 实现方案：
  1. 每页固定高度 = 屏幕高度
  2. 使用 GestureDetector 检测左右滑动手势
  3. 滑动触发章节切换（前一章/后一章）
  4. 或者：在 WebView 内注入 CSS columns 实现单章内分页（更复杂）
  5. 推荐方案：章节级翻页（左滑=下一章，右滑=上一章）+ 动画过渡

## 文件大小限制
- 当前 maxSize = 200MB（book-import.tsx 第 324 行）
- 但实际上 extractEpubToFileSystem 路径没有检查 maxSize
- maxSize 变量定义了但没有被使用！
- 需要：移除/提高 maxSize 限制，并修复内存加载问题
