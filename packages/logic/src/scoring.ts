import type { ActivityCode, ActivityPayload, AmplifyInput } from '@elevate/types'

export function computePoints(activity: ActivityCode, payload: ActivityPayload): number {
  switch (activity) {
    case 'LEARN':
      return 20
    case 'EXPLORE':
      return 50
    case 'AMPLIFY': {
      const amplifyPayload = payload as AmplifyInput
      const peers = Number(amplifyPayload?.peersTrained ?? 0)
      const students = Number(amplifyPayload?.studentsTrained ?? 0)
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

