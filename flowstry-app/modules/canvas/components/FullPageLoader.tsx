import React from 'react';

export const FullPageLoader: React.FC = () => {
  return (
    <div className="flex items-center justify-center h-screen w-screen bg-zinc-950">
      <div className="relative flex items-center justify-center">
        {/* Background Ring */}
        <div className="absolute h-20 w-20 rounded-full border-2 border-zinc-800" />
        
        {/* Spinner Ring */}
        <div className="absolute h-20 w-20 rounded-full border-2 border-t-[#36C3AD] border-r-transparent border-b-transparent border-l-transparent animate-spin" />
        
        {/* Logo */}
        <img 
          src="/logo.svg" 
          alt="Flowstry" 
          className="relative z-10 w-10 h-10 object-contain"
        />
      </div>
    </div>
  );
};
