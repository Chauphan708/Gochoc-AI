/* ═══════════════════════════════════════
   TASK RESULT SERVICE — GócHọc AI
   Xử lý nộp bài theo 3 chế độ tính điểm (v5):
   1. Cá nhân (Individual)
   2. Nhóm chia đều (Group Equal)
   3. NT gắn tag (Leader Tag)
   ═══════════════════════════════════════ */

import { supabase } from '@/lib/supabase'
import { addXP, addPoints } from './studentService'
import type { TaskResult, Task, Json } from '@/types/database'

// ─── NỘP BÀI ───────────────────────────────

export interface SubmitTaskInput {
  taskId: string
  groupId: string
  submittedBy: string       // student_id của người bấm nộp
  answer: Json              // câu trả lời
  task: Task                // thông tin nhiệm vụ (để biết scoring_mode)
  taggedStudentIds?: string[] // dành cho mode 'group_leader_tag'
  groupMemberIds?: string[]   // tất cả thành viên nhóm
}

/**
 * Nộp bài và tính điểm tự động theo scoring_mode.
 *
 * - individual: chỉ ghi điểm cho submitted_by
 * - group_equal: ghi điểm cho tất cả groupMemberIds
 * - group_leader_tag: ghi điểm cho taggedStudentIds
 */
export async function submitTask(input: SubmitTaskInput): Promise<TaskResult> {
  const {
    taskId,
    groupId,
    submittedBy,
    answer,
    task,
    taggedStudentIds,
    groupMemberIds,
  } = input

  // 1. Xác định danh sách người nhận điểm
  let submittedFor: string[]
  let scoreDistribution: 'full' | 'equal' | 'weighted'

  switch (task.scoring_mode) {
    case 'individual':
      submittedFor = [submittedBy]
      scoreDistribution = 'full'
      break

    case 'group_equal':
      submittedFor = groupMemberIds ?? [submittedBy]
      scoreDistribution = 'equal'
      break

    case 'group_leader_tag':
      submittedFor = taggedStudentIds ?? [submittedBy]
      scoreDistribution = 'full'
      break

    default:
      submittedFor = [submittedBy]
      scoreDistribution = 'full'
  }

  // 2. Chấm điểm tự động hoặc chờ GV chấm
  const isPendingTeacher = task.grading_mode === 'teacher' && task.type !== 'quiz'
  const { score, maxScore, feedback } = isPendingTeacher
    ? { score: 0, maxScore: task.points, feedback: '⏳ Bài đã nộp — đang chờ GV chấm điểm.' }
    : await autoGrade(task, answer)

  // 3. Tính XP
  const xpEarned = calculateXP(score, maxScore, task.scoring_mode)

  // 4. Lưu kết quả
  const { data: result, error } = await supabase
    .from('task_results')
    .insert({
      task_id: taskId,
      group_id: groupId,
      submitted_by: submittedBy,
      submitted_for: submittedFor,
      answer,
      score,
      max_score: maxScore,
      xp_earned: xpEarned,
      feedback,
      score_distribution: scoreDistribution,
      grading_status: isPendingTeacher ? 'pending_teacher' : 'graded',
    } as any)
    .select()
    .single()

  if (error) throw new Error(`Nộp bài thất bại: ${error.message}`)

  // 5. Cộng điểm và XP cho từng HS (bỏ qua nếu chờ GV chấm)
  if (!isPendingTeacher) {
    const pointsPerStudent =
      scoreDistribution === 'equal'
        ? Math.floor(score / submittedFor.length)
        : score

    const xpPerStudent =
      scoreDistribution === 'equal'
        ? Math.floor(xpEarned / submittedFor.length)
        : xpEarned

    await Promise.all(
      submittedFor.map(async (studentId) => {
        await addPoints(studentId, pointsPerStudent)
        await addXP(studentId, xpPerStudent)
      })
    )
  }

  // 6. Cập nhật số tương tác (soft fail)
  try {
    const { data: studentData } = await supabase
      .from('students')
      .select('total_interactions')
      .eq('id', submittedBy)
      .single()
    
    if (studentData) {
      await supabase
        .from('students')
        .update({ total_interactions: (studentData as any).total_interactions + 1 } as any)
        .eq('id', submittedBy)
    }
  } catch {
    // Soft fail nếu cập nhật thất bại
  }

  return result
}

