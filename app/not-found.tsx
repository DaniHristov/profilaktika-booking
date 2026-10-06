import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-3 px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">
        Страницата не е намерена
      </h1>
      <p className="text-muted-foreground">
        Проверете дали линкът е въведен правилно.
      </p>
      <Link href="/" className="underline underline-offset-4">
        Към началната страница
      </Link>
    </main>
  );
}
