// inspect-drive/src/app/api/files/upload/route.ts

import { NextRequest, NextResponse } from "next/server";
import { IncomingForm, Fields, Files } from "formidable";
import fs from "fs/promises";
import path from "path";
import { Readable } from "stream";
import dbConnect from "@/lib/dbConnect";
import File from "@/models/File";
import User from "@/models/User";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/authOptions";

// Logger utility for consistent logging
const logger = {
  context: 'upload',
  debug: (message: string, meta?: object) => {
    if (process.env.LOG_LEVEL === 'debug') {
      console.debug(`[${logger.context}] ${message}`, meta || '');
    }
  },
  info: (message: string, meta?: object) => {
    console.info(`[${logger.context}] ${message}`, meta || '');
  },
  warn: (message: string, meta?: object) => {
    console.warn(`[${logger.context}] ${message}`, meta || '');
  },
  error: (message: string, error?: unknown) => {
    console.error(`[${logger.context}] ${message}`, error || '');
  }
};

// ปิด bodyParser เพื่อรองรับ FormData
export const config = {
  api: { bodyParser: false },
};

// Interface สำหรับไฟล์ที่ถูก parse
interface ExtendedFormidableFile {
  filepath: string;
  size: number;
  mimetype: string | null;
  webkitRelativePath?: string;
  originalFilename?: string;
}

interface ParsedFiles {
  file?: ExtendedFormidableFile | ExtendedFormidableFile[];
}

// คลาสสำหรับแปลง Web ReadableStream เป็น Node ReadableStream
class FakeIncomingMessage extends Readable {
  headers: Record<string, string>;
  method?: string;
  url?: string;
  constructor(
    stream: Readable,
    headers: Record<string, string>,
    method?: string,
    url?: string
  ) {
    super();
    this.headers = headers;
    this.method = method;
    this.url = url;
    stream.on("data", (chunk) => this.push(chunk));
    stream.on("end", () => this.push(null));
  }
  _read() {}
}

