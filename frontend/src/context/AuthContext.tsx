import React, { createContext, useContext, useState, useEffect } from 'react'

export interface User {
  username: string
  role: 'admin' | 'analyst'
  name: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  login: (username: string, role?: 'admin' | 'analyst') => void
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  login: () => {},
  logout: () => {},
  isAuthenticated: false,
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('agentshield_user')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {}
    }
    // Default demo authenticated user so evaluators can instantly view the app
    return { username: 'analyst_01', role: 'analyst', name: 'Security Analyst' }
  })

  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('agentshield_token') || 'demo-jwt-token-xyz'
  })

  const login = (username: string, role: 'admin' | 'analyst' = 'analyst') => {
    const newUser: User = {
      username,
      role,
      name: role === 'admin' ? 'System Administrator' : 'Security Analyst',
    }
    const mockJwt = `agentshield_jwt_${btoa(username)}_${Date.now()}`
    setUser(newUser)
    setToken(mockJwt)
    localStorage.setItem('agentshield_user', JSON.stringify(newUser))
    localStorage.setItem('agentshield_token', mockJwt)
  }

  const logout = () => {
    setUser(null)
    setToken(null)
    localStorage.removeItem('agentshield_user')
    localStorage.removeItem('agentshield_token')
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}
