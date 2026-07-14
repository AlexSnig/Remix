import React, { useState, useEffect } from 'react';
import { 
  Volume2, Play, Square, Upload, Trash2, Check, Loader2, Download, FolderOpen, Link2
} from 'lucide-react';
import { DetectorSettings, CustomAudioFile } from '../types';
import { AUDIO_PRESETS, playPresetSound, playCustomSound, stopAllAudio } from '../utils/audio';
import { 
  saveCustomAudio, getAllCustomAudios, deleteCustomAudio
} from '../utils/indexedDB';

interface MinimalFilesListProps {
  settings: DetectorSettings;
  onSettingsChange: (settings: DetectorSettings) => void;
  onCustomAudioSaved: (data: string | null) => void;
  lang: Language;
  onOpenAudioSourceModal?: () => void;
}

type Language = 'uk' | 'en';

export default function MinimalFilesList({
  settings,
  onSettingsChange,
  onCustomAudioSaved,
  lang,
  onOpenAudioSourceModal,
}: MinimalFilesListProps) {
  const [customAudios, setCustomAudios] = useState<CustomAudioFile[]>([]);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [driveFiles, setDriveFiles] = useState<Array<{ id: string; name: string; mimeType: string; _isFallback?: boolean }>>([]);
  const [isLoadingDrive, setIsLoadingDrive] = useState<boolean>(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [isDriveCollapsed, setIsDriveCollapsed] = useState<boolean>(true);
  const [pastedDriveLink, setPastedDriveLink] = useState<string>("");
  const [isDownloading, setIsDownloading] = useState<Record<string, boolean>>({});
  const [customFolderId, setCustomFolderId] = useState<string>("1TZvyS9ooPl6PDPtlkSz62cYTxeh4K3Td");
  const [drivePlayingId, setDrivePlayingId] = useState<string | null>(null);
  const [drivePreviewLoadingId, setDrivePreviewLoadingId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Update Custom Audios list
  const updateCustomAudiosList = async () => {
    try {
      const audios = await getAllCustomAudios();
      setCustomAudios(audios);
      
      if (settings.audioSourceType === 'custom' && settings.customAudioId) {
        const active = audios.find(a => a.id === settings.customAudioId);
        if (active) {
          onCustomAudioSaved(active.data);
        } else {
          onCustomAudioSaved(null);
        }
      }
    } catch (e) {
      console.warn("Could not query DB audios:", e);
    }
  };

  useEffect(() => {
    updateCustomAudiosList();
  }, [settings.customAudioId, settings.audioSourceType]);

  const loadDriveFolder = async (folderIdToLoad?: string) => {
    setIsLoadingDrive(true);
    setDriveError(null);
    const targetFolder = folderIdToLoad || customFolderId || "1TZvyS9ooPl6PDPtlkSz62cYTxeh4K3Td";
    try {
      const res = await fetch(`/api/drive/list-folder?folderId=${targetFolder}`);
      if (!res.ok) {
        throw new Error(lang === 'uk' ? 'Помилка завантаження' : 'Drive load error');
      }
      const data = await res.json();
      setDriveFiles(data.files || []);
      if (data.fallback) {
        setDriveError(lang === 'uk' ? 'Завантажено автономний список сигналів' : 'Loaded offline fallback signals list');
      }
    } catch (err: any) {
      console.error(err);
      setDriveError(lang === 'uk' ? 'Помилка з’єднання.' : 'Could not fetch files.');
    } finally {
      setIsLoadingDrive(false);
    }
  };

  const showFeedback = (msg: string) => {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(null), 3000);
  };

  const downloadGoogleDriveFile = async (fileId: string, fileName: string) => {
    setIsDownloading(prev => ({ ...prev, [fileId]: true }));
    setDriveError(null);
    try {
      const res = await fetch(`/api/drive/download?fileId=${fileId}`);
      if (!res.ok) {
        throw new Error('Failed to download');
      }
      const blob = await res.blob();
      
      if (blob.size > 12 * 1024 * 1024) {
        throw new Error(lang === 'uk' ? 'Файл занадто великий (> 12MB)' : 'File too large (> 12MB)');
      }

      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      reader.readAsDataURL(blob);
      const base64Data = await base64Promise;

      const newAudioId = `drive_${fileId}_${Date.now()}`;
      const newAudioRecord: CustomAudioFile = {
        id: newAudioId,
        name: fileName.replace(/\.[^/.]+$/, "") + " (Drive)",
        data: base64Data,
        size: blob.size,
        timestamp: Date.now()
      };

      await saveCustomAudio(newAudioRecord);
      showFeedback(lang === 'uk' ? 'Файл успішно імпортовано!' : 'File successfully imported!');

      onSettingsChange({
        ...settings,
        audioSourceType: 'custom',
        customAudioId: newAudioId,
      });
      onCustomAudioSaved(base64Data);

      await updateCustomAudiosList();
    } catch (err: any) {
      console.error(err);
      setDriveError(lang === 'uk' ? 'Помилка завантаження' : 'Download error');
    } finally {
      setIsDownloading(prev => ({ ...prev, [fileId]: false }));
    }
  };

  const handlePasteDriveLink = async (url: string) => {
    if (!url.trim()) return;
    const folderMatch = url.match(/\/folders\/([a-zA-Z0-9_-]{25,45})/);
    const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]{25,45})/);
    const queryIdMatch = url.match(/[?&]id=([a-zA-Z0-9_-]{25,45})/);

    setDriveError(null);

    if (folderMatch) {
      const fId = folderMatch[1];
      setCustomFolderId(fId);
      showFeedback(lang === 'uk' ? 'Папку отримано' : 'Folder verified');
      await loadDriveFolder(fId);
    } else if (fileMatch || queryIdMatch) {
      const fId = (fileMatch ? fileMatch[1] : queryIdMatch ? queryIdMatch[1] : null);
      if (fId) {
        showFeedback(lang === 'uk' ? 'Завантаження з Диску...' : 'Downloading from Drive...');
        await downloadGoogleDriveFile(fId, lang === 'uk' ? 'Завантажений звук' : 'Google Drive Sound');
      }
    } else {
      if (url.trim().match(/^[a-zA-Z0-9_-]{25,45}$/)) {
        setCustomFolderId(url.trim());
        await loadDriveFolder(url.trim());
      } else {
        setDriveError(lang === 'uk' ? 'Неправильний формат посилання' : 'Unknown link format');
      }
    }
  };

  const handleCustomAudioSelect = async (id: string, data: string) => {
    onSettingsChange({
      ...settings,
      audioSourceType: 'custom',
      customAudioId: id,
    });
    onCustomAudioSaved(data);
    showFeedback(lang === 'uk' ? 'Вибрано власний сигнал' : 'Custom signal selected');

    setPreviewingId(id);
    try {
      await playCustomSound(data, undefined, (settings.audioVolume ?? 100) / 100);
    } catch (err) {
      setPreviewingId(null);
    }
  };

  const handlePreviewCustom = async (audioRecord: CustomAudioFile, e: React.MouseEvent) => {
    e.stopPropagation();
    if (previewingId === audioRecord.id) {
      stopAllAudio();
      setPreviewingId(null);
    } else {
      setPreviewingId(audioRecord.id);
      try {
        await playCustomSound(audioRecord.data, audioRecord.name, (settings.audioVolume ?? 100) / 100);
      } catch (err) {
        setPreviewingId(null);
      }
    }
  };

  const handleDeleteAudio = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    stopAllAudio();
    setPreviewingId(null);
    try {
      await deleteCustomAudio(id);
      showFeedback(lang === 'uk' ? 'Сигнал видалено' : 'Signal deleted');

      if (settings.customAudioId === id) {
        onSettingsChange({
          ...settings,
          audioSourceType: 'preset',
          audioPresetId: 'beep_short',
          customAudioId: null,
        });
        onCustomAudioSaved(null);
      }

      await updateCustomAudiosList();
    } catch (err) {
      console.error(err);
    }
  };

  const handlePreviewDrive = async (fileId: string, fileName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (drivePlayingId === fileId) {
      stopAllAudio();
      setDrivePlayingId(null);
    } else {
      stopAllAudio();
      setPreviewingId(null);
      setDrivePlayingId(null);
      setDrivePreviewLoadingId(fileId);
      try {
        const res = await fetch(`/api/drive/download?fileId=${fileId}`);
        if (!res.ok) {
          throw new Error('Preview download failed');
        }
        const blob = await res.blob();
        
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
        });
        reader.readAsDataURL(blob);
        const base64Data = await base64Promise;
        
        setDrivePreviewLoadingId(null);
        setDrivePlayingId(fileId);
        
        await playCustomSound(base64Data, fileName, (settings.audioVolume ?? 100) / 100);
        
        setDrivePlayingId(prev => (prev === fileId ? null : prev));
      } catch (err) {
        console.error(err);
        setDrivePreviewLoadingId(null);
        showFeedback(lang === 'uk' ? 'Помилка прослуховування' : 'Preview error');
      }
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    if (file.size > 12 * 1024 * 1024) {
      setUploadError(lang === 'uk' ? 'Файл занадто великий (> 12MB)' : 'File too large (> 12MB)');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = reader.result as string;
        const newAudioId = `custom_${Date.now()}`;
        const newAudioRecord: CustomAudioFile = {
          id: newAudioId,
          name: file.name,
          data: base64Data,
          size: file.size,
          timestamp: Date.now()
        };

        await saveCustomAudio(newAudioRecord);
        showFeedback(lang === 'uk' ? 'Успішно завантажено!' : 'Uploaded successfully!');

        onSettingsChange({
          ...settings,
          audioSourceType: 'custom',
          customAudioId: newAudioId,
        });
        onCustomAudioSaved(base64Data);

        setPreviewingId(newAudioId);
        try {
          await playCustomSound(base64Data, file.name, (settings.audioVolume ?? 100) / 100);
        } catch (e) {
          setPreviewingId(null);
        }

        await updateCustomAudiosList();
      } catch (err) {
        setUploadError(lang === 'uk' ? 'Помилка збереження' : 'Save failure');
      }
    };
    reader.readAsDataURL(file);
  };

  // Automatically trigger loading files list of Google Drive when expanded
  useEffect(() => {
    if (!isDriveCollapsed && driveFiles.length === 0) {
      loadDriveFolder();
    }
  }, [isDriveCollapsed]);

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 KB';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(2)} MB`;
  };

  return (
    <div className="bg-[#111111] border border-gray-800 rounded-3xl p-4 sm:p-5 shadow-xl text-left max-w-sm mx-auto space-y-4">
      
      {/* Block Title */}
      <div className="flex items-center justify-between border-b border-gray-850 pb-2">
        <div className="flex items-center gap-2">
          <Volume2 className="w-5 h-5 text-[#F27D26]" />
          <h3 className="text-sm font-bold text-slate-100 font-sans tracking-wide">
            {lang === 'uk' ? 'Завантажені аудіофайли' : 'Downloaded audio files'}
          </h3>
        </div>
        {onOpenAudioSourceModal && (
          <button
            type="button"
            onClick={onOpenAudioSourceModal}
            className="text-[11px] font-bold text-[#F27D26] hover:text-white bg-gray-900/60 hover:bg-gray-850 px-2.5 py-1 rounded-xl border border-gray-800 transition-colors cursor-pointer select-none"
          >
            {lang === 'uk' ? '(ще...)' : '(more...)'}
          </button>
        )}
      </div>

      {actionFeedback && (
        <div className="py-1 px-3 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-200 text-[11px] font-sans flex items-center gap-1 animate-pulse">
          <Check className="w-3.5 h-3.5 shrink-0" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* Downloaded database signals list */}
      <div className="space-y-2">
        {customAudios.map((file) => {
          const isSelected = settings.audioSourceType === 'custom' && settings.customAudioId === file.id;
          const isPlaying = previewingId === file.id;

          return (
            <div
              key={file.id}
              onClick={() => handleCustomAudioSelect(file.id, file.data)}
              className={`py-2 px-3 border rounded-xl flex items-center justify-between cursor-pointer transition-all duration-250 ${
                isSelected
                  ? 'bg-[#F27D26]/10 border-[#F27D26]'
                  : 'bg-black/30 border-gray-850 hover:bg-black/55 hover:border-gray-700'
              }`}
            >
              <div className="flex-1 mr-2 min-w-0">
                <p className="text-xs font-sans font-bold text-gray-250 truncate">
                  {file.name}
                </p>
                <p className="text-[9px] text-gray-500 font-mono mt-0.5">
                  {formatSize(file.size)}
                </p>
              </div>

              <div className="flex gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={(e) => handlePreviewCustom(file, e)}
                  aria-label="Preview sound"
                  className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer ${
                    isPlaying 
                      ? 'bg-rose-500/20 text-rose-500' 
                      : 'bg-[#1C1C1C] border border-gray-800 text-gray-400'
                  }`}
                >
                  {isPlaying ? <Square className="w-3 h-3 text-rose-500 fill-rose-500" /> : <Play className="w-3 h-3 text-gray-400 fill-gray-400" />}
                </button>

                <button
                  type="button"
                  onClick={(e) => handleDeleteAudio(file.id, e)}
                  className="w-7 h-7 rounded-lg bg-[#1C1C1C] border border-gray-800 text-gray-500 hover:text-rose-500 hover:bg-rose-500/10 flex items-center justify-center cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}

        {customAudios.length === 0 && (
          <p className="text-[11px] text-gray-500 py-3.5 px-3 text-center border border-dashed border-gray-850 rounded-xl font-sans">
            {lang === 'uk' ? 'Немає завантажених сигналів' : 'No sound files downloaded'}
          </p>
        )}
      </div>

      {/* Google Drive Accordion Section (свернутый блок) */}
      <div className="border border-gray-850 rounded-2xl overflow-hidden bg-black/15">
        <button
          type="button"
          onClick={() => setIsDriveCollapsed(!isDriveCollapsed)}
          className="w-full py-2.5 px-3.5 flex items-center justify-between bg-black/30 hover:bg-black/55 transition-colors border-none cursor-pointer text-left"
        >
          <span className="text-xs font-bold text-gray-200 font-sans flex items-center gap-1.5">
            <FolderOpen className="w-4 h-4 text-[#F27D26]" />
            {lang === 'uk' ? 'Додати з Google Диску' : 'Add from Google Drive'}
          </span>
          <span className="text-[10px] text-[#F27D26] font-mono leading-none">
            {isDriveCollapsed ? '+' : '-'}
          </span>
        </button>

        {!isDriveCollapsed && (
          <div className="p-3.5 border-t border-gray-850 bg-[#141414]/95 space-y-3.5 animate-slide-down">
            
            {/* Folder Refresh Action Button inside details */}
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-gray-455 uppercase font-mono tracking-widest">{lang === 'uk' ? 'Джерело автора' : 'Author signals'}</span>
              <button
                type="button"
                onClick={() => loadDriveFolder()}
                className="text-[10px] font-bold text-[#F27D26] hover:text-white bg-transparent border-none outline-none cursor-pointer flex items-center gap-1 select-none"
              >
                {isLoadingDrive ? <Loader2 className="w-3 h-3 animate-spin" /> : <span>{lang === 'uk' ? 'Оновити' : 'Refresh'}</span>}
              </button>
            </div>

            {/* Custom Link Paste Form */}
            <div className="flex gap-1.5">
              <input
                type="text"
                placeholder={lang === 'uk' ? 'Вставте посилання...' : 'Paste drive link...'}
                value={pastedDriveLink}
                onChange={(e) => setPastedDriveLink(e.target.value)}
                className="flex-1 text-xs px-2.5 py-1.5 bg-black/45 border border-gray-800 rounded-lg text-slate-100 placeholder-gray-650 focus:outline-none focus:border-zinc-750"
              />
              <button
                type="button"
                onClick={() => {
                  handlePasteDriveLink(pastedDriveLink);
                  setPastedDriveLink("");
                }}
                className="px-3 bg-[#F27D26] text-black font-sans font-black text-[9px] uppercase rounded-lg cursor-pointer transition-all active:scale-95 shrink-0"
              >
                {lang === 'uk' ? 'ОБРОБИТИ' : 'PARSE'}
              </button>
            </div>

            {driveError && (
              <p className="text-[10px] text-orange-400 bg-orange-950/25 border border-orange-500/25 p-1.5 rounded flex items-center gap-1 font-sans leading-relaxed">
                <span>⚠</span>
                <span>{driveError}</span>
              </p>
            )}

            {/* Drive Files List */}
            <div className="space-y-1 max-h-36 overflow-y-auto bg-black/45 p-1.5 rounded-lg border border-gray-900">
              {isLoadingDrive ? (
                <div className="py-4 text-center text-gray-500 font-sans flex flex-col items-center justify-center gap-1.5">
                  <Loader2 className="w-5 h-5 text-[#F27D26] animate-spin" />
                  <span className="text-[9px] font-mono">{lang === 'uk' ? 'Завантаження...' : 'Retrieving...'}</span>
                </div>
              ) : (
                <>
                  {driveFiles.map((file) => {
                    const isDownloadingFile = !!isDownloading[file.id];
                    return (
                      <div
                        key={file.id}
                        className="py-1 px-2 border border-gray-850/50 bg-black/20 hover:bg-black/40 rounded-lg flex items-center justify-between transition-colors gap-2"
                      >
                        <span className="text-[10px] font-sans text-gray-300 font-bold block truncate flex-1 leading-normal">
                          {file._isFallback ? `🔔 ${file.name}` : file.name}
                        </span>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            disabled={isDownloadingFile}
                            onClick={(e) => handlePreviewDrive(file.id, file.name, e)}
                            className={`w-6 h-6 rounded flex items-center justify-center cursor-pointer transition-all ${
                              drivePlayingId === file.id
                                ? 'bg-rose-500/20 text-rose-500'
                                : 'bg-[#1F1F1F] text-gray-400 hover:text-white'
                            }`}
                          >
                            {drivePreviewLoadingId === file.id ? (
                              <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            ) : drivePlayingId === file.id ? (
                              <Square className="w-2.5 h-2.5 text-rose-500 fill-rose-500" />
                            ) : (
                              <Play className="w-2.5 h-2.5 text-gray-400 fill-gray-400" />
                            )}
                          </button>

                          <button
                            type="button"
                            disabled={isDownloadingFile}
                            onClick={() => downloadGoogleDriveFile(file.id, file.name)}
                            className="w-6 h-6 bg-[#1F1F1F] hover:bg-zinc-800 hover:text-white text-gray-300 rounded flex items-center justify-center cursor-pointer transition-all"
                            title={lang === 'uk' ? 'Імпортувати' : 'Import'}
                          >
                            {isDownloadingFile ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Download className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {driveFiles.length === 0 && (
                    <div className="py-2.5 text-center text-[10px] text-gray-500 font-sans">
                      {lang === 'uk' ? 'Файлів не знайдено' : 'No sound files found'}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="text-right">
              <a
                href="https://drive.google.com/drive/folders/1TZvyS9ooPl6PDPtlkSz62cYTxeh4K3Td?usp=drive_link"
                target="_blank"
                rel="referrer"
                className="text-[9px] text-gray-550 hover:text-zinc-200 inline-flex items-center gap-1 font-mono transition-colors"
              >
                <Link2 className="w-2.5 h-2.5" />
                <span>{lang === 'uk' ? 'Папка автора на Диску' : 'Author Drive folder'}</span>
              </a>
            </div>

          </div>
        )}
      </div>

      {/* Upload button natively embedded */}
      <div className="relative pt-2">
        <label className="flex items-center justify-center gap-2 py-2.5 px-4 border border-dashed border-gray-800 hover:border-gray-700 bg-black/40 hover:bg-black/60 rounded-xl cursor-pointer transition-all duration-200">
          <Upload className="w-4 h-4 text-[#F27D26]" />
          <span className="text-xs text-slate-200 font-extrabold font-sans">
            {lang === 'uk' ? 'ЗАВАНТАЖИТИ ВЛАСНИЙ ФАЙЛ' : 'UPLOAD OWN FILE'}
          </span>
          <input
            type="file"
            accept="audio/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>
        {uploadError && (
          <p className="text-[10px] text-rose-500 mt-1">{uploadError}</p>
        )}
      </div>

    </div>
  );
}
