export type ActivityCode = 'LEARN' | 'EXPLORE' | 'AMPLIFY' | 'PRESENT' | 'SHINE'

export function computePoints(activity: ActivityCode, payload: any): number {
  switch (activity) {
    case 'LEARN':
      return 20
    case 'EXPLORE':
      return 50
    case 'AMPLIFY': {
      const peers = Number(payload?.peersTrained ?? 0)
      const students = Number(payload?.studentsTrained ?? 0)
      // Caps (proposal) — enforce upstream in validation too
      const capPeers = Math.min(peers, 50)
      const capStudents = Math.min(students, 200)
      return capPeers * 2 + capStudents * 1
    }
    case 'PRESENT':
      return 20
    case 'SHINE':
      return 0
    default:
      return 0
  }
}

