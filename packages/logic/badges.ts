export type Stage = 'LEARN' | 'EXPLORE' | 'AMPLIFY' | 'PRESENT' | 'SHINE'

export interface UserProgress {
  totalPoints: number
  approvedStages: Partial<Record<Stage, boolean>>
  alreadyEarned: Set<string>
}

export function badgesToAward(progress: UserProgress): string[] {
  const toAward: string[] = []
  const pushIf = (code: string, cond: boolean) => {
    if (cond && !progress.alreadyEarned.has(code)) toAward.push(code)
  }

  // Stage badges
  pushIf('LEARN_COMPLETE', !!progress.approvedStages.LEARN)
  pushIf('EXPLORE_COMPLETE', !!progress.approvedStages.EXPLORE)
  pushIf('AMPLIFY_ACTIVATED', !!progress.approvedStages.AMPLIFY)
  pushIf('PRESENT_COMPLETE', !!progress.approvedStages.PRESENT)

  // Milestones
  pushIf('RISING_STAR', progress.totalPoints >= 50)
  pushIf('TRAILBLAZER', progress.totalPoints >= 100)
  pushIf('CHAMPION', progress.totalPoints >= 200)

  return toAward
}

