import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { PlanProvider } from './hooks/usePlan'

import LoginPage from './pages/LoginPage'
import ProfileSetupPage from './pages/ProfileSetupPage'
import EstatesPage from './pages/EstatesPage'
import EstatePage from './pages/EstatePage'
import ItemDetailPage from './pages/ItemDetailPage'
import AddItemPage from './pages/AddItemPage'
import AdminPage from './pages/AdminPage'
import FounderPage from './pages/FounderPage'
import TasksPage from './pages/TasksPage'
import DocumentVaultPage from './pages/DocumentVaultPage'
import HeirsPage from './pages/HeirsPage'
import GoodwillPage from './pages/GoodwillPage'
import { JoinPage, PricingPage, CategoriesPage } from './pages/OtherPages'
import TopBar from './components/TopBar'
import Toast from './components/Toast'

export default function App() {
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(null)
  const [toast, setToast] = useState(null)
  const navigate = useNavigate()

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3200)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      setSession(s)
      if (!s) setProfile(null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session?.user) return
    supabase.from('profiles').select('*').eq('user_id', session.user.id).single()
      .then(({ data }) => {
        setProfile(data)
        if (!data?.display_name) navigate('/setup')
      })
  }, [session])

  if (session === undefined) return <Splash />

  if (!session) {
    return (
      <Routes>
        <Route path="/join/:code" element={<JoinPage onToast={showToast} />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="*" element={<LoginPage onToast={showToast} />} />
      </Routes>
    )
  }

  return (
    <PlanProvider session={session}>
      <div style={{ minHeight: '100vh', background: '#f8f5f0' }}>
        <TopBar profile={profile} session={session} onToast={showToast} />
        {toast && <Toast msg={toast.msg} type={toast.type} />}
        <Routes>
          <Route path="/" element={<EstatesPage session={session} profile={profile} onToast={showToast} />} />
          <Route path="/setup" element={<ProfileSetupPage session={session} onSaved={(p) => { setProfile(p); navigate('/') }} onToast={showToast} />} />
          <Route path="/estate/:id" element={<EstatePage session={session} profile={profile} onToast={showToast} />} />
          <Route path="/estate/:id/item/:itemId" element={<ItemDetailPage session={session} profile={profile} onToast={showToast} />} />
          <Route path="/estate/:id/add" element={<AddItemPage session={session} profile={profile} onToast={showToast} />} />
          <Route path="/estate/:id/admin" element={<AdminPage session={session} profile={profile} onToast={showToast} />} />
          <Route path="/estate/:id/categories" element={<CategoriesPage session={session} onToast={showToast} />} />
          <Route path="/estate/:id/tasks" element={<TasksPage session={session} profile={profile} onToast={showToast} />} />
          <Route path="/estate/:id/documents" element={<DocumentVaultPage session={session} profile={profile} onToast={showToast} />} />
          <Route path="/estate/:id/goodwill" element={<GoodwillPage session={session} profile={profile} onToast={showToast} />} />
          <Route path="/estate/:id/heirs" element={<HeirsPage session={session} profile={profile} onToast={showToast} />} />
          <Route path="/join/:code" element={<JoinPage session={session} onToast={showToast} />} />
          <Route path="/pricing" element={<PricingPage session={session} />} />
          <Route path="/founder" element={<FounderPage session={session} />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </PlanProvider>
  )
}

function Splash() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f5f0', fontFamily: "'Playfair Display', serif", color: '#8c7b6b', fontSize: '20px', gap: '12px' }}>
      <span style={{ fontSize: '32px' }}>⚖️</span> HeirSplit
    </div>
  )
}
