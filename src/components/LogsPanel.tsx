import React, { useState, useEffect } from 'react';
import { MotionLog, DetectorSettings } from '../types';
import { Calendar, Clock, Trash2, Eye, CircleSlash, X, Database, RefreshCw, Check } from 'lucide-react';
import { TRANSLATIONS, Language } from '../utils/lang';
import { getCacheStats, performAutoCacheClean, CacheStats } from '../utils/indexedDB';

interface LogsPanelProps {
  logs: MotionLog[];
  onLogDeleted?: (id: string) => void;
  onClearAll: () => void;
  lang: Language;
  settings: DetectorSettings;
  onSettingsChange: (settings: DetectorSettings) => void;
}

export default function LogsPanel({ logs, onLogDeleted, onClearAll, lang, settings, onSettingsChange }: LogsPanelProps) {
  const [activeLightboxImage, setActiveLightboxImage] = useState<string | null>(null);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const t = TRANSLATIONS[lang];

  const updateStats = async () => {
    try {
      const stats = await getCacheStats();
      setCacheStats(stats);
    } catch (e) {
      console.warn("Could not query DB stats:", e);
    }
  };

  useEffect(() => {
    updateStats();
  }, [logs]);

  const handleForcePruning = async () => {
    const { prunedLogs, prunedAudios } = await performAutoCacheClean(
      settings.maxCacheLogsCount, 
      settings.customAudioId
    );
    showFeedback(
      lang === 'uk' 
        ? `Логи оптимізовано: видалено ${prunedLogs} застарілих записів та ${prunedAudios} невикористовуваних файлів.`
        : `Cache pruned: removed ${prunedLogs} old log items and ${prunedAudios} legacy audio pieces.`
    );
    await updateStats();
  };

  const showFeedback = (msg: string) => {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(null), 3000);
  };

  const formatTime = (ts: number): string => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDate = (ts: number): string => {
    const d = new Date(ts);
    const locale = lang === 'uk' ? 'uk-UA' : 'en-US';
    return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const handleDeleteItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onLogDeleted) {
      onLogDeleted(id);
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 KB';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(2)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Primary Logs Card */}
      <div className="bg-[#111111] border border-gray-800 rounded-3xl p-4 sm:p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4 border-b border-gray-800/80 pb-3">
          <div className="text-left">
            <h2 className="text-base font-bold text-slate-100 font-sans leading-none">
              {t.eventsQuantity} ({logs.length})
            </h2>
            <p className="text-[10px] text-gray-500 font-sans mt-2">
              {t.eventLogsDesc}
            </p>
          </div>

          {logs.length > 0 && (
            <button
              id="clear-all-logs-btn"
              onClick={onClearAll}
              className="text-xs text-rose-450 hover:text-rose-400 font-sans font-bold flex items-center gap-1 bg-gray-800/40 hover:bg-gray-800/85 py-1 px-2.5 rounded-lg border border-gray-800 transition-all cursor-pointer shadow-md"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {t.clearAllBtn}
            </button>
          )}
        </div>

        {/* Grid of log records */}
        <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
          {logs.map((log) => (
            <div
              key={log.id}
              onClick={() => log.thumbnail && setActiveLightboxImage(log.thumbnail)}
              className="p-2.5 bg-slate-950/40 border border-slate-850 rounded-xl flex items-center justify-between gap-3 hover:border-indigo-505/30 hover:bg-slate-950/70 cursor-pointer group transition-all"
            >
              {/* Captured thumbnail image */}
              <div className="w-14 h-11 bg-[#1A1A1A] rounded-lg overflow-hidden flex-shrink-0 border border-gray-800 relative flex items-center justify-center">
                {log.thumbnail ? (
                  <>
                    <img
                      src={log.thumbnail}
                      alt="Captured Motion Thumbnail"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                      <Eye className="w-4 h-4 text-white" />
                    </div>
                  </>
                ) : (
                  <span className="text-[9px] text-gray-500 font-sans">No photo</span>
                )}
              </div>

              {/* Date / Time */}
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-1 text-gray-500 text-[10px] font-mono leading-none mb-1">
                  <Calendar className="w-3 h-3" />
                  <span>{formatDate(log.timestamp)}</span>
                </div>
                <div className="flex items-center gap-1 text-gray-200 font-mono font-bold text-xs leading-none">
                  <Clock className="w-3.5 h-3.5 text-[#F27D26]" />
                  <span>{formatTime(log.timestamp)}</span>
                </div>
              </div>

              {/* Event status or manual deletion */}
              <div className="flex items-center gap-1">
                <div className="bg-[#F27D26]/10 text-[#F27D26] text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-[#F27D26]/10 uppercase select-none">
                  {t.motionLabel}
                </div>
                
                {onLogDeleted && (
                  <button
                    type="button"
                    onClick={(e) => handleDeleteItem(log.id, e)}
                    aria-label="Delete entry"
                    className="w-7 h-7 rounded-lg bg-[#1A1A1A] hover:bg-rose-500/10 text-gray-500 hover:text-rose-450 flex items-center justify-center cursor-pointer transition-colors border-none"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}

          {logs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-550 text-center">
              <CircleSlash className="w-10 h-10 mb-2 text-gray-800 animate-pulse" />
              <p className="font-sans text-xs font-bold text-gray-400">{t.noEventsRegistered}</p>
              <p className="text-[10px] text-gray-500 font-sans max-w-xs mt-1.5 leading-normal">
                {t.eventsRegisterTip}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Cache & Optimize Card */}
      <div className="bg-[#111111] border border-gray-800 rounded-3xl p-4 sm:p-5 shadow-xl text-left">
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-100 font-sans mb-3 text-left">
          <Database className="w-5 h-5 text-[#F27D26]" />
          {t.cacheTitle}
        </h2>
        <p className="text-xs text-gray-400 mb-4 leading-normal font-sans text-left">
          {t.cacheDesc}
        </p>

        {/* Action feedback message */}
        {actionFeedback && (
          <div className="mb-3 py-1.5 px-3 bg-[#F27D26]/10 border border-[#F27D26]/20 rounded-lg text-[#F27D26] text-xs font-sans flex items-center gap-1.5 animate-pulse">
            <Check className="w-3.5 h-3.5" />
            <span>{actionFeedback}</span>
          </div>
        )}

        {/* Real-time Cache Info stats block */}
        {cacheStats && (
          <div className="grid grid-cols-2 gap-3 mb-4 text-xs font-mono">
            <div className="bg-black/50 p-2.5 rounded-xl border border-gray-800 text-left">
              <p className="text-gray-500 uppercase text-[9px] mb-0.5">{t.audioSizeLabel}</p>
              <p className="text-gray-200 font-bold text-sm tracking-tight">{formatSize(cacheStats.audioBytes)}</p>
            </div>
            <div className="bg-black/50 p-2.5 rounded-xl border border-gray-800 text-left">
              <p className="text-gray-500 uppercase text-[9px] mb-0.5">{t.shotsLabel}</p>
              <p className="text-gray-200 font-bold text-sm tracking-tight">
                {cacheStats.logCount} {lang === 'uk' ? 'шт' : 'pcs'} ({formatSize(cacheStats.thumbnailBytesSum)})
              </p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {/* Toggler switch automatic cleanup */}
          <div className="flex items-start justify-between gap-4 text-left">
            <div className="space-y-0.5">
              <label htmlFor="autoclean-checkbox" className="text-xs font-bold text-gray-200 font-sans select-none cursor-pointer">
                {t.autoCleanLabel}
              </label>
              <p className="text-[10px] text-gray-500 leading-normal font-sans">
                {t.autoCleanDesc}
              </p>
            </div>
            <input
              id="autoclean-checkbox"
              type="checkbox"
              checked={settings.autoCleanCacheEnabled}
              onChange={(e) => onSettingsChange({ ...settings, autoCleanCacheEnabled: e.target.checked })}
              className="w-10 h-5 bg-gray-800 rounded-full appearance-none relative before:content-[''] before:absolute before:w-4 before:h-4 before:bg-gray-400 before:rounded-full before:top-0.5 before:left-0.5 checked:before:left-5 checked:bg-[#F27D26] transition-all cursor-pointer shrink-0"
            />
          </div>

          {/* Slider/Option select maximum logs count to preserve */}
          {settings.autoCleanCacheEnabled && (
            <div className="space-y-1.5 p-3 bg-black/45 rounded-xl border border-gray-855 text-left">
              <div className="flex justify-between items-center text-xs font-sans">
                <span className="text-gray-300">{t.keepMaxLogs}</span>
                <span className="text-[#F27D26] font-mono font-bold leading-none bg-gray-800 px-2 py-0.5 rounded">
                  {settings.maxCacheLogsCount} {lang === 'uk' ? 'подій' : 'events'}
                </span>
              </div>
              <input
                type="range"
                min="5"
                max="50"
                step="5"
                value={settings.maxCacheLogsCount}
                onChange={(e) => onSettingsChange({ ...settings, maxCacheLogsCount: parseInt(e.target.value) })}
                className="w-full h-1.5 bg-gray-900 rounded-lg appearance-none cursor-pointer accent-[#F27D26]"
              />
              <p className="text-[9px] text-gray-500 leading-normal font-sans">
                {t.eventsLimitDesc}
              </p>
            </div>
          )}

          {/* Clean tools */}
          <div className="flex flex-wrap gap-2.5 pt-2">
            <button
              id="force-prune-btn"
              onClick={handleForcePruning}
              className="flex-1 py-1.5 h-10 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 hover:text-white text-xs font-sans font-bold flex items-center justify-center gap-1.5 cursor-pointer active:scale-97 select-none transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#F27D26]" />
              {t.cleanNowBtn}
            </button>
            <button
              id="clear-logs-btn"
              onClick={onClearAll}
              className="flex-1 py-1.5 h-10 rounded-xl bg-gray-850 hover:bg-rose-950/20 border border-gray-800 hover:border-rose-900/45 text-gray-400 hover:text-rose-455 text-xs font-sans font-bold flex items-center justify-center gap-1.5 cursor-pointer active:scale-97 select-none transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {t.clearLogsBtn}
            </button>
          </div>
        </div>
      </div>

      {/* Captured Image Lightbox Popup Modal overlay */}
      {activeLightboxImage && (
        <div 
          onClick={() => setActiveLightboxImage(null)}
          className="fixed inset-0 bg-black/95 z-55 flex flex-col items-center justify-center p-4 animate-fade-in"
        >
          {/* Main frame */}
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-[#111111] border border-gray-800 rounded-3xl overflow-hidden relative shadow-2xl"
          >
            {/* Header info */}
            <div className="py-3 px-4 border-b border-gray-800 flex items-center justify-between bg-black/60">
              <span className="text-xs font-bold text-gray-300 font-sans">
                {lang === 'uk' ? 'Знімок моменту спрацьовування датчика' : 'Camera frame at trigger moment'}
              </span>
              <button
                id="close-lightbox-btn"
                onClick={() => setActiveLightboxImage(null)}
                className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 flex items-center justify-center cursor-pointer active:scale-90"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* High-res container */}
            <div className="aspect-[4/3] w-full bg-black flex items-center justify-center">
              <img
                src={activeLightboxImage}
                alt="Captured Snapshot Fullscreen"
                referrerPolicy="no-referrer"
                className="max-w-full max-h-full object-contain"
              />
            </div>

            {/* Footer tips */}
            <div className="p-3 bg-black/60 border-t border-gray-800 text-center">
              <p className="text-[10px] text-gray-500 font-sans leading-normal">
                {lang === 'uk' 
                  ? 'Знімок надійно збережено у локальній базі даних пристрою Galaxy A07.'
                  : 'Screenshot is securely stored within your Galaxy A07 local database.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
