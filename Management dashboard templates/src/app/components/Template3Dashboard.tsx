import { useState, useEffect } from 'react';
import { LayoutDashboard, Activity, TrendingUp, AlertTriangle, MapPin, Zap, Users, Settings, Bell, Radio, Download, Filter } from 'lucide-react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

// Mock data
const realTimeData = Array.from({ length: 30 }, (_, i) => ({
  time: i,
  accel1: Math.sin(i * 0.5) * 3 + 3 + Math.random(),
  accel2: Math.cos(i * 0.4) * 2.5 + 2.5 + Math.random(),
  temperature: 45 + Math.random() * 5,
}));

const performanceMetrics = [
  { metric: 'Speed', value: 85, fullMark: 100 },
  { metric: 'Stability', value: 92, fullMark: 100 },
  { metric: 'Efficiency', value: 78, fullMark: 100 },
  { metric: 'Safety', value: 95, fullMark: 100 },
  { metric: 'Reliability', value: 88, fullMark: 100 },
];

const impactData = Array.from({ length: 12 }, (_, i) => ({
  time: `${i * 2}h`,
  count: Math.floor(Math.random() * 15),
}));

export function Template3Dashboard() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeView, setActiveView] = useState('overview');

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700">
        <div className="px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-cyan-500 p-2 rounded-lg">
                <LayoutDashboard className="w-6 h-6 text-slate-900" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Railway Monitoring System</h1>
                <p className="text-sm text-slate-400">Advanced Analytics Dashboard</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 bg-slate-700/50 px-4 py-2 rounded-lg border border-slate-600">
                <div className="text-right">
                  <div className="text-white font-mono text-sm">{currentTime.toLocaleTimeString()}</div>
                  <div className="text-xs text-slate-400">{currentTime.toLocaleDateString()}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
                <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
                <span className="text-sm font-medium text-cyan-400">Live Stream</span>
              </div>
              <button className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors">
                <Download className="w-5 h-5 text-white" />
              </button>
              <button className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors">
                <Filter className="w-5 h-5 text-white" />
              </button>
              <button className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors relative">
                <Bell className="w-5 h-5 text-white" />
                <div className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></div>
              </button>
              <button className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors">
                <Settings className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-8 flex gap-1">
          <button 
            onClick={() => setActiveView('overview')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeView === 'overview' 
                ? 'text-cyan-400 border-cyan-400' 
                : 'text-slate-400 border-transparent hover:text-white'
            }`}
          >
            Overview
          </button>
          <button 
            onClick={() => setActiveView('analytics')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeView === 'analytics' 
                ? 'text-cyan-400 border-cyan-400' 
                : 'text-slate-400 border-transparent hover:text-white'
            }`}
          >
            Analytics
          </button>
          <button 
            onClick={() => setActiveView('reports')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeView === 'reports' 
                ? 'text-cyan-400 border-cyan-400' 
                : 'text-slate-400 border-transparent hover:text-white'
            }`}
          >
            Reports
          </button>
        </div>
      </header>

      <div className="p-8">
        {/* Metrics Bar */}
        <div className="grid grid-cols-6 gap-4 mb-8">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span className="text-xs text-green-400">●</span>
            </div>
            <div className="text-2xl font-bold text-white mb-1">98.7%</div>
            <div className="text-xs text-slate-400">Uptime</div>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <Zap className="w-4 h-4 text-yellow-400" />
              <span className="text-xs text-green-400">+12%</span>
            </div>
            <div className="text-2xl font-bold text-white mb-1">156</div>
            <div className="text-xs text-slate-400">Sensors</div>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <AlertTriangle className="w-4 h-4 text-orange-400" />
              <span className="text-xs text-orange-400">3</span>
            </div>
            <div className="text-2xl font-bold text-white mb-1">2</div>
            <div className="text-xs text-slate-400">Alerts</div>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <span className="text-xs text-green-400">+8%</span>
            </div>
            <div className="text-2xl font-bold text-white mb-1">95.1</div>
            <div className="text-xs text-slate-400">Avg Speed (km/h)</div>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <Users className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-cyan-400">24</span>
            </div>
            <div className="text-2xl font-bold text-white mb-1">47</div>
            <div className="text-xs text-slate-400">Operators</div>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <MapPin className="w-4 h-4 text-red-400" />
              <span className="text-xs text-green-400">GPS</span>
            </div>
            <div className="text-2xl font-bold text-white mb-1">12</div>
            <div className="text-xs text-slate-400">Satellites</div>
          </div>
        </div>

        {/* Main Analytics Grid */}
        <div className="grid grid-cols-3 gap-6 mb-6">
          {/* Real-time Sensor Data */}
          <div className="col-span-2 bg-slate-800 border border-slate-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">Real-time Sensor Telemetry</h3>
                <p className="text-xs text-slate-400">Live data stream from accelerometers</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-cyan-400 rounded"></div>
                  <span className="text-xs text-slate-400">Accel 1</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-purple-400 rounded"></div>
                  <span className="text-xs text-slate-400">Accel 2</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-orange-400 rounded"></div>
                  <span className="text-xs text-slate-400">Temp</span>
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={realTimeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="time" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '6px' }}
                  labelStyle={{ color: '#ffffff' }}
                />
                <Line type="monotone" dataKey="accel1" stroke="#22d3ee" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="accel2" stroke="#a78bfa" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="temperature" stroke="#fb923c" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Performance Radar */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-6">Performance Metrics</h3>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={performanceMetrics}>
                <PolarGrid stroke="#475569" />
                <PolarAngleAxis dataKey="metric" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis stroke="#94a3b8" />
                <Radar dataKey="value" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.6} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bottom Grid */}
        <div className="grid grid-cols-2 gap-6">
          {/* Impact Analysis */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">24-Hour Impact Analysis</h3>
              <div className="text-xs text-slate-400">Updates every 2 hours</div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={impactData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="time" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '6px' }}
                  labelStyle={{ color: '#ffffff' }}
                />
                <Bar dataKey="count" fill="#22d3ee" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* GPS & Location Details */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">GPS & Location Data</h3>
              <div className="flex items-center gap-2 text-xs text-green-400">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                Active
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                <div className="text-xs text-slate-400 mb-1">Latitude</div>
                <div className="text-white font-mono text-sm">28.613567° N</div>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                <div className="text-xs text-slate-400 mb-1">Longitude</div>
                <div className="text-white font-mono text-sm">77.209967° E</div>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                <div className="text-xs text-slate-400 mb-1">Speed</div>
                <div className="text-white font-mono text-sm">95.1 km/h</div>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                <div className="text-xs text-slate-400 mb-1">Altitude</div>
                <div className="text-white font-mono text-sm">216 m</div>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                <div className="text-xs text-slate-400 mb-1">Satellites</div>
                <div className="text-white font-mono text-sm">12</div>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                <div className="text-xs text-slate-400 mb-1">Accuracy</div>
                <div className="text-cyan-400 font-mono text-sm">High</div>
              </div>
            </div>
            <div className="mt-4 p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
              <div className="text-xs text-cyan-400 mb-1">Current Location</div>
              <div className="text-white text-sm">New Delhi Railway Station, India</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
