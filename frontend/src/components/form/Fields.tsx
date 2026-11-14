import { useId, type ChangeEvent, type CSSProperties, type ReactNode } from "react";
import "./Fields.css";

interface FieldShellProps {
  id: string;
  label: ReactNode;
  tag?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

function FieldShell({ id, label, tag, error, hint, children }: FieldShellProps) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
        {tag ? <span className="field__tag">{tag}</span> : null}
      </label>
      {children}
      {error ? (
        <p className="field__error" id={`${id}-error`}>
          {error}
        </p>
      ) : hint ? (
        <p className="field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const describedBy = (id: string, error?: string, hint?: string) =>
  error ? `${id}-error` : hint ? `${id}-hint` : undefined;

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  tag?: string;
  unit?: string;
  placeholder?: string;
  kind?: "text" | "number";
  disabled?: boolean;
  maxLength?: number;
  autoComplete?: string;
}

export function TextField({
  label, value, onChange, error, hint, tag, unit, placeholder, kind = "text", disabled, maxLength, autoComplete = "off",
}: TextFieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} tag={tag} error={error} hint={hint}>
      <div className={`control${error ? " control--invalid" : ""}${disabled ? " control--disabled" : ""}`}>
        <input
          id={id}
          className="control__input"
          type="text"
          inputMode={kind === "number" ? "decimal" : "text"}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={maxLength}
          autoComplete={autoComplete}
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, hint)}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
        />
        {unit ? <span className="control__unit">{unit}</span> : null}
      </div>
    </FieldShell>
  );
}

interface SelectFieldProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function SelectField({ label, value, options, onChange, disabled }: SelectFieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label}>
      <div className={`control${disabled ? " control--disabled" : ""}`}>
        <select
          id={id}
          className="control__input control__input--select"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </FieldShell>
  );
}

interface SliderFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}

export function SliderField({ label, value, onChange, min = 0, max = 1, step = 0.05, disabled }: SliderFieldProps) {
  const id = useId();
  const percent = ((value - min) / (max - min)) * 100;
  return (
    <div className="field">
      <div className="slider__head">
        <label className="field__label" htmlFor={id}>
          {label}
        </label>
        <output className="slider__value" htmlFor={id}>
          {value.toFixed(2)}
        </output>
      </div>
      <input
        id={id}
        className="slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        style={{ "--fill": `${percent}%` } as CSSProperties}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

interface CheckboxFieldProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function CheckboxField({ label, checked, onChange, disabled }: CheckboxFieldProps) {
  const id = useId();
  return (
    <label className="checkbox" htmlFor={id}>
      <input
        id={id}
        className="checkbox__input"
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="checkbox__box" aria-hidden="true" />
      <span className="checkbox__label">{label}</span>
    </label>
  );
}

interface FormSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function FormSection({ title, description, children }: FormSectionProps) {
  return (
    <fieldset className="form-section">
      <legend className="form-section__title">{title}</legend>
      {description ? <p className="form-section__description">{description}</p> : null}
      {children}
    </fieldset>
  );
}

export function FieldRow({ children }: { children: ReactNode }) {
  return <div className="field-row">{children}</div>;
}
