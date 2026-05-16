import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  isBlowing: boolean;
  onBlow: () => void;
  onComplete: () => void;
}

export const EntranceScene: React.FC<Props> = ({ isBlowing, onBlow, onComplete }) => {
  const [showBrand, setShowBrand] = useState(false);

  useEffect(() => {
    if (isBlowing) {
      // 500ms - 1000ms: Brand Appears
      const timer1 = setTimeout(() => setShowBrand(true), 500); 
      // 1400ms - 2300ms: Brand Disappears
      const timer2 = setTimeout(() => setShowBrand(false), 1400); 
      // 2100ms: notify App to crossfade into writing page (which takes 300ms to open)
      const timer3 = setTimeout(() => onComplete(), 2100); 
      
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    }
  }, [isBlowing, onComplete]);

  return (
    <motion.div 
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.3 } }} // this covers 2100 to 2400
      className="fixed inset-0 z-10 flex flex-col items-center justify-center pointer-events-auto"
    >
        <AnimatePresence>
            {!isBlowing && (
                <motion.button 
                   key="button"
                   exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.3 } }}
                   onClick={onBlow}
                   className="text-[#2B2D42]/40 hover:text-[#2B2D42]/70 transition-all duration-700 hover:tracking-[0.4em] active:scale-95 tracking-[0.2em] text-sm uppercase font-medium bg-transparent absolute"
                >
                    blow
                </motion.button>
            )}
        </AnimatePresence>

        <AnimatePresence>
            {showBrand && (
                <motion.h1 
                    key="brand"
                    initial={{ opacity: 0, filter: 'blur(8px)', scale: 0.95 }}
                    animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
                    exit={{ opacity: 0, filter: 'blur(16px)', scale: 1.05, transition: { duration: 0.9, ease: "easeIn" } }}
                    transition={{ duration: 0.8, ease: "easeOut" }} 
                    className="text-[3.5rem] md:text-[7.5rem] text-white absolute leading-none whitespace-nowrap"
                    style={{ 
                        fontFamily: "'Pacifico', cursive",
                        textShadow: '0 0 30px rgba(255,255,255,0.9), 0 0 50px rgba(255,255,255,0.5)'
                    }}
                >
                    WhisperJournal
                </motion.h1>
            )}
        </AnimatePresence>
    </motion.div>
  );
};
