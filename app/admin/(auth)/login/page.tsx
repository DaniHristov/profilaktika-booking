import type { Metadata } from "next";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Вход – админ панел",
};

export default function AdminLoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Вход в админ панела</h1>
        <p className="text-base text-muted-foreground">
          Въведете имейла си и ще получите линк за вход.
        </p>
      </div>
      <LoginForm />
    </main>
  );
}
