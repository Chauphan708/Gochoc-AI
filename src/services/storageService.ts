/* ═══════════════════════════════════════
   STORAGE SERVICE — GócHọc AI
   Upload ảnh / tài liệu lên Supabase Storage
   
   Bucket: task-uploads
   Cấu trúc: {session_id}/{group_id}/{task_id}/{filename}
   ═══════════════════════════════════════ */

import { supabase } from '@/lib/supabase'

// ─── CẤU HÌNH ──────────────────────────────

const BUCKET_NAME = 'task-uploads'
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']
const ALLOWED_DOC_TYPES = ['application/pdf', 'text/plain', 'text/markdown']

// ─── TYPES ──────────────────────────────────

export interface UploadResult {
  path: string        // Storage path
  publicUrl: string   // Public URL (nếu bucket public)
  signedUrl: string   // Signed URL (60 min)
  fileName: string
  fileSize: number
}

export interface UploadError {
  message: string
  code: 'TOO_LARGE' | 'INVALID_TYPE' | 'UPLOAD_FAILED' | 'UNKNOWN'
}

// ─── VALIDATE ───────────────────────────────

function validateFile(
  file: File,
  allowedTypes: string[]
): UploadError | null {
  if (file.size > MAX_FILE_SIZE) {
    return {
      message: `File quá lớn (${(file.size / 1024 / 1024).toFixed(1)}MB). Tối đa ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
      code: 'TOO_LARGE',
    }
  }

  if (!allowedTypes.includes(file.type)) {
    return {
      message: `Định dạng ${file.type || 'không xác định'} không được hỗ trợ.`,
      code: 'INVALID_TYPE',
    }
  }

  return null
}

// ─── UPLOAD FUNCTIONS ───────────────────────

/**
 * Upload ảnh nhiệm vụ (photo_upload task).
 * Trả về URL công khai hoặc signed URL.
 */
export async function uploadTaskImage(
  file: File,
  sessionId: string,
  groupId: string,
  taskId: string,
  studentId: string
): Promise<UploadResult> {
  // 1. Validate
  const error = validateFile(file, ALLOWED_IMAGE_TYPES)
  if (error) throw new Error(error.message)

  // 2. Tạo path unique
  const ext = file.name.split('.').pop() ?? 'jpg'
  const timestamp = Date.now()
  const path = `${sessionId}/${groupId}/${taskId}/${studentId}_${timestamp}.${ext}`

  // 3. Upload
  const { data, error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    })

  if (uploadError) {
    throw new Error(`Upload thất bại: ${uploadError.message}`)
  }

  // 4. Lấy URL
  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(data.path)

  // Signed URL (backup nếu bucket không public)
  const { data: signedData } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(data.path, 3600) // 1 giờ

  return {
    path: data.path,
    publicUrl: urlData.publicUrl,
    signedUrl: signedData?.signedUrl ?? urlData.publicUrl,
    fileName: file.name,
    fileSize: file.size,
  }
}

/**
 * Upload tài liệu kiến thức cho station (GV).
 */
export async function uploadKnowledgeFile(
  file: File,
  sessionId: string,
  stationId: string
): Promise<UploadResult> {
  const allAllowed = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOC_TYPES]
  const error = validateFile(file, allAllowed)
  if (error) throw new Error(error.message)

  const ext = file.name.split('.').pop() ?? 'pdf'
  const timestamp = Date.now()
  const path = `knowledge/${sessionId}/${stationId}/${timestamp}_${file.name}`

  const { data, error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, file, {
      cacheControl: '86400',
      upsert: false,
      contentType: file.type,
    })

  if (uploadError) {
    throw new Error(`Upload tài liệu thất bại: ${uploadError.message}`)
  }

  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(data.path)

  const { data: signedData } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(data.path, 86400) // 24 giờ

  return {
    path: data.path,
    publicUrl: urlData.publicUrl,
    signedUrl: signedData?.signedUrl ?? urlData.publicUrl,
    fileName: file.name,
    fileSize: file.size,
  }
}

/**
 * Xóa file khỏi storage.
 */
export async function deleteFile(path: string): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([path])

  if (error) {
    console.error('Xóa file thất bại:', error)
  }
}

/**
 * Lấy signed URL cho file (khi bucket private).
 */
export async function getSignedUrl(
  path: string,
  expiresIn: number = 3600
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(path, expiresIn)

  if (error) throw new Error(`Lấy URL thất bại: ${error.message}`)
  return data.signedUrl
}

/**
 * Chụp ảnh từ camera (mobile).
 * Mở native file picker với capture=camera.
 */
export function createCameraInput(
  onFileSelected: (file: File) => void
): HTMLInputElement {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.capture = 'environment' // Camera sau
  input.style.display = 'none'

  input.addEventListener('change', () => {
    const file = input.files?.[0]
    if (file) onFileSelected(file)
    document.body.removeChild(input)
  })

  document.body.appendChild(input)
  return input
}
