# dsh-files 0.6 设计：官方附件闭环（原生形态）

日期：2026-09-05
状态：已实施（0.6.0 + 0.6.1 增量落地）
前置：harness 0.1.3-alpha.1（官方已装版本）

> 实施说明：0.6.0（已于本仓库提交）落地了「模型工具面」——.doc 解析、
> attachment_list / export_attachment 工具、文件夹垃圾过滤。本设计文档的
> 「面板 + 下载路由 + @ 源」部分作为 **0.6.1 增量**实施：
> src/attachment-loop.ts（路由）、src/attachments/fence.ts + ref.ts（纯函数）、
> client 面板与 @ 源、配置三项（attachmentsEnabled / maxDownloadBytes /
> trustedHosts）。附件清单的数据源统一采用 0.6.0 的 `attachments.ts` 只读
> 目录扫描（files/ 布局经官方 attachment-local 源码核实），不再另建事件索引；
> 字节传输走官方 `AttachmentStore.readFileStream`，未直接读文件系统。
> 社区参考（dsh-workspace-files 的下载 fence 经验）只取其「要补什么」，
> 实现路径独立：官方 readFileStream + 会话事件 API 之外零自建。

## 1. 背景与定位

dsh-files 0.5.x 语义：`read_document`（二进制文档读取）+ 文件夹批量上传按钮，均走官方管线。
用户长期诉求：插件名「files」应与「文件管理」对应；调研确认官方 0.1.3 与社区生态的边界：

**官方已有（不重做）**：单文件上传（回形针、后台流式、进度/取消）、附件持久化
（`~/.dsh/attachments/v1`，内容寻址，`AttachmentStore` 公开 seam）、模型侧附件读取
handle（`fileReadPath` / `fileRequestText`）、`read`/`write`/`edit`/`read_image`/`glob`/`grep`、
工作区 `@` 候选（file-reference-local + ui-reference，含目录钻取与 `@"path"` 语法）、
产出文件行（deliverables，host opener 打开）。

**官方没有（本插件要补的三件事）**：
1. 附件库不可见：`AttachmentStore` 只有 save/read，无 list/delete/TTL（官方注释自认
   「a future retention policy collects them」）。上传过的文件在哪、多大、属于哪个会话，
   用户与模型均无入口。
2. 无下载闭环：Web/LAN（dsh-remote-link 场景）用户只能「打开」不能「下载带回本地」；
   官方 deliverables 只有 host opener，浏览器侧没有 blob 下载。
3. 上传附件不在 `@` 候选：官方 fileReferences 只索引工作区，附件库完全不可达。

**形态原则（尊重原创 + 原生）**：
- 全部走官方公开 seam：`ctx.attachments`（readFileStream / fileHostPath）、`ctx.sessions`
  （SessionStore.list + Session.ownEvents）、`ctx.webServer.register`、官方 input-trigger
  registerSource 契约、官方 client slots。不建自有附件库、不写 manifest、不碰会话
  jsonl 内部格式（回扫走 Session 事件 API，官方事件源语义）。
- 参考社区插件（dsh-workspace-files、dsh-file-fix）的是「要补什么」的清单与
  「下载要 fence」的经验，实现路径不同：下载不读文件系统而是走官方
  `readFileStream`，附件清单不扫描存储目录而是走官方 Session 事件 API。
- 零 prompt token：不做模型侧工具、不做 systemPrompt 注入（面板与路由都是 UI 数据，
  模型不感知；附件引用仍由官方 feed 机制写入）。
- 只读优先：不做附件物理删除（内容寻址对象可能被历史消息引用，删除破坏历史完整性；
  官方未来 retention 负责回收）。

## 2. 能力范围

| 能力 | 形态 | 说明 |
|---|---|---|
| 附件索引 | host + JSONL | 增量记录 + 安装时全量回扫（SessionStore 事件），产出 `attachmentId/name/bytes/sessionId/time` 行 |
| 附件清单 API | webServer 路由 | GET（按会话过滤、分页、大小汇总），园区 host 信任与回环 fence |
| 附件下载 | webServer 路由 | `attachments.readFileStream(ref)` 流式写响应，Content-Disposition，上限，同款 fence |
| 附件 `@` 源 | client registerSource | 与官方工作区源共存于官方 @ 菜单（注册第二个 source） |
| 文件坞面板 | client slots | 会话标题栏入口，零 token；列表（名/大小/会话/时间）+ 下载按钮 + 汇总 |

