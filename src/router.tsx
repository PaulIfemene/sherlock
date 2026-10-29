import { lazy, Suspense, type ComponentType } from 'react'
import { createBrowserRouter } from 'react-router'
import { PublicLayout } from './App'
import Landing from './pages/Landing'
import Check from './pages/Check'
import Pricing from './pages/Pricing'
import Team from './pages/Team'
import { Privacy, Terms } from './pages/Legal'
import NotFound from './pages/NotFound'

// The newsroom (charts, Supabase client, Realtime) loads only when a journalist opens it.
function page(load: () => Promise<{ default: ComponentType }>) {
  const Component = lazy(load)
  return (
    <Suspense fallback={<p className="p-8 text-ink-mute">Loading…</p>}>
      <Component />
    </Suspense>
  )
}

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <Landing /> },
      { path: '/check', element: <Check /> },
      { path: '/pricing', element: <Pricing /> },
      { path: '/team', element: <Team /> },
      { path: '/terms', element: <Terms /> },
      { path: '/privacy', element: <Privacy /> },
      { path: '*', element: <NotFound /> },
    ],
  },
  { path: '/newsroom/login', element: page(() => import('./pages/newsroom/Login')) },
  {
    path: '/newsroom',
    element: page(() => import('./pages/newsroom/Layout')),
    children: [
      { index: true, element: page(() => import('./pages/newsroom/Overview')) },
      { path: 'claims', element: page(() => import('./pages/newsroom/Claims')) },
      { path: 'claims/:id', element: page(() => import('./pages/newsroom/ClaimDetail')) },
      { path: 'library', element: page(() => import('./pages/newsroom/Library')) },
      { path: 'sources', element: page(() => import('./pages/newsroom/Sources')) },
      { path: 'alerts', element: page(() => import('./pages/newsroom/Alerts')) },
      { path: 'settings', element: page(() => import('./pages/newsroom/Settings')) },
    ],
  },
])
