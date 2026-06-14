/* ═══════════════════════════════════════
   EMBEDDING SERVICE — GócHọc AI
   RAG Pipeline: pgvector + Gemini Embedding
   
   Workflow:
   1. GV nạp tài liệu (knowledge_text) → chunk text
   2. Gọi Gemini Embedding API → vector 768d
   3. Lưu vào station_embeddings (pgvector)
   4. Khi HS hỏi → embed câu hỏi → similarity search
   ═══════════════════════════════════════ */

import { supabase } from '@/lib/supabase'

// ─── CẤU HÌNH ──────────────────────────────

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || ''
const EMBEDDING_MODEL = 'text-embedding-004'
const EMBEDDING_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`

const CHUNK_SIZE = 500      // ký tự / chunk
const CHUNK_OVERLAP = 100   // overlap giữa các chunk
const MAX_RESULTS = 5       // số kết quả trả về
const SIMILARITY_THRESHOLD = 0.65

// ─── TYPES ──────────────────────────────────

export interface EmbeddingChunk {
  content: string
  embedding: number[]
  metadata?: Record<string, unknown>
}

export interface SearchResult {
  id: string
  content: string
  similarity: number
}

// ─── CHUNKING ───────────────────────────────

/**
 * Chia văn bản thành các chunk nhỏ với overlap.
 * Ưu tiên cắt theo đoạn (paragraph) hoặc câu.
 */
export function chunkText(text: string): string[] {
  if (!text || text.trim().length === 0) return []

  // Tách theo đoạn trước
  const paragraphs = text.split(/\n{2,}/).filter(p => p.trim().length > 0)
  
  const chunks: string[] = []

  for (const para of paragraphs) {
    if (para.length <= CHUNK_SIZE) {
      chunks.push(para.trim())
    } else {
      // Đoạn dài → cắt theo câu với overlap
      const sentences = para.split(/(?<=[.!?。])\s+/)
      let currentChunk = ''

      for (const sentence of sentences) {
        if ((currentChunk + ' ' + sentence).length > CHUNK_SIZE && currentChunk.length > 0) {
          chunks.push(currentChunk.trim())
          // Overlap: giữ lại phần cuối
          const words = currentChunk.split(' ')
          const overlapWords = Math.ceil(CHUNK_OVERLAP / 5) // ~5 chars/word
          currentChunk = words.slice(-overlapWords).join(' ') + ' ' + sentence
        } else {
          currentChunk = currentChunk ? currentChunk + ' ' + sentence : sentence
        }
      }

      if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim())
      }
    }
  }

  return chunks
}

// ─── GEMINI EMBEDDING API ───────────────────

/**
 * Tạo embedding vector cho 1 đoạn text.
 * Trả về mảng 768 chiều.
 */
export async function embedText(text: string, apiKey?: string): Promise<number[]>{
  const key = apiKey || localStorage.getItem('gemini_api_key') || localStorage.getItem('VITE_gemini_api_key') || localStorage.getItem('VITE_GEMINI_API_KEY') || GEMINI_API_KEY
  if (!key) {
    // Fallback: trả về zero vector khi chưa có API key
    console.warn('⚠️ Gemini API key chưa cấu hình, dùng zero vector')
    return new Array(768).fill(0)
  }

  const response = await fetch(`${EMBEDDING_API_URL}?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${EMBEDDING_MODEL}`,
      content: {
        parts: [{ text }],
      },
      taskType: 'RETRIEVAL_DOCUMENT',
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Embedding API error:', errorText)
    throw new Error(`Embedding API lỗi: ${response.status}`)
  }

  const data = await response.json()
  return data.embedding?.values ?? []
}

/**
 * Tạo embedding cho truy vấn (query).
 * Dùng taskType khác để tối ưu retrieval.
 */
export async function embedQuery(text: string, apiKey?: string): Promise<number[]> {
  const key = apiKey || localStorage.getItem('gemini_api_key') || localStorage.getItem('VITE_gemini_api_key') || localStorage.getItem('VITE_GEMINI_API_KEY') || GEMINI_API_KEY
  if (!key) {
    return new Array(768).fill(0)
  }

  const response = await fetch(`${EMBEDDING_API_URL}?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${EMBEDDING_MODEL}`,
      content: {
        parts: [{ text }],
      },
      taskType: 'RETRIEVAL_QUERY',
    }),
  })

  if (!response.ok) {
    throw new Error(`Embedding query API lỗi: ${response.status}`)
  }

  const data = await response.json()
  return data.embedding?.values ?? []
}

// ─── INDEX TĂNG KIẾN THỨC ───────────────────

/**
 * Index kiến thức cho 1 station:
 * 1. Chunk text
 * 2. Embed từng chunk
 * 3. Lưu vào station_embeddings
 * 
 * Gọi khi GV lưu knowledge_text cho station.
 */
export async function indexStationKnowledge(
  stationId: string,
  knowledgeText: string,
  apiKey?: string
): Promise<{ chunksIndexed: number }> {
  // 1. Xóa embeddings cũ
  await supabase
    .from('station_embeddings')
    .delete()
    .eq('station_id', stationId)

  if (!knowledgeText || knowledgeText.trim().length === 0) {
    return { chunksIndexed: 0 }
  }

  // 2. Chunk
  const chunks = chunkText(knowledgeText)

  // 3. Embed từng chunk (batch 5 requests / lần để tránh rate limit)
  const batchSize = 5
  const rows: { station_id: string; content: string; embedding: string; metadata: Record<string, unknown> }[] = []

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize)
    const embeddings = await Promise.all(batch.map(c => embedText(c, apiKey)))

    for (let j = 0; j < batch.length; j++) {
      rows.push({
        station_id: stationId,
        content: batch[j],
        embedding: JSON.stringify(embeddings[j]),
        metadata: { chunkIndex: i + j, totalChunks: chunks.length },
      })
    }
  }

  // 4. Insert vào DB
  if (rows.length > 0) {
    const { error } = await supabase
      .from('station_embeddings')
      .insert(rows as any)

    if (error) {
      console.error('Lưu embeddings thất bại:', error)
      throw new Error(`Lưu embeddings thất bại: ${error.message}`)
    }
  }

  return { chunksIndexed: rows.length }
}

// ─── SEMANTIC SEARCH ────────────────────────

/**
 * Tìm kiếm kiến thức liên quan đến câu hỏi.
 * Sử dụng RPC function `match_station_knowledge` (cosine similarity).
 */
export async function searchKnowledge(
  stationId: string,
  query: string,
  apiKey?: string
): Promise<SearchResult[]> {
  // 1. Embed câu hỏi
  const queryEmbedding = await embedQuery(query, apiKey)

  // 2. Gọi RPC function
  const { data, error } = await supabase
    .rpc('match_station_knowledge', {
      query_embedding: JSON.stringify(queryEmbedding),
      match_station_id: stationId,
      match_threshold: SIMILARITY_THRESHOLD,
      match_count: MAX_RESULTS,
    })

  if (error) {
    console.error('Semantic search thất bại:', error)
    // Fallback: trả về rỗng thay vì crash
    return []
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    content: row.content,
    similarity: row.similarity,
  }))
}

/**
 * Tìm kiến thức và format thành context string cho LLM.
 * Dùng trực tiếp trong chatService.
 */
export async function getRAGContext(
  stationId: string,
  query: string,
  apiKey?: string
): Promise<string> {
  try {
    const results = await searchKnowledge(stationId, query, apiKey)

    if (results.length === 0) return ''

    const contextParts = results.map(
      (r, i) => `[Đoạn ${i + 1} — Độ liên quan: ${(r.similarity * 100).toFixed(0)}%]\n${r.content}`
    )

    return `\n## Kiến thức liên quan (RAG Search):\n${contextParts.join('\n\n')}\n`
  } catch (err) {
    console.error('RAG context thất bại:', err)
    return ''
  }
}
