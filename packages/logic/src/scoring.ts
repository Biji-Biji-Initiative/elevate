import type { ActivityCode, AmplifyInput } from '@elevate/types'

export function computePoints(activity: ActivityCode, payload: unknown): number {
  switch (activity) {
    case 'LEARN':
      return 20
    case 'EXPLORE':
      return 50
    case 'AMPLIFY': {
      const amplifyPayload = payload as AmplifyInput
      const peers = Number((amplifyPayload as { peers_trained?: unknown })?.peers_trained ?? 0)
      const students = Number((amplifyPayload as { students_trained?: unknown })?.students_trained ?? 0)
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
