import { createBrowserRouter } from 'react-router'
import { PublicLayout } from './App'
import Landing from './pages/Landing'
import Check from './pages/Check'
import Pricing from './pages/Pricing'
import Team from './pages/Team'
import { Privacy, Terms } from './pages/Legal'
import NotFound from './pages/NotFound'
import NewsroomLayout from './pages/newsroom/Layout'
import Login from './pages/newsroom/Login'
import Overview from './pages/newsroom/Overview'
import Claims from './pages/newsroom/Claims'
import ClaimDetail from './pages/newsroom/ClaimDetail'
import Library from './pages/newsroom/Library'
import Sources from './pages/newsroom/Sources'
import Alerts from './pages/newsroom/Alerts'
import Settings from './pages/newsroom/Settings'

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
  { path: '/newsroom/login', element: <Login /> },
  {
    path: '/newsroom',
    element: <NewsroomLayout />,
    children: [
      { index: true, element: <Overview /> },
      { path: 'claims', element: <Claims /> },
      { path: 'claims/:id', element: <ClaimDetail /> },
      { path: 'library', element: <Library /> },
      { path: 'sources', element: <Sources /> },
      { path: 'alerts', element: <Alerts /> },
      { path: 'settings', element: <Settings /> },
    ],
  },
])
