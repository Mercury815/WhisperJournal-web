import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
    duckVolume,
    playAudio,
    setWeatherAudio,
    getAmbientVolume,
    setAmbientVolume,
} from '../lib/audioService';
import { Volume2, VolumeX, Smile, Save, SlidersHorizontal } from 'lucide-react';
import { saveEntry, getEntryForToday, type JournalEntry } from '../lib/store';
import { cn } from '../lib/utils';
import { useEnvironmentStore, getEffectiveEnv, type TimePhase, type WeatherType } from '../lib/environment';
import { useAppStore } from '../lib/authStore';
import { authApi } from '../lib/api';

interface Props {
  onOpenCalendar: () => void;
}

const EMOJI_OPTIONS = ['😊', '😌', '🌼', '🌿', '💪', '✨', '😐', '🌫', '😴', '😢', '😰', '😤'];

const WEATHER_ICONS: Record<string, string> = {
    sunny: '☀️',
    rain: '🌧️',
    snow: '❄️',
    cloudy: '☁️'
};

const WEATHER_LABELS: Record<string, string> = {
    sunny: 'Clear Skies',
    rain: 'Light Rain',
    snow: 'Gentle Snow',
    cloudy: 'Overcast'
};

const TIME_PHASE_LABELS: Record<TimePhase, string> = {
    dawn: '清晨',
    day: '白天',
    dusk: '傍晚',
    night: '夜晚',
};

const WEATHER_LABELS_FREE: Record<WeatherType, string> = {
    sunny: '晴',
    rain: '雨',
    snow: '雪',
    cloudy: '阴',
};

const TIME_PHASES: TimePhase[] = ['dawn', 'day', 'dusk', 'night'];
const WEATHER_TYPES: WeatherType[] = ['sunny', 'cloudy', 'rain', 'snow'];

