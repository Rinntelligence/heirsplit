import { createContext, useContext } from 'react'

const PlanContext = createContext(null)

// Everyone gets full access - no gates
export function PlanProvider({ session, children }) {
  const can = () => true
  const limit = (feature) => {
    if (feature === 'estates') return Infinity
    if (feature === 'items') return Infinity
    if (feature === 'members') return Infinity
    return Infinity
  }

  return (
    <PlanContext.Provider value={{ plan: 'family', can, limit, loading: false }}>
      {children}
    </PlanContext.Provider>
  )
}

export const usePlan = () => useContext(PlanContext)
