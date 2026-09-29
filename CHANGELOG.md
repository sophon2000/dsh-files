# Changelog

## 0.5.3-vh.1

Video Harness qualification release on DSH `0.2.0-rc.1.vh.1`, based on upstream `0.5.3`.

- Absorbs upstream legacy `.doc` extraction, UTF-16 detection fixes and related parser tests.
- Retains the fork Worker isolation, concurrency gate, ZIP preflight and resource limits.
- Removes the upstream attachment list/export tools, routes, folder uploader, dock and `@` source from source and packed output. DSH 0.2 and Video Harness Catalog own those surfaces.
- Ships a no-op client with no injected services or UI dependencies.
- Pins DSH runtime peers to `0.2.0-rc.1.vh.1`.

## 0.5.3 (upstream)

### 「上传文件夹」双入口：工具行按钮回归 + 官方 + 菜单（用户面）

上一版里文件夹上传是输入行里的一颗插件按钮，实际渲染在官方权限下拉之后——与回形针隔着权限控件，看起来像颗「多出来的按钮」。官方 0.1.5 的输入行并没有「紧贴回形针」的合法扩展位置，但它为插件留了更正统的入口：**+ 号命令菜单的贡献契约**（与内置 /feedback 同一 ActionSpec 形态）。本版先做了「仅 + 菜单」，真机实测后发现**中文命令名排序垫底（35 行里排第 32）且菜单一屏只显 8 行，等于不可发现**——据当日使用反馈改为双入口：

- **工具行按钮回归，且紧贴回形针**：`conversation.input.left` 槽位里 28px 官方同款圆形按钮。官方槽位本渲染在权限控件之后，这里用一条**结构特征 CSS 规则**（`:has()` 识别「直接拥有 file input 且包含本按钮」的工具行，flex `order` 把权限/plan 控件押后）把按钮提到回形针右侧——不绑定宿主样式哈希，宿主改版致选择器失配时自动退回默认槽位，功能无损。
- **+ 菜单入口保留**：点输入框左下角的 **+**，「上传文件夹」以官方样式出现在命令列表（排序在 ASCII 命令之后，往下翻可见）；两条入口汇入同一条上传流——浏览器递归展平 + 逐文件进官方附件管线（过滤 Office 锁文件、`.DS_Store`、`.env` 等系统/隐藏文件），进度、取消、模型侧 handle 全部照旧归官方管。
- **拖文件夹上传不变**：只有拖入**目录**时才接管（普通文件拖拽完全走官方管线），反馈从「只有悬停才能看到的 tooltip」升级为官方 Toast 横幅（「已添加 N 个文件，跳过 M 个系统/隐藏文件」）。
- `commandUi` 服务缺席的旧宿主上菜单入口自动降级并在控制台给出可诊断警告；工具行按钮不受影响。

### 附件库：重新插入到任意会话（用户面）

- **每行新增「重新插入」动作**（回形针图标）：把库内字节取回浏览器、经官方草稿管线挂到当前输入区——出现正式附件卡片、随消息发送、模型拿到新 handle。老会话上传的文件可以直接 ride 到**新会话**：建好会话后打开附件库点一下即可，不用回磁盘找文件。超过下载上限（默认 200 MiB）时提示改用「导出」。
- 内容寻址存储的去重特性让重复插入零存储成本（同字节落在同一对象）；浏览器↔宿主之间的字节走回环，本地部署几乎无感，LAN 部署注意大文件的两跳传输。
- `@` 附件源在 llm 服务缺席导致候选不可用时，控制台留下可诊断日志（区分「没附件」与「服务没接上」）。

### 附件库面板：常驻卡片收敛为一枚官方胶囊（用户面）

- **收起态 = 一枚官方 `Pill` 胶囊**（与该坞位官方自身的会话统计胶囊同款组件与视觉语言）：「附件库 N 个 · X MB」不再常驻占一整行；点开才展开卡片。
- **搜索不再打服务端往返**：面板本来就持有全量清单，过去每个按键都回服务端把同一份数据要回来再过滤一遍；现在纯客户端过滤，输入即时出结果。收起再展开 30 秒内直接复用内存清单，超窗才重拉。
- **列表上限 100 行**（超出显式标注「已显示最近 100 条，共 N 条」），不再一次渲染全部 300 条。
- **官方图标替换字符**：折叠箭头、刷新、下载、导出全部换官方图标组件；时间改短格式（今年 `MM-DD HH:mm`、往年 `YYYY-MM-DD`）。

