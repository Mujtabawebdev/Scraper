import type { HTMLAttributes, ReactNode } from "react";

export interface FormFieldErrorProps
  extends Omit<HTMLAttributes<HTMLParagraphElement>, "children"> {
  children?: ReactNode;
  message?: ReactNode;
}

export function FormFieldError({
  children,
  className,
  message,
  ...props
}: FormFieldErrorProps) {
  const content = message ?? children;

  if (!content) {
    return null;
  }

  return (
    <p
      className={["mt-1.5 text-sm text-red-600", className]
        .filter(Boolean)
        .join(" ")}
      role="alert"
      {...props}
    >
      {content}
    </p>
  );
}
