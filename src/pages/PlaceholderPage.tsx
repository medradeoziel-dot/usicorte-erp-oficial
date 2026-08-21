import { Construction } from "lucide-react";

interface PlaceholderPageProps {
  title: string;
}

export default function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-slate-700/60 rounded-2xl flex items-center justify-center mx-auto">
          <Construction size={28} className="text-slate-500" />
        </div>
        <div>
          <h2 className="text-white font-semibold text-lg">{title}</h2>
          <p className="text-slate-400 text-sm mt-1">Módulo em desenvolvimento — em breve disponível.</p>
        </div>
        <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs px-3 py-1.5 rounded-full">
          <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
          Em breve
        </div>
      </div>
    </div>
  );
}
