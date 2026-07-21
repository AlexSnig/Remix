import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Download, Headphones, ShieldCheck, SlidersHorizontal, Trash2, Volume2 } from 'lucide-react';
import type { DetectorSettings } from '../types';
import type { Language } from '../utils/lang';
import {
  MotionDetector,
  type NativeAudioRoute,
  type NativeDetectorSnapshot,
  type NativeDiagnostics,
  type NativeKioskState,
  type NativeMotionEvent,
  type NativeSetupReadiness,
} from '../native/motionDetector';

interface NativeDetectorPanelProps {
  lang: Language;
  settings: DetectorSettings;
  onSettingsChange: (settings: DetectorSettings) => void;
  onRuntimeStatusChange: (snapshot: NativeDetectorSnapshot) => void;
}

type StepId = 'camera' | 'audio' | 'route' | 'volume' | 'calibration' | 'motion' | 'kiosk';

const INITIAL_STATUS: NativeDetectorSnapshot = {
  status: 'idle',
  message: 'Готово до запуску',
  motionPercent: 0,
  analyzedFrameCount: 0,
  lastFrameAtMs: 0,
  cooldownRemainingSeconds: 0,
  requiresSoundTest: true,
  updatedAtMs: 0,
  audioRoute: { kind: 'unavailable', deviceId: null, name: null, label: 'Звук недоступний' },
};

const EMPTY_READINESS: NativeSetupReadiness = {
  cameraGranted: false,
  audioImported: false,
  routeVerified: false,
  calibrated: false,
  motionTestPassed: false,
  audioVolume: 100,
};

const BLOCKER_COPY = {
  device_owner_required: { uk: 'потрібен Device Owner', en: 'Device Owner is required' },
  home_launcher_required: { uk: 'APK ще не призначено Home-екраном', en: 'APK is not yet the Home app' },
  lock_task_not_active: { uk: 'Lock Task ще не дозволено', en: 'Lock Task is not allowed yet' },
  secure_lock_requires_first_unlock: { uk: 'при PIN/паролі після повного вимкнення потрібне перше розблокування', en: 'a secure lock requires the first unlock after a cold boot' },
  camera_permission_missing: { uk: 'немає доступу до камери', en: 'camera permission is missing' },
  audio_missing: { uk: 'немає локального аудіофайлу', en: 'local audio is missing' },
  audio_route_not_verified: { uk: 'AUX/Bluetooth-маршрут не перевірено або змінився', en: 'AUX/Bluetooth route is not verified or changed' },
  calibration_missing: { uk: 'не виконано калібрування', en: 'calibration is missing' },
  motion_test_missing: { uk: 'не підтверджено тест руху', en: 'motion test is not confirmed' },
  operator_pin_missing: { uk: 'не задано PIN оператора', en: 'operator PIN is not configured' },
  maintenance_mode_active: { uk: 'активний операторський режим', en: 'operator maintenance mode is active' },
} as const;

const ACTION_ERROR_COPY: Record<string, Record<Language, string>> = {
  CAMERA_PERMISSION_DENIED: {
    uk: 'Доступ до камери не надано. Дозвольте його, щоб продовжити налаштування датчика.',
    en: 'Camera access was not granted. Allow it to continue detector setup.',
  },
  CANCELLED: { uk: 'Імпорт аудіо скасовано.', en: 'Audio import was cancelled.' },
  IMPORT_FAILED: { uk: 'Не вдалося імпортувати локальний аудіофайл.', en: 'The local audio file could not be imported.' },
  MOTION_TEST_NOT_TRIGGERED: { uk: 'Спочатку дочекайтеся реального спрацювання датчика.', en: 'Wait for an actual detector trigger before finishing the test.' },
  INVALID_PIN: { uk: 'PIN має містити від 4 до 12 цифр.', en: 'The PIN must contain 4 to 12 digits.' },
  INCORRECT_PIN: { uk: 'Неправильний PIN оператора.', en: 'The operator PIN is incorrect.' },
  DEVICE_OWNER_REQUIRED: { uk: 'Для цієї дії потрібен режим Device Owner.', en: 'This action requires Device Owner mode.' },
  AUTOSTART_NOT_READY: { uk: 'Автозапуск ще заблокований незавершеними перевірками.', en: 'Auto-start is still blocked by incomplete checks.' },
  LOCK_TASK_FAILED: { uk: 'Не вдалося увімкнути Lock Task.', en: 'Lock Task could not be enabled.' },
  EXPORT_FAILED: { uk: 'Не вдалося експортувати діагностику.', en: 'Diagnostics could not be exported.' },
};

function localizedActionError(error: unknown, lang: Language, fallback: string): string {
  const code = typeof error === 'object' && error && 'code' in error && typeof error.code === 'string'
    ? error.code
    : null;
  if (code && ACTION_ERROR_COPY[code]) return ACTION_ERROR_COPY[code][lang];
  return `${fallback}${code ? ` (${code})` : ''}`;
}

