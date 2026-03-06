import type { MetricsCollector, TickSnapshot } from "../metrics/collector.js";
import type { SimConfig } from "../config.js";
import type { Agent, AgentArchetype } from "../agents/base.js";

const SPARKLINE_CHARS = "▁▂▃▄▅▆▇█";

function sparkline(data: number[]): string {
  if (data.length === 0) return "";
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  return data
    .map((v) => {
      const idx = Math.min(
        SPARKLINE_CHARS.length - 1,
        Math.floor(((v - min) / range) * (SPARKLINE_CHARS.length - 1)),
      );
      return SPARKLINE_CHARS[idx];
    })
    .join("");
}

// Downsample for sparkline display
function downsample(data: number[], maxPoints: number): number[] {
  if (data.length <= maxPoints) return data;
  const step = data.length / maxPoints;
  const result: number[] = [];
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.floor(i * step);
    result.push(data[idx]);
  }
  return result;
}

function pad(s: string, len: number): string {
  return s.padEnd(len);
}

function rpad(s: string, len: number): string {
  return s.padStart(len);
}

function fmt(n: number, decimals = 2): string {
  return n.toFixed(decimals);
}

function fmtUSD(n: number): string {
  return `$${n.toFixed(4)}`;
}

function pctChange(start: number, end: number): string {
  if (start === 0) return "+inf%";
  const pct = ((end - start) / start) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

export function printReport(
  config: SimConfig,
  metrics: MetricsCollector,
  agents: Agent[],
): void {
  const snapshots = metrics.snapshots;
  if (snapshots.length === 0) {
    console.log("No data collected.");
    return;
  }

  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];
  const startingValue = config.startingUSDC + config.startingNEWS * (config.ammSeedUSDC / config.ammSeedNEWS);

  console.log("");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  NEWSWORTHY ECONOMIC SIMULATION — RESULTS");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("");

  // Parameters
  console.log("  Parameters");
  console.log("  ──────────");
  console.log(`  Bond:       ${config.bondAmount} USDC    Challenge:  ${config.challengePeriod} tick(s)`);
  console.log(`  Voting:     ${config.votingPeriod} tick(s)    Min votes:  ${config.minVotes}`);
  console.log(`  NEWS/item:  ${config.newsPerItem}         Max daily:  ${config.maxDailySubmissions}`);
  console.log(`  Duration:   ${config.totalTicks} ticks (${config.totalTicks / config.ticksPerDay} days)    Seed: ${config.seed}`);
  console.log(`  Agents:     ${agents.length} (${Object.entries(config.agentCounts).map(([k, v]) => `${v} ${k}`).join(", ")})`);
  console.log("");

  // Sparklines
  const maxSpark = 60;
  const qualityData = downsample(metrics.timeSeries("feedQuality"), maxSpark);
  const priceData = downsample(metrics.timeSeries("newsPrice"), maxSpark);
  const revenueData = downsample(metrics.timeSeries("revenue"), maxSpark);
  const stakedData = downsample(metrics.timeSeries("totalStaked"), maxSpark);

  console.log("  Feed Quality    " + sparkline(qualityData));
  console.log(`                  ${fmt(first.feedQuality)} → ${fmt(last.feedQuality)}  avg: ${fmt(metrics.average("feedQuality"))}`);
  console.log("");

  console.log("  NEWS Price      " + sparkline(priceData));
  console.log(`                  ${fmtUSD(first.newsPrice)} → ${fmtUSD(last.newsPrice)}  (${pctChange(first.newsPrice, last.newsPrice)})`);
  console.log("");

  console.log("  Revenue/tick    " + sparkline(revenueData));
  console.log(`                  ${fmtUSD(first.revenue)} → ${fmtUSD(last.revenue)}  total: ${fmtUSD(revenueData.reduce((a, b) => a + b, 0))}`);
  console.log("");

  console.log("  Total Staked    " + sparkline(stakedData));
  console.log(`                  ${fmt(first.totalStaked, 0)} → ${fmt(last.totalStaked, 0)} NEWS`);
  console.log("");

  // Item stats
  const totalSubmitted = snapshots.reduce((a, s) => a + s.itemsSubmitted, 0);
  const totalAccepted = snapshots.reduce((a, s) => a + s.itemsAccepted, 0);
  const totalRejected = snapshots.reduce((a, s) => a + s.itemsRejected, 0);
  const totalChallenged = snapshots.reduce((a, s) => a + s.itemsChallenged, 0);

  console.log("  Feed Activity");
  console.log("  ─────────────");
  console.log(`  Submitted: ${totalSubmitted}   Accepted: ${totalAccepted}   Rejected: ${totalRejected}   Challenged: ${totalChallenged}`);
  console.log(`  Acceptance rate: ${totalSubmitted > 0 ? fmt((totalAccepted / totalSubmitted) * 100, 1) : "0"}%   Challenge rate: ${totalSubmitted > 0 ? fmt((totalChallenged / totalSubmitted) * 100, 1) : "0"}%`);
  console.log("");

  // Agent P&L leaderboard
  console.log("  Agent P&L Leaderboard");
  console.log("  ─────────────────────");
  console.log(
    `  ${pad("Agent", 22)} ${pad("Type", 18)} ${rpad("USDC", 8)} ${rpad("NEWS", 10)} ${rpad("Staked", 10)} ${rpad("Total $", 10)} ${rpad("P&L", 10)}`,
  );
  console.log("  " + "─".repeat(88));

  const agentPnL: { name: string; archetype: AgentArchetype; pnl: number; total: number; snap: any }[] = [];

  for (const agent of agents) {
    const snap = last.agentSnapshots.get(agent.name);
    if (!snap) continue;
    const pnl = snap.totalValue - startingValue;
    agentPnL.push({ name: agent.name, archetype: agent.archetype, pnl, total: snap.totalValue, snap });
  }

  agentPnL.sort((a, b) => b.pnl - a.pnl);

  for (const { name, archetype, pnl, snap } of agentPnL) {
    const pnlStr = pnl >= 0 ? `+${fmt(pnl)}` : fmt(pnl);
    console.log(
      `  ${pad(name, 22)} ${pad(archetype, 18)} ${rpad(fmt(snap.usdc), 8)} ${rpad(fmt(snap.news, 0), 10)} ${rpad(fmt(snap.staked, 0), 10)} ${rpad(fmt(snap.totalValue), 10)} ${rpad(pnlStr, 10)}`,
    );
  }
  console.log("");

  // Strategy comparison
  console.log("  Strategy Comparison (avg P&L by archetype)");
  console.log("  ──────────────────────────────────────────");

  const archetypeGroups = new Map<AgentArchetype, number[]>();
  for (const a of agentPnL) {
    const group = archetypeGroups.get(a.archetype) ?? [];
    group.push(a.pnl);
    archetypeGroups.set(a.archetype, group);
  }

  const archetypeAvgs: { archetype: AgentArchetype; avg: number; count: number }[] = [];
  for (const [archetype, pnls] of archetypeGroups) {
    const avg = pnls.reduce((a, b) => a + b, 0) / pnls.length;
    archetypeAvgs.push({ archetype, avg, count: pnls.length });
  }
  archetypeAvgs.sort((a, b) => b.avg - a.avg);

  for (const { archetype, avg, count } of archetypeAvgs) {
    const bar = avg >= 0 ? "█".repeat(Math.min(30, Math.floor(avg * 5))) : "░".repeat(Math.min(30, Math.floor(-avg * 5)));
    const sign = avg >= 0 ? "+" : "";
    console.log(`  ${pad(archetype, 20)} (${count}) ${sign}${fmt(avg)} USDC  ${bar}`);
  }
  console.log("");

  // Key findings
  console.log("  Key Findings");
  console.log("  ────────────");

  const honestAvg = archetypeGroups.get("honest_curator")
    ? archetypeGroups.get("honest_curator")!.reduce((a, b) => a + b, 0) / archetypeGroups.get("honest_curator")!.length
    : 0;
  const profitAvg = archetypeGroups.get("profit_maximizer")
    ? archetypeGroups.get("profit_maximizer")!.reduce((a, b) => a + b, 0) / archetypeGroups.get("profit_maximizer")!.length
    : 0;
  const collusionAvg = archetypeGroups.get("colluding_ring")
    ? archetypeGroups.get("colluding_ring")!.reduce((a, b) => a + b, 0) / archetypeGroups.get("colluding_ring")!.length
    : 0;
  const spamAvg = archetypeGroups.get("spam_bot")
    ? archetypeGroups.get("spam_bot")!.reduce((a, b) => a + b, 0) / archetypeGroups.get("spam_bot")!.length
    : 0;

  const honestPremium = honestAvg - profitAvg;
  console.log(`  Honest curation premium:   ${honestPremium >= 0 ? "+" : ""}${fmt(honestPremium)} USDC over profit maximizers`);
  console.log(`  Spam bot total loss:       ${fmt(spamAvg)} USDC (avg per bot)`);
  console.log(`  Collusion ring profit:     ${collusionAvg >= 0 ? "+" : ""}${fmt(collusionAvg)} USDC (avg per member)`);
  console.log(`  Feed quality correlation:  avg quality ${fmt(metrics.average("feedQuality"))} → avg revenue ${fmtUSD(metrics.average("revenue"))}/tick`);
  console.log("");

  // Verdict
  const hasSpam = archetypeGroups.has("spam_bot");
  const hasCollusion = archetypeGroups.has("colluding_ring");
  const spamProfitable = hasSpam && spamAvg >= 0;
  const collusionDominant = hasCollusion && collusionAvg > honestAvg;

  console.log("  ══════════════════════════════════════════════");
  if (collusionDominant) {
    console.log("  VERDICT: COLLUSION is profitable — parameters need tuning!");
    console.log(`  Ring earns ${fmt(collusionAvg - honestAvg)} more than honest curators.`);
    console.log("  Consider: higher bonds, longer voting, more min votes.");
  } else if (spamProfitable) {
    console.log("  VERDICT: SPAM is profitable — bonds too low or challenge window too short!");
    console.log(`  Spam bots earn +${fmt(spamAvg)} USDC. Honest curators still lead (+${fmt(honestAvg)}).`);
  } else if (honestAvg > 0 && (!hasSpam || spamAvg < 0) && (!hasCollusion || honestAvg > collusionAvg)) {
    console.log("  VERDICT: Honest curation IS the dominant strategy");
    if (hasSpam) console.log(`  Spam bots lose ${fmt(Math.abs(spamAvg))} USDC.`);
    if (hasCollusion) console.log(`  Collusion ring earns ${fmt(collusionAvg - honestAvg)} less than honest curators.`);
  } else {
    console.log("  VERDICT: Mixed results — review parameter sensitivity.");
  }
  console.log("  ══════════════════════════════════════════════");
  console.log("");
}
