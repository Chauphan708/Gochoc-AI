/* ═══════════════════════════════════════
   TASK RESULT SERVICE — GócHọc AI
   Xử lý nộp bài theo 3 chế độ tính điểm (v5):
   1. Cá nhân (Individual)
   2. Nhóm chia đều (Group Equal)
   3. NT gắn tag (Leader Tag)
   ═══════════════════════════════════════ */

import { supabase } from '@/lib/supabase'
import { addXP } from './studentService'
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
  const { isPassed, feedback } = isPendingTeacher
    ? { isPassed: false, feedback: '⏳ Bài đã nộp — đang chờ GV chấm điểm.' }
    : await autoGrade(task, answer)

  // 3. Tính XP
  const xpEarned = calculateXP(isPassed, task.xp_reward, task.scoring_mode)

  // 4. Lưu kết quả
  const { data: result, error } = await supabase
    .from('task_results')
    .insert({
      task_id: taskId,
      group_id: groupId,
      submitted_by: submittedBy,
      submitted_for: submittedFor,
      answer,
      xp_earned: xpEarned,
      feedback,
      score_distribution: scoreDistribution,
      grading_status: isPendingTeacher ? 'pending_teacher' : (isPassed ? 'graded' : 'rejected'),
    } as any)
    .select()
    .single()

  if (error) throw new Error(`Nộp bài thất bại: ${error.message}`)

  // 5. Cộng XP cho từng HS (bỏ qua nếu chờ GV chấm)
  if (!isPendingTeacher) {
    const xpPerStudent =
      scoreDistribution === 'equal'
        ? Math.floor(xpEarned / submittedFor.length)
        : xpEarned

    await Promise.all(

      submittedFor.map(async (studentId) => {
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
): Promise<{ isPassed: boolean; feedback: string }> {

  if (task.type === 'quiz') {
    return gradeQuiz(task.content, answer)
  }

  if (task.type === 'short_answer') {
    return await gradeShortAnswerSemantic(task, answer)
  }

  if (task.type === 'photo_upload') {
    return await gradePhotoWithVision(task, answer)
  }

  if (task.type === 'practice') {
    return {
      isPassed: false,
      feedback: '📸 Bài thực hành đã nộp! Đang chờ GV duyệt.',
    }
  }

  return { isPassed: true, feedback: 'Bài đã nộp thành công.' }
}

/** Chấm trắc nghiệm */
function gradeQuiz(
  content: Json,
  answer: Json
): { isPassed: boolean; feedback: string } {
  try {
    const quizContent = content as any
    const studentAnswers = answer as { answers: number[] }

    if (!quizContent.questions || !studentAnswers.answers) {
      return { isPassed: false, feedback: 'Định dạng bài làm không hợp lệ.' }
    }

    let correct = 0
    const total = quizContent.questions.length
    const passThreshold = quizContent.pass_threshold || Math.ceil(total / 2) // Default pass if not set

    quizContent.questions.forEach((q: any, i: number) => {
      if (studentAnswers.answers[i] === q.correctAnswer) {
        correct++
      }
    })

    const isPassed = correct >= passThreshold

    let feedback: string
    if (isPassed) {
      if (correct === total) feedback = `🎉 Xuất sắc! ${correct}/${total} câu đúng!`
      else feedback = `👍 Tốt! ${correct}/${total} câu đúng (Đạt yêu cầu).`
    } else {
      feedback = `📖 ${correct}/${total} câu đúng. Cần làm đúng ít nhất ${passThreshold} câu để qua nhiệm vụ này.`
    }

    return { isPassed, feedback }
  } catch {
    return { isPassed: false, feedback: 'Lỗi khi chấm bài.' }
  }
}

/** Chấm tự luận ngắn bằng Gemini (Semantic similarity) */
async function gradeShortAnswerSemantic(
  task: Task,
  answer: Json
): Promise<{ isPassed: boolean; feedback: string }> {
  const taskContent = task.content as any
  const studentAnswer = answer as { texts: string[], text?: string }

  const studentTexts = studentAnswer?.texts || (studentAnswer?.text ? [studentAnswer.text] : [])
  const questions = taskContent?.questions || [{ question: taskContent?.question, rubric: taskContent?.rubric }]
  const passThreshold = taskContent?.pass_threshold || 1

  const apiKey = localStorage.getItem('gemini_api_key') || localStorage.getItem('VITE_GEMINI_API_KEY') || import.meta.env.VITE_GEMINI_API_KEY || ''

  if (!apiKey || studentTexts.length === 0) {
    return { isPassed: false, feedback: 'Đã nộp bài, đang chờ GV duyệt thủ công do AI chưa được cấu hình.' }
  }

  let correctCount = 0
  const feedbacks = []

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]
    const studentText = studentTexts[i] || ''
    const rubric = q.rubric || q.referenceAnswer || ''
    const question = q.question || task.title

    if (!studentText) {
      feedbacks.push(`Câu ${i + 1}: Chưa trả lời`)
      continue
    }

    try {
      const prompt = `Bạn là giám khảo AI đánh giá câu tự luận ngắn.
## Câu hỏi:
${question}
## Đáp án tham khảo / Tiêu chí (Rubric):
${rubric || 'Học sinh trả lời logic, đúng ý là được.'}
## Bài làm của học sinh:
"${studentText}"
## Yêu cầu:
1. Đánh giá "Đạt" (is_passed: true) hay "Chưa đạt" (is_passed: false).
2. Viết nhận xét (feedback).
TRẢ VỀ JSON:
{ "is_passed": boolean, "feedback": "nhận xét" }`

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }
        })
      })

      if (!response.ok) throw new Error('API Response not OK')

      const data = await response.json()
      const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
      const parsed = JSON.parse(resultText.trim())

      if (parsed.is_passed) {
        correctCount++
        feedbacks.push(`Câu ${i + 1}: Đạt`)
      } else {
        feedbacks.push(`Câu ${i + 1}: Chưa đạt (${parsed.feedback})`)
      }
    } catch (err) {
      console.error('Semantic grading failed for q', i, err)
      feedbacks.push(`Câu ${i + 1}: Lỗi chấm AI`)
    }
  }

  const isPassed = correctCount >= passThreshold
  let finalFeedback = ''
  if (isPassed) {
    finalFeedback = `🎉 Đạt yêu cầu! (${correctCount}/${questions.length} câu).\n`
  } else {
    finalFeedback = `❌ Chưa đạt. Mới đúng ${correctCount}/${questions.length} câu (cần ${passThreshold} câu).\n`
  }
  
  if (questions.length > 1) {
    finalFeedback += feedbacks.join('\n')
  } else {
    finalFeedback += feedbacks[0].replace('Câu 1: ', '')
  }

  return { isPassed, feedback: finalFeedback }
}

