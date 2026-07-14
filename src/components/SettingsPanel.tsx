import React, { useState, useEffect } from 'react';
import { 
  Volume2, Sliders, Play, Square, Upload, Trash2, 
  Info, Check, Sparkles, ChevronDown, ChevronUp,
  Smartphone, FolderOpen, Download, Loader2, Link2
} from 'lucide-react';
import { DetectorSettings, CustomAudioFile } from '../types';
import { AUDIO_PRESETS, playPresetSound, playCustomSound, stopAllAudio } from '../utils/audio';
import { 
  saveCustomAudio, getAllCustomAudios, deleteCustomAudio
} from '../utils/indexedDB';
import { TRANSLATIONS, Language } from '../utils/lang';

interface SettingsPanelProps {
  settings: DetectorSettings;
  onSettingsChange: (settings: DetectorSettings) => void;
  onCustomAudioSaved: (data: string | null) => void;
  lang: Language;
  showOnly?: 'settings' | 'audio';
}

export default function SettingsPanel({
  settings,
  onSettingsChange,
  onCustomAudioSaved,
  lang,
  showOnly,
}: SettingsPanelProps) {
  const t = TRANSLATIONS[lang];
  const [customAudios, setCustomAudios] = useState<CustomAudioFile[]>([]);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [isAudioCollapsed, setIsAudioCollapsed] = useState<boolean>(showOnly === 'audio' ? false : true);
  const [isSettingsCollapsed, setIsSettingsCollapsed] = useState<boolean>(true);
  const [useAllSources, setUseAllSources] = useState<boolean>(true);

  // Google Drive Integration States & Logic
  const [driveFiles, setDriveFiles] = useState<Array<{ id: string; name: string; mimeType: string }>>([]);
  const [isLoadingDrive, setIsLoadingDrive] = useState<boolean>(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [customFolderId, setCustomFolderId] = useState<string>(settings.customFolderId || "1TZvyS9ooPl6PDPtlkSz62cYTxeh4K3Td");
  const [pastedDriveLink, setPastedDriveLink] = useState<string>("");
  const [isDownloading, setIsDownloading] = useState<Record<string, boolean>>({});
  const [hasLoadedDrive, setHasLoadedDrive] = useState<boolean>(false);
  const [drivePlayingId, setDrivePlayingId] = useState<string | null>(null);
  const [drivePreviewLoadingId, setDrivePreviewLoadingId] = useState<string | null>(null);

  useEffect(() => {
    if (settings.customFolderId && settings.customFolderId !== customFolderId) {
      setCustomFolderId(settings.customFolderId);
    }
  }, [settings.customFolderId]);

  const loadDriveFolder = async (folderIdToLoad?: string) => {
    setIsLoadingDrive(true);
    setDriveError(null);
    const targetFolder = folderIdToLoad || customFolderId || "1TZvyS9ooPl6PDPtlkSz62cYTxeh4K3Td";
    try {
      const res = await fetch(`/api/drive/list-folder?folderId=${targetFolder}`);
      if (!res.ok) {
        throw new Error(lang === 'uk' ? 'Помилка завантаження файлів з Google Диску' : 'Failed to fetch files from Google Drive');
      }
      const data = await res.json();
      setDriveFiles(data.files || []);
      setHasLoadedDrive(true);
      if (data.fallback) {
        setDriveError(lang === 'uk' ? 'Примітка: Завантажено автономний резервний список сигналів' : 'Note: Loaded offline fallback signals list');
      }
    } catch (err: any) {
      console.error(err);
      setDriveError(lang === 'uk' ? 'Не вдалося прочитати файли з папки. Перевірте з’єднання.' : 'Could not fetch files. Check connection.');
    } finally {
      setIsLoadingDrive(false);
    }
  };

  const downloadGoogleDriveFile = async (fileId: string, fileName: string) => {
    setIsDownloading(prev => ({ ...prev, [fileId]: true }));
    setDriveError(null);
    try {
      const res = await fetch(`/api/drive/download?fileId=${fileId}`);
      if (!res.ok) {
        throw new Error(lang === 'uk' ? 'Не вдалося завантажити аудіофайл' : 'Failed to download audio file');
      }
      const blob = await res.blob();
      
      // Limit to 12MB
      if (blob.size > 12 * 1024 * 1024) {
        throw new Error(t.fileTooLarge);
      }

      // Read as DataURL (base64)
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      reader.readAsDataURL(blob);
      const base64Data = await base64Promise;

      // Save to IndexedDB
      const newAudioId = `drive_${fileId}`;
      const newAudioRecord: CustomAudioFile = {
        id: newAudioId,
        name: fileName.replace(/\.[^/.]+$/, "") + " (Google Drive)",
        data: base64Data,
        size: blob.size,
        timestamp: Date.now()
      };

      await saveCustomAudio(newAudioRecord);
      showFeedback(lang === 'uk' ? 'Файл успішно імпортовано!' : 'File successfully imported!');

      // Select it immediately
      onSettingsChange({
        ...settings,
        audioSourceType: 'custom',
        customAudioId: newAudioId,
      });
      onCustomAudioSaved(base64Data);

      // Update Custom Audios list
      await updateCustomAudiosList();
    } catch (err: any) {
      console.error(err);
      setDriveError(err.message || (lang === 'uk' ? 'Помилка завантаження' : 'Download error'));
    } finally {
      setIsDownloading(prev => ({ ...prev, [fileId]: false }));
    }
  };

  const handlePasteDriveLink = async (url: string) => {
    if (!url.trim()) return;
    
    // Extract file ID or folder ID from URL
    const folderMatch = url.match(/\/folders\/([a-zA-Z0-9_-]{25,45})/);
    const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]{25,45})/);
    const queryIdMatch = url.match(/[?&]id=([a-zA-Z0-9_-]{25,45})/);

    setDriveError(null);

    if (folderMatch) {
      const fId = folderMatch[1];
      setCustomFolderId(fId);
      onSettingsChange({
        ...settings,
        customFolderId: fId
      });
      showFeedback(lang === 'uk' ? 'Отримано папку Google Диску' : 'Google Drive folder parsed');
      await loadDriveFolder(fId);
    } else if (fileMatch || queryIdMatch) {
      const fId = (fileMatch ? fileMatch[1] : queryIdMatch ? queryIdMatch[1] : null);
      if (fId) {
        showFeedback(lang === 'uk' ? 'Знайдено файл Google Диску! Завантаження...' : 'Google Drive file detected! Downloading...');
        await downloadGoogleDriveFile(fId, lang === 'uk' ? 'Завантажений з Диску' : 'Google Drive Sound');
      }
    } else {
      // Direct ID check
      if (url.trim().match(/^[a-zA-Z0-9_-]{25,45}$/)) {
        const fId = url.trim();
        setCustomFolderId(fId);
        onSettingsChange({
          ...settings,
          customFolderId: fId
        });
        await loadDriveFolder(fId);
      } else {
        setDriveError(lang === 'uk' ? 'Неправильний тип посилання' : 'Unknown link format');
      }
    }
  };

  // Load standard author folder when section is expanded and files aren't loaded yet
  useEffect(() => {
    if (!isAudioCollapsed && !hasLoadedDrive && driveFiles.length === 0) {
      loadDriveFolder();
    }
  }, [isAudioCollapsed, hasLoadedDrive]);

  // Load custom audios
  const updateCustomAudiosList = async () => {
    try {
      const audios = await getAllCustomAudios();
      setCustomAudios(audios);
      
      // If there is an active custom audio, report its base64 back to Parent
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

  useEffect(() => {
    const handleSyncUpdate = () => {
      updateCustomAudiosList();
    };
    window.addEventListener('custom-audios-updated', handleSyncUpdate);
    return () => {
      window.removeEventListener('custom-audios-updated', handleSyncUpdate);
    };
  }, []);

  const handlePresetSelect = (id: string) => {
    onSettingsChange({
      ...settings,
      audioSourceType: 'preset',
      audioPresetId: id,
    });
    showFeedback(t.tuneChangedMsg);
    // Auto-preview on select
    setPreviewingId(id);
    playPresetSound(id, 4, (settings.audioVolume ?? 100) / 100);
    setTimeout(() => {
      setPreviewingId(prev => (prev === id ? null : prev));
    }, 4500);
  };

  const handleCustomAudioSelect = async (id: string, data: string) => {
    onSettingsChange({
      ...settings,
      audioSourceType: 'custom',
      customAudioId: id,
    });
    onCustomAudioSaved(data);
    showFeedback(t.userTuneSelectedMsg);
    // Auto-preview on select
    setPreviewingId(id);
    try {
      await playCustomSound(data, undefined, (settings.audioVolume ?? 100) / 100);
    } catch (err) {
      setPreviewingId(null);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileError(null);

    // Limit to under 12MB to protect IndexedDB memory from crash
    if (file.size > 12 * 1024 * 1024) {
      setFileError(t.fileTooLarge);
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

        // Save inside IndexedDB
        await saveCustomAudio(newAudioRecord);
        showFeedback(t.uploadSuccessMsg);

        // Select it immediately
        onSettingsChange({
          ...settings,
          audioSourceType: 'custom',
          customAudioId: newAudioId,
        });
        onCustomAudioSaved(base64Data);

        // Preview uploaded audio record
        setPreviewingId(newAudioId);
        try {
          await playCustomSound(base64Data, file.name, (settings.audioVolume ?? 100) / 100);
        } catch (e) {
          setPreviewingId(null);
        }

        // Update items
        await updateCustomAudiosList();
      } catch (err) {
        setFileError(t.saveFileError);
      }
    };

    reader.onerror = () => {
      setFileError(t.fileReadError);
    };

    reader.readAsDataURL(file);
  };

  const handleDeleteAudio = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    stopAllAudio();
    setPreviewingId(null);
    try {
      await deleteCustomAudio(id);
      showFeedback(t.tuneDeletedMsg);

      // Reset selection if deleted audio was active
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

  const handlePreviewPreset = (presetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (previewingId === presetId) {
      stopAllAudio();
      setPreviewingId(null);
    } else {
      setPreviewingId(presetId);
      playPresetSound(presetId, 4, (settings.audioVolume ?? 100) / 100);
      // Reset previewing state after 4.5 seconds
      setTimeout(() => {
        setPreviewingId(prev => (prev === presetId ? null : prev));
      }, 4500);
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
        alert(t.interactReminder);
        setPreviewingId(null);
      }
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
          throw new Error('Failed to download audio preview');
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

  const showFeedback = (msg: string) => {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(null), 3000);
  };

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 KB';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(2)} MB`;
  };

  const selectedCustomAudio = customAudios.find(
    file => settings.audioSourceType === 'custom' && settings.customAudioId === file.id
  );

  return (
    <div className="space-y-6">
      {/* Settings Card */}
      {(!showOnly || showOnly === 'settings') && (
        <div className="bg-[#111111] border border-gray-800 rounded-3xl p-4 sm:p-5 shadow-xl text-left">
          <div className="flex items-center justify-between select-none pb-1">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-100 font-sans text-left">
              <Sliders className="w-5 h-5 text-[#F27D26]" />
              {t.sensorSettingsTitle}
            </h2>
          </div>

          <div className="mt-3.5 space-y-5 animate-fade-in">
              {/* Delay / Cooldown Delay */}
              <div className="space-y-1.5 text-left">
                <div className="flex justify-between items-center text-xs font-sans">
                  <span className="text-gray-300 font-bold text-[#F27D26]">{t.cooldownDelayLabel}</span>
                  <span className="text-[#F27D26] font-mono font-bold leading-none bg-black/50 px-2 py-0.5 rounded border border-gray-800">
                    {settings.coolDownDelay} {t.secShort}
                  </span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="60"
                  step="1"
                  value={settings.coolDownDelay}
                  onChange={(e) => onSettingsChange({ ...settings, coolDownDelay: parseInt(e.target.value) })}
                  className="w-full h-2 bg-gray-950 rounded-lg appearance-none cursor-pointer accent-[#F27D26]"
                />
                <p className="text-[10px] text-gray-500 leading-normal font-sans">
                  {t.cooldownDelayDesc}
                </p>
              </div>

              {/* Sensitivity Setting */}
              <div className="space-y-1.5 text-left">
                <div className="flex justify-between items-center text-xs font-sans">
                  <span className="text-gray-300 font-medium">{t.sensitivityLabel}</span>
                  <span className="text-[#F27D26] font-mono font-bold leading-none bg-black/50 px-2 py-0.5 rounded border border-gray-800">
                    {settings.sensitivity}%
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="99"
                  value={settings.sensitivity}
                  onChange={(e) => onSettingsChange({ ...settings, sensitivity: parseInt(e.target.value) })}
                  className="w-full h-2 bg-gray-950 rounded-lg appearance-none cursor-pointer accent-[#F27D26]"
                />
                <p className="text-[10px] text-gray-500 leading-normal font-sans">
                  {t.sensitivityDesc}
                </p>
              </div>

              {/* Noise Threshold Setting */}
              <div className="space-y-1.5 text-left">
                <div className="flex justify-between items-center text-xs font-sans">
                  <span className="text-gray-300 font-medium">{t.noiseThresholdLabel}</span>
                  <span className="text-[#F27D26] font-mono font-bold leading-none bg-black/50 px-2 py-0.5 rounded border border-gray-800">
                    {settings.noiseThreshold}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.3"
                  max="8"
                  step="0.1"
                  value={settings.noiseThreshold}
                  onChange={(e) => onSettingsChange({ ...settings, noiseThreshold: parseFloat(e.target.value) })}
                  className="w-full h-2 bg-gray-950 rounded-lg appearance-none cursor-pointer accent-[#F27D26]"
                />
                <p className="text-[10px] text-gray-500 leading-normal font-sans">
                  {t.noiseThresholdDesc}
                </p>
              </div>

              {/* Kiosk Mode Setting Toggle */}
              <div className="space-y-1.5 pt-3 border-t border-gray-850/50 text-left">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-0.5">
                    <label htmlFor="kiosk-mode-checkbox" className="text-xs font-bold text-gray-200 font-sans select-none cursor-pointer">
                      {t.kioskSettingLabel}
                    </label>
                    <p className="text-[10px] text-gray-500 leading-normal font-sans">
                      {t.kioskSettingDesc}
                    </p>
                  </div>
                  <input
                    id="kiosk-mode-checkbox"
                    type="checkbox"
                    checked={settings.kioskModeEnabled !== false}
                    onChange={(e) => onSettingsChange({ ...settings, kioskModeEnabled: e.target.checked })}
                    className="w-10 h-5 bg-gray-800 rounded-full appearance-none relative before:content-[''] before:absolute before:w-4 before:h-4 before:bg-gray-400 before:rounded-full before:top-0.5 before:left-0.5 checked:before:left-5 checked:bg-[#F27D26] transition-all cursor-pointer shrink-0"
                  />
                </div>
              </div>
            </div>
        </div>
      )}

      {/* Audio Preset Select Block */}
      {(!showOnly || showOnly === 'audio') && (
        <div className="bg-[#111111] border border-gray-800 rounded-3xl p-4 sm:p-5 shadow-xl text-left">
          {showOnly !== 'audio' ? (
            <div 
              onClick={() => setIsAudioCollapsed(!isAudioCollapsed)}
              className="flex items-center justify-between cursor-pointer select-none pb-1"
            >
              <h2 className="flex items-center gap-2 text-base font-bold text-slate-100 font-sans text-left">
                <Volume2 className="w-5 h-5 text-[#F27D26]" />
                {t.chooseAudioTitle}
              </h2>
              {isAudioCollapsed ? (
                <ChevronDown className="w-5 h-5 text-gray-400 hover:text-white transition-colors" />
              ) : (
                <ChevronUp className="w-5 h-5 text-gray-400 hover:text-white transition-colors" />
              )}
            </div>
          ) : (
            <div className="pb-1 border-b border-gray-850">
              <h2 className="flex items-center gap-2 text-base font-bold text-slate-100 font-sans text-left">
                <Volume2 className="w-5 h-5 text-[#F27D26]" />
                {t.chooseAudioTitle}
              </h2>
            </div>
          )}
          
          {!isAudioCollapsed && (
            <div className="mt-3.5 space-y-4 animate-fade-in">
              <p className="text-xs text-gray-400 leading-normal font-sans text-left">
                {t.chooseAudioDesc}
              </p>

              {/* Action notification toast helper */}
              {actionFeedback && (
                <div className="mb-3 py-1.5 px-3 bg-[#F27D26]/10 border border-[#F27D26]/20 rounded-lg text-[#F27D26] text-xs font-sans flex items-center gap-1.5 animate-pulse">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>{actionFeedback}</span>
                </div>
              )}

              {/* Highlight Block: Single Active Selected Sound */}
              <div className="bg-[#1C1C1E]/60 border border-[#F27D26]/40 rounded-2xl p-4 text-left shadow-lg shadow-[#F27D26]/5 mb-4 animate-fade-in">
                <p className="text-xs font-bold text-[#F27D26] font-sans mb-3 flex items-center gap-1.5 bg-transparent">
                  <Sparkles className="w-4 h-4 text-[#F27D26] animate-pulse" />
                  {lang === 'uk' ? 'Обраний активний сигнал тривоги' : 'Selected Active Alarm Signal'}
                </p>
                {selectedCustomAudio ? (
                  <div className="bg-black/45 border border-[#F27D26]/20 rounded-xl p-3 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                        <span className="text-xs font-bold font-sans text-gray-200 truncate block">
                          {selectedCustomAudio.name}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-500 font-mono mt-1">
                        {lang === 'uk' ? 'Джерело: Google Диск / Завантажені' : 'Source: Google Drive / Uploaded'} • {formatSize(selectedCustomAudio.size)}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handlePreviewCustom(selectedCustomAudio, e)}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-all ${
                        previewingId === selectedCustomAudio.id
                          ? 'bg-rose-500/20 text-rose-455 border border-rose-500/30'
                          : 'bg-[#1A1A1A] border border-gray-850 text-gray-300'
                      }`}
                    >
                      {previewingId === selectedCustomAudio.id ? (
                        <Square className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                      ) : (
                        <Play className="w-3.5 h-3.5 text-gray-250 fill-gray-250" />
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="py-3 px-3.5 bg-black/20 border border-gray-850 border-dashed rounded-xl text-center">
                    <p className="text-[11px] text-gray-500 font-sans">
                      {lang === 'uk'
                        ? 'Сигнал не обрано з диск-списку. Натисніть на будь-який файл нижче, щоб встановити його активним.'
                        : 'No custom signal is active. Click any loaded file below to set it as active.'}
                    </p>
                  </div>
                )}
              </div>

              {/* FIRST: Custom audio upload section */}
              <div>
                <p className="text-xs font-bold text-gray-200 font-sans mb-3 flex items-center gap-1.5 text-left bg-transparent">
                  <Sparkles className="w-3.5 h-3.5 text-[#F27D26]" />
                  {t.uploadedSignalsTitle}
                </p>

                {/* Current saved list from IndexedDB */}
                <div className="space-y-2 mb-3">
                  {customAudios.map((file) => {
                    const isSelected = settings.audioSourceType === 'custom' && settings.customAudioId === file.id;
                    const isPlaying = previewingId === file.id;

                    return (
                      <div
                        key={file.id}
                        onClick={() => handleCustomAudioSelect(file.id, file.data)}
                        className={`py-2 px-3 border rounded-xl flex items-center justify-between cursor-pointer transition-all duration-200 group active:scale-99 ${
                          isSelected
                            ? 'bg-[#F27D26]/10 border-[#F27D26] shadow-md shadow-[#F27D26]/10'
                            : 'bg-black/45 border-gray-850 hover:border-gray-700 hover:bg-black/70'
                        }`}
                      >
                        <div className="flex-1 mr-2 min-w-0 text-left">
                          <p className="text-xs font-sans font-bold text-gray-200 break-words whitespace-normal leading-snug">
                            {file.name}
                          </p>
                          <p className="text-[10px] text-gray-500 font-mono">
                            {lang === 'uk' ? 'Розмір' : 'Size'}: {formatSize(file.size)}
                          </p>
                        </div>

                        <div className="flex gap-1.5 shrink-0">
                          {/* Play/Stop file */}
                          <button
                            type="button"
                            onClick={(e) => handlePreviewCustom(file, e)}
                            aria-label={lang === 'uk' ? 'Прослухати звук' : 'Preview sound'}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer ${
                              isPlaying 
                                ? 'bg-rose-500/20 text-rose-455' 
                                : 'bg-[#1A1A1A] border border-gray-850 text-gray-300'
                            }`}
                          >
                            {isPlaying ? <Square className="w-3.5 h-3.5 text-rose-500 fill-rose-500" /> : <Play className="w-3.5 h-3.5 text-gray-250 fill-gray-250" />}
                          </button>

                          {/* Delete file */}
                          <button
                            type="button"
                            onClick={(e) => handleDeleteAudio(file.id, e)}
                            aria-label={lang === 'uk' ? 'Видалити звук' : 'Delete sound'}
                            className="w-8 h-8 rounded-lg bg-[#1A1A1A] border border-gray-850 text-gray-500 hover:text-rose-455 hover:bg-rose-500/10 flex items-center justify-center cursor-pointer transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {customAudios.length === 0 && (
                    <p className="text-[11px] text-gray-500 p-3 text-center border border-dashed border-gray-850 rounded-xl font-sans">
                      {t.noUploadedSignals}
                    </p>
                  )}

                  {customAudios.length > 0 && (
                    <div className="py-2.5 px-3 bg-slate-900/55 border border-slate-800 rounded-xl text-[10px] text-slate-400 font-sans leading-normal flex items-start gap-2 mt-2">
                      <Info className="w-4 h-4 text-[#F27D26] shrink-0 mt-0.5" />
                      <span>
                        {lang === 'uk'
                          ? '🔒 Локальна база: Усі імпортовані або додані звуки повністю скопійовані в пам’ять пристрою (IndexedDB). Навіть при випадковому очищенні звичайного кешу браузера вони НЕ зникнуть. Стерти їх можна лише вручну за допомогою кнопки 🗑️.'
                          : '🔒 Local Copy: All imported or uploaded sounds are copied directly into the device\'s offline database (IndexedDB). They are unaffected by browser cache cleanups and won\'t be deleted unless you manually delete them with the 🗑️ button.'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Google Drive Folder Listing & Paste Area - Moved directly above Built-In Presets */}
              <div className="bg-[#1C1C1E]/60 border border-gray-850 rounded-2xl p-4 mt-5 text-left">
                <div className="flex items-center justify-between mb-3.5">
                  <p className="text-xs font-bold text-gray-200 font-sans flex items-center gap-1.5 bg-transparent">
                    <FolderOpen className="w-4 h-4 text-[#F27D26]" />
                    {lang === 'uk' ? 'Додати з Google Диску' : 'Add from Google Drive'}
                  </p>
                  <button
                    type="button"
                    onClick={() => loadDriveFolder()}
                    title={lang === 'uk' ? 'Оновити список' : 'Refresh file list'}
                    className="text-[10px] font-bold text-[#F27D26] hover:text-[#ff9a46] transition-colors cursor-pointer bg-transparent border-none outline-none flex items-center gap-1"
                  >
                    {isLoadingDrive ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <span>{lang === 'uk' ? 'Оновити' : 'Refresh'}</span>
                    )}
                  </button>
                </div>

                {/* Description / Link */}
                <p className="text-[10px] text-gray-400 font-sans leading-relaxed mb-3">
                  {lang === 'uk'
                    ? 'Ви можете завантажити звуки безпосередньо зі спільної папки Google Диску автора (оновлюється автоматично) або вставити посилання на власну папку/файл нижче.'
                    : 'Download alert sounds directly from the author\'s shared Google Drive folder (refreshed automatically) or paste your own folder/file link below.'}
                </p>

                {/* Pasting Custom Folder/File link */}
                <div className="flex gap-2 mb-3.5">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder={lang === 'uk' ? 'Вставте посилання на папку або файл...' : 'Paste folder or file link...'}
                      value={pastedDriveLink}
                      onChange={(e) => setPastedDriveLink(e.target.value)}
                      className="w-full text-xs font-sans px-3 py-2 bg-black/45 border border-gray-800 rounded-xl focus:outline-none focus:border-[#F27D26] text-gray-250 placeholder-gray-650"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      handlePasteDriveLink(pastedDriveLink);
                      setPastedDriveLink("");
                    }}
                    className="px-3.5 py-2 bg-[#F27D26] text-black font-sans font-black tracking-widest text-[10px] rounded-xl transition-all cursor-pointer active:scale-95"
                  >
                    {lang === 'uk' ? 'ОБРОБИТИ' : 'PARSE'}
                  </button>
                </div>

                {/* Drive Error or Notification message */}
                {driveError && (
                  <div className="mb-3.5 py-1.5 px-3 bg-rose-500/10 border border-rose-500/25 rounded-lg text-rose-455 text-[10px] font-sans flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 shrink-0" />
                    <span>{driveError}</span>
                  </div>
                )}

                {/* Shared Folder files list */}
                <div className="space-y-1.5 max-h-48 overflow-y-auto mb-1 pr-1 bg-black/20 p-2 rounded-xl border border-gray-900">
                  {isLoadingDrive ? (
                    <div className="py-6 flex flex-col items-center justify-center text-center gap-2">
                      <Loader2 className="w-6 h-6 text-[#F27D26] animate-spin" />
                      <span className="text-[10px] text-gray-550 font-mono">{lang === 'uk' ? 'Отримання файлів...' : 'Retrieving files...'}</span>
                    </div>
                  ) : (
                    <>
                      {driveFiles.map((file) => {
                        const isDownloadingFile = !!isDownloading[file.id];
                        const isCurrentlySelected = settings.audioSourceType === 'custom' && settings.customAudioId === `drive_${file.id}`;

                        return (
                          <div
                            key={file.id}
                            onClick={() => {
                              if (!isDownloadingFile) {
                                downloadGoogleDriveFile(file.id, file.name);
                              }
                            }}
                            className={`py-1.5 px-2.5 rounded-lg flex items-center justify-between transition-all gap-2 cursor-pointer border ${
                              isCurrentlySelected
                                ? 'bg-[#F27D26]/10 border-[#F27D26]/40 shadow-sm shadow-[#F27D26]/5'
                                : 'bg-black/35 hover:bg-black/60 border-gray-850 hover:border-gray-700'
                            }`}
                          >
                            <div className="flex-1 min-w-0 text-left flex items-center gap-1.5">
                              {isCurrentlySelected && (
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                              )}
                              <span className="text-[10px] sm:text-xs font-sans text-gray-300 font-bold block break-words whitespace-normal leading-normal">
                                {file._isFallback ? `🔔 ${file.name}` : file.name}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {/* Preview Google Drive audio file */}
                              <button
                                type="button"
                                disabled={!!isDownloading[file.id]}
                                onClick={(e) => handlePreviewDrive(file.id, file.name, e)}
                                className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all ${
                                  drivePlayingId === file.id
                                    ? 'bg-rose-500/20 text-rose-500 border border-rose-500/40'
                                    : 'bg-[#1A1A1A] border border-gray-850 text-gray-400 hover:text-white hover:bg-gray-800'
                                }`}
                              >
                                {drivePreviewLoadingId === file.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin text-zinc-400" />
                                ) : drivePlayingId === file.id ? (
                                  <Square className="w-3 h-3 text-rose-500 fill-rose-500" />
                                ) : (
                                  <Play className="w-3 h-3 text-gray-400 fill-gray-400" />
                                )}
                              </button>

                              <button
                                type="button"
                                disabled={isDownloadingFile}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  downloadGoogleDriveFile(file.id, file.name);
                                }}
                                className={`w-7 h-7 border rounded-lg flex items-center justify-center cursor-pointer transition-all active:scale-95 disabled:opacity-50 ${
                                  isCurrentlySelected
                                    ? 'bg-[#F27D26]/20 text-[#F27D26] border-[#F27D26]/30'
                                    : 'bg-[#1A1A1A] hover:bg-[#F27D26] hover:text-black border-gray-850 text-gray-350'
                                }`}
                                title={lang === 'uk' ? 'Імпортувати' : 'Import'}
                              >
                                {isDownloadingFile ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : isCurrentlySelected ? (
                                  <Check className="w-3.5 h-3.5 stroke-[3px]" />
                                ) : (
                                  <Download className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {driveFiles.length === 0 && (
                        <div className="py-4 text-center">
                          <span className="text-[10px] text-gray-500 font-sans block">{lang === 'uk' ? 'Нічого не знайдено в папці' : 'No sound files found in folder'}</span>
                          <button
                            type="button"
                            onClick={() => loadDriveFolder()}
                            className="text-[10px] text-[#F27D26] underline font-bold mt-1 inline-block hover:no-underline cursor-pointer"
                          >
                            {lang === 'uk' ? 'Спробувати завантажити знову' : 'Try loading again'}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Quick-link to the real Google Drive folder in a new tab for convenience */}
                <div className="mt-2 text-right">
                  <a
                    href="https://drive.google.com/drive/folders/1TZvyS9ooPl6PDPtlkSz62cYTxeh4K3Td?usp=drive_link"
                    target="_blank"
                    rel="referrer"
                    className="text-[9px] text-gray-550 hover:text-zinc-200 inline-flex items-center gap-1 font-mono transition-colors"
                  >
                    <Link2 className="w-2.5 h-2.5" />
                    <span>{lang === 'uk' ? 'Переглянути папку на Диску' : 'View folder on Google Drive'}</span>
                  </a>
                </div>
              </div>

              {/* New file selection trigger - relocated below Google Drive and styled natively */}
              <div className="bg-[#1C1C1E]/40 border border-gray-850 rounded-2xl p-4 mt-5 text-left">
                <p className="text-xs font-bold text-gray-200 font-sans mb-3 flex items-center gap-1.5 bg-transparent">
                  <Upload className="w-4 h-4 text-[#F27D26]" />
                  <span>{lang === 'uk' ? 'Додати власний аудіофайл' : 'Add custom audio file'}</span>
                </p>
                <div className="relative">
                  <label className="flex flex-col items-center justify-center p-4 border border-dashed border-gray-800 hover:border-[#F27D26]/50 bg-black/30 hover:bg-black/70 rounded-xl cursor-pointer transition-all duration-200 text-center">
                    <Upload className="w-5 h-5 text-[#F27D26] mb-1.5" />
                    <span className="text-xs text-slate-200 font-extrabold font-sans bg-transparent py-0.5 px-1 truncate max-w-full">
                      {lang === 'uk' ? 'ВИБРАТИ АУДІОФАЙЛ' : 'SELECT AUDIO FILE'}
                    </span>
                    <span className="text-[9px] text-gray-550 font-mono mt-0.5">{lang === 'uk' ? 'Максимальний розмір: 12 МБ' : 'Maximum size: 12 MB'}</span>
                    <input
                      type="file"
                      accept={useAllSources ? "audio/*,video/mp4,video/quicktime,application/octet-stream,layout/*,.mp3,.wav,.m4a,.aac,.ogg,.mp4,.mov,.3gp,.caf,.amr,video/*,*/*" : "audio/*"}
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                  {fileError && (
                    <p className="text-xs text-rose-400 mt-2 font-sans px-1 flex items-center gap-1">
                      <Info className="w-3.5 h-3.5" />
                      {fileError}
                    </p>
                  )}
                </div>
              </div>

              {/* SECOND: Scrollable list of synthesizer sound items (Standard preset signals) */}
              <div className="mt-5 border-t border-gray-850 pt-4">
                <p className="text-xs font-bold text-gray-200 font-sans mb-3 flex items-center gap-1.5 text-left bg-transparent">
                  <Volume2 className="w-3.5 h-3.5 text-[#F27D26]" />
                  {lang === 'uk' ? 'Вбудовані стандартні сигнали' : 'Built-in standard signals'}
                </p>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {AUDIO_PRESETS.map((preset) => {
                    const isSelected = settings.audioSourceType === 'preset' && settings.audioPresetId === preset.id;
                    const isPlaying = previewingId === preset.id;

                    return (
                      <div
                        key={preset.id}
                        onClick={() => handlePresetSelect(preset.id)}
                        className={`py-2 px-3 border rounded-xl flex items-center justify-between cursor-pointer transition-all duration-200 group active:scale-99 ${
                          isSelected
                            ? 'bg-[#F27D26]/10 border-[#F27D26] shadow-md shadow-[#F27D26]/10'
                            : 'bg-black/45 border-gray-850 hover:border-gray-700 hover:bg-black/70'
                        }`}
                      >
                        <div className="flex-1 text-left">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs font-sans font-bold transition-colors ${isSelected ? 'text-zinc-150' : 'text-gray-200'}`}>
                              {preset.name}
                            </span>
                            {isSelected && (
                              <span className="bg-[#F27D26]/10 text-[#F27D26] border border-[#F27D26]/10 text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded">
                                {lang === 'uk' ? 'УВІМК' : 'ON'}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-gray-500 font-sans">{preset.description}</p>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => handlePreviewPreset(preset.id, e)}
                          aria-label={lang === 'uk' ? 'Прослухати зразок' : 'Preview audioPreset'}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                            isPlaying 
                              ? 'bg-rose-500/20 text-rose-450 hover:bg-rose-500/30' 
                              : 'bg-[#1A1A1A] border border-gray-850 text-gray-300 hover:bg-gray-800'
                          }`}
                        >
                          {isPlaying ? <Square className="w-3.5 h-3.5 text-rose-500 fill-rose-500" /> : <Play className="w-3.5 h-3.5 text-gray-200 fill-gray-200" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* iPhone / iPad Source Selector Optimization (moved to the bottom of the section) */}
              <div className="bg-black/40 border border-gray-850 rounded-2xl p-3.5 mt-5 text-left">
                <div className="flex items-start gap-2.5">
                  <Smartphone className="w-4.5 h-4.5 text-[#F27D26] shrink-0 mt-0.5 animate-pulse" />
                  <div className="space-y-1 sm:space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-gray-200 font-sans">
                        {lang === 'uk' ? 'Режим завантаження iPhone / будь-який файл' : 'iPhone Upload Mode (Any File Source)'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setUseAllSources(!useAllSources)}
                        className={`w-9 h-5 rounded-full flex items-center p-0.5 transition-colors cursor-pointer duration-200 select-none border-none shrink-0 ${
                          useAllSources ? 'bg-[#F27D26]' : 'bg-gray-850'
                        }`}
                      >
                        <span 
                          className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                            useAllSources ? 'translate-x-4' : 'translate-x-0'
                          }`} 
                        />
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-455 font-sans leading-relaxed">
                      {lang === 'uk' 
                        ? 'Увімкніть, щоб дозволити вибір аудіо з iCloud Drive, системної папки "Файли", Telegram тощо, а не тільки захищену медіатеку Apple Music!' 
                        : 'Enable to unlock picking raw audio files from your iCloud Drive, downloaded "Files" app folder, Telegram, etc., instead of just DRM-protected Apple Music library.'}
                    </p>
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>
      )}
    </div>
  );
}
