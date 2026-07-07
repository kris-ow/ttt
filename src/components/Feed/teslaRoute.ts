import newsData from '../../data/news.json'
import type { Article, NewsData } from '../../types'

const articles = (newsData as NewsData).articles

// Deep-link path for an official Tesla release (impact report, earnings, P&D):
// /t/<slug>/ where the slug is emitted by scripts/build-news.js for channel
// 'tesla' articles. See scripts/build-share-pages.js, which emits the matching
// static shell per release.
export const TESLA_PATH_RE = /^\/t\/([a-z0-9-]+)\/?$/

export function teslaPath(slug: string): string {
  return `/t/${slug}/`
}

export function teslaFromPath(pathname: string): Article | undefined {
  const m = pathname.match(TESLA_PATH_RE)
  if (!m) return undefined
  return articles.find(a => a.channel === 'tesla' && a.slug === m[1])
}
