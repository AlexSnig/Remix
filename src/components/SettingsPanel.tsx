import {Camera, Database, Gauge, Settings, Volume2} from 'lucide-react';
import {CustomAudioFile, DetectorSettings} from '../types';
import {Language} from '../utils/lang';
import AudioLibrary from './AudioLibrary';

interface SettingsPanelProps {
  settings: DetectorSettings;
  onSettingsChange: (settings: DetectorSettings) => void;
  onCustomAudioSaved: (audio: CustomAudioFile | null) => void;
  lang: Language;
  showOnly?: 'settings' | 'audio';
}

export default function SettingsPanel({settings, onSettingsChange, onCustomAudioSaved, lang, showOnly}: SettingsPanelProps) {
  const uk = lang === 'uk';
  const setNumber = (key: keyof DetectorSettings, value: number) => onSettingsChange({...settings, [key]: value});

  if (showOnly === 'audio') {
    return <AudioLibrary settings={settings} onSettingsChange={onSettingsChange} onCustomAudioSaved={onCustomAudioSaved} lang={lang} />;
  }

  return (
    <div className="space-y-5 text-left">
      <section className="space-y-4">
        <h2 className="text-sm font-black text-white flex items-center gap-2"><Settings className="w-4 h-4 text-[#F27D26]" />{uk ? 'Основні налаштування' : 'Core settings'}</h2>
        <label className="block space-y-2">
          <span className="text-xs text-gray-300 flex justify-between"><span>{uk ? 'Чутливість' : 'Sensitivity'}</span><b>{settings.sensitivity}%</b></span>
          <input type="range" min="1" max="100" value={settings.sensitivity} onChange={event => setNumber('sensitivity', Number(event.target.value))} className="w-full accent-[#F27D26]" />
        </label>
        <label className="block space-y-2">
          <span className="text-xs text-gray-300 flex justify-between"><span>{uk ? 'Поріг руху' : 'Motion threshold'}</span><b>{settings.noiseThreshold.toFixed(1)}%</b></span>
          <input type="range" min="0.1" max="10" step="0.1" value={settings.noiseThreshold} onChange={event => setNumber('noiseThreshold', Number(event.target.value))} className="w-full accent-[#F27D26]" />
        </label>
        <label className="block space-y-2">
          <span className="text-xs text-gray-300 flex justify-between"><span>{uk ? 'Пауза після сигналу' : 'Cooldown after audio'}</span><b>{settings.coolDownDelay}s</b></span>
          <input type="range" min="2" max="60" value={settings.coolDownDelay} onChange={event => setNumber('coolDownDelay', Number(event.target.value))} className="w-full accent-[#F27D26]" />
        </label>
      </section>

      <section className="space-y-3 border-t border-gray-800 pt-4">
        <h2 className="text-sm font-black text-white flex items-center gap-2"><Camera className="w-4 h-4 text-[#F27D26]" />{uk ? 'Камера' : 'Camera'}</h2>
        <div className="grid grid-cols-2 gap-2">
          {(['user', 'environment'] as const).map(mode => (
            <button key={mode} type="button" onClick={() => onSettingsChange({...settings, cameraFacingMode: mode})} className={`h-11 rounded-xl text-xs font-bold border ${settings.cameraFacingMode === mode ? 'bg-[#F27D26] text-black border-[#F27D26]' : 'bg-black/30 border-gray-800 text-gray-300'}`}>
              {mode === 'user' ? (uk ? 'Фронтальна' : 'Front') : (uk ? 'Основна' : 'Rear')}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3 border-t border-gray-800 pt-4">
        <h2 className="text-sm font-black text-white flex items-center gap-2"><Volume2 className="w-4 h-4 text-[#F27D26]" />{uk ? 'Гучність' : 'Volume'}</h2>
        <input type="range" min="0" max="100" value={settings.audioVolume} onChange={event => setNumber('audioVolume', Number(event.target.value))} className="w-full accent-[#F27D26]" />
      </section>

      <section className="space-y-3 border-t border-gray-800 pt-4">
        <h2 className="text-sm font-black text-white flex items-center gap-2"><Database className="w-4 h-4 text-[#F27D26]" />{uk ? 'Сховище' : 'Storage'}</h2>
        <label className="flex items-center justify-between gap-4 text-xs text-gray-300">
          <span>{uk ? 'Автоматично обмежувати журнал' : 'Limit event log automatically'}</span>
          <input type="checkbox" checked={settings.autoCleanCacheEnabled} onChange={event => onSettingsChange({...settings, autoCleanCacheEnabled: event.target.checked})} className="accent-[#F27D26]" />
        </label>
        <label className="block space-y-2">
          <span className="text-xs text-gray-300 flex justify-between"><span>{uk ? 'Зберігати подій' : 'Keep events'}</span><b>{settings.maxCacheLogsCount}</b></span>
          <input type="range" min="5" max="100" step="5" value={settings.maxCacheLogsCount} onChange={event => setNumber('maxCacheLogsCount', Number(event.target.value))} className="w-full accent-[#F27D26]" />
        </label>
      </section>

      <section className="space-y-3 border-t border-gray-800 pt-4">
        <h2 className="text-sm font-black text-white flex items-center gap-2"><Gauge className="w-4 h-4 text-[#F27D26]" />{uk ? 'Надійність' : 'Reliability'}</h2>
        <label className="flex items-center justify-between gap-4 text-xs text-gray-300">
          <span>{uk ? 'Kiosk-режим під час запуску' : 'Kiosk gate on startup'}</span>
          <input type="checkbox" checked={settings.kioskModeEnabled} onChange={event => onSettingsChange({...settings, kioskModeEnabled: event.target.checked})} className="accent-[#F27D26]" />
        </label>
        <div className="space-y-2">
          <span className="text-xs text-gray-300">{uk ? 'Зона детекції' : 'Detection zone'}</span>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => onSettingsChange({...settings, detectionZone: {x: 0, y: 0, width: 1, height: 1}})} className={`h-10 rounded-xl border text-[10px] font-bold ${settings.detectionZone.width === 1 ? 'border-[#F27D26] text-[#F27D26] bg-[#F27D26]/10' : 'border-gray-800 text-gray-400'}`}>{uk ? 'ВЕСЬ КАДР' : 'FULL FRAME'}</button>
            <button type="button" onClick={() => onSettingsChange({...settings, detectionZone: {x: 0.2, y: 0.15, width: 0.6, height: 0.7}})} className={`h-10 rounded-xl border text-[10px] font-bold ${settings.detectionZone.width === 0.6 ? 'border-[#F27D26] text-[#F27D26] bg-[#F27D26]/10' : 'border-gray-800 text-gray-400'}`}>{uk ? 'ЦЕНТР КАДРУ' : 'CENTER AREA'}</button>
          </div>
        </div>
        <p className="text-[10px] leading-relaxed text-gray-500">{uk ? 'Глобальні зміни освітлення понад 70% ігноруються. Спрацювання підтверджується двома кадрами.' : 'Global lighting changes over 70% are ignored. Motion requires two frames.'}</p>
      </section>
    </div>
  );
}