### 显示一致性（用户面 + 模型面）

- **字节/时间格式收敛为单一真源**（`src/format.ts`）：此前同一文件面板报「3.00 GB」而 `attachment_list` 报「3072.0 MB」，模型与用户各看一套数字；现在工具、路由、面板共用一份实现，≥1 GiB 一律以 GB 两位小数显示。`attachment_list` 的时间从 UTC 改为本地时区（与面板一致）。
- **`@` 附件候选补官方 file 图标**。

### 服务端（正确性 / 资源）

- **导出到工作区改回流式写**：官方 seam 本身是流式的，上一版却全量缓冲再拼接——接近 200 MiB 上限的附件要吃双倍堆；现在逐块落盘，失败清掉半个文件。
- **查询串解析换标准 `URLSearchParams`**（16 行手写换 3 行，`?q=a+b` 语义对齐标准）；导出路由 400 响应不再泄漏内部 debug 字段。

### 测试与工程

- **类型检查进门禁**：`npm test` 现在先跑双 tsconfig 全量 `tsc`（服务端 + 此前被排除在外的客户端）再跑单测，修复 6 处旧类型错误；新增 format / rows 纯函数测试，91 项全绿。
- 依赖零新增；构建产物 13.4 KB（上一版 14.3 KB）。

## 0.5.2

> 0.6.0（文件域补全）与 0.6.1（附件闭环）从未对外发布，其内容全部包含在本版；版本号按维护者口径回归 0.5.x 系列，下方两条历史记录保留原样备查。

### 附件库改挂官方 composer 坞位：入口归位，去掉手动摆位（用户面）

0.6.1 的附件库入口在会话标题栏；本版一度把它塞进输入框工具行、与「上传文件夹」按钮并排。这个位置**语义不对**——工具行是官方为「操作当前这条消息的紧凑控件」准备的（官方回形针就在其中），而附件库浏览的是**历史存量**，与当前草稿无关。本版把它移到官方为这类内容预留的槽位：

- **入口移到 `conversation.composer.dock`**：官方对该槽位的定义是「输入卡下方的环境性条目」（*ambient entries below the composer card*），官方自身在这里放的是会话统计 `StatsPills`——同为附加信息面板。上传文件夹按钮留在 `conversation.input.left`（它与官方回形针同类，是草稿操作）。
- **面板回到正常文档流**：因槽位语义不再错配，面板不必再脱离文档流摆位——去掉了 `position:fixed` / `bottom:96px` / `right:16px` / `z-index:9998` 四个硬编码。面板宽度改由官方 `--dsh-composer-*` 变量决定，跟随输入卡列宽与居中；**输入卡多行变高、窗口拉宽、附件 rail 出现这三种情形都不再错位**（原写法在这三种情形下必然错位）。
- **形态改为输入卡下方的常驻折叠卡片**：标题行常驻并显示「N 个 · X MB」汇总（环境性信息本身即有价值），展开后是搜索框与列表——对齐官方该槽位的既有形态（`border-radius:12px`、`.5px` 描边、贴着输入卡下沿）。
- **删掉 33 行 DOM 探针**：原 `installInputOrderProbe` 靠运行时探测宿主 css-modules 哈希、动态注入 flex order 规则，只为了「挤进工具行并与官方按钮争排序」。换到独立槽位后排序不再需要与官方按钮竞争，这段探测及其 MutationObserver 整体删除。
- **样式对齐官方**：上传按钮沿用官方 InputBar `.add` 同款设计变量（`--dsw-specific-selector` 底、`--dsw-alias-label-primary` 前景、hover/disabled 同语义），深浅色模式自动跟随。

## 0.6.1（未发布，并入 0.5.2）

### 附件闭环：附件库可见、可下载、可引用（用户面）

0.6.0 补了模型侧的窗口（attachment_list/export_attachment），本版补用户侧与取回闭环——官方附件库只进不出的三个缺口各补一块，全部走官方 seam，零新依赖：

