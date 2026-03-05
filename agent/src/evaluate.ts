// Evaluate a URL for newsworthiness
// Returns a score 0-100 and a recommended action (submit / skip / challenge)
//
// Scoring rubric (each criterion 0-20, total 0-100):
//   1. Novelty       — new information, or rehash of known events?
//   2. Verifiability  — on-chain tx, primary source, or hearsay?
//   3. Impact         — affects protocols, users, markets materially?
//   4. Signal:Noise   — real news or engagement farming / rage-bait?
//   5. Source quality  — reputable outlet / known shill account?
//
// Action thresholds:
//   >= 60  → submit   (newsworthy, worth bonding ETH on)
//   40-59  → skip     (borderline, not worth the bond risk)
//   < 40   → challenge (if already submitted by someone else)

export interface CriteriaScores {
  novelty: number        // 0-20
  verifiability: number  // 0-20
  impact: number         // 0-20
  signalToNoise: number  // 0-20
  sourceQuality: number  // 0-20
}

export interface EvaluationResult {
  score: number                              // 0-100 (sum of criteria)
  action: 'submit' | 'skip' | 'challenge'
  reasoning: string
  criteria: CriteriaScores
}

const SUBMIT_THRESHOLD = 60
const CHALLENGE_THRESHOLD = 40

export async function evaluate(
  url: string,
  content: string,
): Promise<EvaluationResult> {
  // TODO: call LLM API (e.g. Claude) with structured output for scoring
  // For now, return a neutral placeholder so the pipeline compiles
  const criteria: CriteriaScores = {
    novelty: 10,
    verifiability: 10,
    impact: 10,
    signalToNoise: 10,
    sourceQuality: 10,
  }

  const score =
    criteria.novelty +
    criteria.verifiability +
    criteria.impact +
    criteria.signalToNoise +
    criteria.sourceQuality

  const action: EvaluationResult['action'] =
    score >= SUBMIT_THRESHOLD
      ? 'submit'
      : score < CHALLENGE_THRESHOLD
        ? 'challenge'
        : 'skip'

  return {
    score,
    action,
    reasoning: 'Stub evaluation — replace with LLM-powered scoring',
    criteria,
  }
}
