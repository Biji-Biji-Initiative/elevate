// MS Elevate LEAPS API - Usage Examples

import ElevateAPIClient, { 
  APIError, 
  ValidationError,
  AuthenticationError,
  ForbiddenError
} from './sdk.js';

// Initialize the client
const api = new ElevateAPIClient({
  baseUrl: 'https://leaps.mereka.org', // or http://localhost:3000 for development
  token: 'your-clerk-jwt-token'
});

// Example 1: Create a Learn submission
async function createLearnSubmission() {
  try {
    const submission = await api.createSubmission({
      activityCode: 'LEARN',
      payload: {
        provider: 'SPL',
        course: 'AI for Educators',
        completedAt: new Date().toISOString(),
        certificateFile: 'evidence/learn/user123/certificate.pdf'
      },
      visibility: 'PRIVATE'
    });
    
    console.log('Submission created:', submission.data);
    return submission.data;
  } catch (error) {
    if (error instanceof ValidationError) {
      console.error('Validation errors:', error.details);
    } else if (error instanceof AuthenticationError) {
      console.error('Authentication required');
    } else {
      console.error('Submission failed:', error instanceof Error ? error.message : String(error));
    }
  }
}

// Example 2: Upload evidence file
async function uploadEvidence(file: File) {
  try {
    const upload = await api.uploadFile(file, 'EXPLORE');
    console.log('File uploaded:', upload.data);
    
    if (!upload.data?.path) {
      throw new Error('Upload response missing required path property');
    }
    
    return upload.data.path;
  } catch (error) {
    console.error('Upload failed:', error);
    throw error;
  }
}

// Example 3: Get user's dashboard data
async function getUserDashboard() {
  try {
    const dashboard = await api.getDashboard();
    
    if (!dashboard.data) {
      throw new Error('Dashboard response missing data');
    }
    
    console.log('User progress:', dashboard.data.progress);
    console.log('Recent submissions:', dashboard.data.recentSubmissions);
    
    return dashboard.data;
  } catch (error) {
    console.error('Dashboard fetch failed:', error);
    throw error;
  }
}

// Example 4: Get leaderboard with search
async function getTopEducators(searchTerm?: string) {
  try {
    const params: { period: '30d'; limit: number; search?: string } = {
      period: '30d',
      limit: 10,
    };
    
    // Only add search if it has a value
    if (searchTerm && searchTerm.trim()) {
      params.search = searchTerm;
    }
    
    const leaderboard = await api.getLeaderboard(params);
    
    if (!leaderboard.data) {
      throw new Error('Leaderboard response missing data');
    }
    
    console.log('Top educators:', leaderboard.data);
    console.log(`Total participants: ${leaderboard.total}`);
    
    return { data: leaderboard.data, total: leaderboard.total };
  } catch (error) {
    console.error('Leaderboard fetch failed:', error);
    throw error;
  }
}

// Example 5: Admin - Review submissions
async function reviewSubmissions() {
  try {
    const submissions = await api.getAdminSubmissions({
      status: 'PENDING',
      limit: 50
    });
    
    if (!submissions.data?.submissions) {
      throw new Error('Admin submissions response missing data or submissions array');
    }
    
    console.log(`${submissions.data.submissions.length} submissions need review`);
    return submissions.data.submissions;
  } catch (error) {
    if (error instanceof ForbiddenError) {
      console.error('Admin access required');
    } else {
      console.error('Failed to fetch submissions:', error);
    }
    throw error;
  }
}

// Example 6: Complete submission workflow
async function completeExploreSubmission(
  reflectionText: string, 
  evidenceFiles: File[]
) {
  try {
    // Validate input parameters
    if (!reflectionText || reflectionText.trim().length === 0) {
      throw new Error('Reflection text is required');
    }
    
    if (!evidenceFiles || evidenceFiles.length === 0) {
      throw new Error('At least one evidence file is required');
    }
    
    // 1. Upload evidence files
    const uploadedFiles = await Promise.all(
      evidenceFiles.map(file => uploadEvidence(file))
    );
    
    // Filter out any undefined paths
    const validUploadedFiles = uploadedFiles.filter((path): path is string => 
      typeof path === 'string' && path.length > 0
    );
    
    if (validUploadedFiles.length !== evidenceFiles.length) {
      throw new Error('Some file uploads failed');
    }
    
    // 2. Create submission
    const submission = await api.createSubmission({
      activityCode: 'EXPLORE',
      payload: {
        reflection: reflectionText,
        classDate: new Date().toISOString().split('T')[0],
        school: 'SDN 123 Jakarta',
        evidenceFiles: validUploadedFiles
      },
      visibility: 'PUBLIC'
    });
    
    if (!submission.data) {
      throw new Error('Submission response missing data');
    }
    
    console.log('Explore submission completed:', submission.data);
    return submission.data;
  } catch (error) {
    console.error('Submission workflow failed:', error);
    throw error;
  }
}

// Example 7: Error handling patterns
async function handleAPIErrors() {
  try {
    await api.createSubmission({
      activityCode: 'LEARN',
      payload: {
        provider: 'SPL',
        course: '', // This will cause validation error
        completedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    if (error instanceof APIError) {
      switch (error.status) {
        case 400:
          console.error('Bad Request:', error.message);
          // Safe access to optional details property
          if (error.details && Array.isArray(error.details) && error.details.length > 0) {
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

type LeaderboardData = Awaited<ReturnType<typeof api.getLeaderboard>> | null;
type LoadingState = boolean;
type ErrorState = Error | null;

function useLeaderboard(period: '30d' | 'all' = 'all') {
  const [data, setData] = useState<LeaderboardData>(null);
  const [loading, setLoading] = useState<LoadingState>(true);
  const [error, setError] = useState<ErrorState>(null);

  useEffect(() => {
    let isCanceled = false;
    
    api.getLeaderboard({ period })
      .then(response => {
        if (!isCanceled) {
          // Type guard for response validation
          if (response && typeof response === 'object' && 'data' in response) {
            setData(response);
            setError(null);
          } else {
            setError(new Error('Invalid leaderboard response format'));
            setData(null);
          }
        }
      })
      .catch(err => {
        if (!isCanceled) {
          setError(err instanceof Error ? err : new Error('Unknown error occurred'));
          setData(null);
        }
      })
      .finally(() => {
        if (!isCanceled) {
          setLoading(false);
        }
      });
      
    // Cleanup function to prevent state updates after unmount
    return () => {
      isCanceled = true;
    };
  }, [period]);

  return { data, loading, error };
}
*/

// Example 9: Configuration for different environments
export const createApiClient = (environment: 'development' | 'staging' | 'production', token?: string) => {
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
  } as const;

  // Type-safe environment config access
  const config = configs[environment];
  if (!config) {
    throw new Error(`Invalid environment: ${environment}. Must be one of: ${Object.keys(configs).join(', ')}`);
  }

  return new ElevateAPIClient({
    ...config,
    ...(token && { token })
  });
};
