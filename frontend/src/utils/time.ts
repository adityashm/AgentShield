/**
 * Utility functions for Indian Standard Time (IST - UTC+05:30)
 * Ensures all dashboard clocks, telemetry logs, alerts, and audit timestamps
 * strictly adhere to IST standard.
 */

export function getLiveISTTime(): string {
  const now = new Date()
  const timeStr = now.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  return `${timeStr} IST`
}

export function formatISTTime(value?: Date | string | number | null): string {
  if (!value) return '--:--:-- IST'
  try {
    const d = new Date(value)
    if (isNaN(d.getTime())) return String(value)
    const timeStr = d.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    return `${timeStr} IST`
  } catch {
    return String(value)
  }
}

export function formatISTDate(value?: Date | string | number | null): string {
  if (!value) return '--'
  try {
    const d = new Date(value)
    if (isNaN(d.getTime())) return String(value)
    return d.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return String(value)
  }
}

export function formatISTDateTime(value?: Date | string | number | null, includeSeconds = true): string {
  if (!value) return '--'
  try {
    const d = new Date(value)
    if (isNaN(d.getTime())) return String(value)
    
    // Format: YYYY-MM-DD HH:mm:ss IST
    const year = d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', year: 'numeric' })
    const month = d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', month: '2-digit' })
    const day = d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit' })
    
    const time = d.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: includeSeconds ? '2-digit' : undefined,
    })

    return `${year}-${month}-${day} ${time} IST`
  } catch {
    return String(value)
  }
}

export function formatISTCompact(value?: Date | string | number | null): string {
  if (!value) return '--'
  try {
    const d = new Date(value)
    if (isNaN(d.getTime())) return String(value)
    const dateStr = d.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
    })
    const timeStr = d.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    })
    return `${dateStr}, ${timeStr} IST`
  } catch {
    return String(value)
  }
}
