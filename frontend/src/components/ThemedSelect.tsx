import { lazy, Suspense } from "react";
import type { ThemedSelectProps } from "./themedSelectTypes";

const Control = lazy(() => import("./ThemedSelectControl"));

// Load the option-menu library only on screens that contain dropdowns.
export function ThemedSelect(props: ThemedSelectProps) {
  const { onValueChange, ...nativeProps } = props;
  return (
    <Suspense
      fallback={
        <>
          <button
            type="button"
            id={props.id}
            className="themed-select-trigger"
            disabled
          >
            Loading options…
          </button>
          <select
            {...nativeProps}
            id={props.id ? `${props.id}-native` : undefined}
            className="themed-select-native"
            aria-hidden="true"
            tabIndex={-1}
            onInvalid={(event) => event.preventDefault()}
            onChange={(event) => onValueChange?.(event.target.value)}
          />
        </>
      }
    >
      <Control {...props} />
    </Suspense>
  );
}
