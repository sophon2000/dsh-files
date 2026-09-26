<div align="center">

[English](README.md) | [简体中文](README.zh.md)

</div>

<p align="center">
  <img src="assets/readme/hero.svg" width="100%" alt="dsh-files：文件夹上传、读内置 read 读不了的文档、管附件库。">
</p>

# dsh-files

一个 DeepSeek Harness 插件，文件在会话里的三段生命周期各补一块官方空白：

- **进**：**回形针旁的文件夹按钮**（+ 菜单里另有同名命令入口）——浏览器递归展平（过滤 Office 锁文件、`.DS_Store`、`.env` 等系统/隐藏文件），逐文件进入官方原生附件管线
- **读**：**`read_document` 工具**——读内置 read 工具拒绝的二进制文档（PDF / DOC / DOCX / XLSX）与增强文本读取（编码回退、分页、sheet 级访问）
- **管**：**`attachment_list` / `export_attachment` 工具**——附件库对模型可见（文件名/大小/sha），一键拷贝进工作区供 read/edit/bash 再加工
- **取**：**附件库面板**（输入卡下方官方坞位，收起为一枚官方胶囊）+ 下载/导出路由 + `@` 附件源——附件库对用户可见可下载（远程/LAN 把文件拉回本机），`@` 菜单插入官方 handle 行（与上传时模型所见一致）