- **附件坞面板**：会话标题栏「附件库」按钮（与 prompt-dock 同区），抽屉列出全部附件（原名/大小/时间/sha256 前缀）、文件名搜索、占用汇总（N 个 · X MB）；**下载**走浏览器（`Content-Disposition` 附件下载 + RFC 5987 `filename*` UTF-8 文件名，远程/LAN 部署把文件拉回本机的正路），**导出到工作区**自动命名防覆盖（保留中文名）。纯 UI 数据，不注入 systemPrompt、不注册模型工具，零 prompt token。
- **`@` 附件源**：`@` 菜单新增「附件」组（与官方工作区候选共存，`registerSource` 契约），候选仅含 host 能给出官方 handle 文本的条目；选中插入的正是模型上传时看到的那行 handle（LLM seam `fileRequestText` 公开 API），模型直接 read 即可。handle seam 缺失（无 llm 服务）时该源自动降级为空。
- **下载/导出路由**（`/plugins/dsh-files/attachments*`）：字节全部走官方 `AttachmentStore.readFileStream`（完整性校验、无绝对路径暴露），双层栅栏——Host 信任（回环或 `trustedHosts`，与官方 `--trusted-host` 同语义）+ `sha256:` 引用白名单；`maxDownloadBytes` 超限 413；缺失对象 404、完整性失败 409。无任何删除路由。
- **配置**：`attachmentsEnabled`（总开关，默认 true）、`maxDownloadBytes`（默认 200 MiB）、`trustedHosts`（默认 []，LAN/域名部署必配）。
- 面板与路由所需服务（webServer/attachments/sessions/llm）通过 cordis `ctx.inject` 延迟注册：这些服务在本插件 apply 之后才激活，apply 时 `ctx.get` 取不到 webServer（实测复现并修复）；inject 等全部就绪后回调注册，headless 或无附件服务时回调不触发，路由不注册，read_document 与附件工具不受影响。

### 测试与工程

- 新增 20 项单测：fence（回环/trustedHosts/精确端口/DNS-rebinding 形状）、ref 归一化（sha256: 前缀、坏输入）、下载名净化（CRLF/引号/反斜杠/非 ASCII/超长）、路径名净化（Unicode 保留/分隔符/前导点）、handle 文本（无 seam/抛错降级）、分页与汇总。全量 84 测试通过。
- 本机实测通过：list（真实 13 附件 + 官方法 handle）、download（字节与源一致 + filename*）、export（中文名保留、字节一致）、fence（恶意 Host 403、坏 ref 400）、面板（标题栏入口/汇总/搜索/下载/导出）、`@` 源（分组出现、13 候选、选中插入官方 handle 行）。
- build 全链路验证：tsc -p tsconfig.build.json 零错，client bundle 13.5KB（minified）。

## 0.6.0（未发布，并入 0.5.2）

### 文件域补全：.doc 解析、附件库窗口、文件夹垃圾过滤

量化驱动（230 会话、14 个真实附件、12 次 read_document 调用的本机数据）：附件库 29% 是老式 .doc 而 read_document 读不了、7% 混入 Office 锁文件、模型对附件库零可见且搬不动任何一个文件。本版把「进 / 读 / 管」三段生命周期的官方空白各补一块：

- **`.doc`（Word 97-2003）解析**：内容嗅探新增 OLE Compound File 魔数路由；macOS 走系统 `textutil`（金标对照中正文与日期段最完整），其他平台与 textutil 失败时回退纯 JS `word-extractor`。老式 `.xls`/`.ppt` 同为 OLE 容器，解析失败时错误消息给出可自纠提示。
- **`attachment_list` 工具**：附件库对模型可见——原名、sha256 前缀、大小、修改时间，按时间降序；宿主进程只读扫描，路径全部内部拼接。
- **`export_attachment` 工具**：按 sha 前缀（8+ 位 hex）或精确原名把附件拷贝进工作区，模型即可用官方 read/edit/bash 再加工；dest 经 `ctx.fs.resolve` 沙箱校验，`COPYFILE_EXCL` 防覆盖，前后发出 fs 观察事件，与内置工具同一观察惯例。
- **文件夹垃圾过滤**：Office/WPS 锁文件、点开头隐藏文件（隐私边界：`.env`）、`Thumbs.db`/`desktop.ini` 等在 picker 与拖拽两条路径进入官方管线前跳过，跳过数量对用户明示。

