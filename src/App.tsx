import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import DailyFeed from './pages/DailyFeed'
import KnowledgeBase from './pages/KnowledgeBase'
import Stock from './pages/Stock'
import ArticleView from './pages/ArticleView'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<DailyFeed />} />
        <Route path="/article/:id" element={<ArticleView />} />
        <Route path="/knowledge" element={<KnowledgeBase />} />
        <Route path="/stock" element={<Stock />} />
      </Route>
    </Routes>
  )
}
