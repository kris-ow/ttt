import { useState } from 'react'
import newsData from '../../data/news.json'
import { type Article, type NewsData } from '../../types'
import { ValuationSection } from '../Valuation/ValuationSection'
import { KBCategoryContent } from './KBCategoryContent'

const data = newsData as NewsData

export function KnowledgeSection({ onSelectArticle }: { onSelectArticle: (a: Article) => void }) {
  const [activeTab] = useState<string>('Valuation Models')
  const [expandedArea, setExpandedArea] = useState<string | null>(null)

  const toggleArea = (areaId: string) => {
    setExpandedArea(expandedArea === areaId ? null : areaId)
  }

  const openSource = (sourceFilename: string) => {
    const articleId = sourceFilename.replace('.txt', '')
    const article = data.articles.find(a => a.id === articleId)
    if (article) onSelectArticle(article)
  }

  return (
    <div>
      {activeTab === 'Valuation Models' ? (
        <ValuationSection openSource={openSource} />
      ) : (
        <KBCategoryContent
          category={activeTab}
          expandedArea={expandedArea}
          toggleArea={toggleArea}
          openSource={openSource}
        />
      )}
    </div>
  )
}
