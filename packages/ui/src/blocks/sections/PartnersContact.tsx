'use client'

import React from 'react'

export interface ContactInfo {
  email: string
  phone?: string
  name?: string
}

export interface PartnersContactProps {
  partners: string[] // Partner names for now, can be enhanced to include logos later
  contacts: ContactInfo[]
  className?: string
}

export function PartnersContact({
  partners,
  contacts,
  className = '',
}: PartnersContactProps) {
  return (
    <section className={`py-16 bg-gray-50 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Partners */}
        <div className="text-center mb-12">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">
            Program Partners
          </h3>
          <div className="flex flex-wrap justify-center items-center gap-8">
            {partners.map((partner) => (
              <div key={partner} className="text-gray-600 font-medium text-lg">
                {partner}
              </div>
            ))}
          </div>
        </div>

        {/* Contact Information */}
        <div className="border-t border-gray-200 pt-12">
          <div className="text-center mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Contact Information
            </h3>
            <p className="text-gray-600">Get in touch with the program team</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {contacts.map((contact) => (
              <div key={contact.email} className="text-center">
                {contact.name && (
                  <div className="font-medium text-gray-900 mb-2">
                    {contact.name}
                  </div>
                )}
                <div className="space-y-1">
                  <div>
                    <a
                      href={`mailto:${contact.email}`}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      {contact.email}
                    </a>
                  </div>
                  {contact.phone && (
                    <div>
                      <a
                        href={`tel:${contact.phone}`}
                        className="text-gray-600 hover:text-gray-800"
                      >
                        {contact.phone}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
