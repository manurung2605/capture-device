export interface MediaItem {
  id: number;
  url: string;
  type: 'image' | 'video';
  mimeType: string;
  size: number;
  createdAt: string;
  originalName?: string;
  blob?: Blob;
}

export type QueueItemStatus = 'queued' | 'uploading' | 'posted' | 'error';

export interface QueueItem {
  id: string;
  file: File;
  type: 'image' | 'video';
  url: string;
  status: QueueItemStatus;
  progress?: number;
  error?: string;
  timestamp: number;
  serverId?: number;
}

export interface StorageStats {
  totalRecords: number;
  photoCount: number;
  videoCount: number;
  totalBytes: number;
  totalMegabytes: string;
  storageEngine: string;
  lastId: number;
}

export interface MySQLConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password?: string;
}
