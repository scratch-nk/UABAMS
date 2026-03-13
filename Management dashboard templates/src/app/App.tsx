import { useState } from 'react';
import { Template1Dashboard } from './components/Template1Dashboard';
import { Template2Dashboard } from './components/Template2Dashboard';
import { Template3Dashboard } from './components/Template3Dashboard';
import { Sparkles, Building2, BarChart3, X } from 'lucide-react';

export default function App() {
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);

  if (selectedTemplate !== null) {
    return (
      <div className="relative">
        <button
          onClick={() => setSelectedTemplate(null)}
          className="fixed top-4 left-4 z-50 flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-lg text-white hover:bg-white/20 transition-colors shadow-lg"
        >
          <X className="w-4 h-4" />
          <span className="text-sm font-medium">View All Templates</span>
        </button>
        {selectedTemplate === 1 && <Template1Dashboard />}
        {selectedTemplate === 2 && <Template2Dashboard />}
        {selectedTemplate === 3 && <Template3Dashboard />}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-8 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-white mb-4">
            Management Dashboard Templates
          </h1>
          <p className="text-xl text-purple-300">
            Choose from 3 production-ready dashboard designs for Railway Monitoring System
          </p>
          <p className="text-sm text-purple-400 mt-2">
            Senior Management Edition • Professional & Interactive
          </p>
        </div>

        {/* Template Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {/* Template 1 - Modern Gradient */}
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity"></div>
            <div className="relative bg-slate-900/90 backdrop-blur-xl border border-purple-500/30 rounded-2xl p-8 hover:border-purple-500/60 transition-all">
              <div className="mb-6">
                <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-3 rounded-xl w-fit mb-4">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Modern Gradient</h3>
                <p className="text-purple-300 text-sm">
                  Sleek glassmorphism design with vibrant gradients and modern aesthetics
                </p>
              </div>

              <div className="space-y-3 mb-8">
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <div className="w-1.5 h-1.5 bg-purple-400 rounded-full"></div>
                  Glassmorphism UI elements
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <div className="w-1.5 h-1.5 bg-pink-400 rounded-full"></div>
                  Gradient backgrounds & cards
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <div className="w-1.5 h-1.5 bg-purple-400 rounded-full"></div>
                  Real-time data visualization
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <div className="w-1.5 h-1.5 bg-pink-400 rounded-full"></div>
                  Animated status indicators
                </div>
              </div>

              <button
                onClick={() => setSelectedTemplate(1)}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 rounded-lg font-semibold hover:from-purple-600 hover:to-pink-600 transition-all transform hover:scale-105"
              >
                Preview Template
              </button>
            </div>
          </div>

          {/* Template 2 - Professional Clean */}
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity"></div>
            <div className="relative bg-slate-900/90 backdrop-blur-xl border border-blue-500/30 rounded-2xl p-8 hover:border-blue-500/60 transition-all">
              <div className="mb-6">
                <div className="bg-gradient-to-br from-blue-500 to-cyan-500 p-3 rounded-xl w-fit mb-4">
                  <Building2 className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Professional Clean</h3>
                <p className="text-blue-300 text-sm">
                  Corporate-friendly design with clean lines and professional aesthetics
                </p>
              </div>

              <div className="space-y-3 mb-8">
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                  Clean, minimal interface
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full"></div>
                  Business-ready components
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                  Organized data hierarchy
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full"></div>
                  Activity timeline view
                </div>
              </div>

              <button
                onClick={() => setSelectedTemplate(2)}
                className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white py-3 rounded-lg font-semibold hover:from-blue-600 hover:to-cyan-600 transition-all transform hover:scale-105"
              >
                Preview Template
              </button>
            </div>
          </div>

          {/* Template 3 - Data-Focused Analytics */}
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-emerald-500 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity"></div>
            <div className="relative bg-slate-900/90 backdrop-blur-xl border border-cyan-500/30 rounded-2xl p-8 hover:border-cyan-500/60 transition-all">
              <div className="mb-6">
                <div className="bg-gradient-to-br from-cyan-500 to-emerald-500 p-3 rounded-xl w-fit mb-4">
                  <BarChart3 className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Analytics Focused</h3>
                <p className="text-cyan-300 text-sm">
                  Data-centric design with advanced analytics and comprehensive metrics
                </p>
              </div>

              <div className="space-y-3 mb-8">
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full"></div>
                  Advanced data visualization
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></div>
                  Multi-metric dashboard
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full"></div>
                  Radar performance charts
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></div>
                  Tabbed navigation system
                </div>
              </div>

              <button
                onClick={() => setSelectedTemplate(3)}
                className="w-full bg-gradient-to-r from-cyan-500 to-emerald-500 text-white py-3 rounded-lg font-semibold hover:from-cyan-600 hover:to-emerald-600 transition-all transform hover:scale-105"
              >
                Preview Template
              </button>
            </div>
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="mt-16 max-w-4xl mx-auto">
          <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-8">
            <h3 className="text-2xl font-bold text-white mb-6 text-center">
              All Templates Include
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="bg-purple-500/20 w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">📊</span>
                </div>
                <div className="text-sm text-white font-medium mb-1">Live Charts</div>
                <div className="text-xs text-purple-300">Real-time data</div>
              </div>
              <div className="text-center">
                <div className="bg-blue-500/20 w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">🎨</span>
                </div>
                <div className="text-sm text-white font-medium mb-1">Modern UI</div>
                <div className="text-xs text-blue-300">Professional design</div>
              </div>
              <div className="text-center">
                <div className="bg-green-500/20 w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">📡</span>
                </div>
                <div className="text-sm text-white font-medium mb-1">GPS Tracking</div>
                <div className="text-xs text-green-300">Location data</div>
              </div>
              <div className="text-center">
                <div className="bg-orange-500/20 w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">⚡</span>
                </div>
                <div className="text-sm text-white font-medium mb-1">Fast & Responsive</div>
                <div className="text-xs text-orange-300">Optimized</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