配置新增 `attachmentsDir`（默认按 `DSH_HOME` / `~/.dsh/attachments/v1` 自动探测）；systemPrompt 同步引导附件工作流。40 → 64 测试。

## 0.5.1

### 新形态：原生管线上只加一个文件夹按钮

按用户拍板的方向重构：**用原生的显示，再叠加独有能力**。宿主 0.1.3 的回形针/拖拽/@ 引用/预览区全部保留为唯一入口与显示层，dsh-files 只做两件原生没有的事：

- **文件夹按钮**：注入 `conversation.input.left`（官方回形针旁边）。点选目录后浏览器递归展平（`webkitRelativePath` 保留层级），逐文件进入官方附件管线——`conversation.createDrafts()` 铸造草稿（图片走视觉管线、其他文件自动启动官方后台上传）+ `inputActions.addAttachments()` 挂载。**显示、字节进度、取消/重试、会话切换续显、模型 handle 行全部由官方持有**，本插件不渲染任何卡片、不注册任何上传路由。
- **read_document 工具**：继承 0.5.0 的单一职责服务端（PDF/DOCX/XLSX/文本解析，内容嗅探、编码链、分页、sheet 级访问）。

client bundle 从 0.4.3 的 ~60KB 缩到 **5.9KB**（一个按钮 + 一次官方 API 调用，minified）；配置 6 项；前置 harness ≥ 0.1.3-alpha.1。

### 修复

- **拖拽文件夹悬停后移出，遮罩不消失**：`dragover` 悬停期间高频重复触发，每次都累加计数，而 `dragleave` 只减一，depth 虚高后归不了零，全屏遮罩残留到下一次 drop。改为仅首次进入（遮罩未亮）时计数，与离开对称。
- **拖拽多个文件只进第一个**：`collectFiles` 在异步展开阶段才调用 `webkitGetAsEntry()`/`getAsFile()`，Chrome drop 保护模式下返回 null，第二个起的文件/目录被静默丢弃。现改为 drop 事件栈内一次性快照全部 item 引用（entry 或 File），之后再异步展开；单目录递归不受影响。
- **无 BOM UTF-16 嗅探与解码阈值不一致**：单侧零字节占比落在 0.25–0.5 区间的混排文本，auto 模式被拒、显式 `format=text` 能读。长样本（≥8 码元对）嗅探阈值统一为 0.25 与解码链对齐；短样本统计无意义，须过半才认。
- **`readTimeoutMs` 未纳入配置校验**：其余 5 项均有正整数门禁，该项配 0/负数会直接进 `timeoutMs`。
- 注释漂移修正：client 头注释版本号（0.6.0→0.5.1）、`formatOutputBudget` 头注释 xlsx 档位（实际为 3/4）、`cordis.patch.yml` 头注释 id 与 name 的语义。
- 模型侧提示统一中文：windowLines 的截断/翻页标记此前为英文，与 pdf/xlsx 提示混用。
- client bundle 构建开启 minify（9.9KB → 5.9KB），体积口径与产物一致。

## 0.5.0

### 破坏性变更：移除上传与图片管线，聚焦 read_document

宿主 0.1.3-alpha.1 起原生提供通用文件上传（任意类型、文件与图片同预览区混排、后台进度/取消/会话切换续显、按保存路径用文件工具读取）、`@file`/`@session` 统一引用与目录钻取。0.5.0 消融实测（插件整体停用、服务稳定、跨插件零依赖）后按「删除无法证明必要性的复杂性」原则收缩为单一职责插件：

