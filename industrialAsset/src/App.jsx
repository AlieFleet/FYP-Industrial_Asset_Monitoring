import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  ReactFlow, Background, Controls, Handle, Position,
  useNodesState, useEdgesState, addEdge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts'

/* ---------- MOCK DATA (replace later with fetch('/status')) ----------
   Components come from the UCI hydraulic test rig (Helwig et al., 2015).
   Sensor values below are placeholders; confirm sensor-to-component
   mapping from the rig schematic. */
const ASSETS = {
  tank: { name: 'Oil tank', job: 'Links the two circuits', monitored: false },
  pump: {
    name: 'Pump', job: 'Creates oil pressure', monitored: true,
    status: 'anomaly', health: 62, score: 0.71,
    fault: 'Internal leakage (weak)',
    rule: 'Motor power above normal range',
    rec: 'Inspect pump seals and schedule maintenance.',
    sensors: { 'Motor power (EPS1)': '2.4 kW', 'Flow (FS1)': '5.1 l/min' },
  },
  valve: {
    name: 'Control valve', job: 'Directs the oil', monitored: true,
    status: 'normal', health: 95, score: 0.12,
    fault: 'None', rule: 'No rule triggered',
    rec: 'No action needed.',
    sensors: { 'Pressure (PS2)': '104 bar', 'Flow (FS2)': '9.8 l/min' },
  },
  acc: {
    name: 'Accumulator', job: 'Stores and smooths pressure', monitored: true,
    status: 'fault', health: 35, score: 0.88,
    fault: 'Pre-charge pressure loss (90 bar)',
    rule: 'Pressure below minimum limit',
    rec: 'Check and restore accumulator pre-charge pressure.',
    sensors: { 'Pressure (PS3)': '62 bar' },
  },
  cooler: {
    name: 'Oil cooler', job: 'Removes heat from the oil', monitored: true,
    status: 'normal', health: 91, score: 0.18,
    fault: 'None', rule: 'No rule triggered',
    rec: 'No action needed.',
    sensors: { 'Temperature (TS1)': '41 °C', 'Cooling efficiency (CE)': '47 %' },
  },
}
const COLORS = { normal: '#22c55e', anomaly: '#f59e0b', fault: '#ef4444', none: '#94a3b8' }
const IMPACT = 0.3 // a linked downstream asset loses 30% of the upstream asset's lost health

const initialNodes = [
  { id: 'tank', type: 'asset', position: { x: 0, y: 120 }, data: {} },
  { id: 'pump', type: 'asset', position: { x: 260, y: 20 }, data: {} },
  { id: 'valve', type: 'asset', position: { x: 520, y: 20 }, data: {} },
  { id: 'acc', type: 'asset', position: { x: 780, y: 20 }, data: {} },
  { id: 'cooler', type: 'asset', position: { x: 260, y: 240 }, data: {} },
]
const initialEdges = [
  ['tank', 'pump'], ['pump', 'valve'], ['valve', 'acc'], ['tank', 'cooler'],
].map(([s, t]) => ({ id: `${s}-${t}`, source: s, target: t, animated: true }))

/* ---------- Dependency impact (simple, explainable heuristic) ---------- */
function computeImpact(edges) {
  const out = {}
  Object.keys(ASSETS).forEach(id => (out[id] = { impact: 0, from: [] }))
  edges.forEach(e => {
    const s = ASSETS[e.source], t = ASSETS[e.target]
    if (!s?.monitored || !t?.monitored) return
    const loss = IMPACT * (100 - s.health)
    if (loss > 0) {
      out[e.target].impact += loss
      out[e.target].from.push(s.name)
    }
  })
  return out
}

/* ---------- Custom P&ID node ---------- */
function AssetNode({ data }) {
  const c = data.monitored ? COLORS[data.status] : COLORS.none
  return (
    <div style={{
      border: `3px solid ${c}`, background: '#fff', borderRadius: 10,
      padding: 10, width: 170, textAlign: 'center', boxShadow: '0 2px 6px #0002'
    }}>
      <Handle type="target" position={Position.Left}
        style={{ width: 16, height: 16, background: '#1e3a8a', border: '2px solid #fff' }} />
      <div style={{ fontWeight: 700 }}>{data.name}</div>
      <div style={{ fontSize: 12, color: '#64748b' }}>{data.job}</div>
      {data.monitored ? (
        <div style={{ marginTop: 6, fontSize: 22, fontWeight: 700, color: c }}>
          {Math.round(data.effective)}%
        </div>
      ) : (
        <div style={{ marginTop: 6, fontSize: 12, color: '#94a3b8' }}>Not monitored</div>
      )}
      {data.impact >= 1 && (
        <div style={{
          marginTop: 4, fontSize: 11, background: '#fef3c7', color: '#92400e',
          borderRadius: 6, padding: '2px 6px'
        }}>
          At risk: -{Math.round(data.impact)}% (linked)
        </div>
      )}
      <Handle type="source" position={Position.Right}
        style={{ width: 16, height: 16, background: '#1e3a8a', border: '2px solid #fff' }} />
    </div>
  )
}
const nodeTypes = { asset: AssetNode }

