export function Footer() {
  return (
    <footer className="border-t py-6 md:py-0 bg-background mt-auto">
      <div className="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row mx-auto px-4">
        <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
          Construído com Next.js e TailwindCSS. LicitaBusca MVP.
        </p>
      </div>
    </footer>
  );
}
