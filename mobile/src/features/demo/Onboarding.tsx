import { Redirect } from "expo-router";
import type { ReactNode } from "react";
import { useDemo } from "./provider";

// Sem e-mail verificado e perfil, o app só mostra entrar e cadastro.
export function RequireProfile({ children }: { children: ReactNode }) {
  const { state } = useDemo();
  if (!state.session) return <Redirect href="/entrar" />;
  if (!state.profile) return <Redirect href="/cadastro" />;
  return <>{children}</>;
}
