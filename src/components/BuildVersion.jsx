import React from 'react';

const BUILD_INFO = {
  version: '1.0.0',
  build: '20251021',
  date: 'October 21, 2025'
};

export default function BuildVersion() {
  return (
    <div className="fixed bottom-4 left-4 z-40">
      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-lg px-3 py-2 shadow-lg">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-white/40" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="text-white/60 text-xs font-mono">
              v{BUILD_INFO.version} <span className="text-white/40">· Build {BUILD_INFO.build}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export { BUILD_INFO };
