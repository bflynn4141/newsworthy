export interface ParsedContent {
  title: string | null
  description: string | null
  image_url: string | null
  content_summary: string | null
}

/**
 * Summarize text using Cloudflare Workers AI.
 * Returns 1-2 clean sentences, no truncation.
 */
export async function summarizeWithAI(ai: Ai, text: string): Promise<string | null> {
  if (!text || text.length < 20) return null

  try {
    const response = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        {
          role: 'system',
          content: 'You summarize tweets and news into 1-2 clean, complete sentences. Never truncate or use ellipsis. Be factual and concise. Output ONLY the summary, nothing else.'
        },
        {
          role: 'user',
          content: `Summarize this in 1-2 complete sentences:\n\n${text}`
        }
      ],
      max_tokens: 150,
    }) as { response?: string }

    return response?.response?.trim() || null
  } catch {
    return null
  }
}

/**
 * Fetch a URL and extract basic metadata using HTML parsing.
 *
 * Extracts og:title, og:description, og:image, and a text summary from
 * the first ~500 chars of visible body text. No heavy dependencies —
 * uses regex-based extraction which is good enough for news articles.
 */
export async function parseUrl(url: string): Promise<ParsedContent> {
  // Use oEmbed for Twitter/X URLs
  if (/(?:twitter\.com|x\.com)\/\w+\/status\/\d+/.test(url)) {
    return parseTweet(url)
  }

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Newsworthy/1.0 (crypto news aggregator)',
      Accept: 'text/html',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(10_000),
  })

  if (!response.ok) {
    return { title: null, description: null, image_url: null, content_summary: null }
  }

  const html = await response.text()

  const title = extractMeta(html, 'og:title') ?? extractTitle(html)
  const description = extractMeta(html, 'og:description') ?? extractMeta(html, 'description')
  const image_url = extractMeta(html, 'og:image')
  const content_summary = extractBodyText(html, 500)

  return { title, description, image_url, content_summary }
}

/**
 * Parse a tweet using Twitter's free oEmbed API.
 * No API key needed. Returns author name + tweet text.
 */
async function parseTweet(url: string): Promise<ParsedContent> {
  const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=true`

  const res = await fetch(oembedUrl, {
    signal: AbortSignal.timeout(10_000),
  })

  if (!res.ok) {
    return { title: null, description: null, image_url: null, content_summary: null }
  }

  const data = await res.json() as {
    author_name?: string
    author_url?: string
    html?: string
  }

  // Extract plain text from the oEmbed HTML
  const tweetText = data.html
    ? decodeHtmlEntities(
        data.html
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<[^>]+>/g, '')
      )
        .replace(/\s*[—\u2014].*$/s, '') // Remove "— Author (@handle)" footer
        .replace(/pic\.twitter\.com\/\w+/g, '') // Remove pic.twitter.com links
        .replace(/https?:\/\/t\.co\/\w+/g, '') // Remove t.co links
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/,?\s*…\s*$/, '') // Remove trailing ellipsis from Twitter's truncation
    : null

  const authorHandle = data.author_url
    ? '@' + data.author_url.split('/').pop()
    : null

  return {
    title: data.author_name
      ? `${data.author_name}${authorHandle ? ` (${authorHandle})` : ''}`
      : null,
    description: null,
    image_url: null,
    content_summary: tweetText,
  }
}

/** Extract content from a <meta> tag by property or name attribute. */
function extractMeta(html: string, name: string): string | null {
  // Match property="name" or name="name" variants
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${name}["']`, 'i'),
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, 'i'),
  ]

  for (const pattern of patterns) {
    const match = pattern.exec(html)
    if (match?.[1]) return decodeHtmlEntities(match[1])
  }

  return null
}

/** Extract the <title> tag content. */
function extractTitle(html: string): string | null {
  const match = /<title[^>]*>([^<]+)<\/title>/i.exec(html)
  return match?.[1] ? decodeHtmlEntities(match[1].trim()) : null
}

/** Extract visible body text, stripped of HTML tags and trimmed. */
function extractBodyText(html: string, maxLength: number): string | null {
  // Remove script, style, and nav elements
  let cleaned = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')

  // Try to find the article or main content area
  const articleMatch = /<article[^>]*>([\s\S]*?)<\/article>/i.exec(cleaned)
  const mainMatch = /<main[^>]*>([\s\S]*?)<\/main>/i.exec(cleaned)
  if (articleMatch) cleaned = articleMatch[1]
  else if (mainMatch) cleaned = mainMatch[1]

  // Strip remaining tags, collapse whitespace
  const text = cleaned
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!text || text.length < 20) return null

  return text.length > maxLength ? text.slice(0, maxLength) + '...' : text
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&mdash;/g, '\u2014')
    .replace(/&ndash;/g, '\u2013')
    .replace(/&hellip;/g, '\u2026')
}
