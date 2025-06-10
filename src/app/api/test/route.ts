// inspect-drive\src\app\api\test\route.ts

import { NextResponse } from 'next/server';
import logger from '@/lib/logger';

export async function GET(request: Request) {
  logger.info(`GET ${request.url}`);
  return NextResponse.json({ message: 'API Testing' });
}
