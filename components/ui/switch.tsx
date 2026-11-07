type SwitchProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
};

/** The suggestions toggle: a 52×32 track with a 26px knob, from docs/design/04. */
export function Switch({ checked, onChange, label, disabled = false }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex h-11 w-[52px] shrink-0 items-center justify-center bg-transparent p-0"
    >
      <span
        className={`relative block h-8 w-[52px] rounded-full transition-colors duration-150 ${
          checked ? "bg-ink" : "bg-[#D9D6CF]"
        }`}
      >
        <span
          className={`absolute top-[3px] block size-[26px] rounded-full bg-surface shadow-[0_1px_3px_rgba(23,24,26,0.3)] transition-[left] duration-150 ${
            checked ? "left-[23px]" : "left-[3px]"
          }`}
        />
      </span>
    </button>
  );
}
