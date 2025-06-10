// inspect-drive/src/lib/logger.ts

import fs from 'fs';
import path from 'path';
import os from 'os';
import { createLogger, format, transports, type Logger } from 'winston';
import 'winston-daily-rotate-file';
import type { TransformableInfo } from 'logform';

const { combine, timestamp, printf, json } = format;

// 1. สร้างโฟลเดอร์ logs ถ้ายังไม่มี เพื่อเก็บไฟล์ log ทั้งหมด
const logDir = path.resolve(process.cwd(), 'logs');
fs.mkdirSync(logDir, { recursive: true });

// 2. Mask ข้อมูล secretDK ใน log แล้วลบ field นี้ออกเพื่อปกป้องความลับ
const maskSecretDK = format((info: TransformableInfo) => {
  // ถ้าพบ property secretDK ใน info
  if ('secretDK' in info) {
    delete (info as Record<string, unknown>).secretDK;

    // ถ้า message เป็นสตริง ให้ทำการแมสก์ค่าในข้อความด้วย regex
    if (typeof info.message === 'string') {
      info.message = info.message.replace(
        /"secretDK":\s*\{[\s\S]*?\}/,
        '"secretDK":"[REDACTED]"',
      );
    }
  }
  return info;
});

// 3. กำหนดรูปแบบ log ตาม Elastic Common Schema (ECS)
const ecsFormat = combine(
  timestamp(), // เพิ่ม timestamp ตาม ISO 8601
  maskSecretDK(),
  format((info: TransformableInfo) => {
    info['service.name'] = 'inspect-drive'; // ชื่อบริการ
    info['host.name'] = os.hostname(); // ชื่อเครื่องโฮสต์
    info['process.thread_id'] = process.pid; // ID ของ process
    info['ecs.version'] = '1.12.0'; // เวอร์ชัน ECS
    return info;
  })(),
  json(), // แปลงเป็น JSON ตาม ECS schema
);

// 4. Transport สำหรับ log ระดับ info หมุนไฟล์รายวัน
const infoTransport = new transports.DailyRotateFile({
  level: 'info',
  dirname: logDir,
  filename: 'app-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true, // บีบอัดไฟล์เป็น .gz อัตโนมัติ
  maxSize: '9000m', // จำกัดขนาดไฟล์สูงสุด 9000 MB = 9 GB
  maxFiles: '90d', // เก็บย้อนหลังไม่เกิน 90 วัน
});

// 5. Transport สำหรับ log ระดับ error หมุนไฟล์รายวัน
const errorTransport = new transports.DailyRotateFile({
  level: 'error',
  dirname: logDir,
  filename: 'error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '9000m', // จำกัดขนาดไฟล์สูงสุด 9000 MB = 9 GB
  maxFiles: '90d',
});

// 6. สร้าง logger หลัก ใช้ ECS format และ transports ข้างต้น
const logger: Logger = createLogger({
  level: 'info', // เก็บ log ตั้งแต่ info ขึ้นไป (info, warn, error)
  format: ecsFormat,
  transports: [infoTransport, errorTransport],
  exitOnError: false, // ไม่หยุดโปรแกรมเมื่อเกิด exception
});

// 7. ถ้าไม่ใช่ production ให้โชว์ log บน console ด้วยระดับ debug ขึ้นไป
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new transports.Console({
      level: 'debug', // แสดง debug, info, warn, error บน console
      format: combine(
        timestamp(),
        printf(({ timestamp, level, message, ...meta }) => {
          const metaString = Object.keys(meta).length
            ? JSON.stringify(meta)
            : '';
          return `${timestamp} [${level.toUpperCase()}] ${message} ${metaString}`;
        }),
      ),
    }),
  );
}

export default logger;
