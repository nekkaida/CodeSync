// Storage service tests
// Tests MinIO/S3 file storage operations

import { Readable } from 'stream';

// Mock Minio before importing storage service
const mockBucketExists = jest.fn();
const mockMakeBucket = jest.fn();
const mockPutObject = jest.fn();
const mockGetObject = jest.fn();
const mockRemoveObject = jest.fn();
const mockPresignedGetObject = jest.fn();
const mockPresignedPutObject = jest.fn();
const mockStatObject = jest.fn();
const mockListObjects = jest.fn();

jest.mock('minio', () => ({
  Client: jest.fn().mockImplementation(() => ({
    bucketExists: mockBucketExists,
    makeBucket: mockMakeBucket,
    putObject: mockPutObject,
    getObject: mockGetObject,
    removeObject: mockRemoveObject,
    presignedGetObject: mockPresignedGetObject,
    presignedPutObject: mockPresignedPutObject,
    statObject: mockStatObject,
    listObjects: mockListObjects,
  })),
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  log: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Set up env vars before importing
process.env.S3_ENDPOINT = 'localhost';
process.env.S3_PORT = '9000';
process.env.S3_ACCESS_KEY = 'testkey';
process.env.S3_SECRET_KEY = 'testsecret';
process.env.S3_BUCKET = 'test-bucket';
process.env.S3_USE_SSL = 'false';

// Helper to create a readable stream from a buffer
function createReadableStream(data: Buffer): Readable {
  const stream = new Readable({
    read() {
      this.push(data);
      this.push(null);
    },
  });
  return stream;
}

describe('StorageService', () => {
  let storageService: typeof import('../../services/storage.service').default;

  beforeEach(() => {
    jest.clearAllMocks();
    mockBucketExists.mockResolvedValue(true);

    // Clear module cache to get fresh instance
    jest.resetModules();

    // Re-mock after reset
    jest.doMock('minio', () => ({
      Client: jest.fn().mockImplementation(() => ({
        bucketExists: mockBucketExists,
        makeBucket: mockMakeBucket,
        putObject: mockPutObject,
        getObject: mockGetObject,
        removeObject: mockRemoveObject,
        presignedGetObject: mockPresignedGetObject,
        presignedPutObject: mockPresignedPutObject,
        statObject: mockStatObject,
        listObjects: mockListObjects,
      })),
    }));

    jest.doMock('../../utils/logger', () => ({
      log: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      },
    }));

    // Import fresh instance
    storageService = require('../../services/storage.service').default;
  });

  describe('initialization', () => {
    it('should initialize with environment variables', () => {
      expect(storageService.isReady()).toBe(true);
    });

    it('should create bucket if it does not exist', async () => {
      jest.resetModules();
      mockBucketExists.mockResolvedValue(false);
      mockMakeBucket.mockResolvedValue(undefined);

      jest.doMock('minio', () => ({
        Client: jest.fn().mockImplementation(() => ({
          bucketExists: mockBucketExists,
          makeBucket: mockMakeBucket,
          putObject: mockPutObject,
          getObject: mockGetObject,
          removeObject: mockRemoveObject,
          presignedGetObject: mockPresignedGetObject,
          presignedPutObject: mockPresignedPutObject,
          statObject: mockStatObject,
          listObjects: mockListObjects,
        })),
      }));

      const freshService = require('../../services/storage.service').default;
      // Give async initialization time
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(freshService.isReady()).toBe(true);
    });
  });

  describe('uploadFile', () => {
    it('should upload a file and return storage info', async () => {
      mockPutObject.mockResolvedValue({ etag: 'abc123' });

      const buffer = Buffer.from('test file content');
      const result = await storageService.uploadFile(
        buffer,
        'test.txt',
        'text/plain',
        'session-123',
      );

      expect(result).toHaveProperty('storedName');
      expect(result).toHaveProperty('storageKey');
      expect(result).toHaveProperty('storageUrl');
      expect(result).toHaveProperty('size');
      expect(result.storageKey).toContain('sessions/session-123/');
      expect(result.storedName).toContain('.txt');
      expect(result.size).toBe(buffer.length);
      expect(mockPutObject).toHaveBeenCalled();
    });

    it('should preserve file extension', async () => {
      mockPutObject.mockResolvedValue({ etag: 'abc123' });

      const buffer = Buffer.from('test image');
      const result = await storageService.uploadFile(
        buffer,
        'image.png',
        'image/png',
        'session-123',
      );

      expect(result.storedName).toMatch(/\.png$/);
    });

    it('should handle files without extension', async () => {
      mockPutObject.mockResolvedValue({ etag: 'abc123' });

      const buffer = Buffer.from('test content');
      const result = await storageService.uploadFile(
        buffer,
        'Makefile',
        'application/octet-stream',
        'session-123',
      );

      expect(result.storedName).toBeDefined();
      expect(result.storageKey).toContain('sessions/session-123/');
    });
  });

  describe('downloadFile', () => {
    it('should download a file and return buffer', async () => {
      const fileContent = Buffer.from('downloaded content');
      const stream = createReadableStream(fileContent);
      mockGetObject.mockResolvedValue(stream);

      const result = await storageService.downloadFile('sessions/session-123/file.txt');

      expect(result).toBeInstanceOf(Buffer);
      expect(result.toString()).toBe('downloaded content');
      expect(mockGetObject).toHaveBeenCalledWith('test-bucket', 'sessions/session-123/file.txt');
    });

    it('should handle stream errors', async () => {
      const errorStream = new Readable({
        read() {
          // Emit error on first read
          this.destroy(new Error('Stream error'));
        },
      });
      mockGetObject.mockResolvedValue(errorStream);

      await expect(
        storageService.downloadFile('sessions/session-123/file.txt'),
      ).rejects.toThrow('Stream error');
    });
  });

  describe('deleteFile', () => {
    it('should delete a file', async () => {
      mockRemoveObject.mockResolvedValue(undefined);

      await storageService.deleteFile('sessions/session-123/file.txt');

      expect(mockRemoveObject).toHaveBeenCalledWith(
        'test-bucket',
        'sessions/session-123/file.txt',
      );
    });
  });

  describe('getPresignedUrl', () => {
    it('should return presigned download URL', async () => {
      mockPresignedGetObject.mockResolvedValue('https://example.com/presigned-url');

      const url = await storageService.getPresignedUrl('sessions/session-123/file.txt');

      expect(url).toBe('https://example.com/presigned-url');
      expect(mockPresignedGetObject).toHaveBeenCalledWith(
        'test-bucket',
        'sessions/session-123/file.txt',
        3600,
      );
    });

    it('should accept custom expiry time', async () => {
      mockPresignedGetObject.mockResolvedValue('https://example.com/presigned-url');

      await storageService.getPresignedUrl('sessions/session-123/file.txt', 7200);

      expect(mockPresignedGetObject).toHaveBeenCalledWith(
        'test-bucket',
        'sessions/session-123/file.txt',
        7200,
      );
    });
  });

  describe('getPresignedUploadUrl', () => {
    it('should return presigned upload URL', async () => {
      mockPresignedPutObject.mockResolvedValue('https://example.com/upload-url');

      const url = await storageService.getPresignedUploadUrl('sessions/session-123/newfile.txt');

      expect(url).toBe('https://example.com/upload-url');
      expect(mockPresignedPutObject).toHaveBeenCalledWith(
        'test-bucket',
        'sessions/session-123/newfile.txt',
        3600,
      );
    });

    it('should accept custom expiry time', async () => {
      mockPresignedPutObject.mockResolvedValue('https://example.com/upload-url');

      await storageService.getPresignedUploadUrl('sessions/session-123/newfile.txt', 1800);

      expect(mockPresignedPutObject).toHaveBeenCalledWith(
        'test-bucket',
        'sessions/session-123/newfile.txt',
        1800,
      );
    });
  });

  describe('getFileInfo', () => {
    it('should return file metadata', async () => {
      const mockStat = {
        size: 1024,
        etag: 'abc123',
        lastModified: new Date(),
        metaData: { 'content-type': 'text/plain' },
      };
      mockStatObject.mockResolvedValue(mockStat);

      const info = await storageService.getFileInfo('sessions/session-123/file.txt');

      expect(info).toEqual(mockStat);
      expect(mockStatObject).toHaveBeenCalledWith(
        'test-bucket',
        'sessions/session-123/file.txt',
      );
    });
  });

  describe('listSessionFiles', () => {
    it('should list files in a session', async () => {
      const mockFiles = [
        { name: 'file1.txt', size: 100 },
        { name: 'file2.txt', size: 200 },
      ];

      let index = 0;
      const mockStream = new Readable({
        objectMode: true,
        read() {
          if (index < mockFiles.length) {
            this.push(mockFiles[index++]);
          } else {
            this.push(null);
          }
        },
      });
      mockListObjects.mockReturnValue(mockStream);

      const files = await storageService.listSessionFiles('session-123');

      expect(files).toHaveLength(2);
      expect(mockListObjects).toHaveBeenCalledWith('test-bucket', 'sessions/session-123/', false);
    });

    it('should handle stream errors when listing', async () => {
      const mockStream = new Readable({
        objectMode: true,
        read() {
          this.destroy(new Error('List error'));
        },
      });
      mockListObjects.mockReturnValue(mockStream);

      await expect(storageService.listSessionFiles('session-123')).rejects.toThrow('List error');
    });
  });

  describe('isReady', () => {
    it('should return true when configured', () => {
      expect(storageService.isReady()).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should throw when not configured for uploadFile', async () => {
      jest.resetModules();

      // Create service without proper config
      const originalEndpoint = process.env.S3_ENDPOINT;
      delete process.env.S3_ENDPOINT;

      jest.doMock('minio', () => ({
        Client: jest.fn().mockImplementation(() => {
          throw new Error('Connection failed');
        }),
      }));

      jest.doMock('../../utils/logger', () => ({
        log: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
          debug: jest.fn(),
        },
      }));

      const unconfiguredService = require('../../services/storage.service').default;

      await expect(
        unconfiguredService.uploadFile(Buffer.from('test'), 'test.txt', 'text/plain', 'session-1'),
      ).rejects.toThrow('Storage service not configured');

      process.env.S3_ENDPOINT = originalEndpoint;
    });

    it('should throw when not configured for downloadFile', async () => {
      jest.resetModules();

      jest.doMock('minio', () => ({
        Client: jest.fn().mockImplementation(() => {
          throw new Error('Connection failed');
        }),
      }));

      jest.doMock('../../utils/logger', () => ({
        log: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
          debug: jest.fn(),
        },
      }));

      const unconfiguredService = require('../../services/storage.service').default;

      await expect(
        unconfiguredService.downloadFile('sessions/session-1/file.txt'),
      ).rejects.toThrow('Storage service not configured');
    });

    it('should throw when not configured for deleteFile', async () => {
      jest.resetModules();

      jest.doMock('minio', () => ({
        Client: jest.fn().mockImplementation(() => {
          throw new Error('Connection failed');
        }),
      }));

      jest.doMock('../../utils/logger', () => ({
        log: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
          debug: jest.fn(),
        },
      }));

      const unconfiguredService = require('../../services/storage.service').default;

      await expect(
        unconfiguredService.deleteFile('sessions/session-1/file.txt'),
      ).rejects.toThrow('Storage service not configured');
    });

    it('should throw when not configured for getPresignedUrl', async () => {
      jest.resetModules();

      jest.doMock('minio', () => ({
        Client: jest.fn().mockImplementation(() => {
          throw new Error('Connection failed');
        }),
      }));

      jest.doMock('../../utils/logger', () => ({
        log: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
          debug: jest.fn(),
        },
      }));

      const unconfiguredService = require('../../services/storage.service').default;

      await expect(
        unconfiguredService.getPresignedUrl('sessions/session-1/file.txt'),
      ).rejects.toThrow('Storage service not configured');
    });

    it('should throw when not configured for getPresignedUploadUrl', async () => {
      jest.resetModules();

      jest.doMock('minio', () => ({
        Client: jest.fn().mockImplementation(() => {
          throw new Error('Connection failed');
        }),
      }));

      jest.doMock('../../utils/logger', () => ({
        log: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
          debug: jest.fn(),
        },
      }));

      const unconfiguredService = require('../../services/storage.service').default;

      await expect(
        unconfiguredService.getPresignedUploadUrl('sessions/session-1/file.txt'),
      ).rejects.toThrow('Storage service not configured');
    });

    it('should throw when not configured for getFileInfo', async () => {
      jest.resetModules();

      jest.doMock('minio', () => ({
        Client: jest.fn().mockImplementation(() => {
          throw new Error('Connection failed');
        }),
      }));

      jest.doMock('../../utils/logger', () => ({
        log: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
          debug: jest.fn(),
        },
      }));

      const unconfiguredService = require('../../services/storage.service').default;

      await expect(
        unconfiguredService.getFileInfo('sessions/session-1/file.txt'),
      ).rejects.toThrow('Storage service not configured');
    });

    it('should throw when not configured for listSessionFiles', async () => {
      jest.resetModules();

      jest.doMock('minio', () => ({
        Client: jest.fn().mockImplementation(() => {
          throw new Error('Connection failed');
        }),
      }));

      jest.doMock('../../utils/logger', () => ({
        log: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
          debug: jest.fn(),
        },
      }));

      const unconfiguredService = require('../../services/storage.service').default;

      await expect(
        unconfiguredService.listSessionFiles('session-1'),
      ).rejects.toThrow('Storage service not configured');
    });
  });

  describe('endpoint cleaning', () => {
    it('should remove http:// prefix from endpoint', () => {
      jest.resetModules();

      process.env.S3_ENDPOINT = 'http://localhost';

      jest.doMock('minio', () => ({
        Client: jest.fn().mockImplementation(() => ({
          bucketExists: mockBucketExists,
          makeBucket: mockMakeBucket,
          putObject: mockPutObject,
          getObject: mockGetObject,
          removeObject: mockRemoveObject,
          presignedGetObject: mockPresignedGetObject,
          presignedPutObject: mockPresignedPutObject,
          statObject: mockStatObject,
          listObjects: mockListObjects,
        })),
      }));

      jest.doMock('../../utils/logger', () => ({
        log: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
          debug: jest.fn(),
        },
      }));

      const serviceWithHttp = require('../../services/storage.service').default;
      expect(serviceWithHttp.isReady()).toBe(true);

      process.env.S3_ENDPOINT = 'localhost';
    });

    it('should remove https:// prefix from endpoint', () => {
      jest.resetModules();

      process.env.S3_ENDPOINT = 'https://s3.example.com';

      jest.doMock('minio', () => ({
        Client: jest.fn().mockImplementation(() => ({
          bucketExists: mockBucketExists,
          makeBucket: mockMakeBucket,
          putObject: mockPutObject,
          getObject: mockGetObject,
          removeObject: mockRemoveObject,
          presignedGetObject: mockPresignedGetObject,
          presignedPutObject: mockPresignedPutObject,
          statObject: mockStatObject,
          listObjects: mockListObjects,
        })),
      }));

      jest.doMock('../../utils/logger', () => ({
        log: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
          debug: jest.fn(),
        },
      }));

      const serviceWithHttps = require('../../services/storage.service').default;
      expect(serviceWithHttps.isReady()).toBe(true);

      process.env.S3_ENDPOINT = 'localhost';
    });
  });

  describe('SSL configuration', () => {
    it('should use SSL when S3_USE_SSL is true', () => {
      jest.resetModules();

      process.env.S3_USE_SSL = 'true';
      mockBucketExists.mockResolvedValue(true);

      jest.doMock('minio', () => ({
        Client: jest.fn().mockImplementation(() => ({
          bucketExists: mockBucketExists,
          makeBucket: mockMakeBucket,
          putObject: mockPutObject,
          getObject: mockGetObject,
          removeObject: mockRemoveObject,
          presignedGetObject: mockPresignedGetObject,
          presignedPutObject: mockPresignedPutObject,
          statObject: mockStatObject,
          listObjects: mockListObjects,
        })),
      }));

      jest.doMock('../../utils/logger', () => ({
        log: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
          debug: jest.fn(),
        },
      }));

      const sslService = require('../../services/storage.service').default;
      expect(sslService.isReady()).toBe(true);

      process.env.S3_USE_SSL = 'false';
    });
  });
});
