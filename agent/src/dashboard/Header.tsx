import React from 'react'
import { Box, Text } from 'ink'
import { formatUnits } from 'viem'
import type { RegistryConfig, LlmStatus } from './useFeedData.js'

function shortToken(amount: bigint, decimals: number): string {
  const full = formatUnits(amount, decimals)
  const dot = full.indexOf('.')
  if (dot === -1) return full
  return full.slice(0, dot + 3) // 2 decimal places
}

function formatCountdown(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

type Props = {
  isTest: boolean
  config: RegistryConfig | null
  totalItems: number
  balance: bigint
  newsBalance: bigint
  withdrawable: bigint
  dailySubmissions: number
  dailyResetIn: number
  llm: LlmStatus
  flaggedCount?: number
  showFlagged?: boolean
}

export default function Header({ isTest, config, totalItems, balance, newsBalance, withdrawable, dailySubmissions, dailyResetIn, llm, flaggedCount, showFlagged }: Props) {
  const maxDaily = config ? Number(config.maxDailySubmissions) : 3
  const remaining = maxDaily - dailySubmissions

  return (
    <Box flexDirection="column">
      <Box justifyContent="space-between">
        <Text>
          <Text bold>NEWSWORTHY</Text>
          {'  \u25B8 '}
          <Text color={isTest ? 'yellow' : 'green'}>{isTest ? 'test' : 'mainnet'}</Text>
          {'  '}
          Items: {totalItems}
          {flaggedCount ? (
            <Text dimColor>  ({flaggedCount} flagged{showFlagged ? ', shown' : ', hidden'})</Text>
          ) : null}
        </Text>
        <Text>
          {config ? `${shortToken(balance, config.tokenDecimals)} ${config.tokenSymbol}` : '...'}
          {'  \u2502  '}
          {config ? `${shortToken(newsBalance, 18)} $NEWS` : '...'}
          {'  \u2502  '}
          {config && withdrawable > 0n ? (
            <Text color="green">{shortToken(withdrawable, config.tokenDecimals)} {config.tokenSymbol} claimable</Text>
          ) : (
            <Text dimColor>nothing to claim</Text>
          )}
        </Text>
      </Box>
      <Box justifyContent="space-between">
        <Text>
          Today: <Text bold color={remaining > 0 ? 'green' : 'red'}>{dailySubmissions}/{maxDaily}</Text> submitted
          {'  '}
          {remaining > 0 ? (
            <Text dimColor>({remaining} left, resets in {formatCountdown(dailyResetIn)})</Text>
          ) : (
            <Text color="yellow">limit reached — resets in {formatCountdown(dailyResetIn)}</Text>
          )}
        </Text>
        {llm.available ? (
          <Text dimColor>LLM: {llm.model}</Text>
        ) : (
          <Text dimColor>No LLM</Text>
        )}
      </Box>
    </Box>
  )
}
