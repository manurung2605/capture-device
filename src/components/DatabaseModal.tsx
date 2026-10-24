import React, { useState } from 'react';
import {
  Database,
  Server,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  X,
  Code,
  Terminal,
  RefreshCw,
  HardDrive,
  ExternalLink,
} from 'lucide-react';

interface DatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats?: {
    totalRecords: number;
    photoCount: number;
    videoCount: number;
    totalMegabytes: string;
    storageEngine: string;
    lastId: number;
  };
}

export const DatabaseModal: React.FC<DatabaseModalProps> = ({ isOpen, onClose, stats }) => {
  const [host, setHost] = useState('sql107.infinityfree.com');
  const [port, setPort] = useState(3306);
  const [database, setDatabase] = useState('if0_41626652_ronin');
  const [user, setUser] = useState('if0_41626652');
  const [password, setPassword] = useState('manurung85');

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    connected: boolean;
    message?: string;
    error?: string;
    code?: string;
    tip?: string;
    tableCount?: number;
  } | null>(null);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/mysql/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host, port, database, user, password }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err: unknown) {
      setTestResult({
        success: false,
        connected: false,
        error: err instanceof Error ? err.message : 'Network test error',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto space-y-4 text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg text-white">Database &amp; IMG-VID Storage Architecture</h3>
              <p className="text-xs text-slate-400">MySQL Schema &amp; Storage Engine Inspector</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Local Storage Engine Status */}
        <div className="p-3.5 bg-emerald-950/30 border border-emerald-800/40 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-emerald-300 flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-emerald-400" />
              Active Backend Engine: IMG-VID Persistent Storage
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-900/60 text-emerald-200 font-mono text-[10px]">
              ONLINE &amp; PERSISTENT
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            All photos and videos uploaded from the camera or files are stored permanently into the <code className="text-emerald-300 bg-emerald-950/60 px-1 py-0.5 rounded">IMG-VID</code> longblob store with auto-incrementing <code className="text-emerald-300 bg-emerald-950/60 px-1 py-0.5 rounded">ID</code> keys, byte-level MIME sniffing, and video streaming support.
          </p>
          {stats && (
            <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-xs text-slate-300">
              <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 block">TOTAL POSTS</span>
                <span className="font-bold text-white text-sm">{stats.totalRecords}</span>
              </div>
              <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 block">STORED MEDIA</span>
                <span className="font-bold text-white text-sm">{stats.photoCount} imgs / {stats.videoCount} vids</span>
              </div>
              <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 block">BLOB SIZE</span>
                <span className="font-bold text-emerald-400 text-sm">{stats.totalMegabytes} MB</span>
              </div>
            </div>
          )}
        </div>

        {/* Remote MySQL Connection Tester */}
        <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs sm:text-sm font-semibold text-white flex items-center gap-1.5">
              <Server className="w-4 h-4 text-blue-400" />
              PHP MySQL Parameters (from code)
            </h4>
            <span className="text-[10px] text-slate-500 font-mono">PDO MySQL DSN</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Host (DB_HOST)</label>
              <input
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200 font-mono text-xs"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Port (DB_PORT)</label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200 font-mono text-xs"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Database (DB_NAME)</label>
              <input
                type="text"
                value={database}
                onChange={(e) => setDatabase(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200 font-mono text-xs"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">User (DB_USER)</label>
              <input
                type="text"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200 font-mono text-xs"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-slate-400">
              Test connectivity directly to external MySQL server:
            </span>
            <button
              onClick={handleTestConnection}
              disabled={testing}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
              <span>{testing ? 'Testing Connection...' : 'Test Connection'}</span>
            </button>
          </div>

          {/* Test results banner */}
          {testResult && (
            <div
              className={`p-3 rounded-lg border text-xs space-y-1.5 animate-in fade-in ${
                testResult.connected
                  ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-200'
                  : 'bg-amber-950/40 border-amber-700/60 text-amber-200'
              }`}
            >
              <div className="flex items-center gap-1.5 font-semibold">
                {testResult.connected ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Connection Successful!</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span>External MySQL Connection Notice</span>
                  </>
                )}
              </div>
              <p className="text-slate-300 leading-relaxed">
                {testResult.message || testResult.error}
              </p>
              {testResult.tip && (
                <div className="p-2 bg-slate-900/80 rounded border border-amber-800/40 text-[11px] text-amber-300">
                  💡 {testResult.tip}
                </div>
              )}
            </div>
          )}
        </div>

        {/* SQL Schema Reference */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Code className="w-3.5 h-3.5 text-blue-400" />
              SQL Schema Definition (`IMG-VID`)
            </span>
            <span className="text-[10px] font-mono">ENGINE=MyISAM</span>
          </div>
          <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-[11px] font-mono text-blue-300 overflow-x-auto">
{`CREATE TABLE IF NOT EXISTS \`IMG-VID\` (
  \`ID\` int(11) NOT NULL AUTO_INCREMENT,
  \`STORAGE\` longblob NOT NULL,
  PRIMARY KEY (\`ID\`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;`}
          </pre>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