// ─── CHẤM ĐIỂM TỰ ĐỘNG ────────────────────

async function autoGrade(
  task: Task,
  answer: Json
): Promise<{ score: number; maxScore: number; feedback: string }> {
  const maxScore = task.points

  if (task.type === 'quiz') {
    return gradeQuiz(task.content, answer, maxScore)
  }

  if (task.type === 'short_answer') {
    return await gradeShortAnswerSemantic(task, answer, maxScore)
  }

  if (task.type === 'photo_upload') {
    return await gradePhotoWithVision(task, answer, maxScore)
  }

  if (task.type === 'practice') {
    return {
      score: 0,
      maxScore,
      feedback: '📸 Bài thực hành đã nộp! Đang chờ GV chấm điểm.',
    }
  }

  return { score: 0, maxScore, feedback: 'Bài đã nộp.' }
}

/** Chấm trắc nghiệm */
function gradeQuiz(
  content: Json,
  answer: Json,
  maxScore: number
): { score: number; maxScore: number; feedback: string } {
  try {
    const quizContent = content as { questions: { correctAnswer: number }[] }
    const studentAnswers = answer as { answers: number[] }

    if (!quizContent.questions || !studentAnswers.answers) {
      return { score: 0, maxScore, feedback: 'Định dạng bài làm không hợp lệ.' }
    }

    let correct = 0
    const total = quizContent.questions.length

    quizContent.questions.forEach((q, i) => {
      if (studentAnswers.answers[i] === q.correctAnswer) {
        correct++
      }
    })

    const score = Math.round((correct / total) * maxScore)
    const percentage = Math.round((correct / total) * 100)

    let feedback: string
    if (percentage >= 80) feedback = `🎉 Xuất sắc! ${correct}/${total} câu đúng!`
    else if (percentage >= 60) feedback = `👍 Khá tốt! ${correct}/${total} câu đúng. Cố gắng thêm nhé!`
    else if (percentage >= 40) feedback = `🤔 ${correct}/${total} câu đúng. Em cần xem lại bài học.`
    else feedback = `📖 ${correct}/${total} câu đúng. Hãy đọc lại tài liệu và thử lại nhé!`

    return { score, maxScore, feedback }
  } catch {
    return { score: 0, maxScore, feedback: 'Lỗi khi chấm bài.' }
  }
}