> 上传、图片、`@` 工作区引用自 0.5.0 起移除——harness 0.1.3 起原生提供（任意文件上传、图片视觉管线、`@file`/`@session` 统一引用），且更强。本插件是[踏雪寻仙插件矩阵](https://github.com/taxueseek#deepseek-harness-%E6%8F%92%E4%BB%B6)的一员，主打 [argo](https://github.com/taxueseek/argo)。

## 为什么需要它

harness 0.1.3 的原生上传把文件存为字节对象，模型拿到一行 handle（文件名、大小、摘要、只读路径）后用**文件工具**读取——而内置 read 对二进制内容直接报 `FS_NOT_TEXT`。PDF / DOC / DOCX / XLSX 的结构化文本提取、附件库的清单与导出（官方 GC 在 roadmap、模型侧完全不可见）都是官方留白，这个插件补上它们。

<p align="center">
  <img src="assets/composer.png" alt="输入区与附件库：上传文件夹在官方 + 菜单中（截图为 0.5.3 之前界面，待重摄）" width="820">
</p>

## 能力

- **内容嗅探**：PDF 头 / OLE Compound File（Word 97-2003）/ ZIP 中央目录成员 / UTF-8（fatal）/ UTF-16 BOM / GB18030，全部从字节判定，扩展名伪装（exe 改 .pdf）一律拒绝；格式 hint 仅作字节完全未知时的兜底
- **.doc 老格式**：macOS 走系统 `textutil`（金标对照中正文与日期段最完整），其他平台回退纯 JS `word-extractor`
- **编码链**：UTF-16 BOM → UTF-8（fatal，拒 NUL）→ GB18030（fatal）→ UTF-16 无 BOM（高置信度守卫），中文 GBK 与无 BOM UTF-16 均可读
- **分页读取**：行号 + offset/limit 翻页；窗口字符预算按格式差异化（text 满额、xlsx 3/4、pdf/doc/docx 1/2），超限显式标记剩余行数
- **行号策略**：text（代码/配置）带行号供精确定位；PDF/DOC/DOCX/XLSX 段落流不带行号（省 token）
- **XLSX sheet 级读取**：`list_sheets` 先列名，`sheet` 参数读全量单表（不受行截断限制），越界报错附带可用 sheet 列表

<p align="center">
  <img src="assets/upload-folder-images.png" alt="文件夹批量上传后，文件以官方原生卡片进入预览区" width="680">
</p>
- **扫描件明示**：无文本层的 PDF 返回显式提示而非空串
- **协作取消**：解析期间监听执行信号，用户取消/会话关闭立即中止
- **输出呈现**：text 结果投影为官方 `card: 'read'` 读文件卡片；解析走 `ctx.fs`，继承会话沙箱与 fs 观察策略
- **附件库窗口**：`attachment_list` 列出附件库（原名/sha 前缀/大小/时间）；`export_attachment` 按 sha 前缀或原名导出，`COPYFILE_EXCL` 防覆盖，dest 走 `ctx.fs` 沙箱校验
- **附件库（0.5.3）**：输入卡**下方**官方坞位（`conversation.composer.dock`——官方自身在此放会话统计胶囊）里的一枚**官方 Pill 胶囊**「附件库 N 个 · X MB」，点开才展开卡片：附件列表（名/大小/时间，时间为短格式）、**重新插入**（把库内文件作为新附件挂回当前输入区——老会话的上传直接 ride 到新会话，不用回磁盘找）、**下载**（浏览器拉回本机，远程/LAN 场景的正路）、**导出到工作区**（`attachments/` 下自动命名防覆盖）、文件名搜索（客户端过滤，不打服务端往返；收起再展开超 30 秒才重拉清单）。跟随输入卡列宽。纯 UI 数据，零 prompt token
- **`@` 附件源（0.5.2）**：`@` 菜单新增附件组（与官方工作区候选共存），选中插入官方 handle 行——模型看到与上传时一致的文件行，直接 read 即可
- **下载/导出路由（0.5.2）**：走官方 `AttachmentStore.readFileStream`（完整性校验），双重护栏——Host 回环/`trustedHosts` 信任栅栏 + `sha256:` 引用白名单，超限 413
- **文件夹垃圾过滤**：锁文件（`~<div align="center">

[English](README.md) | [简体中文](README.zh.md)

</div>

<p align="center">
  <img src="assets/readme/hero.svg" width="100%" alt="dsh-files：文件夹上传、读内置 read 读不了的文档、管附件库。">
</p>

# dsh-files

一个 DeepSeek Harness 插件，文件在会话里的三段生命周期各补一块官方空白：

- **进**：**回形针旁的文件夹按钮**（+ 菜单里另有同名命令入口）——浏览器递归展平（过滤 Office 锁文件、`.DS_Store`、`.env` 等系统/隐藏文件），逐文件进入官方原生附件管线
- **读**：**`read_document` 工具**——读内置 read 工具拒绝的二进制文档（PDF / DOC / DOCX / XLSX）与增强文本读取（编码回退、分页、sheet 级访问）
- **管**：**`attachment_list` / `export_attachment` 工具**——附件库对模型可见（文件名/大小/sha），一键拷贝进工作区供 read/edit/bash 再加工
- **取**：**附件库面板**（输入卡下方官方坞位，收起为一枚官方胶囊）+ 下载/导出路由 + `@` 附件源——附件库对用户可见可下载（远程/LAN 把文件拉回本机），`@` 菜单插入官方 handle 行（与上传时模型所见一致）

> 上传、图片、`@` 工作区引用自 0.5.0 起移除——harness 0.1.3 起原生提供（任意文件上传、图片视觉管线、`@file`/`@session` 统一引用），且更强。本插件是[踏雪寻仙插件矩阵](https://github.com/taxueseek#deepseek-harness-%E6%8F%92%E4%BB%B6)的一员，主打 [argo](https://github.com/taxueseek/argo)。

## 为什么需要它

harness 0.1.3 的原生上传把文件存为字节对象，模型拿到一行 handle（文件名、大小、摘要、只读路径）后用**文件工具**读取——而内置 read 对二进制内容直接报 `FS_NOT_TEXT`。PDF / DOC / DOCX / XLSX 的结构化文本提取、附件库的清单与导出（官方 GC 在 roadmap、模型侧完全不可见）都是官方留白，这个插件补上它们。

<p align="center">
  <img src="assets/composer.png" alt="输入区与附件库：上传文件夹在官方 + 菜单中（截图为 0.5.3 之前界面，待重摄）" width="820">
</p>

## 能力

- **内容嗅探**：PDF 头 / OLE Compound File（Word 97-2003）/ ZIP 中央目录成员 / UTF-8（fatal）/ UTF-16 BOM / GB18030，全部从字节判定，扩展名伪装（exe 改 .pdf）一律拒绝；格式 hint 仅作字节完全未知时的兜底
- **.doc 老格式**：macOS 走系统 `textutil`（金标对照中正文与日期段最完整），其他平台回退纯 JS `word-extractor`
- **编码链**：UTF-16 BOM → UTF-8（fatal，拒 NUL）→ GB18030（fatal）→ UTF-16 无 BOM（高置信度守卫），中文 GBK 与无 BOM UTF-16 均可读
- **分页读取**：行号 + offset/limit 翻页；窗口字符预算按格式差异化（text 满额、xlsx 3/4、pdf/doc/docx 1/2），超限显式标记剩余行数
- **行号策略**：text（代码/配置）带行号供精确定位；PDF/DOC/DOCX/XLSX 段落流不带行号（省 token）
- **XLSX sheet 级读取**：`list_sheets` 先列名，`sheet` 参数读全量单表（不受行截断限制），越界报错附带可用 sheet 列表

<p align="center">
  <img src="assets/upload-folder-images.png" alt="文件夹批量上传后，文件以官方原生卡片进入预览区" width="680">
</p>
- **扫描件明示**：无文本层的 PDF 返回显式提示而非空串
- **协作取消**：解析期间监听执行信号，用户取消/会话关闭立即中止
- **输出呈现**：text 结果投影为官方 `card: 'read'` 读文件卡片；解析走 `ctx.fs`，继承会话沙箱与 fs 观察策略
/`.~`）、点开头隐藏文件（`.DS_Store`/`.env`）、系统文件在进入官方管线前跳过，跳过数量对用户明示
- **阅读克制**：systemPrompt 引导「先探结构、再精准读、读够就停」

## 安装

要求 harness ≥ 0.1.3-alpha.1。

```sh
curl -fsSL https://raw.githubusercontent.com/taxueseek/dsh-files/main/install.sh | sh
# 重启 dsh web
```

手动等价命令：

```sh
dsh plugin --profile web add git+https://github.com/taxueseek/dsh-files.git
# 重启 dsh web
```

> npm 上名为 `dsh-files` 的包是无关第三方占位包，请勿用裸 npm 包名安装。

## 版本支持

| dsh-files | Harness | 说明 |
| --- | --- | --- |
| 0.5.3 | 0.1.7-alpha.1（已验证） | 当前版。`@deepseek-ai/dsh-fs/dsh-tools/dsh-client-ui-primitives` 锁定 `0.1.7-alpha.1`；客户端图标跟随宿主 `Regular/Medium` 命名。 |
| 0.5.x | ≥ 0.1.3-alpha.1 | 旧 SDK pin（`0.1.0-rc.x`）；附件面板与 `@` 源早于宿主 `conversation.composer.dock` 槽位。 |
| 0.6.x | — | 从未发布（已并入 0.5.2/0.5.3），请勿使用。 |

本插件跟随维护者本地运行的 `alpha` 线（`0.1.7-alpha.1`）；npm `latest`（撰写时为 `0.1.5-rc.3`）反而更旧，请用上面的 git 方式安装，勿用仓库版本。

## 配置

```yaml
- id: files-toolkit
  name: 'dsh-files'
  config:
    maxFileBytes: 25165824        # 单次文档读取字节上限
    readLimit: 2000               # 单次返回行数上限（翻页成本低）
    sheetRowLimit: 200            # 每个 sheet 保留行数
    maxSheets: 5                  # 每个工作簿读取的 sheet 数
    maxOutputChars: 24000         # 单次输出窗口字符预算（超限截断并标记）
    readTimeoutMs: 120000         # 单次执行超时（大 PDF 解析可加大）
    # attachmentsDir: /path/to/attachments/v1  # 附件库根；留空按 DSH_HOME / ~/.dsh 自动探测
    attachmentsEnabled: true      # 附件闭环（面板/下载/导出/@ 源）总开关
    maxDownloadBytes: 209715200   # 单次附件下载/导出字节上限（超限 413）
    trustedHosts: []              # 非回环 host[:port] 授权；LAN/域名部署必配（语义同官方 --trusted-host）
```

## 安全

- 解析依赖均为只读维护中库：`pdfjs-dist`（Mozilla 官方）、`mammoth`、`read-excel-file`、`word-extractor`（.doc 兜底）
- ZIP 中央目录探测不展开任何成员，恶意归档安全拒绝
- 文件读取与导出落盘走 `ctx.fs`，继承会话沙箱，与内置 read 工具同权；附件库扫描由宿主进程只读执行，路径全部内部拼接
- 附件下载/导出除经官方 `AttachmentStore.readFileStream`（内容完整性校验、不暴露绝对路径），外再叠 Host 信任栅栏 + `sha256:` 引用白名单 + 尺寸上限；无任何删除路由（内容寻址对象可能被历史消息引用，删除留给官方未来 retention）
- 面板与 `@` 源均为 UI 层数据：不注入 systemPrompt、不注册模型工具，零 token

## 开发

```sh
pnpm install
pnpm test
pnpm build
npx tsc --noEmit
```

## 许可

MIT
