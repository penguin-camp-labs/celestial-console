import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { localInput } from '@/lib/engine.mjs';
import { DisplayClock } from '@/lib/clock.mjs';
export default function TimelineClock({
  time,
  offset,
  playing,
  reduced,
}: {
  time: number;
  offset: number;
  playing: boolean;
  reduced: boolean;
}) {
  const clock = useRef(new DisplayClock());
  const latest = useRef(time);
  const [display, setDisplay] = useState(time);
  latest.current = time;
  useLayoutEffect(() => {
    const active = playing && !reduced && !document.hidden;
    const value = clock.current.sample(time, performance.now(), active);
    setDisplay(value);
  }, [time, playing, reduced]);
  useEffect(() => {
    if (!playing || reduced) return;
    let frame = 0;
    const draw = (now: number) => {
      setDisplay(clock.current.value(now));
      frame = requestAnimationFrame(draw);
    };
    const visibility = () => {
      cancelAnimationFrame(frame);
      clock.current.sample(latest.current, performance.now(), false);
      setDisplay(latest.current);
      if (!document.hidden) frame = requestAnimationFrame(draw);
    };
    if (!document.hidden) frame = requestAnimationFrame(draw);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [playing, reduced]);
  const shown = playing && !reduced ? display : time;
  const iso = localInput(shown, offset);
  return (
    <div>
      <span className="date-number">
        {iso.slice(0, 10).replaceAll('-', '.')}
      </span>
      <time dateTime={new Date(shown).toISOString()}>{iso.slice(11, 19)}</time>
    </div>
  );
}
