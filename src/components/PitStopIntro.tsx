'use client';
import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { Group, Vector3 } from 'three';
import { createPitStopAudio, isPitStopEntry, pitStopFrame, PIT_STOP_SECONDS, type PitPhase } from '@/lib/pitStop';
import styles from './PitStopIntro.module.css';

const captions: Record<PitPhase, [string, string]> = {
  racing: ['레이스에서, 일상으로.', '나의 배터리를 위한 잠깐의 피트 스톱'],
  entering: ['피트 레인에 진입합니다', '속도를 낮추고, 다음 주행을 준비하세요'],
  service: ['다음 주행을 준비하는 시간', '차량 관리 화면과 충전 기록을 준비합니다'],
  ready: ['이제, 내 차를 알아볼까요?', '배터리 관리 화면으로 이동합니다'],
};

class IntroBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className={styles.fallback}>차량 관리 화면을 준비합니다</div> : this.props.children; }
}

function PitScene({ elapsed, ready: readyRef }: { elapsed: React.RefObject<number>; ready: React.RefObject<boolean> }) {
  const car = useRef<Group>(null), wheels = useRef<Group>(null), lanes = useRef<Group>(null), tools = useRef<Group>(null);
  const cameraTarget = useRef(new Vector3());
  useFrame(({ camera, gl }) => {
    readyRef.current = true;
    const t = elapsed.current, frame = pitStopFrame(t);
    if (car.current) { car.current.position.set(frame.carX, frame.carLift, frame.carZ); car.current.rotation.y = frame.speed * -.1; }
    wheels.current?.children.forEach(wheel => { wheel.rotation.x -= frame.speed * .3; });
    if (lanes.current) lanes.current.position.z = (t * 12 * frame.speed) % 3;
    tools.current?.children.forEach((tool, index) => { tool.position.x = (index === 0 ? -1 : 1) * (frame.phase === 'service' ? 1.12 + frame.toolPulse * .07 : 2.4); });
    camera.position.set(5.8 - frame.speed * 1.5, 3.4, 6.8 + frame.speed * 3);
    cameraTarget.current.set(0, .65, frame.carZ * .45);
    camera.lookAt(cameraTarget.current);
    gl.domElement.dataset.pitPhase = frame.phase;
  });
  return <>
    <color attach="background" args={['#050a12']} /><fog attach="fog" args={['#050a12', 12, 38]} />
    <ambientLight intensity={1.6} /><directionalLight position={[3, 8, 5]} intensity={3.5} />
    <pointLight position={[-3, 3, 0]} color="#37ffc9" intensity={25} /><pointLight position={[3, 4, -3]} color="#658eff" intensity={35} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.06, 0]}><planeGeometry args={[60, 70]} /><meshStandardMaterial color="#111b25" roughness={.65} metalness={.2} /></mesh>
    {[-2.05, 2.05].map(x => <mesh key={x} position={[x, -.015, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[.065, 42]} /><meshBasicMaterial color="#60e7c0" /></mesh>)}
    <group ref={lanes}>{Array.from({ length: 14 }, (_, i) => <mesh key={i} position={[3.4, -.012, i * 3 - 22]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[.12, 1.2]} /><meshBasicMaterial color="#ced9e4" /></mesh>)}</group>
    <group position={[0, 0, -3.5]}>
      {[-3.2, 3.2].map(x => <mesh key={x} position={[x, 2.3, 0]}><boxGeometry args={[.24, 4.6, .35]} /><meshStandardMaterial color="#253849" metalness={.6} roughness={.3} /></mesh>)}
      <mesh position={[0, 4.5, 0]}><boxGeometry args={[6.7, .24, .35]} /><meshBasicMaterial color="#65e4c3" /></mesh>
      <mesh position={[0, 2.5, -.3]}><boxGeometry args={[6.2, 5, .2]} /><meshStandardMaterial color="#0c1721" /></mesh>
      {[-2, 0, 2].map(x => <mesh key={x} position={[x, 2.8, -.16]}><boxGeometry args={[.055, 2.9, .05]} /><meshBasicMaterial color="#5097db" /></mesh>)}
    </group>
    <group ref={car}>
      <RoundedBox args={[1.9, .5, 4.05]} radius={.18} position={[0, .65, 0]}><meshStandardMaterial color="#b6ccd2" metalness={.7} roughness={.24} /></RoundedBox>
      <RoundedBox args={[1.58, .67, 1.9]} radius={.26} position={[0, 1.2, -.2]}><meshStandardMaterial color="#193446" metalness={.65} roughness={.13} /></RoundedBox>
      <mesh position={[0, .92, 1.2]} rotation={[-.12, 0, 0]}><boxGeometry args={[1.75, .07, 1.18]} /><meshStandardMaterial color="#dce9eb" metalness={.7} roughness={.25} /></mesh>
      <mesh position={[0, .67, 2.035]}><boxGeometry args={[1.55, .055, .035]} /><meshBasicMaterial color="#d3fff2" /></mesh>
      <mesh position={[0, .66, -2.035]}><boxGeometry args={[1.58, .04, .035]} /><meshBasicMaterial color="#fa544f" /></mesh>
      <mesh position={[0, .95, -1.8]}><boxGeometry args={[2.04, .08, .36]} /><meshStandardMaterial color="#1a2f39" /></mesh>
      <mesh position={[0, .27, 0]}><boxGeometry args={[1.63, .15, 2.7]} /><meshStandardMaterial color="#26b894" emissive="#14b789" emissiveIntensity={.6} /></mesh>
      <group ref={wheels}>{[-1, 1].flatMap(x => [-1.24, 1.24].map(z => <group key={`${x}-${z}`} position={[x * .94, .4, z]}>
        <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[.39, .39, .28, 20]} /><meshStandardMaterial color="#11151a" roughness={.9} /></mesh>
        <mesh rotation={[0, 0, Math.PI / 2]} position={[x * .155, 0, 0]}><cylinderGeometry args={[.23, .23, .015, 12]} /><meshStandardMaterial color="#9db1ba" metalness={.8} roughness={.23} /></mesh>
      </group>))}</group>
    </group>
    <group ref={tools}>{[-1, 1].map(x => <group key={x} position={[x * 2.4, .4, 1.24]}>
      <mesh><boxGeometry args={[.45, .45, .65]} /><meshStandardMaterial color="#278d86" metalness={.65} roughness={.3} /></mesh>
      <mesh position={[-x * .22, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[.065, .065, .5, 12]} /><meshStandardMaterial color="#bbcbd1" metalness={.8} roughness={.2} /></mesh>
      <mesh position={[0, .28, 0]}><sphereGeometry args={[.045, 8, 8]} /><meshBasicMaterial color="#7effd4" /></mesh>
    </group>)}</group>
  </>;
}

