import type { SelectHTMLAttributes } from "react";

export type ThemedSelectProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "onChange" | "value" | "defaultValue" | "multiple" | "size"
> & {
  value?: string | number;
  defaultValue?: string | number;
  onValueChange?: (value: string) => void;
};
