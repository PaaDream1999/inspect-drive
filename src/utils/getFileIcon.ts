// inspect-drive\src\utils\getFileIcon.ts

export const getFileIcon = (fileType: string, isSecret?: boolean): string | undefined => {
  if (fileType.startsWith("image/")) {
    // ถ้าเป็นรูปและเป็น secret ให้แสดงไอคอนรูป (Image-icon)
    if (isSecret) return "/icons/image-icon.png";
    // สำหรับรูปปกติ ให้ใช้ preview จาก filePath (undefined จะบอกให้ใช้ preview)
    return undefined;
  }
  if (fileType.startsWith("audio/")) return "/icons/audio-icon.png";
  if (fileType.startsWith("video/")) return "/icons/video-icon.png";
  if (fileType.includes("pdf")) return "/icons/pdf-icon.png";
  if (fileType.includes("zip") || fileType.includes("compressed")) return "/icons/zip-icon.png";
  if (fileType.includes("word")) return "/icons/word-icon.png";
  if (fileType.includes("powerpoint") || fileType.includes("officedocument.presentationml"))
    return "/icons/ppt-icon.png";
  if (fileType.includes("excel") || fileType.includes("officedocument.spreadsheetml"))
    return "/icons/excel-icon.png";
  return "/icons/file-icon.png";
};


  