import React from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

export default function SystemHealthChart(){
  const data = {
    labels: ['00:00','02:00','04:00','06:00','08:00','10:00','12:00'],
    datasets: [
      {
        label: 'Anomaly Score',
        data: [0.02,0.05,0.03,0.2,0.12,0.08,0.03],
        borderColor: '#22d3ee',
        backgroundColor: 'rgba(34,211,238,0.08)',
        tension: 0.38,
        pointRadius: 0,
        borderWidth: 2.5,
      }
    ]
  }

  const options = {
    responsive: true,
    plugins: {
      legend: {
        display: true,
        labels: { color: '#94a3b8', usePointStyle: true, pointStyle: 'circle' as const },
      },
      tooltip: {
        enabled: true,
        backgroundColor: '#020617',
        titleColor: '#e2e8f0',
        bodyColor: '#cbd5e1',
        borderColor: 'rgba(34,211,238,0.2)',
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(148,163,184,0.08)' },
        ticks: { color: '#64748b' },
      },
      y: {
        grid: { color: 'rgba(148,163,184,0.08)' },
        ticks: { color: '#64748b' },
      },
    },
  }

  return (
    <div className='panel rounded-2xl p-4'>
      <div className='mb-4 flex items-center justify-between'>
        <div>
          <h3 className='text-sm font-semibold text-white'>Real-time Performance Metrics</h3>
          <p className='text-xs text-slate-500'>System telemetry trends across the current window</p>
        </div>
        <div className='flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-slate-500'>
          <span className='flex items-center gap-1 text-cyan-200'><span className='h-2 w-2 rounded-full bg-cyan-400' /> CPU</span>
          <span className='flex items-center gap-1 text-amber-200'><span className='h-2 w-2 rounded-full bg-amber-400' /> MEM</span>
          <span className='flex items-center gap-1 text-slate-300'><span className='h-2 w-2 rounded-full bg-slate-300' /> NET</span>
        </div>
      </div>
      <div className='h-[320px]'>
        <Line data={data} options={options} />
      </div>
    </div>
  )
}
