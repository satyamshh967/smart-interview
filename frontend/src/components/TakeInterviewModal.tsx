import React, { useRef, useState } from 'react';
import { useDialog } from '../hooks/useDialog';
import { 
  X, 
  Sparkles, 
  Terminal, 
  Cpu, 
  Brain, 
  Clock, 
  ChevronRight, 
  Layers, 
  ShieldCheck, 
  CheckCircle2,
  Code2,
  Camera
} from 'lucide-react';

interface TakeInterviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartInterview: (track: string, difficulty: string) => void;
  isStarting?: boolean;
}

export const TakeInterviewModal: React.FC<TakeInterviewModalProps> = ({
  isOpen,
  onClose,
  onStartInterview,
  isStarting = false
}) => {
  const [selectedTrack, setSelectedTrack] = useState<string>('Fullstack Software Engineer');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('Medium');
  const [enableWebcam, setEnableWebcam] = useState<boolean>(true);
  const [enableNlp, setEnableNlp] = useState<boolean>(true);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialog(dialogRef, onClose, isOpen);

  if (!isOpen) return null;

  const tracks = [
    {
      id: 'Fullstack Software Engineer',
      title: 'Fullstack Software Engineer',
      desc: 'Balanced assessment of algorithmic problem solving, API architecture, and linear time optimization.',
      icon: Terminal,
      time: '30 Mins',
      questions: '3 Problems'
    },
    {
      id: 'Backend Systems & Architecture',
      title: 'Backend Systems & Architecture',
      desc: 'Focus on distributed bottlenecks, database structures, high-throughput caching, and Big-O efficiency.',
      icon: Cpu,
      time: '45 Mins',
      questions: '3 Problems'
    },
    {
      id: 'Core Data Structures & Algorithms',
      title: 'Core Data Structures & Algorithms',
      desc: 'Pure algorithmic rigor: dynamic programming, graphs, binary trees, hash maps, and space trade-offs.',
      icon: Code2,
      time: '25 Mins',
      questions: '2 Problems'
    },
    {
      id: 'Frontend Engineering & Web Systems',
      title: 'Frontend Engineering & Web Systems',
      desc: 'Component architecture, state management patterns, DOM performance, and responsive algorithms.',
      icon: Layers,
      time: '30 Mins',
      questions: '2 Problems'
    }
  ];

  const difficulties = [
    { id: 'Easy', label: 'Junior (Easy)', badge: '15-20 min' },
    { id: 'Medium', label: 'Mid-Level (Medium)', badge: '30-35 min' },
    { id: 'Hard', label: 'Senior (Hard)', badge: '45-60 min' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn select-none" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="take-interview-title"
        aria-describedby="take-interview-desc"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden"
      >
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-teal-600 dark:text-teal-400" aria-hidden="true" />
            </div>
            <div>
              <h2 id="take-interview-title" className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                Select Your Interview Assessment
              </h2>
              <p id="take-interview-desc" className="text-xs text-slate-500 dark:text-slate-400">
                Choose a role track & difficulty to start your live AI-evaluated simulation
              </p>
            </div>
          </div>

          <button type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Track Selection */}
          <div>
            <h3 id="track-label" className="text-xs uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 block mb-2.5">
              1. Choose Specialization Track
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-labelledby="track-label">
              {tracks.map((t) => {
                const Icon = t.icon;
                const isSelected = selectedTrack === t.id;

                return (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    key={t.id}
                    onClick={() => setSelectedTrack(t.id)}
                    className={`text-left p-4 rounded-2xl border cursor-pointer transition-colors flex flex-col justify-between ${
                      isSelected
                        ? 'bg-teal-50/60 dark:bg-teal-500/10 border-teal-500 shadow-sm'
                        : 'bg-white dark:bg-[#090D16] border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                          isSelected ? 'bg-teal-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}>
                          <Icon className="w-4 h-4" aria-hidden="true" />
                        </div>
                        <span className="text-[10px] font-mono font-medium text-slate-500 dark:text-slate-400">
                          {t.time}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-tight mb-1">
                        {t.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
                        {t.desc}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[10px] font-semibold text-teal-600 dark:text-teal-400">
                      <span>{t.questions}</span>
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" aria-hidden="true" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Difficulty Selection */}
          <div>
            <h3 id="difficulty-label" className="text-xs uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 block mb-2.5">
              2. Select Experience &amp; Target Difficulty
            </h3>
            <div className="grid grid-cols-3 gap-2.5" role="radiogroup" aria-labelledby="difficulty-label">
              {difficulties.map((d) => {
                const isSelected = selectedDifficulty === d.id;

                return (
                  <button
                    key={d.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setSelectedDifficulty(d.id)}
                    className={`p-3 rounded-2xl border text-center transition-all ${
                      isSelected
                        ? 'bg-teal-600 text-white border-teal-600 shadow-md shadow-teal-500/20'
                        : 'bg-white dark:bg-[#090D16] border-slate-200 dark:border-white/5 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-xs font-bold">{d.id}</div>
                    <div className={`text-[10px] mt-0.5 ${isSelected ? 'text-teal-100' : 'text-slate-500 dark:text-slate-400'}`}>
                      {d.badge}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Connected Assessment Features */}
          <div className="p-3.5 bg-slate-50 dark:bg-[#090D16] rounded-2xl border border-slate-200 dark:border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="modalWebcam"
                checked={enableWebcam}
                onChange={(e) => setEnableWebcam(e.target.checked)}
                className="w-4 h-4 accent-teal-600 rounded cursor-pointer"
              />
              <label htmlFor="modalWebcam" className="text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
                Webcam & Audio Simulation
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="modalNlp"
                checked={enableNlp}
                onChange={(e) => setEnableNlp(e.target.checked)}
                className="w-4 h-4 accent-teal-600 rounded cursor-pointer"
              />
              <label htmlFor="modalNlp" className="text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
                Python NLP Speech Scoring (:8081)
              </label>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-[#0E1524] border-t border-slate-100 dark:border-white/5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-500" aria-hidden="true" />
            <span>C++ Evaluation Engine (:8082)</span>
          </div>

          <div className="flex items-center gap-2">
            <button type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>

            <button type="button"
              onClick={() => onStartInterview(selectedTrack, selectedDifficulty)}
              disabled={isStarting}
              aria-busy={isStarting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 shadow-lg shadow-teal-500/25 active:scale-95 transition-[background-color,transform] disabled:opacity-50"
            >
              <span>{isStarting ? 'Preparing Room…' : 'Start Technical Interview'}</span>
              <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
