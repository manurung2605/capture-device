/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CameraViewport } from './components/CameraViewport';
import { UploadQueue } from './components/UploadQueue';
import { PublishedFeed } from './components/PublishedFeed';
import { DatabaseModal } from './components/DatabaseModal';
import { LightboxModal } from './components/LightboxModal';
import { MediaItem, QueueItem, StorageStats } from './types';
import {
  saveToClientDB,
  getAllFromClientDB,
  deleteFromClientDB,
  formatBytes,
} from './utils/indexedDB';
import {
  Camera,
  Database,
  Layers,
  Sparkles,
  Server,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

export default function App() {
  const [posts, setPosts] = useState<MediaItem[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isQueuePaused, setIsQueuePaused] = useState(false);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [stats, setStats] = useState<StorageStats | undefined>();
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);
  const [lightboxItem, setLightboxItem] = useState<MediaItem | null>(null);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);

  const isUploadingRef = useRef(false);

  // Fetch published posts from backend
  const fetchPosts = useCallback(async () => {
    setIsLoadingPosts(true);
    try {
      const res = await fetch('/api/media');
      if (!res.ok) throw new Error('Failed to load posts from server');
      const data = await res.json();
      if (data.success && Array.isArray(data.posts)) {
        setPosts(data.posts);
        setServerOnline(true);
      }
    } catch (err) {
      console.warn('Backend /api/media error, loading from IndexedDB fallback:', err);
      setServerOnline(false);
      // Fallback: load from client IndexedDB
      const offline = await getAllFromClientDB();
      if (offline.length > 0) {
        const fallbackPosts: MediaItem[] = offline.map((item) => ({
          id: item.id,
          url: URL.createObjectURL(item.blob),
          type: item.type,
          mimeType: item.mimeType,
          size: item.size,
          createdAt: item.createdAt,
          originalName: item.originalName,
        }));
        setPosts(fallbackPosts);
      }
    } finally {
      setIsLoadingPosts(false);
    }
  }, []);

  // Fetch backend storage stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setStats(data.stats);
        }
      }
    } catch {
      // Ignore stats fetch failure
    }
  }, []);

  useEffect(() => {
    fetchPosts();
    fetchStats();
  }, [fetchPosts, fetchStats]);

  // Add capture or file into the upload queue
  const handleCapture = (file: File, type: 'image' | 'video') => {
    const newItem: QueueItem = {
      id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      file,
      type,
      url: URL.createObjectURL(file),
      status: 'queued',
      timestamp: Date.now(),
    };

    setQueue((prev) => [newItem, ...prev]);
  };

  // Process the Upload Queue sequentially
  const processQueue = useCallback(async () => {
    if (isUploadingRef.current || isQueuePaused) return;

    // Find next queued item
    const nextItem = queue.find((i) => i.status === 'queued');
    if (!nextItem) {
      setIsProcessingQueue(false);
      return;
    }

    isUploadingRef.current = true;
    setIsProcessingQueue(true);

    // Update status to uploading
    setQueue((prev) =>
      prev.map((i) => (i.id === nextItem.id ? { ...i, status: 'uploading', error: undefined } : i))
    );

    try {
      const formData = new FormData();
      formData.append('media_file', nextItem.file);

      // POST to /api/upload
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Server upload failed');
      }

      // Mark as posted in queue
      setQueue((prev) =>
        prev.map((i) =>
          i.id === nextItem.id
            ? { ...i, status: 'posted', serverId: data.id }
            : i
        )
      );

      // Create new published post
      const newPost: MediaItem = {
        id: data.id,
        url: data.url || `/api/media/${data.id}/raw`,
        type: data.type || nextItem.type,
        mimeType: data.mimeType || (nextItem.type === 'video' ? 'video/webm' : 'image/jpeg'),
        size: data.size || nextItem.file.size,
        createdAt: data.createdAt || new Date().toISOString(),
        originalName: nextItem.file.name,
      };

      // Add to feed immediately at top (matches PHP postFeed.insertBefore)
      setPosts((prev) => [newPost, ...prev]);

      // Cache locally in IndexedDB for instant offline reliability
      await saveToClientDB({
        id: data.id,
        blob: nextItem.file,
        type: nextItem.type,
        mimeType: nextItem.file.type || (nextItem.type === 'video' ? 'video/webm' : 'image/jpeg'),
        size: nextItem.file.size,
        createdAt: new Date().toISOString(),
        originalName: nextItem.file.name,
      });

      fetchStats();
    } catch (err: unknown) {
      console.warn('Queue upload error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Upload storage failed';

      // Fallback: If server is down, save to client IndexedDB so user doesn't lose anything!
      const fallbackId = Date.now();
      try {
        await saveToClientDB({
          id: fallbackId,
          blob: nextItem.file,
          type: nextItem.type,
          mimeType: nextItem.file.type || (nextItem.type === 'video' ? 'video/webm' : 'image/jpeg'),
          size: nextItem.file.size,
          createdAt: new Date().toISOString(),
          originalName: nextItem.file.name,
        });

        // Add to local feed
        const localPost: MediaItem = {
          id: fallbackId,
          url: nextItem.url,
          type: nextItem.type,
          mimeType: nextItem.file.type || 'image/jpeg',
          size: nextItem.file.size,
          createdAt: new Date().toISOString(),
          originalName: nextItem.file.name,
        };
        setPosts((prev) => [localPost, ...prev]);

        setQueue((prev) =>
          prev.map((i) =>
            i.id === nextItem.id
              ? { ...i, status: 'posted', serverId: fallbackId }
              : i
          )
        );
      } catch {
        setQueue((prev) =>
          prev.map((i) =>
            i.id === nextItem.id
              ? { ...i, status: 'error', error: errorMessage }
              : i
          )
        );
      }
    } finally {
      isUploadingRef.current = false;
      // Trigger next cycle
      setTimeout(() => {
        processQueue();
      }, 100);
    }
  }, [queue, isQueuePaused, fetchStats]);

  // Automatically watch queue and process pending items
  useEffect(() => {
    const hasPending = queue.some((i) => i.status === 'queued');
    if (hasPending && !isUploadingRef.current && !isQueuePaused) {
      processQueue();
    }
  }, [queue, isQueuePaused, processQueue]);

  // Retry an individual failed item
  const handleRetryItem = (id: string) => {
    setQueue((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: 'queued', error: undefined } : i))
    );
  };

  // Retry all failed items
  const handleRetryAllFailed = () => {
    setQueue((prev) =>
      prev.map((i) => (i.status === 'error' ? { ...i, status: 'queued', error: undefined } : i))
    );
  };

  // Remove item from queue
  const handleRemoveQueueItem = (id: string) => {
    setQueue((prev) => prev.filter((i) => i.id !== id));
  };

  // Clear completed items
  const handleClearCompleted = () => {
    setQueue((prev) => prev.filter((i) => i.status !== 'posted'));
  };

  // Delete published post
  const handleDeletePost = async (id: number) => {
    if (!confirm(`Delete media item #${id} from IMG-VID storage?`)) return;

    try {
      await fetch(`/api/media/${id}`, { method: 'DELETE' });
    } catch {
      // Continue client cleanup
    }

    await deleteFromClientDB(id);
    setPosts((prev) => prev.filter((p) => p.id !== id));
    fetchStats();
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col items-center">
      {/* Top Banner & Header */}
      <header className="w-full border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-900/40 text-white shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-white flex items-center gap-2">
                Direct Camera Capture &amp; Auto-Posting Queue
              </h1>
              <p className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>`IMG-VID` LONGBLOB Storage Engine</span>
                {stats && (
                  <span className="text-slate-500">• {stats.totalRecords} Saved Records</span>
                )}
              </p>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsDbModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 border border-slate-700/80 text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
              title="Inspect MySQL / Storage Configuration"
            >
              <Database className="w-3.5 h-3.5 text-blue-400" />
              <span>Database Inspector</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main App Container (max-w matching original PHP styling 900px-1100px) */}
      <main className="w-full max-w-6xl px-3 sm:px-6 py-5 sm:py-6 flex flex-col gap-5 sm:gap-6">
        {/* Live Camera Viewport Card */}
        <section aria-label="Camera Capture Viewport">
          <CameraViewport onCapture={handleCapture} />
        </section>

        {/* Two-Column Feed Layout (Queue & Published Feed) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          {/* Upload Queue Column */}
          <section aria-label="Upload Queue">
            <UploadQueue
              queue={queue}
              isPaused={isQueuePaused}
              onTogglePause={() => setIsQueuePaused((p) => !p)}
              onRetry={handleRetryItem}
              onRemove={handleRemoveQueueItem}
              onClearCompleted={handleClearCompleted}
              onRetryAllFailed={handleRetryAllFailed}
            />
          </section>

          {/* Published Post Feed Column */}
          <section aria-label="Published Post Feed">
            <PublishedFeed
              posts={posts}
              isLoading={isLoadingPosts}
              onRefresh={fetchPosts}
              onDelete={handleDeletePost}
              onSelectLightbox={(item) => setLightboxItem(item)}
            />
          </section>
        </div>
      </main>

      {/* Database Inspector Modal */}
      <DatabaseModal
        isOpen={isDbModalOpen}
        onClose={() => setIsDbModalOpen(false)}
        stats={stats}
      />

      {/* Lightbox / Fullscreen Preview Modal */}
      <LightboxModal
        item={lightboxItem}
        onClose={() => setLightboxItem(null)}
      />

      {/* Footer */}
      <footer className="w-full border-t border-slate-800/60 py-4 px-6 mt-auto text-center text-xs text-slate-500 flex flex-wrap items-center justify-center gap-4">
        <span>Direct Camera Capture &amp; Auto-Posting Queue</span>
        <span>•</span>
        <span>Table: <code className="text-slate-400 font-mono">`IMG-VID` (`ID`, `STORAGE` LONGBLOB)</code></span>
        <span>•</span>
        <span>Real-time Hardware Media Pipeline</span>
      </footer>
    </div>
  );
}
