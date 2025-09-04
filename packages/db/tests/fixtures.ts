/**
 * Test data generators and fixtures for database testing
 * Provides consistent, realistic test data for all models
 */

import { PrismaClient, Role, SubmissionStatus, Visibility, LedgerSource } from '@prisma/client';
import { randomBytes } from 'crypto';
import type { ActivityPayload } from '@elevate/types';

// Types for test data
export interface TestUser {
  id: string;
  handle: string;
  name: string;
  email: string;
  role: Role;
  school?: string;
  cohort?: string;
  kajabi_contact_id?: string;
}

export interface TestSubmission {
  id?: string;
  user_id: string;
  activity_code: string;
  status: SubmissionStatus;
  visibility: Visibility;
  payload: ActivityPayload;
  attachments_rel?: Array<{ id: string; submission_id: string; path: string }>;
  reviewer_id?: string;
  review_note?: string;
}

export interface TestPointsEntry {
  id?: string;
  user_id: string;
  activity_code: string;
  source: LedgerSource;
  delta_points: number;
  external_source?: string;
  external_event_id?: string;
}

// Fixture data generators
export class DatabaseFixtures {
  private prisma: PrismaClient;
  private userCounter = 0;
  private submissionCounter = 0;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Generate a test user with realistic data
   */
  generateUser(overrides: Partial<TestUser> = {}): TestUser {
    this.userCounter++;
    const id = overrides.id || `test-user-${this.userCounter}-${randomBytes(4).toString('hex')}`;
    
    return {
      id,
      handle: `testuser${this.userCounter}`,
      name: `Test User ${this.userCounter}`,
      email: `testuser${this.userCounter}@example.com`,
      role: Role.PARTICIPANT,
      school: `Test School ${this.userCounter}`,
      cohort: `Cohort ${Math.ceil(this.userCounter / 10)}`,
      kajabi_contact_id: `kajabi-${randomBytes(6).toString('hex')}`,
      ...overrides,
    };
  }

  /**
   * Generate a test submission with realistic payload data
   */
  generateSubmission(overrides: Partial<TestSubmission> = {}): TestSubmission {
    this.submissionCounter++;
    
    const activityCode = overrides.activity_code || 'LEARN';
    const payload = this.generatePayloadForActivity(activityCode);
    
    return {
      id: `test-submission-${this.submissionCounter}-${randomBytes(4).toString('hex')}`,
      user_id: overrides.user_id || 'test-user-1',
      activity_code: activityCode,
      status: SubmissionStatus.PENDING,
      visibility: Visibility.PRIVATE,
      payload,
      attachments_rel: [{ id: `att-${randomBytes(4).toString('hex')}`, submission_id: 'sub', path: `/uploads/test-file-${this.submissionCounter}.pdf` }],
      reviewer_id: null,
      review_note: null,
      ...overrides,
    };
  }

  /**
   * Generate realistic payload data based on activity type
   */
  generatePayloadForActivity(activityCode: string): ActivityPayload {
    switch (activityCode) {
      case 'LEARN':
        return {
          certificate_url: `/uploads/certificate-${randomBytes(4).toString('hex')}.pdf`,
          course_name: 'AI in Education Fundamentals',
          completion_date: new Date().toISOString(),
          hash: randomBytes(32).toString('hex'),
        };

      case 'EXPLORE':
        return {
          title: `AI Implementation in ${['Mathematics', 'Science', 'English', 'History'][Math.floor(Math.random() * 4)]}`,
          description: 'Implemented AI tools to enhance student engagement and learning outcomes.',
          ai_tools_used: ['ChatGPT', 'Canva AI', 'Grammarly'],
          student_count: Math.floor(Math.random() * 50) + 10,
          reflection: 'Students showed increased engagement and improved understanding of complex concepts.',
        };

      case 'AMPLIFY':
        return {
          training_type: 'peer_training',
          peer_count: Math.floor(Math.random() * 20) + 5,
          student_count: Math.floor(Math.random() * 100) + 25,
          training_topic: 'Integrating AI Tools in Lesson Planning',
          evidence_type: 'attendance_list',
          impact_description: 'Trained colleagues on effective AI integration strategies.',
        };

      case 'PRESENT':
        return {
          linkedin_url: `https://linkedin.com/posts/testuser-${randomBytes(4).toString('hex')}`,
          post_content: 'Excited to share my journey with AI in education! #MSElevate #AIEducation',
          screenshot_url: `/uploads/linkedin-screenshot-${randomBytes(4).toString('hex')}.png`,
          engagement_metrics: {
            likes: Math.floor(Math.random() * 100),
            comments: Math.floor(Math.random() * 20),
            shares: Math.floor(Math.random() * 10),
          },
        };

      case 'SHINE':
        return {
          idea_title: 'AI-Powered Student Assessment Dashboard',
          description: 'A comprehensive dashboard that uses AI to provide personalized feedback on student assignments.',
          innovation_category: 'assessment_tools',
          potential_impact: 'Could help teachers provide more targeted feedback and improve student outcomes.',
          implementation_plan: 'Phase 1: Prototype development, Phase 2: Pilot testing, Phase 3: School-wide rollout',
        };

      default:
        return { type: 'generic', data: 'test data' };
    }
  }

