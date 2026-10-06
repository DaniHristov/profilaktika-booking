export default function Loading() {
  return (
    <main
      className="mx-auto flex w-full max-w-xl flex-1 items-center justify-center px-4 py-16"
      aria-busy="true"
    >
      <p role="status" className="text-muted-foreground">
        Зареждане…
      </p>
    </main>
  );
}
