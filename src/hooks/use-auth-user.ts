"use client";

import { useEffect, useState } from "react";
import {
  AFIFI_AUTH_CHANGED_EVENT,
  getStoredUserJson,
} from "@/lib/auth-session";
import {
  isStaffRole,
  isSuperadmin,
  parseUserRoles,
  pickUserDisplayName,
  pickUserEmail,
} from "@/lib/user";

export type AuthUserState = {
  user: unknown | null;
  roles: string[];
  displayName: string;
  email: string;
  isStaff: boolean;
  isSuperadmin: boolean;
  ready: boolean;
};

const empty: AuthUserState = {
  user: null,
  roles: [],
  displayName: "",
  email: "",
  isStaff: false,
  isSuperadmin: false,
  ready: false,
};

function readUser(): AuthUserState {
  const raw = getStoredUserJson();
  let user: unknown | null = null;
  if (raw) {
    try {
      user = JSON.parse(raw) as unknown;
    } catch {
      user = null;
    }
  }
  const roles = parseUserRoles(user);
  return {
    user,
    roles,
    displayName: pickUserDisplayName(user),
    email: pickUserEmail(user),
    isStaff: isStaffRole(roles),
    isSuperadmin: isSuperadmin(roles),
    ready: true,
  };
}

export function useAuthUser(): AuthUserState {
  const [state, setState] = useState<AuthUserState>(empty);

  useEffect(() => {
    function sync() {
      setState(readUser());
    }
    sync();
    function onStorage(e: StorageEvent) {
      if (e.key === "afifi_user" || e.key === null) sync();
    }
    window.addEventListener("storage", onStorage);
    window.addEventListener(AFIFI_AUTH_CHANGED_EVENT, sync);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(AFIFI_AUTH_CHANGED_EVENT, sync);
    };
  }, []);

  return state;
}
