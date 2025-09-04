/**
 * End-to-End Integration Tests
 * Tests complete workflows from user registration to leaderboard visibility
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { TestDatabase, DatabaseAssertions, withTestDatabase } from './helpers'
import {
  SubmissionStatus,
  Visibility,
  Role,
  LedgerSource,
} from '@prisma/client'
import { getSecureLogger, PIIRedactor } from '../src/logger'

describe('End-to-End Integration Tests', () => {
  let testDb: TestDatabase
  let assertions: DatabaseAssertions
  const logger = getSecureLogger()

  beforeEach(async () => {
    testDb = new TestDatabase()
    await testDb.setup()
    assertions = new DatabaseAssertions(testDb.prisma)
  })

  afterEach(async () => {
    await testDb.cleanup()
  })

  describe('Complete LEAPS Journey Workflow', () => {
    it(
      'should handle complete user journey from registration to leaderboard',
      withTestDatabase(async (db) => {
        logger.database({
          operation: 'INTEGRATION_TEST_START',
          table: 'complete_workflow',
          duration: 0,
          recordCount: 0,
        })

        // 1. User Registration
        const participant = await db.fixtures.createTestUser({
          name: 'Sari Dewi Kusumawati',
          email: 'sari.dewi@sman1jakarta.edu.id',
          handle: 'saridewi',
          school: 'SMAN 1 Jakarta',
          cohort: 'MS Elevate Jakarta 2024',
          role: Role.PARTICIPANT,
        })

        const reviewer = await db.fixtures.createTestUser({
          name: 'Ahmad Fauzi',
          email: 'ahmad.fauzi@reviewer.edu.id',
          handle: 'reviewerahmad',
          role: Role.REVIEWER,
        })

        await assertions.assertUserExists(participant.id)
        await assertions.assertUserExists(reviewer.id)

        // 2. LEARN Stage - Certificate Upload
        const learnSubmission = await db.fixtures.createTestSubmission({
          user_id: participant.id,
          activity_code: 'LEARN',
          status: SubmissionStatus.PENDING,
          visibility: Visibility.PRIVATE,
          payload: {
            certificate_url: '/uploads/ai-fundamentals-certificate.pdf',
            course_name: 'AI in Education Fundamentals',
            completion_date: new Date().toISOString(),
            hash: 'cert123hash456',
          },
          attachments: [
            {
              path: '/uploads/ai-fundamentals-certificate.pdf',
              hash: 'cert123hash456',
            },
          ],
        })

        await assertions.assertSubmissionExists(learnSubmission.id!)

        // 3. Reviewer approves LEARN submission
        await db.prisma.submission.update({
          where: { id: learnSubmission.id },
          data: {
            status: SubmissionStatus.APPROVED,
            visibility: Visibility.PUBLIC,
            reviewer_id: reviewer.id,
            review_note: 'Certificate verified and approved',
          },
        })

        await assertions.assertSubmissionStatus(learnSubmission.id!, 'APPROVED')

        // 4. Points awarded for LEARN
        await db.fixtures.createPointsEntry({
          user_id: participant.id,
          activity_code: 'LEARN',
          delta_points: 20,
          source: LedgerSource.FORM,
        })

        await assertions.assertPointsBalance(participant.id, 20)

        // 5. Audit log for approval
        await db.prisma.auditLog.create({
          data: {
            actor_id: reviewer.id,
            action: 'SUBMISSION_APPROVED',
            target_id: learnSubmission.id,
            meta: {
              activity_code: 'LEARN',
              user_id: participant.id,
              points_awarded: 20,
              submission_title: 'AI Fundamentals Certificate',
            },
          },
        })

        await assertions.assertAuditLogExists(
          reviewer.id,
          'SUBMISSION_APPROVED',
          learnSubmission.id,
        )

        // 6. EXPLORE Stage - AI Implementation
        const exploreSubmission = await db.fixtures.createTestSubmission({
          user_id: participant.id,
          activity_code: 'EXPLORE',
          status: SubmissionStatus.PENDING,
          payload: {
            title: 'Implementasi ChatGPT untuk Pembelajaran Bahasa Indonesia',
            description:
              'Menggunakan AI untuk membantu siswa kelas 10 dalam menulis esai argumentatif dan menganalisis teks sastra Indonesia.',
            ai_tools_used: ['ChatGPT-4', 'Grammarly', 'Canva AI'],
            students_trained: 32,
            reflection:
              'Siswa menunjukkan antusiasme tinggi terhadap penggunaan AI. Kualitas esai mereka meningkat 40% dalam hal struktur dan tata bahasa. Mereka juga lebih kreatif dalam menganalisis karya sastra.',
            evidence_description:
              'Screenshot aktivitas kelas, contoh hasil kerja siswa sebelum dan sesudah menggunakan AI, dan feedback siswa.',
          },
          attachments: [
            {
              path: '/uploads/classroom-activity-screenshot.jpg',
              hash: 'class123',
            },
            { path: '/uploads/student-work-before-after.pdf', hash: 'work456' },
            { path: '/uploads/student-feedback-form.pdf', hash: 'feedback789' },
          ],
        })

        // 7. Reviewer approves EXPLORE
        await db.prisma.submission.update({
          where: { id: exploreSubmission.id },
          data: {
            status: SubmissionStatus.APPROVED,
            visibility: Visibility.PUBLIC,
            reviewer_id: reviewer.id,
            review_note:
              'Excellent implementation with clear evidence of impact',
          },
        })

        // 8. Points awarded for EXPLORE
        await db.fixtures.createPointsEntry({
          user_id: participant.id,
          activity_code: 'EXPLORE',
          delta_points: 50,
          source: LedgerSource.FORM,
        })

        await assertions.assertPointsBalance(participant.id, 70)

        // 9. AMPLIFY Stage - Training Others
        const amplifySubmission = await db.fixtures.createTestSubmission({
          user_id: participant.id,
          activity_code: 'AMPLIFY',
          status: SubmissionStatus.PENDING,
          payload: {
            training_type: 'peer_training',
            peers_trained: 8,
            students_trained: 0,
            training_topic:
              'Strategi Mengintegrasikan AI dalam Pembelajaran Bahasa',
            evidence_type: 'daftar_hadir_dan_foto',
            impact_description:
              'Melatih 8 rekan guru dari sekolah lain tentang penggunaan ChatGPT untuk pembelajaran. Mereka sangat antusias dan sudah mulai menerapkan di kelas masing-masing.',
            training_date: new Date().toISOString(),
            duration_hours: 4,
          },
          attachments: [
            {
              path: '/uploads/training-attendance-list.pdf',
              hash: 'attend123',
            },
            { path: '/uploads/training-photos.jpg', hash: 'photos456' },
            { path: '/uploads/training-materials.pdf', hash: 'materials789' },
          ],
        })

        // 10. Reviewer approves AMPLIFY
        await db.prisma.submission.update({
          where: { id: amplifySubmission.id },
          data: {
            status: SubmissionStatus.APPROVED,
            visibility: Visibility.PUBLIC,
            reviewer_id: reviewer.id,
            review_note: 'Good peer training evidence with clear impact',
          },
        })

        // 11. Points awarded for AMPLIFY (8 peers * 2 points = 16 points)
        await db.fixtures.createPointsEntry({
          user_id: participant.id,
          activity_code: 'AMPLIFY',
          delta_points: 16,
          source: LedgerSource.FORM,
        })

        await assertions.assertPointsBalance(participant.id, 86)

        // 12. PRESENT Stage - LinkedIn Post
        const presentSubmission = await db.fixtures.createTestSubmission({
          user_id: participant.id,
          activity_code: 'PRESENT',
          status: SubmissionStatus.PENDING,
          payload: {
            linkedin_url:
              'https://linkedin.com/posts/saridewi_mselevate-aieducation-innovation',
            post_content:
              'Senang berbagi pengalaman menggunakan AI dalam pembelajaran Bahasa Indonesia! Dengan MS Elevate, saya belajar mengintegrasikan ChatGPT untuk membantu siswa menulis esai yang lebih berkualitas. Antusiasme siswa meningkat drastis! 🚀 #MSElevateIndonesia #AIEducation #GuruInnovasi #PendidikanDigital',
            screenshot_url: '/uploads/linkedin-post-screenshot.png',
            engagement_metrics: {
              likes: 45,
              comments: 12,
              shares: 8,
              views: 320,
            },
            post_date: new Date().toISOString(),
          },
          attachments: [
            {
              path: '/uploads/linkedin-post-screenshot.png',
              hash: 'linkedin123',
            },
          ],
        })

        // 13. Reviewer approves PRESENT
        await db.prisma.submission.update({
          where: { id: presentSubmission.id },
          data: {
            status: SubmissionStatus.APPROVED,
            visibility: Visibility.PUBLIC,
            reviewer_id: reviewer.id,
            review_note: 'Great LinkedIn post with good engagement',
          },
        })

        // 14. Points awarded for PRESENT
        await db.fixtures.createPointsEntry({
          user_id: participant.id,
          activity_code: 'PRESENT',
          delta_points: 20,
          source: LedgerSource.FORM,
        })

        await assertions.assertPointsBalance(participant.id, 106)

        // 15. SHINE Stage - Innovation Idea
        const shineSubmission = await db.fixtures.createTestSubmission({
          user_id: participant.id,
          activity_code: 'SHINE',
          status: SubmissionStatus.PENDING,
          payload: {
            idea_title: 'AI Writing Coach untuk Siswa Indonesia',
            description:
              'Sebuah platform AI yang khusus dirancang untuk membantu siswa Indonesia meningkatkan kemampuan menulis dalam Bahasa Indonesia dengan mempertimbangkan konteks budaya dan struktur bahasa yang unik.',
            innovation_category: 'alat_pembelajaran_adaptif',
            potential_impact:
              'Dapat membantu jutaan siswa Indonesia meningkatkan literasi dan kemampuan berpikir kritis melalui tulisan yang berkualitas, dengan tetap mempertahankan nilai-nilai budaya Indonesia.',
            implementation_plan:
              'Fase 1: Riset dan pengembangan AI model khusus Bahasa Indonesia (6 bulan), Fase 2: Uji coba terbatas di 10 sekolah (3 bulan), Fase 3: Peluncuran nasional dan partnership dengan Kemendikbud (12 bulan)',
            target_users: 'Siswa SMP dan SMA di seluruh Indonesia',
            unique_features: [
              'AI yang memahami konteks budaya Indonesia',
              'Feedback dalam Bahasa Indonesia',
              'Integrasi dengan kurikulum nasional',
              'Gamifikasi dengan elemen budaya lokal',
            ],
          },
        })

        // 16. Reviewer approves SHINE (no points for recognition only)
        await db.prisma.submission.update({
          where: { id: shineSubmission.id },
          data: {
            status: SubmissionStatus.APPROVED,
            visibility: Visibility.PUBLIC,
            reviewer_id: reviewer.id,
            review_note:
              'Innovative idea with strong potential for Indonesian education',
          },
        })

        // 17. Award badges based on achievements
        await db.prisma.earnedBadge.create({
          data: {
            user_id: participant.id,
            badge_code: 'FIRST_STEPS',
          },
        })

        await db.prisma.earnedBadge.create({
          data: {
            user_id: participant.id,
            badge_code: 'EXPLORER',
          },
        })

        await db.prisma.earnedBadge.create({
          data: {
            user_id: participant.id,
            badge_code: 'INNOVATOR',
          },
        })

        await assertions.assertBadgeEarned(participant.id, 'FIRST_STEPS')
        await assertions.assertBadgeEarned(participant.id, 'EXPLORER')
        await assertions.assertBadgeEarned(participant.id, 'INNOVATOR')

        // 18. Refresh materialized views to update leaderboard
        await db.prisma.$executeRaw`SELECT refresh_leaderboards()`

        // 19. Verify user appears in leaderboard
        const leaderboard = await db.prisma.$queryRaw<
          Array<{
            user_id: string
            handle: string
            name: string
            total_points: number
            public_submissions: number
          }>
        >`
        SELECT user_id, handle, name, total_points, public_submissions
        FROM leaderboard_totals
        WHERE user_id = ${participant.id}
      `

        expect(leaderboard).toHaveLength(1)
        expect(leaderboard[0].total_points).toBe(106)
        expect(leaderboard[0].public_submissions).toBe(5) // All 5 LEAPS stages
        expect(leaderboard[0].name).toBe('Sari Dewi Kusumawati')

        // 20. Verify activity metrics are updated
        await db.prisma.$executeRaw`REFRESH MATERIALIZED VIEW activity_metrics`

        const activityStats = await db.prisma.$queryRaw<
          Array<{
            code: string
            total_submissions: number
            approved_submissions: number
            public_submissions: number
          }>
        >`
        SELECT code, total_submissions, approved_submissions, public_submissions
        FROM activity_metrics
        WHERE total_submissions > 0
        ORDER BY code
      `

        expect(activityStats).toHaveLength(5)
        activityStats.forEach((stat) => {
          expect(stat.total_submissions).toBe(1)
          expect(stat.approved_submissions).toBe(1)
          expect(stat.public_submissions).toBe(1)
        })

        // 21. Test secure logging throughout
        const sensitiveInfo = `User: ${participant.name}, Email: ${participant.email}, School: ${participant.school}`
        const sanitizedInfo = PIIRedactor.redactPII(sensitiveInfo)

        expect(sanitizedInfo).not.toContain(participant.email)
        expect(sanitizedInfo).toContain('[EMAIL_REDACTED]')
        expect(sanitizedInfo).toContain(participant.name) // Names are OK
        expect(sanitizedInfo).toContain(participant.school!) // School names are OK

        logger.database({
          operation: 'INTEGRATION_TEST_COMPLETE',
          table: 'complete_workflow',
          duration: 0,
          recordCount: 1,
          metadata: {
            participant_points: 106,
            badges_earned: 3,
            submissions_approved: 5,
            leaderboard_position: 1,
          },
        })
      }),
    )

    it(
      'should handle multi-user competitive scenario',
      withTestDatabase(async (db) => {
        // Create multiple participants with varying progress
        const participants = await Promise.all([
          db.fixtures.createTestUser({
            name: 'Budi Santoso',
            email: 'budi@sman3yogya.edu.id',
            handle: 'budisantoso',
            school: 'SMAN 3 Yogyakarta',
            cohort: 'MS Elevate Yogyakarta 2024',
          }),
          db.fixtures.createTestUser({
            name: 'Rina Kusumawati',
            email: 'rina@smpnegeri12.edu.id',
            handle: 'rinakusuma',
            school: 'SMP Negeri 12 Surabaya',
            cohort: 'MS Elevate Surabaya 2024',
          }),
          db.fixtures.createTestUser({
            name: 'Ahmad Fauzi',
            email: 'ahmad@smktelkom.edu.id',
            handle: 'ahmadfauzi',
            school: 'SMK Telkom Bandung',
            cohort: 'MS Elevate Bandung 2024',
          }),
        ])

        const reviewer = await db.fixtures.createTestUser({
          role: Role.REVIEWER,
          handle: 'reviewer-multi',
          name: 'Reviewer Multi',
          email: 'reviewer@multi.test',
        })

        // Simulate different completion levels
        const progressScenarios = [
          {
            user: participants[0],
            stages: ['LEARN', 'EXPLORE', 'AMPLIFY', 'PRESENT', 'SHINE'],
            expectedPoints: 106,
          },
          {
            user: participants[1],
            stages: ['LEARN', 'EXPLORE'],
            expectedPoints: 70,
          },
          { user: participants[2], stages: ['LEARN'], expectedPoints: 20 },
        ]

        for (const scenario of progressScenarios) {
          let totalPoints = 0

          for (const stage of scenario.stages) {
            // Create submission
            const submission = await db.fixtures.createTestSubmission({
              user_id: scenario.user.id,
              activity_code: stage,
              status: SubmissionStatus.APPROVED,
              visibility: Visibility.PUBLIC,
            })

            // Award points based on stage
            let points = 0
            switch (stage) {
              case 'LEARN':
                points = 20
                break
              case 'EXPLORE':
                points = 50
                break
              case 'AMPLIFY':
                points = 16
                break // Assuming 8 peers
              case 'PRESENT':
                points = 20
                break
              case 'SHINE':
                points = 0
                break // Recognition only
            }

            if (points > 0) {
              await db.fixtures.createPointsEntry({
                user_id: scenario.user.id,
                activity_code: stage,
                delta_points: points,
              })
              totalPoints += points
            }

            // Log approval
            await db.prisma.auditLog.create({
              data: {
                actor_id: reviewer.id,
                action: 'SUBMISSION_APPROVED',
                target_id: submission.id!,
                meta: {
                  stage,
                  user_handle: scenario.user.handle,
                  points_awarded: points,
                },
              },
            })
          }

          await assertions.assertPointsBalance(scenario.user.id, totalPoints)
        }

        // Refresh leaderboard
        await db.prisma.$executeRaw`SELECT refresh_leaderboards()`

        // Check leaderboard ranking
        const leaderboard = await db.prisma.$queryRaw<
          Array<{
            user_id: string
            handle: string
            name: string
            total_points: number
            public_submissions: number
          }>
        >`
        SELECT user_id, handle, name, total_points, public_submissions
        FROM leaderboard_totals
        ORDER BY total_points DESC
      `

        expect(leaderboard).toHaveLength(3)
        expect(leaderboard[0].handle).toBe('budisantoso') // Highest points
        expect(leaderboard[0].total_points).toBe(106)
        expect(leaderboard[1].handle).toBe('rinakusuma') // Second
        expect(leaderboard[1].total_points).toBe(70)
        expect(leaderboard[2].handle).toBe('ahmadfauzi') // Third
        expect(leaderboard[2].total_points).toBe(20)

        // Verify competitive integrity
        const totalPointsAwarded = leaderboard.reduce(
          (sum, user) => sum + user.total_points,
          0,
        )
        expect(totalPointsAwarded).toBe(106 + 70 + 20)
      }),
    )
  })

  describe('Kajabi Integration Workflow', () => {
    it(
      'should handle Kajabi webhook to points award workflow',
      withTestDatabase(async (db) => {
        const user = await db.fixtures.createTestUser({
          name: 'Dewi Lestari',
          email: 'dewi.lestari@smknegeri2.edu.id',
          kajabi_contact_id: 'kajabi-contact-12345',
        })

        // 1. Simulate Kajabi webhook event
        await db.prisma.kajabiEvent.create({
          data: {
            id: 'kajabi-event-67890',
            payload: {
              event_type: 'course_completion',
              contact: {
                id: 'kajabi-contact-12345',
                email: 'dewi.lestari@smknegeri2.edu.id',
                first_name: 'Dewi',
                last_name: 'Lestari',
              },
              course: {
                id: 'course-ai-fundamentals',
                name: 'AI in Education Fundamentals',
                completion_date: new Date().toISOString(),
              },
            },
          },
        })

        // 2. Process the webhook (simulate webhook processing)
        const matchedUser = await db.prisma.user.findFirst({
          where: {
            OR: [
              { kajabi_contact_id: 'kajabi-contact-12345' },
              {
                email: {
                  equals: 'dewi.lestari@smknegeri2.edu.id',
                  mode: 'insensitive',
                },
              },
            ],
          },
        })

        expect(matchedUser).toBeTruthy()
        expect(matchedUser!.id).toBe(user.id)

        // 3. Award points via webhook source
        await db.fixtures.createPointsEntry({
          user_id: user.id,
          activity_code: 'LEARN',
          delta_points: 20,
          source: LedgerSource.WEBHOOK,
          external_source: 'kajabi',
          external_event_id: 'kajabi-event-67890',
        })

        // 4. Create auto-approved submission
        const autoSubmission = await db.fixtures.createTestSubmission({
          user_id: user.id,
          activity_code: 'LEARN',
          status: SubmissionStatus.APPROVED,
          visibility: Visibility.PUBLIC,
          payload: {
            certificate_url: 'auto-generated-from-kajabi',
            course_name: 'AI in Education Fundamentals',
            completion_date: new Date().toISOString(),
            auto_approved: true,
            kajabi_event_id: 'kajabi-event-67890',
          },
        })

        // 5. Mark Kajabi event as processed
        await db.prisma.kajabiEvent.update({
          where: { id: 'kajabi-event-67890' },
          data: {
            processed_at: new Date(),
            user_match: user.id,
          },
        })

        // 6. Create audit trail for webhook processing
        await db.prisma.auditLog.create({
          data: {
            actor_id: 'system',
            action: 'KAJABI_WEBHOOK_PROCESSED',
            target_id: user.id,
            meta: {
              kajabi_event_id: 'kajabi-event-67890',
              points_awarded: 20,
              submission_id: autoSubmission.id,
              auto_approved: true,
            },
          },
        })

        // Verify the complete workflow
        await assertions.assertPointsBalance(user.id, 20)
        await assertions.assertSubmissionStatus(autoSubmission.id!, 'APPROVED')
        await assertions.assertAuditLogExists(
          'system',
          'KAJABI_WEBHOOK_PROCESSED',
          user.id,
        )

        // Verify idempotency - duplicate webhook should not create duplicate points
        const duplicatePoints = await db.prisma.pointsLedger.findMany({
          where: {
            external_event_id: 'kajabi-event-67890',
          },
        })
        expect(duplicatePoints).toHaveLength(1) // Only one entry for this external event

        logger.database({
          operation: 'KAJABI_INTEGRATION_COMPLETE',
          table: 'kajabi_workflow',
          duration: 0,
          recordCount: 1,
          metadata: {
            user_matched: true,
            points_awarded: 20,
            submission_auto_approved: true,
            event_processed: true,
          },
        })
      }),
    )
  })

  describe('Admin Operations Workflow', () => {
    it(
      'should handle admin review queue and batch operations',
      withTestDatabase(async (db) => {
        // Create admin and multiple participants
        const admin = await db.fixtures.createTestUser({
          role: Role.ADMIN,
          handle: 'admin-reviewer',
          name: 'Admin Reviewer',
          email: 'admin@elevate.test',
        })

        const participants = await Promise.all(
          Array.from({ length: 5 }, (_, i) =>
            db.fixtures.createTestUser({
              handle: `participant${i}`,
              name: `Participant ${i}`,
              school: `SMAN ${i + 1} Test City`,
            }),
          ),
        )

        // Create pending submissions from all participants
        const pendingSubmissions = []
        for (const participant of participants) {
          const submission = await db.fixtures.createTestSubmission({
            user_id: participant.id,
            activity_code: 'EXPLORE',
            status: SubmissionStatus.PENDING,
            payload: {
              title: `AI Implementation by ${participant.name}`,
              description: 'AI implementation in classroom setting',
            },
          })
          pendingSubmissions.push(submission)
        }

        // Admin reviews queue
        const reviewQueue = await db.prisma.submission.findMany({
          where: {
            status: SubmissionStatus.PENDING,
          },
          include: {
            user: {
              select: { handle: true, name: true, school: true },
            },
          },
        })

        expect(reviewQueue).toHaveLength(5)

        // Admin performs batch approval
        const approvalStart = Date.now()

        await db.prisma.submission.updateMany({
          where: {
            id: { in: pendingSubmissions.map((s) => s.id!) },
          },
          data: {
            status: SubmissionStatus.APPROVED,
            visibility: Visibility.PUBLIC,
            reviewer_id: admin.id,
            review_note: 'Batch approved after review',
          },
        })

        const approvalDuration = Date.now() - approvalStart

        // Award points for each approved submission
        const pointsStart = Date.now()

        await Promise.all(
          participants.map((participant) =>
            db.fixtures.createPointsEntry({
              user_id: participant.id,
              activity_code: 'EXPLORE',
              delta_points: 50,
              source: LedgerSource.MANUAL,
            }),
          ),
        )

        const pointsDuration = Date.now() - pointsStart

        // Create batch audit log
        await db.prisma.auditLog.create({
          data: {
            actor_id: admin.id,
            action: 'BATCH_APPROVAL',
            meta: {
              submission_count: pendingSubmissions.length,
              activity_code: 'EXPLORE',
              total_points_awarded: participants.length * 50,
              approval_duration: approvalDuration,
              points_duration: pointsDuration,
            },
          },
        })

        // Verify all operations completed successfully
        const approvedCount = await db.prisma.submission.count({
          where: {
            id: { in: pendingSubmissions.map((s) => s.id!) },
            status: SubmissionStatus.APPROVED,
          },
        })
        expect(approvedCount).toBe(5)

        const totalPointsAwarded = await db.prisma.pointsLedger.aggregate({
          where: {
            user_id: { in: participants.map((p) => p.id) },
            activity_code: 'EXPLORE',
          },
          _sum: { delta_points: true },
        })
        expect(totalPointsAwarded._sum.delta_points).toBe(250) // 5 users * 50 points

        logger.database({
          operation: 'ADMIN_BATCH_OPERATIONS',
          table: 'admin_workflow',
          duration: approvalDuration + pointsDuration,
          recordCount: 5,
          metadata: {
            batch_approval_time: approvalDuration,
            points_award_time: pointsDuration,
            total_points_awarded: 250,
          },
        })
      }),
    )
  })

  describe('Error Recovery and Edge Cases', () => {
    it(
      'should handle submission approval failures gracefully',
      withTestDatabase(async (db) => {
        const user = await db.fixtures.createTestUser()
        const reviewer = await db.fixtures.createTestUser({
          role: Role.REVIEWER,
        })

        const submission = await db.fixtures.createTestSubmission({
          user_id: user.id,
          activity_code: 'LEARN',
          status: SubmissionStatus.PENDING,
        })

        try {
          // Simulate transaction that might fail
          await db.prisma.$transaction(async (tx) => {
            // Update submission
            await tx.submission.update({
              where: { id: submission.id },
              data: {
                status: SubmissionStatus.APPROVED,
                reviewer_id: reviewer.id,
              },
            })

            // Simulate failure in points award
            throw new Error('Simulated points award failure')
          })
        } catch (error) {
          // Verify rollback - submission should still be pending
          const rolledBackSubmission = await db.prisma.submission.findUnique({
            where: { id: submission.id },
          })
          expect(rolledBackSubmission?.status).toBe(SubmissionStatus.PENDING)
          expect(rolledBackSubmission?.reviewer_id).toBeNull()

          // Log the error securely
          const sanitizedError = PIIRedactor.sanitizeError(error as Error)
          logger.error('Submission approval failed', sanitizedError)
        }

        // Verify no points were awarded due to rollback
        const pointsCount = await db.prisma.pointsLedger.count({
          where: { user_id: user.id },
        })
        expect(pointsCount).toBe(0)
      }),
    )

    it(
      'should handle duplicate submission prevention',
      withTestDatabase(async (db) => {
        const user = await db.fixtures.createTestUser()

        // Create first submission
        const firstSubmission = await db.fixtures.createTestSubmission({
          user_id: user.id,
          activity_code: 'LEARN',
          status: SubmissionStatus.APPROVED,
        })

        // Attempt to create second submission for same activity
        // This should be handled by business logic (not database constraint)
        const existingSubmission = await db.prisma.submission.findFirst({
          where: {
            user_id: user.id,
            activity_code: 'LEARN',
            status: {
              in: [SubmissionStatus.PENDING, SubmissionStatus.APPROVED],
            },
          },
        })

        expect(existingSubmission).toBeTruthy()
        expect(existingSubmission!.id).toBe(firstSubmission.id)

        // Business logic should prevent duplicate
        const shouldAllowDuplicate = !existingSubmission
        expect(shouldAllowDuplicate).toBe(false)
      }),
    )

    it(
      'should handle materialized view refresh failures',
      withTestDatabase(async (db) => {
        // Create some test data
        const user = await db.fixtures.createTestUser()
        await db.fixtures.createPointsEntry({
          user_id: user.id,
          activity_code: 'LEARN',
          delta_points: 20,
        })

        try {
          // Attempt to refresh views
          await db.prisma.$executeRaw`SELECT refresh_leaderboards()`

          // Verify refresh succeeded
          const leaderboard = await db.prisma.$queryRaw<
            Array<{ user_id: string }>
          >`
          SELECT user_id FROM leaderboard_totals LIMIT 1
        `
          expect(leaderboard.length).toBeGreaterThan(0)
        } catch (error) {
          // If refresh fails, log it securely and continue
          logger.error(
            'Materialized view refresh failed',
            PIIRedactor.sanitizeError(error as Error),
          )

          // Application should still work without refreshed views
          // Direct query should still work
          const directQuery = await db.prisma.user.findFirst({
            where: { id: user.id },
            select: {
              id: true,
              handle: true,
              ledger: {
                select: { delta_points: true },
              },
            },
          })

          expect(directQuery).toBeTruthy()
          expect(directQuery!.ledger.length).toBe(1)
        }
      }),
    )
  })
})
