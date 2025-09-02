import { withRoleGuard } from '@elevate/auth/context'

function QueuePage() {
  return (
    <main style={{ padding: 24, fontFamily: 'system-ui' }}>
      <h1>Pending Submissions</h1>
      <p>Filter by stage; open items to review. Placeholder list.</p>
      <ul>
        <li>—</li>
      </ul>
    </main>
  )
}

export default withRoleGuard(QueuePage, ['reviewer', 'admin', 'superadmin'])