  /**
   * Generate a points ledger entry
   */
  generatePointsEntry(overrides: Partial<TestPointsEntry> = {}): TestPointsEntry {
    const activityCode = overrides.activity_code || 'LEARN';
    const defaultPoints = this.getDefaultPointsForActivity(activityCode);
    
    return {
      id: `test-points-${randomBytes(6).toString('hex')}`,
      user_id: overrides.user_id || 'test-user-1',
      activity_code: activityCode,
      source: LedgerSource.FORM,
      delta_points: defaultPoints,
      external_source: null,
      external_event_id: null,
      ...overrides,
    };
  }

  /**
   * Get default points for an activity
   */
  getDefaultPointsForActivity(activityCode: string): number {
    const pointMap: Record<string, number> = {
      LEARN: 20,
      EXPLORE: 50,
      AMPLIFY: 25, // Variable based on peer/student count
      PRESENT: 20,
      SHINE: 0, // Recognition only
    };
    
    return pointMap[activityCode] || 0;
  }

  /**
   * Create a complete test user with submissions and points
   */
  async createTestUser(userData: Partial<TestUser> = {}): Promise<TestUser> {
    const user = this.generateUser(userData);
    
    await this.prisma.user.create({
      data: {
        id: user.id,
        handle: user.handle,
        name: user.name,
        email: user.email,
        role: user.role,
        school: user.school,
        cohort: user.cohort,
        kajabi_contact_id: user.kajabi_contact_id,
      },
    });
    
    return user;
  }

  /**
   * Create a test submission
   */
  async createTestSubmission(submissionData: Partial<TestSubmission> = {}): Promise<TestSubmission> {
    const submission = this.generateSubmission(submissionData);
    
    await this.prisma.submission.create({
      data: {
        id: submission.id!,
        user_id: submission.user_id,
        activity_code: submission.activity_code,
        status: submission.status,
        visibility: submission.visibility,
        payload: submission.payload,
        reviewer_id: submission.reviewer_id,
        review_note: submission.review_note,
      },
    });
    
    return submission;
  }

  /**
   * Create a points ledger entry
   */
  async createPointsEntry(pointsData: Partial<TestPointsEntry> = {}): Promise<TestPointsEntry> {
    const entry = this.generatePointsEntry(pointsData);
    
    await this.prisma.pointsLedger.create({
      data: {
        id: entry.id!,
        user_id: entry.user_id,
        activity_code: entry.activity_code,
        source: entry.source,
        delta_points: entry.delta_points,
        external_source: entry.external_source,
        external_event_id: entry.external_event_id,
      },
    });
    
    return entry;
  }

  /**
   * Create a complete test scenario with user, submissions, and points
   */
  async createTestScenario(scenarioName: string): Promise<{
    users: TestUser[];
    submissions: TestSubmission[];
    pointsEntries: TestPointsEntry[];
  }> {
    const scenarios = {
      basic: () => this.createBasicScenario(),
      leaderboard: () => this.createLeaderboardScenario(),
      review_queue: () => this.createReviewQueueScenario(),
      comprehensive: () => this.createComprehensiveScenario(),
    };

    const scenario = scenarios[scenarioName as keyof typeof scenarios];
    if (!scenario) {
      throw new Error(`Unknown scenario: ${scenarioName}`);
    }

    return await scenario();
  }

  /**
   * Basic scenario: One user with one submission
   */
  private async createBasicScenario() {
    const user = await this.createTestUser({
      handle: 'basicuser',
      name: 'Basic Test User',
      email: 'basic@example.com',
    });

    const submission = await this.createTestSubmission({
      user_id: user.id,
      activity_code: 'LEARN',
      status: SubmissionStatus.APPROVED,
      visibility: Visibility.PUBLIC,
    });

    const pointsEntry = await this.createPointsEntry({
      user_id: user.id,
      activity_code: 'LEARN',
      delta_points: 20,
    });

    return {
      users: [user],
      submissions: [submission],
      pointsEntries: [pointsEntry],
    };
  }

