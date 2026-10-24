import React, { useEffect } from 'react';
import { MediaItem } from '../types';
import { formatBytes } from '../utils/indexedDB';
import { X, Download, HardDrive, Calendar, Film, Image as ImageIcon } from 'lucide-react';

interface LightboxModalProps {
  item: MediaItem | null;
  onClose: () => void;
}

export const LightboxModal: React.FC<LightboxModalProps> = ({ item, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!item) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-5xl w-full max-h-[92vh] flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl"
      >
        {/* Lightbox Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 bg-slate-950/80 border-b border-slate-800 text-xs">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-blue-600 text-white font-mono font-bold text-xs">
              #{item.id}
            </span>
            <span className="font-semibold text-white truncate max-w-xs sm:max-w-md">
              {item.originalName || `IMG-VID Record #${item.id}`}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono text-[10px]">
              {formatBytes(item.size)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={item.url}
              download={`img_vid_${item.id}.${item.type === 'video' ? 'webm' : 'jpg'}`}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold flex items-center gap-1.5 transition text-xs shadow"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Original</span>
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Media Content */}
        <div className="flex-1 bg-black flex items-center justify-center overflow-hidden min-h-[300px] max-h-[75vh] p-2">
          {item.type === 'image' ? (
            <img
              src={item.url}
              alt={`IMG-VID Record #${item.id}`}
              className="max-h-[72vh] max-w-full object-contain rounded-lg"
            />
          ) : (
            <video
              src={item.url}
              controls
              autoPlay
              playsInline
              className="max-h-[72vh] max-w-full object-contain rounded-lg"
            />
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <HardDrive className="w-3.5 h-3.5 text-blue-400" />
              MIME: <code className="text-slate-300 font-mono">{item.mimeType}</code>
            </span>
            {item.createdAt && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                {new Date(item.createdAt).toLocaleString()}
              </span>
            )}
          </div>
          <span className="text-emerald-400 font-mono">Verified in IMG-VID Storage</span>
        </div>
      </div>
    </div>
  );
};
