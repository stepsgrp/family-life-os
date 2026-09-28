"use client";

import { useTRPC } from "@flos/api-client";
import { isParent } from "@flos/types";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

/** Current member + family, plus a member lookup used for colors/avatars everywhere. */
export function useFamily() {
  const trpc = useTRPC();
  const me = useQuery(trpc.family.me.queryOptions());
  const members = useQuery({ ...trpc.family.members.queryOptions(), enabled: !!me.data });

  const byId = useMemo(() => new Map((members.data ?? []).map((m) => [m.id, m])), [members.data]);

  return {
    isLoading: me.isLoading,
    me: me.data?.member,
    family: me.data?.family,
    members: members.data ?? [],
    memberById: byId,
    isParent: me.data ? isParent(me.data.member.role) : false,
    isAdmin: me.data?.member.role === "ADMIN_PARENT",
  };
}

export function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function startOfWeek(d: Date) {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7)); // Monday
  return s;
}
