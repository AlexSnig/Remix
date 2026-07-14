import {useEffect, useRef, useState, type ChangeEvent} from 'react';
import {Check, Music, Play, Square, Trash2, Upload} from 'lucide-react';
import {CustomAudioFile, DetectorSettings} from '../types';
import {AUDIO_PRESETS, playCustomSound, playPresetSound, stopAllAudio} from '../utils/audio';
import {deleteCustomAudio, getAllCustomAudios, saveCustomAudio} from '../utils/indexedDB';
import {Language} from '../utils/lang';

interface AudioLibraryProps {
  settings: DetectorSettings;
  onSettingsChange: (settings: DetectorSettings) => void;
  onCustomAudioSaved: (audio: CustomAudioFile | null) => void;
  lang: Language;
}

const MAX_AUDIO_BYTES = 12 * 1024 * 1024;
const ACCEPTED_TYPES = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/aac', 'audio/ogg', 'audio/x-m4a'];

export default function AudioLibrary({settings, onSettingsChange, onCustomAudioSaved, lang}: AudioLibraryProps) {
  const [audios, setAudios] = useState<CustomAudioFile[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = async () => setAudios(await getAllCustomAudios());

  useEffect(() => {
    refresh().catch(error => console.warn('Unable to load local audio library:', error));
  }, []);

  const selectPreset = () => {
    stopAllAudio();
    setPlayingId('beep_short');
    onSettingsChange({...settings, audioSourceType: 'preset', audioPresetId: 'beep_short', customAudioId: null});
    onCustomAudioSaved(null);
    playPresetSound('beep_short', 1, settings.audioVolume / 100);
    setTimeout(() => setPlayingId(null), 600);
  };

  const selectCustom = (audio: CustomAudioFile) => {
    onSettingsChange({...settings, audioSourceType: 'custom', customAudioId: audio.id});
    onCustomAudioSaved(audio);
    setMessage(lang === 'uk' ? 'Локальний файл вибрано' : 'Local file selected');
  };

  const previewCustom = async (audio: CustomAudioFile) => {
    if (playingId === audio.id) {
      stopAllAudio();
      setPlayingId(null);
      return;
    }
    setPlayingId(audio.id);
    try {
      await playCustomSound(audio.blob, audio.name, settings.audioVolume / 100);
    } catch {
      setMessage(lang === 'uk' ? 'Файл не відтворюється' : 'File cannot be played');
    } finally {
      setPlayingId(null);
    }
  };

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > MAX_AUDIO_BYTES) {
      setMessage(lang === 'uk' ? 'Максимальний розмір файлу — 12 MB' : 'Maximum file size is 12 MB');
      return;
    }
    if (!ACCEPTED_TYPES.includes(file.type) && !/\.(mp3|m4a|wav|aac|ogg)$/i.test(file.name)) {
      setMessage(lang === 'uk' ? 'Підтримуються MP3, M4A, WAV, AAC та OGG' : 'Use MP3, M4A, WAV, AAC, or OGG');
      return;
    }

    const record: CustomAudioFile = {
      id: `custom_${Date.now()}`,
      name: file.name,
      blob: file,
      size: file.size,
      mimeType: file.type || 'audio/mpeg',
      timestamp: Date.now(),
    };
    try {
      await saveCustomAudio(record);
      await refresh();
      selectCustom(record);
      window.dispatchEvent(new Event('custom-audios-updated'));
      setMessage(lang === 'uk' ? 'Файл збережено офлайн' : 'File saved offline');
    } catch (error) {
      const quota = error instanceof DOMException && error.name === 'QuotaExceededError';
      setMessage(quota
        ? (lang === 'uk' ? 'Недостатньо місця у сховищі' : 'Not enough storage space')
        : (lang === 'uk' ? 'Не вдалося зберегти файл' : 'Could not save file'));
    }
  };

  const remove = async (audio: CustomAudioFile) => {
    stopAllAudio();
    await deleteCustomAudio(audio.id);
    if (settings.customAudioId === audio.id) selectPreset();
    await refresh();
    window.dispatchEvent(new Event('custom-audios-updated'));
  };

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={selectPreset}
        className={`w-full p-3 rounded-xl border flex items-center gap-3 text-left ${settings.audioSourceType === 'preset' ? 'border-[#F27D26] bg-[#F27D26]/10' : 'border-gray-800 bg-black/30'}`}
      >
        <Music className="w-5 h-5 text-[#F27D26]" />
        <span className="flex-1 text-xs font-bold">{AUDIO_PRESETS[0].name}</span>
        {settings.audioSourceType === 'preset' && <Check className="w-4 h-4 text-[#F27D26]" />}
      </button>

      <div className="space-y-2">
        {audios.map(audio => {
          const selected = settings.audioSourceType === 'custom' && settings.customAudioId === audio.id;
          return (
            <div key={audio.id} className={`p-3 rounded-xl border flex items-center gap-2 ${selected ? 'border-[#F27D26] bg-[#F27D26]/10' : 'border-gray-800 bg-black/30'}`}>
              <button type="button" onClick={() => selectCustom(audio)} className="flex-1 min-w-0 text-left">
                <p className="text-xs font-bold truncate">{audio.name}</p>
                <p className="text-[10px] text-gray-500">{(audio.size / 1024 / 1024).toFixed(2)} MB · {lang === 'uk' ? 'офлайн' : 'offline'}</p>
              </button>
              <button type="button" aria-label={lang === 'uk' ? 'Прослухати' : 'Preview'} onClick={() => previewCustom(audio)} className="w-9 h-9 rounded-lg bg-gray-800 flex items-center justify-center">
                {playingId === audio.id ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <button type="button" aria-label={lang === 'uk' ? 'Видалити' : 'Delete'} onClick={() => remove(audio)} className="w-9 h-9 rounded-lg bg-gray-800 text-rose-400 flex items-center justify-center">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      <input ref={inputRef} className="hidden" type="file" accept="audio/mpeg,audio/mp4,audio/wav,audio/aac,audio/ogg,.mp3,.m4a,.wav,.aac,.ogg" onChange={upload} />
      <button type="button" onClick={() => inputRef.current?.click()} className="w-full h-12 rounded-xl bg-[#F27D26] text-black font-black text-xs flex items-center justify-center gap-2">
        <Upload className="w-4 h-4" />
        {lang === 'uk' ? 'ДОДАТИ ФАЙЛ ІЗ ТЕЛЕФОНУ' : 'ADD FILE FROM PHONE'}
      </button>
      {message && <p role="status" className="text-xs text-[#F27D26] text-center">{message}</p>}
    </div>
  );
}
