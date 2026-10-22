import React, { createContext, useContext, useEffect, useRef, useState } from 'react'

export type WSMessage = {
  type: string
  payload?: any
  agent?: string
  action?: string
  risk?: string | number
  tone?: 'danger' | 'warning' | 'success' | 'info'
  time?: string
  status?: string
}

export type ConnectionStatus = 'LIVE' | 'CONNECTING' | 'OFFLINE'

interface WebSocketContextType {
  send?: (msg: any) => void
  messages: WSMessage[]
  status: ConnectionStatus
  isPaused: boolean
  togglePause: () => void
  endpoint: string
  setEndpoint: (ep: string | null) => void
}

const WebSocketContext = createContext<WebSocketContextType>({
  messages: [],
  status: 'OFFLINE',
  isPaused: false,
  togglePause: () => {},
  endpoint: 'ws://localhost:8000/ws',
  setEndpoint: () => {},
})

export function useWebSocket() {
  return useContext(WebSocketContext)
}

const MOCK_ACTIONS = [
  { agent: 'AGT-009', action: 'Unauthorized DB Query', risk: 88, tone: 'danger' as const, status: 'Critical' },
  { agent: 'AGT-042', action: 'Elevated API Rate', risk: 62, tone: 'warning' as const, status: 'Suspicious' },
  { agent: 'AGT-012', action: 'Data Sync Request', risk: 14, tone: 'success' as const, status: 'Normal' },
  { agent: 'AGT-004', action: 'Model Parameter Update', risk: 33, tone: 'info' as const, status: 'Monitoring' },
  { agent: 'AGT-009', action: 'Prompt Injection Vector Test', risk: 94, tone: 'danger' as const, status: 'Critical' },
  { agent: 'AGT-018', action: 'Token Exfiltration Attempt', risk: 78, tone: 'warning' as const, status: 'High Risk' },
  { agent: 'AGT-007', action: 'Healthcheck Response OK', risk: 5, tone: 'success' as const, status: 'Normal' },
]

export function WebSocketProvider({
  children,
  endpoint: initialEndpoint,
}: {
  children: React.ReactNode
  endpoint?: string
}) {
  const [messages, setMessages] = useState<WSMessage[]>([])
  const [status, setStatus] = useState<ConnectionStatus>('CONNECTING')
  const [isPaused, setIsPaused] = useState<boolean>(false)
  const isPausedRef = useRef<boolean>(isPaused)
  useEffect(() => {
    isPausedRef.current = isPaused
  }, [isPaused])

  const [customEndpoint, setCustomEndpoint] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<any>(null)

  const togglePause = () => setIsPaused((prev) => !prev)

  // Resolve target WebSocket URL (custom endpoint like /ws/agent/${id} or fallback)
  const targetEndpoint = customEndpoint || initialEndpoint || (import.meta.env.VITE_API_WS_BASE as string | undefined) || '/ws'
  
  const resolveWsUrl = (pathOrUrl: string) => {
    if (pathOrUrl.startsWith('ws://') || pathOrUrl.startsWith('wss://')) {
      return pathOrUrl
    }
    let host = typeof window !== 'undefined' && window.location.host ? window.location.host : 'localhost:8000'
    // In local development, frontend Vite runs on port 5173/3000 while FastAPI backend runs on 8000
    if (host.includes('5173') || host.includes('3000')) {
      host = 'localhost:8000'
    }
    const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const cleanPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`
    return `${protocol}//${host}${cleanPath}`
  }

  const wsUrl = resolveWsUrl(targetEndpoint)

  useEffect(() => {
    let attempts = 0
    let mockInterval: any = null

    function connect() {
      setStatus('CONNECTING')
      try {
        const ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.onopen = () => {
          console.debug('WS connected to', wsUrl)
          setStatus('LIVE')
          attempts = 0
          if (mockInterval) clearInterval(mockInterval)
        }

        ws.onmessage = (e) => {
          if (isPausedRef.current) return
          try {
            const d = JSON.parse(e.data)
            setMessages((m) => [d, ...m].slice(0, 200))
          } catch {}
        }

        ws.onclose = () => {
          setStatus('OFFLINE')
          wsRef.current = null
          attempts++
          const delay = Math.min(1000 * Math.pow(2, attempts), 10000)
          reconnectTimeoutRef.current = setTimeout(connect, delay)
        }

        ws.onerror = () => {
          setStatus('OFFLINE')
          ws.close()
        }
      } catch (err) {
        setStatus('OFFLINE')
        attempts++
        const delay = Math.min(1000 * Math.pow(2, attempts), 10000)
        reconnectTimeoutRef.current = setTimeout(connect, delay)
      }
    }

    connect()

    // Mock telemetry generator when WS is offline or during dev fallback (4s interval)
    mockInterval = setInterval(() => {
      if (isPausedRef.current) return
      const now = new Date()
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now
        .getMinutes()
        .toString()
        .padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now
        .getMilliseconds()
        .toString()
        .padStart(3, '0')}`

      const randomMock = MOCK_ACTIONS[Math.floor(Math.random() * MOCK_ACTIONS.length)]
      const newItem: WSMessage = {
        type: 'ACTION_EVENT',
        ...randomMock,
        time: timeStr,
      }

      setMessages((m) => [newItem, ...m].slice(0, 100))
    }, 4000)

    return () => {
      if (wsRef.current) wsRef.current.close()
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
      if (mockInterval) clearInterval(mockInterval)
    }
  }, [wsUrl])

  const send = (msg: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    }
  }

  return (
    <WebSocketContext.Provider
      value={{
        send,
        messages,
        status,
        isPaused,
        togglePause,
        endpoint: wsUrl,
        setEndpoint: setCustomEndpoint,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  )
}
