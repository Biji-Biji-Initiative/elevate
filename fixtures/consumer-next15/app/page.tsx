'use client'

import React from 'react'

import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Input,
  Label,
  FileUpload,
  LoadingSpinner,
  StatusBadge
} from '@elevate/ui'

export default function ConsumerPage() {
  const [files, setFiles] = React.useState<File[]>([])
  const [loading, setLoading] = React.useState(false)

  const handleFileSelect = (newFiles: File[]) => {
    setFiles(newFiles)
  }

  const toggleLoading = () => {
    setLoading(!loading)
  }

  return (
    <div className="container mx-auto p-8 space-y-8">
      <h1 className="text-4xl font-bold text-center">
        @elevate/ui Consumer Test
      </h1>
      
      <div className="grid gap-6">
        {/* Basic Components */}
        <Card>
          <CardHeader>
            <CardTitle>Basic UI Components</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Button>Primary Button</Button>
              <Button variant="secondary">Secondary Button</Button>
              <Button variant="outline">Outline Button</Button>
            </div>
            
            <div className="flex gap-2">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="destructive">Destructive</Badge>
            </div>
            
            <div className="space-y-2 max-w-sm">
              <Label htmlFor="test-input">Test Input</Label>
              <Input id="test-input" placeholder="Type something..." />
            </div>
          </CardContent>
        </Card>

        {/* Loading Components */}
        <Card>
          <CardHeader>
            <CardTitle>Loading Components</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={toggleLoading}>
              {loading ? 'Stop' : 'Start'} Loading
            </Button>
            {loading && <LoadingSpinner />}
          </CardContent>
        </Card>

        {/* File Upload Component */}
        <Card>
          <CardHeader>
            <CardTitle>File Upload Component</CardTitle>
          </CardHeader>
          <CardContent>
            <FileUpload
              onFileSelect={handleFileSelect}
              accept="image/*,.pdf"
              maxSizeBytes={10 * 1024 * 1024} // 10MB
            />
            {files.length > 0 && (
              <div className="mt-2 text-sm text-gray-600">
                {files.map((file, index) => (
                  <p key={index}>
                    Selected: {file.name} ({Math.round(file.size / 1024)}KB)
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status Components */}
        <Card>
          <CardHeader>
            <CardTitle>Status Components</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <StatusBadge status="approved" />
              <StatusBadge status="pending" />
              <StatusBadge status="rejected" />
            </div>
            
            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold">Learn Stage Card</h4>
              <p className="text-sm text-gray-600">Complete learning modules</p>
              <p className="text-sm font-medium">Points: 20 | Status: Completed</p>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="text-center text-sm text-gray-500">
        This page successfully imports and renders components from @elevate/ui
      </div>
    </div>
  )
}