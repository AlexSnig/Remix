import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldAlert, ShieldCheck, EyeOff, Radio, VolumeX, Volume2,
  Smartphone, Check, Edit3, Trash2, Landmark, List, Settings, X, ArrowLeft, RefreshCw
} from 'lucide-react';
import { DetectorSettings, MotionLog } from './types';
import CameraDetector from './components/CameraDetector';
import SettingsPanel from './components/SettingsPanel';
import LogsPanel from './components/LogsPanel';
import StealthOverlay from './components/StealthOverlay';
import MinimalFilesList from './components/MinimalFilesList';
import { 
  getAllMotionLogs, clearAllMotionLogs, getDB, getCustomAudio,
  saveCustomAudio, getAllCustomAudios
} from './utils/indexedDB';
import { stopAllAudio, unlockAudioContext } from './utils/audio';
import { Language, TRANSLATIONS } from './utils/lang';

const STORAGE_KEY = 'motion_detector_user_settings';
const APP_NAME_STORAGE_KEY = 'motion_sensor_app_name';
const LANG_STORAGE_KEY = 'motion_sensor_app_lang';

const DEFAULT_SETTINGS: DetectorSettings = {
  sensitivity: 70,               // 70% is an optimized default
  noiseThreshold: 1.5,          // 1.5% is a normal indoor thresh
  coolDownDelay: 6,             // 6 seconds delay
  audioSourceType: 'preset',
  audioPresetId: 'beep_short',
  customAudioId: null,
  cameraFacingMode: 'user', // front camera prioritized as default
  stealthMode: false,
  autoCleanCacheEnabled: true,
  maxCacheLogsCount: 20,
  audioVolume: 100,
  kioskModeEnabled: true
};