/** Chấm tự luận ngắn theo từ khóa (Fallback) */
function gradeShortAnswerFallback(
  keywords: string[],
  studentText: string
): { isPassed: boolean; feedback: string } {
  if (keywords.length === 0 || !studentText) {
    return {
      isPassed: false,
      feedback: '📝 Bài đã nộp! Đang chờ GV duyệt.'
    }
  }

  const text = studentText.toLowerCase()
  let matched = 0

  keywords.forEach((kw) => {
    if (text.includes(kw.toLowerCase())) matched++
  })

  const ratio = matched / keywords.length
  const isPassed = ratio >= 0.5

  let feedback: string
  if (ratio >= 0.8) feedback = `✅ [Tự động - Từ khóa] Đạt! Rất tốt! Em đã bao quát ${matched}/${keywords.length} ý chính.`
  else if (ratio >= 0.5) feedback = `👍 [Tự động - Từ khóa] Đạt! Khá! Em đã nêu được ${matched}/${keywords.length} ý.`
  else feedback = `📖 [Tự động - Từ khóa] Chưa đạt! Em mới nêu được ${matched}/${keywords.length} ý. Hãy xem lại tài liệu và sửa lại nhé.`

  return { isPassed, feedback }
}

/** Chấm bài tập nộp ảnh bằng Gemini Vision */
async function gradePhotoWithVision(
  task: Task,
  answer: Json
): Promise<{ isPassed: boolean; feedback: string }> {
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
      isPassed: false,
      feedback: '📸 Bài đã nộp! Đang chờ GV duyệt (Không có API key hoặc ảnh).'
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

    const promptText = `Bạn là một giám khảo AI đánh giá sản phẩm thực hành học tập qua hình ảnh học sinh chụp.
Hãy xem xét hình ảnh và quyết định kết quả Đạt/Chưa đạt.

## Câu hỏi/Nhiệm vụ:
${question}

## Yêu cầu (Rubric):
${rubric}

## Đáp án tham khảo (nếu có):
${reference}

## Yêu cầu đánh giá:
1. Kiểm tra hình ảnh xem có đúng với yêu cầu không.
2. Trả về "is_passed": true (nếu đạt) hoặc false (nếu chưa đạt hoặc làm sai).
3. Viết nhận xét (feedback) tiếng Việt khích lệ học sinh, chỉ ra chỗ tốt hoặc chỗ cần sửa.
4. TRẢ VỀ ĐỐI TƯỢNG JSON MỘT CẤP (không có markdown khác):
{
  "is_passed": <true/false>,
  "feedback": "<nhận xét>"
}`

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

    if (!response.ok) throw new Error('API Response not OK')

    const data = await response.json()
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const parsed = JSON.parse(resultText.trim())

    return {
      isPassed: parsed.is_passed === true,
      feedback: `📸 [AI Duyệt] ${parsed.feedback || 'Bài làm đã được AI xem qua.'}`
    }
  } catch (err) {
    console.error('Vision grading failed:', err)
    return {
      isPassed: false,
      feedback: '📸 Bài đã nộp! Lỗi AI nên bài đang chờ GV duyệt thủ công.'
    }
  }
}

