import { useState, useEffect } from 'react';
import { LayoutDashboard, Activity, TrendingUp, AlertCircle, MapPin, Gauge, Users, Settings, Bell, Radio, ChevronRight, BarChart3 } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

// Mock data
const sensorData = Array.from({ length: 24 }, (_, i) => ({
  time: `${i}:00`,
  value: Math.random() * 4 + 1,
}));

const systemHealth = [
  { name: 'Operational', value: 142, color: '#22c55e' },
  { name: 'Warning', value: 12, color: '#eab308' },
  { name: 'Critical', value: 2, color: '#ef4444' },
];

export function Template2Dashboard() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-slate-900 p-2 rounded-lg">
                <LayoutDashboard className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Railway Monitoring System</h1>
                <p className="text-sm text-slate-600">Executive Management Dashboard</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <div className="text-slate-900 font-semibold">{currentTime.toLocaleTimeString()}</div>
                <div className="text-sm text-slate-600">{currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-50 border border-green-200">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium text-green-700">System Online</span>
              </div>
              <button className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                <Bell className="w-5 h-5 text-slate-600" />
              </button>
              <button className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                <Settings className="w-5 h-5 text-slate-600" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="p-8">
        {/* Key Performance Indicators */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          <div className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-blue-100 p-3 rounded-lg">
                <Activity className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-1">98.7%</div>
            <div className="text-sm text-slate-600 mb-2">System Uptime</div>
            <div className="flex items-center gap-1 text-xs text-green-600">
              <TrendingUp className="w-3 h-3" />
              <span>+2.3% from last month</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-purple-100 p-3 rounded-lg">
                <Gauge className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-1">156</div>
            <div className="text-sm text-slate-600 mb-2">Active Sensors</div>
            <div className="flex items-center gap-1 text-xs text-green-600">
              <TrendingUp className="w-3 h-3" />
              <span>+4 new sensors</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-orange-100 p-3 rounded-lg">
                <AlertCircle className="w-6 h-6 text-orange-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-1">3</div>
            <div className="text-sm text-slate-600 mb-2">Active Alerts</div>
            <div className="flex items-center gap-1 text-xs text-orange-600">
              <span>2 require attention</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-green-100 p-3 rounded-lg">
                <Users className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-1">47</div>
            <div className="text-sm text-slate-600 mb-2">Total Operators</div>
            <div className="flex items-center gap-1 text-xs text-green-600">
              <span>24 currently active</span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          {/* Sensor Performance */}
          <div className="col-span-2 bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">24-Hour Sensor Performance</h3>
                <p className="text-sm text-slate-600">Average readings across all sensors</p>
              </div>
              <button className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                View Details
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={sensorData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="time" stroke="#64748b" style={{ fontSize: '12px' }} />
                <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                  labelStyle={{ color: '#0f172a' }}
                />
                <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* System Health */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-6">System Health</h3>
            <div className="flex items-center justify-center mb-6">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={systemHealth}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {systemHealth.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              {systemHealth.map((item) => (
                <div key={item.name} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="text-sm font-medium text-slate-700">{item.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-900">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* GPS and Statistics */}
        <div className="grid grid-cols-2 gap-6">
          {/* GPS Information */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-blue-100 p-2 rounded-lg">
                <MapPin className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Current Location Data</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-xs text-slate-600 mb-1 uppercase tracking-wide">Latitude</div>
                <div className="text-slate-900 font-mono font-semibold">28.613567° N</div>
              </div>
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-xs text-slate-600 mb-1 uppercase tracking-wide">Longitude</div>
                <div className="text-slate-900 font-mono font-semibold">77.209967° E</div>
              </div>
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-xs text-slate-600 mb-1 uppercase tracking-wide">Speed</div>
                <div className="text-slate-900 font-mono font-semibold">95.1 km/h</div>
              </div>
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-xs text-slate-600 mb-1 uppercase tracking-wide">Altitude</div>
                <div className="text-slate-900 font-mono font-semibold">216 m</div>
              </div>
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-xs text-slate-600 mb-1 uppercase tracking-wide">Satellites</div>
                <div className="text-slate-900 font-mono font-semibold">12 Connected</div>
              </div>
              <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                <div className="text-xs text-green-700 mb-1 uppercase tracking-wide">GPS Status</div>
                <div className="text-green-900 font-semibold">Active</div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-6">Recent System Events</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-900">System Health Check Passed</div>
                  <div className="text-xs text-slate-600">All sensors operating normally</div>
                  <div className="text-xs text-slate-500 mt-1">2 minutes ago</div>
                </div>
              </div>
              <div className="flex items-start gap-4 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-900">New Operator Login</div>
                  <div className="text-xs text-slate-600">Operator ID: OP-2847</div>
                  <div className="text-xs text-slate-500 mt-1">15 minutes ago</div>
                </div>
              </div>
              <div className="flex items-start gap-4 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-900">Sensor Calibration Due</div>
                  <div className="text-xs text-slate-600">3 sensors require calibration</div>
                  <div className="text-xs text-slate-500 mt-1">1 hour ago</div>
                </div>
              </div>
              <div className="flex items-start gap-4 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-900">Data Backup Completed</div>
                  <div className="text-xs text-slate-600">All systems backed up successfully</div>
                  <div className="text-xs text-slate-500 mt-1">2 hours ago</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}