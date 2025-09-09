#!/usr/bin/env node
/**
 * Test script to verify file upload API is working correctly
 * This helps debug the Content-Type error
 */

const fs = require('fs')
const path = require('path')

async function testFileUpload() {
  console.log('🧪 Testing file upload API...')

  // Create a test file
  const testFile = path.join(__dirname, 'test-upload.txt')
  fs.writeFileSync(testFile, 'This is a test file for upload')

  try {
    // Create FormData
    const formData = new FormData()
    const file = new File([fs.readFileSync(testFile)], 'test-upload.txt', {
      type: 'text/plain',
    })
    formData.append('file', file)
    formData.append('activityCode', 'LEARN')

    console.log('📤 Sending request to /api/files/upload...')
    console.log('Content-Type will be set by browser:', 'multipart/form-data')

    const response = await fetch('http://localhost:3000/api/files/upload', {
      method: 'POST',
      body: formData,
      // Don't set Content-Type - let browser set it
    })

    console.log('📊 Response status:', response.status)
    console.log(
      '📊 Response headers:',
      Object.fromEntries(response.headers.entries()),
    )

    if (response.ok) {
      const data = await response.json()
      console.log('✅ Upload successful:', data)
    } else {
      const error = await response.text()
      console.log('❌ Upload failed:', error)
    }
  } catch (error) {
    console.error('💥 Test failed:', error.message)
  } finally {
    // Clean up test file
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile)
    }
  }
}

// Run the test
testFileUpload().catch(console.error)
