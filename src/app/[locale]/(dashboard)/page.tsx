"use client";

import { useEffect, useState } from "react";

import { HomeDashboard } from "@/components/pages/home-dashboard";
import { StaffDashboard } from "@/components/pages/staff-dashboard";
import { useAuthUser } from "@/hooks/use-auth-user";

export default function DashboardHomePage() {
  const { isStaff, ready } = useAuthUser();
  const [forceHome, setForceHome] = useState(false);

  // If user logs out / changes role, reset fallback.
  useEffect(() => {
    setForceHome(false);
  }, [isStaff]);

  if (!ready) {
    return <HomeDashboard />;
  }

  if (!isStaff || forceHome) {
    return <HomeDashboard />;
  }

  return <StaffDashboard onForbidden={() => setForceHome(true)} />;
}