const COPY = {
  uk: {
    title: 'Нативний датчик', subtitle: 'Автономний режим APK · камера та звук керуються Android',
    camera: '1. Камера', cameraAction: 'Надати доступ до камери', cameraDone: 'Доступ до камери надано',
    audio: '2. Локальне аудіо', import: 'Імпортувати аудіо', noAudio: 'Файл ще не вибрано',
    route: '3. Тест маршруту', routeAction: 'Відтворити тест', routeDone: 'Маршрут перевірено',
    routeConfirm: 'Чую звук', routeReject: 'Не чую', routeListening: 'Слухайте колонку та підтвердьте',
    volume: '4. Гучність', saveVolume: 'Зберегти та застосувати', volumeDone: 'Гучність застосовано', calibration: '5. Калібрування',
    calibrate: 'Почати калібрування (10 с)', calibrationDone: 'Калібрування завершено',
    motion: '6. Тест руху', motionAction: 'Почати тест руху', finishMotion: 'Завершити тест', cancelMotion: 'Скасувати тест', motionDone: 'Рух і відтворення підтверджено',
    motionBlocked: 'Спочатку завершіть тест маршруту, збережіть гучність і виконайте калібрування.',
    arm: 'УВІМКНУТИ ДАТЧИК', armed: 'Датчик активний', status: 'Стан системи',
    unavailable: 'Звук недоступний', diagnostics: 'Діагностика', refresh: 'Оновити', export: 'Експорт JSON',
    noDiagnostics: 'Дані діагностики ще не завантажено', preparing: 'Виконується…',
    motionHint: 'Пройдіть перед камерою. Після сигналу натисніть «Завершити тест».',
    armHint: 'Для увімкнення потрібні всі шість перевірок.', routeHint: 'AUX має пріоритет; динамік телефона не використовується.',
    events: 'Події', cameraRestarts: 'Перезапуски камери', errors: 'Помилки', battery: 'Батарея',
    cameraFrames: 'Кадри з камери', cameraLive: 'Камера передає кадри',
    kioskTitle: '7. Kiosk і автозапуск', kioskSubtitle: 'Після вимкнення телефона запуск іде нативно: Device Owner → Home-екран → датчик.',
    deviceOwner: 'Device Owner', homeApp: 'Home app', lockTask: 'Lock Task', kioskLock: 'Kiosk lock',
    deviceOwnerRequired: 'Для реального автозапуску цей телефон потрібно скинути до заводських налаштувань і підготувати APK як Device Owner. На звичайному телефоні датчик після reboot навмисно не стартує у фоні.',
    configureKiosk: 'Налаштувати Home і Lock Task', secureUnlockWarning: 'На телефоні встановлено PIN/пароль. Після повного вимкнення Android вимагатиме перше розблокування, тому «без дотику» не гарантується.',
    createPinHint: 'Створіть PIN оператора (4–12 цифр). Він потрібен, щоб увімкнути чи тимчасово відкрити kiosk.',
    newPin: 'Новий PIN', repeatPin: 'Повторіть PIN', pinMismatch: 'PIN не збігаються.', savePin: 'Зберегти PIN оператора',
    enablePin: 'PIN оператора для увімкнення', enableKiosk: 'Увімкнути kiosk і автозапуск', lastBoot: 'Останній запуск',
    operatorPin: 'PIN оператора', openMaintenance: 'Відкрити операторський режим', disableAutostart: 'Вимкнути автозапуск',
    maintenanceActive: 'Операторський режим активний: автозапуск тимчасово призупинено, Lock Task відкрито.',
    returnPin: 'PIN оператора для повернення kiosk', returnKiosk: 'Повернути kiosk', actionFailed: 'Не вдалося виконати дію',
    eventLog: 'Локальний журнал подій', noEvents: 'Подій ще немає', clearEvents: 'Очистити', deleteEvent: 'Видалити подію',
    clearEventsConfirm: 'Очистити весь локальний журнал подій?', motionValue: 'Рух', thresholdValue: 'Поріг',
    tuning: 'Налаштування детектора', frontCamera: 'Фронтальна камера', rearCamera: 'Задня камера', sensitivity: 'Чутливість',
    cooldownDelay: 'Пауза після сигналу', consecutiveFrames: 'Кадрів для підтвердження', saveTuning: 'Зберегти налаштування',
    stopToTune: 'Щоб змінити параметри камери, спочатку зупиніть датчик.', seconds: 'с',
    bootState: { never: 'ще не перевірено після reboot', started: 'датчик запущено', waiting_for_route: 'очікується перевірений аудіомаршрут', blocked: 'запуск заблоковано перевірками', failed: 'помилка запуску' },
    statusText: { idle: 'Готово до запуску', starting: 'Запуск камери', armed: 'Датчик активний', triggered: 'Рух виявлено', playing: 'Відтворення', cooldown: 'Пауза після сигналу', recovering: 'Відновлення камери', audio_route_lost: 'Аудіомаршрут втрачено', fault: 'Помилка датчика' },
  },
  en: {
    title: 'Native detector', subtitle: 'Offline APK mode · Android owns camera and audio',
    camera: '1. Camera', cameraAction: 'Grant camera access', cameraDone: 'Camera access granted',
    audio: '2. Local audio', import: 'Import audio', noAudio: 'No file selected yet',
    route: '3. Route test', routeAction: 'Play route test', routeDone: 'Route verified',
    routeConfirm: 'I hear sound', routeReject: 'No sound', routeListening: 'Listen to the speaker, then confirm',
    volume: '4. Volume', saveVolume: 'Save and apply', volumeDone: 'Volume applied', calibration: '5. Calibration',
    calibrate: 'Start calibration (10 s)', calibrationDone: 'Calibration complete',
    motion: '6. Motion test', motionAction: 'Start motion test', finishMotion: 'Finish test', cancelMotion: 'Cancel test', motionDone: 'Motion and playback confirmed',
    motionBlocked: 'First complete the route test, save volume, and calibrate.',
    arm: 'ARM DETECTOR', armed: 'Detector armed', status: 'System status',
    unavailable: 'Sound unavailable', diagnostics: 'Diagnostics', refresh: 'Refresh', export: 'Export JSON',
    noDiagnostics: 'Diagnostics have not been loaded yet', preparing: 'Working…',
    motionHint: 'Move in front of the camera. After the signal, tap “Finish test”.',
    armHint: 'All six checks are required before arming.', routeHint: 'AUX takes priority; the phone speaker is never used.',
    events: 'Events', cameraRestarts: 'Camera restarts', errors: 'Errors', battery: 'Battery',
    cameraFrames: 'Camera frames', cameraLive: 'Camera frames are arriving',
    kioskTitle: '7. Kiosk and auto-start', kioskSubtitle: 'After a power cycle Android starts Device Owner → Home app → detector locally.',
    deviceOwner: 'Device Owner', homeApp: 'Home app', lockTask: 'Lock Task', kioskLock: 'Kiosk lock',
    deviceOwnerRequired: 'Reliable auto-start requires a factory reset and Device Owner commissioning. An ordinary installation intentionally does not start the camera service in the background after reboot.',
    configureKiosk: 'Configure Home and Lock Task', secureUnlockWarning: 'This phone has a PIN or password. Android requires the first unlock after a cold boot, so touch-free startup cannot be guaranteed.',
    createPinHint: 'Create a 4–12 digit operator PIN. It is required to enable kiosk mode or enter maintenance.',
    newPin: 'New PIN', repeatPin: 'Repeat PIN', pinMismatch: 'PINs do not match.', savePin: 'Save operator PIN',
    enablePin: 'Operator PIN to enable', enableKiosk: 'Enable kiosk and auto-start', lastBoot: 'Last boot',
    operatorPin: 'Operator PIN', openMaintenance: 'Open operator mode', disableAutostart: 'Disable auto-start',
    maintenanceActive: 'Operator mode is active: auto-start is paused and Lock Task is open.',
    returnPin: 'Operator PIN to restore kiosk', returnKiosk: 'Restore kiosk', actionFailed: 'Action failed',
    eventLog: 'Local event log', noEvents: 'No events yet', clearEvents: 'Clear', deleteEvent: 'Delete event',
    clearEventsConfirm: 'Clear the complete local event log?', motionValue: 'Motion', thresholdValue: 'Threshold',
    tuning: 'Detector settings', frontCamera: 'Front camera', rearCamera: 'Rear camera', sensitivity: 'Sensitivity',
    cooldownDelay: 'Post-playback pause', consecutiveFrames: 'Confirmation frames', saveTuning: 'Save detector settings',
    stopToTune: 'Stop the detector before changing camera settings.', seconds: 's',
    bootState: { never: 'not yet verified after reboot', started: 'detector started', waiting_for_route: 'waiting for the verified audio route', blocked: 'startup blocked by readiness checks', failed: 'startup failed' },
    statusText: { idle: 'Ready to start', starting: 'Starting camera', armed: 'Detector armed', triggered: 'Motion detected', playing: 'Playing audio', cooldown: 'Post-playback pause', recovering: 'Recovering camera', audio_route_lost: 'Audio route lost', fault: 'Detector fault' },
  },
} as const;

