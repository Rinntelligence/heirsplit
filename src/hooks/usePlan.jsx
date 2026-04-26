import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const PlanContext = createContext(null)

export const PLANS = {
  free:       { items: 10, members: 3, estates: 1,  pdf: false, comments: false, whitelabel: false },
  family:     { items: Infinity, members: Infinity, estates: 1,  pdf: true,  comments: true,  whitelabel: false },
  business:   { items: Infinity, members: Infinity, estates: 15, pdf: true,  comments: true,  whitelabel: true  },
  enterprise: { items: Infinity, members: Infinity, estates: Infinity, pdf: true, comments: true, whitelabel: true },
}

export function PlanProvider({ session, children }) {
  const [plan, setPlan] = useState('free')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session?.user) { setLoading(false); return }
    supabase.from('profiles').select('plan').eq('user_id', session.user.id).single()
      .then(({ data }) => { if (data?.plan) setPlan(data.plan); setLoading(false) })
  }, [session])

  const limits = PLANS[plan] || PLANS.free
  const can = (feature) => limits[feature] === true || limits[feature] === Infinity || (typeof limits[feature] === 'number' && limits[feature] > 0)
  const limit = (feature) => limits[feature]

  return <PlanContext.Provider value={{ plan, limits, can, limit, loading }}>{children}</PlanContext.Provider>
}

export const usePlan = () => useContext(PlanContext)
