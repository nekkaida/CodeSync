// Health check endpoint for frontend
// Used by Docker health checks and monitoring

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'codesync-frontend',
    environment: process.env.NODE_ENV,
  });
}
