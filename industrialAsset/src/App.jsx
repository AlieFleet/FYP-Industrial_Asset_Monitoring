import { useState } from 'react'
import { ReactFlow, Background } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts'

// MOCK DATA - later replace with fetch('/status')
const assets = [
  { id: 'pump', label: 'Pump P-101', status: 'normal', health: 92, x: 0 },
  { id: 'valve', label: 'Valve V-101', status: 'anomaly', health: 64, x: 250 },
  { id: 'hx', label: 'Heat Exchanger E-101', status: 'normal', health: 88, x: 500 },
  { id: 'tank', label: 'Tank T-101', status: 'fault', health: 35, x: 750 },
]
const COLORS = { normal: '#22c55e', anomaly: '#f59e0b', fault: '#ef4444' }
const trend = Array.from({ length: 20 }, (_, i) => ({ t: i, v: 50 + Math.random() * 10 }))

const nodes = assets.map(a => ({
  id: a.id,
  position: { x: a.x, y: 100 },
  data: { label: `${a.label} (${a.health}%)` },
  style: { background: COLORS[a.status], color: '#fff', padding: 12, borderRadius: 8, width: 160 },
}))
const edges = [
  { id: 'e1', source: 'pump', target: 'valve', animated: true },
  { id: 'e2', source: 'valve', target: 'hx', animated: true },
  { id: 'e3', source: 'hx', target: 'tank', animated: true },
]

export default function App() {
  const [selected, setSelected] = useState(null)
  const asset = assets.find(a => a.id === selected)
  return (
    <div style={{ height: '100vh', display: 'flex' }}>
      <div style={{ flex: 1 }}>
        <ReactFlow nodes={nodes} edges={edges} fitView
          onNodeClick={(_, n) => setSelected(n.id)}>
          <Background />
        </ReactFlow>
      </div>
      {asset && (
        <div style={{ width: 320, padding: 16, borderLeft: '1px solid #ddd' }}>
          <h3>{asset.label}</h3>
          <p>Health: {asset.health}% | Status: {asset.status}</p>
          <LineChart width={280} height={160} data={trend}>
            <XAxis dataKey="t" /><YAxis /><Tooltip />
            <Line dataKey="v" stroke="#3b82f6" dot={false} />
          </LineChart>
          <p><b>Recommendation:</b> Inspect this asset.</p>
        </div>
      )}
    </div>
  )
}