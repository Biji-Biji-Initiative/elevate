'use client';

import { useEffect, useRef } from 'react';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';

export default function DocsPage() {
  const swaggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Custom styles for better integration
      const style = document.createElement('style');
      style.textContent = `
        .swagger-ui {
          font-family: inherit;
        }
        .swagger-ui .topbar {
          display: none;
        }
        .swagger-ui .info {
          margin: 20px 0;
        }
        .swagger-ui .scheme-container {
          background: transparent;
          box-shadow: none;
          padding: 0;
        }
      `;
      document.head.appendChild(style);

      return () => {
        document.head.removeChild(style);
      };
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  MS Elevate LEAPS API Documentation
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                  Complete API reference for the Microsoft Elevate Indonesia program
                </p>
              </div>
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-green-100 text-green-800">
                  v1.0.0
                </span>
              </div>
            </div>
          </div>
          
          <div ref={swaggerRef} className="p-6">
            <SwaggerUI
              url="/api/docs"
              docExpansion="list"
              defaultModelsExpandDepth={1}
              defaultModelExpandDepth={1}
              displayOperationId={false}
              displayRequestDuration={true}
              filter={true}
              showExtensions={false}
              showCommonExtensions={false}
              tryItOutEnabled={true}
              requestInterceptor={(request) => {
                // Add any global request modifications here
                // For example, you could add authentication headers
                return request;
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}