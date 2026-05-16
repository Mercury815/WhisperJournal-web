import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { loadEntries, JournalEntry } from '../lib/store';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, subMonths, addMonths, isSameDay } from 'date-fns';
import { cn } from '../lib/utils';
import { useAppStore } from '../lib/authStore';

interface Props {
  onClose: () => void;
}

const EMOTION_COLORS: Record<string, string> = {
  '😊': '#FFE5A3',
  '😌': '#B7E4C7',
  '🌼': '#FDE4CF',
  '🌿': '#CDE7E0',
  '💪': '#FFD6A5',
  '✨': '#D6E6FF',
  '😐': '#E0E3E8',
  '🌫': '#F1F3F5',
  '😴': '#E6E6FA',
  '😢': '#CDE7FF',
  '😰': '#D0D8E8',
  '😤': '#FFD6D6'
};

const hexToRgba = (hex: string, alpha: number) => {
    if (!hex) return `rgba(224, 227, 232, ${alpha})`; // fallback
    let r = parseInt(hex.slice(1, 3), 16),
        g = parseInt(hex.slice(3, 5), 16),
        b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const getBackgroundGradient = (emotions: string[], alpha: number = 1) => {
    if (!emotions || emotions.length === 0) {
        return hexToRgba('#F1F3F5', alpha * 0.6);
    }
    const colors = emotions.map(e => EMOTION_COLORS[e] || EMOTION_COLORS['😐']);
    const rgbaColors = colors.map(c => hexToRgba(c, alpha));
    
    if (rgbaColors.length === 1) {
        return rgbaColors[0];
    } else {
        return `linear-gradient(135deg, ${rgbaColors.join(', ')})`;
    }
};

export const CalendarOverlay: React.FC<Props> = ({ onClose }) => {
    const [entries, setEntries] = useState<JournalEntry[]>([]);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);

    const { isAnonymous, userId, entries: storeEntries } = useAppStore();

    useEffect(() => {
        // 根据是否登录加载相应的日记
        if (!isAnonymous && storeEntries.length > 0) {
            setEntries(storeEntries);
        } else {
            setEntries(loadEntries(isAnonymous ? undefined : userId));
        }
    }, [isAnonymous, userId, storeEntries]);

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // padding for first day of month
    const startDay = monthStart.getDay(); 
    const emptyDays = Array(startDay === 0 ? 6 : startDay - 1).fill(null); // Assuming Monday start

    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.5 } }}
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-auto"
            style={{ 
                background: 'rgba(0,0,0,0.22)',
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)'
            }}
        >
            <div className="absolute inset-0" onClick={onClose} />

            <motion.div 
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                className="relative glass-opaque p-8 rounded-[20px] shadow-xl flex gap-8 max-w-4xl max-h-[80vh]"
                onClick={e => e.stopPropagation()}
            >
                <button 
                    onClick={onClose}
                    className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/40 transition-colors text-text-sub"
                >
                    <X size={20} />
                </button>

                <div className="w-[380px] flex flex-col">
                    <div className="flex items-center justify-between mb-8 pl-1">
                        <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="text-text-sub hover:text-text-main p-1">«</button>
                        <h2 className="text-xl font-medium tracking-wide text-text-main">
                            {format(currentDate, 'yyyy / MM')}
                        </h2>
                        <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="text-text-sub hover:text-text-main p-1">»</button>
                    </div>

                    <div className="grid grid-cols-7 gap-3 mb-2 text-center text-xs text-text-hint font-medium">
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div key={d}>{d}</div>)}
                    </div>
                    
                    <div className="grid grid-cols-7 gap-3">
                        {emptyDays.map((_, i) => (
                            <div key={`empty-${i}`} className="w-[42px] h-[42px]" />
                        ))}
                        {days.map(day => {
                            const entry = entries.find(e => isSameDay(new Date(e.date), day));
                            const isSelected = selectedEntry?.id === entry?.id;
                            
                            return (
                                <button
                                    key={day.toISOString()}
                                    disabled={!entry}
                                    onClick={() => entry && setSelectedEntry(entry)}
                                    style={{
                                        background: entry ? getBackgroundGradient(entry.emotions, 1) : 'rgba(241, 243, 245, 0.6)'
                                    }}
                                    className={cn(
                                        "relative w-[42px] h-[42px] rounded-[10px] flex flex-col items-center justify-center transition-all duration-500",
                                        !entry && "text-text-hint/40 cursor-default",
                                        entry && "text-text-main shadow-sm hover:shadow-md cursor-pointer",
                                        entry && !isSelected && "hover:-translate-y-1",
                                        isSelected && "scale-[1.08] shadow-[0_8px_24px_rgba(0,0,0,0.12)] z-10"
                                    )}
                                >
                                    <span className={cn("text-sm", entry && "font-medium")}>
                                        {format(day, 'd')}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Entry Preview */}
                <div 
                    className="w-[400px] pl-8 border-l border-white/20 flex flex-col relative rounded-r-[20px] overflow-hidden"
                >
                    <AnimatePresence mode="wait">
                        {selectedEntry ? (
                            <motion.div 
                                key={selectedEntry.id}
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                className="h-full flex flex-col relative z-10 p-4 -m-4 rounded-xl"
                                style={{
                                    background: getBackgroundGradient(selectedEntry.emotions, 0.35),
                                    backdropFilter: 'blur(24px)',
                                    WebkitBackdropFilter: 'blur(24px)'
                                }}
                            >
                                <div className="text-sm text-text-hint mb-4 flex items-center justify-between">
                                    <span>{format(new Date(selectedEntry.date), 'MMMM do, yyyy')}</span>
                                    <span className="text-lg">{selectedEntry.emotions.join(' ')}</span>
                                </div>
                                <div className="flex-1 overflow-y-auto pr-2 text-text-main/90 leading-relaxed font-sans whitespace-pre-wrap">
                                    {selectedEntry.content || "一段安静的时光..."}
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div 
                                key="empty"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="h-full flex items-center justify-center text-text-hint text-sm text-center"
                            >
                                选择一个有记录的日子，<br/>回看那时的风景。
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </motion.div>
    );
};