  /**
   * Leaderboard scenario: Multiple users with varying points
   */
  private async createLeaderboardScenario() {
    const users: TestUser[] = [];
    const submissions: TestSubmission[] = [];
    const pointsEntries: TestPointsEntry[] = [];

    // Create 5 users with different point totals
    for (let i = 1; i <= 5; i++) {
      const user = await this.createTestUser({
        handle: `leaderuser${i}`,
        name: `Leaderboard User ${i}`,
        email: `leader${i}@example.com`,
      });
      users.push(user);

      // Create multiple submissions for each user
      const activities = ['LEARN', 'EXPLORE', 'AMPLIFY', 'PRESENT'];
      for (let j = 0; j < i; j++) { // User 1 gets 1 submission, User 2 gets 2, etc.
        const activity = activities[j % activities.length];
        
        const submission = await this.createTestSubmission({
          user_id: user.id,
          activity_code: activity,
          status: SubmissionStatus.APPROVED,
          visibility: Visibility.PUBLIC,
        });
        submissions.push(submission);

        const pointsEntry = await this.createPointsEntry({
          user_id: user.id,
          activity_code: activity,
          delta_points: this.getDefaultPointsForActivity(activity),
        });
        pointsEntries.push(pointsEntry);
      }
    }

    return { users, submissions, pointsEntries };
  }

  /**
   * Review queue scenario: Multiple submissions in different states
   */
  private async createReviewQueueScenario() {
    const user = await this.createTestUser({
      handle: 'reviewuser',
      name: 'Review Test User',
      email: 'review@example.com',
    });

    const reviewer = await this.createTestUser({
      handle: 'reviewer',
      name: 'Test Reviewer',
      email: 'reviewer@example.com',
      role: Role.REVIEWER,
    });

    const submissions: TestSubmission[] = [];
    const activities = ['LEARN', 'EXPLORE', 'AMPLIFY', 'PRESENT', 'SHINE'];
    const statuses = [
      SubmissionStatus.PENDING,
      SubmissionStatus.APPROVED,
      SubmissionStatus.REJECTED,
      SubmissionStatus.PENDING,
      SubmissionStatus.APPROVED,
    ];

    for (let i = 0; i < activities.length; i++) {
      const submission = await this.createTestSubmission({
        user_id: user.id,
        activity_code: activities[i],
        status: statuses[i],
        visibility: statuses[i] === SubmissionStatus.APPROVED ? Visibility.PUBLIC : Visibility.PRIVATE,
        reviewer_id: statuses[i] !== SubmissionStatus.PENDING ? reviewer.id : null,
        review_note: statuses[i] === SubmissionStatus.REJECTED ? 'Needs more evidence' : null,
      });
      submissions.push(submission);
    }

    // Create points only for approved submissions
    const pointsEntries: TestPointsEntry[] = [];
    for (const submission of submissions) {
      if (submission.status === SubmissionStatus.APPROVED) {
        const pointsEntry = await this.createPointsEntry({
          user_id: submission.user_id,
          activity_code: submission.activity_code,
          delta_points: this.getDefaultPointsForActivity(submission.activity_code),
        });
        pointsEntries.push(pointsEntry);
      }
    }

    return {
      users: [user, reviewer],
      submissions,
      pointsEntries,
    };
  }

  /**
   * Comprehensive scenario: Full test dataset
   */
  private async createComprehensiveScenario() {
    const basic = await this.createBasicScenario();
    const leaderboard = await this.createLeaderboardScenario();
    const reviewQueue = await this.createReviewQueueScenario();

    return {
      users: [...basic.users, ...leaderboard.users, ...reviewQueue.users],
      submissions: [...basic.submissions, ...leaderboard.submissions, ...reviewQueue.submissions],
      pointsEntries: [...basic.pointsEntries, ...leaderboard.pointsEntries, ...reviewQueue.pointsEntries],
    };
  }

  /**
   * Clean up all test data
   */
  async cleanup(): Promise<void> {
    // Delete in order to respect foreign key constraints
    await this.prisma.earnedBadge.deleteMany({ where: { user_id: { contains: 'test-' } } });
    await this.prisma.pointsLedger.deleteMany({ where: { user_id: { contains: 'test-' } } });
    await this.prisma.submission.deleteMany({ where: { user_id: { contains: 'test-' } } });
    await this.prisma.auditLog.deleteMany({ where: { actor_id: { contains: 'test-' } } });
    await this.prisma.kajabiEvent.deleteMany({ where: { user_match: { contains: 'test-' } } });
    await this.prisma.user.deleteMany({ where: { id: { contains: 'test-' } } });
  }

  /**
   * Get fixture statistics
   */
  async getStats(): Promise<{
    users: number;
    submissions: number;
    pointsEntries: number;
    totalPoints: number;
  }> {
    const users = await this.prisma.user.count({ where: { id: { contains: 'test-' } } });
    const submissions = await this.prisma.submission.count({ where: { user_id: { contains: 'test-' } } });
    const pointsEntries = await this.prisma.pointsLedger.count({ where: { user_id: { contains: 'test-' } } });
    
    const totalPointsResult = await this.prisma.pointsLedger.aggregate({
      where: { user_id: { contains: 'test-' } },
      _sum: { delta_points: true },
    });
    
    const totalPoints = totalPointsResult._sum.delta_points || 0;

    return { users, submissions, pointsEntries, totalPoints };
  }
}