export async function POST(req: NextRequest) {
  logger.info(`POST handler started: ${req.method} ${req.url}`);

  try {
    await dbConnect();
  } catch (err) {
    logger.error("Database connection failed", err);
    return NextResponse.json({ error: "DB connection error" }, { status: 500 });
  }

  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    logger.warn("Unauthorized request: no valid session");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let userId = session.user.id;
  if (!userId && session.user.email) {
    userId = session.user.email.replace(/[@.]/g, "_");
  }
  logger.debug(`Authenticated user ID: ${userId}`);

  if (!userId) {
    logger.warn("Missing user identification in session");
    return NextResponse.json({ error: "User identification missing" }, { status: 400 });
  }

  const rootUploadDir = path.join(process.cwd(), "private", "uploads");
  const userUploadDir = path.join(rootUploadDir, userId);
  try {
    await fs.mkdir(userUploadDir, { recursive: true });
  } catch (err) {
    logger.error("Failed to create upload directory", err);
    return NextResponse.json({ error: "Directory creation error" }, { status: 500 });
  }
  logger.debug(`Upload directory prepared: ${userUploadDir}`);

  const webStream = req.body as unknown as import("stream/web").ReadableStream<Uint8Array>;
  const nodeStream = Readable.fromWeb(webStream);
  const headers = Object.fromEntries(req.headers.entries());
  const fakeReq = new FakeIncomingMessage(nodeStream, headers, req.method, req.url);

  const form = new IncomingForm({
    uploadDir: userUploadDir,
    keepExtensions: true,
  });

  const folderCache = new Map<string, string>();

  async function ensureFoldersExist(userId: string, segments: string[]): Promise<string[]> {
    const newSegments: string[] = [];
    let currentPath = "";
    for (const seg of segments) {
      const cleanSeg = seg.replace(/\\/g, "/").trim();
      if (!cleanSeg) continue;
      const cacheKey = currentPath ? `${currentPath}/${cleanSeg}` : cleanSeg;
      if (folderCache.has(cacheKey)) {
        const cached = folderCache.get(cacheKey)!;
        logger.debug(`Cache hit: ${cacheKey} => ${cached}`);
        currentPath = currentPath ? `${currentPath}/${cached}` : cached;
        newSegments.push(cached);
        continue;
      }
      let folderName = cleanSeg;
      let existing = await File.findOne({ owner: userId, folderPath: currentPath, fileName: folderName, fileType: "folder" });
      let counter = 1;
      while (existing) {
        folderName = `${cleanSeg}(${counter})`;
        existing = await File.findOne({ owner: userId, folderPath: currentPath, fileName: folderName, fileType: "folder" });
        counter++;
      }
      logger.debug(`Creating folder: ${folderName} in path: ${currentPath || 'root'}`);
      await File.create({ 
        owner: userId, 
        folderPath: currentPath, 
        fileName: folderName, 
        fileType: "folder", 
        fileSize: 0, 
        relativePath: currentPath ? `${currentPath}/${folderName}` : folderName, 
        filePath: `/api/files/download-folder/${encodeURIComponent(folderName)}`, 
        createdAt: new Date() 
      });
      folderCache.set(cacheKey, folderName);
      currentPath = currentPath ? `${currentPath}/${folderName}` : folderName;
      newSegments.push(folderName);
    }
    return newSegments;
  }

  async function processFile(file: ExtendedFormidableFile): Promise<typeof File.prototype> {
    const originalName = (file.webkitRelativePath || file.originalFilename || path.basename(file.filepath)).replace(/\\/g, "/");
    logger.debug(`Processing file: ${originalName}`, { size: file.size, mime: file.mimetype });
    
    const segments = originalName.split("/");
    const baseName = segments.pop() || "";
    let folderSegments = segments.map((s) => s.replace(/\\/g, "/").trim());
    
    if (folderSegments.length) {
      folderSegments = await ensureFoldersExist(userId, folderSegments);
    }
    
    let relative = folderSegments.length ? path.join(...folderSegments, baseName) : baseName;
    relative = relative.replace(/\\/g, "/");
    let finalPath = path.join(userUploadDir, relative);
    
    try {
      await fs.access(finalPath);
      const dir = path.dirname(finalPath);
      const ext = path.extname(finalPath);
      const name = path.basename(finalPath, ext);
      let count = 1;
      while (true) {
        const cand = path.join(dir, `${name}(${count})${ext}`);
        try { 
          await fs.access(cand); 
          count++; 
        } catch { 
          finalPath = cand; 
          relative = path.relative(userUploadDir, cand).replace(/\\/g, "/"); 
          break; 
        }
      }
    } catch {}
    
    logger.debug(`Saving file: ${path.basename(finalPath)} to: ${path.dirname(finalPath)}`);
    await fs.mkdir(path.dirname(finalPath), { recursive: true });
    await fs.rename(file.filepath, finalPath);
    
    const doc = new File({ 
      owner: userId, 
      folderPath: folderSegments.join("/"), 
      fileName: path.basename(relative), 
      fileType: file.mimetype, 
      fileSize: file.size, 
      relativePath: relative, 
      createdAt: new Date() 
    });
    doc.filePath = `/api/files/download/${doc._id}`;
    await doc.save();
    
    logger.info(`File saved successfully: ID=${doc._id}, Name=${doc.fileName}`, { 
      size: file.size, 
      path: relative 
    });
    
    return doc;
  }

  logger.debug("Parsing form data");
  return new Promise<NextResponse>((resolve) => {
    const castReq = fakeReq as unknown as import("http").IncomingMessage;
    form.parse(castReq, async (err: Error, fields: Fields, files: Files) => {
      if (err) { 
        logger.error("Form parsing failed", err); 
        return resolve(NextResponse.json({ error: "Error parsing form data" }, { status: 500 })); 
      }
      
      const parsed = (files as ParsedFiles).file;
      const fileList = parsed ? (Array.isArray(parsed) ? parsed : [parsed]) : [];
      
      if (!fileList.length) { 
        logger.warn("Request contains no files"); 
        return resolve(NextResponse.json({ error: "No file uploaded" }, { status: 400 })); 
      }
      
      try {
        const agg = await File.aggregate([
          { $match: { owner: userId } }, 
          { $group: { _id: null, totalSize: { $sum: "$fileSize" } } }
        ]);
        const used = agg[0]?.totalSize || 0;
        const incoming = fileList.reduce((a, f) => a + f.size, 0);
        const quotaGB = (await User.findById(userId))?.storageQuota || 20;
        const quotaBytes = quotaGB * 1024 * 1024 * 1024;
        
        logger.debug(`Storage quota check`, { 
          used, 
          incoming, 
          quota: quotaBytes, 
          remaining: quotaBytes - used 
        });
        
        if (used + incoming > quotaBytes) { 
          logger.warn(`Storage quota exceeded for user: ${userId}`, { 
            used, 
            requested: incoming, 
            quota: quotaBytes 
          }); 
          return resolve(NextResponse.json({ 
            error: "พื้นที่เต็ม", 
            used, 
            storageQuota: quotaBytes 
          }, { status: 400 })); 
        }
        
        const result = [];
        for (const f of fileList) {
          result.push(await processFile(f));
        }
        
        logger.info(`Successfully processed ${result.length} files`, { 
          totalSize: incoming,
          fileCount: result.length
        });
        
        resolve(NextResponse.json({ files: result }, { status: 200 }));
      } catch (e) { 
        logger.error("Failed to save file data", e); 
        resolve(NextResponse.json({ error: "Error saving file data" }, { status: 500 })); 
      }
    });
  });
}