/** Chấm tự luận ngắn bằng Gemini (Semantic similarity) */
async function gradeShortAnswerSemantic(
  task: Task,
  answer: Json,
  maxScore: number
): Promise<{ score: number; maxScore: number; feedback: string }> {
  const taskContent = task.content as { keywords?: string[]; referenceAnswer?: string; question?: string }
  const studentAnswer = answer as { text: string }

  const studentText = studentAnswer?.text || ''
  const keywords = taskContent?.keywords || []
  const reference = taskContent?.referenceAnswer || ''
  const question = taskContent?.question || task.title

  // Lấy API key từ localStorage hoặc env
  const apiKey = localStorage.getItem('gemini_api_key') || localStorage.getItem('VITE_GEMINI_API_KEY') || import.meta.env.VITE_GEMINI_API_KEY || ''

  if (!apiKey || !studentText) {
    return gradeShortAnswerFallback(keywords, studentText, maxScore)
  }

  try {
    const prompt = `Bạn là một giám khảo AI chấm điểm câu trả lời tự luận ngắn của học sinh.
Hãy chấm điểm dựa trên mức độ hiểu biết ngữ nghĩa (semantic similarity), các từ khóa quan trọng và đáp án tham khảo (nếu có).

## Câu hỏi/Nhiệm vụ:
${question}

## Từ khóa yêu cầu (Càng nhiều từ khóa được diễn đạt đúng ý càng tốt):
${keywords.length > 0 ? keywords.join(', ') : 'Không có từ khóa cụ thể.'}

## Đáp án tham khảo/Tiêu chí chấm điểm:
${reference || 'Học sinh cần trả lời logic, đúng trọng tâm câu hỏi.'}

## Bài làm của học sinh:
"${studentText}"

## Yêu cầu chấm điểm:
1. Thang điểm tối đa là: ${maxScore} điểm.
2. Đánh giá về mặt ý nghĩa, sự hiểu bài của học sinh (đừng chỉ so khớp chữ cái, nếu học sinh dùng từ đồng nghĩa hoặc cách diễn đạt khác mà đúng ý thì vẫn cho điểm tối đa).
3. Đưa ra phản hồi (feedback) bằng tiếng Việt cực kỳ thân thiện, khích lệ học sinh, chỉ ra chỗ đúng và chỗ cần bổ sung (nếu có).
4. Bạn BẮT BUỘC phải trả về kết quả dưới dạng một đối tượng JSON duy nhất có cấu trúc chính xác như sau:
{
  "score": <số điểm học sinh đạt được, kiểu số nguyên từ 0 đến ${maxScore}>,
  "feedback": "<phản hồi bằng tiếng Việt>"
}
Tuyệt đối không trả thêm bất kỳ văn bản nào khác ngoài JSON này.`

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2, // Giảm độ ngẫu nhiên để chấm nhất quán
          responseMimeType: 'application/json' // Yêu cầu trả về JSON
        }
      })
    })

    if (!response.ok) {
      throw new Error('API Response not OK')
    }

    const data = await response.json()
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const parsed = JSON.parse(resultText.trim())

    return {
      score: typeof parsed.score === 'number' ? Math.min(Math.max(0, Math.round(parsed.score)), maxScore) : 0,
      maxScore,
      feedback: parsed.feedback || 'Bài làm đã được chấm điểm tự động.'
    }
  } catch (err) {
    console.error('Semantic grading failed, falling back to keywords:', err)
    return gradeShortAnswerFallback(keywords, studentText, maxScore)
  }
}

/** Chấm tự luận ngắn theo từ khóa (Fallback) */
function gradeShortAnswerFallback(
  keywords: string[],
  studentText: string,
  maxScore: number
): { score: number; maxScore: number; feedback: string } {
  if (keywords.length === 0 || !studentText) {
    return {
      score: 0,
      maxScore,
      feedback: '📝 Bài đã nộp! Đang chờ GV chấm điểm.'
    }
  }

  const text = studentText.toLowerCase()
  let matched = 0

  keywords.forEach((kw) => {
    if (text.includes(kw.toLowerCase())) matched++
  })

  const ratio = matched / keywords.length
  const score = Math.round(ratio * maxScore)

  let feedback: string
  if (ratio >= 0.8) feedback = `✅ [Tự động - Từ khóa] Rất tốt! Em đã bao quát ${matched}/${keywords.length} ý chính.`
  else if (ratio >= 0.5) feedback = `👍 [Tự động - Từ khóa] Khá! Em đã nêu được ${matched}/${keywords.length} ý. Bổ sung thêm nhé!`
  else feedback = `📖 [Tự động - Từ khóa] Em mới nêu được ${matched}/${keywords.length} ý. Hãy xem lại tài liệu.`

  return { score, maxScore, feedback }
}

