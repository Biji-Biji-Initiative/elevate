'use client'

import React from 'react'

export interface ProgramFlowProps {
  title: string
  bullets: string[]
  className?: string
}

export function ProgramFlow({
  title,
  bullets,
  className = '',
}: ProgramFlowProps) {
  return (
    <section className={`py-16 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">{title}</h2>
        </div>

        <div className="max-w-4xl mx-auto">
          {/* Flow Steps */}
          <div className="space-y-8">
            {bullets.map((bullet, index) => (
              <div key={bullet} className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold text-sm">
                    {index + 1}
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-lg text-gray-700 leading-relaxed">
                    {bullet}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Flow Diagram (Optional visual enhancement) */}
          <div className="mt-12 text-center">
            <div className="inline-flex items-center space-x-4 text-sm text-gray-500">
              <span className="px-3 py-1 bg-gray-100 rounded-full">MOE</span>
              <span>→</span>
              <span className="px-3 py-1 bg-gray-100 rounded-full">
                Schools
              </span>
              <span>→</span>
              <span className="px-3 py-1 bg-gray-100 rounded-full">
                Registration
              </span>
              <span>→</span>
              <span className="px-3 py-1 bg-gray-100 rounded-full">TOT</span>
              <span>→</span>
              <span className="px-3 py-1 bg-gray-100 rounded-full">LEAPS</span>
              <span>→</span>
              <span className="px-3 py-1 bg-gray-100 rounded-full">
                Convening
              </span>
            </div>
          </div>

          {/* Accessible description */}
          <div className="sr-only">
            Flow from MOE to Schools to Registration to Train-the-Trainer to
            LEAPS to Educators Convening.
          </div>
        </div>
      </div>
    </section>
  )
}
