import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { FormFieldError } from "../../../components/feedback/form-field-error";
import { Alert } from "../../../components/ui/alert";
import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { PasswordInput } from "../../../components/ui/password-input";
import {
  getApiErrorMessage,
  normalizeApiError,
} from "../../../services/api-client";
import { useRegister } from "../hooks/use-register";
import {
  registerFormSchema,
  type RegisterFormInput,
  type RegisterFormValues,
} from "../schemas/auth.schemas";

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null;

const isSafeInternalPath = (value: string): boolean =>
  value.startsWith("/") && !value.startsWith("//");

const getSafeDestination = (state: unknown): string => {
  if (!isRecord(state)) {
    return "/dashboard";
  }

  const { from } = state;
  if (typeof from === "string") {
    return isSafeInternalPath(from) ? from : "/dashboard";
  }

  if (
    isRecord(from) &&
    typeof from.pathname === "string" &&
    isSafeInternalPath(from.pathname)
  ) {
    const search =
      typeof from.search === "string" && from.search.startsWith("?")
        ? from.search
        : "";
    const hash =
      typeof from.hash === "string" && from.hash.startsWith("#")
        ? from.hash
        : "";
    return `${from.pathname}${search}${hash}`;
  }

  return "/dashboard";
};

const registerFieldNames = ["fullName", "email", "password"] as const;

export function RegisterPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const registerMutation = useRegister();
  const [generalError, setGeneralError] = useState<string | null>(null);

  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
  } = useForm<RegisterFormInput, unknown, RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      confirmPassword: "",
      email: "",
      fullName: "",
      password: "",
    },
  });

  const isPending = isSubmitting || registerMutation.isPending;

  const onSubmit = async (values: RegisterFormValues): Promise<void> => {
    setGeneralError(null);

    try {
      await registerMutation.mutateAsync(values);
      toast.success("Account created successfully");
      navigate(getSafeDestination(location.state as unknown), { replace: true });
    } catch (error: unknown) {
      const apiError = normalizeApiError(error);

      for (const fieldName of registerFieldNames) {
        const message = apiError.fieldErrors[fieldName];
        if (message) {
          setError(fieldName, { message, type: "server" });
        }
      }

      setGeneralError(getApiErrorMessage(apiError));
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>
          Start with a secure workspace for your US business leads.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {generalError ? (
          <Alert className="mb-5" variant="error">
            {generalError}
          </Alert>
        ) : null}

        <form
          aria-label="Create account"
          className="space-y-5"
          noValidate
          onSubmit={handleSubmit(onSubmit)}
        >
          <div>
            <Label htmlFor="register-full-name">Full name</Label>
            <Input
              {...register("fullName")}
              aria-describedby={
                errors.fullName ? "register-full-name-error" : undefined
              }
              autoComplete="name"
              className="mt-1.5"
              disabled={isPending}
              id="register-full-name"
              invalid={Boolean(errors.fullName)}
              placeholder="John Smith"
              type="text"
            />
            <FormFieldError
              id="register-full-name-error"
              message={errors.fullName?.message}
            />
          </div>

          <div>
            <Label htmlFor="register-email">Email address</Label>
            <Input
              {...register("email")}
              aria-describedby={
                errors.email ? "register-email-error" : undefined
              }
              autoCapitalize="none"
              autoComplete="email"
              className="mt-1.5"
              disabled={isPending}
              id="register-email"
              inputMode="email"
              invalid={Boolean(errors.email)}
              placeholder="john@example.com"
              type="email"
            />
            <FormFieldError
              id="register-email-error"
              message={errors.email?.message}
            />
          </div>

          <div>
            <Label htmlFor="register-password">Password</Label>
            <PasswordInput
              {...register("password")}
              aria-describedby={[
                "register-password-requirements",
                errors.password ? "register-password-error" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              autoComplete="new-password"
              className="mt-1.5"
              disabled={isPending}
              id="register-password"
              invalid={Boolean(errors.password)}
              placeholder="Create a strong password"
            />
            <p
              className="mt-1.5 text-xs leading-5 text-slate-500"
              id="register-password-requirements"
            >
              Use 8–128 characters with uppercase, lowercase, number, and special
              character.
            </p>
            <FormFieldError
              id="register-password-error"
              message={errors.password?.message}
            />
          </div>

          <div>
            <Label htmlFor="register-confirm-password">Confirm password</Label>
            <PasswordInput
              {...register("confirmPassword")}
              aria-describedby={
                errors.confirmPassword
                  ? "register-confirm-password-error"
                  : undefined
              }
              autoComplete="new-password"
              className="mt-1.5"
              disabled={isPending}
              id="register-confirm-password"
              invalid={Boolean(errors.confirmPassword)}
              placeholder="Re-enter your password"
            />
            <FormFieldError
              id="register-confirm-password-error"
              message={errors.confirmPassword?.message}
            />
          </div>

          <Button
            fullWidth
            isLoading={isPending}
            loadingText="Creating account..."
            type="submit"
          >
            Create account
          </Button>
        </form>
      </CardContent>

      <CardFooter className="justify-center text-sm text-slate-600">
        <span>
          Already have an account?{" "}
          <Link
            className="font-semibold text-brand-700 underline-offset-4 hover:underline focus-visible:rounded-sm"
            to="/login"
          >
            Sign in
          </Link>
        </span>
      </CardFooter>
    </Card>
  );
}