function StepCard({ title, complete, children }: { title: string; complete: boolean; children: ReactNode }) {
  return <section className={`rounded-2xl border p-4 ${complete ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-gray-800 bg-[#111111]'}`}>
    <div className="flex items-center gap-2 mb-3 text-left">
      {complete ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <span className="w-4 h-4 rounded-full border border-gray-600" />}
      <h3 className="text-xs font-black tracking-wide text-slate-100 uppercase">{title}</h3>
    </div>
    {children}
  </section>;
}

function RouteBadge({ route, unavailable }: { route: NativeAudioRoute; unavailable: string }) {
  const bad = route.kind === 'unavailable';
  const routeName = route.kind === 'aux' ? 'AUX' : route.name || 'Bluetooth';
  return <div className={`rounded-xl px-3 py-2 text-xs font-bold ${bad ? 'bg-red-500/10 text-red-300 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'}`}>
    <Headphones className="inline-block w-4 h-4 mr-2 -mt-0.5" />{bad ? unavailable : routeName}
  </div>;
}

export default function NativeDetectorPanel({ lang, settings, onSettingsChange, onRuntimeStatusChange }: NativeDetectorPanelProps) {
  const t = COPY[lang];
  const [snapshot, setSnapshot] = useState<NativeDetectorSnapshot>(INITIAL_STATUS);
  const [route, setRoute] = useState<NativeAudioRoute>(INITIAL_STATUS.audioRoute);
  const [readiness, setReadiness] = useState<NativeSetupReadiness>(EMPTY_READINESS);
  const [kioskState, setKioskState] = useState<NativeKioskState | null>(null);
  const [audioName, setAudioName] = useState<string | null>(null);
  const [volumeDraft, setVolumeDraft] = useState(settings.audioVolume);
  const [motionTestRunning, setMotionTestRunning] = useState(false);
  const [motionTestTriggered, setMotionTestTriggered] = useState(false);
  const [soundTestRunning, setSoundTestRunning] = useState(false);
  // Mirrors the native MIN_ROUTE_TEST_MS guard so the operator cannot confirm
  // a route before any sound could have reached the speaker.
  const [soundTestConfirmable, setSoundTestConfirmable] = useState(false);
  const [busy, setBusy] = useState<StepId | 'arm' | 'diagnostics' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<NativeDiagnostics | null>(null);
  const [events, setEvents] = useState<NativeMotionEvent[]>([]);
  const calibrationRunningRef = useRef(false);
  const soundTestRunningRef = useRef(false);
  const motionTestRunningRef = useRef(false);
  const motionStopRequestedRef = useRef(false);
  const lastSnapshotAtMsRef = useRef(0);
  const nativeVolumeLoadedRef = useRef(false);
  const nativeSettingsSnapshotRef = useRef('');
  const [operatorPin, setOperatorPin] = useState('');
  const [operatorPinConfirmation, setOperatorPinConfirmation] = useState('');

  const acceptStatus = useCallback((next: NativeDetectorSnapshot) => {
    if (next.updatedAtMs < lastSnapshotAtMsRef.current) return;
    lastSnapshotAtMsRef.current = next.updatedAtMs;
    setSnapshot(next);
    setRoute(next.audioRoute);
    onRuntimeStatusChange(next);
    if (soundTestRunningRef.current && next.status !== 'playing') {
      // The native service leaves PLAYING once the test is approved, cancelled,
      // or the route dropped. Any of those ends the listening prompt.
      soundTestRunningRef.current = false;
      setSoundTestRunning(false);
      setSoundTestConfirmable(false);
      setBusy(null);
    }
    if (calibrationRunningRef.current && next.status === 'idle') {
      calibrationRunningRef.current = false;
      setBusy(null);
    }
    if (motionTestRunningRef.current && ['idle', 'fault', 'audio_route_lost'].includes(next.status)) {
      const wasStoppedByOperator = motionStopRequestedRef.current;
      motionTestRunningRef.current = false;
      motionStopRequestedRef.current = false;
      setMotionTestRunning(false);
      setBusy(null);
      if (!wasStoppedByOperator) setError(lang === 'uk' ? next.message : t.statusText[next.status]);
    }
    if (motionTestRunningRef.current && ['triggered', 'playing', 'cooldown'].includes(next.status)) setMotionTestTriggered(true);
  }, [lang, onRuntimeStatusChange, t.statusText]);

  const refreshSetup = useCallback(async () => {
    const [nextStatus, nextRoute, setup, kiosk, eventResult, nativeSettings] = await Promise.all([
      MotionDetector.getStatus(), MotionDetector.getAudioRoute(), MotionDetector.getSetupState(),
      MotionDetector.getKioskState(),
      MotionDetector.getEvents({limit: 20}),
      MotionDetector.getSettings(),
    ]);
    acceptStatus(nextStatus);
    setRoute(nextRoute);
    setAudioName(setup.audio?.name ?? null);
    setReadiness(setup.readiness);
    setKioskState(kiosk);
    setEvents(eventResult.events);
    const nativeSettingsSnapshot = JSON.stringify(nativeSettings);
    if (nativeSettingsSnapshot !== nativeSettingsSnapshotRef.current) {
      nativeSettingsSnapshotRef.current = nativeSettingsSnapshot;
      onSettingsChange(nativeSettings);
    }
    if (!nativeVolumeLoadedRef.current) {
      nativeVolumeLoadedRef.current = true;
      setVolumeDraft(setup.readiness.audioVolume);
    }
  }, [acceptStatus, onSettingsChange]);

  useEffect(() => {
    let cancelled = false;
    let listener: { remove: () => Promise<void> } | undefined;
    const refreshStatus = () => {
      refreshSetup().catch(error => {
        if (!cancelled) setError(error.message ?? String(error));
      });
    };
    refreshSetup().catch(error => !cancelled && setError(error.message ?? String(error)));
    MotionDetector.addListener('statusChanged', acceptStatus).then(handle => {
      if (cancelled) handle.remove(); else listener = handle;
    }).catch(error => !cancelled && setError(error.message ?? String(error)));
    const interval = window.setInterval(refreshStatus, 5_000);
    const onVisibilityChange = () => { if (!document.hidden) refreshStatus(); };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      listener?.remove();
    };
  }, [acceptStatus, refreshSetup]);

  useEffect(() => {
    setVolumeDraft(settings.audioVolume);
  }, [settings.audioVolume]);

  const run = async (action: StepId | 'arm' | 'diagnostics', work: () => Promise<void>) => {
    setError(null); setBusy(action);
    try { await work(); } catch (error) {
      console.warn('Native detector action failed:', error);
      setError(localizedActionError(error, lang, t.actionFailed));
      setBusy(null);
    }
  };

  const saveVolume = async () => {
    const next = { ...settings, audioVolume: volumeDraft };
    onSettingsChange(next);
    await MotionDetector.saveSettings({ settings: next });
    await refreshSetup();
  };
  const cameraGranted = readiness.cameraGranted;
  const soundVerified = readiness.routeVerified;
  const volumeSaved = readiness.audioVolume === volumeDraft;
  const calibrated = readiness.calibrated;
  const motionTestPassed = readiness.motionTestPassed;
  const motionSetupComplete = cameraGranted && readiness.audioImported && soundVerified && volumeSaved && calibrated;
  const checksComplete = motionSetupComplete && motionTestPassed;
  const statusIsArmed = snapshot.status === 'armed';
  const detectorIsRunning = ['starting', 'armed', 'triggered', 'playing', 'cooldown', 'recovering'].includes(snapshot.status);
  const pinIsValid = /^\d{4,12}$/.test(operatorPin);
  const pinMatches = operatorPin === operatorPinConfirmation;
  const kioskBlockers = kioskState?.blockers ?? [];
  const blockerText = (blocker: keyof typeof BLOCKER_COPY) => BLOCKER_COPY[blocker][lang];
  const eventDateFormatter = useMemo(() => new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-US', {dateStyle: 'short', timeStyle: 'medium'}), [lang]);

  return <div className="max-w-2xl mx-auto space-y-4 animate-fade-in" data-testid="native-detector-panel">
    <header className="rounded-3xl border border-[#F27D26]/30 bg-[#F27D26]/5 p-5 text-left">
      <p className="text-xs font-black tracking-widest uppercase text-[#F27D26]">{t.title}</p>
      <p className="text-xs text-slate-400 mt-2">{t.subtitle}</p>
    </header>

    <section className="rounded-2xl border border-gray-800 bg-[#111111] p-4 text-left">
      <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">{t.status}</p>
      <div className="flex items-start justify-between gap-3">
        <div><p className={`text-sm font-black ${snapshot.status === 'fault' || snapshot.status === 'audio_route_lost' ? 'text-red-300' : 'text-slate-100'}`}>{t.statusText[snapshot.status]}</p>
          <p className="text-xs text-gray-500 mt-1">{snapshot.motionPercent.toFixed(1)}%</p></div>
        <RouteBadge route={route} unavailable={t.unavailable} />
      </div>
      <p className="text-xs text-slate-300 mt-3" data-testid="native-status-message">{lang === 'uk' ? snapshot.message : t.statusText[snapshot.status]}</p>
      {snapshot.analyzedFrameCount > 0 && snapshot.status !== 'idle' && <p className="text-[10px] text-emerald-300 mt-2">{t.cameraLive} · {snapshot.analyzedFrameCount}</p>}
      <p className="text-[10px] text-gray-500 mt-3">{t.routeHint}</p>
    </section>

    {error && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200"><AlertTriangle className="inline-block w-4 h-4 mr-2" />{error}</div>}

    <div className="grid gap-3 sm:grid-cols-2">
      <StepCard title={t.camera} complete={cameraGranted}>
        <button type="button" onClick={() => run('camera', async () => { await MotionDetector.requestCameraPermission(); await refreshSetup(); setBusy(null); })} className="native-action">{busy === 'camera' ? t.preparing : cameraGranted ? t.cameraDone : t.cameraAction}</button>
      </StepCard>
      <StepCard title={t.audio} complete={Boolean(audioName)}>
        <p className="text-xs text-gray-400 truncate mb-3">{audioName ?? t.noAudio}</p>
        <button type="button" onClick={() => run('audio', async () => { const audio = await MotionDetector.importAudio(); const next = { ...settings, audioSourceType: 'custom' as const, customAudioId: audio.id }; onSettingsChange(next); await MotionDetector.saveSettings({ settings: next }); setAudioName(audio.name); await refreshSetup(); setBusy(null); })} className="native-action">{busy === 'audio' ? t.preparing : t.import}</button>
      </StepCard>
      <StepCard title={t.route} complete={soundVerified}>
        <RouteBadge route={route} unavailable={t.unavailable} />
        {soundTestRunning ? (
          <>
            <p className="text-[10px] text-amber-300 mt-3">{t.routeListening}</p>
            <div className="grid gap-2 sm:grid-cols-2 mt-2">
              <button type="button" disabled={!soundTestConfirmable} onClick={() => run('route', async () => { await MotionDetector.confirmAudioRoute(); })} className="native-action">{t.routeConfirm}</button>
              <button type="button" onClick={() => run('route', async () => { await MotionDetector.cancelAudioTest(); })} className="native-action">{t.routeReject}</button>
            </div>
          </>
        ) : (
          <button disabled={route.kind === 'unavailable'} type="button" onClick={() => run('route', async () => {
            soundTestRunningRef.current = true;
            setSoundTestRunning(true);
            setSoundTestConfirmable(false);
            window.setTimeout(() => setSoundTestConfirmable(true), 3000);
            await MotionDetector.playTest();
          })} className="native-action mt-3">{busy === 'route' ? t.preparing : soundVerified ? t.routeDone : t.routeAction}</button>
        )}
      </StepCard>
      <StepCard title={t.volume} complete={volumeSaved}>
        <div className="flex items-center gap-3"><Volume2 className="w-4 h-4 text-[#F27D26]" /><input aria-label={t.volume} type="range" min="0" max="100" value={volumeDraft} onChange={event => setVolumeDraft(Number(event.target.value))} className="flex-1 accent-[#F27D26]" /><span className="w-9 text-right text-xs font-mono">{volumeDraft}%</span></div>
        <button type="button" onClick={() => run('volume', async () => { await saveVolume(); setBusy(null); })} className="native-action mt-3">{busy === 'volume' ? t.preparing : t.saveVolume}</button>
        <p className="text-[10px] text-gray-500 mt-3">{volumeSaved ? t.volumeDone : ''}</p>
      </StepCard>
      <StepCard title={t.calibration} complete={calibrated}>
        <button type="button" onClick={() => run('calibration', async () => { calibrationRunningRef.current = true; await MotionDetector.calibrate(); })} className="native-action">{busy === 'calibration' ? t.preparing : calibrated ? t.calibrationDone : t.calibrate}</button>
      </StepCard>
      <StepCard title={t.motion} complete={motionTestPassed}>
        <p className="text-[10px] text-gray-500 mb-3">{t.motionHint}</p>
        {!motionTestRunning && !motionSetupComplete && <p className="text-[10px] text-amber-300 mb-3">{t.motionBlocked}</p>}
        {motionTestRunning ? <div className="grid gap-2 sm:grid-cols-2"><button type="button" disabled={!motionTestTriggered} onClick={() => run('motion', async () => { motionStopRequestedRef.current = true; await MotionDetector.finishMotionTest(); motionTestRunningRef.current = false; setMotionTestRunning(false); await refreshSetup(); setBusy(null); })} className="native-action">{t.finishMotion}</button><button type="button" onClick={() => run('motion', async () => { motionStopRequestedRef.current = true; await MotionDetector.stop(); motionTestRunningRef.current = false; setMotionTestRunning(false); setMotionTestTriggered(false); setBusy(null); })} className="native-action">{t.cancelMotion}</button></div> : <button disabled={!motionSetupComplete} type="button" onClick={() => run('motion', async () => { motionStopRequestedRef.current = false; setMotionTestTriggered(false); motionTestRunningRef.current = true; setMotionTestRunning(true); try { await MotionDetector.start(); setBusy(null); } catch (error) { motionTestRunningRef.current = false; setMotionTestRunning(false); throw error; } })} className="native-action">{busy === 'motion' ? t.preparing : motionTestPassed ? t.motionDone : t.motionAction}</button>}
      </StepCard>
    </div>

    <section className="rounded-2xl border border-gray-800 bg-[#111111] p-4 text-left">
      <p className="text-xs font-black uppercase tracking-wide">{t.tuning}</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" disabled={detectorIsRunning} onClick={() => onSettingsChange({...settings, cameraFacingMode: 'user'})} className={`native-action ${settings.cameraFacingMode === 'user' ? 'border-[#F27D26] bg-[#F27D26]/20' : ''}`}>{t.frontCamera}</button>
        <button type="button" disabled={detectorIsRunning} onClick={() => onSettingsChange({...settings, cameraFacingMode: 'environment'})} className={`native-action ${settings.cameraFacingMode === 'environment' ? 'border-[#F27D26] bg-[#F27D26]/20' : ''}`}>{t.rearCamera}</button>
      </div>
      <label className="block mt-4 text-[10px] text-gray-400"><span className="flex justify-between"><span>{t.sensitivity}</span><span>{settings.sensitivity}%</span></span><input disabled={detectorIsRunning} type="range" min="1" max="100" value={settings.sensitivity} onChange={event => onSettingsChange({...settings, sensitivity: Number(event.target.value)})} className="mt-2 w-full accent-[#F27D26]" /></label>
      <label className="block mt-4 text-[10px] text-gray-400"><span className="flex justify-between"><span>{t.cooldownDelay}</span><span>{settings.coolDownDelay} {t.seconds}</span></span><input disabled={detectorIsRunning} type="range" min="2" max="60" value={settings.coolDownDelay} onChange={event => onSettingsChange({...settings, coolDownDelay: Number(event.target.value)})} className="mt-2 w-full accent-[#F27D26]" /></label>
      <label className="block mt-4 text-[10px] text-gray-400"><span className="flex justify-between"><span>{t.consecutiveFrames}</span><span>{settings.requiredConsecutiveFrames}</span></span><input disabled={detectorIsRunning} type="range" min="1" max="5" value={settings.requiredConsecutiveFrames} onChange={event => onSettingsChange({...settings, requiredConsecutiveFrames: Number(event.target.value)})} className="mt-2 w-full accent-[#F27D26]" /></label>
      {detectorIsRunning && <p className="mt-3 text-[10px] text-amber-300">{t.stopToTune}</p>}
      <button type="button" disabled={detectorIsRunning} onClick={() => void run('volume', async () => { await MotionDetector.saveSettings({settings}); nativeSettingsSnapshotRef.current = JSON.stringify(settings); await refreshSetup(); setBusy(null); })} className="native-action mt-4">{busy === 'volume' ? t.preparing : t.saveTuning}</button>
    </section>

    <section className={`rounded-3xl border p-5 text-left ${kioskState?.autoStartAfterRebootEnabled ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-gray-800 bg-[#111111]'}`}>
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-xs font-black uppercase tracking-wide text-slate-100">{t.kioskTitle}</p>
          <p className="text-[10px] text-gray-500 mt-1">{t.kioskSubtitle}</p></div>
        {kioskState?.autoStartAfterRebootEnabled ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" /> : <ShieldCheck className="w-5 h-5 text-[#F27D26] shrink-0" />}
      </div>

      {!kioskState ? <p className="text-xs text-gray-400 mt-4">{t.preparing}</p> : <>
        <div className="grid grid-cols-2 gap-2 mt-4 text-[10px]">
          <p className={kioskState.isDeviceOwner ? 'text-emerald-300' : 'text-red-300'}>{kioskState.isDeviceOwner ? '✓' : '•'} {t.deviceOwner}</p>
          <p className={kioskState.isDefaultHomeApp ? 'text-emerald-300' : 'text-amber-300'}>{kioskState.isDefaultHomeApp ? '✓' : '•'} {t.homeApp}</p>
          <p className={kioskState.isLockTaskAllowed ? 'text-emerald-300' : 'text-amber-300'}>{kioskState.isLockTaskAllowed ? '✓' : '•'} {t.lockTask}</p>
          <p className={kioskState.isLockTaskActive ? 'text-emerald-300' : 'text-gray-400'}>{kioskState.isLockTaskActive ? '✓' : '•'} {t.kioskLock}</p>
        </div>

        {!kioskState.isDeviceOwner && <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-200">{t.deviceOwnerRequired}</p>}
        {kioskState.isDeviceOwner && !kioskState.isDefaultHomeApp && <button type="button" onClick={() => run('kiosk', async () => { setKioskState(await MotionDetector.configureKiosk()); setBusy(null); })} className="native-action mt-4">{busy === 'kiosk' ? t.preparing : t.configureKiosk}</button>}

        {kioskState.requiresFirstUnlock && <p className="mt-3 text-[11px] text-red-300">{t.secureUnlockWarning}</p>}

        {kioskBlockers.length > 0 && <ul className="mt-4 space-y-1 text-[11px] text-amber-200 list-disc pl-4">
          {kioskBlockers.map(blocker => <li key={blocker}>{blockerText(blocker)}</li>)}
        </ul>}

        {!kioskState.operatorPinConfigured && <div className="mt-4 space-y-2">
          <p className="text-[11px] text-slate-300">{t.createPinHint}</p>
          <input value={operatorPin} onChange={event => setOperatorPin(event.target.value.replace(/\D/g, '').slice(0, 12))} inputMode="numeric" type="password" autoComplete="new-password" placeholder={t.newPin} className="native-input" />
          <input value={operatorPinConfirmation} onChange={event => setOperatorPinConfirmation(event.target.value.replace(/\D/g, '').slice(0, 12))} inputMode="numeric" type="password" autoComplete="new-password" placeholder={t.repeatPin} className="native-input" />
          {!pinMatches && operatorPinConfirmation && <p className="text-[10px] text-red-300">{t.pinMismatch}</p>}
          <button disabled={!pinIsValid || !pinMatches} type="button" onClick={() => run('kiosk', async () => { await MotionDetector.setOperatorPin({ pin: operatorPin }); setOperatorPin(''); setOperatorPinConfirmation(''); await refreshSetup(); setBusy(null); })} className="native-action">{busy === 'kiosk' ? t.preparing : t.savePin}</button>
        </div>}

        {kioskState.operatorPinConfigured && !kioskState.autoStartAfterRebootEnabled && !kioskState.maintenanceMode && <div className="mt-4 space-y-2">
          <input value={operatorPin} onChange={event => setOperatorPin(event.target.value.replace(/\D/g, '').slice(0, 12))} inputMode="numeric" type="password" autoComplete="current-password" placeholder={t.enablePin} className="native-input" />
          <button disabled={!pinIsValid || !kioskState.autoStartReady} type="button" onClick={() => run('kiosk', async () => { setKioskState(await MotionDetector.setAutoStartAfterReboot({ enabled: true, operatorPin })); setOperatorPin(''); setBusy(null); })} className="native-action">{busy === 'kiosk' ? t.preparing : t.enableKiosk}</button>
        </div>}

        {kioskState.autoStartAfterRebootEnabled && !kioskState.maintenanceMode && <div className="mt-4 space-y-2">
          <p className="text-[11px] text-emerald-200">{t.lastBoot}: {lang === 'uk' ? kioskState.lastBootStartMessage : t.bootState[kioskState.lastBootStartState]}</p>
          <input value={operatorPin} onChange={event => setOperatorPin(event.target.value.replace(/\D/g, '').slice(0, 12))} inputMode="numeric" type="password" autoComplete="current-password" placeholder={t.operatorPin} className="native-input" />
          <div className="grid gap-2 sm:grid-cols-2"><button disabled={!pinIsValid} type="button" onClick={() => run('kiosk', async () => { setKioskState(await MotionDetector.unlockKiosk({ pin: operatorPin })); setOperatorPin(''); setBusy(null); })} className="native-action">{t.openMaintenance}</button><button disabled={!pinIsValid} type="button" onClick={() => run('kiosk', async () => { setKioskState(await MotionDetector.setAutoStartAfterReboot({ enabled: false, operatorPin })); setOperatorPin(''); setBusy(null); })} className="native-action">{t.disableAutostart}</button></div>
        </div>}

        {kioskState.maintenanceMode && <div className="mt-4 space-y-2"><p className="text-[11px] text-amber-200">{t.maintenanceActive}</p><input value={operatorPin} onChange={event => setOperatorPin(event.target.value.replace(/\D/g, '').slice(0, 12))} inputMode="numeric" type="password" autoComplete="current-password" placeholder={t.returnPin} className="native-input" /><button disabled={!pinIsValid} type="button" onClick={() => run('kiosk', async () => { setKioskState(await MotionDetector.lockKiosk({ operatorPin })); setOperatorPin(''); setBusy(null); })} className="native-action">{t.returnKiosk}</button></div>}
      </>}
    </section>

    <section className="rounded-3xl border border-gray-800 bg-[#111111] p-5 text-left">
      <button disabled={!checksComplete || statusIsArmed} type="button" onClick={() => run('arm', async () => { await MotionDetector.start(); setBusy(null); })} className="w-full h-14 rounded-2xl bg-[#F27D26] text-black text-xs font-black tracking-widest disabled:opacity-35 disabled:cursor-not-allowed flex items-center justify-center gap-2"><ShieldCheck className="w-5 h-5" />{busy === 'arm' ? t.preparing : statusIsArmed ? t.armed : t.arm}</button>
      {!checksComplete && <p className="text-center text-[10px] text-gray-500 mt-3">{t.armHint}</p>}
    </section>

    <section className="rounded-2xl border border-gray-800 bg-[#111111] p-4 text-left">
      <div className="flex justify-between gap-2 items-center"><p className="text-xs font-black uppercase tracking-wide">{t.diagnostics}</p><div className="flex gap-2"><button type="button" onClick={() => run('diagnostics', async () => { setDiagnostics(await MotionDetector.getDiagnostics()); setBusy(null); })} className="native-icon-action" title={t.refresh}><SlidersHorizontal className="w-4 h-4" /></button><button type="button" onClick={() => run('diagnostics', async () => { await MotionDetector.exportDiagnostics(); setBusy(null); })} className="native-icon-action" title={t.export}><Download className="w-4 h-4" /></button></div></div>
      {diagnostics ? <dl className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 text-[10px] text-gray-400"><dt>{t.events}</dt><dd className="text-right text-slate-200">{diagnostics.eventCount}</dd><dt>{t.cameraFrames}</dt><dd className="text-right text-slate-200">{diagnostics.analyzedFrameCount}</dd><dt>{t.cameraRestarts}</dt><dd className="text-right text-slate-200">{diagnostics.cameraRestarts}</dd><dt>{t.errors}</dt><dd className="text-right text-slate-200">{diagnostics.errors}</dd><dt>{t.battery}</dt><dd className="text-right text-slate-200">{diagnostics.batteryPercent == null ? '—' : `${diagnostics.batteryPercent}%`}</dd></dl> : <p className="text-[10px] text-gray-500 mt-3">{t.noDiagnostics}</p>}
    </section>

    <section className="rounded-2xl border border-gray-800 bg-[#111111] p-4 text-left">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-wide">{t.eventLog}</p>
        <button
          type="button"
          disabled={events.length === 0}
          onClick={() => {
            if (!window.confirm(t.clearEventsConfirm)) return;
            void run('diagnostics', async () => {
              await MotionDetector.clearEvents();
              setEvents([]);
              setDiagnostics(previous => previous ? {...previous, eventCount: 0} : previous);
              setBusy(null);
            });
          }}
          className="native-icon-action disabled:opacity-30"
          title={t.clearEvents}
          aria-label={t.clearEvents}
        ><Trash2 className="w-4 h-4" /></button>
      </div>
      {events.length === 0 ? <p className="text-[10px] text-gray-500 mt-3">{t.noEvents}</p> : (
        <ul className="mt-3 divide-y divide-gray-800">
          {events.map(event => <li key={event.id} className="py-3 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-slate-200">{eventDateFormatter.format(event.timestampMs)}</p>
              <p className="mt-1 text-[10px] text-gray-500">{t.motionValue}: {event.motionPercent.toFixed(1)}% · {t.thresholdValue}: {event.threshold.toFixed(1)}%</p>
            </div>
            <button
              type="button"
              onClick={() => void run('diagnostics', async () => {
                await MotionDetector.deleteEvent({id: event.id});
                setEvents(previous => previous.filter(item => item.id !== event.id));
                setDiagnostics(previous => previous ? {...previous, eventCount: Math.max(0, previous.eventCount - 1)} : previous);
                setBusy(null);
              })}
              className="native-icon-action shrink-0"
              title={t.deleteEvent}
              aria-label={t.deleteEvent}
            ><Trash2 className="w-4 h-4" /></button>
          </li>)}
        </ul>
      )}
    </section>
  </div>;
}