- **移除**：回形针/文件夹/拖拽上传、`@` 双源候选、彩色文件卡片、图片附件管线（官方原生版更强：EXIF 剥离、色彩归一、request version 缓存）、TTL 清扫/会话配额/sha256 去重/安全护栏（随上传半）、esbuild client bundle（client 半归零——历史缺陷全部集中在 client 半与生命周期，宿主升级适配税随之归零）。
- **移除**：LRU 解析缓存（消融实测 1.1 MB PDF 解析 180-235 ms，相对模型延迟是噪音，缓存无法证明必要性；`cacheEntries`/`cacheMaxBytes` 配置项随之删除）。
- **保留**：`read_document` 工具全部分页/编码链/XLSX sheet 级/内容嗅探/协作取消能力；宿主内置 read 对二进制报 `FS_NOT_TEXT`，结构化文档解析仍是 0.1.3 的空白。
- **安装要求**：harness ≥ 0.1.3-alpha.1（原生上传接管旧上传功能的前置）。
- 配置面从 17 项收敛到 6 项（`maxFileBytes`/`readLimit`/`sheetRowLimit`/`maxSheets`/`maxOutputChars`/`readTimeoutMs`）。

## 0.4.3

### 修复（client）

- **多文件引用只落第一个（#12）**：插入 span 此前用剪贴板文本长度当坐标，而宿主把 span 应用在 detect 投影上——草稿里每多一个 chip 两个坐标系就分叉一截，第二个起全部静默 no-op（多选/文件夹/拖拽批量与同草稿逐个添加都命中，确定性复现）。现改用 `caretSpan()` 的 detect 坐标（老宿主无此方法时回退旧逻辑），插入经单链串行化、8 次重试、每帧以 `occurrences` 计数增量确认；重试耗尽打 `console.warn` 可观测（PR #13）。
- **移除一张卡片会压平其余 chip**：`setDraft` 按纯文本重建文档，幸存引用全变裸路径。现在移除后逐个把幸存 ref 的路径文本用 span 替换回 chip（压平态 clipboard 与 detect 坐标一致；detect 偏移按已替换累计长度修正），替换被拒时留纯路径不丢内容。
- **会话切换后卡片信息退化**：`uploadMeta` 随草稿剪枝，切回会话后卡片名/徽标/大小退化为从存储路径反推的猜测。回退 `uploadedPool`（按插入序淘汰、不随会话剪枝）。
- **移除卡片残留双空格**：chip 自带分隔尾空格，删除点两侧都是空格时吃掉一个；行首/行尾不动。
- **文件选择器取消后隐藏 input 残留 DOM**：`change` 不触发时无清理，多次取消持续堆积。合并文件/文件夹两条 picker 路径，监听 `cancel` 事件并在重开前移除上一个。
- **同 ref 已有 chip 时插入误报成功**：成功判定从「已存在」改为 `occurrences` 计数增量。
- **文本族徽标一律 TXT**：`.md`/`.html`/`.csv` 等按真实扩展名显示（1-4 位纯字母），无短扩展名才回退 TXT。
- **换会话后移除卡片 403**：DELETE 带上传时记录的归属会话头（`x-session-id`），文件真正删除而非滞留等 TTL。

### 修复（server）

- **超长伪扩展名绕过 120 字节截断**：扩展名只认最后一点后 1-8 位 ASCII 字母数字，否则不按扩展名保留——`extBytes` 可被撑爆 120 字节预算导致 ENAMETOOLONG 回归；裸扩展名输入（`.pdf`）保持无损。
- **DELETE 路径二次解码挂起连接**：`searchParams.get` 已做一次百分号解码，文件名含 `%`（如 `50%off.pdf`）时再 `decodeURIComponent` 会抛未捕获 URIError，keep-alive 连接就此挂起。
- **UTF-16 BOM 后奇数字节抛 TypeError**：`decodeText` 契约是「解不出返回 null」，奇数截尾改为返回 null。
- **`sweepIntervalMs=0` 恢复为合法配置**：文档承诺 0 = 禁用周期清扫，但校验进了正整数断言变成启动即抛错的死路径；改为非负整数校验。
- **解析缓存键改用 fs version token**：键 = targetKey + `FsVersion`（dsh-fs 写守卫押注的同一 freshness token）替代全内容 sha256——翻页读大文档的命中路径不再付 24 MiB ≈ 40ms 的哈希账；失效强度对照 fs 层编辑守卫核实（mtime 纳秒 + ctime 内核维护，`cp -p`/`touch -r` 伪造攻不进来）。

### 测试

