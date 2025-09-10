## LEAPS: Elevate Indonesia — Project Brief

Got it—the homepage sells Elevate Indonesia; the tracker is just the engine behind it. Here's a crisp brief your coding agent can run with.

1. What this site is (in one line)

A public program site for Microsoft Elevate Indonesia that invites educators to join, explains the LEAPS journey, and showcases impact; the dashboard + admin are supporting surfaces for submissions, points, and leaderboard. ￼

Program pillars to reflect on the homepage
• Purpose: empower educators to use AI on real classroom challenges; structured learning → implementation → large-scale knowledge cascading. ￼
• Journey: Learn (20) → Explore (50) → Amplify (2/peer, 1/student) → Present (20) → Shine (recognition). ￼
• Signal: public Top-20 leaderboard and visible progress. ￼
• Scale cues: targets like 25k micro-credentials and 5k Microsoft Certified Educator. ￼

⸻

2. Information Architecture (pages & what each needs)

Public pages (the “site”) 1. Home “Elevate Indonesia” (/)
• Hero: program title, 1-sentence purpose, CTA: Sign in with Google (Clerk).
• Why it matters: short copy on uplifting educators with AI (Bahasa + English). ￼
• LEAPS Overview: 5 tiles with points + one-line action for each stage. ￼
• Impact strip: live counters (participants, Learn certificates, Explore lessons, Amplify attendees, Present stories). ￼
• Targets snapshot: “25k micro-credentials”, “5k MCE”, etc. ￼
• How to join: 3 steps (Sign in → Complete Learn → Continue LEAPS).
• Spotlight: mini Top-20 preview; link to leaderboard. ￼
• Partners/flow teaser: simple diagram or bullet list referencing the national roll-out and master trainers. ￼
• Footer: FAQ + contacts (emails/phones from deck). ￼ 2. Leaderboard (/leaderboard)
• Table of Top-20 with name/school/points; toggle All-time / 30-day. ￼ 3. Metrics (/metrics/learn|explore|amplify|present)
• Public counters + short explainer per stage; no PII. ￼ 4. Public Profile (/u/[handle])
• Participant’s avatar, badges, approved-and-public submissions (evidence cards), links to their Present story.

Participant pages (the “how it works”) 5. Dashboard (/dashboard)
• LEAPS progress cards, total points, badge strip.
• Links to each stage’s form & history of what they submitted. 6. LEAPS forms (/dashboard/learn|explore|amplify|present|shine)
• Learn: certificate upload (or auto-credit via Kajabi).
• Explore: reflection + classroom evidence.
• Amplify: peer/student counts + attendance proof (caps).
• Present: LinkedIn URL + screenshot upload (no LinkedIn API).
• Shine: idea summary (recognition).
• All built with shadcn/ui forms + RHF + zod; each form has a “Make Public” toggle.

Admin pages (review & ops) 7. Admin Console (/admin/\*, Next Admin)
• Submissions queue: preview evidence, approve/reject (+points), notes.
• Users/Badges/Exports; Kajabi reconciliation (unmatched emails).

⸻

3. Page-level copy scaffolds (give writers a head start)

Home/Hero

Elevate Indonesia: Unlocking AI in Education.
Join the LEAPS journey—learn, apply, amplify, present, and shine. Start with a 1-hour course and climb the leaderboard.

LEAPS tiles (one-liners)
• Learn (20): Complete an approved AI course and upload your certificate.
• Explore (50): Apply AI in your classroom—share a brief reflection and evidence.
• Amplify (2/peer • 1/student): Run a session; submit attendance proof.
• Present (20): Post your story on LinkedIn; include the link and screenshot.
• Shine: Share a standout idea for recognition.

Consent blurb (on submit)

Only approved items you mark Public appear on your profile.

⸻

4. Integrations & constraints (so devs don’t guess)
   • Auth: Clerk (Google only).
   • DB: Supabase Postgres; Prisma client; storage for uploads.
   • Kajabi: Webhook for course/tag completion → matches by email → auto-award Learn. If not available, Learn remains via certificate upload. ￼
   • LinkedIn: no API; require URL + screenshot.
   • Leaderboard/Metrics: public read of aggregate views; no PII on metrics pages.

⸻

5. Acceptance criteria (MVP)
   • Home communicates program purpose, LEAPS, targets, and has a single primary CTA; copy aligns with deck wording. ￼
   • Dashboard shows five stages, current points, badges; each stage has a working shadcn form and shows past submissions.
   • Public Profile lists only approved + public submissions.
   • Leaderboard shows Top-20 and updates within ~1 minute of approvals. ￼
   • Kajabi webhook credits Learn when matched by email; unmatched events appear in Admin for manual resolve.
   • RBAC: participant, reviewer, admin; admin actions are logged.

⸻

6. Asset checklist for the homepage
   • Program logo lockups, partner logos.
   • Two short paragraphs (Bahasa + English) explaining Elevate Indonesia’s mission and cascade model. ￼
   • LEAPS icons/illustrations + point values. ￼
   • Impact stats (targets & live counters). ￼
   • 3–5 photos for “in the classroom” montage.
   • Contact details (from deck) for footer. ￼

⸻

If you want, I can convert this into a Notion one-pager and a CSV backlog that mirrors these pages with tasks/AC so your agent can import and execute immediately.
