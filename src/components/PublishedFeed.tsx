import React, { useState } from 'react';
import { MediaItem } from '../types';
import { formatBytes } from '../utils/indexedDB';
import {
  Layers,
  Image as ImageIcon,
  Film,
  Download,
  Trash2,
  Maximize2,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  Search,
  Grid,
  List,
} from 'lucide-react';

interface PublishedFeedProps {
  posts: MediaItem[];
  isLoading: boolean;
  onRefresh: () => void;
  onDelete: (id: number) => void;
  onSelectLightbox: (item: MediaItem) => void;
}

export const PublishedFeed: React.FC<PublishedFeedProps> = ({
  posts,
  isLoading,
  onRefresh,
  onDelete,
  onSelectLightbox,
}) => {
  const [filter, setFilter] = useState<'all' | 'image' | 'video'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const filteredPosts = posts.filter((post) => {
    if (filter !== 'all' && post.type !== filter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const idMatch = post.id.toString().includes(q);
      const nameMatch = post.originalName?.toLowerCase().includes(q);
      const mimeMatch = post.mimeType?.toLowerCase().includes(q);
      return idMatch || nameMatch || mimeMatch;
    }
    return true;
  });

  const handleCopyUrl = (post: MediaItem) => {
    const fullUrl = post.url.startsWith('http') ? post.url : `${window.location.origin}${post.url}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedId(post.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-600/20 text-emerald-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              Published Post Feed
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                {posts.length} {posts.length === 1 ? 'post' : 'posts'}
              </span>
            </h2>
          </div>
        </div>

        {/* Filter and View mode toggles */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-slate-800/80 p-0.5 rounded-lg border border-slate-700 text-xs">
            <button
              onClick={() => setFilter('all')}
              className={`px-2 py-1 rounded-md font-medium transition ${
                filter === 'all' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              All ({posts.length})
            </button>
            <button
              onClick={() => setFilter('image')}
              className={`px-2 py-1 rounded-md font-medium flex items-center gap-1 transition ${
                filter === 'image' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <ImageIcon className="w-3 h-3" />
              Photos ({posts.filter((p) => p.type === 'image').length})
            </button>
            <button
              onClick={() => setFilter('video')}
              className={`px-2 py-1 rounded-md font-medium flex items-center gap-1 transition ${
                filter === 'video' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Film className="w-3 h-3" />
              Videos ({posts.filter((p) => p.type === 'video').length})
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewMode((m) => (m === 'list' ? 'grid' : 'list'))}
              className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 text-xs transition"
              title={viewMode === 'list' ? 'Switch to Grid View' : 'Switch to List View'}
            >
              {viewMode === 'list' ? <Grid className="w-3.5 h-3.5" /> : <List className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 text-xs transition disabled:opacity-50"
              title="Refresh Feed from Server DB"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      {posts.length > 3 && (
        <div className="relative mb-3">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by ID, name, or mime type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950/70 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      )}

      {/* Feed Media List */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[600px]">
        {filteredPosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center border-2 border-dashed border-slate-800/80 rounded-xl">
            <Layers className="w-9 h-9 text-slate-600 mb-2 stroke-1" />
            <p className="text-xs sm:text-sm font-medium text-slate-400">No published media found</p>
            <p className="text-[11px] text-slate-500 max-w-xs mt-1">
              Take a photo or record a video with the camera above. As soon as it finishes uploading to IMG-VID storage, it appears right here in real time.
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View Mode */
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {filteredPosts.map((post) => (
              <div
                key={post.id}
                className="group relative bg-slate-950 border border-slate-800 rounded-xl overflow-hidden aspect-square flex flex-col justify-end"
              >
                {post.type === 'image' ? (
                  <img
                    src={post.url}
                    alt={`Post #${post.id}`}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <video
                    src={post.url}
                    className="absolute inset-0 w-full h-full object-cover"
                    muted
                    preload="metadata"
                  />
                )}

                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity p-2 flex flex-col justify-between z-10">
                  <div className="flex items-center justify-between">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-600/90 text-white">
                      #{post.id}
                    </span>
                    <span className="text-[10px] text-slate-300 bg-black/60 px-1 rounded">
                      {formatBytes(post.size)}
                    </span>
                  </div>

                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => onSelectLightbox(post)}
                      className="p-1 rounded bg-black/70 hover:bg-black text-white text-xs"
                      title="View Fullscreen"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                    <a
                      href={post.url}
                      download={`img_vid_${post.id}.${post.type === 'video' ? 'webm' : 'jpg'}`}
                      className="p-1 rounded bg-black/70 hover:bg-black text-white text-xs"
                      title="Download"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                    <button
                      onClick={() => onDelete(post.id)}
                      className="p-1 rounded bg-rose-900/80 hover:bg-rose-800 text-rose-200 text-xs"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* List Card Mode (Matching PHP single card aesthetic) */
          filteredPosts.map((post) => (
            <div
              key={post.id}
              className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 hover:border-slate-700 transition space-y-2.5 shadow-sm"
            >
              {/* Media viewer */}
              <div className="relative rounded-lg overflow-hidden bg-black max-h-[260px] flex items-center justify-center border border-slate-900">
                {post.type === 'image' ? (
                  <img
                    src={post.url}
                    alt={`Post #${post.id}`}
                    className="w-full max-h-[260px] object-cover cursor-pointer hover:opacity-95 transition"
                    onClick={() => onSelectLightbox(post)}
                    loading="lazy"
                  />
                ) : (
                  <video
                    src={post.url}
                    controls
                    playsInline
                    preload="metadata"
                    className="w-full max-h-[260px] object-contain"
                  />
                )}

                <button
                  onClick={() => onSelectLightbox(post)}
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm transition"
                  title="Expand Fullscreen"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Card Meta & Badges */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-300 bg-emerald-950/80 border border-emerald-800/60 px-2 py-0.5 rounded-md text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    IMG-VID Storage (#{post.id})
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {formatBytes(post.size)}
                  </span>
                  <span className="text-[11px] text-slate-500 uppercase">
                    {post.type}
                  </span>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleCopyUrl(post)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 transition"
                    title="Copy Media URL"
                  >
                    {copiedId === post.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">{copiedId === post.id ? 'Copied' : 'Copy'}</span>
                  </button>

                  <a
                    href={post.url}
                    download={`img_vid_${post.id}.${post.type === 'video' ? 'webm' : 'jpg'}`}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 transition"
                    title="Download original file"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Save</span>
                  </a>

                  <button
                    onClick={() => onDelete(post.id)}
                    className="p-1.5 rounded-lg bg-rose-950/40 border border-rose-900/60 hover:bg-rose-900/80 text-rose-300 text-xs transition"
                    title="Delete permanently from IMG-VID"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {post.createdAt && (
                <div className="text-[10px] text-slate-500 font-mono">
                  Saved: {new Date(post.createdAt).toLocaleDateString()} {new Date(post.createdAt).toLocaleTimeString()}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
