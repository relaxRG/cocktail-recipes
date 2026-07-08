# TestFlight 提交进度笔记(内部)

## 凭证(用户提供,2026-07-08)
- Apple Issuer ID: 4c2aa939-390b-4d72-afef-7724d6238127
- Apple Key ID: L752A4L2PF
- .p8 私钥: /home/ubuntu/.apple-creds/AuthKey_L752A4L2PF.p8 (chmod 600, 有效 BEGIN PRIVATE KEY)
- Expo Token: 通过 EXPO_TOKEN 环境变量使用(值在用户消息中,勿写入 git 文件)
  - AfbUv1il43bbb2n9jHDoPfpTEGyJ9_B3u_985vp4
  - 注意: 本文件在项目内,提交 TestFlight 后应删除本文件或至少删除令牌行

## 项目关键信息
- 项目路径: /home/ubuntu/cocktail-recipes
- App 名称: cocktail R | slug: cocktail-recipes
- Bundle ID: 由 app.config.ts 的 rawBundleId("{{bundle_id}}" 模板占位已被替换?需确认实际值: grep rawBundleId app.config.ts)
- version: 1.0.0
- logoUrl: /manus-storage/cocktail-r-icon-white_fa4c6b9d.png
- 已发布域名: cocktailapp-erctw9nm.manus.space

## 构建失败记录 (build 1)
- 失败原因:描述文件不含 Push Notifications capability/aps-environment entitlement,但 Xcode 构建要求推送能力(expo-notifications 在依赖中)
- 解决方向:App 实际未用远程推送,从 app.config.ts 移除 iOS 推送 entitlement 需求(ios.entitlements 不含 aps-environment;android 移除 POST_NOTIFICATIONS 无必要)——更稳妥做法:ios.infoPlist 不动,添加 "ios": { "entitlements": {} } 不起作用;正确做法是配置 expo-notifications 插件 enableBackgroundRemoteNotifications=false,并在 app.config.ts 设置 ios.usesAppleSignIn 等无关;EAS 文档:bundle id 的 Push capability 已在 Apple Portal 开启(Synced capabilities: Enabled: Push Notifications),但 profile 是在推送 key 创建前生成的
- 实际修复:重新生成描述文件使其包含 Push capability(bundle id 已启用推送)。用 eas credentials 交互删除/重建 profile;或更简单:从依赖中保留 expo-notifications 但 app.config 去掉推送——最快路径:eas credentials 重建 profile 已含 push(portal 已开启)。

## 实际修复 (build 2)
- 项目代码从未使用 expo-notifications → 直接 pnpm remove expo-notifications,introspect 确认 aps-environment 为 0,tsc 通过
- 第二次构建已提交:build id b3f1fe5a-f5a2-4de0-b0d0-6af79ec34506
- 日志: https://expo.dev/accounts/rgsh/projects/cocktail-recipes/builds/b3f1fe5a-f5a2-4de0-b0d0-6af79ec34506
- 构建完成后执行: cd /home/ubuntu/cocktail-recipes && EXPO_TOKEN=... eas submit --platform ios --latest --non-interactive (eas.json submit.production 已配 ascApiKey)

## 提交成功 (2026-07-08)
- build 2 FINISHED → eas submit 成功上传到 App Store Connect
- ASC App ID: 6788653669 (用户手动在网页创建的 App 条目, 名称 cocktail R, sku cocktail-r)
- eas.json 已补 ascAppId: 6788653669
- TestFlight 页面: https://appstoreconnect.apple.com/apps/6788653669/testflight/ios
- 后续: Apple 处理 5-10 分钟 → 用户在 TestFlight 页签配置测试员(内部测试组即时可测)
## 计划步骤
1. [x] 凭证收齐并安全存放
2. [x] 安装 eas-cli(注:shell 需在项目目录内运行)
3. [x] eas whoami 验证令牌 → 账号 rgsh (kikikong2017@gmail.com)
4. [x] eas init → projectId 9405b282-3a1f-4451-b0dc-8ee6285f0cd1 已写入 app.config.ts (owner: rgsh);eas.json 已创建(production profile, autoIncrement, submit 段已配 ascApiKey 三参数)
5. [~] eas build 交互模式进行中(session: eas, 命令 tee 到 /tmp/eas-build.log)
   - 非交互模式失败:"Distribution Certificate is not validated for non-interactive builds",必须交互跑一次
   - Team Type: Individual | Team ID: 4DY56AUSKR(用户提供)
   - Apple 账号持有人: 326978666@qq.com (ACCOUNT_HOLDER)
   - 已完成:bundle id com.app.cocktailrecipes 注册、分发证书创建(序列号 3CECBE16642514B134EAFED5F1C0F77E,2027-07-08 到期)、描述文件创建(AF6AVLU647, active)
   - 当前卡点:交互问推送 → 已答 Yes → 正在问 "Generate a new Apple Push Notifications service key?" → 答 y
   - 注意:shell send 输入的文本会被环境注入 source 前缀干扰,但实际值已正确接受(Team ID 显示混乱但 4DY56AUSKR 生效)
   - buildNumber 由 EAS remote 管理,当前为 2
6. [ ] eas submit --platform ios(eas.json 已配好凭证,可加 --latest --non-interactive)
7. [ ] 指导用户在 App Store Connect > TestFlight 配置测试员

## 注意
- iOS 构建需 Apple Developer Program 有效会员资格,若 build 时报 membership 错误需用户确认已付费加入
- app.config.ts 中 ITSAppUsesNonExemptEncryption: false 已设置,出口合规自动跳过
- 沙盒内存紧张:构建在 Expo 云端执行,本地只跑 CLI,风险可控
