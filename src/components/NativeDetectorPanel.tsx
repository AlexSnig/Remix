import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, Bluetooth, CheckCircle2, Download, Headphones, ShieldCheck, SlidersHorizontal, Trash2, Volume2 } from 'lucide-react';
import type { DetectionZone, DetectorSettings } from '../types';
import type { Language } from '../utils/lang';
import { canOpenOperatorMode, restoreKioskWithVerification } from '../utils/kioskTransition';
import {
  MotionDetector,
  type NativeAudioRoute,
  type NativeDetectorSnapshot,
  type NativeDiagnostics,
  type NativeKioskState,
  type NativeMotionEvent,
  type NativeSetupReadiness,
  type BundledNativeAudio,
} from '../native/motionDetector';

interface NativeDetectorPanelProps {
  lang: Language;
  settings: DetectorSettings;
  onSettingsChange: (settings: DetectorSettings) => void;
  onRuntimeStatusChange: (snapshot: NativeDetectorSnapshot) => void;
}

type StepId = 'camera' | 'audio' | 'route' | 'volume' | 'calibration' | 'motion' | 'tuning' | 'kiosk';

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
  INVALID_AUDIO: {
    uk: 'Файл пошкоджений або має непідтримуваний аудіоформат. Виберіть інший файл.',
    en: 'The file is corrupt or uses an unsupported audio format. Choose another file.',
  },
  MOTION_TEST_NOT_TRIGGERED: { uk: 'Спочатку дочекайтеся реального спрацювання датчика.', en: 'Wait for an actual detector trigger before finishing the test.' },
  INVALID_PIN: { uk: 'PIN має містити від 4 до 12 цифр.', en: 'The PIN must contain 4 to 12 digits.' },
  INCORRECT_PIN: { uk: 'Неправильний PIN оператора.', en: 'The operator PIN is incorrect.' },
  DEVICE_OWNER_REQUIRED: { uk: 'Для цієї дії потрібен режим Device Owner.', en: 'This action requires Device Owner mode.' },
  AUTOSTART_NOT_READY: { uk: 'Автозапуск ще заблокований незавершеними перевірками.', en: 'Auto-start is still blocked by incomplete checks.' },
  LOCK_TASK_FAILED: { uk: 'Не вдалося увімкнути Lock Task.', en: 'Lock Task could not be enabled.' },
  MAINTENANCE_MODE_REQUIRED: { uk: 'Спочатку відкрийте операторський режим.', en: 'Open operator mode first.' },
  BLUETOOTH_SETTINGS_FAILED: { uk: 'Не вдалося відкрити налаштування Bluetooth.', en: 'Bluetooth settings could not be opened.' },
  AUDIO_VOLUME_FAILED: { uk: 'Android не зміг застосувати гучність до підключеного виходу.', en: 'Android could not apply volume to the connected output.' },
  DETECTOR_RUNNING: { uk: 'Перед калібруванням зупиніть активний датчик.', en: 'Stop the active detector before calibration.' },
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
    routeUnavailableHint: 'Підключіть AUX або будь-яку Bluetooth-колонку з медіапрофілем A2DP/BLE. Нову колонку потрібно перевірити звуком.',
    routeConfirm: 'Чую звук', routeReject: 'Не чую', routeListening: 'Слухайте колонку та підтвердьте',
    connectBluetooth: 'Підключити або змінити Bluetooth-колонку',
    bluetoothHint: 'Android відкриє системне підключення. Підійде будь-яка A2DP/BLE-колонка; спочатку від’єднайте AUX — він має пріоритет.',
    volume: '4. Гучність', saveVolume: 'Зберегти та застосувати', volumeDone: 'Гучність застосовано', calibration: '5. Калібрування',
    calibrate: 'Почати калібрування (10 с)', calibrationDone: 'Калібрування завершено',
    calibrationDoesNotArm: 'Калібрування не вмикає датчик. Після нього виконайте тест руху або натисніть «Увімкнути датчик».',
    calibrationClamped: 'Сцена була неспокійна: поріг уперся в максимум 10%. Датчик реагуватиме лише зблизька — приблизно за 1,5–2 м. Приберіть рух у кадрі або обмежте зону детекції та відкалібруйте ще раз.',
    calibrationRaw: 'Розрахунок без обмеження',
    zone: 'Зона детекції', zoneFull: 'Весь кадр', zoneCenter: 'Центр', zoneLower: 'Нижня частина',
    zoneHint: 'Менша зона прибирає з кадру вікна, стелю та світло, через які поріг злітає вгору. Зміна зони скидає калібрування й тест руху — їх треба пройти заново.',
    motion: '6. Тест руху', motionAction: 'Почати тест руху', finishMotion: 'Завершити тест', cancelMotion: 'Скасувати тест', motionDone: 'Рух і відтворення підтверджено',
    motionBlocked: 'Спочатку завершіть тест маршруту, збережіть гучність і виконайте калібрування.',
    arm: 'УВІМКНУТИ ДАТЧИК', armed: 'Датчик активний', running: 'ДАТЧИК ПРАЦЮЄ', status: 'Стан системи',
    unavailable: 'Звук недоступний', diagnostics: 'Діагностика', refresh: 'Оновити', export: 'Експорт JSON',
    daily: 'Стан за добу', dailyToday: 'сьогодні', dailyTriggers: 'спрацювань', dailyLast: 'останнє',
    dailyRestarts: 'Перезапуски камери', dailyRouteLosses: 'Втрати маршруту', dailyBattery: 'Батарея: мін · макс',
    dailyTotal: 'Усього спрацювань', dailyNone: 'Ще немає записаних днів',
    noDiagnostics: 'Дані діагностики ще не завантажено', preparing: 'Виконується…',
    motionHint: 'Пройдіть перед камерою. Після сигналу натисніть «Завершити тест».',
    motionLive: 'Поточний рух / поріг',
    armHint: 'Для увімкнення потрібні всі шість перевірок.', routeHint: 'AUX має пріоритет; динамік телефона не використовується.',
    rearmHint: 'Після завершення аудіо датчик автоматично витримує паузу та знову очікує рух — повторно натискати не потрібно.',
    events: 'Події', cameraRestarts: 'Перезапуски камери', errors: 'Помилки', battery: 'Батарея',
    cameraFrames: 'Кадри з камери', cameraLive: 'Камера передає кадри',
    frp: 'Захист від скидання',
    kioskTitle: '7. Kiosk і автозапуск', kioskSubtitle: 'Після вимкнення телефона запуск іде нативно: Device Owner → Home-екран → датчик.',
    deviceOwner: 'Device Owner', homeApp: 'Home app', lockTask: 'Lock Task', kioskLock: 'Kiosk lock',
    deviceOwnerRequired: 'Для реального автозапуску цей телефон потрібно скинути до заводських налаштувань і підготувати APK як Device Owner. На звичайному телефоні датчик після reboot навмисно не стартує у фоні.',
    configureKiosk: 'Налаштувати Home і Lock Task', secureUnlockWarning: 'На телефоні встановлено PIN/пароль. Після повного вимкнення Android вимагатиме перше розблокування, тому «без дотику» не гарантується.',
    createPinHint: 'Створіть PIN оператора (4–12 цифр). Він потрібен, щоб увімкнути чи тимчасово відкрити kiosk.',
    newPin: 'Новий PIN', repeatPin: 'Повторіть PIN', pinMismatch: 'PIN не збігаються.', savePin: 'Зберегти PIN оператора',
    enablePin: 'PIN оператора для увімкнення', enableKiosk: 'Увімкнути kiosk і автозапуск', lastBoot: 'Останній запуск',
    operatorPin: 'PIN оператора', openMaintenance: 'Відкрити операторський режим', disableAutostart: 'Вимкнути автозапуск',
    maintenanceActive: 'Операторський режим активний: автозапуск тимчасово призупинено, Lock Task відкрито.',
    returnPin: 'PIN оператора для повернення kiosk', returnKiosk: 'Повернути kiosk',
    returningKiosk: 'Повертаю kiosk…', kioskRestored: 'Kiosk відновлено: Lock Task активний.',
    actionFailed: 'Не вдалося виконати дію',
    eventLog: 'Локальний журнал подій', noEvents: 'Подій ще немає', clearEvents: 'Очистити', deleteEvent: 'Видалити подію',
    clearEventsConfirm: 'Очистити весь локальний журнал подій?', motionValue: 'Рух', thresholdValue: 'Поріг',
    tuning: 'Налаштування детектора', frontCamera: 'Фронтальна камера', rearCamera: 'Задня камера', sensitivity: 'Чутливість',
    cooldownDelay: 'Пауза після сигналу', consecutiveFrames: 'Кадрів для підтвердження', saveTuning: 'Зберегти налаштування',
    tuningUnsaved: 'Є незбережені зміни.',
    stopToTune: 'Щоб змінити параметри камери, спочатку зупиніть датчик.', seconds: 'с',
    bootState: { never: 'ще не перевірено після reboot', started: 'датчик запущено', waiting_for_route: 'очікується перевірений аудіомаршрут', blocked: 'запуск заблоковано перевірками', failed: 'помилка запуску' },
    statusText: { idle: 'Готово до запуску', starting: 'Запуск камери', armed: 'Датчик активний', triggered: 'Рух виявлено', playing: 'Відтворення', cooldown: 'Пауза після сигналу', recovering: 'Відновлення камери', audio_route_lost: 'Аудіомаршрут втрачено', fault: 'Помилка датчика' },
  },
  en: {
    title: 'Native detector', subtitle: 'Offline APK mode · Android owns camera and audio',
    camera: '1. Camera', cameraAction: 'Grant camera access', cameraDone: 'Camera access granted',
    audio: '2. Local audio', import: 'Import audio', noAudio: 'No file selected yet',
    route: '3. Route test', routeAction: 'Play route test', routeDone: 'Route verified',
    routeUnavailableHint: 'Connect AUX or any Bluetooth speaker with an A2DP/BLE media profile. A new speaker must pass the audible route test.',
    routeConfirm: 'I hear sound', routeReject: 'No sound', routeListening: 'Listen to the speaker, then confirm',
    connectBluetooth: 'Connect or change Bluetooth speaker',
    bluetoothHint: 'Android opens trusted system pairing. Any A2DP/BLE speaker is supported; disconnect AUX first because it has priority.',
    volume: '4. Volume', saveVolume: 'Save and apply', volumeDone: 'Volume applied', calibration: '5. Calibration',
    calibrate: 'Start calibration (10 s)', calibrationDone: 'Calibration complete',
    calibrationDoesNotArm: 'Calibration does not arm the detector. After it, run the motion test or tap “Arm detector”.',
    calibrationClamped: 'The scene was not quiet: the threshold hit its 10% maximum. The detector will only react close up, at roughly 1.5–2 m. Remove the movement from the frame or narrow the detection zone, then calibrate again.',
    calibrationRaw: 'Unclamped estimate',
    zone: 'Detection zone', zoneFull: 'Full frame', zoneCenter: 'Center', zoneLower: 'Lower area',
    zoneHint: 'A smaller zone removes windows, ceilings and lights that drive the threshold up. Changing the zone resets calibration and the motion test; both must be repeated.',
    motion: '6. Motion test', motionAction: 'Start motion test', finishMotion: 'Finish test', cancelMotion: 'Cancel test', motionDone: 'Motion and playback confirmed',
    motionBlocked: 'First complete the route test, save volume, and calibrate.',
    arm: 'ARM DETECTOR', armed: 'Detector armed', running: 'DETECTOR RUNNING', status: 'System status',
    unavailable: 'Sound unavailable', diagnostics: 'Diagnostics', refresh: 'Refresh', export: 'Export JSON',
    daily: 'Daily state', dailyToday: 'today', dailyTriggers: 'triggers', dailyLast: 'last',
    dailyRestarts: 'Camera restarts', dailyRouteLosses: 'Route losses', dailyBattery: 'Battery: min · max',
    dailyTotal: 'Triggers in total', dailyNone: 'No days recorded yet',
    noDiagnostics: 'Diagnostics have not been loaded yet', preparing: 'Working…',
    motionHint: 'Move in front of the camera. After the signal, tap “Finish test”.',
    motionLive: 'Current motion / threshold',
    armHint: 'All six checks are required before arming.', routeHint: 'AUX takes priority; the phone speaker is never used.',
    rearmHint: 'After audio ends, the detector waits through cooldown and automatically watches for motion again. No second tap is needed.',
    events: 'Events', cameraRestarts: 'Camera restarts', errors: 'Errors', battery: 'Battery',
    cameraFrames: 'Camera frames', cameraLive: 'Camera frames are arriving',
    frp: 'Factory reset protection',
    kioskTitle: '7. Kiosk and auto-start', kioskSubtitle: 'After a power cycle Android starts Device Owner → Home app → detector locally.',
    deviceOwner: 'Device Owner', homeApp: 'Home app', lockTask: 'Lock Task', kioskLock: 'Kiosk lock',
    deviceOwnerRequired: 'Reliable auto-start requires a factory reset and Device Owner commissioning. An ordinary installation intentionally does not start the camera service in the background after reboot.',
    configureKiosk: 'Configure Home and Lock Task', secureUnlockWarning: 'This phone has a PIN or password. Android requires the first unlock after a cold boot, so touch-free startup cannot be guaranteed.',
    createPinHint: 'Create a 4–12 digit operator PIN. It is required to enable kiosk mode or enter maintenance.',
    newPin: 'New PIN', repeatPin: 'Repeat PIN', pinMismatch: 'PINs do not match.', savePin: 'Save operator PIN',
    enablePin: 'Operator PIN to enable', enableKiosk: 'Enable kiosk and auto-start', lastBoot: 'Last boot',
    operatorPin: 'Operator PIN', openMaintenance: 'Open operator mode', disableAutostart: 'Disable auto-start',
    maintenanceActive: 'Operator mode is active: auto-start is paused and Lock Task is open.',
    returnPin: 'Operator PIN to restore kiosk', returnKiosk: 'Restore kiosk',
    returningKiosk: 'Restoring kiosk…', kioskRestored: 'Kiosk restored: Lock Task is active.',
    actionFailed: 'Action failed',
    eventLog: 'Local event log', noEvents: 'No events yet', clearEvents: 'Clear', deleteEvent: 'Delete event',
    clearEventsConfirm: 'Clear the complete local event log?', motionValue: 'Motion', thresholdValue: 'Threshold',
    tuning: 'Detector settings', frontCamera: 'Front camera', rearCamera: 'Rear camera', sensitivity: 'Sensitivity',
    cooldownDelay: 'Post-playback pause', consecutiveFrames: 'Confirmation frames', saveTuning: 'Save detector settings',
    tuningUnsaved: 'There are unsaved changes.',
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
  const [audioLibrary, setAudioLibrary] = useState<BundledNativeAudio[]>([]);
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
  const tuningDirtyRef = useRef(false);
  const [tuningDirty, setTuningDirty] = useState(false);
  const [operatorPin, setOperatorPin] = useState('');
  const [operatorPinConfirmation, setOperatorPinConfirmation] = useState('');
  const [kioskFeedback, setKioskFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);

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
    if (calibrationRunningRef.current && ['idle', 'fault'].includes(next.status)) {
      calibrationRunningRef.current = false;
      setBusy(null);
      if (next.status === 'fault') setError(lang === 'uk' ? next.message : t.statusText.fault);
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
    const library = await MotionDetector.getAudioLibrary();
    setAudioLibrary(library.items);
    setReadiness(setup.readiness);
    setKioskState(kiosk);
    setEvents(eventResult.events);
    const nativeSettingsSnapshot = JSON.stringify(nativeSettings);
    if (!tuningDirtyRef.current && nativeSettingsSnapshot !== nativeSettingsSnapshotRef.current) {
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

  // The daily card exists to be read at a glance during the morning start, so
  // it loads itself. It is informational: a failure here must never surface as
  // a wizard error or block a step.
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      MotionDetector.getDiagnostics()
        .then(value => { if (!cancelled) setDiagnostics(value); })
        .catch(() => undefined);
    };
    load();
    const onVisibilityChange = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

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

  const updateTuning = (next: DetectorSettings) => {
    tuningDirtyRef.current = true;
    setTuningDirty(true);
    onSettingsChange(next);
  };

  const saveTuning = async (next: DetectorSettings) => {
    await MotionDetector.saveSettings({settings: next});
    nativeSettingsSnapshotRef.current = JSON.stringify(next);
    tuningDirtyRef.current = false;
    setTuningDirty(false);
    await refreshSetup();
  };
  // Coarse on purpose. A free-form crop is easy to get wrong on a mounted
  // phone, and a zone that misses the visitor path is worse than a noisy one.
  const zonePresets: {key: string; label: string; zone: DetectionZone}[] = [
    {key: 'full', label: t.zoneFull, zone: {x: 0, y: 0, width: 1, height: 1}},
    {key: 'center', label: t.zoneCenter, zone: {x: 0.2, y: 0.15, width: 0.6, height: 0.7}},
    {key: 'lower', label: t.zoneLower, zone: {x: 0, y: 0.4, width: 1, height: 0.6}},
  ];
  const isoDay = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const dailySummaries = diagnostics?.dailySummaries ?? [];
  const latestDay = dailySummaries[0] ?? null;
  const dayLabel = (day: string) => day === isoDay(new Date()) ? `${day} · ${t.dailyToday}` : day;
  const clockLabel = (atMs: number) => atMs > 0
    ? new Date(atMs).toLocaleTimeString(lang === 'uk' ? 'uk-UA' : 'en-GB', {hour: '2-digit', minute: '2-digit'})
    : '—';
  const sameZone = (a: DetectionZone, b: DetectionZone) =>
    a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
  const cameraGranted = readiness.cameraGranted;
  const soundVerified = readiness.routeVerified;
  const volumeSaved = readiness.audioVolume === volumeDraft;
  const calibrated = readiness.calibrated;
  const motionTestPassed = readiness.motionTestPassed;
  const motionSetupComplete = cameraGranted && readiness.audioImported && soundVerified && volumeSaved && calibrated;
  const checksComplete = motionSetupComplete && motionTestPassed;
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
        {audioLibrary.length > 0 && <select aria-label={t.audio} value={audioLibrary.some(item => item.name === audioName) ? audioName ?? '' : ''} onChange={event => { if (!event.target.value) return; void run('audio', async () => { const audio = await MotionDetector.selectBundledAudio({ assetName: event.target.value }); const next = { ...settings, audioSourceType: 'custom' as const, customAudioId: audio.id }; onSettingsChange(next); setAudioName(audio.name); await refreshSetup(); setBusy(null); }); }} className="w-full rounded-xl border border-gray-700 bg-black px-3 py-2 text-xs text-slate-100 mb-2"><option value="">{lang === 'uk' ? 'Вибрати фігуру з каталогу' : 'Choose a figure from catalog'}</option>{audioLibrary.map(item => <option key={item.assetName} value={item.assetName}>{item.name}</option>)}</select>}
        <button type="button" onClick={() => run('audio', async () => { const audio = await MotionDetector.importAudio(); const next = { ...settings, audioSourceType: 'custom' as const, customAudioId: audio.id }; onSettingsChange(next); setAudioName(audio.name); await refreshSetup(); setBusy(null); })} className="native-action">{busy === 'audio' ? t.preparing : t.import}</button>
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
          <>
            {route.kind === 'unavailable' && <p className="text-[10px] text-amber-300 mt-3">{t.routeUnavailableHint}</p>}
            <button disabled={route.kind === 'unavailable'} type="button" onClick={() => run('route', async () => {
              soundTestRunningRef.current = true;
              setSoundTestRunning(true);
              setSoundTestConfirmable(false);
              window.setTimeout(() => setSoundTestConfirmable(true), 3000);
              await MotionDetector.playTest();
            })} className="native-action mt-3">{busy === 'route' ? t.preparing : soundVerified ? t.routeDone : t.routeAction}</button>
          </>
        )}
        <button disabled={detectorIsRunning || soundTestRunning} type="button" onClick={() => void run('route', async () => { await MotionDetector.openBluetoothSettings(); setBusy(null); })} className="native-action mt-3"><Bluetooth className="inline-block w-4 h-4 mr-2 -mt-0.5" />{t.connectBluetooth}</button>
        <p className="text-[10px] text-gray-500 mt-2">{t.bluetoothHint}</p>
      </StepCard>
      <StepCard title={t.volume} complete={volumeSaved}>
        <div className="flex items-center gap-3"><Volume2 className="w-4 h-4 text-[#F27D26]" /><input aria-label={t.volume} type="range" min="0" max="100" value={volumeDraft} onChange={event => setVolumeDraft(Number(event.target.value))} className="flex-1 accent-[#F27D26]" /><span className="w-9 text-right text-xs font-mono">{volumeDraft}%</span></div>
        <button type="button" onClick={() => run('volume', async () => { await saveVolume(); setBusy(null); })} className="native-action mt-3">{busy === 'volume' ? t.preparing : t.saveVolume}</button>
        <p className="text-[10px] text-gray-500 mt-3">{volumeSaved ? t.volumeDone : ''}</p>
      </StepCard>
      <StepCard title={t.calibration} complete={calibrated}>
        <button disabled={detectorIsRunning} type="button" onClick={() => run('calibration', async () => { if (tuningDirtyRef.current) await saveTuning(settings); calibrationRunningRef.current = true; await MotionDetector.calibrate(); })} className="native-action">{busy === 'calibration' ? t.preparing : calibrated ? t.calibrationDone : t.calibrate}</button>
        {settings.calibrationClamped && <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[10px] text-amber-200">{t.calibrationClamped}{settings.calibrationRawNoiseFloor != null && <> {t.calibrationRaw}: {settings.calibrationRawNoiseFloor.toFixed(1)}%.</>}</p>}
        <p className="text-[10px] text-gray-500 mt-3">{t.calibrationDoesNotArm}</p>
      </StepCard>
      <StepCard title={t.motion} complete={motionTestPassed}>
        <p className="text-[10px] text-gray-500 mb-3">{t.motionHint}</p>
        {motionTestRunning && <p className="text-[10px] text-emerald-300 mb-3">{t.motionLive}: {snapshot.motionPercent.toFixed(1)}% / {settings.noiseThreshold.toFixed(1)}%</p>}
        {!motionTestRunning && !motionSetupComplete && <p className="text-[10px] text-amber-300 mb-3">{t.motionBlocked}</p>}
        {motionTestRunning ? <div className="grid gap-2 sm:grid-cols-2"><button type="button" disabled={!motionTestTriggered} onClick={() => run('motion', async () => { motionStopRequestedRef.current = true; await MotionDetector.finishMotionTest(); motionTestRunningRef.current = false; setMotionTestRunning(false); await refreshSetup(); setBusy(null); })} className="native-action">{t.finishMotion}</button><button type="button" onClick={() => run('motion', async () => { motionStopRequestedRef.current = true; await MotionDetector.stop(); motionTestRunningRef.current = false; setMotionTestRunning(false); setMotionTestTriggered(false); setBusy(null); })} className="native-action">{t.cancelMotion}</button></div> : <button disabled={!motionSetupComplete} type="button" onClick={() => run('motion', async () => { motionStopRequestedRef.current = false; setMotionTestTriggered(false); motionTestRunningRef.current = true; setMotionTestRunning(true); try { await MotionDetector.start(); setBusy(null); } catch (error) { motionTestRunningRef.current = false; setMotionTestRunning(false); throw error; } })} className="native-action">{busy === 'motion' ? t.preparing : motionTestPassed ? t.motionDone : t.motionAction}</button>}
      </StepCard>
    </div>

    <section className="rounded-2xl border border-gray-800 bg-[#111111] p-4 text-left">
      <p className="text-xs font-black uppercase tracking-wide">{t.tuning}</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" disabled={detectorIsRunning || busy === 'tuning'} onClick={() => void run('tuning', async () => { const next = {...settings, cameraFacingMode: 'user' as const}; updateTuning(next); await saveTuning(next); setBusy(null); })} className={`native-action ${settings.cameraFacingMode === 'user' ? 'native-action-active' : ''}`}>{t.frontCamera}</button>
        <button type="button" disabled={detectorIsRunning || busy === 'tuning'} onClick={() => void run('tuning', async () => { const next = {...settings, cameraFacingMode: 'environment' as const}; updateTuning(next); await saveTuning(next); setBusy(null); })} className={`native-action ${settings.cameraFacingMode === 'environment' ? 'native-action-active' : ''}`}>{t.rearCamera}</button>
      </div>
      <p className="mt-5 text-[10px] font-bold uppercase tracking-wide text-gray-400">{t.zone}</p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {zonePresets.map(preset => (
          <button key={preset.key} type="button" disabled={detectorIsRunning || busy === 'tuning'} onClick={() => void run('tuning', async () => { const next = {...settings, detectionZone: preset.zone}; updateTuning(next); await saveTuning(next); setBusy(null); })} className={`native-action ${sameZone(settings.detectionZone, preset.zone) ? 'native-action-active' : ''}`}>{preset.label}</button>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-gray-500">{t.zoneHint}</p>
      <label className="block mt-4 text-[10px] text-gray-400"><span className="flex justify-between"><span>{t.sensitivity}</span><span>{settings.sensitivity}%</span></span><input disabled={detectorIsRunning} type="range" min="1" max="100" value={settings.sensitivity} onChange={event => updateTuning({...settings, sensitivity: Number(event.target.value)})} className="mt-2 w-full accent-[#F27D26]" /></label>
      <label className="block mt-4 text-[10px] text-gray-400"><span className="flex justify-between"><span>{t.cooldownDelay}</span><span>{settings.coolDownDelay} {t.seconds}</span></span><input disabled={detectorIsRunning} type="range" min="2" max="60" value={settings.coolDownDelay} onChange={event => updateTuning({...settings, coolDownDelay: Number(event.target.value)})} className="mt-2 w-full accent-[#F27D26]" /></label>
      <label className="block mt-4 text-[10px] text-gray-400"><span className="flex justify-between"><span>{t.consecutiveFrames}</span><span>{settings.requiredConsecutiveFrames}</span></span><input disabled={detectorIsRunning} type="range" min="1" max="5" value={settings.requiredConsecutiveFrames} onChange={event => updateTuning({...settings, requiredConsecutiveFrames: Number(event.target.value)})} className="mt-2 w-full accent-[#F27D26]" /></label>
      {detectorIsRunning && <p className="mt-3 text-[10px] text-amber-300">{t.stopToTune}</p>}
      {tuningDirty && <p className="mt-3 text-[10px] text-amber-300">{t.tuningUnsaved}</p>}
      <button type="button" disabled={detectorIsRunning || busy === 'tuning'} onClick={() => void run('tuning', async () => { await saveTuning(settings); setBusy(null); })} className="native-action mt-4">{busy === 'tuning' ? t.preparing : t.saveTuning}</button>
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
        {/* Offer this whenever either half of the policy is missing. Keying it
            on isDefaultHomeApp alone hid the button on a provisioned phone,
            where the app is already Home but Lock Task was never configured —
            and the enable button below is disabled until Lock Task exists, so
            the operator had no way in at all. Re-running is harmless. */}
        {kioskState.isDeviceOwner && (!kioskState.isDefaultHomeApp || !kioskState.isLockTaskAllowed) && <button type="button" onClick={() => run('kiosk', async () => { setKioskState(await MotionDetector.configureKiosk()); setBusy(null); })} className="native-action mt-4">{busy === 'kiosk' ? t.preparing : t.configureKiosk}</button>}

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

        {kioskState.operatorPinConfigured && !kioskState.maintenanceMode && <div className="mt-4 space-y-2">
          {kioskState.autoStartAfterRebootEnabled && <p className="text-[11px] text-emerald-200">{t.lastBoot}: {lang === 'uk' ? kioskState.lastBootStartMessage : t.bootState[kioskState.lastBootStartState]}</p>}
          <input value={operatorPin} onChange={event => setOperatorPin(event.target.value.replace(/\D/g, '').slice(0, 12))} inputMode="numeric" type="password" autoComplete="current-password" placeholder={t.operatorPin} className="native-input" />
          <div className="grid gap-2 sm:grid-cols-2">
            {canOpenOperatorMode(kioskState) && <button disabled={!pinIsValid} type="button" onClick={() => run('kiosk', async () => { setKioskState(await MotionDetector.unlockKiosk({ pin: operatorPin })); setOperatorPin(''); setBusy(null); })} className="native-action">{t.openMaintenance}</button>}
            {kioskState.autoStartAfterRebootEnabled
              ? <button disabled={!pinIsValid} type="button" onClick={() => run('kiosk', async () => { setKioskState(await MotionDetector.setAutoStartAfterReboot({ enabled: false, operatorPin })); setOperatorPin(''); setBusy(null); })} className="native-action">{t.disableAutostart}</button>
              : <button disabled={!pinIsValid || !kioskState.autoStartReady} type="button" onClick={() => run('kiosk', async () => { setKioskState(await MotionDetector.setAutoStartAfterReboot({ enabled: true, operatorPin })); setOperatorPin(''); setBusy(null); })} className="native-action">{busy === 'kiosk' ? t.preparing : t.enableKiosk}</button>}
          </div>
        </div>}

        {kioskFeedback && <p role={kioskFeedback.kind === 'error' ? 'alert' : 'status'} aria-live="polite" className={`mt-4 rounded-xl border p-3 text-[11px] ${kioskFeedback.kind === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-red-500/30 bg-red-500/10 text-red-200'}`}>{kioskFeedback.message}</p>}

        {kioskState.maintenanceMode && <div className="mt-4 space-y-2">
          <p className="text-[11px] text-amber-200">{t.maintenanceActive}</p>
          <input value={operatorPin} onChange={event => { setOperatorPin(event.target.value.replace(/\D/g, '').slice(0, 12)); setKioskFeedback(null); }} inputMode="numeric" type="password" autoComplete="current-password" placeholder={t.returnPin} className="native-input" />
          <button
            disabled={!pinIsValid || busy === 'kiosk'}
            type="button"
            onClick={() => void run('kiosk', async () => {
              setKioskFeedback(null);
              try {
                const next = await restoreKioskWithVerification(
                  () => MotionDetector.lockKiosk({operatorPin}),
                  () => MotionDetector.getKioskState(),
                );
                setKioskState(next);
                setOperatorPin('');
                setKioskFeedback({kind: 'success', message: t.kioskRestored});
              } catch (actionError) {
                setKioskFeedback({kind: 'error', message: localizedActionError(actionError, lang, t.actionFailed)});
                throw actionError;
              } finally {
                setBusy(null);
              }
            })}
            className="native-action"
          >{busy === 'kiosk' ? t.returningKiosk : t.returnKiosk}</button>
        </div>}
      </>}
    </section>

    <section className="rounded-3xl border border-gray-800 bg-[#111111] p-5 text-left">
      <button disabled={!checksComplete || detectorIsRunning} type="button" onClick={() => run('arm', async () => { await MotionDetector.start(); setBusy(null); })} className="w-full h-14 rounded-2xl bg-[#F27D26] text-black text-xs font-black tracking-widest disabled:opacity-35 disabled:cursor-not-allowed flex items-center justify-center gap-2"><ShieldCheck className="w-5 h-5" />{busy === 'arm' ? t.preparing : detectorIsRunning ? t.running : t.arm}</button>
      {detectorIsRunning && <p className="text-center text-[10px] text-emerald-300 mt-3">{t.rearmHint}</p>}
      {!checksComplete && <p className="text-center text-[10px] text-gray-500 mt-3">{t.armHint}</p>}
    </section>

    {diagnostics && <section className="rounded-2xl border border-gray-800 bg-[#111111] p-4 text-left">
      <p className="text-xs font-black uppercase tracking-wide">{t.daily}</p>
      {latestDay ? <>
        <p className="mt-3 text-sm font-bold text-slate-100">{dayLabel(latestDay.day)} · {latestDay.triggers} {t.dailyTriggers}{latestDay.lastTriggerAtMs > 0 ? ` · ${t.dailyLast} ${clockLabel(latestDay.lastTriggerAtMs)}` : ''}</p>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3 text-[10px] text-gray-400">
          <dt>{t.dailyRestarts}</dt><dd className="text-right text-slate-200">{latestDay.cameraRestarts}</dd>
          <dt>{t.dailyRouteLosses}</dt><dd className="text-right text-slate-200">{latestDay.routeLosses}</dd>
          <dt>{t.dailyBattery}</dt><dd className="text-right text-slate-200">{latestDay.minBatteryPercent == null ? '—' : `${latestDay.minBatteryPercent}% · ${latestDay.maxBatteryTemperatureC == null ? '—' : `${latestDay.maxBatteryTemperatureC.toFixed(1)}°C`}`}</dd>
          <dt>{t.dailyTotal}</dt><dd className="text-right text-slate-200">{diagnostics.triggersTotal ?? 0}</dd>
        </dl>
        {dailySummaries.length > 1 && <ul className="mt-3 flex flex-col gap-1 text-[10px] text-gray-500">
          {dailySummaries.slice(1, 7).map(day => (
            <li key={day.day} className="flex justify-between gap-3">
              <span>{day.day}</span>
              <span className="text-slate-300">{day.triggers} {t.dailyTriggers}{day.routeLosses > 0 ? ` · ${day.routeLosses} ${t.dailyRouteLosses.toLowerCase()}` : ''}</span>
            </li>
          ))}
        </ul>}
      </> : <p className="text-[10px] text-gray-500 mt-3">{t.dailyNone}</p>}
    </section>}

    <section className="rounded-2xl border border-gray-800 bg-[#111111] p-4 text-left">
      <div className="flex justify-between gap-2 items-center"><p className="text-xs font-black uppercase tracking-wide">{t.diagnostics}</p><div className="flex gap-2"><button type="button" onClick={() => run('diagnostics', async () => { setDiagnostics(await MotionDetector.getDiagnostics()); setBusy(null); })} className="native-icon-action" title={t.refresh}><SlidersHorizontal className="w-4 h-4" /></button><button type="button" onClick={() => run('diagnostics', async () => { await MotionDetector.exportDiagnostics(); setBusy(null); })} className="native-icon-action" title={t.export}><Download className="w-4 h-4" /></button></div></div>
      {diagnostics ? <dl className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 text-[10px] text-gray-400"><dt>{t.events}</dt><dd className="text-right text-slate-200">{diagnostics.eventCount}</dd><dt>{t.cameraFrames}</dt><dd className="text-right text-slate-200">{diagnostics.analyzedFrameCount}</dd><dt>{t.cameraRestarts}</dt><dd className="text-right text-slate-200">{diagnostics.cameraRestarts}</dd><dt>{t.errors}</dt><dd className="text-right text-slate-200">{diagnostics.errors}</dd><dt>{t.battery}</dt><dd className="text-right text-slate-200">{diagnostics.batteryPercent == null ? '—' : `${diagnostics.batteryPercent}%`}</dd><dt>{t.frp}</dt><dd className="text-right text-slate-200 break-all">{diagnostics.factoryResetProtection ?? '—'}</dd></dl> : <p className="text-[10px] text-gray-500 mt-3">{t.noDiagnostics}</p>}
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
