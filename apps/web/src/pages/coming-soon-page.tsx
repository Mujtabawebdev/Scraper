import {
  BriefcaseBusiness,
  Construction,
  LogOut,
  Settings,
  UsersRound,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { EmptyState } from "../components/feedback/empty-state";
import { Button } from "../components/ui/button";
import { useLogoutAll } from "../features/auth/hooks/use-logout-all";

export interface ComingSoonPageProps {
  description: string;
  showLogoutAll?: boolean;
  title: string;
}

function getSectionIcon(title: string): typeof Construction {
  if (title.toLowerCase() === "jobs") {
    return BriefcaseBusiness;
  }
  if (title.toLowerCase() === "leads") {
    return UsersRound;
  }
  if (title.toLowerCase() === "settings") {
    return Settings;
  }
  return Construction;
}

export function ComingSoonPage({
  description,
  showLogoutAll = false,
  title,
}: ComingSoonPageProps) {
  const navigate = useNavigate();
  const logoutAllMutation = useLogoutAll();
  const Icon = getSectionIcon(title);

  const handleLogoutAll = () => {
    logoutAllMutation.mutate(undefined, {
      onSettled: (_data, error) => {
        navigate("/login", { replace: true });
        if (error) {
          toast.warning(
            "Local access was cleared, but other server sessions may still be active.",
          );
          return;
        }
        toast.success("Logged out from all devices successfully.");
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-brand-700">Dashboard</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
          {title}
        </h1>
      </div>

      <EmptyState
        action={
          showLogoutAll ? (
            <Button
              isLoading={logoutAllMutation.isPending}
              loadingText="Logging out"
              onClick={handleLogoutAll}
              variant="danger"
            >
              <LogOut aria-hidden="true" className="size-4" />
              Log out all devices
            </Button>
          ) : undefined
        }
        description={description}
        icon={<Icon aria-hidden="true" className="size-6" />}
        title={`${title} are coming later`}
      />

      {showLogoutAll ? (
        <p className="text-center text-xs leading-5 text-slate-500">
          Logging out all devices revokes every active backend session,
          including this browser.
        </p>
      ) : null}
    </div>
  );
}
