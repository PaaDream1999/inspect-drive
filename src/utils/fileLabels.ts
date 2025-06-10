// inspect-drive\src\utils\fileLabels.ts

export const TYPE_LABELS: Record<string, string> = {
    folder: 'โฟลเดอร์',
    'image/png': 'รูปภาพ PNG',
    'image/jpeg': 'รูปภาพ JPEG',
    'image/jpg': 'รูปภาพ JPG',
    'image/gif': 'ไฟล์ GIF',
    'image/webp': 'ไฟล์ WebP',
    'image/svg+xml': 'ไฟล์ SVG',
    'audio/mpeg': 'ไฟล์เสียง MP3',
    'audio/wav': 'ไฟล์เสียง WAV',
    'audio/ogg': 'ไฟล์เสียง OGG',
    'audio/aac': 'ไฟล์เสียง AAC',
    'video/mp4': 'วิดีโอ MP4',
    'video/webm': 'วิดีโอ WebM',
    'video/x-msvideo': 'วิดีโอ AVI',
    'video/quicktime': 'วิดีโอ MOV',
    'application/pdf': 'ไฟล์ PDF',
    'application/msword': 'ไฟล์ Word',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      'ไฟล์ Word (DOCX)',
    'application/vnd.ms-excel': 'ไฟล์ Excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      'ไฟล์ Excel (XLSX)',
    'application/vnd.ms-powerpoint': 'ไฟล์ PowerPoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation':
      'ไฟล์ PowerPoint (PPTX)',
    'application/zip': 'ไฟล์ Zip',
    'application/x-7z-compressed': 'ไฟล์ 7z',
    'application/x-rar-compressed': 'ไฟล์ RAR',
    'application/json': 'ไฟล์ JSON',
    'text/plain': 'ไฟล์ข้อความ',
    'text/html': 'ไฟล์ HTML',
    'text/css': 'ไฟล์ CSS',
    'text/javascript': 'ไฟล์ JavaScript',
  }
  
  export const DEFAULT_TYPE_LABEL = 'ไฟล์อื่น ๆ'
  
  export function labelFromMime(mime?: string): string {
    return mime ? TYPE_LABELS[mime] ?? DEFAULT_TYPE_LABEL : DEFAULT_TYPE_LABEL
  }
  