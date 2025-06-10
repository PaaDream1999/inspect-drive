// inspect-drive/src/app/api/files/upload-secret/route.ts

import { NextRequest, NextResponse } from "next/server";
import { IncomingForm, Fields, Files } from "formidable";
import fs from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { IncomingMessage } from "http";
import dbConnect from "@/lib/dbConnect";
import File from "@/models/File";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/authOptions";
import crypto from "crypto";
import mongoose from "mongoose";

// Logger factory following Clean Code and ESLint principles
function createLogger(context: string) {
  // Helper to format messages
  function format(level: string, message: string) {
    return `[${level.toUpperCase()}] [${context}] ${message}`;
  }

  return {
    debug(message: string, data?: unknown): void {
      if (process.env.LOG_LEVEL === 'debug') {
        const formatted = format('debug', message);
        console.debug(formatted, data);
      }
    },
    info(message: string, data?: unknown): void {
      const formatted = format('info', message);
      console.info(formatted, data);
    },
    warn(message: string, data?: unknown): void {
      const formatted = format('warn', message);
      console.warn(formatted, data);
    },
    error(message: string, error?: unknown): void {
      const formatted = format('error', message);
      console.error(formatted, error);
    },
    withSubcontext(sub: string) {
      return createLogger(`${context}:${sub}`);
    }
  };
}

const logger = createLogger('upload-secret');

export const config = {
  api: { bodyParser: false },
};

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

class FakeIncomingMessage extends Readable {
  public headers: Record<string, string>;
  public method?: string;
  public url?: string;

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

  _read(): void {}
}

