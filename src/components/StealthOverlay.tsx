import React, { useEffect, useState, useRef } from 'react';
import { EyeOff, Unlock, AlertCircle } from 'lucide-react';
import { TRANSLATIONS, Language } from '../utils/lang';

interface StealthOverlayProps {
  onClose: () => void;
  isDetecting: boolean;
  lang: Language;
}

export default function StealthOverlay({ onClose, isDetecting, lang }: StealthOverlayProps) {
  const [unlockProgress, setUnlockProgress] = useState<number>(0);
  const [isPressing, setIsPressing] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [wakeLockError, setWakeLockError] = useState<boolean>(false);
  const wakeLockRef = useRef<any>(null);
  const intervalIdRef = useRef<any>(null);
  const t = TRANSLATIONS[lang];

  // Update clock
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Request Wake Lock to prevent screen sleep
  useEffect(() => {
    async function requestWakeLock() {
      if ('wakeLock' in navigator) {
        try {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        } catch (err) {
          console.warn("Screen Wake Lock could not be acquired:", err);
          setWakeLockError(true);
        }
      } else {
        setWakeLockError(true);
      }
    }

    requestWakeLock();

    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release()
          .then(() => {
            wakeLockRef.current = null;
          })
          .catch((e: any) => console.error(e));
      }
    };
  }, []);

  // Handle release press holding timer
  useEffect(() => {
    if (isPressing) {
      intervalIdRef.current = setInterval(() => {
        setUnlockProgress(prev => {
          if (prev >= 100) {
            clearInterval(intervalIdRef.current);
            onClose();
            return 100;
          }
          return prev + 10; // 1 second holding (10 * 10 = 100)
        });
      }, 100);
    } else {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
      }
      setUnlockProgress(0);
    }

    return () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
      }
    };
  }, [isPressing]);

  return (
    <div 
      className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-between p-6 select-none animate-fade-in"
      style={{ touchAction: 'none' }} // Prevents zoom/scroll on mobile
    >
      {/* Dim Indicator Header */}
      <div className="w-full flex justify-between items-center opacity-[0.08] hover:opacity-20 transition-opacity duration-300">
        <div className="flex items-center gap-1.5 text-white">
          <EyeOff className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
          <span className="text-[10px] font-mono tracking-widest uppercase">{t.stealth}</span>
        </div>
        
        {isDetecting && (
          <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 block animate-ping" />
            <span>{t.scanMode}</span>
          </div>
        )}
      </div>

      {/* 2. Main Centered Interactive Area */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8 w-full max-w-sm">
        {/* Faint clock style */}
        <div className="flex flex-col items-center text-center opacity-[0.15] hover:opacity-40 transition-opacity duration-300">
          <h1 className="text-5xl sm:text-6xl font-mono font-bold text-slate-100 tracking-tight mb-2 select-none">
            {currentTime}
          </h1>
          <p className="text-[10px] font-sans text-slate-400 max-w-xs leading-relaxed select-none px-4">
            {lang === 'uk' 
              ? 'Екран у режимі маскування для збереження енергії. Камера та детектор руху працюють у фоновому режимі.'
              : 'Screen is masked to conserve energy. Camera and motion system scan in the background.'}
          </p>
        </div>

        {/* Enlarged Radial Unlock hold action centered */}
        <div className="flex flex-col items-center gap-4">
          <button
            id="unlock-stealth-hold-btn"
            onMouseDown={() => setIsPressing(true)}
            onMouseUp={() => setIsPressing(false)}
            onMouseLeave={() => setIsPressing(false)}
            onTouchStart={(e) => {
              e.preventDefault();
              setIsPressing(true);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              setIsPressing(false);
            }}
            className="relative w-36 h-36 rounded-full border-2 border-slate-900/60 flex flex-col items-center justify-center cursor-pointer select-none ring-0 focus:outline-none focus:ring-0 active:scale-95 transition-all bg-slate-950/40 hover:bg-slate-900/20"
          >
            {/* Circular progress fill border */}
            <div 
              className="absolute inset-[-2px] rounded-full border-4 border-emerald-500/10"
              style={{ 
                clipPath: `inset(${(100 - unlockProgress)}% 0px 0px 0px)`,
                borderColor: 'rgba(16, 185, 129, 0.7)'
              }}
            />

            <Unlock className={`w-8 h-8 transition-all ${isPressing ? 'text-emerald-400 scale-110 drop-shadow-[0_0_10px_rgba(52,211,153,0.3)]' : 'text-slate-800'}`} />
          </button>
          
          <div className="text-center space-y-1.5">
            <p className={`text-xs font-sans font-bold select-none tracking-wide uppercase transition-colors ${isPressing ? 'text-emerald-400 font-extrabold animate-pulse' : 'text-slate-600'}`}>
              {isPressing 
                ? (lang === 'uk' ? 'УТРИМУЙТЕ ДЛЯ ВИХОДУ...' : 'KEEP HOLDING TO EXIT...') 
                : (lang === 'uk' ? 'Натисніть та утримуйте для виходу' : 'Press and hold to exit')}
            </p>
            
            {/* Progress counter */}
            {unlockProgress > 0 && (
              <p className="text-[10px] text-emerald-500 font-mono font-bold">
                {unlockProgress}%
              </p>
            )}
          </div>

          {/* Clean indicator line progress */}
          <div className="w-48 h-1 bg-slate-950/80 rounded-full border border-slate-900 overflow-hidden mt-1">
            <div 
              className="h-full bg-emerald-500/50 transition-all duration-75"
              style={{ width: `${unlockProgress}%` }}
            />
          </div>
        </div>

        {wakeLockError && (
          <div className="flex items-center justify-center gap-1 opacity-[0.06] hover:opacity-20 text-amber-500 text-[9px] font-mono transition-opacity">
            <AlertCircle className="w-3 h-3" />
            <span>
              {lang === 'uk'
                ? 'Wake Lock не підтримується — скасуйте автовимкнення екрана в налагодженні Android.'
                : 'Wake Lock unsupported — please turn off auto-sleep in Android Settings.'}
            </span>
          </div>
        )}
      </div>

      {/* Spacing alignment */}
      <div className="w-full text-center pb-2 opacity-[0.06] text-[8px] font-mono text-slate-500 select-none">
        Galaxy A07 Secure Vault Protection Loop • {lang === 'uk' ? 'ДАТЧИК РУХУ' : 'MOTION_SENSOR'}
      </div>
    </div>
  );
}
