/**
 * Test data generators and fixtures for database testing
 * Provides consistent, realistic test data for all models
 */

import { type PrismaClient, Role, SubmissionStatus, Visibility, LedgerSource } from '@prisma/client'
import { randomBytes } from 'crypto'
// Import payload types from @elevate/types

// Types for test data
export interface TestUser {
  id: string
  handle: string
  name: string
  email: string
  role: Role
  school?: string | null
  cohort?: string | null
  kajabi_contact_id?: string | null
}

export interface TestSubmission {
  id?: string
  user_id: string
  activity_code: string
  status: SubmissionStatus
  visibility: Visibility
  payload: Record<string, unknown>
  attachments?: Array<{ path: string; hash?: string }>
  reviewer_id?: string | null
  review_note?: string | null
}

export interface TestPointsEntry {
  id?: string
  user_id: string
  activity_code: string
  source: LedgerSource
  delta_points: number
  external_source?: string | null
  external_event_id?: string | null
  event_time?: Date
}

// Indonesian context data
const INDONESIAN_SCHOOLS = [
  'SMAN 1 Jakarta',
  'SMP Negeri 12 Surabaya',
  'SMK Telkom Bandung',
  'SMA Santa Ursula Jakarta',
  'SMAN 3 Yogyakarta',
  'SMP Katolik Santa Maria Medan',
  'SMAN 5 Makassar',
  'SMK Negeri 2 Semarang',
  'SMA Kristen Kalam Kudus',
  'SMAN 8 Malang',
  'SMP Negeri 5 Palembang',
  'SMK Muhammadiyah 1 Solo',
  'SMAN 2 Denpasar',
  'SMP Al-Azhar Kelapa Gading',
  'SMK BPI 1 Bandung',
]

const INDONESIAN_NAMES = [
  'Sari Dewi',
  'Budi Santoso',
  'Rina Kusumawati',
  'Ahmad Fauzi',
  'Indah Sari',
  'Eko Prasetyo',
  'Dewi Lestari',
  'Rahmat Hidayat',
  'Sri Wahyuni',
  'Agung Setiawan',
  'Maya Sari',
  'Dimas Pratama',
  'Fitri Handayani',
  'Joko Widodo',
  'Ani Yulianti',
  'Bambang Sutrisno',
  'Ratna Sari',
  'Hendra Wijaya',
  'Lilis Suryani',
  'Gunawan Sasongko',
]

const COHORT_CITIES = [
  'Jakarta',
  'Surabaya',
  'Bandung',
  'Medan',
  'Makassar',
  'Semarang',
  'Yogyakarta',
  'Malang',
  'Palembang',
  'Denpasar',
]

// Fixture data generators
export class DatabaseFixtures {
  private prisma: PrismaClient
  private userCounter = 0
  private submissionCounter = 0

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /**
   * Generate a test user with realistic Indonesian context
   */
  generateUser(overrides: Partial<TestUser> = {}): TestUser {
    this.userCounter++
    const id =
      overrides.id ||
      `test-user-${this.userCounter}-${randomBytes(4).toString('hex')}`

    // Use Indonesian names and schools
    const nameIndex = (this.userCounter - 1) % INDONESIAN_NAMES.length
    const schoolIndex = (this.userCounter - 1) % INDONESIAN_SCHOOLS.length
    const cohortCity =
      COHORT_CITIES[(this.userCounter - 1) % COHORT_CITIES.length]

    // Generate Indonesian-style email handles
    const name = INDONESIAN_NAMES[nameIndex] ?? 'User'
    const handle =
      name.toLowerCase().replace(/\s+/g, '').replace(/[^\w]/g, '') +
      this.userCounter

    return {
      id,
      handle: overrides.handle || handle,
      name: overrides.name || name,
      email:
        overrides.email ||
        `${handle}@${cohortCity?.toLowerCase() ?? 'test'}.edu.id`,
      role: Role.PARTICIPANT,
      school: (overrides.school || INDONESIAN_SCHOOLS[schoolIndex]) ?? null,
      cohort: overrides.cohort || `MS Elevate ${cohortCity ?? 'Test'} 2024`,
      // Default to null to allow tests that require multiple NULLs on unique column
      kajabi_contact_id:
        overrides.kajabi_contact_id ?? null,
    }
  }

