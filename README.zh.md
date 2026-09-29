# dsh-files · Video Harness 定制版

`dsh-files` 只给 DeepSeek Harness 增加一种模型能力：对原生文本读取器无法解析的文档做有边界的结构化文字提取。

当前定制版针对 **DSH `0.2.0-rc.1.vh.1`** 验证。安装应使用 [fork Releases](https://github.com/sophon2000/dsh-files/releases) 中带版本和摘要的资产；同名 npm 包不是本版本的分发渠道。

## 能力边界

- 只注册 `read_document`。
- 通过 DSH `ctx.fs` 读取，因此路径解析、授权和观察事件仍以宿主为准。
- 支持文本、PDF、Word 97–2003（`.doc`）、DOCX 和 XLSX。
- 用户侧文件上传、预览、下载和标签页继续完全使用 DSH 原生能力。
- 不注册附件库、文件夹上传、导出路由、`@` 来源、自定义上传路径或业务文档绑定。
- 仅为 DSH 包交接保留一个空客户端模块；它不注入客户端服务，也不渲染界面。

上游 0.5.3 的附件闭环代码仍可在 Git 历史中查阅，但不会进入本版发布产物，因为 DSH 0.2 和 Video Harness Catalog 已负责这些职责。

## `read_document`

工具优先嗅探实际字节内容，再参考扩展名，并提供明确分页参数：

- `file_path`：DSH 文件系统可解析的路径
- `format`：`auto | text | pdf | doc | docx | xlsx`
- `offset` / `limit`：返回的行窗口
- `list_sheets`：读取 XLSX 前先列出工作表
- `sheet`：从 1 开始的 XLSX 工作表序号

资源与安全行为：

- 每次解析使用独立 Worker，成功、失败、超时和取消都会等待其终止
- 在工具实例内限制并发，超限直接拒绝，不建立无界队列
- 对 DOCX/XLSX 检查 ZIP 条目数、展开量、压缩比和实际解压字节
- 同时限制文件大小、解析字符数、PDF 页数、输出窗口、解析时间和 Worker 堆
- 插件只读源字节，不负责把文件登记成项目资产

旧 `.doc` 在 macOS 优先走 `textutil`，其他情况回退 `word-extractor`。旧 `.xls`、`.ppt` 与 `.doc` 共用 OLE 容器魔数，无法解析时会给出可纠正的明确错误。

## 默认配置

```yaml
maxFileBytes: 25165824
readLimit: 2000
sheetRowLimit: 200
maxSheets: 5
maxOutputChars: 24000
readTimeoutMs: 120000
parser:
  maxExpandedBytes: 67108864
  maxArchiveEntries: 2048
  maxCompressionRatio: 200
  maxParsedChars: 2097152
  maxPdfPages: 200
  maxParseMs: 30000
  workerHeapMb: 128
  maxConcurrentReads: 2
```

## 开发检查

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm run check
npm pack --ignore-scripts
```

正式发布还必须在全新 DSH Profile 中安装打包产物，并执行一次真实 `read_document` 工具调用。[FORK.md](FORK.md) 记录 fork 基线、产物规则和验证边界。

## 许可

MIT。解析依赖各自保留原许可：PDF.js（Apache-2.0）、Mammoth（BSD-2-Clause）、read-excel-file（MIT）、word-extractor（MIT）、yauzl（MIT）。
