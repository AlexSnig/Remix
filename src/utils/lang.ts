export type Language = 'uk' | 'en';

export interface TranslationSet {
  appTitleDefault: string;
  standbyMode: string;
  scanMode: string;
  stealth: string;
  allowAudio: string;
  allowAudioTip: string;
  alarmTriggered: string;
  muteSound: string;
  sensorTab: string;
  eventsTab: string;
  exhibitNameLabel: string;
  saveName: string;
  editName: string;
  frontCamera: string;
  backCamera: string;
  enableSensor: string;
  disableSensor: string;
  currentChange: string;
  sensorThreshold: string;
  normalState: string;
  eventTriggered: string;
  cooldownMessage: string;
  sensorInCooldown: string;
  secShort: string;
  cameraActiveStatus: string;
  noCameraPermission: string;
  noCameraFound: string;
  cameraConnectionError: string;
  connectCameraPrompt: string;
  sensorSettingsTitle: string;
  sensitivityLabel: string;
  sensitivityDesc: string;
  noiseThresholdLabel: string;
  noiseThresholdDesc: string;
  cooldownDelayLabel: string;
  cooldownDelayDesc: string;
  chooseAudioTitle: string;
  chooseAudioDesc: string;
  uploadedSignalsTitle: string;
  noUploadedSignals: string;
  uploadBtn: string;
  maxFilesizeTip: string;
  cacheTitle: string;
  cacheDesc: string;
  audioSizeLabel: string;
  shotsLabel: string;
  autoCleanLabel: string;
  autoCleanDesc: string;
  keepMaxLogs: string;
  eventsLimitDesc: string;
  cleanNowBtn: string;
  clearLogsBtn: string;
  eventsQuantity: string;
  eventLogsDesc: string;
  clearAllBtn: string;
  noEventsRegistered: string;
  eventsRegisterTip: string;
  exhibitRecommendationTitle: string;
  exhibitRecommendationDesc: string;
  fullscreenBtn: string;
  fullscreenExit: string;
  fileTooLarge: string;
  fileReadError: string;
  saveFileError: string;
  confirmClearLogs: string;
  cachePrunedMsg: string;
  logsClearedMsg: string;
  tuneChangedMsg: string;
  userTuneSelectedMsg: string;
  tuneDeletedMsg: string;
  uploadSuccessMsg: string;
  interactReminder: string;
  motionLabel: string;
  keepAwakeLabel: string;
  keepAwakeActive: string;
  keepAwakeInactive: string;
  kioskGateTitle: string;
  kioskGateDesc: string;
  kioskGateBtn: string;
  kioskGateSkip: string;
  kioskSettingLabel: string;
  kioskSettingDesc: string;
}

