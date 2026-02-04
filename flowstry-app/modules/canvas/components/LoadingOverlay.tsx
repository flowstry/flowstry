import React from 'react';

export const LoadingOverlay: React.FC = () => {
    return (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-zinc-950/50 backdrop-blur-sm">
            <div className="relative flex items-center justify-center">
                {/* Background Ring */}
                <div className="absolute h-16 w-16 rounded-full border-2 border-zinc-800" />
                
                {/* Spinner Ring */}
                <div className="absolute h-16 w-16 rounded-full border-2 border-t-[#36C3AD] border-r-transparent border-b-transparent border-l-transparent animate-spin" />
                
                {/* Logo */}
                <img 
                    src="/logo.svg" 
                    alt="Loading..." 
                    className="relative z-10 w-8 h-8 object-contain"
                />
            </div>
        </div>
    );
};
