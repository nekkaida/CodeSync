// Unit tests for snapshot validators
// Tests all Zod schemas in src/validators/snapshot.validator.ts

import {
  createSnapshotSchema,
  listSnapshotsSchema,
  getSnapshotSchema,
  restoreSnapshotSchema,
} from '../../../validators/snapshot.validator';
import { generateCuid } from '../../helpers/testData';

describe('Snapshot Validators', () => {
  const validCuid = generateCuid();

  describe('createSnapshotSchema', () => {
    const validInput = {
      body: {
        sessionId: validCuid,
        yjsState: 'base64encodedyjsstate',
        changeSummary: 'Initial snapshot',
        linesAdded: 10,
        linesRemoved: 5,
      },
    };

    describe('valid inputs', () => {
      it('should accept valid snapshot data', () => {
        const result = createSnapshotSchema.safeParse(validInput);
        expect(result.success).toBe(true);
      });

      it('should accept minimal required fields', () => {
        const input = {
          body: {
            sessionId: validCuid,
            yjsState: 'somestate',
          },
        };
        const result = createSnapshotSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('should accept snapshot without changeSummary', () => {
        const input = {
          body: {
            sessionId: validCuid,
            yjsState: 'state123',
            linesAdded: 5,
            linesRemoved: 2,
          },
        };
        const result = createSnapshotSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('should accept snapshot without line counts', () => {
        const input = {
          body: {
            sessionId: validCuid,
            yjsState: 'state123',
            changeSummary: 'Summary',
          },
        };
        const result = createSnapshotSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('should accept long yjsState', () => {
        const input = {
          body: {
            sessionId: validCuid,
            yjsState: 'A'.repeat(10000),
          },
        };
        const result = createSnapshotSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });

    describe('sessionId validation', () => {
      it('should reject invalid session ID', () => {
        const input = {
          body: {
            sessionId: 'invalid',
            yjsState: 'state',
          },
        };
        const result = createSnapshotSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('should reject missing session ID', () => {
        const input = {
          body: {
            yjsState: 'state',
          },
        };
        const result = createSnapshotSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });

    describe('yjsState validation', () => {
      it('should reject empty yjsState', () => {
        const input = {
          body: {
            sessionId: validCuid,
            yjsState: '',
          },
        };
        const result = createSnapshotSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('should reject missing yjsState', () => {
        const input = {
          body: {
            sessionId: validCuid,
          },
        };
        const result = createSnapshotSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });

    describe('linesAdded/linesRemoved validation', () => {
      it('should accept zero values', () => {
        const input = {
          body: {
            sessionId: validCuid,
            yjsState: 'state',
            linesAdded: 0,
            linesRemoved: 0,
          },
        };
        const result = createSnapshotSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('should reject negative linesAdded', () => {
        const input = {
          body: {
            sessionId: validCuid,
            yjsState: 'state',
            linesAdded: -1,
          },
        };
        const result = createSnapshotSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('should reject negative linesRemoved', () => {
        const input = {
          body: {
            sessionId: validCuid,
            yjsState: 'state',
            linesRemoved: -1,
          },
        };
        const result = createSnapshotSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('should reject non-integer linesAdded', () => {
        const input = {
          body: {
            sessionId: validCuid,
            yjsState: 'state',
            linesAdded: 5.5,
          },
        };
        const result = createSnapshotSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('should reject non-integer linesRemoved', () => {
        const input = {
          body: {
            sessionId: validCuid,
            yjsState: 'state',
            linesRemoved: 3.7,
          },
        };
        const result = createSnapshotSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('should accept large line counts', () => {
        const input = {
          body: {
            sessionId: validCuid,
            yjsState: 'state',
            linesAdded: 100000,
            linesRemoved: 50000,
          },
        };
        const result = createSnapshotSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });

    describe('changeSummary validation', () => {
      it('should accept empty string', () => {
        const input = {
          body: {
            sessionId: validCuid,
            yjsState: 'state',
            changeSummary: '',
          },
        };
        const result = createSnapshotSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('should accept long summary', () => {
        const input = {
          body: {
            sessionId: validCuid,
            yjsState: 'state',
            changeSummary: 'A'.repeat(1000),
          },
        };
        const result = createSnapshotSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('listSnapshotsSchema', () => {
    describe('valid inputs', () => {
      it('should accept valid session ID', () => {
        const input = {
          params: { sessionId: validCuid },
          query: {},
        };
        const result = listSnapshotsSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('should accept pagination params as strings', () => {
        const input = {
          params: { sessionId: validCuid },
          query: { limit: '10', offset: '5' },
        };
        const result = listSnapshotsSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('should accept empty query', () => {
        const input = {
          params: { sessionId: validCuid },
          query: {},
        };
        const result = listSnapshotsSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });

    describe('params validation', () => {
      it('should reject invalid session ID', () => {
        const input = {
          params: { sessionId: 'invalid' },
          query: {},
        };
        const result = listSnapshotsSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('should reject missing session ID', () => {
        const input = {
          params: {},
          query: {},
        };
        const result = listSnapshotsSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });

    describe('query validation', () => {
      it('should accept numeric string for limit', () => {
        const input = {
          params: { sessionId: validCuid },
          query: { limit: '25' },
        };
        const result = listSnapshotsSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it('should accept numeric string for offset', () => {
        const input = {
          params: { sessionId: validCuid },
          query: { offset: '10' },
        };
        const result = listSnapshotsSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('getSnapshotSchema', () => {
    describe('valid inputs', () => {
      it('should accept valid snapshot ID', () => {
        const input = {
          params: { snapshotId: validCuid },
        };
        const result = getSnapshotSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });

    describe('params validation', () => {
      it('should reject invalid snapshot ID', () => {
        const input = {
          params: { snapshotId: 'invalid' },
        };
        const result = getSnapshotSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('should reject missing snapshot ID', () => {
        const input = {
          params: {},
        };
        const result = getSnapshotSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('should reject empty snapshot ID', () => {
        const input = {
          params: { snapshotId: '' },
        };
        const result = getSnapshotSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('restoreSnapshotSchema', () => {
    describe('valid inputs', () => {
      it('should accept valid snapshot ID', () => {
        const input = {
          params: { snapshotId: validCuid },
        };
        const result = restoreSnapshotSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });

    describe('params validation', () => {
      it('should reject invalid snapshot ID', () => {
        const input = {
          params: { snapshotId: 'invalid' },
        };
        const result = restoreSnapshotSchema.safeParse(input);
        expect(result.success).toBe(false);
      });

      it('should reject missing snapshot ID', () => {
        const input = {
          params: {},
        };
        const result = restoreSnapshotSchema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Schema integration', () => {
    it('should work with typical snapshot workflow', () => {
      // Create snapshot
      const createInput = {
        body: {
          sessionId: validCuid,
          yjsState: 'YWJjMTIz', // base64 example
          changeSummary: 'Added new feature',
          linesAdded: 50,
          linesRemoved: 10,
        },
      };
      const createResult = createSnapshotSchema.safeParse(createInput);
      expect(createResult.success).toBe(true);

      // List snapshots
      const listInput = {
        params: { sessionId: validCuid },
        query: { limit: '20', offset: '0' },
      };
      const listResult = listSnapshotsSchema.safeParse(listInput);
      expect(listResult.success).toBe(true);

      // Get snapshot
      const snapshotId = generateCuid();
      const getInput = {
        params: { snapshotId },
      };
      const getResult = getSnapshotSchema.safeParse(getInput);
      expect(getResult.success).toBe(true);

      // Restore snapshot
      const restoreInput = {
        params: { snapshotId },
      };
      const restoreResult = restoreSnapshotSchema.safeParse(restoreInput);
      expect(restoreResult.success).toBe(true);
    });
  });
});
