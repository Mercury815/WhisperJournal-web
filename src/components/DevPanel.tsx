import React, { useEffect, useState } from 'react';
import { useEnvironmentStore, TimePhase, WeatherType } from '../lib/environment';

export const DevPanel: React.FC = () => {
    const { debug, setDebug } = useEnvironmentStore();
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!debug.enabled) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'd' && e.altKey) { // Alt+D to toggle panel
                setVisible(v => !v);
            }
            // Quick Scenes
            if (e.key === '1' && e.altKey) setDebug({ overrideTime: 'dawn', overrideWeather: 'sunny' });
            if (e.key === '2' && e.altKey) setDebug({ overrideTime: 'day', overrideWeather: 'sunny' });
            if (e.key === '3' && e.altKey) setDebug({ overrideTime: 'dusk', overrideWeather: 'cloudy' });
            if (e.key === '4' && e.altKey) setDebug({ overrideTime: 'night', overrideWeather: 'rain' });
            if (e.key === '5' && e.altKey) setDebug({ overrideTime: 'night', overrideWeather: 'snow' });
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [debug.enabled, setDebug]);

    useEffect(() => {
        if (!debug.demoMode) return;
        const scenes = [
            { time: 'day', weather: 'sunny' },
            { time: 'dusk', weather: 'cloudy' },
            { time: 'night', weather: 'rain' },
            { time: 'night', weather: 'snow' },
        ] as const;
        
        let idx = 0;
        const interval = setInterval(() => {
            setDebug({ 
                overrideTime: scenes[idx].time, 
                overrideWeather: scenes[idx].weather 
            });
            idx = (idx + 1) % scenes.length;
        }, 5000);
        return () => clearInterval(interval);
    }, [debug.demoMode, setDebug]);

    if (!debug.enabled || !visible) return null;

    const timePhases: TimePhase[] = ['dawn', 'day', 'dusk', 'night'];
    const weathers: WeatherType[] = ['sunny', 'cloudy', 'rain', 'snow'];

    return (
        <div className="fixed bottom-4 right-4 z-[999] bg-black/80 text-white/90 p-4 rounded-xl text-xs font-mono shadow-2xl border border-white/10 backdrop-blur-md opacity-50 hover:opacity-100 transition-opacity flex flex-col space-y-4 w-72 pointer-events-auto">
            <div className="flex justify-between items-center border-b border-white/20 pb-2">
                <span className="font-bold text-sm">🧪 Env Debug</span>
                <button onClick={() => setVisible(false)} className="hover:text-red-400">✖</button>
            </div>

            {/* Time Control */}
            <div className="flex flex-col space-y-2">
                <span className="text-white/50 uppercase tracking-wider text-[10px]">Time Phase (Override)</span>
                <div className="grid grid-cols-4 gap-1">
                    {timePhases.map(t => (
                        <button 
                            key={t}
                            onClick={() => setDebug({ overrideTime: debug.overrideTime === t ? null : t })}
                            className={`py-1 rounded ${debug.overrideTime === t ? 'bg-blue-500 text-white' : 'bg-white/10 hover:bg-white/20'}`}
                        >
                            {t}
                        </button>
                    ))}
                </div>
            </div>

            {/* Weather Control */}
            <div className="flex flex-col space-y-2">
                <span className="text-white/50 uppercase tracking-wider text-[10px]">Weather (Override)</span>
                <div className="grid grid-cols-4 gap-1">
                    {weathers.map(w => (
                        <button 
                            key={w}
                            onClick={() => setDebug({ overrideWeather: debug.overrideWeather === w ? null : w })}
                            className={`py-1 rounded ${debug.overrideWeather === w ? 'bg-green-500 text-white' : 'bg-white/10 hover:bg-white/20'}`}
                        >
                            {w}
                        </button>
                    ))}
                </div>
            </div>

            {/* Quick Scenes */}
            <div className="flex flex-col space-y-2">
                <span className="text-white/50 uppercase tracking-wider text-[10px]">Quick Scenes (Alt + 1~5)</span>
                <div className="flex flex-col space-y-1">
                    <button onClick={() => setDebug({ overrideTime: 'dawn', overrideWeather: 'sunny' })} className="text-left px-2 py-1 bg-white/5 hover:bg-white/10 rounded">Morning Clear</button>
                    <button onClick={() => setDebug({ overrideTime: 'day', overrideWeather: 'sunny' })} className="text-left px-2 py-1 bg-white/5 hover:bg-white/10 rounded">Afternoon Sun</button>
                    <button onClick={() => setDebug({ overrideTime: 'dusk', overrideWeather: 'cloudy' })} className="text-left px-2 py-1 bg-white/5 hover:bg-white/10 rounded">Evening Cloudy</button>
                    <button onClick={() => setDebug({ overrideTime: 'night', overrideWeather: 'rain' })} className="text-left px-2 py-1 bg-blue-900/50 hover:bg-blue-900/80 rounded border border-blue-500/30 text-blue-200">Night Rain ⭐</button>
                    <button onClick={() => setDebug({ overrideTime: 'night', overrideWeather: 'snow' })} className="text-left px-2 py-1 bg-white/5 hover:bg-white/10 rounded">Night Snow</button>
                </div>
            </div>

            {/* Params */}
            <div className="flex flex-col space-y-2">
                <span className="text-white/50 uppercase tracking-wider text-[10px]">Canvas Params</span>
                <div className="flex justify-between items-center bg-white/5 p-2 rounded">
                    <span>Particles</span>
                    <input type="range" min="0.5" max="2" step="0.1" value={debug.particleMultiplier} onChange={e => setDebug({ particleMultiplier: parseFloat(e.target.value) })} className="w-24" />
                    <span className="w-8 text-right">{debug.particleMultiplier.toFixed(1)}x</span>
                </div>
                <div className="flex justify-between items-center bg-white/5 p-2 rounded">
                    <span>Speed</span>
                    <input type="range" min="0.5" max="2" step="0.1" value={debug.speedMultiplier} onChange={e => setDebug({ speedMultiplier: parseFloat(e.target.value) })} className="w-24" />
                    <span className="w-8 text-right">{debug.speedMultiplier.toFixed(1)}x</span>
                </div>
            </div>

            {/* Toggles */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/20">
                <button 
                    onClick={() => setDebug({ demoMode: !debug.demoMode })}
                    className={`py-1 rounded ${debug.demoMode ? 'bg-purple-500 text-white' : 'bg-white/10 hover:bg-white/20'}`}
                >
                    Auto Demo
                </button>
                <button 
                    onClick={() => setDebug({ showInfo: !debug.showInfo })}
                    className={`py-1 rounded ${debug.showInfo ? 'bg-orange-500 text-white' : 'bg-white/10 hover:bg-white/20'}`}
                >
                    Show Info
                </button>
            </div>
            
            <div className="text-center text-[10px] text-white/30 pt-2">
                Press Alt+D to toggle this panel
            </div>
        </div>
    );
};
