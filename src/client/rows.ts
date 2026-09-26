// 附件库面板的列表纯函数：客户端过滤与显示上限。搜索在客户端完成——
// 面板已经持有全量清单（挂载时一次拉取），再回服务端过滤同一份数据是
// 纯冗余往返；服务端 `?q=` 保留给 API 消费者。抽成纯 .ts 以便 node --test
// 直接覆盖（.tsx 不在类型检查与单测范围内）。

export interface RowLike {
  name: string
}

/** 文件名不区分大小写的包含匹配；空查询原样返回。 */
export function filterRows<T extends RowLike>(rows: readonly T[], query: string): T[] {
  const q = query.trim().toLowerCase()
  if (q === '') return [...rows]
  return rows.filter((row) => row.name.toLowerCase().includes(q))
}

export const DISPLAY_CAP = 100

/** 过滤 + 按显示上限截断，hidden 是被截掉的条数（0 表示全部可见）。 */
export function displayRows<T extends RowLike>(
  rows: readonly T[],
  query: string,
  cap: number = DISPLAY_CAP
): { rows: T[]; hidden: number } {
  const filtered = filterRows(rows, query)
  return { rows: filtered.slice(0, cap), hidden: Math.max(0, filtered.length - cap) }
}
