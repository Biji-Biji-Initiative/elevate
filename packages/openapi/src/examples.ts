// MS Elevate LEAPS API - Usage Examples

import ElevateAPIClient from './sdk';
import { 
  APIError, 
  ValidationError,
  AuthenticationError,
  ForbiddenError
} from '@elevate/types/errors';

// Initialize the client
const api = new ElevateAPIClient({
  baseUrl: 'https://leaps.mereka.org', // or http://localhost:3000 for development
  token: 'your-clerk-jwt-token'
});

// Example 1: Create a Learn submission
async function _createLearnSubmission() {
  try {
    const submission = await api.createSubmission({
      activityCode: 'LEARN',
      payload: {
        provider: 'SPL',
        courseName: 'AI for Educators',
        completedAt: new Date().toISOString(),
        certificateUrl: 'https://example.com/certificate.pdf'
      },
      visibility: 'PRIVATE'
    });
    
    console.log('Submission created:', submission.data);
  } catch (error: unknown) {
    if (error instanceof ValidationError) {
      console.error('Validation errors:', error.details);
    } else if (error instanceof AuthenticationError) {
      console.error('Authentication required');
    } else if (error instanceof Error) {
      console.error('Submission failed:', error.message);
    } else {
      console.error('Unknown error occurred:', error);
    }
  }
}

// Example 2: Upload evidence file  
async function _uploadEvidence(file: File): Promise<string> {
  try {
    const upload = await api.uploadFile(file, 'EXPLORE');
    console.log('File uploaded:', upload.data);
    return upload.data.path || 'unknown-path';
  } catch (error) {
    console.error('Upload failed:', error);
    throw error;
  }
}

// Example 3: Get user's dashboard data
async function _getUserDashboard() {
  try {
    const dashboard = await api.getDashboard();
    console.log('User progress:', dashboard.data.progress);
    console.log('Recent submissions:', dashboard.data.recentSubmissions);
  } catch (error) {
    console.error('Dashboard fetch failed:', error);
  }
}

// Example 4: Get leaderboard with search
async function _getTopEducators(searchTerm?: string) {
  try {
    const leaderboard = await api.getLeaderboard({
      period: '30d',
      limit: 10,
      ...(searchTerm && { search: searchTerm })
    });
    
    console.log('Top educators:', leaderboard.data);
    console.log(`Total participants: ${leaderboard.total}`);
  } catch (error) {
    console.error('Leaderboard fetch failed:', error);
  }
}

// Example 5: Admin - Review submissions
async function _reviewSubmissions() {
  try {
    const submissions = await api.getAdminSubmissions({
      status: 'PENDING',
      limit: 50
    });
    
    console.log(`${submissions.data.submissions.length} submissions need review`);
    return submissions.data;
  } catch (error) {
    if (error instanceof ForbiddenError) {
      console.error('Admin access required');
      return [];
    } else {
      console.error('Failed to fetch submissions:', error);
      return [];
    }
  }
}

// Example 6: Complete submission workflow
async function _completeExploreSubmission(
  reflectionText: string, 
  evidenceFiles: File[]
) {
  try {
    // 1. Upload evidence files
    const uploadedFiles = await Promise.all(
      evidenceFiles.map(file => _uploadEvidence(file))
    );
    
    // 2. Create submission
    const submission = await api.createSubmission({
      activityCode: 'EXPLORE',
      payload: {
        reflection: reflectionText,
        classDate: new Date().toISOString().split('T')[0] as string,
        school: 'SDN 123 Jakarta',
        evidenceFiles: uploadedFiles
      },
      visibility: 'PUBLIC'
    });
    
    console.log('Explore submission completed:', submission.data);
    return submission.data;
  } catch (error) {
    console.error('Submission workflow failed:', error);
    throw error;
  }
}

// Example 7: Error handling patterns
async function _handleAPIErrors() {
  try {
    await api.createSubmission({
      activityCode: 'LEARN',
      payload: {
        provider: 'SPL',
        courseName: '', // This will cause validation error
        completedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    if (error instanceof APIError) {
      switch (error.status) {
        case 400:
          console.error('Bad Request:', error.message);
          if (error.details) {
            console.error('Validation details:', error.details);
          }
          break;
        case 401:
          console.error('Authentication required');
          // Redirect to login or refresh token
          break;
        case 403:
          console.error('Access forbidden');
          break;
        case 429:
          console.error('Rate limit exceeded, try again later');
          break;
        default:
          console.error('API Error:', error.message);
      }
    } else {
      console.error('Network or unknown error:', error);
    }
  }
}

// Example 8: Using with React hooks
/*
import { useState, useEffect } from 'react';

function useLeaderboard(period: '30d' | 'all' = 'all') {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getLeaderboard({ period })
      .then(response => {
        setData(response);
        setError(null);
      })
      .catch(err => {
        setError(err);
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [period]);

  return { data, loading, error };
}
*/

// Example 9: Configuration for different environments
export const createApiClient = (environment: 'development' | 'staging' | 'production') => {
  const configs = {
    development: {
      baseUrl: 'http://localhost:3000',
    },
    staging: {
      baseUrl: 'https://leaps-staging.mereka.org',
    },
    production: {
      baseUrl: 'https://leaps.mereka.org',
    }
  };

  return new ElevateAPIClient(configs[environment]);
};