const trendFor = a =>
  Array.from({ length: 20 }, (_, i) => ({
    t: i,
    v: +(50 + Math.sin(i / 2) * 3 + (a.status === 'normal' ? 0 : i * 0.5)).toFixed(1),
  }))

const card = {
  background: '#fff', borderRadius: 10, padding: '10px 16px',
  boxShadow: '0 1px 4px #0001', flex: 1
}

export default function App() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [selected, setSelected] = useState(null)
  const [now, setNow] = useState(new Date())
  const [from, setFrom] = useState('pump')
  const [to, setTo] = useState('acc')

  const addLink = () => {
    if (from === to) return
    if (edges.some(e => e.source === from && e.target === to)) return
    setEdges(es => addEdge(
      { id: `${from}-${to}`, source: from, target: to, animated: true }, es))
  }
  const removeLink = id => setEdges(es => es.filter(e => e.id !== id))

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const onConnect = useCallback(
    c => setEdges(es => addEdge({ ...c, animated: true }, es)), [setEdges])

  const impact = useMemo(() => computeImpact(edges), [edges])

  const displayNodes = nodes.map(n => {
    const a = ASSETS[n.id]
    const imp = impact[n.id].impact
    return {
      ...n, data: {
        ...a, impact: imp,
        effective: a.monitored ? Math.max(0, a.health - imp) : 0
      }
    }
  })

  const monitored = Object.entries(ASSETS).filter(([, a]) => a.monitored)
  const plantHealth = monitored.reduce(
    (s, [id, a]) => s + Math.max(0, a.health - impact[id].impact), 0) / monitored.length
  const faults = monitored.filter(([, a]) => a.status === 'fault').length
  const alerts = monitored.filter(([, a]) => a.status !== 'normal')
  const topScore = Math.max(...monitored.map(([, a]) => a.score))
  const sel = selected && ASSETS[selected]

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{
        background: '#1e3a8a', color: '#fff', padding: '10px 20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div>
          <b>Hydraulic Power Unit: Asset Monitoring</b>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            Data: UCI Hydraulic Test Rig (Helwig et al., 2015)
          </div>
        </div>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <span style={{
            background: alerts.length ? '#ef4444' : '#22c55e',
            padding: '4px 12px', borderRadius: 20
          }}>
            {alerts.length} active alert{alerts.length !== 1 && 's'}
          </span>
          <span>{now.toLocaleTimeString()}</span>
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'flex', gap: 12, padding: 12 }}>
        <div style={card}><small>Plant health</small>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{Math.round(plantHealth)}%</div></div>
        <div style={card}><small>Active faults</small>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{faults}</div></div>
        <div style={card}><small>Highest anomaly score</small>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{topScore.toFixed(2)}</div></div>
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, padding: '0 12px 12px', gap: 12 }}>
        <div style={{ flex: 1, background: '#fff', borderRadius: 10, boxShadow: '0 1px 4px #0001' }}>
          <ReactFlow nodes={displayNodes} edges={edges} nodeTypes={nodeTypes}
            connectionMode="loose" connectionRadius={40}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
            onConnect={onConnect} onNodeClick={(_, n) => setSelected(n.id)} fitView>
            <Background /><Controls />
          </ReactFlow>
        </div>

        {/* Right panel */}
        <div style={{ width: 330, overflowY: 'auto' }}>
          <div style={{ ...card, marginBottom: 12 }}>
            <b>Alerts</b>
            {alerts.length === 0 && <p>All assets normal.</p>}
            {alerts.map(([id, a]) => (
              <div key={id} onClick={() => setSelected(id)}
                style={{
                  borderLeft: `4px solid ${COLORS[a.status]}`, paddingLeft: 8,
                  margin: '8px 0', cursor: 'pointer'
                }}>
                <b>{a.name}</b>: {a.fault}
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  Rule: {a.rule} | ML score {a.score}
                </div>
              </div>
            ))}
          </div>

          <div style={{ ...card }}>
            {!sel && <p>Click an asset on the diagram to see details.</p>}
            {sel && !sel.monitored && <p><b>{sel.name}</b>: {sel.job}. Not monitored.</p>}
            {sel && sel.monitored && (
              <>
                <h3 style={{ margin: '0 0 4px' }}>{sel.name}</h3>
                <div>Own health: <b>{sel.health}%</b> | Effective: <b>
                  {Math.round(Math.max(0, sel.health - impact[selected].impact))}%</b></div>
                {impact[selected].from.length > 0 && (
                  <div style={{ fontSize: 12, color: '#92400e' }}>
                    Estimated impact from: {impact[selected].from.join(', ')}
                  </div>
                )}
                <div>Status: <b style={{ color: COLORS[sel.status] }}>{sel.status}</b></div>
                <div>Fault: {sel.fault}</div>
                <div>Rule: {sel.rule}</div>
                <div>Anomaly score: {sel.score}</div>
                <hr />
                {Object.entries(sel.sensors).map(([k, v]) => (
                  <div key={k} style={{ fontSize: 13 }}>{k}: <b>{v}</b></div>
                ))}
                <LineChart width={290} height={150} data={trendFor(sel)}>
                  <XAxis dataKey="t" /><YAxis /><Tooltip />
                  <Line dataKey="v" stroke="#3b82f6" dot={false} />
                </LineChart>
                <p><b>Recommendation:</b> {sel.rec}</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}