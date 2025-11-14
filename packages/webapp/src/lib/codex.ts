/**
 * Codex Agent Integration
 * 
 * Utility functions for interacting with OpenAI Codex/API
 * Requires OPENAI_API_KEY environment variable to be set
 */

interface CodexRequestOptions {
  prompt: string
  model?: string
  maxTokens?: number
  temperature?: number
  systemPrompt?: string
}

interface CodexResponse {
  content: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

/**
 * Get Codex configuration from environment variables
 */
function getCodexConfig() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set')
  }

  return {
    apiKey,
    // Default to gpt-4o for best balance of speed/quality
    // Alternatives: gpt-4o-mini (cheaper), gpt-4-turbo (more thorough), gpt-3.5-turbo (fastest/cheapest)
    model: process.env.CODEX_MODEL || 'gpt-4o',
    maxTokens: parseInt(process.env.CODEX_MAX_TOKENS || '4096', 10),
    temperature: parseFloat(process.env.CODEX_TEMPERATURE || '0.7'),
    timeout: parseInt(process.env.CODEX_TIMEOUT || '30000', 10),
    apiUrl: 'https://api.openai.com/v1/chat/completions',
  }
}

/**
 * Make a request to OpenAI Codex API
 * 
 * @param options - Request options
 * @returns Promise with Codex response
 */
export async function codexRequest(
  options: CodexRequestOptions
): Promise<CodexResponse> {
  const config = getCodexConfig()
  
  const messages: Array<{ role: string; content: string }> = []
  
  if (options.systemPrompt) {
    messages.push({
      role: 'system',
      content: options.systemPrompt,
    })
  }
  
  messages.push({
    role: 'user',
    content: options.prompt,
  })

  const requestBody = {
    model: options.model || config.model,
    messages,
    max_tokens: options.maxTokens || config.maxTokens,
    temperature: options.temperature ?? config.temperature,
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), config.timeout)

  try {
    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }))
      throw new Error(
        `Codex API error: ${error.error?.message || response.statusText} (${response.status})`
      )
    }

    const data = await response.json()
    
    const content = data.choices[0]?.message?.content || ''
    
    return {
      content,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
    }
  } catch (error) {
    clearTimeout(timeoutId)
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error(`Codex request timed out after ${config.timeout}ms`)
      }
      throw error
    }
    
    throw new Error('Unknown error occurred during Codex request')
  }
}

/**
 * Generate code using Codex
 * 
 * @param prompt - Description of code to generate
 * @param language - Programming language (optional)
 * @returns Generated code
 */
export async function generateCode(
  prompt: string,
  language?: string
): Promise<string> {
  const systemPrompt = language
    ? `You are an expert ${language} programmer. Generate clean, well-documented code.`
    : 'You are an expert programmer. Generate clean, well-documented code.'

  const response = await codexRequest({
    prompt,
    systemPrompt,
    temperature: 0.3, // Lower temperature for code generation
  })

  return response.content
}

/**
 * Refactor code using Codex
 * 
 * @param code - Code to refactor
 * @param instructions - Refactoring instructions
 * @returns Refactored code
 */
export async function refactorCode(
  code: string,
  instructions: string
): Promise<string> {
  const prompt = `Refactor the following code according to these instructions: ${instructions}\n\nCode:\n\`\`\`\n${code}\n\`\`\``

  const response = await codexRequest({
    prompt,
    systemPrompt: 'You are an expert code refactoring assistant. Improve code quality while maintaining functionality.',
    temperature: 0.2, // Very low temperature for refactoring
  })

  return response.content
}

/**
 * Explain code using Codex
 * 
 * @param code - Code to explain
 * @returns Explanation
 */
export async function explainCode(code: string): Promise<string> {
  const prompt = `Explain what this code does:\n\n\`\`\`\n${code}\n\`\`\``

  const response = await codexRequest({
    prompt,
    systemPrompt: 'You are a helpful code explanation assistant. Provide clear, concise explanations.',
    temperature: 0.5,
  })

  return response.content
}