/** Chấm bài tập nộp ảnh bằng Gemini Vision */
async function gradePhotoWithVision(
  task: Task,
  answer: Json,
  maxScore: number
): Promise<{ score: number; maxScore: number; feedback: string }> {
  const taskContent = task.content as { rubric?: string; referenceAnswer?: string; question?: string }
  const photoAnswer = answer as { url: string; base64?: string }

  const photoUrl = photoAnswer?.url || ''
  const base64Data = photoAnswer?.base64 || ''
  const rubric = taskContent?.rubric || 'Đầy đủ, rõ ràng, sạch sẽ, đúng yêu cầu của đề bài.'
  const reference = taskContent?.referenceAnswer || ''
  const question = taskContent?.question || task.title

  const apiKey = localStorage.getItem('gemini_api_key') || localStorage.getItem('VITE_GEMINI_API_KEY') || import.meta.env.VITE_GEMINI_API_KEY || ''

  if (!apiKey || (!photoUrl && !base64Data)) {
    return {
      score: 0,
      maxScore,
      feedback: '📸 Bài đã nộp! Đang chờ GV chấm điểm (Không có API key hoặc ảnh).'
    }
  }

  try {
    let base64Part: any = null

    if (base64Data) {
      const mimeType = base64Data.substring(base64Data.indexOf(":") + 1, base64Data.indexOf(";"))
      const cleanData = base64Data.substring(base64Data.indexOf(",") + 1)
      base64Part = {
        inlineData: {
          mimeType: mimeType || 'image/jpeg',
          data: cleanData
        }
      }
    } else if (photoUrl) {
      const response = await fetch(photoUrl)
      const blob = await response.blob()
      const reader = new FileReader()
      const base64String = await new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string)
        reader.readAsDataURL(blob)
      })

      const mimeType = blob.type || 'image/jpeg'
      const cleanData = base64String.substring(base64String.indexOf(",") + 1)

      base64Part = {
        inlineData: {
          mimeType,
          data: cleanData
        }
      }
    }

    if (!base64Part) throw new Error('Không lấy được dữ liệu ảnh')

    const promptText = `Bạn là một giám khảo AI chấm điểm sản phẩm thực hành học tập qua hình ảnh học sinh chụp.
Hãy chấm điểm dựa trên tiêu chí chấm điểm (rubric) và đáp án tham khảo (nếu có).

## Câu hỏi/Nhiệm vụ:
${question}

## Tiêu chí chấm điểm (Rubric):
${rubric}

## Đáp án tham khảo (nếu có):
${reference}

## Yêu cầu chấm điểm:
1. Thang điểm tối đa là: ${maxScore} điểm.
2. Hãy xem kỹ hình ảnh đính kèm, phân tích độ hoàn thành và tính đúng đắn của bài làm.
3. Đưa ra phản hồi (feedback) bằng tiếng Việt cực kỳ thân thiện, khích lệ học sinh, chỉ ra chỗ đúng và chỗ cần bổ sung (nếu có).
4. Bạn BẮT BUỘC phải trả về kết quả dưới dạng một đối tượng JSON duy nhất có cấu trúc chính xác như sau:
{
  "score": <số điểm học sinh đạt được, kiểu số nguyên từ 0 đến ${maxScore}>,
  "feedback": "<phản hồi bằng tiếng Việt>"
}
Tuyệt đối không trả thêm bất kỳ văn bản nào khác ngoài JSON này.`

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            base64Part,
            { text: promptText }
          ]
        }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json'
        }
      })
    })

    if (!response.ok) {
      throw new Error('API Response not OK')
    }

    const data = await response.json()
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const parsed = JSON.parse(resultText.trim())

    return {
      score: typeof parsed.score === 'number' ? Math.min(Math.max(0, Math.round(parsed.score)), maxScore) : 0,
      maxScore,
      feedback: `📸 [AI Chấm Nháp] ${parsed.feedback || 'Bài làm đã được chấm điểm tự động qua hình ảnh.'}`
    }
  } catch (err) {
    console.error('Vision grading failed:', err)
    return {
      score: 0,
      maxScore,
      feedback: '📸 Bài đã nộp thành công! Đang chờ GV chấm điểm (Lỗi chấm tự động).'
    }
  }
}

