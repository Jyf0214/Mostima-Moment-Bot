import React, { useId } from 'react';

export interface ToggleFieldProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}

export default function ToggleField({
  label,
  description,
  checked,
  onChange,
  className = '',
}: ToggleFieldProps) {
  const switchId = useId();

  return (
    <div
      className={`flex items-center justify-between py-3 px-4 bg-zinc-50 rounded-xl ${className}`}
    >
      <div>
        <label htmlFor={switchId} className="text-sm font-medium text-zinc-900 cursor-pointer">
          {label}
        </label>
        {description && <div className="text-xs text-zinc-400 mt-0.5">{description}</div>}
      </div>
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 ${
          checked ? 'bg-zinc-900' : 'bg-zinc-200'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
