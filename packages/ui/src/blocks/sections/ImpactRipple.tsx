'use client'

import React from 'react'

export interface ImpactRippleProps {
  title: string
  description: string
  className?: string
}

export function ImpactRipple({
  title,
  description,
  className = '',
}: ImpactRippleProps) {
  return (
    <section className={`py-16 bg-gray-50 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">{title}</h2>

          {/* Ripple Diagram */}
          <div className="relative max-w-4xl mx-auto mb-8">
            <div className="flex flex-col md:flex-row items-center justify-center space-y-8 md:space-y-0 md:space-x-8">
              {/* Concentric circles representing the ripple effect */}
              <div className="relative">
                <div className="w-32 h-32 rounded-full bg-blue-100 flex items-center justify-center border-4 border-blue-300">
                  <div className="text-center">
                    <div className="text-lg font-bold text-blue-800">150</div>
                    <div className="text-xs text-blue-600">Master Trainers</div>
                  </div>
                </div>
              </div>

              <div className="flex items-center">
                <div className="hidden md:block w-8 h-0.5 bg-gray-300"></div>
                <div className="md:hidden w-0.5 h-8 bg-gray-300"></div>
              </div>

              <div className="relative">
                <div className="w-40 h-40 rounded-full bg-green-100 flex items-center justify-center border-4 border-green-300">
                  <div className="text-center">
                    <div className="text-xl font-bold text-green-800">
                      15,000
                    </div>
                    <div className="text-xs text-green-600">Educators</div>
                  </div>
                </div>
              </div>

              <div className="flex items-center">
                <div className="hidden md:block w-8 h-0.5 bg-gray-300"></div>
                <div className="md:hidden w-0.5 h-8 bg-gray-300"></div>
              </div>

              <div className="relative">
                <div className="w-48 h-48 rounded-full bg-purple-100 flex items-center justify-center border-4 border-purple-300">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-800">
                      150,000
                    </div>
                    <div className="text-xs text-purple-600">
                      Peers & Students
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p className="text-lg text-gray-600 max-w-3xl mx-auto leading-relaxed">
            {description}
          </p>

          {/* Accessible text for screen readers */}
          <div className="sr-only">
            Concentric ripple diagram showing scale from 150 Master Trainers to
            15,000 Educators to 150,000 peers and students, leading to 25,000
            micro-credentials and 5,000 MCE certified.
          </div>
        </div>
      </div>
    </section>
  )
}
