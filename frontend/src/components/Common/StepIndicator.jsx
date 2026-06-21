export function StepIndicator({ steps, currentStep }) {
  return (
    <div className="flex items-center gap-3 mb-8">
      {steps.map((step, idx) => (
        <div key={idx} className="flex items-center gap-3">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm transition-all ${
            idx < currentStep
              ? 'bg-green-500 text-white'
              : idx === currentStep
              ? 'bg-indigo-500 text-white ring-2 ring-indigo-300'
              : 'bg-slate-700 text-slate-400'
          }`}>
            {idx < currentStep ? '✓' : idx + 1}
          </div>
          <div className="hidden sm:block">
            <div className="text-sm font-semibold">{step}</div>
          </div>
          {idx < steps.length - 1 && (
            <div className={`hidden md:block flex-1 h-1 rounded-full transition-all ${
              idx < currentStep ? 'bg-green-500' : 'bg-slate-700'
            }`} style={{ minWidth: '60px' }} />
          )}
        </div>
      ))}
    </div>
  );
}
