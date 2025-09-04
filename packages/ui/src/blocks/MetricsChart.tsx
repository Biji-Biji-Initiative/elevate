'use client'

import React from 'react'

export interface MetricsChartProps {
  title: string
  data: Array<{
    label: string
    value: number
    color?: string
  }>
  type?: 'bar' | 'pie' | 'donut' | 'line'
  height?: number
}

export function MetricsChart({ title, data, type = 'bar', height = 200 }: MetricsChartProps) {
  const maxValue = Math.max(...data.map(d => d.value))
  
  if (type === 'bar') {
    return (
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <div className="space-y-3" style={{ height: `${height}px` }}>
          {data.map((item, _index) => (
            <div key={item.label} className="flex items-center space-x-3">
              <div className="w-20 text-sm text-gray-600 truncate">{item.label}</div>
              <div className="flex-1 relative">
                <div className="w-full bg-gray-200 rounded-full h-6">
                  <div
                    className={`h-6 rounded-full transition-all duration-500 ${
                      item.color || 'bg-blue-500'
                    }`}
                    style={{ width: `${(item.value / maxValue) * 100}%` }}
                  />
                </div>
                <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white">
                  {item.value}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }
  
  if (type === 'donut') {
    const total = data.reduce((sum, item) => sum + item.value, 0)
    let cumulativePercentage = 0
    
    return (
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <div className="flex items-center justify-center" style={{ height: `${height}px` }}>
          <div className="relative w-40 h-40">
            <svg className="w-40 h-40 transform -rotate-90" viewBox="0 0 42 42">
              <circle
                cx="21"
                cy="21"
                r="15.915"
                fill="transparent"
                stroke="#e5e7eb"
                strokeWidth="3"
              />
              {data.map((item, index) => {
                const percentage = (item.value / total) * 100
                const offset = 100 - cumulativePercentage
                const strokeDasharray = `${percentage} ${100 - percentage}`
                const color = item.color || `hsl(${(index * 137.5) % 360}, 70%, 50%)`
                
                const element = (
                  <circle
                    key={item.label}
                    cx="21"
                    cy="21"
                    r="15.915"
                    fill="transparent"
                    stroke={color}
                    strokeWidth="3"
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                  />
                )
                
                cumulativePercentage += percentage
                return element
              })}
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{total}</div>
                <div className="text-xs text-gray-600">Total</div>
              </div>
            </div>
          </div>
          
          <div className="ml-6 space-y-2">
            {data.map((item, index) => (
              <div key={item.label} className="flex items-center space-x-2">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color || `hsl(${(index * 137.5) % 360}, 70%, 50%)` }}
                />
                <span className="text-sm text-gray-600">{item.label}</span>
                <span className="text-sm font-medium text-gray-900">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }
  
  // Default to simple stats cards
  return (
    <div className="bg-white rounded-lg border p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {data.map((item, _index) => (
          <div key={item.label} className="text-center">
            <div className="text-2xl font-bold text-blue-600">{item.value.toLocaleString()}</div>
            <div className="text-sm text-gray-600">{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function StatsGrid({ 
  stats 
}: { 
  stats: Array<{
    label: string
    value: number | string
    change?: number
    color?: string
    icon?: string
  }> 
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat, _index) => (
        <div key={stat.label} className="bg-white rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{stat.label}</p>
              <p className={`text-2xl font-bold ${stat.color || 'text-gray-900'}`}>
                {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
              </p>
              {stat.change !== undefined && (
                <p className={`text-sm ${stat.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {stat.change >= 0 ? '+' : ''}{stat.change}%
                </p>
              )}
            </div>
            {stat.icon && (
              <div className="text-2xl">{stat.icon}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}