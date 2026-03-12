import React, { useState } from 'react';
import { Smartphone, ChevronLeft } from 'lucide-react';

export function PhoneInterface({ phoneData, onBack }: { phoneData: any[], onBack: () => void }) {
  const [selectedApp, setSelectedApp] = useState<any | null>(null);

  if (selectedApp) {
    return (
      <div className="bg-white rounded-3xl p-4 shadow-sm border border-zinc-100 h-full flex flex-col">
        <button onClick={() => setSelectedApp(null)} className="flex items-center gap-2 mb-4 text-zinc-600">
          <ChevronLeft size={20} /> 返回
        </button>
        <h2 className="text-xl font-bold mb-4">{selectedApp.app}</h2>
        <div className="flex-1 overflow-y-auto">
          <pre className="text-xs text-zinc-600 bg-zinc-50 p-4 rounded-xl whitespace-pre-wrap">{JSON.stringify(selectedApp.content, null, 2)}</pre>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      {phoneData.map((p, i) => (
        <button 
          key={i} 
          onClick={() => setSelectedApp(p)}
          className="bg-white rounded-2xl p-4 shadow-sm border border-zinc-100 flex flex-col items-center gap-2 hover:border-zinc-300 transition-all active:scale-95"
        >
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-900">
            <Smartphone size={24} />
          </div>
          <p className="font-bold text-xs text-center">{p.app}</p>
        </button>
      ))}
    </div>
  );
}
