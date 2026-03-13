import { useState, useEffect } from 'react';
import { LayoutDashboard, Activity, TrendingUp, AlertTriangle, MapPin, Satellite, Users, Settings, Bell, Radio } from 'lucide-react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Mock data for charts
const accelerometerData = Array.from({ length: 20 }, (_, i) => ({
  time: `${i}s`,
  accel1: Math.random() * 5 + 1,
  accel2: Math.random() * 5 + 1,
}));

const performanceData = Array.from({ length: 7 }, (_, i) => ({
  day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
  value: Math.floor(Math.random() * 50) + 50,
}));

export function Template1Dashboard() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950">
      {/* Header */}
      <header className="bg-black/30 backdrop-blur-lg border-b border-white/10">
        <div className="px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-2 rounded-lg">
                <LayoutDashboard className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Railway Monitoring System</h1>
                <p className="text-sm text-purple-300">Management Dashboard</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <div className="text-white font-medium">{currentTime.toLocaleTimeString()}</div>
                <div className="text-sm text-purple-300">{currentTime.toLocaleDateString()}</div>
              </div>
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${isConnected ? 'bg-green-500/20 border border-green-500/50' : 'bg-red-500/20 border border-red-500/50'}`}>
                <Radio className={`w-4 h-4 ${isConnected ? 'text-green-400' : 'text-red-400'}`} />
                <span className={`text-sm font-medium ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
                  {isConnected ? 'Live' : 'Disconnected'}
                </span>
              </div>
              <button className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                <Bell className="w-5 h-5 text-white" />
              </button>
              <button className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                <Settings className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="p-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-sm border border-purple-500/30 rounded-2xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="bg-purple-500/20 p-3 rounded-xl">
                <Activity className="w-6 h-6 text-purple-400" />
              </div>
              <div className="bg-green-500/20 px-3 py-1 rounded-full">
                <span className="text-xs font-semibold text-green-400">+12%</span>
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-1">98.5%</div>
            <div className="text-sm text-purple-300">System Uptime</div>
          </div>

          <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 backdrop-blur-sm border border-blue-500/30 rounded-2xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="bg-blue-500/20 p-3 rounded-xl">
                <TrendingUp className="w-6 h-6 text-blue-400" />
              </div>
              <div className="bg-green-500/20 px-3 py-1 rounded-full">
                <span className="text-xs font-semibold text-green-400">+8%</span>
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-1">156</div>
            <div className="text-sm text-blue-300">Active Sensors</div>
          </div>

          <div className="bg-gradient-to-br from-orange-500/20 to-red-500/20 backdrop-blur-sm border border-orange-500/30 rounded-2xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="bg-orange-500/20 p-3 rounded-xl">
                <AlertTriangle className="w-6 h-6 text-orange-400" />
              </div>
              <div className="bg-yellow-500/20 px-3 py-1 rounded-full">
                <span className="text-xs font-semibold text-yellow-400">3 New</span>
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-1">2</div>
            <div className="text-sm text-orange-300">Active Alerts</div>
          </div>

          <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 backdrop-blur-sm border border-green-500/30 rounded-2xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="bg-green-500/20 p-3 rounded-xl">
                <Users className="w-6 h-6 text-green-400" />
              </div>
              <div className="bg-blue-500/20 px-3 py-1 rounded-full">
                <span className="text-xs font-semibold text-blue-400">24 Online</span>
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-1">47</div>
            <div className="text-sm text-green-300">Total Operators</div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          {/* Live Accelerometer Readings */}
          <div className="col-span-2 bg-black/30 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">Live Accelerometer Readings</h3>
                <p className="text-sm text-purple-300">Real-time sensor data</p>
              </div>
              <div className="flex items-center gap-2 bg-green-500/20 px-3 py-1 rounded-full">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-xs font-medium text-green-400">Live • Updating every 2s</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={accelerometerData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                <XAxis dataKey="time" stroke="#ffffff60" />
                <YAxis stroke="#ffffff60" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #ffffff20', borderRadius: '8px' }}
                  labelStyle={{ color: '#ffffff' }}
                />
                <Line type="monotone" dataKey="accel1" stroke="#ec4899" strokeWidth={2} dot={false} name="Accelerometer 1" />
                <Line type="monotone" dataKey="accel2" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Accelerometer 2" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* GPS Values */}
          <div className="bg-black/30 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-blue-500/20 p-2 rounded-lg">
                <MapPin className="w-5 h-5 text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">GPS Location</h3>
            </div>
            <div className="space-y-4">
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <div className="text-xs text-purple-300 mb-1">Latitude</div>
                <div className="text-white font-mono">28.613567° N</div>
              </div>
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <div className="text-xs text-purple-300 mb-1">Longitude</div>
                <div className="text-white font-mono">77.209967° E</div>
              </div>
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <div className="text-xs text-purple-300 mb-1">Speed</div>
                <div className="text-white font-mono">95.1 km/h</div>
              </div>
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <div className="text-xs text-purple-300 mb-1">Altitude</div>
                <div className="text-white font-mono">216 m</div>
              </div>
              <div className="bg-white/5 rounded-xl p-4 border border-white/10 flex items-center justify-between">
                <div>
                  <div className="text-xs text-purple-300 mb-1">Satellites</div>
                  <div className="text-white font-mono">12</div>
                </div>
                <Satellite className="w-6 h-6 text-purple-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Performance Overview */}
        <div className="bg-black/30 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Weekly Performance Overview</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={performanceData}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
              <XAxis dataKey="day" stroke="#ffffff60" />
              <YAxis stroke="#ffffff60" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #ffffff20', borderRadius: '8px' }}
                labelStyle={{ color: '#ffffff' }}
              />
              <Area type="monotone" dataKey="value" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorValue)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
