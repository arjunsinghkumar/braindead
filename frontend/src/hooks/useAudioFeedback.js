import { useEffect, useRef } from "react";
import AudioFeedback from "../utils/audioEngine.js";

export default function useAudioFeedback(active = false) {
  const ref = useRef(null);

  useEffect(() => {
    if (!active) return;
    ref.current = new AudioFeedback();
    ref.current.start();
    return () => {
      if (ref.current) ref.current.stop();
      ref.current = null;
    };
  }, [active]);

  return {
    setScore: (s) => ref.current && ref.current.setScore(s),
  };
}
