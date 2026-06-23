export function FormInput({
  label,
  name,
  type = 'text',
  value,
  onChange,
  placeholder,
  required = false,
  error,
  disabled = false,
  ...props
}) {
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label htmlFor={name} className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {label} {required && <span className="text-red-400">*</span>}
        </label>
      )}
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-4 py-2 rounded-lg glass border border-slate-700 bg-slate-900/50 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        {...props}
      />
      {error && <span className="form-error">{error}</span>}
    </div>
  );
}

export function FormSelect({
  label,
  name,
  value,
  onChange,
  options,
  placeholder,
  required = false,
  error,
  disabled = false,
  ...props
}) {
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label htmlFor={name} className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {label} {required && <span className="text-red-400">*</span>}
        </label>
      )}
      <select
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="w-full px-4 py-2 rounded-lg glass border border-slate-700 bg-slate-900/50 text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options?.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <span className="form-error">{error}</span>}
    </div>
  );
}

export function FormTextarea({
  label,
  name,
  value,
  onChange,
  placeholder,
  required = false,
  error,
  disabled = false,
  rows = 4,
  ...props
}) {
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label htmlFor={name} className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {label} {required && <span className="text-red-400">*</span>}
        </label>
      )}
      <textarea
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        className="w-full px-4 py-2 rounded-lg glass border border-slate-700 bg-slate-900/50 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-mono text-sm"
        {...props}
      />
      {error && <span className="form-error">{error}</span>}
    </div>
  );
}
