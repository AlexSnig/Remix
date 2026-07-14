import {Music, Settings2} from 'lucide-react';
import {CustomAudioFile, DetectorSettings} from '../types';
import {Language} from '../utils/lang';

interface MinimalFilesListProps {
  settings: DetectorSettings;
  onSettingsChange: (settings: DetectorSettings) => void;
  onCustomAudioSaved: (audio: CustomAudioFile | null) => void;
  lang: Language;
  onOpenAudioSourceModal: () => void;
}

export default function MinimalFilesList({settings, lang, onOpenAudioSourceModal}: MinimalFilesListProps) {
  const customSelected = settings.audioSourceType === 'custom' && settings.customAudioId;
  return (
    <div className="bg-[#111111] border border-gray-800 rounded-3xl p-4 max-w-sm mx-auto flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-[#F27D26]/10 flex items-center justify-center">
        <Music className="w-5 h-5 text-[#F27D26]" />
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-[10px] uppercase tracking-wider text-gray-500">{lang === 'uk' ? 'Активне аудіо' : 'Active audio'}</p>
        <p className="text-xs font-bold text-gray-200 truncate">{customSelected ? (lang === 'uk' ? 'Локальний файл' : 'Local file') : (lang === 'uk' ? 'Короткий сигнал' : 'Short beep')}</p>
      </div>
      <button type="button" onClick={onOpenAudioSourceModal} className="h-10 px-3 rounded-xl bg-gray-800 text-xs font-bold flex items-center gap-2">
        <Settings2 className="w-4 h-4 text-[#F27D26]" />
        {lang === 'uk' ? 'Змінити' : 'Change'}
      </button>
    </div>
  );
}