export const TRANSLATIONS: Record<Language, TranslationSet> = {
  uk: {
    appTitleDefault: "Датчик музейного експонату",
    standbyMode: "РЕЖИМ ОЧІКУВАННЯ",
    scanMode: "Очікування події",
    stealth: "Маскування",
    allowAudio: "Увімкнути аудіо",
    allowAudioTip: "🔔 Будь ласка, активуйте звук перед початком використання:",
    alarmTriggered: "Подія спрацювала",
    muteSound: "Вимкнути звук",
    sensorTab: "Датчик",
    eventsTab: "Логи",
    exhibitNameLabel: "Назва експонату",
    saveName: "Зберегти",
    editName: "Редагувати",
    frontCamera: "Фронтальна камера",
    backCamera: "Тильна камера",
    enableSensor: "Увімкнути датчик",
    disableSensor: "Вимкнути датчик руху",
    currentChange: "Поточна зміна кадру:",
    sensorThreshold: "Поріг датчика",
    normalState: "Норма",
    eventTriggered: "Подія спрацювала",
    cooldownMessage: "До наступної події - йде зворотний відлік.",
    sensorInCooldown: "Подія спрацювала",
    secShort: "сек",
    cameraActiveStatus: "Сенсор камери працює",
    noCameraPermission: "Доступ до камери заблоковано. Будь ласка, дозвольте доступ до камери у налаштуваннях браузера.",
    noCameraFound: "Камера не знайдена на цьому пристрої. Перевірте з'єднання.",
    cameraConnectionError: "Не вдалося підключитися до камери:",
    connectCameraPrompt: "Будь ласка, увімкніть камеру нижче, щоб активувати датчик",
    sensorSettingsTitle: "Налаштування датчика",
    sensitivityLabel: "Чутливість датчика",
    sensitivityDesc: "Чим вища чутливість, тим менший рух або зміна в кімнаті викличе спрацьовування.",
    noiseThresholdLabel: "Поріг шуму (мінімальна площа руху)",
    noiseThresholdDesc: "Відсоток кадру, що має змінитися для спрацьовування. Допомагає відсіяти шуми камери або пил.",
    cooldownDelayLabel: "Затримка до наступного спрацьовування (пауза)",
    cooldownDelayDesc: "Час блокування датчика після спрацьовування (відтворення аудіо), перед тим як він зможе знову реагувати на рух.",
    chooseAudioTitle: "Вибір аудіосигналу",
    chooseAudioDesc: "Виберіть вбудований короткий сигнал або завантажте власний файл з вашого телефону. Аудіозаписи відтворюються чудово.",
    uploadedSignalsTitle: "Ваші завантажені сигнали / Музика",
    noUploadedSignals: "Немає завантажених аудіофайлів. Завантажте файл далі (за замовчуванням рекомендується вибирати з папки 'Музика').",
    uploadBtn: "Завантажити аудіо (.mp3, .wav, .ogg)",
    maxFilesizeTip: "Максимальний розмір: 12 МБ. Рекомендується вибирати з папки 'Музика' вашого пристрою.",
    cacheTitle: "Розмір кешу та автоочищення",
    cacheDesc: "Детектор зберігає лог подій та фото в локальну пам'ять пристрою. Налаштуйте очищення для збереження вільного простору.",
    audioSizeLabel: "Обсяг аудіо:",
    shotsLabel: "Знімків у лозі:",
    autoCleanLabel: "Автоматичне очищення кешу",
    autoCleanDesc: "Автоматично видаляти старі фото-логи та невикористані аудіо під час нових детекцій.",
    keepMaxLogs: "Зберігати останніх подій",
    eventsLimitDesc: "Усі старі події понад ліміт будуть акуратно та автоматично видалені з пам'яті.",
    cleanNowBtn: "Очистити зараз",
    clearLogsBtn: "Очистити логи",
    eventsQuantity: "Журнал подій",
    eventLogsDesc: "Зафіксовані рухи біля експонату з фотознімками для звітності",
    clearAllBtn: "Очистити все",
    noEventsRegistered: "Рухів біля експонату не зафіксовано",
    eventsRegisterTip: "Активуйте датчик руху та пройдіть перед камерою, щоб наповнити цей журнал.",
    exhibitRecommendationTitle: "Рекомендація для музейних експонатів:",
    exhibitRecommendationDesc: "Закріпіть телефон нерухомо навпроти експонату, виберіть потрібну камеру та імпортуйте локальний аудіофайл. Перед тривалою роботою виконайте калібрування і перевірте камеру, звук, заряджання та нагрівання саме на цьому пристрої.",
    fullscreenBtn: "Повноекранний режим",
    fullscreenExit: "Вийти з повного екрана",
    fileTooLarge: "Файл занадто великий. Будь ласка, виберіть аудіофайл обсягом до 12 МБ.",
    fileReadError: "Не вдалося прочитати вибраний файл.",
    saveFileError: "Помилка під час збереження аудіофайла.",
    confirmClearLogs: "Ви впевнені, що хочете повністю очистити лог подій та скриншоти?",
    cachePrunedMsg: "Кеш очищено: видалено логів та невикористовуваних аудіо.",
    logsClearedMsg: "Логи подій очищені успішно.",
    tuneChangedMsg: "Аудіосигнал змінено.",
    userTuneSelectedMsg: "Користувацький звук вибрано.",
    tuneDeletedMsg: "Звук видалено з пам'яті.",
    uploadSuccessMsg: "Аудіофайл успішно завантажено!",
    interactReminder: "Будь ласка, взаємодійте зі сторінкою спочатку, щоб відтворити аудіо.",
    motionLabel: "РУХ",
    keepAwakeLabel: "Блокування згасання екрана",
    keepAwakeActive: "Екран завжди увімкнений",
    keepAwakeInactive: "Екран працює звично",
    kioskGateTitle: "РЕЖИМ «МУЗЕЙНИЙ КІОСК»",
    kioskGateDesc: "Цей додаток повністю оптимізовано для безперебійної автономної роботи біля експонату. Торкніться екрана, щоб перейти у розгорнутий режим датчика руху із автоматичним блокуванням згасання дисплею та жестів.",
    kioskGateBtn: "ЗАПУСТИТИ ДАТЧИК РУХУ",
    kioskGateSkip: "налаштувати параметри вручну",
    kioskSettingLabel: "Автоматичний режим кіоску при запуску",
    kioskSettingDesc: "При відкритті сторінки автоматично пропонувати перехід у повноекранний режим і відразу ж у режимі кіоску вмикати датчик руху.",
  },
  en: {
    appTitleDefault: "Museum Exhibit Sensor",
    standbyMode: "STANDBY MODE",
    scanMode: "Waiting for event",
    stealth: "Stealth Masking",
    allowAudio: "Enable Audio",
    allowAudioTip: "🔔 Please activate audio before setting up:",
    alarmTriggered: "Event triggered",
    muteSound: "Stop Audio",
    sensorTab: "Sensor",
    eventsTab: "Logs",
    exhibitNameLabel: "Exhibit Name",
    saveName: "Save",
    editName: "Edit",
    frontCamera: "Front Camera",
    backCamera: "Rear Camera",
    enableSensor: "Start Sensor",
    disableSensor: "Stop Sensor",
    currentChange: "Current change amount:",
    sensorThreshold: "Trigger Threshold",
    normalState: "Normal",
    eventTriggered: "Event triggered",
    cooldownMessage: "Until next event - countdown is running.",
    sensorInCooldown: "Event triggered",
    secShort: "sec",
    cameraActiveStatus: "Camera sensor active",
    noCameraPermission: "Camera access is blocked. Please allow camera permissions inside your web browser settings.",
    noCameraFound: "Target camera model was not found on this device. Double check camera configuration.",
    cameraConnectionError: "Could not establish camera feed:",
    connectCameraPrompt: "Please connect your camera below to activate the motion sensor",
    sensorSettingsTitle: "Sensor Configuration",
    sensitivityLabel: "Sensor Sensitivity",
    sensitivityDesc: "Higher sensitivity triggers motion alerts on tiny pixel changes in the room.",
    noiseThresholdLabel: "Noise Filter Threshold (Minimum Area)",
    noiseThresholdDesc: "Percentage of feed that has to change to trigger. Clears minor camera noise or floating dust.",
    cooldownDelayLabel: "Exhibit Playback Pause (Cooldown)",
    cooldownDelayDesc: "Time the sensor remains blocked after detecting motion, so active audio has time to finish playing without re-triggering.",
    chooseAudioTitle: "Triggered Sound Signal",
    chooseAudioDesc: "Select our neat synthesized simple beep preset, or upload your own file from smartphone.",
    uploadedSignalsTitle: "Your custom audios / Songs",
    noUploadedSignals: "No custom audio tracks saved. Select and upload below (recommended to pick files from device 'Music' directory).",
    uploadBtn: "Upload Audio (.mp3, .wav, .ogg)",
    maxFilesizeTip: "Maximum file size: 12MB. Better defaults are usually located in 'Music' folder.",
    cacheTitle: "Cache Size & Auto Clean Space",
    cacheDesc: "The sensor stores movement logs with snapshots inside IndexedDB. Configure cleanups so your phone storage never fills.",
    audioSizeLabel: "Audio files size:",
    shotsLabel: "Log screenshots:",
    autoCleanLabel: "Automatic cache cleanup",
    autoCleanDesc: "Automatically discard old photo-logs and unused audio files during new alarm triggers.",
    keepMaxLogs: "Keep last events count",
    eventsLimitDesc: "All log entries exceeding this limit will be completely and safely removed on next trigger.",
    cleanNowBtn: "Clean Now",
    clearLogsBtn: "Clear Logs",
    eventsQuantity: "Event History log",
    eventLogsDesc: "Historical motion timestamps paired with instant preview snapshots",
    clearAllBtn: "Clear All",
    noEventsRegistered: "No events registered yet",
    eventsRegisterTip: "Activate the active monitoring mode and wave in front of the lens to test trigger.",
    exhibitRecommendationTitle: "Exhibit Sensor Positioning Guide:",
    exhibitRecommendationDesc: "Mount the phone steadily facing the exhibit, select the required camera, and import a local audio file. Before unattended use, calibrate and verify the camera, sound, charging, and heat behavior on that exact device.",
    fullscreenBtn: "Fullscreen Mode",
    fullscreenExit: "Exit Fullscreen",
    fileTooLarge: "File exceeds size limits. Please select a lighter audio file under 12MB.",
    fileReadError: "Could not read the selected local audio file.",
    saveFileError: "Failed saving sound record on your device database.",
    confirmClearLogs: "Are you sure you want to flush all captured exhibit logs & snapshot preview files?",
    cachePrunedMsg: "Cache cleared: removed logs and unused audio files.",
    logsClearedMsg: "Event logs cleared successfully.",
    tuneChangedMsg: "Signal melody updated.",
    userTuneSelectedMsg: "Custom sound successfully selected.",
    tuneDeletedMsg: "Sound record discarded from device.",
    uploadSuccessMsg: "Sound asset uploaded successfully!",
    interactReminder: "Please interact with the display first to activate play commands.",
    motionLabel: "MOTION",
    keepAwakeLabel: "Keep Screen Awake",
    keepAwakeActive: "Screen always on",
    keepAwakeInactive: "Screen sleep active",
    kioskGateTitle: "MUSEUM KIOSK MODE",
    kioskGateDesc: "This app is fully optimized for seamless autonomous operation near your exhibit. Tap the screen to enter dedicated motion sensor mode with automatic screen sleep block and gesture lock.",
    kioskGateBtn: "ACTIVATE MOTION SENSOR",
    kioskGateSkip: "configure parameters manually",
    kioskSettingLabel: "Auto Kiosk Mode on Startup",
    kioskSettingDesc: "Immersive standalone setup on page load. Automatically requests full screen, locks viewport gestures and activates the motion detection immediately.",
  }
};