// ─── TÍNH XP ────────────────────────────────

function calculateXP(
  score: number,
  maxScore: number,
  scoringMode: string
): number {
  if (maxScore === 0) return 5 // XP cơ bản cho việc nộp bài

  const ratio = score / maxScore
  let baseXP: number

  if (ratio >= 0.9) baseXP = 20
  else if (ratio >= 0.7) baseXP = 15
  else if (ratio >= 0.5) baseXP = 10
  else baseXP = 5

  // Bonus cho mode cá nhân (khuyến khích tự làm)
  if (scoringMode === 'individual') baseXP += 5

  return baseXP
}

// ─── LẤY KẾT QUẢ ───────────────────────────

/** Lấy kết quả của 1 nhóm trong 1 phiên */
export async function getGroupResults(groupId: string): Promise<TaskResult[]> {
  const { data, error } = await supabase
    .from('task_results')
    .select('*')
    .eq('group_id', groupId)
    .order('completed_at', { ascending: true })

  if (error) throw new Error(`Lấy kết quả nhóm thất bại: ${error.message}`)
  return data ?? []
}

/** Lấy kết quả cá nhân của 1 HS */
export async function getStudentResults(studentId: string): Promise<TaskResult[]> {
  const { data, error } = await supabase
    .from('task_results')
    .select('*')
    .contains('submitted_for', [studentId])
    .order('completed_at', { ascending: true })

  if (error) throw new Error(`Lấy kết quả HS thất bại: ${error.message}`)
  return data ?? []
}

/** GV chấm lại / duyệt bài làm tự luận/ảnh/thực hành */
export async function gradeTaskResultByTeacher(
  resultId: string,
  newScore: number,
  newFeedback: string
): Promise<TaskResult> {
  // 1. Lấy kết quả hiện tại
  const { data: currentResult, error: fetchErr } = await supabase
    .from('task_results')
    .select('*')
    .eq('id', resultId)
    .single()

  if (fetchErr || !currentResult) throw new Error('Không tìm thấy bài làm')

  const oldScore = currentResult.score ?? 0
  const scoreDiff = newScore - oldScore

  // Tính XP dựa trên điểm mới
  const oldXp = currentResult.xp_earned ?? 0
  
  // Lấy task để biết scoring_mode
  const { data: task } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', currentResult.task_id)
    .single()

  if (!task) throw new Error('Không tìm thấy thông tin nhiệm vụ')

  const newXp = calculateXP(newScore, task.points, task.scoring_mode)
  const xpDiff = newXp - oldXp

  // 2. Cập nhật task_results
  const { data: updatedResult, error: updateErr } = await supabase
    .from('task_results')
    .update({
      score: newScore,
      xp_earned: newXp,
      feedback: newFeedback,
      grading_status: 'graded',
    } as any)
    .eq('id', resultId)
    .select()
    .single()

  if (updateErr) throw new Error(`Cập nhật điểm thất bại: ${updateErr.message}`)

  // 3. Cập nhật điểm & XP cho học sinh (submitted_for)
  const submittedFor = (currentResult.submitted_for || []) as string[]
  const scoreDistribution = currentResult.score_distribution

  const pointsDiffPerStudent =
    scoreDistribution === 'equal'
      ? Math.floor(scoreDiff / submittedFor.length)
      : scoreDiff

  const xpDiffPerStudent =
    scoreDistribution === 'equal'
      ? Math.floor(xpDiff / submittedFor.length)
      : xpDiff

  await Promise.all(
    submittedFor.map(async (studentId) => {
      await addPoints(studentId, pointsDiffPerStudent)
      await addXP(studentId, xpDiffPerStudent)
    })
  )

  return updatedResult
}
