// MinIO/S3 Storage Service
// Handles file uploads, downloads, and management

import * as Minio from 'minio';
import { log } from '../utils/logger';
import crypto from 'crypto';
import path from 'path';

class StorageService {
  private client: Minio.Client | null = null;
  private bucket: string;
  private isConfigured: boolean = false;

  constructor() {
    this.bucket = process.env.S3_BUCKET || 'codesync-uploads';
    this.initialize();
  }

  private initialize() {
    try {
      const endpoint = process.env.S3_ENDPOINT || 'localhost';
      const port = parseInt(process.env.S3_PORT || '9000');
      const useSSL = process.env.S3_USE_SSL === 'true';
      const accessKey = process.env.S3_ACCESS_KEY || 'minioadmin';
      const secretKey = process.env.S3_SECRET_KEY || 'minioadmin';

      // Remove protocol from endpoint if present
      const cleanEndpoint = endpoint.replace(/^https?:\/\//, '');

      this.client = new Minio.Client({
        endPoint: cleanEndpoint,
        port,
        useSSL,
        accessKey,
        secretKey,
      });

      this.initBucket();
      this.isConfigured = true;
      log.info('✅ MinIO storage service initialized', {
        endpoint: cleanEndpoint,
        port,
        bucket: this.bucket,
      });
    } catch (error) {
      log.error('Failed to initialize MinIO client', error);
      this.isConfigured = false;
    }
  }

  private async initBucket() {
    if (!this.client) return;

    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket, 'us-east-1');
        log.info(`Created MinIO bucket: ${this.bucket}`);
      }
    } catch (error) {
      log.error('Failed to create bucket', error);
    }
  }

  /**
   * Upload file to MinIO
   */
  async uploadFile(
    file: Buffer,
    originalName: string,
    mimeType: string,
    sessionId: string,
  ): Promise<{ storedName: string; storageKey: string; storageUrl: string; size: number }> {
    if (!this.isConfigured || !this.client) {
      throw new Error('Storage service not configured');
    }

    const ext = path.extname(originalName);
    const storedName = `${crypto.randomBytes(16).toString('hex')}${ext}`;
    const storageKey = `sessions/${sessionId}/${storedName}`;

    await this.client.putObject(this.bucket, storageKey, file, file.length, {
      'Content-Type': mimeType,
      'x-amz-meta-original-name': originalName,
    });

    const endpoint = process.env.S3_ENDPOINT || 'http://localhost:9000';
    const storageUrl = `${endpoint}/${this.bucket}/${storageKey}`;

    log.info('File uploaded to MinIO', {
      storageKey,
      originalName,
      size: file.length,
    });

    return {
      storedName,
      storageKey,
      storageUrl,
      size: file.length,
    };
  }

  /**
   * Download file from MinIO
   */
  async downloadFile(storageKey: string): Promise<Buffer> {
    if (!this.isConfigured || !this.client) {
      throw new Error('Storage service not configured');
    }

    const chunks: Buffer[] = [];
    const stream = await this.client.getObject(this.bucket, storageKey);

    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  /**
   * Delete file from MinIO
   */
  async deleteFile(storageKey: string): Promise<void> {
    if (!this.isConfigured || !this.client) {
      throw new Error('Storage service not configured');
    }

    await this.client.removeObject(this.bucket, storageKey);
    log.info('File deleted from MinIO', { storageKey });
  }

  /**
   * Get presigned URL for direct download
   */
  async getPresignedUrl(storageKey: string, expirySeconds: number = 3600): Promise<string> {
    if (!this.isConfigured || !this.client) {
      throw new Error('Storage service not configured');
    }

    return await this.client.presignedGetObject(this.bucket, storageKey, expirySeconds);
  }

  /**
   * Get presigned URL for direct upload
   */
  async getPresignedUploadUrl(
    storageKey: string,
    expirySeconds: number = 3600,
  ): Promise<string> {
    if (!this.isConfigured || !this.client) {
      throw new Error('Storage service not configured');
    }

    return await this.client.presignedPutObject(this.bucket, storageKey, expirySeconds);
  }

  /**
   * Get file metadata
   */
  async getFileInfo(storageKey: string): Promise<Minio.BucketItemStat> {
    if (!this.isConfigured || !this.client) {
      throw new Error('Storage service not configured');
    }

    return await this.client.statObject(this.bucket, storageKey);
  }

  /**
   * List files in a session folder
   */
  async listSessionFiles(sessionId: string): Promise<Minio.BucketItem[]> {
    if (!this.isConfigured || !this.client) {
      throw new Error('Storage service not configured');
    }

    const prefix = `sessions/${sessionId}/`;
    const files: Minio.BucketItem[] = [];

    return new Promise((resolve, reject) => {
      const stream = this.client!.listObjects(this.bucket, prefix, false);

      stream.on('data', (obj) => files.push(obj));
      stream.on('end', () => resolve(files));
      stream.on('error', reject);
    });
  }

  /**
   * Check if service is configured
   */
  isReady(): boolean {
    return this.isConfigured;
  }
}

export default new StorageService();
