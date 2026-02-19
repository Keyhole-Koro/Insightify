import { test, expect } from '@playwright/test';
import { buildChatNode, installBaseRpcMocks, installMockInteractionSocket, seedRestoreCache } from '../helpers/mockBackend.mjs';

const runId = 'run-cache-1';
const tabId = 'tab-e2e-1';
const projectId = 'project-e2e-1';

test.describe('restore cache source selection', () => {
  test('uses local cache when runId/hash match', async ({ page }) => {
    const cachedDoc = {
      runId,
      version: 9,
      nodes: [
        buildChatNode({
          nodeId: 'node-cache-hit',
          messages: [
            { id: 'c1', role: 'ROLE_ASSISTANT', content: 'cache document' },
          ],
        }),
      ],
    };

    await seedRestoreCache(page, {
      projectId,
      tabId,
      runId,
      documentHash: 'hash-cache-1',
      document: cachedDoc,
    });

    await installMockInteractionSocket(page);
    await installBaseRpcMocks(page, {
      restoreResponse: {
        reason: 'UI_RESTORE_REASON_RESOLVED',
        projectId,
        tabId,
        runId,
        document: {
          runId,
          version: 1,
          nodes: [
            buildChatNode({
              nodeId: 'node-server-doc',
              messages: [
                { id: 's1', role: 'ROLE_ASSISTANT', content: 'server document' },
              ],
            }),
          ],
        },
        documentHash: 'hash-cache-1',
      },
    });

    await page.goto('/');
    await expect(page.getByText(/Restore succeeded \(cache\)/)).toBeVisible();
    await expect(page.getByText('cache document')).toBeVisible();
  });

  test('uses server when hash mismatches', async ({ page }) => {
    const cachedDoc = {
      runId,
      version: 9,
      nodes: [
        buildChatNode({
          nodeId: 'node-cache-miss',
          messages: [
            { id: 'c2', role: 'ROLE_ASSISTANT', content: 'stale cache document' },
          ],
        }),
      ],
    };

    await seedRestoreCache(page, {
      projectId,
      tabId,
      runId,
      documentHash: 'hash-old',
      document: cachedDoc,
    });

    await installMockInteractionSocket(page);
    await installBaseRpcMocks(page, {
      restoreResponse: {
        reason: 'UI_RESTORE_REASON_RESOLVED',
        projectId,
        tabId,
        runId,
        document: {
          runId,
          version: 3,
          nodes: [
            buildChatNode({
              nodeId: 'node-server-win',
              messages: [
                { id: 's2', role: 'ROLE_ASSISTANT', content: 'fresh server document' },
              ],
            }),
          ],
        },
        documentHash: 'hash-new',
      },
    });

    await page.goto('/');
    await expect(page.getByText(/Restore succeeded \(server\)/)).toBeVisible();
    await expect(page.getByText('fresh server document')).toBeVisible();
  });
});
