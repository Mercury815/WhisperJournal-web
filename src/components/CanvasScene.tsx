import React, { useEffect, useRef, useState } from 'react';
import { useEnvironmentStore, TimePhase, WeatherType, getEffectiveEnv } from '../lib/environment';

export interface CanvasSceneProps {
    view: 'entrance' | 'writing' | 'calendar';
}

const TIME_GRADIENTS: Record<TimePhase, string[]> = {
  dawn: ['#fbc2eb', '#a6c1ee'],
  day: ['#EAF4FF', '#CFE2FF'],
  dusk: ['#f6d365', '#fda085'],
  night: ['#1e3c72', '#2a5298']
};

function hexToRgb(h: string) {
   let r = parseInt(h.slice(1,3), 16);
   let g = parseInt(h.slice(3,5), 16);
   let b = parseInt(h.slice(5,7), 16);
   return [r,g,b];
}

function lerpColorArray(c1: number[], c2: number[], t: number) {
   const r = Math.round(c1[0] + (c2[0] - c1[0]) * t);
   const g = Math.round(c1[1] + (c2[1] - c1[1]) * t);
   const b = Math.round(c1[2] + (c2[2] - c1[2]) * t);
   return `rgb(${r},${g},${b})`;
}

export const CanvasScene: React.FC<CanvasSceneProps> = ({ view }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const viewRef = useRef(view);
    viewRef.current = view;

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        let pTime = performance.now();
        
        let sceneState = {
            cloudsSplitProgress: viewRef.current === 'entrance' ? 0 : 1,
            meadowYProgress: viewRef.current === 'entrance' ? 0 : 1,
            currentColor1: hexToRgb(TIME_GRADIENTS['day'][0]),
            currentColor2: hexToRgb(TIME_GRADIENTS['day'][1]),
            weatherProgress: 1, // for transitions
            lastWeather: 'cloudy' as WeatherType,
            lastTimePhase: 'day' as TimePhase,
            timeTransitionProgress: 1,
            starTransitionProgress: 0
        };

        const generateClouds = (count: number) => {
            return [...Array(count)].map(() => ({
               idx: Math.random() * 1.5 - 0.25, 
               idy: Math.random() * 0.5,
               speed: 0.02 + Math.random() * 0.08, 
               radius: 80 + Math.random() * 200,
               depth: Math.random()
            }));
        };

        const cloudsLeftContext = generateClouds(12);
        const cloudsRightContext = generateClouds(12);

        // Weather particles
        const particles = [...Array(100)].map(() => ({
            x: Math.random(),
            y: Math.random(),
            s: Math.random(), // size factor
            v: Math.random(), // velocity factor
            a: Math.random() // alpha factor
        }));

        // Starry sky particles
        const w_init = window.innerWidth;
        const h_init = window.innerHeight;
        const minDistanceSq = 20 * 20;

        const stars: any[] = [];
        const STAR_COUNT = 80;
        
        // Cluster centers for un-even distribution
        const clusters = [
            { x: Math.random() * 0.8 + 0.1, y: Math.random() * 0.3 },
            { x: Math.random() * 0.8 + 0.1, y: Math.random() * 0.3 }
        ];

        for (let i = 0; i < STAR_COUNT; i++) {
            let x = 0, y = 0, valid = false;
            const inCluster = Math.random() < 0.3;
            const cInfo = clusters[Math.floor(Math.random() * clusters.length)];

            for (let attempt = 0; attempt < 50; attempt++) {
                if (inCluster) {
                    x = cInfo.x + (Math.random() - 0.5) * 0.15;
                    y = cInfo.y + (Math.random() - 0.5) * 0.15;
                } else {
                    x = Math.random();
                    y = Math.random() * 0.6;
                }
                
                valid = true;
                for (const s of stars) {
                    const dx = (s.x - x) * w_init;
                    const dy = (s.y - y) * h_init;
                    if (dx * dx + dy * dy < minDistanceSq) {
                        valid = false;
                        break;
                    }
                }
                if (valid) break;
            }

            const rand = Math.random();
            let radius = 0.5 + Math.random() * 0.5;
            let amplitude = 0.05;
            if (rand > 0.95) {
                radius = 2 + Math.random() * 0.5;
                amplitude = 0.2;
            } else if (rand > 0.70) {
                radius = 1 + Math.random() * 0.8;
                amplitude = 0.15;
            }

            const colorRand = Math.random();
            let color = '255, 255, 255';
            if (colorRand > 0.95) color = '255, 246, 232';
            else if (colorRand > 0.80) color = '234, 242, 255';

            stars.push({
                x,
                y,
                baseOpacity: 0.2 + Math.random() * 0.4,
                amplitude,
                speed: 0.0005 + Math.random() * 0.001,
                offset: Math.random() * Math.PI * 2,
                radius,
                color,
                isBright: false,
                randomThreshold: Math.random()
            });
        }

        const BRIGHT_STAR_COUNT = 2 + Math.floor(Math.random() * 3); // 2 to 4
        for (let i = 0; i < BRIGHT_STAR_COUNT; i++) {
            let x = Math.random() > 0.5 ? Math.random() * 0.35 : 0.65 + Math.random() * 0.35;
            let y = Math.random() * 0.33; // Upper 1/3
            
            stars.push({
                x,
                y,
                baseOpacity: 0.8 + Math.random() * 0.2, 
                amplitude: 0.3 + Math.random() * 0.3, // 0.3 - 0.6
                speed: 0.002 + Math.random() * 0.002, // slightly faster twinkle
                offset: Math.random() * Math.PI * 2,
                radius: 2.5 + Math.random() * 1.5, // 2.5 - 4px
                color: Math.random() > 0.7 ? '255, 243, 214' : '255, 255, 255',
                isBright: true,
                randomThreshold: 0
            });
        }

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', resize);
        resize();

        const render = (time: number) => {
            const rawDt = (time - pTime) / 1000;
            pTime = time;
            
            const state = useEnvironmentStore.getState();
            const envState = getEffectiveEnv(state);
            const dt = rawDt * envState.debug.speedMultiplier;

            const timePhase = envState.timePhase;
            const weather = envState.weather;
            const typingIntensity = envState.typingIntensity;
            const debug = envState.debug;

            // Handle time background transition
            if (timePhase !== sceneState.lastTimePhase) {
                sceneState.timeTransitionProgress = 0;
                sceneState.lastTimePhase = timePhase;
            }
            if (sceneState.timeTransitionProgress < 1) {
                sceneState.timeTransitionProgress += dt * 0.5; // 2 seconds transition
                if (sceneState.timeTransitionProgress > 1) sceneState.timeTransitionProgress = 1;
            }

            const targetColors = TIME_GRADIENTS[timePhase].map(hexToRgb);
            sceneState.currentColor1 = sceneState.currentColor1.map((v, i) => v + (targetColors[0][i] - v) * dt * 0.5);
            sceneState.currentColor2 = sceneState.currentColor2.map((v, i) => v + (targetColors[1][i] - v) * dt * 0.5);

            const c1 = `rgb(${sceneState.currentColor1.map(Math.round).join(',')})`;
            const c2 = `rgb(${sceneState.currentColor2.map(Math.round).join(',')})`;

            const currentView = viewRef.current;
            const targetSplit = currentView === 'entrance' ? 0 : 1;
            
            const splitDiff = targetSplit - sceneState.cloudsSplitProgress;
            sceneState.cloudsSplitProgress += splitDiff * dt * (targetSplit === 1 ? 4.5 : 2.0);
            sceneState.meadowYProgress += (targetSplit - sceneState.meadowYProgress) * dt * 2.5;

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const w = canvas.width;
            const h = canvas.height;
            
            // ==========================================
            // LAYER 0: Background
            // ==========================================
            const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
            bgGrad.addColorStop(0, c1);
            bgGrad.addColorStop(1, c2);
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, w, h);
            
            // ==========================================
            // LAYER 0.5: Starry Sky
            // ==========================================
            const starTargetFactor = timePhase === 'night' ? 1 : 0;
            if (sceneState.starTransitionProgress !== starTargetFactor) {
                sceneState.starTransitionProgress += (starTargetFactor - sceneState.starTransitionProgress) * dt * 0.5;
                if (Math.abs(sceneState.starTransitionProgress - starTargetFactor) < 0.01) {
                    sceneState.starTransitionProgress = starTargetFactor;
                }
            }

            if (sceneState.starTransitionProgress > 0) {
                const globalPulse = Math.sin(time * 0.0002) * 0.05;
                
                const isCloudy = sceneState.lastWeather === 'cloudy';
                const isSnow = sceneState.lastWeather === 'snow';
                const isRain = sceneState.lastWeather === 'rain';

                const normalThreshold = isRain ? 0 : isSnow ? 1 : isCloudy ? 0.6 : 1.0;
                let visualOpacityMultiplier = isSnow ? 0.6 : isRain ? 0 : 1;

                ctx.save();
                for (let i = 0; i < stars.length; i++) {
                    const star = stars[i];
                    
                    if (star.isBright) {
                        if (isRain) continue; 
                        // cloudy hides approx half of bright stars based on index
                        if (isCloudy && i % 2 === 0) continue; 
                    } else {
                        if (star.randomThreshold > normalThreshold) continue;
                    }

                    const sx = star.x * w;
                    const floatOffset = Math.sin(time * star.speed) * 0.3;
                    const sy = star.y * h + floatOffset;
                    
                    let twinkleBase = Math.sin(time * star.speed + star.offset);
                    let opacity;
                    
                    if (star.isBright) {
                        opacity = star.baseOpacity + Math.pow((twinkleBase + 1) / 2, 2) * star.amplitude; 
                    } else {
                        opacity = star.baseOpacity + twinkleBase * star.amplitude + globalPulse;
                    }
                    
                    opacity = Math.max(0.1, Math.min(star.isBright ? 1 : 0.8, opacity));
                    
                    opacity *= sceneState.starTransitionProgress;
                    opacity *= visualOpacityMultiplier;
                    
                    if (opacity <= 0) continue;

                    ctx.fillStyle = `rgba(${star.color}, ${opacity})`;
                    ctx.beginPath();
                    ctx.arc(sx, sy, star.radius, 0, Math.PI * 2);
                    ctx.fill();

                    if (star.isBright) {
                        const crossLen = 6 + Math.pow((twinkleBase + 1) / 2, 2) * 6; 
                        ctx.save();
                        ctx.translate(sx, sy);
                        ctx.shadowBlur = 6;
                        ctx.shadowColor = `rgba(${star.color}, ${opacity * 0.8})`;

                        const flareGradV = ctx.createLinearGradient(0, -crossLen, 0, crossLen);
                        flareGradV.addColorStop(0, `rgba(${star.color}, 0)`);
                        flareGradV.addColorStop(0.5, `rgba(${star.color}, ${opacity * 0.9})`);
                        flareGradV.addColorStop(1, `rgba(${star.color}, 0)`);

                        const flareGradH = ctx.createLinearGradient(-crossLen, 0, crossLen, 0);
                        flareGradH.addColorStop(0, `rgba(${star.color}, 0)`);
                        flareGradH.addColorStop(0.5, `rgba(${star.color}, ${opacity * 0.9})`);
                        flareGradH.addColorStop(1, `rgba(${star.color}, 0)`);
                        
                        ctx.fillStyle = flareGradV;
                        ctx.fillRect(-0.5, -crossLen, 1, crossLen * 2);
                        ctx.fillStyle = flareGradH;
                        ctx.fillRect(-crossLen, -0.5, crossLen * 2, 1);
                        ctx.restore();
                    }
                }
                ctx.restore();
            }

            const breathe = Math.sin(time / 1500) * 0.05;

            // ==========================================
            // LAYER 1: Scene Layer (Grass / Hills)
            // ==========================================
            const meadowOffset = h - (h * 0.45 * sceneState.meadowYProgress);
            const enableRimLight = timePhase === 'dawn' && weather !== 'rain' && weather !== 'cloudy';
            
            // Back Hill
            ctx.fillStyle = timePhase === 'night' ? '#1A2A44' : timePhase === 'dusk' ? '#D68C72' : '#B7E4C7';
            ctx.beginPath();
            ctx.moveTo(0, h);
            ctx.lineTo(0, meadowOffset - 100 + Math.sin(time * 0.0005) * 20);
            ctx.bezierCurveTo(
               w * 0.4, meadowOffset - 250 + Math.sin(time * 0.0006) * 10, 
               w * 0.6, meadowOffset - 50 + Math.cos(time * 0.0004) * 15, 
               w, meadowOffset - 120 + Math.cos(time * 0.0005) * 20
            );
            ctx.lineTo(w, h);
            ctx.fill();
            if (enableRimLight) {
                ctx.save();
                ctx.clip(); 
                const rg = ctx.createRadialGradient(w * 0.8, meadowOffset - 150, 0, w * 0.8, meadowOffset - 150, h * 0.8);
                rg.addColorStop(0, 'rgba(255, 230, 160, 0.25)');
                rg.addColorStop(0.5, 'rgba(255, 210, 140, 0.10)');
                rg.addColorStop(1, 'rgba(255, 180, 100, 0)');
                ctx.fillStyle = rg;
                ctx.fillRect(0, 0, w, h);
                ctx.restore();
            }

            // Front Hill
            ctx.fillStyle = timePhase === 'night' ? '#223B60' : timePhase === 'dusk' ? '#ECA887' : '#95D5B2';
            ctx.beginPath();
            ctx.moveTo(0, h);
            ctx.lineTo(0, meadowOffset + Math.sin(time * 0.0007) * 15);
            ctx.bezierCurveTo(
               w * 0.3, meadowOffset - 80 + Math.cos(time * 0.0008) * 10, 
               w * 0.7, meadowOffset + 40 + Math.sin(time * 0.0005) * 12, 
               w, meadowOffset - 20 + Math.cos(time * 0.0006) * 15
            );
            ctx.lineTo(w, h);
            ctx.fill();
            if (enableRimLight) {
                // Soft gradient field instead of stroke
                ctx.save();
                ctx.clip(); 
                const rg = ctx.createRadialGradient(w * 0.9, meadowOffset - 100, 0, w * 0.9, meadowOffset - 100, h * 0.8);
                rg.addColorStop(0, 'rgba(255, 230, 160, 0.30)');
                rg.addColorStop(0.4, 'rgba(255, 210, 140, 0.12)');
                rg.addColorStop(1, 'rgba(255, 180, 100, 0)');
                ctx.fillStyle = rg;
                ctx.fillRect(0, 0, w, h);
                
                // Add soft horizon band
                const lg = ctx.createLinearGradient(0, meadowOffset - 80, 0, meadowOffset + 40);
                lg.addColorStop(0, 'rgba(255, 240, 200, 0.25)');
                lg.addColorStop(1, 'rgba(255, 240, 200, 0)');
                ctx.fillStyle = lg;
                ctx.fillRect(0, meadowOffset - 80, w, 120);
                ctx.restore();
            }

            // ==========================================
            // LAYER 2: Scene Layer (Trees)
            // ==========================================
            const drawTree = (tx: number, ty: number, scale: number, wind: number) => {
               ctx.save();
               ctx.translate(tx, ty);
               ctx.rotate(wind * 0.08); 
               ctx.scale(scale, scale);
               
               // Trunk
               ctx.fillStyle = 'rgba(43, 45, 66, 0.15)'; 
               ctx.beginPath();
               ctx.roundRect(-4, 0, 8, 50, 4);
               ctx.fill();
               
               // Foliage
               ctx.fillStyle = timePhase === 'night' ? '#182C4B' : timePhase === 'dusk' ? '#995B48' : '#A8D08D';
               ctx.beginPath();
               ctx.arc(0, -30, 40, 0, Math.PI*2);
               ctx.arc(-25, -15, 30, 0, Math.PI*2);
               ctx.arc(25, -15, 30, 0, Math.PI*2);
               ctx.arc(0, 0, 35, 0, Math.PI*2);
               ctx.fill();

               // Dawn Rim Light for Trees
               if (enableRimLight) {
                   ctx.save();
                   ctx.clip(); 
                   const rg = ctx.createRadialGradient(20, -50, 0, 0, -30, 60);
                   rg.addColorStop(0, 'rgba(255, 230, 160, 0.35)');
                   rg.addColorStop(0.4, 'rgba(255, 210, 140, 0.15)');
                   rg.addColorStop(1, 'transparent');
                   ctx.fillStyle = rg;
                   ctx.fillRect(-50, -80, 100, 120);
                   
                   // Tiny edge light
                   const edgeRg = ctx.createRadialGradient(25, -50, 0, 25, -50, 40);
                   edgeRg.addColorStop(0, 'rgba(255, 250, 200, 0.25)');
                   edgeRg.addColorStop(1, 'transparent');
                   ctx.fillStyle = edgeRg;
                   ctx.fillRect(-50, -80, 100, 120);

                   ctx.restore();
               }

               ctx.restore();
            };

            const windPhase = Math.sin(time * 0.0008);
            if (sceneState.meadowYProgress > 0.01) {
                const pushDown = (1 - sceneState.meadowYProgress) * 200;
                ctx.globalAlpha = sceneState.meadowYProgress;
                drawTree(w * 0.85, meadowOffset - 60 + pushDown, 1.2, windPhase);
                drawTree(w * 0.15, meadowOffset + 20 + pushDown, 0.9, -windPhase);
                ctx.globalAlpha = 1;
            }

            // ==========================================
            // LAYER 3: Cloud Layer (Clouds & Fog)
            // ==========================================
            const splitAmount = sceneState.cloudsSplitProgress;
            
            const renderCloudCluster = (clouds: any[], direction: number) => {
                const sortedClouds = [...clouds].sort((a, b) => a.depth - b.depth);

                sortedClouds.forEach((c) => {
                   c.idx += c.speed * dt * 0.1;
                   if(c.idx > 1.2) c.idx = -0.2; 
                   
                   let cx = (c.idx * w);
                   let cy = c.idy * h * 0.6 + h * 0.05;

                   const splitFactor = splitAmount * (0.8 + c.depth * 1.5);
                   cx += direction * (splitFactor * w * 0.8);
                   cy -= splitFactor * h * 0.2;

                   const alpha = (0.5 + c.depth * 0.5) * (timePhase === 'night' ? 0.3 : timePhase === 'dusk' ? 0.8 : 1);
                   
                   ctx.fillStyle = timePhase === 'dawn' ? `rgba(255, 230, 240, ${alpha})` : 
                                   timePhase === 'dusk' ? `rgba(255, 210, 190, ${alpha})` :
                                   timePhase === 'night' ? `rgba(180, 200, 230, ${alpha})` :
                                   `rgba(255, 255, 255, ${alpha})`;
                   
                   ctx.shadowColor = `rgba(255, 255, 255, ${alpha * 0.8})`;
                   ctx.shadowBlur = 40 + c.depth * 40;

                   ctx.beginPath();
                   ctx.arc(cx, cy, c.radius, 0, Math.PI * 2);
                   ctx.fill();
                });
            }

            renderCloudCluster(cloudsLeftContext, -1);
            renderCloudCluster(cloudsRightContext, 1);
            ctx.shadowBlur = 0; 

            if (sceneState.lastWeather === 'cloudy') {
               ctx.globalAlpha = sceneState.weatherProgress;
               for (let i = 0; i < 3; i++) {
                   const cx = (time / 1000 * 20 + i * 500) % (w + 1000) - 500;
                   const cy = h * 0.3 + Math.sin(time / 2000 + i) * 100;
                   ctx.beginPath();
                   ctx.fillStyle = `rgba(255, 255, 255, 0.05)`;
                   ctx.arc(cx, cy, 600, 0, Math.PI * 2);
                   ctx.fill();
               }
               ctx.globalAlpha = 1;
            }

            // ==========================================
            // LAYER 2.5: Dawn Global Light Overlay & Atmosphere
            // ==========================================
            if (timePhase === 'dawn' && sceneState.lastWeather !== 'rain') {
                const flareScale = 0.6 + breathe;
                const flareGrad = ctx.createRadialGradient(w * 0.9, -h * 0.1, 0, w * 0.9, -h * 0.1, h * 1.5 * flareScale);
                flareGrad.addColorStop(0, `rgba(255, 230, 160, 0.25)`);
                flareGrad.addColorStop(0.5, `rgba(255, 200, 120, 0.12)`);
                flareGrad.addColorStop(1, 'transparent');
                ctx.fillStyle = flareGrad;
                ctx.fillRect(0, 0, w, h);

                // Atmosphere Fog Layer
                const fogGrad = ctx.createLinearGradient(0, 0, 0, h);
                fogGrad.addColorStop(0, `rgba(255, 214, 224, 0.15)`); // #FFD6E0
                fogGrad.addColorStop(0.5, `rgba(255, 228, 160, 0.10)`); // #FFE4A0
                fogGrad.addColorStop(1, 'transparent');
                ctx.fillStyle = fogGrad;
                ctx.fillRect(0, 0, w, h);
            }

            // ==========================================
            // LAYER 4: Weather Particles
            // ==========================================
            // Weather Transitions
            if (weather !== sceneState.lastWeather) {
                sceneState.weatherProgress -= dt * 1.5; 
                if (sceneState.weatherProgress <= 0) {
                    sceneState.lastWeather = weather;
                    sceneState.weatherProgress = 0;
                }
            } else if (sceneState.weatherProgress < 1) {
                sceneState.weatherProgress += dt * 1.5; 
                if (sceneState.weatherProgress > 1) sceneState.weatherProgress = 1;
            }

            if (sceneState.lastWeather !== 'cloudy') {
                const isRain = sceneState.lastWeather === 'rain';
                const isSnow = sceneState.lastWeather === 'snow';
                const isSunny = sceneState.lastWeather === 'sunny';
                
                const activeCount = Math.min(100, Math.round((isRain ? 80 : (isSnow ? 50 : 30)) * debug.particleMultiplier));
                ctx.globalAlpha = sceneState.weatherProgress;
                
                for (let i = 0; i < activeCount; i++) {
                    const p = particles[i];
                    
                    if (isRain) {
                        p.y += (800 + p.v * 600) * dt; 
                        p.x += 150 * dt;
                        if (p.y > h || p.x > w) {
                            p.y = -20;
                            p.x = Math.random() * w - 100;
                        }
                        ctx.fillStyle = `rgba(255, 255, 255, ${0.2 + p.a * 0.2})`;
                        // slanted raindrop
                        ctx.save();
                        ctx.translate(p.x, p.y);
                        ctx.rotate(15 * Math.PI / 180);
                        ctx.fillRect(0, 0, 1.5, 10 + p.s * 15);
                        ctx.restore();
                    } else if (isSnow) {
                        p.y += (40 + p.v * 40) * dt;
                        p.x += Math.sin(time / 1000 + p.s * 10) * 80 * dt;
                        if (p.y > h) {
                            p.y = -20;
                            p.x = Math.random() * w;
                        }
                        ctx.fillStyle = `rgba(255, 255, 255, ${0.6 + p.a * 0.3})`;
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, 1.5 + p.s * 3, 0, Math.PI * 2);
                        ctx.fill();
                    } else if (isSunny) {
                        p.y -= (10 + p.v * 10) * dt;
                        p.x += Math.cos(time / 2000 + p.a * 5) * 10 * dt;
                        if (p.y < -50) {
                            p.y = h + 50;
                            p.x = Math.random() * w;
                        }
                        ctx.shadowBlur = 20 + p.s * 15;
                        ctx.shadowColor = 'rgba(255, 250, 200, 0.3)';
                        ctx.fillStyle = `rgba(255, 240, 200, ${0.05 + Math.sin(time / 1000 + p.s * 10) * 0.05})`;
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, 2 + p.s * 5, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.shadowBlur = 0;
                    }
                }
                ctx.globalAlpha = 1;
            }

            // ==========================================
            // LAYER 4: Enhancements & Overlays
            // ==========================================
            if (typingIntensity > 0) {
                ctx.fillStyle = `rgba(255, 255, 255, ${typingIntensity * 0.12})`;
                ctx.fillRect(0, 0, w, h);
            }

            // Dim everything down a bit for night time
            if (timePhase === 'night') {
                ctx.fillStyle = `rgba(0, 0, 10, 0.3)`;
                ctx.fillRect(0, 0, w, h);
            }

            if (debug.enabled && debug.showInfo) {
                const fps = rawDt > 0 ? Math.round(1 / rawDt) : 0;
                ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                ctx.fillRect(10, 10, 160, 90);
                ctx.fillStyle = 'white';
                ctx.font = '12px monospace';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';
                ctx.fillText(`Time: ${timePhase}`, 20, 20);
                ctx.fillText(`Weather: ${weather}`, 20, 40);
                ctx.fillText(`Particles: ${sceneState.lastWeather !== 'cloudy' ? Math.min(100, Math.round(((sceneState.lastWeather === 'rain' ? 80 : (sceneState.lastWeather === 'snow' ? 50 : 30))) * debug.particleMultiplier)) : 0}`, 20, 60);
                ctx.fillText(`FPS: ${fps}`, 20, 80);
            }

            animationFrameId = requestAnimationFrame(render);
        };
        
        animationFrameId = requestAnimationFrame(render);

        return () => {
            window.removeEventListener('resize', resize);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <canvas 
            ref={canvasRef} 
            className="fixed inset-0 z-0 pointer-events-none"
        />
    );
};