export default function App() {
  const [lang, setLang] = useState<Language>(() => {
    try {
      const savedLang = localStorage.getItem(LANG_STORAGE_KEY);
      if (savedLang === 'uk' || savedLang === 'en') return savedLang;
    } catch (e) {}
    return 'uk'; // default language
  });

  const [settings, setSettings] = useState<DetectorSettings>(DEFAULT_SETTINGS);
  const [logs, setLogs] = useState<MotionLog[]>([]);
  const [customAudioData, setCustomAudioData] = useState<string | null>(null);
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [stealthActive, setStealthActive] = useState<boolean>(false);
  const [isAlarmPlaying, setIsAlarmPlaying] = useState<boolean>(false);
  const [onCoolDown, setOnCoolDown] = useState<boolean>(false);
  const [coolDownRemaining, setCoolDownRemaining] = useState<number>(0);
  const [showKioskGate, setShowKioskGate] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.kioskModeEnabled === false) {
          return false;
        }
      }
    } catch (e) {}
    return true; // show kiosk gate by default on browser boot as requested!
  });
  // Auto-resume Audio Context on first touch/click
  useEffect(() => {
    const resumeAudio = () => {
      try {
        unlockAudioContext();
      } catch (e) {}
      window.removeEventListener('click', resumeAudio);
      window.removeEventListener('touchstart', resumeAudio);
    };
    window.addEventListener('click', resumeAudio);
    window.addEventListener('touchstart', resumeAudio);
    return () => {
      window.removeEventListener('click', resumeAudio);
      window.removeEventListener('touchstart', resumeAudio);
    };
  }, []);
  const [activeTab, setActiveTab] = useState<'sensor' | 'events'>('sensor');
  const [minimalMode, setMinimalMode] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showAudioModal, setShowAudioModal] = useState<boolean>(false);

  // Screen Wake Lock stay awake state
  const [isWakeLockActive, setIsWakeLockActive] = useState<boolean>(false);
  const wakeLockRef = useRef<any>(null);

  const requestWake = async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        setIsWakeLockActive(true);
        wakeLockRef.current.addEventListener('release', () => {
          setIsWakeLockActive(false);
        });
      } catch (err) {
        console.warn("Wake lock failed:", err);
      }
    } else {
      // Fallback for older browsers
      setIsWakeLockActive(true);
    }
  };

  const releaseWake = async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
      } catch (e) {}
      wakeLockRef.current = null;
    }
    setIsWakeLockActive(false);
  };

  const toggleWakeLock = async () => {
    if (isWakeLockActive) {
      await releaseWake();
    } else {
      await requestWake();
    }
  };

  // Re-acquire wake lock on visibility change if active
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && isWakeLockActive) {
        try {
          if ('wakeLock' in navigator) {
            wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
          }
        } catch (e) {}
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isWakeLockActive]);

  // Clean up wake lock on unmount
  useEffect(() => {
    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
      }
    };
  }, []);

  // Dynamic naming of museum exhibit
  const [appName, setAppName] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(APP_NAME_STORAGE_KEY);
      if (saved) return saved;
    } catch (e) {}
    return 'Датчик музейного експонату';
  });
  const [isEditingName, setIsEditingName] = useState<boolean>(false);
  const [tempName, setTempName] = useState<string>(appName);

  const t = TRANSLATIONS[lang];

  // Initialize DB and load local logs on component mount
  useEffect(() => {
    // Attempt load settings from localstorage
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Force front camera on initial startup as requested
        parsed.cameraFacingMode = 'user';
        setSettings(parsed);
      }
    } catch (e) {
      console.warn("Could not load local settings:", e);
    }

    const initLogs = async () => {
      try {
        await getDB(); // Bootstraps IndexedDB schema
        const history = await getAllMotionLogs();
        setLogs(history);
      } catch (e) {
        console.warn("Could not retrieve IndexedDB logs history:", e);
      }
    };
    initLogs();

    // Track fullscreen change events
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, []);

  // Load custom audio base64 on boot & settings change
  useEffect(() => {
    const loadCustomAudio = async () => {
      if (settings.audioSourceType === 'custom' && settings.customAudioId) {
        try {
          const audio = await getCustomAudio(settings.customAudioId);
          if (audio) {
            setCustomAudioData(audio.data);
          } else {
            setCustomAudioData(null);
          }
        } catch (e) {
          console.warn("Could not load custom audio data on settings change:", e);
          setCustomAudioData(null);
        }
      } else {
        setCustomAudioData(null);
      }
    };
    loadCustomAudio();
  }, [settings.customAudioId, settings.audioSourceType]);

  // Background Auto-sync for Google Drive folder
  const [syncStatus, setSyncStatus] = useState<{
    isSyncing: boolean;
    lastMessage: string | null;
    isError: boolean;
  }>({
    isSyncing: false,
    lastMessage: null,
    isError: false
  });

  // Automatic background synchronization disabled by user request. 
  // Files are now only loaded on demand when selected/clicked by the user.
  useEffect(() => {
    // No-op: Auto sync is completely stopped
  }, []);

  // Save settings whenever changed
  const handleSettingsChange = (newSettings: DetectorSettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
    } catch (e) {
      console.error("Could not write local settings:", e);
    }
  };

  const handleLanguageChange = (newLang: Language) => {
    setLang(newLang);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, newLang);
    } catch (e) {}
  };

  // Handle Cooldown Countdown globally in App.tsx
  useEffect(() => {
    let timer: any = null;
    if (onCoolDown && coolDownRemaining > 0) {
      timer = setInterval(() => {
        setCoolDownRemaining(prev => {
          if (prev <= 1) {
            setOnCoolDown(false);
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [onCoolDown, coolDownRemaining]);

  // Cancel cooldown if detection is turned off
  useEffect(() => {
    if (!isDetecting) {
      setOnCoolDown(false);
      setCoolDownRemaining(0);
    }
  }, [isDetecting]);

  const handleLogTriggered = (newLog: MotionLog) => {
    // Prepend new trigger log at the top of list
    setLogs(prev => [newLog, ...prev]);
    setIsAlarmPlaying(true);
    
    // Set cooldown immediately when triggered
    setOnCoolDown(true);
    setCoolDownRemaining(settings.coolDownDelay);
    
    // Automatically turn off alarm state visually after 5 seconds
    setTimeout(() => {
      setIsAlarmPlaying(false);
    }, 5000);
  };

  const handleManualLogDelete = async (id: string) => {
    setLogs(prev => prev.filter(l => l.id !== id));
    try {
      const db = await getDB();
      const transaction = db.transaction('motionLogs', 'readwrite');
      transaction.objectStore('motionLogs').delete(id);
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearAllLogs = async () => {
    if (!window.confirm(t.confirmClearLogs)) return;
    try {
      await clearAllMotionLogs();
      setLogs([]);
    } catch (e) {
      console.warn(e);
    }
  };

  const muteCurrentScreamer = () => {
    stopAllAudio();
    setIsAlarmPlaying(false);
  };

  const handleActivateStealth = async () => {
    setStealthActive(true);
    
    // Automatically keep screen awake
    try {
      if ('wakeLock' in navigator) {
        await requestWake();
      }
    } catch (e) {
      console.warn("Autoplay prevent-off failed:", e);
    }

    // Automatically toggle Fullscreen mode
    try {
      const docEl = document.documentElement;
      if (!document.fullscreenElement) {
        await docEl.requestFullscreen();
      }
    } catch (err) {
      console.warn("Fullscreen request active on stealth mode failed:", err);
    }
  };

  const handleDeactivateStealth = async () => {
    setStealthActive(false);

    // Release always-on screen back to default sleep settings
    try {
      await releaseWake();
    } catch (e) {}

    // Automatically exit Fullscreen mode
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn("Exit fullscreen failure on stealth mode exit:", err);
    }
  };

  const handleEnterKiosk = async () => {
    setShowKioskGate(false);
    
    try {
      unlockAudioContext();
    } catch (e) {}

    try {
      const docEl = document.documentElement;
      if (!document.fullscreenElement) {
        await docEl.requestFullscreen();
      }
    } catch (err) {
      console.warn("Fullscreen request active on kiosk mode launch failed:", err);
    }

    try {
      if ('wakeLock' in navigator) {
        await requestWake();
      }
    } catch (e) {}

    setIsDetecting(true);
  };

  const saveAppName = () => {
    const trimmed = tempName.trim();
    if (trimmed) {
      setAppName(trimmed);
      try {
        localStorage.setItem(APP_NAME_STORAGE_KEY, trimmed);
      } catch (e) {}
    }
    setIsEditingName(false);
  };

  return (
    <div 
      className={`min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans transition-colors duration-300 ${settings.kioskModeEnabled !== false ? 'select-none kiosk-mode-active' : ''}`}
      onContextMenu={(e) => {
        if (settings.kioskModeEnabled !== false) {
          e.preventDefault();
        }
      }}
    >
      {showKioskGate ? (
        <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 animate-fade-in text-center select-none max-w-xl mx-auto w-full relative">
          {/* Circular radiant logo */}
          <div className="relative mb-6 mt-[-5vh]">
            <div className="absolute inset-0 bg-[#F27D26]/10 rounded-full blur-2xl animate-[pulse_3s_infinite]" />
            <div className="relative w-20 h-20 rounded-full bg-[#111] border-2 border-[#F27D26] flex items-center justify-center shadow-lg shadow-[#F27D26]/15">
              <Landmark className="w-9 h-9 text-[#F27D26] animate-[pulse_1.8s_infinite]" />
            </div>
          </div>

          {/* Exhibition App Title */}
          <h1 className="text-xl sm:text-2xl font-sans font-black tracking-wider text-slate-100 mb-3 uppercase">
            {appName}
          </h1>
          
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F27D26]/10 border border-[#F27D26]/15 text-[#F27D26] font-mono font-bold text-xs uppercase mb-6 tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F27D26] animate-ping" />
            <span>{t.kioskGateTitle}</span>
          </div>

          {/* Descriptive block */}
          <p className="text-gray-400 text-xs sm:text-sm leading-relaxed mb-8 max-w-md font-sans">
            {t.kioskGateDesc}
          </p>

          {/* Large Action Core button to launch security */}
          <button
            type="button"
            onClick={handleEnterKiosk}
            className="w-full py-4 px-6 rounded-2xl bg-[#F27D26] hover:bg-[#ff8f3c] text-black font-sans font-black text-xs sm:text-sm tracking-widest transition-all duration-200 cursor-pointer shadow-lg shadow-[#F27D26]/20 hover:scale-102 active:scale-98 flex items-center justify-center gap-2.5 uppercase shrink-0"
          >
            <ShieldCheck className="w-5 h-5 text-black" strokeWidth={3} />
            <span>{t.kioskGateBtn}</span>
          </button>

          {/* Skip buttons to bypass/skip and tune settings */}
          <button
            type="button"
            onClick={() => setShowKioskGate(false)}
            className="mt-6 text-xs text-gray-500 hover:text-slate-350 cursor-pointer transition-colors underline underline-offset-4"
          >
            {t.kioskGateSkip}
          </button>

          {/* Minimal design credit or status at the absolute bottom */}
          <div className="absolute bottom-6 left-4 right-4 text-center">
            <div className="flex justify-center items-center gap-3">
              <button
                onClick={() => handleLanguageChange('uk')}
                className={`text-[10px] font-sans font-black px-2.5 py-1 rounded-lg ${lang === 'uk' ? 'bg-[#F27D26]/10 text-[#F27D26]' : 'text-gray-500 hover:text-gray-300'}`}
              >
                🇺🇦 УКР
              </button>
              <span className="text-gray-800 font-sans">|</span>
              <button
                onClick={() => handleLanguageChange('en')}
                className={`text-[10px] font-sans font-black px-2.5 py-1 rounded-lg ${lang === 'en' ? 'bg-[#F27D26]/10 text-[#F27D26]' : 'text-gray-500 hover:text-gray-300'}`}
              >
                🇬🇧 ENG
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {activeTab === 'sensor' && (
            <>
              {/* 1. Top Buttons Row - Make "Погасить экран" button full width and taller (h-14 rounded-2xl) and add generous top spacing */}
              <div className="w-full max-w-sm mx-auto mt-10 md:mt-14 px-4 flex items-center gap-3 font-sans animate-fade-in">
                {/* Blackout button (Погасить экран) - Custom Tall Gray button style */}
                <button
                  type="button"
                  onClick={handleActivateStealth}
                  className="w-full h-14 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-slate-100 hover:text-white text-xs font-sans font-black tracking-wider rounded-2xl transition-all flex items-center justify-center gap-2.5 cursor-pointer select-none active:scale-95 shadow-md uppercase"
                  title={lang === 'uk' ? 'Погасити екран' : 'Blackout Screen'}
                >
                  <EyeOff className="w-5 h-5 text-[#F27D26] shrink-0" strokeWidth={2.5} />
                  <span>
                    {lang === 'uk' ? 'Погасити екран' : 'Blackout Screen'}
                  </span>
                </button>
              </div>

              {/* 2. Full-width Action Row - Host Activation button, reboot button, and language switcher aligned on the right */}
              <div className="w-full max-w-sm mx-auto px-4 mt-3 shrink-0 flex items-center gap-2.5">
                <button
                  onClick={() => {
                    try {
                      unlockAudioContext();
                    } catch (e) {}
                    setIsDetecting(!isDetecting);
                  }}
                  className={`flex-1 h-14 rounded-2xl font-sans font-black tracking-wider text-xs flex items-center justify-center gap-2.5 transition-all duration-200 select-none cursor-pointer border shadow-md active:scale-95 ${
                    isDetecting
                      ? 'bg-red-650 hover:bg-red-700 text-white border-red-550/40 shadow-red-950/40 animate-[pulse_2s_infinite]'
                      : 'bg-emerald-650/15 text-emerald-400 border-emerald-500/25 hover:bg-emerald-650/25'
                  }`}
                >
                  <Radio className={`w-5 h-5 shrink-0 ${isDetecting ? 'text-red-200 animate-pulse' : 'text-[#F27D26]'}`} />
                  <span className="uppercase text-[10px] sm:text-xs font-black">
                    {isDetecting 
                      ? (lang === 'uk' ? 'ВИМКНУТИ ДАТЧИК РУХУ' : 'TURN OFF SENSOR') 
                      : (lang === 'uk' ? 'УВІМКНУТИ ДАТЧИК РУХУ' : 'TURN ON SENSOR')
                    }
                  </span>
                </button>

                {/* Reboot Button */}
                <button
                  onClick={() => window.location.reload()}
                  className="px-3.5 h-14 rounded-2xl bg-slate-900 border border-slate-800 hover:bg-[#1C1C1E] text-slate-300 hover:text-red-400 text-xs font-sans font-black tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 select-none shrink-0"
                  title={lang === 'uk' ? 'Перезапуск' : 'Reboot'}
                >
                  <RefreshCw className="w-4 h-4 text-[#F27D26]" />
                  <span className="uppercase text-[10px] sm:text-[11px] font-black">{lang === 'uk' ? 'ПЕРЕЗАПУСК' : 'REBOOT'}</span>
                </button>

                {/* Language Switcher - Placed to the right of Reboot button */}
                <div className="flex items-center bg-slate-900 border border-slate-800 rounded-2xl p-0.5 shadow-sm h-14 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleLanguageChange('uk')}
                    className={`px-2 h-full rounded-xl text-[9px] font-sans font-black tracking-wide transition-all cursor-pointer select-none flex items-center justify-center ${
                      lang === 'uk' ? 'bg-[#F27D26] text-black shadow-sm font-black' : 'text-slate-400 hover:text-slate-200 font-bold'
                    }`}
                  >
                    УКР
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLanguageChange('en')}
                    className={`px-2 h-full rounded-xl text-[9px] font-sans font-black tracking-wide transition-all cursor-pointer select-none flex items-center justify-center ${
                      lang === 'en' ? 'bg-[#F27D26] text-black shadow-sm font-black' : 'text-slate-400 hover:text-slate-200 font-bold'
                    }`}
                  >
                    ENG
                  </button>
                </div>
              </div>
            </>
          )}

          {/* 4. Main Body based on selected Tab */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:py-6 relative">
        <div className="transition-all duration-300">
          
          {/* TAB 1: SENSOR CONTROLS (Centered Camera stream with settings popup inside it) */}
          {activeTab === 'sensor' && (
            <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
              <CameraDetector
                lang={lang}
                settings={settings}
                customAudioData={customAudioData}
                onCustomAudioSaved={setCustomAudioData}
                onLogTriggered={handleLogTriggered}
                isDetecting={isDetecting}
                setIsDetecting={setIsDetecting}
                onSettingsChange={handleSettingsChange}
                logCount={logs.length}
                onCoolDown={onCoolDown}
                setOnCoolDown={setOnCoolDown}
                coolDownRemaining={coolDownRemaining}
                setCoolDownRemaining={setCoolDownRemaining}
                isAlarmPlaying={isAlarmPlaying}
                setIsAlarmPlaying={setIsAlarmPlaying}
                minimalMode={minimalMode}
                onOpenLogs={() => setActiveTab('events')}
              />

              {/* Compact Custom audios block + Google Drive dropdown inside minimal layout */}
              <div className="pt-2">
                <MinimalFilesList
                  settings={settings}
                  onSettingsChange={handleSettingsChange}
                  onCustomAudioSaved={setCustomAudioData}
                  lang={lang}
                  onOpenAudioSourceModal={() => setShowAudioModal(true)}
                />
              </div>

              {/* 3. Event Logs button at the very bottom of the sensor view */}
              <div className="pt-4 border-t border-gray-900 mt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('events')}
                  className="w-full h-14 rounded-2xl font-sans font-black tracking-wider text-xs flex items-center justify-center gap-2.5 transition-all duration-200 select-none cursor-pointer bg-[#101010] hover:bg-slate-900 border border-gray-850 text-slate-200 hover:text-white shadow-md active:scale-95 relative"
                >
                  <List className="w-5 h-5 text-[#F27D26]" />
                  <span>{lang === 'uk' ? 'ЖУРНАЛ ПОДІЙ' : 'EVENT LOGS'}</span>
                  {logs.length > 0 && (
                    <span className="bg-black text-white border border-zinc-800 font-mono font-black text-[10px] px-2.5 py-1 rounded-full animate-pulse ml-1.5 min-w-[22px] text-center shrink-0">
                      {logs.length}
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: EVENTS & LOGS PANEL */}
          {activeTab === 'events' && (
            <div className="max-w-2xl mx-auto space-y-5 animate-fade-in text-left">
              {/* Back to Sensor Button */}
              <div>
                <button
                  type="button"
                  onClick={() => setActiveTab('sensor')}
                  className="px-4 h-11 bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white border border-slate-800 rounded-2xl flex items-center gap-2.5 transition-all text-xs font-sans font-black tracking-wide cursor-pointer select-none active:scale-95 animate-fade-in"
                >
                  <ArrowLeft className="w-4 h-4 text-[#F27D26]" />
                  <span>{lang === 'uk' ? 'НАЗАД ДО ДАТЧИКА' : 'BACK TO SENSOR'}</span>
                </button>
              </div>

              <div>
                <LogsPanel
                  lang={lang}
                  logs={logs}
                  onLogDeleted={handleManualLogDelete}
                  onClearAll={handleClearAllLogs}
                  settings={settings}
                  onSettingsChange={handleSettingsChange}
                />
              </div>
            </div>
          )}

        </div>
      </main>

      {/* 5. Fixed Full-viewport Stealth Saver simulated off-screen overlay */}
      {stealthActive && (
        <StealthOverlay
          lang={lang}
          onClose={handleDeactivateStealth}
          isDetecting={isDetecting}
        />
      )}

      {/* 6. Settings Modal Popup */}
      {showSettingsModal && (
        <div id="settings-popup-backdrop" className="fixed inset-0 bg-black/85 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div 
            id="settings-popup-card" 
            className="bg-[#111111] border border-gray-800 rounded-3xl w-full max-w-lg shadow-[0_10px_50px_rgba(0,0,0,0.85)] flex flex-col max-h-[85vh] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-850 bg-black/20 shrink-0 text-left">
              <span className="text-xs font-black font-sans tracking-widest text-[#F27D26] uppercase flex items-center gap-2">
                <Settings className="w-4 h-4 text-[#F27D26] animate-[spin_12s_linear_infinite]" />
                {lang === 'uk' ? 'Налаштування датчика' : 'Sensor settings'}
              </span>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="bg-gray-850 hover:bg-gray-800 text-slate-300 hover:text-white p-1.5 rounded-xl border-none cursor-pointer transition-all active:scale-95"
                title={lang === 'uk' ? 'Закрити' : 'Close'}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Content wrapper */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-thin">
              <SettingsPanel
                lang={lang}
                settings={settings}
                onSettingsChange={handleSettingsChange}
                onCustomAudioSaved={setCustomAudioData}
                showOnly="settings"
              />
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-850 bg-black/40 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="w-full sm:w-auto px-6 h-11 bg-black hover:bg-zinc-900 text-white border border-zinc-800 font-sans font-black tracking-wider text-xs rounded-xl transition-all cursor-pointer active:scale-95 text-center flex items-center justify-center uppercase shadow-md"
              >
                {lang === 'uk' ? 'Зберегти та закрити' : 'Save and Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Audio Signal Selection Modal Popup */}
      {showAudioModal && (
        <div id="audio-popup-backdrop" className="fixed inset-0 bg-black/85 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div 
            id="audio-popup-card" 
            className="bg-[#111111] border border-gray-800 rounded-3xl w-full max-w-lg shadow-[0_10px_50px_rgba(0,0,0,0.85)] flex flex-col max-h-[85vh] overflow-hidden animate-[scale-up_0.15s_ease-out]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-850 bg-black/20 shrink-0 text-left">
              <span className="text-xs font-black font-sans tracking-widest text-[#F27D26] uppercase flex items-center gap-2">
                <Volume2 className="w-4.5 h-4.5 text-[#F27D26]" />
                {lang === 'uk' ? 'Вибір аудіофайлу' : 'Audio file selection'}
              </span>
              <button
                type="button"
                onClick={() => setShowAudioModal(false)}
                className="bg-gray-850 hover:bg-gray-800 text-slate-300 hover:text-white p-1.5 rounded-xl border-none cursor-pointer transition-all active:scale-95 flex items-center justify-center"
                title={lang === 'uk' ? 'Закрити' : 'Close'}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Content wrapper */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-thin">
              <SettingsPanel
                lang={lang}
                settings={settings}
                onSettingsChange={handleSettingsChange}
                onCustomAudioSaved={setCustomAudioData}
                showOnly="audio"
              />
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-850 bg-black/40 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowAudioModal(false)}
                className="w-full sm:w-auto px-6 h-11 bg-black hover:bg-zinc-900 text-white border border-zinc-800 font-sans font-black tracking-wider text-xs rounded-xl transition-all cursor-pointer active:scale-95 text-center flex items-center justify-center uppercase shadow-md"
              >
                {lang === 'uk' ? 'ВИБРАТИ ТА ЗАКРИТИ' : 'SELECT AND CLOSE'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Background Sync Notification Toast */}
      {syncStatus.lastMessage && (
        <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-md bg-slate-900 border border-[#F27D26]/30 text-slate-100 p-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-fade-in z-[200]">
          <div className="w-8 h-8 rounded-full bg-[#F27D26]/10 flex items-center justify-center shrink-0">
            <Radio className="w-4 h-4 text-[#F27D26] animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-sans font-bold leading-normal text-slate-100">
              {syncStatus.lastMessage}
            </p>
          </div>
          <button
            onClick={() => setSyncStatus(prev => ({ ...prev, lastMessage: null }))}
            className="text-gray-400 hover:text-white cursor-pointer p-1 rounded-lg hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
        </>
      )}
    </div>
  );
}
