import React from 'react';

export default function StatusBar({ 
  connectionStatus, 
  participantCount, 
  isEncrypted, 
  isScreenSharing, 
  screenSharingUserId,
  roomId 
}) {
  return (
    <div className="mb-4 sm:mb-6 flex justify-center">
      <div className="bg-white/10 backdrop-blur-xl rounded-full px-3 sm:px-6 py-2 sm:py-3 border border-white/20 shadow-lg">
        <div className="flex items-center gap-2 sm:gap-4 flex-wrap justify-center">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-green-400 animate-pulse"></div>
            <span className="text-white text-xs sm:text-sm font-medium">{connectionStatus}</span>
          </div>
          
          <div className="flex items-center gap-2 pl-2 sm:pl-4 border-l border-white/30">
            <svg className="w-3 h-3 sm:w-4 sm:h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
            </svg>
            <span className="text-blue-400 text-xs sm:text-sm font-medium">{participantCount}</span>
          </div>
          
          {isEncrypted && (
            <div className="hidden sm:flex items-center gap-2 pl-4 border-l border-white/30">
              <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              <span className="text-green-400 text-sm font-medium">Encrypted</span>
            </div>
          )}
          
          {(isScreenSharing || screenSharingUserId) && (
            <div className="flex items-center gap-2 pl-2 sm:pl-4 border-l border-white/30">
              <svg className="w-3 h-3 sm:w-4 sm:h-4 text-blue-400 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v8a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm1 1v6h12V5H4z" clipRule="evenodd" />
              </svg>
              <span className="text-blue-400 text-xs sm:text-sm font-medium hidden sm:inline">
                {isScreenSharing ? 'You are sharing' : 'Someone is sharing'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
