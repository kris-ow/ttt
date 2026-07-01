import { createContext, useContext } from 'react'
import interviewsData from '../../data/interviews.json'
import type { Interview } from './InterviewSection'

const interviews = (interviewsData as { interviews: Interview[] }).interviews

// Deep-link path for a single interview: /i/<slug>/  (see
// scripts/build-interview-pages.js, which emits the matching static shell).
export const INTERVIEW_PATH_RE = /^\/i\/([a-z0-9-]+)\/?$/

export function interviewPath(slug: string): string {
  return `/i/${slug}/`
}

export function interviewFromPath(pathname: string): Interview | undefined {
  const m = pathname.match(INTERVIEW_PATH_RE)
  if (!m) return undefined
  return interviews.find(iv => iv.slug === m[1])
}

// Single opener shared by both mount points (archive list + feed teaser) so
// they update the URL / route state identically. Provided by App.
export type InterviewLocation = 'archive' | 'feed'
export type InterviewOpener = (iv: Interview, location: InterviewLocation) => void

export const InterviewRouteContext = createContext<InterviewOpener | null>(null)

export function useInterviewOpener(): InterviewOpener {
  const open = useContext(InterviewRouteContext)
  if (!open) throw new Error('useInterviewOpener must be used within InterviewRouteContext')
  return open
}
