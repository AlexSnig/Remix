import {useEffect, useState} from 'react';
import {RefreshCw, X} from 'lucide-react';
import {Language} from '../utils/lang';
import {subscribeToPwaUpdate} from '../utils/pwa';

export default function PwaUpdatePrompt({canUpdate, lang}: {canUpdate: boolean; lang: Language}) {
  const [update, setUpdate] = useState<(() => Promise<void>) | null>(null);

  useEffect(() => subscribeToPwaUpdate(handler => setUpdate(() => handler)), []);

  if (!update) return null;
  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:max-w-sm z-[250] rounded-2xl border border-[#F27D26]/30 bg-[#111] p-4 shadow-2xl">
      <p className="text-xs font-bold text-white">{lang === 'uk' ? 'Доступна нова версія' : 'A new version is available'}</p>
      <p className="mt-1 text-[10px] text-gray-400">{canUpdate ? (lang === 'uk' ? 'Оновлення готове до встановлення.' : 'The update is ready to install.') : (lang === 'uk' ? 'Спочатку вимкніть датчик.' : 'Turn off the sensor first.')}</p>
      <div className="mt-3 flex gap-2">
        <button type="button" disabled={!canUpdate} onClick={() => update()} className="flex-1 h-10 rounded-xl bg-[#F27D26] text-black text-xs font-black disabled:opacity-40 flex items-center justify-center gap-2"><RefreshCw className="w-4 h-4" />{lang === 'uk' ? 'ОНОВИТИ' : 'UPDATE'}</button>
        <button type="button" aria-label="Dismiss update" onClick={() => setUpdate(null)} className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center"><X className="w-4 h-4" /></button>
      </div>
    </div>
  );
}
