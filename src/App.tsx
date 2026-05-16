import { useState, useEffect } from 'react';
import { AnimatePresence } from 'motion/react';
import { CanvasScene } from './components/CanvasScene';
import { EntranceScene } from './components/EntranceScene';
import { WritingPage } from './components/WritingPage';
import { CalendarOverlay } from './components/CalendarOverlay';
import { DevPanel } from './components/DevPanel';
import { useEnvironmentStore, getTimePhase } from './lib/environment';
import { fetchWeather } from './services/weatherService';
import { setWeatherAudio } from './lib/audioService';

export default function App() {
  const [view, setView] = useState<'entrance' | 'blowing' | 'writing'>('entrance');
  const [showCalendar, setShowCalendar] = useState(false);
  const setEnvironment = useEnvironmentStore(state => state.setEnvironment);

  useEffect(() => {
    // Initial fetch
    const initEnv = async () => {
      const timePhase = getTimePhase(new Date());
      const fetchedWeather = await fetchWeather();
      setEnvironment({
        realTimePhase: timePhase,
        realWeather: fetchedWeather,
        timestamp: Date.now()
      });
      setWeatherAudio(fetchedWeather);
    };
    initEnv();

    // Time update loop
    const timeInterval = setInterval(() => {
      setEnvironment({ realTimePhase: getTimePhase(new Date()) });
    }, 60000);

    // Weather update loop
    const weatherInterval = setInterval(async () => {
      const newWeather = await fetchWeather();
      setEnvironment({ realWeather: newWeather });
      setWeatherAudio(newWeather);
    }, 30 * 60 * 1000);

    return () => {
      clearInterval(timeInterval);
      clearInterval(weatherInterval);
    };
  }, [setEnvironment]);

  return (
    <div className="relative w-screen h-screen overflow-hidden text-[#2B2D42] font-sans selection:bg-white/30 bg-black">
      {/* z 必须低于写作页 (z-10+)，否则会盖住登录弹窗（同级 stacking 子树无法叠过更高兄弟） */}
      <div className="pointer-events-none absolute inset-0 ring-[60px] ring-white/10 blur-[80px] z-[1]"></div>
      
      <CanvasScene view={view === 'entrance' ? 'entrance' : 'writing'} />
      
      <AnimatePresence>
        {view !== 'writing' && (
          <EntranceScene 
             key="entrance" 
             isBlowing={view === 'blowing'}
             onBlow={() => setView('blowing')} 
             onComplete={() => setView('writing')} 
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {view === 'writing' && (
           <WritingPage 
             key="writing" 
             onOpenCalendar={() => setShowCalendar(true)} 
           />
        )}
      </AnimatePresence>
      
      <AnimatePresence>
        {showCalendar && (
           <CalendarOverlay key="calendar" onClose={() => setShowCalendar(false)} />
        )}
      </AnimatePresence>
      
      {process.env.NODE_ENV !== 'production' && <DevPanel />}
    </div>
  );
}