// ─── TÍNH XP ────────────────────────────────

/** Tính XP dựa trên kết quả đạt hay chưa đạt */
function calculateXP(
  isPassed: boolean,
  xpReward: number,
  scoringMode: string
): number {
  if (!isPassed) return 0 // Không đạt thì không được XP

  let totalXP = xpReward

  // Bonus cho mode cá nhân (khuyến khích tự làm)
  if (scoringMode === 'individual') totalXP += 5

  return totalXP
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
  verdict: 'approved' | 'rejected',
  teacherFeedback: string
): Promise<TaskResult> {
  // 1. Lấy kết quả hiện tại
  const { data: currentResult, error: fetchErr } = await supabase
    .from('task_results')
    .select('*')
    .eq('id', resultId)
    .single()

  if (fetchErr || !currentResult) throw new Error('Không tìm thấy bài làm')

  // Lấy task để biết scoring_mode và xp_reward
  const { data: task } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', currentResult.task_id)
    .single()

  if (!task) throw new Error('Không tìm thấy thông tin nhiệm vụ')

  if (verdict === 'approved') {
    // ĐẠT: cộng XP
    const newXp = calculateXP(true, task.xp_reward, task.scoring_mode)
    const oldXp = currentResult.xp_earned ?? 0
    const xpDiff = newXp - oldXp

    const { data: updatedResult, error: updateErr } = await supabase
      .from('task_results')
      .update({
        xp_earned: newXp,
        feedback: teacherFeedback || '✅ GV đã duyệt: ĐẠT! Tuyệt vời!',
        grading_status: 'graded',
      } as any)
      .eq('id', resultId)
      .select()
      .single()

    if (updateErr) throw new Error(`Cập nhật thất bại: ${updateErr.message}`)

    // Cộng XP cho học sinh
    const submittedFor = (currentResult.submitted_for || []) as string[]
    const scoreDistribution = currentResult.score_distribution

    const xpDiffPerStudent =
      scoreDistribution === 'equal'
        ? Math.floor(xpDiff / submittedFor.length)
        : xpDiff

    await Promise.all(
      submittedFor.map(async (studentId) => {
        await addXP(studentId, xpDiffPerStudent)
      })
    )

    return updatedResult
  } else {
    // CHƯA ĐẠT: 0 XP, gửi feedback để HS sửa và nộp lại
    const { data: updatedResult, error: updateErr } = await supabase
      .from('task_results')
      .update({
        xp_earned: 0,
        feedback: teacherFeedback || '❌ GV nhận xét: Chưa đạt. Vui lòng xem lại và nộp lại.',
        grading_status: 'rejected',
      } as any)
      .eq('id', resultId)
      .select()
      .single()

    if (updateErr) throw new Error(`Cập nhật thất bại: ${updateErr.message}`)

    return updatedResult
  }
}
