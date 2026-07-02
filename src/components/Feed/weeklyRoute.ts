import newsData from '../../data/news.json'
import type { Article, NewsData } from '../../types'

const articles = (newsData as NewsData).articles

// Deep-link path for a Weekly Tesla Brief: /w/<YYYY-MM-DD>/ where the date is
// the brief's publication Monday (article.date). See scripts/build-share-pages.js,
// which emits the matching static shell per weekly brief.
export const WEEKLY_PATH_RE = /^\/w\/(\d{4}-\d{2}-\d{2})\/?$/

export function weeklyPath(date: string): string {
  return `/w/${date}/`
}

export function weeklyFromPath(pathname: string): Article | undefined {
  const m = pathname.match(WEEKLY_PATH_RE)
  if (!m) return undefined
  return articles.find(a => a.type === 'weekly' && a.date === m[1])
}