不做：附件删除、自建存储、模型工具、每轮注入、工作区文件树（官方 @ 钻取已覆盖，
如未来要面板化树，另立设计）。

## 3. 官方 seam 依据（已核实源码）

- `@deepseek-ai/dsh-attachment`：`AttachmentStore.readFileStream(ref, signal)` public
  abstract（校验完整性、分块迭代）；`fileHostPath(ref)` 取 host 路径；
  `FileAttachmentRef = { attachmentId: sha256:…, name, bytes }`。
- `@deepseek-ai/dsh-session`：`SessionStore.list()`、`Session.ownEvents()`/
  `snapshotEvents()`、`Session.header`（cwd）；事件数据携带 admitted file parts
  （AdmittedPromptContentPart.file.attachment = FileAttachmentRef）。
- `@deepseek-ai/dsh-host-webserver`：`ctx.webServer.register({kind:'exact'|'prefix', path,
  handler(req,res)})`；重复路径 throw（组合契约，插件路径用独立前缀）。
- `@deepseek-ai/dsh-client-ui-input-trigger`：registerSource 契约（dsh-at-file 同款，
  与官方 ui-reference 多源共存）。
- 官方会话存储布局（观察值）：`~/.dsh/sessions/<cwd-encoded>/<sid>/session.v2.jsonl.zstd`
  （插件不回扫该文件，仅作了解）。

## 4. 组件设计

### 4.1 host：附件索引（lib/attachments/index.ts）

```
AttachmentsIndex
  - scanAll(sessions): 遍历 SessionStore.list()，ownEvents() 中提取 file part 的
    FileAttachmentRef → rows
  - incremental: 监听事件流（新 user/message 提交 + 附件接收）追加 rows
  - persist: 单 JSONL（~/.dsh/dsh-files/attachments.jsonl，人类可读、可备份，
    参照 dsh-snippets 极简数据文件模式）；每次写后原子 replace
  - query(filter): rows 过滤（sessionId / 前缀 / 时间范围 / kind）
```

去重键：attachmentId（sha256 内容寻址天然唯一）；重复 name 不同 id 全部保留。

### 4.2 host：路由（lib/http.ts）

```
GET /plugins/dsh-files/attachments?session=&q=&limit=&offset=
  → { rows: [{attachmentId, name, bytes, sessionId, time}], total, totalBytes }
GET /plugins/dsh-files/attachments/download?ref=<sha256>
  → 200 流式 application/octet-stream + content-disposition（ASCII 净化文件名）
    404 附件对象缺失；413 超过 maxDownloadBytes
```

fence（与部署语义一致）：
- 请求 Host 必须为回环 host 或 `trustedHosts` 配置项显式授权（与官方
  `--trusted-host` / dsh-remote-link 网关同一语义；配置示例见 README）。
- 下载走 `ctx.attachments.readFileStream(ref)`，不绕 fs、不读绝对路径，天然限制在
  附件域内部；ref 必须匹配 `sha256:[0-9a-f]{64}`，拒绝任意路径输入。
- 隐私：响应体与日志不落会话内容，仅文件名与 id。

### 4.3 client：面板 + @ 源（src/client/）

- 入口：会话标题栏（或 converse.input.left 旁）小按钮，抽屉浮动面板，CSS 与官方
  组件库保持一致（0.5.1 已证明 injectCss + slots 路径）。
- 面板内容：会话筛选下拉、文件名搜索（client 端过滤）、行（图标/名/大小/会话/时间）、
  下载按钮（`<a href=...download>` 触发路由）；仅显示「附件 N 个 / 共 X MB」汇总。
- `@` 源：registerSource（name: 'dsh-files-attachments'；candidates 返回附件名与
  attachmentId 语法 `@att:sha256…`，onPick 插入官方 @ mention 形式？——插入形式见 5）。
- 零 token：不注入 systemPrompt、不注册工具、不碰 conversation.createDrafts。

### 4.4 config