- 新增客户端与回归测试，全量 108 通过，tsc 零错。

## 0.4.2

### 修复

- **TTL 清扫扫不到真实上传文件**：有 sessions 服务时上传文件落在 `<会话工作区>/.dsh-filess/`，而清扫器只挂在 `uploadDir`（无服务时的兜底布局）——正常部署下 TTL 回收从未生效。现在清扫根 = `uploadDir` ∪ live 会话 cwd（`sessions.list()`）∪ 上传时记录的会话 cwd 注册表（兜住上传后已关闭的会话），每次 tick 动态求值。
- **清扫不递归子目录**：文件夹上传产生的嵌套文件此前永不回收、空目录永不 reap。清扫改为后序递归：过期文件删除后自底向上 reap 清空的目录；符号链接整体跳过，清扫绝不越出上传根。
- **会话配额漏算子目录**：`maxUploadBytesPerSession` 此前只统计平铺文件，文件夹上传可绕过配额。统计改为递归整棵树。
- **上传卡片移除在路径含空格时残留**：occurrence 只给 offset 不给长度，原实现盲扫到空白会把含空格路径切一半。新增 `removeTokenFromDraft`（`src/client/draft.ts`）：优先按 ref 全文精确匹配删除，对不上再回退空白扫描。
- **`@` 候选池无上限增长**：加 200 条上限，超限按插入序淘汰最旧条目（不影响草稿里已插入的引用与卡片显示）。

### 测试

- 新增 10 个回归测试：递归清扫（嵌套回收/空目录 reap/新鲜文件保留）、符号链接跳过、多根 sweeper（roots 函数逐 tick 求值）、嵌套配额（超限 507 + 阈值内 200）、draft token 移除 6 例。全量 97 测试通过，tsc 零错。

## 0.4.1

### 新增

- **脚本安装**：仓库根新增 `install.sh`——检查 `dsh` / `pnpm` 环境后通过 git 通道执行 `dsh plugin add git+https://github.com/taxueseek/dsh-files.git`，支持 `--profile` 参数（默认 `web`）。`curl -fsSL https://raw.githubusercontent.com/taxueseek/dsh-files/main/install.sh | sh` 一行完成安装，Windows 在 Git Bash 中运行。

### 修复

- **README 中英版安装指引改为 git 通道**：原指引 `dsh plugin add dsh-files` 走 npm 通道，而 npm 上名为 `dsh-files` 的包（0.0.1，dushaobindoudou 于 2026-08-19 占位，"name reserved"，无任何 `dsh` 字段）是无关第三方包——照旧指引安装会把这个占位包装进 profile。现改为脚本安装 + 手动 git 命令，并加显式警告；双语一致性哈希已同步。

## 0.4.0

### 新增

- **图片原生支持**：上传的 JPEG / PNG / WebP / GIF 不再落成本地路径让 `read_document` 读不了，而是走 harness 核心附件管线（`createDraftImages` → `addImages` → 发送时转 base64 `image_url`）。因为线格式是供应商中立的 base64，任何声明 `inputModalities: [text, image]` 的模型（DeepSeek 视觉版、Dots3、龙猫、OpenRouter 视觉模型等）都能直接看图；UI 由官方 `conversation.input.attachments` rail 渲染（缩略图、点开大图、原生移除），呈现为原生图片而非灰色 badge 卡片。
- **`@` 双源候选**：输入 `@` 同时列出本会话已上传文件（绝对路径）与会话工作区文件（相对路径，agent 按其 cwd 解析），无需重新上传即可引用已有工作区文件。
- **工作区索引端点**：`GET /api/workspace-files?session=<id>` 只读返回会话 cwd 下的相对路径列表；BFS 遍历带忽略目录/文件/扩展名过滤、深度（默认 12）与数量（默认 500）上限、跳过符号链接（防环与索引逃逸），与上传端点同款网络护栏。

### 修复

- **解析缓存 in-flight 去重**：`getOrCompute` 让并发同 key 的调用共享一次解析 promise，多个 agent 同时分页同一大 PDF 时只解析一次，不再重复解析。
- **`read_document` output schema 补 `sheet` 字段**：XLSX sheet 读取返回的合法输出此前会被 `additionalProperties:false` 打成 `INVALID_TOOL_OUTPUT`，现 schema 声明该字段。
- **文件夹上传保留子目录层级**：`x-file-relative-path` 的目录前缀在会话上传目录内重建（如 `sub/dir/file.pdf`），相对路径净化（拒绝 `../` 与绝对路径），sha256 去重竞态有回退写入保护。

