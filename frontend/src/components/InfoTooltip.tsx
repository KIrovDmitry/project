import React from 'react';
import { HelpCircle } from 'lucide-react';

interface InfoTooltipProps {
  text: string;
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({ text }) => {
  return (
    <span className="relative group inline-block ml-1.5 align-middle text-gray-400 hover:text-gray-600 transition-colors cursor-help">
      <HelpCircle className="h-3.5 w-3.5" />
      <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-52 p-2.5 text-[10px] leading-normal bg-[#2c3e50] text-white rounded-lg shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 z-[9999] text-center font-medium normal-case">
        {text}
        <span className="absolute top-full left-1/2 transform -translate-x-1/2 border-opacity-100 border-[6px] border-transparent border-t-[#2c3e50]" />
      </span>
    </span>
  );
};