export const WritingPage: React.FC<Props> = ({ onOpenCalendar }) => {
    const [text, setText] = useState('');
    const [emotions, setEmotions] = useState<string[]>(['😐']);
    const [isZenMode, setIsZenMode] = useState(false);
    const [isAudioPlaying, setIsAudioPlaying] = useState(true);
    const [ambientVolume, setAmbientVolumeState] = useState(() => getAmbientVolume());
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'typing'>('saved');
    
    const [showEmotionPicker, setShowEmotionPicker] = useState(false);
    const [showLoginHint, setShowLoginHint] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [authModalTab, setAuthModalTab] = useState<'login' | 'register'>('login');
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [regPasswordConfirm, setRegPasswordConfirm] = useState('');
    const [acceptTerms, setAcceptTerms] = useState(false);
    const [showSuccessGlow, setShowSuccessGlow] = useState(false);
    const [showZenHintDismissed, setShowZenHintDismissed] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [emailStatus, setEmailStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
    const [showSaveSyncPrompt, setShowSaveSyncPrompt] = useState(false);
    const [showFreeSettingsPanel, setShowFreeSettingsPanel] = useState(false);
    
    const weather = useEnvironmentStore(state => getEffectiveEnv(state).weather);
    const timePhase = useEnvironmentStore(state => getEffectiveEnv(state).timePhase);
    const setTypingIntensity = useEnvironmentStore(state => state.setTypingIntensity);
    const freeMode = useEnvironmentStore((s) => s.freeMode);
    const freeTimePhase = useEnvironmentStore((s) => s.freeTimePhase);
    const freeWeather = useEnvironmentStore((s) => s.freeWeather);
    const setFreeModeStore = useEnvironmentStore((s) => s.setFreeMode);
    const setFreeEnvironmentStore = useEnvironmentStore((s) => s.setFreeEnvironment);

    const {
        isAnonymous,
        hasUnsyncedData,
        markUnsynced,
        syncStatus,
        login,
        register,
        email,
        logout,
        showSyncPrompt,
        syncAnonymousEntries,
        dismissSyncPrompt,
        userId,
        loadUserEntries,
        entries,
        pushDiaryToServer,
    } = useAppStore();

    const persistDiaryLocalThenCloud = (entry: JournalEntry) => {
        saveEntry(entry, isAnonymous ? undefined : userId);
        if (!isAnonymous && userId) {
            const latest = getEntryForToday(userId);
            if (latest) {
                void pushDiaryToServer(latest);
            }
        }
    };

    /** 写入日记，根据是否登录选择不同的存储位置 */
    const flushLocalOnly = () => {
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        setSaveStatus('saving');
        duckVolume(false);
        setTypingIntensity(0);
        persistDiaryLocalThenCloud({
            id: entryIdRef.current,
            date: new Date().toISOString(),
            content: text,
            emotions,
        });
        setTimeout(() => setSaveStatus('saved'), 600);
    };

    const handleManualSave = () => {
        flushLocalOnly();
        // 如果是匿名用户，显示同步提示
        if (isAnonymous && text.trim().length > 0) {
            setShowSaveSyncPrompt(true);
        }
    };

    const openAuthModal = (tab: 'login' | 'register' = 'login') => {
        setAuthModalTab(tab);
        setShowLoginModal(true);
        duckVolume(true);
    };

    const closeAuthModal = () => {
        setShowLoginModal(false);
        setAuthError(null);
        duckVolume(false);
    };

    const handleLogout = async () => {
        await logout();
    };

    /** 避免輸入過程中（如 admin@、admin@qq.）反覆打 API，也減少後端未啟動時的代理錯誤日誌 */
    const looksLikeFullEmail = (s: string) =>
        /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());

    // 检查邮箱是否已注册
    const checkEmailExists = async (email: string) => {
        if (!email.trim()) {
            setEmailStatus('idle');
            return;
        }
        if (!looksLikeFullEmail(email)) {
            setEmailStatus('idle');
            return;
        }

        setEmailStatus('checking');
        try {
            const result = await authApi.checkEmail(email);
            if (result.exists) {
                setEmailStatus('taken');
            } else {
                setEmailStatus('available');
            }
        } catch (error) {
            console.error('检查邮箱失败:', error);
            // API不可用时，设置为idle状态，不阻止注册
            setEmailStatus('idle');
        }
    };

    // 防抖检查邮箱
    const emailCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const handleEmailChange = (value: string, isRegister: boolean) => {
        if (isRegister) {
            setLoginEmail(value);
            if (emailCheckTimeoutRef.current) {
                clearTimeout(emailCheckTimeoutRef.current);
            }
            emailCheckTimeoutRef.current = setTimeout(() => {
                checkEmailExists(value);
            }, 500);
        } else {
            setLoginEmail(value);
        }
    };

    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
    const entryIdRef = useRef<string>(crypto.randomUUID());
    const hintDismissedRef = useRef(false);
    const freeModeHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const freeModeLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearFreeModeTimers = () => {
        if (freeModeHoverTimerRef.current) {
            clearTimeout(freeModeHoverTimerRef.current);
            freeModeHoverTimerRef.current = null;
        }
        if (freeModeLeaveTimerRef.current) {
            clearTimeout(freeModeLeaveTimerRef.current);
            freeModeLeaveTimerRef.current = null;
        }
    };

    const scheduleCloseFreeSettingsPanel = () => {
        if (freeModeLeaveTimerRef.current) clearTimeout(freeModeLeaveTimerRef.current);
        freeModeLeaveTimerRef.current = setTimeout(() => {
            setShowFreeSettingsPanel(false);
            freeModeLeaveTimerRef.current = null;
        }, 1000);
    };

    const cancelCloseFreeSettingsPanel = () => {
        if (freeModeLeaveTimerRef.current) {
            clearTimeout(freeModeLeaveTimerRef.current);
            freeModeLeaveTimerRef.current = null;
        }
    };

    useEffect(() => {
        let todayEntry: JournalEntry | null = null;
        if (isAnonymous || !userId) {
            todayEntry = getEntryForToday(undefined);
        } else {
            todayEntry = getEntryForToday(userId);
            if (!todayEntry && entries.length > 0) {
                const today = new Date().toDateString();
                todayEntry = entries.find((e) => new Date(e.date).toDateString() === today) ?? null;
            }
        }
        if (todayEntry) {
            setText(todayEntry.content);
            setEmotions(todayEntry.emotions);
            entryIdRef.current = todayEntry.id;
        } else {
            setText('');
            setEmotions(['😐']);
            entryIdRef.current = crypto.randomUUID();
        }
    }, [isAnonymous, userId, entries]);

    useEffect(() => {
        playAudio();
        setIsAudioPlaying(true);
    }, [isAnonymous, userId]);

    useEffect(() => {
        if (!isAnonymous) {
            loadUserEntries();
        }
    }, [isAnonymous, userId, loadUserEntries]);

    useEffect(() => () => clearFreeModeTimers(), []);

    const handleFreeModeClick = () => {
        const st = useEnvironmentStore.getState();
        const next = !st.freeMode;
        setFreeModeStore(next);
        clearFreeModeTimers();
        if (next) {
            setWeatherAudio(st.freeWeather);
            setShowFreeSettingsPanel(true);
        } else {
            setWeatherAudio(getEffectiveEnv(useEnvironmentStore.getState()).weather);
            setShowFreeSettingsPanel(false);
        }
    };

    const handleFreeModeClusterEnter = () => {
        cancelCloseFreeSettingsPanel();
    };

    const handleFreeModeClusterLeave = () => {
        if (freeModeHoverTimerRef.current) {
            clearTimeout(freeModeHoverTimerRef.current);
            freeModeHoverTimerRef.current = null;
        }
        scheduleCloseFreeSettingsPanel();
    };

    const handleFreeModeButtonMouseEnter = () => {
        if (!freeMode) return;
        if (freeModeHoverTimerRef.current) clearTimeout(freeModeHoverTimerRef.current);
        freeModeHoverTimerRef.current = setTimeout(() => {
            setShowFreeSettingsPanel(true);
            freeModeHoverTimerRef.current = null;
        }, 1000);
    };

    const handleFreeModeButtonMouseLeave = () => {
        if (freeModeHoverTimerRef.current) {
            clearTimeout(freeModeHoverTimerRef.current);
            freeModeHoverTimerRef.current = null;
        }
    };

    const handleFreeTimePick = (tp: TimePhase) => {
        setFreeEnvironmentStore({ timePhase: tp });
    };

    const handleFreeWeatherPick = (w: WeatherType) => {
        setFreeEnvironmentStore({ weather: w });
        setWeatherAudio(w);
    };

    const handleAmbientVolumeChange = (value: number) => {
        const v = value / 100;
        setAmbientVolumeState(v);
        setAmbientVolume(v);
        setIsAudioPlaying(v > 0);
    };

    const handleVolumeMuteToggle = () => {
        if (ambientVolume > 0) {
            setAmbientVolume(0);
            setAmbientVolumeState(0);
            setIsAudioPlaying(false);
        } else {
            const restore = 0.35;
            setAmbientVolume(restore);
            setAmbientVolumeState(restore);
            playAudio();
            setIsAudioPlaying(true);
        }
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                setIsZenMode(prev => !prev);
                setShowZenHintDismissed(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (useAppStore.getState().hasUnsyncedData) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newText = e.target.value;
        setText(newText);
        setSaveStatus('typing');
        duckVolume(true);
        setTypingIntensity(1);
        
        markUnsynced();
        
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        
        idleTimerRef.current = setTimeout(() => {
            if (isAnonymous && !hintDismissedRef.current && newText.trim().length > 30) {
                setShowLoginHint(true);
            }
        }, 10000);
        
        typingTimeoutRef.current = setTimeout(() => {
            setSaveStatus('saving');
            duckVolume(false);
            setTypingIntensity(0);
            
            persistDiaryLocalThenCloud({
                id: entryIdRef.current,
                date: new Date().toISOString(),
                content: newText,
                emotions,
            });

            setTimeout(() => setSaveStatus('saved'), 600);
        }, 3000);
    };

    const handleEmotionSelect = (emoji: string) => {
        const newEmotions = emotions.includes(emoji) 
            ? emotions.filter(e => e !== emoji) 
            : [...emotions, emoji].slice(-3);
            
        setEmotions(newEmotions);
        markUnsynced();
        
        persistDiaryLocalThenCloud({
            id: entryIdRef.current,
            date: new Date().toISOString(),
            content: text,
            emotions: newEmotions,
        });
    };
    
    const handleOpenCalendar = () => {
        if (isAnonymous && hasUnsyncedData && !hintDismissedRef.current) {
            setShowLoginHint(true);
        } else {
            onOpenCalendar();
        }
    };

    const handleLoginSubmit = async () => {
        const emailVal = loginEmail.trim();
        if (!emailVal || !loginPassword) {
          setAuthError('请填写邮箱和密码');
          return;
        }
        
        setIsLoading(true);
        setAuthError(null);
        
        try {
          await login(emailVal, loginPassword);
          closeAuthModal();
          setShowSuccessGlow(true);
          setTimeout(() => setShowSuccessGlow(false), 2000);
          useAppStore.getState().markUnsynced();
        } catch (error: any) {
          console.error('Login error:', error);
          const errorMsg = error?.message || '登录失败，请检查邮箱和密码';
          if (errorMsg.includes('请求失败: 500') || /500/.test(errorMsg)) {
            setAuthError('无法连接服务器（请确认已启动 Redis 与后端，并检查终端日志）');
          } else {
            setAuthError(errorMsg);
          }
        } finally {
          setIsLoading(false);
        }
    };

    const handleRegisterSubmit = async () => {
        if (!loginEmail.trim()) {
          setAuthError('请填写邮箱');
          return;
        }
        if (loginPassword !== regPasswordConfirm) {
          setAuthError('两次输入的密码不一致');
          return;
        }
        if (!acceptTerms) {
          setAuthError('请同意隐私政策和服务条款');
          return;
        }
        
        setIsLoading(true);
        setAuthError(null);
        
        // 提交前再次检查邮箱是否已注册
        try {
          const result = await authApi.checkEmail(loginEmail);
          if (result.exists) {
            setAuthError('该邮箱已被注册，请直接登录');
            setIsLoading(false);
            setEmailStatus('taken');
            return;
          }
          setEmailStatus('available');
        } catch (error) {
          // API不可用时继续注册，会在后端再次检查
          console.log('邮箱检查API不可用，继续注册流程');
        }
        
        try {
          await register(loginEmail.trim(), loginPassword, regPasswordConfirm, acceptTerms);
          closeAuthModal();
          setShowSuccessGlow(true);
          setTimeout(() => setShowSuccessGlow(false), 2000);
          setRegPasswordConfirm('');
          setAcceptTerms(false);
          useAppStore.getState().markUnsynced();
        } catch (error: any) {
          console.error('Register error:', error);
          const code = error?.code as string | undefined;
          const errorMsg = error?.message || '注册失败，请稍后重试';
          if (
            code === 'AUTH_EMAIL_TAKEN' ||
            /已被注册|Conflict|409/i.test(errorMsg)
          ) {
            setAuthError('该邮箱已被注册，请在上方切换到 Log in 登录');
            setEmailStatus('taken');
            setAuthModalTab('login');
          } else if (errorMsg.includes('请求失败: 500') || /\b500\b/.test(errorMsg)) {
            setAuthError('无法连接服务器（请确认已启动 Redis 与后端）');
          } else {
            setAuthError(errorMsg);
          }
        } finally {
          setIsLoading(false);
        }
    };

    const wordCount = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;

    const formatDateForTop = () => {
        return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const isNight = timePhase === 'night';
    const textColor = isNight ? 'text-[#EAF4FF]' : 'text-[#2B2D42]';
    const subTextColor = isNight ? 'text-[#EAF4FF]/40' : 'text-[#2B2D42]/40';
    const activeIconColor = isNight ? 'text-[#EAF4FF]/60' : 'text-[#2B2D42]/60';
    const cardBg = isNight ? 'bg-[#182C4B]/40 border-white/10' : 'bg-white/35 border-white/20';

    return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } }}
            exit={{ opacity: 0, scale: 0.98, y: -10, transition: { duration: 0.4 } }}
            className={`fixed inset-0 z-20 pointer-events-none font-sans select-none ${textColor}`}
        >
            {/* 日记卡片：固定视口正中，独立图层 */}
            <motion.div className="pointer-events-none fixed inset-0 z-[22] flex items-center justify-center px-6 md:px-10">
                <motion.div
                    animate={{ y: [-10, 10, -10] }}
                    transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }}
                    className={cn(
                        `w-[640px] max-w-full ${cardBg} backdrop-blur-[32px] rounded-[28px] p-10 flex flex-col pointer-events-auto transition-all duration-700 h-[min(350px,70vh)]`,
                        saveStatus === 'typing'
                            ? isNight
                                ? 'bg-[#182C4B]/60 shadow-sm'
                                : 'bg-white/50 shadow-sm'
                            : 'shadow-[0_8px_32px_rgba(0,0,0,0.06)]',
                        isZenMode && 'scale-[1.02] shadow-[0_32px_64px_rgba(0,0,0,0.06)]',
                        showSuccessGlow && 'shadow-[0_0_40px_rgba(168,208,141,0.4)]',
                    )}
                >
                    <motion.div className="flex flex-col space-y-6 h-full border-transparent">
                        <motion.div className="flex justify-between items-center shrink-0">
                            <span className={`text-[28px] font-medium ${textColor} tracking-tight`}>WhisperJournal</span>
                            <span className={`text-[13px] ${subTextColor} italic`}>{formatDateForTop()}</span>
                        </motion.div>

                        <textarea
                            value={text}
                            onChange={handleChange}
                            placeholder="The sound of the world around you is rhythmic and soothing..."
                            className={`w-full flex-1 bg-transparent resize-none outline-none ${textColor} opacity-80 placeholder-current/40 text-[16px] leading-[26px] font-sans`}
                        />

                        <motion.div className={`h-px w-full ${isNight ? 'bg-white/10' : 'bg-[#2B2D42]/10'} shrink-0`} />

                        <motion.div className={`flex justify-between items-center text-[13px] ${subTextColor} shrink-0`}>
                            <motion.div className="flex items-center space-x-2">
                                <motion.div
                                    className={cn(
                                        'w-2 h-2 rounded-full',
                                        saveStatus === 'saving' || saveStatus === 'typing' || syncStatus === 'syncing'
                                            ? 'bg-[#A8D08D] animate-pulse'
                                            : isNight
                                              ? 'bg-white/20'
                                              : 'bg-[#2B2D42]/20',
                                    )}
                                />
                                <span>
                                    {saveStatus === 'typing' && 'Typing...'}
                                    {saveStatus === 'saving' && 'Saving locally...'}
                                    {saveStatus === 'saved' && syncStatus === 'syncing' && 'Syncing...'}
                                    {saveStatus === 'saved' && syncStatus === 'unsynced' && 'Unsynced'}
                                    {saveStatus === 'saved' && (syncStatus === 'saved' || syncStatus === 'idle') && 'Saved'}
                                </span>
                            </motion.div>
                            <motion.div className="flex items-center space-x-4">
                                <button
                                    type="button"
                                    onClick={handleManualSave}
                                    className={cn(
                                        'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-[12px] font-medium transition-all pointer-events-auto',
                                        isNight
                                            ? 'border-white/15 bg-white/5 hover:bg-white/10 text-[#EAF4FF]/90'
                                            : 'border-[#2B2D42]/15 bg-black/[0.03] hover:bg-black/[0.06] text-[#2B2D42]/90',
                                    )}
                                    aria-label="保存"
                                >
                                    <Save size={14} strokeWidth={2} />
                                    保存
                                </button>
                                <AnimatePresence>
                                    {showSuccessGlow && (
                                        <motion.span
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="text-[#A8D08D] font-medium"
                                        >
                                            已经帮你留住了
                                        </motion.span>
                                    )}
                                </AnimatePresence>
                                <span>{wordCount} words</span>
                            </motion.div>
                        </motion.div>
                    </motion.div>
                </motion.div>
            </motion.div>

            <AnimatePresence>
                {!isZenMode && (
                    <>
                        {/* 左上：心情 + 天气 */}
                        <motion.div
                            initial={{ opacity: 0, y: -12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -12 }}
                            className="fixed top-8 left-8 z-40 flex flex-col items-start gap-3 pointer-events-none"
                        >
                            <motion.div className="relative pointer-events-auto">
                                <button
                                    type="button"
                                    onClick={() => setShowEmotionPicker((v) => !v)}
                                    className={`flex items-center justify-center ${cardBg} backdrop-blur-lg px-5 py-3 rounded-[20px] border shadow-sm hover:bg-white/50 transition-all min-w-[64px]`}
                                    aria-expanded={showEmotionPicker}
                                    aria-haspopup="true"
                                >
                                    <span className="flex space-x-2 text-xl font-['Apple_Color_Emoji','Segoe_UI_Emoji','Noto_Color_Emoji'] tracking-widest">
                                        {emotions.length > 0
                                            ? emotions.map((e, idx) => <span key={idx}>{e}</span>)
                                            : <Smile size={20} />}
                                    </span>
                                </button>

                                <AnimatePresence>
                                    {showEmotionPicker && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.96, y: -4 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.96, y: -4 }}
                                            className="absolute left-0 top-full z-50 pt-2"
                                        >
                                            <motion.div
                                                className={cn(
                                                    cardBg,
                                                    'backdrop-blur-lg rounded-[20px] border shadow-lg p-4 w-[248px] grid grid-cols-4 gap-3 place-items-center',
                                                )}
                                            >
                                                {EMOJI_OPTIONS.map((emoji) => (
                                                    <button
                                                        key={emoji}
                                                        type="button"
                                                        onClick={() => handleEmotionSelect(emoji)}
                                                        className={cn(
                                                            'w-12 h-12 shrink-0 flex items-center justify-center rounded-full border border-transparent hover:border-white/20 hover:bg-white/40 transition-all text-[22px] leading-none',
                                                            emotions.includes(emoji) &&
                                                                'bg-white/50 border-white/30 shadow-sm scale-105',
                                                        )}
                                                    >
                                                        {emoji}
                                                    </button>
                                                ))}
                                            </motion.div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>

                            <motion.div
                                className={cn(
                                    'flex flex-col items-center pointer-events-auto',
                                    cardBg,
                                    'backdrop-blur-lg rounded-[20px] border px-4 py-3 min-w-[72px] shadow-sm',
                                )}
                            >
                                <span className={`text-xl leading-none ${textColor}`}>{WEATHER_ICONS[weather]}</span>
                                <span className={`text-[11px] ${subTextColor} font-mono mt-1.5 text-center whitespace-nowrap`}>
                                    {WEATHER_LABELS[weather]}
                                </span>
                            </motion.div>
                        </motion.div>

                        {/* 右上：登录 */}
                        <motion.div
                            initial={{ opacity: 0, y: -12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -12 }}
                            className="fixed top-8 right-8 z-40 pointer-events-auto"
                        >
                            {isAnonymous ? (
                                <motion.div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => openAuthModal('login')}
                                        className={cn(
                                            'text-[13px] font-medium tracking-wide underline underline-offset-4 decoration-white/30 hover:opacity-90 transition-opacity',
                                            isNight ? 'text-[#EAF4FF]/90' : 'text-[#2B2D42]/90',
                                        )}
                                    >
                                        Log in
                                    </button>
                                    <span className={cn('text-[12px] opacity-40 select-none', subTextColor)} aria-hidden>
                                        ·
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => openAuthModal('register')}
                                        className={cn(
                                            'text-[13px] font-medium tracking-wide underline underline-offset-4 decoration-white/30 hover:opacity-90 transition-opacity',
                                            isNight ? 'text-[#EAF4FF]/90' : 'text-[#2B2D42]/90',
                                        )}
                                    >
                                        Sign up
                                    </button>
                                </motion.div>
                            ) : (
                                <motion.div className="flex items-center gap-3">
                                    <span className={cn('text-[12px] font-medium', subTextColor)}>{email || 'Signed in'}</span>
                                    <button
                                        type="button"
                                        onClick={handleLogout}
                                        className={cn(
                                            'text-[12px] font-medium underline underline-offset-4 decoration-white/30 hover:opacity-90 transition-opacity',
                                            isNight ? 'text-[#EAF4FF]/70' : 'text-[#2B2D42]/70',
                                        )}
                                    >
                                        Log out
                                    </button>
                                </motion.div>
                            )}
                        </motion.div>

                        {/* 右侧贴边：竖向音量 */}
                        <motion.div
                            initial={{ opacity: 0, x: 12 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 12 }}
                            className={cn(
                                'fixed right-3 top-1/2 -translate-y-1/2 z-40 pointer-events-auto flex flex-col items-center gap-2 py-3 px-2 rounded-[20px] border',
                                cardBg,
                                'backdrop-blur-lg shadow-sm',
                            )}
                        >
                            <button
                                type="button"
                                onClick={handleVolumeMuteToggle}
                                className={cn('p-1.5 rounded-full hover:bg-white/20 transition-colors', activeIconColor)}
                                aria-label={ambientVolume > 0 ? '静音' : '恢复音量'}
                            >
                                {ambientVolume > 0 ? <Volume2 size={18} /> : <VolumeX size={18} />}
                            </button>
                            <motion.div className="relative h-28 w-8 flex items-center justify-center">
                                <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    step={1}
                                    value={Math.round(ambientVolume * 100)}
                                    onChange={(e) => handleAmbientVolumeChange(Number(e.target.value))}
                                    aria-label="环境音量"
                                    className={cn(
                                        'volume-slider-vertical',
                                        isNight ? 'accent-[#EAF4FF]/80' : 'accent-[#2B2D42]/70',
                                    )}
                                />
                            </motion.div>
                        </motion.div>

                        {/* 左下：自由模式 */}
                        <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 12 }}
                            className="fixed bottom-8 left-8 z-40 pointer-events-auto"
                            onMouseEnter={handleFreeModeClusterEnter}
                            onMouseLeave={handleFreeModeClusterLeave}
                        >
                            <button
                                type="button"
                                onClick={handleFreeModeClick}
                                onMouseEnter={handleFreeModeButtonMouseEnter}
                                onMouseLeave={handleFreeModeButtonMouseLeave}
                                className={cn(
                                    'flex items-center gap-2 px-3 py-2 rounded-full border text-[12px] font-medium transition-all',
                                    cardBg,
                                    'backdrop-blur-lg shadow-sm hover:bg-white/50',
                                    freeMode &&
                                        (isNight ? 'ring-1 ring-white/25 bg-white/10' : 'ring-1 ring-[#2B2D42]/15 bg-white/55'),
                                )}
                                aria-pressed={freeMode}
                                aria-expanded={showFreeSettingsPanel}
                            >
                                <SlidersHorizontal size={14} strokeWidth={2} className={activeIconColor} />
                                自由模式 {freeMode ? '开' : '关'}
                            </button>

                            <AnimatePresence>
                                {freeMode && showFreeSettingsPanel && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 8 }}
                                        className="absolute left-0 bottom-full z-50 pb-2"
                                    >
                                        <motion.div
                                            className={cn(
                                                'flex flex-col items-start gap-2 p-3 rounded-[16px] border w-[min(calc(100vw-4rem),300px)]',
                                                cardBg,
                                                'backdrop-blur-lg shadow-lg',
                                            )}
                                        >
                                            <span className={`text-[10px] uppercase tracking-wider ${subTextColor}`}>时段</span>
                                            <motion.div className="flex flex-wrap gap-1.5">
                                                {TIME_PHASES.map((tp) => (
                                                    <button
                                                        key={tp}
                                                        type="button"
                                                        onClick={() => handleFreeTimePick(tp)}
                                                        className={cn(
                                                            'px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors',
                                                            freeTimePhase === tp
                                                                ? isNight
                                                                    ? 'bg-white/20 border-white/30 text-[#EAF4FF]'
                                                                    : 'bg-[#2B2D42]/15 border-[#2B2D42]/25 text-[#2B2D42]'
                                                                : isNight
                                                                  ? 'border-white/10 bg-black/15 text-[#EAF4FF]/80 hover:bg-white/10'
                                                                  : 'border-black/10 bg-black/[0.04] text-[#2B2D42]/85 hover:bg-black/[0.07]',
                                                        )}
                                                    >
                                                        {TIME_PHASE_LABELS[tp]}
                                                    </button>
                                                ))}
                                            </motion.div>
                                            <span className={`text-[10px] uppercase tracking-wider ${subTextColor} mt-1`}>天气</span>
                                            <motion.div className="flex flex-wrap gap-1.5">
                                                {WEATHER_TYPES.map((w) => (
                                                    <button
                                                        key={w}
                                                        type="button"
                                                        onClick={() => handleFreeWeatherPick(w)}
                                                        className={cn(
                                                            'px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors inline-flex items-center gap-1',
                                                            freeWeather === w
                                                                ? isNight
                                                                    ? 'bg-white/20 border-white/30 text-[#EAF4FF]'
                                                                    : 'bg-[#2B2D42]/15 border-[#2B2D42]/25 text-[#2B2D42]'
                                                                : isNight
                                                                  ? 'border-white/10 bg-black/15 text-[#EAF4FF]/80 hover:bg-white/10'
                                                                  : 'border-black/10 bg-black/[0.04] text-[#2B2D42]/85 hover:bg-black/[0.07]',
                                                        )}
                                                    >
                                                        <span>{WEATHER_ICONS[w]}</span>
                                                        {WEATHER_LABELS_FREE[w]}
                                                    </button>
                                                ))}
                                            </motion.div>
                                        </motion.div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>

                        {/* 右下：禅意提示 + 日历 */}
                        <motion.footer
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 12 }}
                            className="fixed bottom-8 right-8 z-40 flex flex-col items-end gap-3 pointer-events-none"
                        >
                            <AnimatePresence>
                                {!showZenHintDismissed && (
                                    <motion.div
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0, transition: { delay: 1.5, duration: 0.5 } }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        className={`px-4 py-2 ${cardBg} backdrop-blur-md ${subTextColor} border rounded-full text-[12px] shadow-sm flex items-center pointer-events-auto`}
                                    >
                                        <span>
                                            Press{' '}
                                            <kbd
                                                className={`font-sans px-1.5 py-0.5 border ${isNight ? 'border-white/20 bg-white/5' : 'border-black/10 bg-black/5'} rounded-md mx-1`}
                                            >
                                                Tab
                                            </kbd>{' '}
                                            for Zen Mode
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setShowZenHintDismissed(true)}
                                            className="hover:text-current hover:opacity-100 opacity-50 ml-3"
                                        >
                                            ✕
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <motion.div className="flex items-center gap-6 pointer-events-auto">
                                <motion.div className="flex flex-col items-end hidden sm:flex">
                                    <span className={`text-[11px] uppercase tracking-[0.2em] ${subTextColor} font-bold mb-3`}>
                                        History
                                    </span>
                                    <motion.div className="flex space-x-1">
                                        <motion.div className="w-2.5 h-2.5 bg-[#95D5B2] rounded-[2px]" />
                                        <motion.div className="w-2.5 h-2.5 bg-[#B7E4C7] rounded-[2px]" />
                                        <motion.div className="w-2.5 h-2.5 bg-white/20 rounded-[2px] opacity-50" />
                                        <motion.div className="w-2.5 h-2.5 bg-[#95D5B2] rounded-[2px]" />
                                        <motion.div className="w-2.5 h-2.5 bg-[#B7E4C7] rounded-[2px] scale-125 shadow-sm" />
                                    </motion.div>
                                </motion.div>
                                <button
                                    type="button"
                                    onClick={handleOpenCalendar}
                                    className={`w-14 h-14 flex items-center justify-center ${cardBg} backdrop-blur-lg rounded-full border shadow-sm ${textColor} hover:bg-white/70 hover:scale-105 transition-all text-xl`}
                                >
                                    📅
                                </button>
                            </motion.div>
                        </motion.footer>
                    </>
                )}
            </AnimatePresence>

            {/* Login Hint Layer */}
            <AnimatePresence>
                {showLoginHint && (
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 50 }}
                        className={`absolute bottom-[100px] left-1/2 -translate-x-1/2 z-40 ${isNight ? 'bg-[#182C4B]/80 text-[#EAF4FF] border-white/10' : 'bg-white/80 text-[#2B2D42] border-white/20'} backdrop-blur-xl rounded-2xl p-4 px-6 flex items-center space-x-8 shadow-xl border pointer-events-auto`}
                    >
                        <div className="flex flex-col">
                            <span className="font-medium text-[15px]">要不要把这一刻同步到云端？</span>
                            {!isZenMode && <span className="text-[13px] opacity-70 mt-0.5">这样你不会丢失它</span>}
                        </div>
                        <div className="flex items-center space-x-4">
                            <button onClick={() => {
                                setShowLoginHint(false);
                                hintDismissedRef.current = true;
                            }} className="text-[13px] opacity-60 hover:opacity-100 transition-opacity">忽略</button>
                            <button onClick={() => {
                                setShowLoginHint(false);
                                openAuthModal('login');
                            }} className="bg-[#A8D08D] text-[#2B2D42] px-5 py-2 rounded-full text-[13px] font-medium shadow-sm hover:scale-105 transition-transform">继续保存</button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Login / Register Modal：挂到 body，避免被任意父级 stacking 遮挡 */}
            {typeof document !== 'undefined' &&
                createPortal(
                    <AnimatePresence>
                        {showLoginModal && (
                            <motion.div
                                key="auth-overlay"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="fixed inset-0 z-[1200] flex items-center justify-center pointer-events-auto bg-black/25 backdrop-blur-sm"
                                onClick={(e) => e.target === e.currentTarget && closeAuthModal()}
                            >
                        <div
                            className={`w-[380px] max-w-[calc(100vw-2rem)] ${isNight ? 'bg-[#182C4B]/90 border-white/10 text-white' : 'bg-white/90 border-white/20 text-[#2B2D42]'} backdrop-blur-2xl rounded-[32px] p-8 shadow-2xl border flex flex-col`}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex justify-between items-start mb-4">
                                <span className="font-medium text-lg tracking-wide">
                                    {authModalTab === 'login' ? 'Log in' : 'Sign up'}
                                </span>
                                <button type="button" onClick={closeAuthModal} className="opacity-50 hover:opacity-100 font-bold p-2 -mr-2 -mt-1">✕</button>
                            </div>

                            <div
                                className={cn(
                                    'flex rounded-full p-1 mb-6 border',
                                    isNight ? 'border-white/10 bg-black/20' : 'border-black/5 bg-black/[0.03]',
                                )}
                            >
                                <button
                                    type="button"
                                    onClick={() => setAuthModalTab('login')}
                                    className={cn(
                                        'flex-1 py-2 rounded-full text-[13px] font-medium transition-colors',
                                        authModalTab === 'login'
                                            ? isNight
                                                ? 'bg-white/15 text-white'
                                                : 'bg-[#2B2D42]/10 text-[#2B2D42]'
                                            : 'opacity-60 hover:opacity-90',
                                    )}
                                >
                                    Log in
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAuthModalTab('register')}
                                    className={cn(
                                        'flex-1 py-2 rounded-full text-[13px] font-medium transition-colors',
                                        authModalTab === 'register'
                                            ? isNight
                                                ? 'bg-white/15 text-white'
                                                : 'bg-[#2B2D42]/10 text-[#2B2D42]'
                                            : 'opacity-60 hover:opacity-90',
                                    )}
                                >
                                    Sign up
                                </button>
                            </div>

                            {authError && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[13px]"
                                >
                                    {authError}
                                </motion.div>
                            )}

                            {authModalTab === 'login' ? (
                                <form onSubmit={(e) => { e.preventDefault(); handleLoginSubmit(); }}>
                                    <label className={cn('text-[11px] uppercase tracking-wider mb-1.5 block', subTextColor)}>Email</label>
                                    <input
                                        type="email"
                                        value={loginEmail}
                                        onChange={(e) => handleEmailChange(e.target.value, false)}
                                        placeholder="you@example.com"
                                        autoComplete="email"
                                        className={`w-full bg-black/5 border ${isNight ? 'border-white/10 text-white' : 'border-black/5 text-[#2B2D42]'} rounded-xl px-4 py-3 mb-4 outline-none placeholder-current/40 text-[15px] focus:bg-black/10 transition-colors`}
                                    />
                                    <label className={cn('text-[11px] uppercase tracking-wider mb-1.5 block', subTextColor)}>Password</label>
                                    <input
                                        type="password"
                                        value={loginPassword}
                                        onChange={(e) => setLoginPassword(e.target.value)}
                                        placeholder="••••••••"
                                        autoComplete="current-password"
                                        className={`w-full bg-black/5 border ${isNight ? 'border-white/10 text-white' : 'border-black/5 text-[#2B2D42]'} rounded-xl px-4 py-3 mb-6 outline-none placeholder-current/40 text-[15px] focus:bg-black/10 transition-colors`}
                                    />
                                    <button
                                        type="submit"
                                        disabled={isLoading}
                                        className="w-full bg-[#A8D08D] text-[#2B2D42] py-3.5 rounded-xl font-medium shadow-sm hover:opacity-90 transition-opacity tracking-wide text-[15px] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {isLoading ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-[#2B2D42]/30 border-t-[#2B2D42] rounded-full animate-spin" />
                                                登录中...
                                            </>
                                        ) : 'Log in'}
                                    </button>
                                </form>
                            ) : (
                                <form onSubmit={(e) => { e.preventDefault(); handleRegisterSubmit(); }}>
                                    <label className={cn('text-[11px] uppercase tracking-wider mb-1.5 block', subTextColor)}>Email</label>
                                    <div className="relative">
                                        <input
                                            type="email"
                                            value={loginEmail}
                                            onChange={(e) => handleEmailChange(e.target.value, true)}
                                            placeholder="you@example.com"
                                            autoComplete="email"
                                            className={`w-full bg-black/5 border ${
                                                emailStatus === 'taken' 
                                                    ? 'border-red-500/50' 
                                                    : emailStatus === 'available' 
                                                        ? 'border-green-500/50' 
                                                        : isNight ? 'border-white/10' : 'border-black/5'
                                            } ${isNight ? 'text-white' : 'text-[#2B2D42]'} rounded-xl px-4 py-3 mb-2 outline-none placeholder-current/40 text-[15px] focus:bg-black/10 transition-colors pr-12`}
                                        />
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                            {emailStatus === 'checking' && (
                                                <div className="w-4 h-4 border-2 border-gray-400/50 border-t-gray-400 rounded-full animate-spin" />
                                            )}
                                            {emailStatus === 'available' && (
                                                <span className="text-green-500 text-sm">✓</span>
                                            )}
                                            {emailStatus === 'taken' && (
                                                <span className="text-red-500 text-sm">✗</span>
                                            )}
                                        </div>
                                    </div>
                                    {emailStatus === 'taken' && (
                                        <p className="text-red-500 text-[12px] mb-4">该邮箱已被注册，请直接登录</p>
                                    )}
                                    {emailStatus === 'available' && (
                                        <p className="text-green-500 text-[12px] mb-4">邮箱可用</p>
                                    )}
                                    <label className={cn('text-[11px] uppercase tracking-wider mb-1.5 block', subTextColor)}>Password</label>
                                    <input
                                        type="password"
                                        value={loginPassword}
                                        onChange={(e) => setLoginPassword(e.target.value)}
                                        placeholder="8+ chars, letters & numbers"
                                        autoComplete="new-password"
                                        className={`w-full bg-black/5 border ${isNight ? 'border-white/10 text-white' : 'border-black/5 text-[#2B2D42]'} rounded-xl px-4 py-3 mb-4 outline-none placeholder-current/40 text-[15px] focus:bg-black/10 transition-colors`}
                                    />
                                    <label className={cn('text-[11px] uppercase tracking-wider mb-1.5 block', subTextColor)}>Confirm password</label>
                                    <input
                                        type="password"
                                        value={regPasswordConfirm}
                                        onChange={(e) => setRegPasswordConfirm(e.target.value)}
                                        placeholder="Repeat password"
                                        autoComplete="new-password"
                                        className={`w-full bg-black/5 border ${isNight ? 'border-white/10 text-white' : 'border-black/5 text-[#2B2D42]'} rounded-xl px-4 py-3 mb-4 outline-none placeholder-current/40 text-[15px] focus:bg-black/10 transition-colors`}
                                    />
                                    <label className={cn('flex items-start gap-3 mb-6 cursor-pointer text-[13px] leading-snug', isNight ? 'text-white/80' : 'text-[#2B2D42]/80')}>
                                        <input
                                            type="checkbox"
                                            checked={acceptTerms}
                                            onChange={(e) => setAcceptTerms(e.target.checked)}
                                            className="mt-0.5 rounded border-white/20"
                                        />
                                        <span>I agree to the Privacy Policy and Terms of Service.</span>
                                    </label>
                                    <button
                                        type="submit"
                                        disabled={isLoading}
                                        className="w-full bg-[#A8D08D] text-[#2B2D42] py-3.5 rounded-xl font-medium shadow-sm hover:opacity-90 transition-opacity tracking-wide text-[15px] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {isLoading ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-[#2B2D42]/30 border-t-[#2B2D42] rounded-full animate-spin" />
                                                注册中...
                                            </>
                                        ) : 'Create account'}
                                    </button>
                                </form>
                            )}

                            <p className="mt-5 text-center opacity-40 text-[11px] leading-relaxed">
                                登录/注册后，您的日记将同步到云端保存
                            </p>
                        </div>
                            </motion.div>
                        )}
                    </AnimatePresence>,
                    document.body,
                )}

            {/* Save Sync Prompt - 保存后提示同步 */}
            {typeof document !== 'undefined' &&
                createPortal(
                    <AnimatePresence>
                        {showSaveSyncPrompt && (
                            <motion.div
                                key="save-sync-overlay"
                                initial={{ opacity: 0, y: 50 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 50 }}
                                className="fixed bottom-[100px] left-1/2 -translate-x-1/2 z-[1100] pointer-events-auto"
                            >
                                <div
                                    className={`${isNight ? 'bg-[#182C4B]/90 border-white/10 text-white' : 'bg-white/90 border-white/20 text-[#2B2D42]'} backdrop-blur-2xl rounded-[20px] p-5 shadow-2xl border flex items-center gap-4`}
                                >
                                    <div className="flex-1">
                                        <p className="font-medium text-[14px] mb-1">日记已保存！</p>
                                        <p className={`text-[12px] opacity-70 ${subTextColor}`}>登录或注册后可同步到云端</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowSaveSyncPrompt(false)}
                                            className="px-4 py-2 text-[12px] opacity-60 hover:opacity-100 transition-opacity"
                                        >
                                            稍后
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowSaveSyncPrompt(false);
                                                openAuthModal('login');
                                            }}
                                            className="px-4 py-2 bg-[#A8D08D] text-[#2B2D42] rounded-full text-[12px] font-medium shadow-sm hover:opacity-90 transition-opacity"
                                        >
                                            登录
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>,
                    document.body,
                )}

            {/* Sync Prompt Modal - 登录后提示同步匿名日记 */}
            {typeof document !== 'undefined' &&
                createPortal(
                    <AnimatePresence>
                        {showSyncPrompt && (
                            <motion.div
                                key="sync-overlay"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="fixed inset-0 z-[1200] flex items-center justify-center pointer-events-auto bg-black/25 backdrop-blur-sm"
                            >
                                <div
                                    className={`w-[380px] max-w-[calc(100vw-2rem)] ${isNight ? 'bg-[#182C4B]/90 border-white/10 text-white' : 'bg-white/90 border-white/20 text-[#2B2D42]'} backdrop-blur-2xl rounded-[32px] p-8 shadow-2xl border flex flex-col`}
                                >
                                    <span className="font-medium text-lg tracking-wide mb-2">
                                        发现本地日记
                                    </span>
                                    <p className={`text-[13px] opacity-70 mb-6 ${subTextColor}`}>
                                        您在未登录时写了一些日记，要同步到当前账号吗？
                                    </p>
                                    <div className="flex gap-3">
                                        <button
                                            type="button"
                                            onClick={dismissSyncPrompt}
                                            className="flex-1 py-3 rounded-xl font-medium border border-white/20 opacity-60 hover:opacity-100 transition-opacity text-[15px]"
                                        >
                                            不用了
                                        </button>
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                await syncAnonymousEntries();
                                                setShowSuccessGlow(true);
                                                setTimeout(() => setShowSuccessGlow(false), 2000);
                                            }}
                                            className="flex-1 bg-[#A8D08D] text-[#2B2D42] py-3 rounded-xl font-medium shadow-sm hover:opacity-90 transition-opacity text-[15px]"
                                        >
                                            同步过来
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>,
                    document.body,
                )}

        </motion.div>
    );
};