export function PitStopIntro({ onActiveChange }: { onActiveChange: (active: boolean) => void }) {
  const [open, setOpen] = useState(() => isPitStopEntry(window.location.search) && !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [phase, setPhase] = useState<PitPhase>('racing'), [soundOn, setSoundOn] = useState(false);
  const elapsed = useRef(0), layer = useRef<HTMLDivElement>(null), progress = useRef<HTMLDivElement>(null);
  const sceneReady = useRef(false);
  const audio = useRef<ReturnType<typeof createPitStopAudio> | null>(null), skip = useRef<HTMLButtonElement>(null);
  const finish = useCallback(() => { audio.current?.dispose(); audio.current = null; setOpen(false); onActiveChange(false); }, [onActiveChange]);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (isPitStopEntry(url.search)) { url.searchParams.delete('intro'); window.history.replaceState(null, '', url); }
  }, []);
  useEffect(() => {
    if (!open) return;
    onActiveChange(true);
    const previousOverflow = document.body.style.overflow, previousFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden'; skip.current?.focus({ preventScroll: true });
    let alive = true;
    // Autoplay may be permitted after portal navigation; otherwise the visible
    // sound button resumes this same context inside a trusted user gesture.
    try { audio.current = createPitStopAudio(); void audio.current.enable().then(enabled => { if (alive) setSoundOn(enabled); }); } catch { /* Silent visual fallback. */ }
    let frameId = 0, previous = performance.now(), waitingSeconds = 0, currentPhase: PitPhase = 'racing';
    const tick = (now: number) => {
      if (!document.hidden) {
        waitingSeconds += (now - previous) / 1000;
        if (sceneReady.current) elapsed.current += (now - previous) / 1000;
      }
      previous = now;
      const frame = pitStopFrame(elapsed.current);
      if (layer.current) layer.current.style.opacity = String(Math.max(0,Math.min(1,waitingSeconds/.35,(PIT_STOP_SECONDS-elapsed.current)/.8)));
      if (progress.current) progress.current.style.transform = `scaleX(${frame.progress})`;
      if (currentPhase !== frame.phase) { currentPhase = frame.phase; setPhase(frame.phase); }
      audio.current?.update(elapsed.current);
      if (frame.done || (!sceneReady.current && waitingSeconds > 10)) { finish(); return; }
      frameId = requestAnimationFrame(tick);
    };
    const hide = () => {
      // RAF can stop completely in a background tab. Do not count hidden time
      // as playback time when the first foreground frame arrives.
      previous = performance.now();
      if (document.hidden) { audio.current?.mute(); setSoundOn(false); }
    };
    document.addEventListener('visibilitychange', hide);
    frameId = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(frameId); audio.current?.dispose(); audio.current = null;
      document.removeEventListener('visibilitychange', hide); document.body.style.overflow = previousOverflow;
      onActiveChange(false); if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [open, finish, onActiveChange]);
  const toggleSound = async () => {
    if (soundOn) { audio.current?.mute(); setSoundOn(false); return; }
    try { audio.current ??= createPitStopAudio(); setSoundOn(await audio.current.enable()); } catch { setSoundOn(false); }
  };
  if (!open) return null;
  return <div ref={layer} className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="pit-title" data-phase={phase} onKeyDown={event => {
    if (event.key === 'Escape') { event.stopPropagation(); finish(); }
    if (event.key === 'Tab') {
      const buttons = Array.from(event.currentTarget.querySelectorAll('button'));
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      event.preventDefault(); buttons[(index + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length]?.focus();
    }
  }}>
    <IntroBoundary><Canvas style={{position:'absolute',inset:0}} dpr={[1, 1.5]} camera={{ position: [5.8, 3.4, 9], fov: 43 }} gl={{ antialias: true }} fallback={<div className={styles.fallback}>피트 스톱 · 차량 관리 화면 준비 중</div>} onCreated={({ gl }) => gl.domElement.setAttribute('aria-label', '피트 스톱 입장 애니메이션')}><PitScene elapsed={elapsed} ready={sceneReady}/></Canvas></IntroBoundary>
    <header className={styles.header}><span>EVision <small>PIT LANE</small></span><div><button onClick={toggleSound} aria-pressed={soundOn}>{soundOn ? '소리 끄기' : '소리 켜기'}</button><button ref={skip} onClick={finish}>건너뛰기 →</button></div></header>
    <div className={styles.copy}><span className={styles.eyebrow}>A LITTLE CARE. A LONGER JOURNEY.</span><h1 id="pit-title">{captions[phase][0]}</h1><p>{captions[phase][1]}</p><div className={styles.progress}><div ref={progress} /></div><small>주행 · 피트 진입 · 정비 · 내 차 관리</small></div>
    <span className={styles.soundNote}>{soundOn ? '주행음·정비음 연출 재생 중' : '소리 켜기를 누르면 주행음·정비음이 함께 재생됩니다'}</span>
  </div>;
}
