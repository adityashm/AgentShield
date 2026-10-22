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

export default function SystemHealthChart() {
  const data = {
    labels: ['00:00', '02:00', '04:00', '06:00', '08:00', '10:00', '12:00'],
    datasets: [
      {
        label: 'Anomaly Score Index',
        data: [0.02, 0.05, 0.03, 0.2, 0.12, 0.08, 0.03],
        borderColor: '#38bdf8',
        backgroundColor: 'rgba(56, 189, 248, 0.08)',
        tension: 0.38,
        pointRadius: 0,
        borderWidth: 2.5,
        fill: true,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        labels: { color: '#94a3b8', usePointStyle: true, pointStyle: 'circle' as const },
      },
      tooltip: {
        enabled: true,
        backgroundColor: '#090d16',
        titleColor: '#f8fafc',
        bodyColor: '#cbd5e1',
        borderColor: 'rgba(56, 189, 248, 0.3)',
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.04)' },
        ticks: { color: '#64748b', font: { family: 'monospace', size: 10 } },
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.04)' },
        ticks: { color: '#64748b', font: { family: 'monospace', size: 10 } },
      },
    },
  }

  return (
    <div className="panel-obsidian rounded-2xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">System Telemetry & Health Baselines</h3>
          <p className="text-xs text-slate-400 mt-0.5">Sliding window anomaly scores and host resource indices</p>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-mono uppercase text-slate-400">
          <span className="flex items-center gap-1.5 text-sky-400">
            <span className="h-2 w-2 rounded-full bg-sky-400" /> ANOMALY
          </span>
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400" /> NOMINAL
          </span>
        </div>
      </div>
      <div className="h-[280px]">
        <Line data={data} options={options} />
      </div>
    </div>
  )
}