  /**
   * Generate a test submission with realistic payload data
   */
  generateSubmission(overrides: Partial<TestSubmission> = {}): TestSubmission {
    this.submissionCounter++

    const activityCode = overrides.activity_code || 'LEARN'
    const payload = this.generatePayloadForActivity(activityCode)

    return {
      id: `test-submission-${this.submissionCounter}-${randomBytes(4).toString(
        'hex',
      )}`,
      user_id: overrides.user_id || 'test-user-1',
      activity_code: activityCode,
      status: SubmissionStatus.PENDING,
      visibility: Visibility.PRIVATE,
      payload,
      attachments: [
        {
          path: `/uploads/test-file-${this.submissionCounter}.pdf`,
          hash: randomBytes(16).toString('hex'),
        },
      ],
      reviewer_id: overrides.reviewer_id ?? null,
      review_note: overrides.review_note ?? null,
      ...overrides,
    }
  }

  /**
   * Generate realistic payload data based on activity type
   */
  generatePayloadForActivity(activityCode: string): Record<string, unknown> {
    switch (activityCode) {
      case 'LEARN':
        return {
          certificate_url: `/uploads/certificate-${randomBytes(4).toString(
            'hex',
          )}.pdf`,
          course_name: 'AI in Education Fundamentals',
          completion_date: new Date().toISOString(),
          certificate_hash: randomBytes(32).toString('hex'),
        }

      case 'EXPLORE':
        const subjects = [
          'Matematika',
          'IPA Terpadu',
          'Bahasa Indonesia',
          'Sejarah',
          'PPKn',
        ]
        const subject = subjects[Math.floor(Math.random() * subjects.length)]
        return {
          title: `Implementasi AI untuk pembelajaran ${subject}`,
          description:
            'Menerapkan alat AI untuk meningkatkan engagement siswa dan hasil pembelajaran di kelas.',
          ai_tools_used: ['ChatGPT', 'Canva AI', 'Grammarly', 'Quizlet AI'],
          student_count: Math.floor(Math.random() * 40) + 15,
          reflection:
            'Siswa menunjukkan antusiasme yang tinggi dan pemahaman konsep yang lebih baik dengan bantuan AI.',
        }

      case 'AMPLIFY':
        return {
          training_type: 'peer_training',
          peers_trained: Math.floor(Math.random() * 15) + 3,
          students_trained: Math.floor(Math.random() * 80) + 20,
          training_topic:
            'Strategi Integrasi AI dalam Perencanaan Pembelajaran',
          evidence_type: 'daftar_hadir',
          impact_description:
            'Melatih rekan sejawat tentang strategi efektif mengintegrasikan AI dalam pembelajaran.',
        }

      case 'PRESENT':
        return {
          linkedin_url: `https://linkedin.com/posts/guru-indonesia-${randomBytes(
            4,
          ).toString('hex')}`,
          post_content:
            'Senang berbagi pengalaman menggunakan AI dalam pendidikan! Dengan MS Elevate, saya belajar mengintegrasikan teknologi AI untuk pembelajaran yang lebih menarik. #MSElevateIndonesia #AIEducation #GuruInnovasi',
          screenshot_url: `/uploads/linkedin-screenshot-${randomBytes(
            4,
          ).toString('hex')}.png`,
          engagement_metrics: {
            likes: Math.floor(Math.random() * 50) + 10,
            comments: Math.floor(Math.random() * 15) + 2,
            shares: Math.floor(Math.random() * 8) + 1,
          },
        }

      case 'SHINE':
        const ideas = [
          {
            title: 'Dashboard Asesmen Siswa berbasis AI',
            description:
              'Sebuah dashboard komprehensif yang menggunakan AI untuk memberikan feedback personal pada tugas siswa.',
            category: 'alat_asesmen',
          },
          {
            title: 'Asisten Virtual untuk Konseling Akademik',
            description:
              'Chatbot AI yang membantu siswa dengan bimbingan akademik dan pemilihan jurusan.',
            category: 'konseling_digital',
          },
          {
            title: 'Sistem Pembelajaran Adaptif Bahasa Indonesia',
            description:
              'Platform pembelajaran yang menyesuaikan tingkat kesulitan berdasarkan kemampuan individual siswa.',
            category: 'pembelajaran_adaptif',
          },
        ]
        const idea = ideas[Math.floor(Math.random() * ideas.length)] ?? ideas[0]
        return {
          idea_title: idea?.title ?? 'Innovative Teaching Method',
          description: idea?.description ?? 'A new approach to teaching',
          innovation_category: idea?.category ?? 'teaching_innovation',
          potential_impact:
            'Dapat membantu guru memberikan feedback yang lebih terarah dan meningkatkan hasil belajar siswa.',
          implementation_plan:
            'Fase 1: Pengembangan prototipe, Fase 2: Uji coba terbatas, Fase 3: Implementasi sekolah',
        }

      default:
        return { type: 'generic', data: 'test data' }
    }
  }