export async function POST(req: NextRequest) {
  logger.info("Starting file upload processing");

  try {
    await dbConnect();
    logger.debug("Database connection established");

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      logger.warn("Unauthorized upload attempt");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let userId = session.user.id;
    if (!userId && session.user.email) {
      userId = session.user.email.replace(/[@.]/g, "_");
    }

    if (!userId) {
      logger.warn("Missing user identification");
      return NextResponse.json({ error: "User identification missing" }, { status: 400 });
    }

    logger.debug("User ID resolved", { userId });

    const rootUploadDir = path.join(process.cwd(), "private", "uploads");
    await fs.mkdir(rootUploadDir, { recursive: true });
    const userUploadDir = path.join(rootUploadDir, userId);
    await fs.mkdir(userUploadDir, { recursive: true });
    logger.debug("Upload directories ready", { userUploadDir });

    const webStream = req.body as unknown as import("stream/web").ReadableStream<Uint8Array>;
    const nodeStream = Readable.fromWeb(webStream);
    const fakeReq = new FakeIncomingMessage(
      nodeStream,
      Object.fromEntries(req.headers.entries()),
      req.method,
      req.url
    );

    const form = new IncomingForm({ uploadDir: userUploadDir, keepExtensions: true });

    async function processFile(file: ExtendedFormidableFile) {
      const log = logger.withSubcontext("processFile");
      const originalName =
        file.webkitRelativePath ?? file.originalFilename ?? path.basename(file.filepath);
      const segments = originalName.replace(/\\/g, "/").split("/");
      const baseName = segments.pop() ?? "";
      const folderSegs = segments.map((seg) => seg.trim());

      let newRel =
        folderSegs.length > 0 ? path.join(...folderSegs, baseName) : baseName;
      newRel = newRel.replace(/\\/g, "/");
      let finalPath = path.join(userUploadDir, newRel);

      try {
        await fs.access(finalPath);
        log.debug("File exists, resolving name conflict");
        const dir = path.dirname(finalPath);
        const ext = path.extname(finalPath);
        const name = path.basename(finalPath, ext);
        let counter = 1;

        while (true) {
          const candidate = path.join(dir, `${name}(${counter})${ext}`);
          try {
            await fs.access(candidate);
            counter += 1;
          } catch {
            finalPath = candidate;
            newRel = path.relative(userUploadDir, candidate).replace(/\\/g, "/");
            log.debug("Conflict resolved with alternative path", { finalPath });
            break;
          }
        }
      } catch {
        log.debug("No existing file conflict");
      }

      await fs.mkdir(path.dirname(finalPath), { recursive: true });
      const buffer = await fs.readFile(file.filepath);
      log.debug("Read file into buffer", { length: buffer.length });

      const kmsURL = process.env.KMS_URL;
      if (!kmsURL) {
        throw new Error("KMS_URL environment variable is not set.");
      }

      log.info("Requesting data key from KMS");
      const kmsResponse = await fetch(`${kmsURL}/keys/generate`, { method: "POST" });
      if (!kmsResponse.ok) {
        throw new Error("Failed to generate data key from KMS.");
      }

      const { id: dataKeyId, plaintextDK, encryptedDK, iv, dkHash, keyVersion } =
        await kmsResponse.json();
      if (!plaintextDK) {
        throw new Error("KMS response missing plaintext data key.");
      }

      log.debug("Received data key from KMS", { dataKeyId, keyVersion });

      const dkBuffer = Buffer.from(plaintextDK, "hex");
      const ivBuffer = Buffer.from(iv, "hex");
      const cipher = crypto.createCipheriv("aes-256-cbc", dkBuffer, ivBuffer);
      const encryptedBuffer = Buffer.concat([cipher.update(buffer), cipher.final()]);
      log.debug("File encrypted", { originalSize: buffer.length, encryptedSize: encryptedBuffer.length });

      await fs.unlink(file.filepath).catch((unlinkError) =>
        log.warn("Failed to remove temporary file", unlinkError)
      );

      const pathParts = newRel.split("/");
      const finalName = pathParts.pop() ?? "";
      const finalFolder = pathParts.join("/");

      const newId = new mongoose.Types.ObjectId();
      const downloadPath = `/api/files/download/${newId}`;
      const fileDoc = new File({
        _id: newId,
        owner: userId,
        folderPath: finalFolder,
        fileName: finalName,
        fileType: file.mimetype,
        filePath: downloadPath,
        fileSize: encryptedBuffer.length,
        isSecret: true,
        secretDK: { dataKeyId, encryptedDK, iv, dkHash, keyVersion },
      });
      await fileDoc.save();
      log.info("File document saved", { fileId: fileDoc._id.toString() });

      await fs.writeFile(finalPath, encryptedBuffer);
      log.info("Encrypted file written to disk");

      return { file: fileDoc };
    }

    return new Promise<NextResponse>((resolve) => {
      form.parse(
        fakeReq as unknown as IncomingMessage,
        async (parseError: Error, _fields: Fields, files: Files) => {
          if (parseError) {
            logger.error("Error parsing form data", parseError);
            resolve(
              NextResponse.json({ error: "Error parsing form data" }, { status: 500 })
            );
            return;
          }

          const parsed = (files as ParsedFiles).file;
          const fileList = parsed
            ? Array.isArray(parsed)
              ? parsed
              : [parsed]
            : [];

          logger.debug("Number of files parsed", { count: fileList.length });

          if (fileList.length === 0) {
            logger.warn("No files provided in upload");
            resolve(
              NextResponse.json({ error: "No file uploaded" }, { status: 400 })
            );
            return;
          }

          try {
            const results = [];
            for (const f of fileList) {
              results.push(await processFile(f));
            }
            logger.info("All files processed successfully", { count: results.length });
            resolve(
              NextResponse.json({ files: results }, { status: 200 })
            );
          } catch (processingError) {
            logger.error("Error processing files", processingError);
            resolve(
              NextResponse.json({ error: "Error saving file data" }, { status: 500 })
            );
          }
        }
      );
    });
  } catch (unexpectedError) {
    logger.error("Unexpected error during upload processing", unexpectedError);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
