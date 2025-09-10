import { getSubmissionById } from '@/lib/services/submissions'
import ReviewClient from './ClientPage'

export default async function Page({ params }: { params: { id: string } }) {
  const { id } = params
  const { submission } = await getSubmissionById(id)
  return <ReviewClient initialSubmission={submission} />
}