  /**
   * Generate a points ledger entry
   */
  generatePointsEntry(
    overrides: Partial<TestPointsEntry> = {},
  ): TestPointsEntry {
    const activityCode = overrides.activity_code || 'LEARN'
    const defaultPoints = this.getDefaultPointsForActivity(activityCode)

    return {
      id: `test-points-${randomBytes(6).toString('hex')}`,
      user_id: overrides.user_id || 'test-user-1',
      activity_code: activityCode,
      source: LedgerSource.FORM,
      delta_points: defaultPoints,
      external_source: null,
      external_event_id: null,
      event_time: overrides.event_time ?? new Date(),
      ...overrides,
    }
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
    }

    return pointMap[activityCode] || 0
  }

  /**
   * Create a complete test user with submissions and points
   */
  async createTestUser(userData: Partial<TestUser> = {}): Promise<TestUser> {
    const user = this.generateUser(userData)

    const create = async (u: typeof user) =>
      this.prisma.user.create({
        data: {
          id: u.id,
          handle: u.handle,
          name: u.name,
          email: u.email,
          role: u.role,
          school: u.school ?? null,
          cohort: u.cohort ?? null,
          kajabi_contact_id: u.kajabi_contact_id ?? null,
        },
      })

    try {
      await create(user)
    } catch (e: unknown) {
      // Handle unique constraint collisions gracefully to improve test isolation across runs
      const code = (e as { code?: string }).code
      if (code === 'P2002') {
        // Prefer preserving explicit email used by tests; adjust only the handle
        const suffix = `-${Date.now().toString(36)}`
        const uniqueUser = {
          ...user,
          handle: `${user.handle}${suffix}`.slice(0, 30),
        }
        await create(uniqueUser)
        return uniqueUser
      }
      throw e
    }

    return user
  }

  /**
   * Create a test submission
   */
  async createTestSubmission(
    submissionData: Partial<TestSubmission> = {},
  ): Promise<TestSubmission> {
    const submission = this.generateSubmission(submissionData)

    // Ensure parent user exists to satisfy FK
    const existingUser = await this.prisma.user.findUnique({ where: { id: submission.user_id } })
    if (!existingUser) {
      const handleBase = `user_${Math.abs(submission.user_id.split('').reduce((a, c) => a + c.charCodeAt(0), 0))}`
      await this.prisma.user.create({
        data: {
          id: submission.user_id,
          handle: handleBase,
          name: 'Test User',
          email: `${handleBase}@example.com`,
          role: 'PARTICIPANT',
        },
      })
    }

    const createdSubmission = await this.prisma.submission.create({
      data: {
        id: submission.id!,
        user_id: submission.user_id,
        activity_code: submission.activity_code,
        status: submission.status,
        visibility: submission.visibility,
        payload: submission.payload,
        reviewer_id: submission.reviewer_id ?? null,
        review_note: submission.review_note ?? null,
      },
    })

    // Create attachments if provided
    if (submission.attachments && submission.attachments.length > 0) {
      await Promise.all(
        submission.attachments.map((attachment) =>
          this.prisma.submissionAttachment.create({
            data: {
              submission_id: createdSubmission.id,
              path: attachment.path,
              hash: attachment.hash ?? null,
            },
          }),
        ),
      )
    }

    return submission
  }

  /**
   * Create a points ledger entry
   */
  async createPointsEntry(
    pointsData: Partial<TestPointsEntry> = {},
  ): Promise<TestPointsEntry> {
    const entry = this.generatePointsEntry(pointsData)

    // Ensure parent user exists to satisfy FK
    const existingUser = await this.prisma.user.findUnique({ where: { id: entry.user_id } })
    if (!existingUser) {
      const handleBase = `user_${Math.abs(entry.user_id.split('').reduce((a, c) => a + c.charCodeAt(0), 0))}`
      await this.prisma.user.create({
        data: {
          id: entry.user_id,
          handle: handleBase,
          name: 'Test User',
          email: `${handleBase}@example.com`,
          role: 'PARTICIPANT',
        },
      })
    }

    await this.prisma.pointsLedger.create({
      data: {
        id: entry.id!,
        user_id: entry.user_id,
        activity_code: entry.activity_code,
        source: entry.source,
        delta_points: entry.delta_points,
        external_source: entry.external_source ?? null,
        external_event_id: entry.external_event_id ?? null,
        event_time: entry.event_time ?? new Date(),
      },
    })

    return entry
  }

  /**
   * Create a complete test scenario with user, submissions, and points
   */
  async createTestScenario(scenarioName: string): Promise<{
    users: TestUser[]
    submissions: TestSubmission[]
    pointsEntries: TestPointsEntry[]
  }> {
    const scenarios = {
      basic: () => this.createBasicScenario(),
      leaderboard: () => this.createLeaderboardScenario(),
      review_queue: () => this.createReviewQueueScenario(),
      comprehensive: () => this.createComprehensiveScenario(),
    }

    const scenario = scenarios[scenarioName as keyof typeof scenarios]
    if (!scenario) {
      throw new Error(`Unknown scenario: ${scenarioName}`)
    }

    return await scenario()
  }

  /**
   * Basic scenario: One user with one submission
   */
  private async createBasicScenario() {
    const user = await this.createTestUser({
      handle: 'basicuser',
      name: 'Basic Test User',
      // Ensure unique email across repeated runs to avoid unique constraint conflicts
      email: `basic${this.userCounter}@example.com`,
    })

    const submission = await this.createTestSubmission({
      user_id: user.id,
      activity_code: 'LEARN',
      status: SubmissionStatus.APPROVED,
      visibility: Visibility.PUBLIC,
    })

    const pointsEntry = await this.createPointsEntry({
      user_id: user.id,
      activity_code: 'LEARN',
      delta_points: 20,
    })

    return {
      users: [user],
      submissions: [submission],
      pointsEntries: [pointsEntry],
    }
  }

  /**
   * Leaderboard scenario: Multiple users with varying points
   */
  private async createLeaderboardScenario() {
    const users: TestUser[] = []
    const submissions: TestSubmission[] = []
    const pointsEntries: TestPointsEntry[] = []

    // Create 5 users with different point totals
    for (let i = 1; i <= 5; i++) {
      const user = await this.createTestUser({
        handle: `leaderuser${i}`,
        name: `Leaderboard User ${i}`,
        email: `leader${i}@example.com`,
      })
      users.push(user)

      // Create multiple submissions for each user
      const activities = ['LEARN', 'EXPLORE', 'AMPLIFY', 'PRESENT'] as const
      for (let j = 0; j < i; j++) {
        // User 1 gets 1 submission, User 2 gets 2, etc.
        const activity = activities[j % activities.length]!

        const submission = await this.createTestSubmission({
          user_id: user.id,
          activity_code: activity,
          status: SubmissionStatus.APPROVED,
          visibility: Visibility.PUBLIC,
        })
        submissions.push(submission)

        const pointsEntry = await this.createPointsEntry({
          user_id: user.id,
          activity_code: activity,
          delta_points: this.getDefaultPointsForActivity(activity),
        })
        pointsEntries.push(pointsEntry)
      }
    }

    return { users, submissions, pointsEntries }
  }

  /**
   * Review queue scenario: Multiple submissions in different states
   */
  private async createReviewQueueScenario() {
    const user = await this.createTestUser({
      handle: 'reviewuser',
      name: 'Review Test User',
      // Unique email to avoid collisions across runs
      email: `review${this.userCounter}@example.com`,
    })

    const reviewer = await this.createTestUser({
      handle: 'reviewer',
      name: 'Test Reviewer',
      // Unique email to avoid collisions across runs
      email: `reviewer${this.userCounter}@example.com`,
      role: Role.REVIEWER,
    })

    const submissions: TestSubmission[] = []
    const activities = ['LEARN', 'EXPLORE', 'AMPLIFY', 'PRESENT', 'SHINE']
    const statuses = [
      SubmissionStatus.PENDING,
      SubmissionStatus.APPROVED,
      SubmissionStatus.REJECTED,
      SubmissionStatus.PENDING,
      SubmissionStatus.APPROVED,
    ]

    for (let i = 0; i < activities.length; i++) {
      const submission = await this.createTestSubmission({
        user_id: user.id,
        activity_code: activities[i]!,
        status: statuses[i]!,
        visibility:
          statuses[i] === SubmissionStatus.APPROVED
            ? Visibility.PUBLIC
            : Visibility.PRIVATE,
        reviewer_id:
          statuses[i] !== SubmissionStatus.PENDING ? reviewer.id : null,
        review_note:
          statuses[i] === SubmissionStatus.REJECTED
            ? 'Needs more evidence'
            : null,
      })
      submissions.push(submission)
    }

    // Create points only for approved submissions
    const pointsEntries: TestPointsEntry[] = []
    for (const submission of submissions) {
      if (submission.status === SubmissionStatus.APPROVED) {
        const pointsEntry = await this.createPointsEntry({
          user_id: submission.user_id,
          activity_code: submission.activity_code,
          delta_points: this.getDefaultPointsForActivity(
            submission.activity_code,
          ),
        })
        pointsEntries.push(pointsEntry)
      }
    }

    return {
      users: [user, reviewer],
      submissions,
      pointsEntries,
    }
  }

  /**
   * Comprehensive scenario: Full test dataset
   */
  private async createComprehensiveScenario() {
    const basic = await this.createBasicScenario()
    const leaderboard = await this.createLeaderboardScenario()
    const reviewQueue = await this.createReviewQueueScenario()

    return {
      users: [...basic.users, ...leaderboard.users, ...reviewQueue.users],
      submissions: [
        ...basic.submissions,
        ...leaderboard.submissions,
        ...reviewQueue.submissions,
      ],
      pointsEntries: [
        ...basic.pointsEntries,
        ...leaderboard.pointsEntries,
        ...reviewQueue.pointsEntries,
      ],
    }
  }

  /**
   * Clean up all test data
   */
  async cleanup(): Promise<void> {
    // Delete in order to respect foreign key constraints
    try {
      // Delete attachments before submissions to satisfy FK: submission_attachments_submission_id_fkey
      await this.prisma.submissionAttachment.deleteMany({
        where: { submission_id: { contains: 'test-submission-' } },
      })
    } catch { /* noop */ }
    try {
      // Remove test-created badges with predictable codes
      await this.prisma.badge.deleteMany({
        where: { code: { startsWith: 'COMPLEX_' } },
      })
    } catch { /* noop */ }
    try {
      await this.prisma.earnedBadge.deleteMany({
        where: { user_id: { contains: 'test-' } },
      })
    } catch { /* noop */ }
    try {
      await this.prisma.pointsLedger.deleteMany({
        where: { user_id: { contains: 'test-' } },
      })
    } catch { /* noop */ }
    try {
      await this.prisma.submission.deleteMany({
        where: { user_id: { contains: 'test-' } },
      })
    } catch { /* noop */ }
    try {
      await this.prisma.auditLog.deleteMany({
        where: { actor_id: { contains: 'test-' } },
      })
    } catch { /* noop */ }
    try {
      // Clean all Kajabi events to avoid test pollution across runs
      await this.prisma.kajabiEvent.deleteMany({})
    } catch { /* noop */ }
    try {
      await this.prisma.user.deleteMany({
        where: { id: { contains: 'test-' } },
      })
    } catch { /* noop */ }
  }

  /**
   * Get fixture statistics
   */
  async getStats(): Promise<{
    users: number
    submissions: number
    pointsEntries: number
    totalPoints: number
  }> {
    const users = await this.prisma.user.count({
      where: { id: { contains: 'test-' } },
    })
    const submissions = await this.prisma.submission.count({
      where: { user_id: { contains: 'test-' } },
    })
    const pointsEntries = await this.prisma.pointsLedger.count({
      where: { user_id: { contains: 'test-' } },
    })

    const totalPointsResult = await this.prisma.pointsLedger.aggregate({
      where: { user_id: { contains: 'test-' } },
      _sum: { delta_points: true },
    })

    const totalPoints = totalPointsResult._sum.delta_points || 0

    return { users, submissions, pointsEntries, totalPoints }
  }
}
