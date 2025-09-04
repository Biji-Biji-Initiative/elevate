'use client'

import React from 'react'

import { Badge } from '../../components/ui/badge'

export interface FAQItem {
  id: string
  question: string
  answer: string
  status: 'confirmed' | 'pending'
  owner?: string
  date?: string
}

export interface FAQListProps {
  items: FAQItem[]
  footerNote?: string
  className?: string
}

export function FAQList({ items, footerNote, className = '' }: FAQListProps) {
  return (
    <section className={`py-16 bg-white ${className}`}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="space-y-6">
          {items.map((item) => (
            <div
              key={item.id}
              className="border border-gray-200 rounded-lg p-6"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900 pr-4">
                  {item.question}
                </h3>
                <div className="flex-shrink-0">
                  <Badge
                    variant={
                      item.status === 'confirmed' ? 'default' : 'secondary'
                    }
                    className={
                      item.status === 'confirmed'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }
                  >
                    {item.status === 'confirmed'
                      ? 'Confirmed'
                      : 'Pending Confirmation'}
                  </Badge>
                </div>
              </div>

              <p className="text-gray-600 leading-relaxed mb-3">
                {item.answer}
              </p>

              {(item.owner || item.date) && (
                <div className="text-sm text-gray-500">
                  {item.owner && <span>Owner: {item.owner}</span>}
                  {item.owner && item.date && <span className="mx-2">•</span>}
                  {item.date && <span>{item.date}</span>}
                </div>
              )}
            </div>
          ))}
        </div>

        {footerNote && (
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500 italic">{footerNote}</p>
          </div>
        )}
      </div>
    </section>
  )
}
