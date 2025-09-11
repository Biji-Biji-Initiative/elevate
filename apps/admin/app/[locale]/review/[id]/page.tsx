import { getSubmissionById } from '@/lib/services/submissions'

import ReviewClient from './ClientPage'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { submission } = await getSubmissionById(id)
  return <ReviewClient initialSubmission={submission} />
}