### 其他

- 上传端点与工作区索引端点共用 `trustedHosts` 语义，公网域名 / 反向隧道部署不再静默 403。
- 新增 workspace 回归测试（索引、忽略规则、symlink 跳过、maxDepth/maxFiles 上限）与图片原生路径的 client 侧分流测试；tsc 零错。

## 0.3.0

### 修复

- **read_document 不再拒绝 >64 KiB 文件**（#5）：此前用 64 KiB 上限做头部嗅探预读，而底层 `readBytes` 的 `maxBytes` 是整文件上限（超限直接抛 `FS_TOO_LARGE`），任何大文件都会在嗅探阶段被误拒。现改为一次读满 `maxFileBytes`，格式从缓冲前 64 KiB 截取判定。模型读取大 PDF/DOCX/XLSX 恢复正常。
- **公网域名 / 反向隧道部署下上传不再静默 403**（#6）：上传栅栏此前硬编码 loopback-only 且 Origin 比较完整 URL（含 scheme），`dsh web --trusted-host` 部署的 GUI 上传全部被拒且界面无提示。现支持 `trustedHosts` 配置（裸 host 匹配任意端口、`host:port` 精确匹配，与官方 `--trusted-host` 栅栏同语义，启动时校验条目），Origin 只比较 host 部分兼容上游终结 TLS；客户端 403 错误改为明确提示，不再被空 catch 吞掉。

### 新增

- **文件夹上传**（#1）：输入框工具栏新增文件夹按钮（`webkitdirectory` 目录选择），页面任意位置拖拽也支持文件夹（目录项递归展平，保留子目录文件）。
- **有界并发上传**：批量上传固定 4 路并发（与服务端 `maxConcurrentUploads` 默认值对齐），文件夹 / 多文件上传不再串行排队，也不触发 429；逐文件失败只记入错误提示，不阻塞其余文件。
- 回形针按钮保持文件多选能力不变（与文件夹按钮分离）。

### 其他

- 新增 guard 回归测试 12 项、read_document 64 KiB 回归测试 2 项，测试总数 78 项全过，tsc 零错。

## 0.2.0

- **@ 文件候选**：输入框输入 `@` 列出本会话已上传文件，选中插入路径引用，模型据此 `read_document`。
- **差异化输出预算**：单次输出窗口按格式分级（text 满额、xlsx 3/4、pdf/docx 1/2），超限截断并显式标记，降低上下文 token 占用。
- **解析缓存键改内容 sha256**：文件内容变化必然失效（不再仅依赖文件版本）。
- **readTimeoutMs 可配置**：`read_document` 单次执行超时（默认 120s），大 PDF 解析不再依赖硬编码。
- **UTF-16 无 BOM 识别**：编码链（UTF-16 BOM → UTF-8 → GB18030 → UTF-16 无 BOM）补全，中文 GBK 与无 BOM UTF-16 文件均可读。
- **上传增强**：readHint 体量提示（cost / estimatedChars）、emoji 文件名按码点截断（不切出孤立代理）、sha256 内容去重竞态修复、413 提前拒绝并排空请求体（keep-alive 不挂起）。
- **网络栅栏与配额**：loopback + same-origin + sec-fetch-site 三重校验；会话存储配额（超限 507）；未知会话 403；并发限流（默认 4）超限 429。
- **XLSX sheet 级读取**：`sheet` 参数返回指定工作表全量，`list_sheets` 先列全部 sheet 名，越界报错附可用列表。
- **整页拖拽上传**：页面任意位置拖拽文件上传，悬停遮罩提示。
- **文件名净化**：按 UTF-8 字节截断并保留扩展名，长中文名不触发 ENAMETOOLONG。

## 0.1.0

- 首版：Web UI 回形针上传 + 模型读文档（text / PDF / DOCX / XLSX）。
- 内容嗅探 + LRU 缓存。