```yaml
[id: files-toolkit, name: 'dsh-files']
config:
  maxFileBytes: 25165824      # 已有
  readLimit: 2000             # 已有
  sheetRowLimit: 200          # 已有
  maxSheets: 5                # 已有
  maxOutputChars: 24000       # 已有
  readTimeoutMs: 120000       # 已有
  maxDownloadBytes: 209715200 # 新增：单文件下载上限
  trustedHosts: []            # 新增：非回环授权 host[:port]（远程/LAN 部署必填）
  attachmentsEnabled: true    # 新增：关闭则整个附件闭环不注册（含路由与索引）
```

## 5. @ 附件引用的模型侧语义（关键设计点）

官方 @ mention 是「路径候选」契约（file/directory），模型端拿到 `@path` 文本后用
read 工具按工作区 cwd 解析。附件不在工作区，直接 `@att:…` 会让 read 语义错乱。
两个候选：

- **5a（推荐）**：附件候选插入形式 = 附件在本会话上传时模型已见过的官方 handle 文本
  （`fileRequestText(ref)` 的确定性输出，即 README 说的「文件名、大小、摘要、只读
  路径」行）。client 把 `@att:sha…` 视作「引用原始 handle」；@ 菜单选中后插入
  handle 纯文本（不是路径 token），模型照常 read。技术风险：handle 文本格式在
  host 升级间可能变化（0.1.3 内稳定）。
- **5b**：附件先「置入手工作区」——面板提供「导出到会话工作区」按钮（host 路由：
  readFileStream → fs 写入会话 cwd 下 `attachments/`），导出后就是普通工作区文件，
  @ 候选天然覆盖。这是慢路径/兜底。
- 5a 为主、5b 为兜底按钮，不做第三种。

## 6. 安全与边界

- 只读 + 下载：无任何删除/写路由；索引 JSONL 是唯一写点且为追加语义。
- 下载上限 + fence + ref 白名单正则，三重门禁；超限 413，越权 403。
- 无密钥进出：索引只存元数据（name/bytes/time/sessionId），不含文件内容。
- 面板数据不进模型上下文（UI 层数据），无 token 泄漏面。
- 附件对象存在的校验：下载前 `fileHostPath` 判存在 + `readFileStream` 完整性校验
  （官方自带），损坏对象报 409 而非 500 噪音。

## 7. 分期

| 期 | 内容 | 验收 |
|---|---|---|
| P0 | 索引（增量+回扫）+ 清单路由 + 下载路由 + 最小 client 面板（列表+下载） | 上传 2 文件 → 面板出现 → 下载得原字节；重启服务索引仍读 JSONL；fence 未授权 Host 403 |
| P1 | @ 附件源（5a）+ 面板搜索/筛选/汇总 + 导出到工作区（5b 按钮） | @ 菜单同时列工作区与附件；选中插入 handle；导出后 read 可读 |
| P2（可选） | 面板版本/统计增强（按会话占用 TOP、孤儿附件只读报告） | 只读报告可导出 JSON |

P0 与 P1 每项配 node:test 单测（纯函数：索引解析、fence、ref 校验、Content-Disposition
净化、下载流错误映射），回归测试沿用 0.5.1 的 test/ 结构。

## 8. 测试与发布

- `pnpm test`（现有 84+ 项 + 新增）；`tsc --noEmit`；build client bundle 保持 minify。
- README.zh / README / CHANGELOG 三处同步；发布版本 0.6.0。
- profile 侧：`dsh plugin update` 走 git 通道（与 0.5.x 相同 install.sh）。
- 发布说明四要素：相对 0.5.1 改进（附件可见/可下载/可 @）、新增能力
  （面板/清单/下载/@ 源）、默认关闭功能的打开方式（attachmentsEnabled 默认 true；
  trustedHosts 远程必配）、相关依赖（无新增 npm 依赖，全官方 seam）。

## 9. 决策点（待确认）

1. @ 插入形式：5a（handle 文本）还是先做 5b（导出后正常 @）？倾向 5a+5b 并存。
2. 面板入口位置：会话标题栏按钮（dsh-prompt-dock 同区域）vs 输入框左（0.5.1 旁）。
3. P2 不做删除是否可接受（建议接受，官方 retention 未来接管）。
