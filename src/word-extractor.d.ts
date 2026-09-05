// word-extractor 无官方类型声明；本插件只用 extract → getBody 一条窄接口。
declare module 'word-extractor' {
  export default class WordExtractor {
    extract(input: Buffer | string): Promise<{ getBody(): string }>
  }
}
