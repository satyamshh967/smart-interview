import React, { memo, useEffect, useRef, useState } from 'react';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Radio,
  Sparkles,
  MessageSquareCode,
  AlertCircle,
  Loader2,
  AudioLines
} from 'lucide-react';
import { NLPFeedback } from '../types';
import { getCommunicationFeedback } from '../services/api';

interface VideoRecorderProps {
  interviewId?: string;
  problemId?: string;
  /** Returns the current code on demand (avoids re-rendering this panel on every keystroke) */
  getCode?: () => string;
  onTranscriptChange: (transcript: string) => void;
  onNlpEvaluated?: (feedback: NLPFeedback) => void;
  candidateName?: string;
}

// Minimal typing for the (vendor-prefixed) Web Speech API
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
};

const getSpeechRecognition = (): (new () => SpeechRecognitionLike) | null => {
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
};

const initialsOf = (name?: string) =>
  (name || 'Candidate')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

const formatRecTime = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

/** Self-contained clock: only this tiny element re-renders every second. */
const RecClock = memo(function RecClock({ startedAt }: { startedAt: number }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => tick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  return <>{formatRecTime(Math.floor((Date.now() - startedAt) / 1000))}</>;
});

export const VideoRecorder = memo(function VideoRecorder({
  interviewId,
  problemId,
  getCode,
  onTranscriptChange,
  onNlpEvaluated,
  candidateName
}: VideoRecorderProps) {
  const [cameraActive, setCameraActive] = useState<boolean>(true);
  const [micActive, setMicActive] = useState<boolean>(true);
  const [explanation, setExplanation] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [nlpResult, setNlpResult] = useState<NLPFeedback | null>(null);
  const [nlpError, setNlpError] = useState<string | null>(null);
  const [isDictating, setIsDictating] = useState<boolean>(false);
  const [interimText, setInterimText] = useState<string>('');
  const [hasStream, setHasStream] = useState<boolean>(false);
  const [startedAt] = useState(() => Date.now());

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const explanationRef = useRef<string>(explanation);
  explanationRef.current = explanation;
  const onTranscriptRef = useRef(onTranscriptChange);
  onTranscriptRef.current = onTranscriptChange;
  const speechSupported = typeof window !== 'undefined' && !!getSpeechRecognition();

  const handleExplanationChange = (val: string) => {
    setExplanation(val);
    onTranscriptRef.current(val);
  };

  // Initialize camera/mic. If the component unmounts before permission resolves,
  // the late stream is stopped immediately so the camera doesn't stay on.
  useEffect(() => {
    let cancelled = false;
    const startMedia = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setCameraActive(false);
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        mediaStreamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setHasStream(true);
      } catch {
        if (!cancelled) setCameraActive(false);
      }
    };
    startMedia();

    return () => {
      cancelled = true;
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
      recognitionRef.current?.stop();
    };
  }, []);

  // Re-attach the stream whenever the <video> element is re-mounted (camera toggled back on)
  useEffect(() => {
    if (cameraActive && videoRef.current && mediaStreamRef.current) {
      videoRef.current.srcObject = mediaStreamRef.current;
    }
  }, [cameraActive, hasStream]);

  // Actually enable/disable the underlying media tracks
  useEffect(() => {
    mediaStreamRef.current?.getVideoTracks().forEach((t) => { t.enabled = cameraActive; });
  }, [cameraActive, hasStream]);
  useEffect(() => {
    mediaStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = micActive; });
    if (!micActive) recognitionRef.current?.stop();
  }, [micActive, hasStream]);

  const toggleDictation = () => {
    if (isDictating) {
      recognitionRef.current?.stop();
      return;
    }
    const Recognition = getSpeechRecognition();
    if (!Recognition) return;
    const rec = new Recognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.onresult = (event: any) => {
      let finalChunk = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalChunk += text;
        else interim += text;
      }
      setInterimText(interim);
      if (finalChunk.trim()) {
        const current = explanationRef.current;
        handleExplanationChange((current ? current.replace(/\s*$/, ' ') : '') + finalChunk.trim());
      }
    };
    rec.onerror = (e: any) => {
      if (e?.error && e.error !== 'no-speech' && e.error !== 'aborted') {
        setNlpError(`Speech recognition error: ${e.error}`);
      }
    };
    rec.onend = () => {
      setIsDictating(false);
      setInterimText('');
      recognitionRef.current = null;
    };
    recognitionRef.current = rec;
    setNlpError(null);
    setMicActive(true);
    rec.start();
    setIsDictating(true);
  };

  const handleAnalyzeTranscript = async () => {
    if (!explanation.trim()) return;
    setIsAnalyzing(true);
    setNlpError(null);
    try {
      const feedback = await getCommunicationFeedback({
        interviewId,
        transcript: explanation,
        problemId,
        code: getCode?.(),
        timeTakenSeconds: Math.floor((Date.now() - startedAt) / 1000)
      });
      setNlpResult(feedback);
      onNlpEvaluated?.(feedback);
    } catch (err: any) {
      setNlpError(err?.message || 'Failed to analyze explanation');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <section aria-label="Candidate camera and explanation" className="flex flex-col bg-[#0D121F] rounded-2xl border border-white/5 overflow-hidden shadow-xl">
      {/* Video & Interviewer Feed Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900/80 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 text-rose-500 motion-safe:animate-pulse" aria-hidden="true" />
          <span className="text-xs font-semibold text-slate-300">Live Candidate Stream</span>
          <span className="font-mono text-[10px] text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
            <span className="sr-only">Recording time </span>REC <RecClock startedAt={startedAt} />
          </span>
        </div>

        {/* Media Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setMicActive(!micActive)}
            aria-label={micActive ? 'Mute microphone' : 'Unmute microphone'}
            aria-pressed={!micActive}
            title={micActive ? 'Mute Mic' : 'Unmute Mic'}
            className={`p-1 rounded-md text-xs transition-colors ${
              micActive ? 'text-slate-300 hover:bg-slate-800' : 'text-rose-400 bg-rose-500/10'
            }`}
          >
            {micActive ? <Mic className="w-3.5 h-3.5" aria-hidden="true" /> : <MicOff className="w-3.5 h-3.5" aria-hidden="true" />}
          </button>

          <button
            type="button"
            onClick={() => setCameraActive(!cameraActive)}
            disabled={!hasStream}
            aria-label={cameraActive ? 'Turn off camera' : 'Turn on camera'}
            aria-pressed={!cameraActive}
            title={hasStream ? (cameraActive ? 'Turn Off Camera' : 'Turn On Camera') : 'Camera unavailable'}
            className={`p-1 rounded-md text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              cameraActive ? 'text-slate-300 hover:bg-slate-800' : 'text-rose-400 bg-rose-500/10'
            }`}
          >
            {cameraActive ? <Video className="w-3.5 h-3.5" aria-hidden="true" /> : <VideoOff className="w-3.5 h-3.5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Video Viewport */}
      <div className="relative h-44 bg-[#080B12] flex items-center justify-center overflow-hidden border-b border-white/5">
        {cameraActive ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            aria-label="Your camera preview"
            className="w-full h-full object-cover transform -scale-x-100"
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-4 text-center">
            <div className="w-14 h-14 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center mb-2" aria-hidden="true">
              <span className="text-lg font-bold text-teal-400">{initialsOf(candidateName)}</span>
            </div>
            <p className="text-xs font-medium text-slate-300">
              {hasStream ? 'Camera Off' : 'Camera unavailable'}
            </p>
            <div className="flex items-center gap-1 mt-2.5 h-6" aria-hidden="true">
              <span className="w-1 bg-teal-500 rounded-full motion-safe:animate-wave-1" />
              <span className="w-1 bg-teal-400 rounded-full motion-safe:animate-wave-2" />
              <span className="w-1 bg-emerald-400 rounded-full motion-safe:animate-wave-3" />
              <span className="w-1 bg-teal-400 rounded-full motion-safe:animate-wave-4" />
              <span className="w-1 bg-teal-500 rounded-full motion-safe:animate-wave-5" />
            </div>
          </div>
        )}

        <div className="absolute bottom-2 left-2 bg-[#090D16]/80 backdrop-blur-md px-2 py-0.5 rounded-md text-[10px] text-slate-300 border border-white/5" aria-live="polite">
          {!micActive ? 'Mic: Muted' : isDictating ? 'Mic: Dictating (Speech-to-Text)' : 'Mic: Live'}
        </div>
      </div>

      {/* Candidate Verbal Solution & Explanation Input */}
      <div className="p-3 bg-[#0D121F] space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <MessageSquareCode className="w-3.5 h-3.5 text-teal-400" aria-hidden="true" />
            <label htmlFor="solution-explanation" className="text-xs font-semibold text-slate-300">
              Solution Reasoning &amp; Explanation
            </label>
          </div>

          <div className="flex items-center gap-1.5">
            {speechSupported && (
              <button
                type="button"
                onClick={toggleDictation}
                aria-pressed={isDictating}
                title={isDictating ? 'Stop dictation' : 'Dictate your explanation with speech-to-text'}
                className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-colors active:scale-95 ${
                  isDictating
                    ? 'text-rose-300 bg-rose-500/15 border-rose-500/30 motion-safe:animate-pulse'
                    : 'text-slate-300 bg-slate-800/60 hover:bg-slate-700/60 border-white/10'
                }`}
              >
                <AudioLines className="w-3 h-3" aria-hidden="true" />
                <span>{isDictating ? 'Stop' : 'Dictate'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleAnalyzeTranscript}
              disabled={isAnalyzing || !explanation.trim()}
              aria-busy={isAnalyzing}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-teal-300 bg-teal-500/10 hover:bg-teal-500/20 active:scale-95 rounded-lg border border-teal-500/30 transition-colors disabled:opacity-50"
            >
              {isAnalyzing ? (
                <Loader2 className="w-3 h-3 motion-safe:animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="w-3 h-3 text-teal-400" aria-hidden="true" />
              )}
              <span>Analyze with NLP</span>
            </button>
          </div>
        </div>

        <textarea
          id="solution-explanation"
          value={explanation}
          onChange={(e) => handleExplanationChange(e.target.value)}
          rows={3}
          className="w-full p-2.5 bg-[#090D16] text-slate-200 text-xs rounded-xl border border-white/5 resize-none focus:border-teal-500/40 leading-relaxed font-sans"
          placeholder="Articulate your thought process: approach, time/space complexity O(n), edge cases, and trade-offs…"
        />
        {interimText && (
          <p className="text-[11px] italic text-slate-400 -mt-1" aria-live="polite">{interimText}…</p>
        )}
        {nlpError && (
          <p role="alert" className="flex items-start gap-1 text-[11px] text-rose-300">
            <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" aria-hidden="true" />
            {nlpError}
          </p>
        )}

        <div role="status" aria-live="polite">
          {nlpResult && (
            <div className="p-2.5 bg-teal-950/20 rounded-xl border border-teal-500/20 space-y-1.5 animate-fadeIn">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">Communication Score:</span>
                <span className="font-bold text-teal-400">{nlpResult.overallScore}/100</span>
              </div>

              <div className="flex flex-wrap gap-1">
                {nlpResult.complexityIdentified && (
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                    Big-O Complexity Identified
                  </span>
                )}
                {(nlpResult.detectedKeywords || []).slice(0, 4).map((kw, i) => (
                  <span key={i} className="text-[10px] bg-teal-500/10 text-teal-300 border border-teal-500/20 px-1.5 py-0.5 rounded">
                    {kw}
                  </span>
                ))}
              </div>

              {nlpResult.strengths?.[0] && (
                <p className="text-[11px] text-slate-400 leading-tight">
                  <span className="text-emerald-400 font-semibold" aria-hidden="true">&bull; </span>
                  {nlpResult.strengths[0]}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
});
