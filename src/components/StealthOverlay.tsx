import {useEffect, useRef, useState} from 'react';
import {EyeOff, Unlock} from 'lucide-react';
import {TRANSLATIONS, Language} from '../utils/lang';

interface StealthOverlayProps {
  onClose: () => void;
  isDetecting: boolean;
  lang: Language;
}

export default function StealthOverlay({onClose, isDetecting, lang}: StealthOverlayProps) {
  const [unlockProgress, setUnlockProgress] = useState(0);
  const [isPressing, setIsPressing] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onCloseRef = useRef(onClose);
  const t = TRANSLATIONS[lang];

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const update = () => setCurrentTime(new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}));
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isPressing) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setUnlockProgress(0);
      return;
    }
    intervalRef.current = setInterval(() => {
      setUnlockProgress(previous => {
        if (previous >= 90) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          onCloseRef.current();
          return 100;
        }
        return previous + 10;
      });
    }, 100);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPressing]);

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-between p-6 select-none animate-fade-in" style={{touchAction: 'none'}}>
      <div className="w-full flex justify-between items-center opacity-10">
        <div className="flex items-center gap-2 text-white"><EyeOff className="w-4 h-4" /><span className="text-[10px] font-mono">{t.stealth}</span></div>
        {isDetecting && <span className="text-[10px] text-emerald-400 font-mono">● {t.scanMode}</span>}
      </div>
      <div className="flex flex-col items-center gap-10">
        <div className="text-center opacity-15"><p className="text-6xl font-mono font-bold">{currentTime}</p><p className="mt-2 text-[10px] text-gray-400">{lang === 'uk' ? 'Камера працює в енергоощадному режимі' : 'Camera is running in low-power mode'}</p></div>
        <button
          id="unlock-stealth-hold-btn"
          type="button"
          onPointerDown={event => {event.currentTarget.setPointerCapture(event.pointerId); setIsPressing(true);}}
          onPointerUp={() => setIsPressing(false)}
          onPointerCancel={() => setIsPressing(false)}
          className="relative w-36 h-36 rounded-full border-2 border-gray-900 flex items-center justify-center bg-gray-950/40"
        >
          <div className="absolute bottom-0 left-0 right-0 bg-emerald-500/10 rounded-b-full" style={{height: `${unlockProgress}%`}} />
          <Unlock className={`relative w-8 h-8 ${isPressing ? 'text-emerald-400' : 'text-gray-800'}`} />
        </button>
        <p className="text-xs text-gray-700 uppercase">{lang === 'uk' ? 'Утримуйте для виходу' : 'Hold to exit'}</p>
      </div>
      <div />
    </div>
  );
}
