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
import { useLogin } from "../hooks/use-login";
import {
  loginFormSchema,
  type LoginFormInput,
  type LoginFormValues,
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

  if (!isRecord(from) || typeof from.pathname !== "string") {
    return "/dashboard";
  }

  if (!isSafeInternalPath(from.pathname)) {
    return "/dashboard";
  }

  const search =
    typeof from.search === "string" && from.search.startsWith("?")
      ? from.search
      : "";
  const hash =
    typeof from.hash === "string" && from.hash.startsWith("#")
      ? from.hash
      : "";

  return `${from.pathname}${search}${hash}`;
};

const loginFieldNames = ["email", "password"] as const;

export function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const loginMutation = useLogin();
  const [generalError, setGeneralError] = useState<string | null>(null);

  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
  } = useForm<LoginFormInput, unknown, LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const isPending = isSubmitting || loginMutation.isPending;

  const onSubmit = async (values: LoginFormValues): Promise<void> => {
    setGeneralError(null);

    try {
      await loginMutation.mutateAsync(values);
      toast.success("Signed in successfully");
      navigate(getSafeDestination(location.state as unknown), { replace: true });
    } catch (error: unknown) {
      const apiError = normalizeApiError(error);

      for (const fieldName of loginFieldNames) {
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
        <CardTitle>Welcome back</CardTitle>
        <CardDescription>
          Sign in to manage your business lead workspace.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {generalError ? (
          <Alert className="mb-5" variant="error">
            {generalError}
          </Alert>
        ) : null}

        <form
          aria-label="Sign in"
          className="space-y-5"
          noValidate
          onSubmit={handleSubmit(onSubmit)}
        >
          <div>
            <Label htmlFor="login-email">Email address</Label>
            <Input
              {...register("email")}
              aria-describedby={errors.email ? "login-email-error" : undefined}
              autoCapitalize="none"
              autoComplete="email"
              className="mt-1.5"
              disabled={isPending}
              id="login-email"
              inputMode="email"
              invalid={Boolean(errors.email)}
              placeholder="john@example.com"
              type="email"
            />
            <FormFieldError
              id="login-email-error"
              message={errors.email?.message}
            />
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="login-password">Password</Label>
              <span
                aria-disabled="true"
                className="cursor-not-allowed text-xs font-medium text-slate-400"
                title="Password recovery will be available in a future phase"
              >
                Forgot password? (Coming later)
              </span>
            </div>
            <PasswordInput
              {...register("password")}
              aria-describedby={
                errors.password ? "login-password-error" : undefined
              }
              autoComplete="current-password"
              className="mt-1.5"
              disabled={isPending}
              id="login-password"
              invalid={Boolean(errors.password)}
              placeholder="Enter your password"
            />
            <FormFieldError
              id="login-password-error"
              message={errors.password?.message}
            />
          </div>

          <Button
            fullWidth
            isLoading={isPending}
            loadingText="Signing in..."
            type="submit"
          >
            Sign in
          </Button>
        </form>
      </CardContent>

      <CardFooter className="justify-center text-sm text-slate-600">
        <span>
          New to LeadSaaS?{" "}
          <Link
            className="font-semibold text-brand-700 underline-offset-4 hover:underline focus-visible:rounded-sm"
            to="/register"
          >
            Create an account
          </Link>
        </span>
      </CardFooter>
    </Card>
  );
}
