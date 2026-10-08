import type { ThemedSelectProps } from "./themedSelectTypes";
import * as Select from "@radix-ui/react-select";
import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";

type Option = { value: string; label: ReactNode; disabled: boolean };
const EMPTY = "__nomnom_empty_option__";

function text(node: ReactNode): string {
  if (Array.isArray(node)) return node.map(text).join("");
  if (isValidElement<{ children?: ReactNode }>(node))
    return text(node.props.children);
  return typeof node === "string" || typeof node === "number"
    ? String(node)
    : "";
}
function optionsFrom(children: ReactNode): Option[] {
  return Children.toArray(children).flatMap((child) => {
    if (
      !isValidElement<{
        value?: string | number;
        children?: ReactNode;
        disabled?: boolean;
      }>(child)
    )
      return [];
    if (child.type !== "option")
      return optionsFrom(child.props.children).map((option) => ({
        ...option,
        disabled: Boolean(child.props.disabled) || option.disabled,
      }));
    return [
      {
        value: String(child.props.value ?? text(child.props.children)),
        label: child.props.children,
        disabled: Boolean(child.props.disabled),
      },
    ];
  });
}

/** A themed menu with a real native form field for validation and FormData. */
export default function ThemedSelectControl({
  children,
  value,
  defaultValue,
  onValueChange,
  id,
  className,
  disabled,
  required,
  ...props
}: ThemedSelectProps) {
  const generatedId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const native = useRef<HTMLSelectElement>(null);
  const options = optionsFrom(children);
  const [localValue, setLocalValue] = useState(() =>
    String(
      defaultValue ?? options.find((option) => !option.disabled)?.value ?? "",
    ),
  );
  const [invalid, setInvalid] = useState(false);
  const selected = value === undefined ? localValue : String(value);
  const selectedOption = options.find((option) => option.value === selected);
  const triggerId = id ?? generatedId;

  useEffect(() => {
    const form = native.current?.form;
    if (!form || value !== undefined) return;
    function reset() {
      setLocalValue(
        String(
          defaultValue ??
            optionsFrom(children).find((option) => !option.disabled)?.value ??
            "",
        ),
      );
      setInvalid(false);
    }
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [children, defaultValue, value]);

  function change(next: string) {
    if (value === undefined) setLocalValue(next);
    setInvalid(false);
    onValueChange?.(next);
  }
  return (
    <>
      <Select.Root
        disabled={disabled}
        value={selected || EMPTY}
        onValueChange={(next) => change(next === EMPTY ? "" : next)}
      >
        <Select.Trigger
          ref={trigger}
          id={triggerId}
          className={`themed-select-trigger ${className ?? ""}`}
          aria-label={props["aria-label"]}
          aria-labelledby={props["aria-labelledby"]}
          aria-describedby={
            [props["aria-describedby"], invalid ? `${triggerId}-error` : ""]
              .filter(Boolean)
              .join(" ") || undefined
          }
          aria-required={required}
          aria-invalid={invalid || props["aria-invalid"]}
        >
          <Select.Value>
            {selectedOption?.label ?? "Choose an option"}
          </Select.Value>
          <Select.Icon aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="m4 7 5 5 5-5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content
            className="themed-select-menu"
            position="popper"
            sideOffset={6}
            collisionPadding={12}
          >
            <Select.ScrollUpButton
              className="themed-select-scroll"
              aria-label="Scroll up"
            >
              ⌃
            </Select.ScrollUpButton>
            <Select.Viewport className="themed-select-options">
              {options.map((option) => (
                <Select.Item
                  key={option.value || EMPTY}
                  value={option.value || EMPTY}
                  disabled={option.disabled}
                  textValue={text(option.label)}
                  className="themed-select-option"
                >
                  <Select.ItemIndicator
                    className="themed-select-check"
                    aria-hidden="true"
                  >
                    ✓
                  </Select.ItemIndicator>
                  <Select.ItemText>{option.label}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.Viewport>
            <Select.ScrollDownButton
              className="themed-select-scroll"
              aria-label="Scroll down"
            >
              ⌄
            </Select.ScrollDownButton>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
      {invalid && (
        <span
          id={`${triggerId}-error`}
          className="themed-select-error"
          role="alert"
        >
          Please choose an option.
        </span>
      )}
      <select
        {...props}
        id={`${triggerId}-native`}
        ref={native}
        className="themed-select-native"
        aria-hidden="true"
        tabIndex={-1}
        disabled={disabled}
        required={required}
        value={selected}
        onChange={(event) => change(event.target.value)}
        onInvalid={(event) => {
          event.preventDefault();
          setInvalid(true);
          trigger.current?.focus();
          props.onInvalid?.(event);
        }}
      >
        {children}
      </select>
    </>
  );
}
