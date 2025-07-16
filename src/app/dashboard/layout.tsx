export default function DeprecatedClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // This layout is for deprecated routes. It provides minimal styling.
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4 dark">
      {children}
    </main>
  );
}
