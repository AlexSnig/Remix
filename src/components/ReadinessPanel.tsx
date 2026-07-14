import {AlertTriangle, CheckCircle2, XCircle} from 'lucide-react';
import {ReadinessCheck} from '../types';
import {Language} from '../utils/lang';

export default function ReadinessPanel({checks, lang}: {checks: ReadinessCheck[]; lang: Language}) {
  if (checks.length === 0) return null;
  return (
    <div className="w-full max-w-sm mx-auto px-4 mt-3 grid grid-cols-2 gap-2" aria-label={lang === 'uk' ? 'Стан системи' : 'System status'}>
      {checks.map(check => (
        <div key={check.id} title={check.message} className={`min-h-9 rounded-xl border px-2.5 py-2 flex items-center gap-2 text-[9px] font-bold ${check.status === 'pass' ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400' : check.status === 'warning' ? 'border-amber-500/20 bg-amber-500/5 text-amber-400' : 'border-red-500/25 bg-red-500/10 text-red-400'}`}>
          {check.status === 'pass' ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : check.status === 'warning' ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> : <XCircle className="w-3.5 h-3.5 shrink-0" />}
          <span className="truncate">{check.message}</span>
        </div>
      ))}
    </div>
  );
}
