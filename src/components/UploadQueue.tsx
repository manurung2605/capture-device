import React from 'react';
import { QueueItem } from '../types';
import { formatBytes } from '../utils/indexedDB';
import {
  Clock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Trash2,
  Pause,
  Play,
  Film,
  Image as ImageIcon,
  HardDriveDownload,
} from 'lucide-react';

interface UploadQueueProps {
  queue: QueueItem[];
  isPaused: boolean;
  onTogglePause: () => void;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
  onClearCompleted: () => void;
  onRetryAllFailed: () => void;
}

export const UploadQueue: React.FC<UploadQueueProps> = ({
  queue,
  isPaused,
  onTogglePause,
  onRetry,
  onRemove,
  onClearCompleted,
  onRetryAllFailed,
}) => {
  const activeItems = queue.filter((i) => i.status !== 'posted');
  const failedItems = queue.filter((i) => i.status === 'error');
  const completedItems = queue.filter((i) => i.status === 'posted');

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col h-full">
      {/* Queue Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-600/20 text-blue-400">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              Upload Queue
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                {activeItems.length} active
              </span>
            </h2>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5">
          {failedItems.length > 0 && (
            <button
              onClick={onRetryAllFailed}
              className="p-1.5 rounded-lg bg-amber-950/70 border border-amber-800 text-amber-300 hover:bg-amber-900 text-xs flex items-center gap-1 transition"
              title="Retry All Failed"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Retry All</span>
            </button>
          )}

          <button
            onClick={onTogglePause}
            className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition ${
              isPaused
                ? 'bg-amber-600/20 border-amber-500/50 text-amber-300 hover:bg-amber-600/30'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
            title={isPaused ? 'Resume auto-upload queue' : 'Pause queue'}
          >
            {isPaused ? <Play className="w-3.5 h-3.5 text-amber-400" /> : <Pause className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isPaused ? 'Resume' : 'Pause'}</span>
          </button>

          {completedItems.length > 0 && (
            <button
              onClick={onClearCompleted}
              className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-700 text-xs transition"
              title="Clear completed queue entries"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Queue items list */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 max-h-[500px]">
        {queue.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center border-2 border-dashed border-slate-800/80 rounded-xl">
            <Clock className="w-8 h-8 text-slate-600 mb-2 stroke-1" />
            <p className="text-xs sm:text-sm font-medium text-slate-400">Queue is empty</p>
            <p className="text-[11px] text-slate-500 max-w-xs mt-1">
              Photos taken or recorded videos will automatically queue here and post directly into IMG-VID storage.
            </p>
          </div>
        ) : (
          queue.map((item) => (
            <div
              key={item.id}
              className={`p-2.5 rounded-xl border transition-all ${
                item.status === 'uploading'
                  ? 'bg-blue-950/20 border-blue-600/50 ring-1 ring-blue-500/30'
                  : item.status === 'posted'
                  ? 'bg-emerald-950/10 border-emerald-800/40 opacity-75'
                  : item.status === 'error'
                  ? 'bg-rose-950/20 border-rose-800/50'
                  : 'bg-slate-950/70 border-slate-800'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Media thumbnail */}
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden bg-black shrink-0 border border-slate-800 flex items-center justify-center">
                  {item.type === 'image' ? (
                    <img src={item.url} alt="Queue thumbnail" className="w-full h-full object-cover" />
                  ) : (
                    <video src={item.url} className="w-full h-full object-cover" muted />
                  )}
                  <span className="absolute bottom-1 right-1 p-0.5 rounded bg-black/75 text-[9px] text-slate-300">
                    {item.type === 'image' ? <ImageIcon className="w-3 h-3" /> : <Film className="w-3 h-3 text-red-400" />}
                  </span>
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-semibold text-white truncate max-w-[140px] sm:max-w-[180px]">
                      {item.file.name}
                    </span>
                    <button
                      onClick={() => onRemove(item.id)}
                      className="text-slate-500 hover:text-slate-300 p-1"
                      title="Remove from queue"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                    <span>{formatBytes(item.file.size)}</span>
                    <span>•</span>
                    <span className="uppercase">{item.type}</span>
                  </div>

                  {/* Status Badges & Action */}
                  <div className="flex items-center justify-between gap-2 mt-2">
                    {item.status === 'queued' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300 bg-amber-950/80 border border-amber-800/60 px-2 py-0.5 rounded-md">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        Queued
                      </span>
                    )}

                    {item.status === 'uploading' && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-300 bg-blue-950/80 border border-blue-800/60 px-2 py-0.5 rounded-md animate-pulse">
                        <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                        Saving to LONGBLOB...
                      </span>
                    )}

                    {item.status === 'posted' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300 bg-emerald-950/80 border border-emerald-800/60 px-2 py-0.5 rounded-md">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        Saved #{item.serverId || 'OK'}
                      </span>
                    )}

                    {item.status === 'error' && (
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-300 bg-rose-950/80 border border-rose-800/60 px-2 py-0.5 rounded-md">
                          <AlertCircle className="w-3 h-3 text-rose-400" />
                          Failed
                        </span>
                        <button
                          onClick={() => onRetry(item.id)}
                          className="px-2 py-0.5 bg-rose-900/60 hover:bg-rose-800 border border-rose-700/60 text-white rounded text-[11px] font-medium flex items-center gap-1"
                        >
                          <RotateCcw className="w-2.5 h-2.5" /> Retry
                        </button>
                      </div>
                    )}

                    {/* Local download copy */}
                    <a
                      href={item.url}
                      download={item.file.name}
                      className="text-slate-500 hover:text-slate-300 p-0.5"
                      title="Download local file copy"
                    >
                      <HardDriveDownload className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  {item.error && <p className="text-[10px] text-rose-400 mt-1 line-clamp-1">{item.error}</p>}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
