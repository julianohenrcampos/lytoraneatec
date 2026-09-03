import { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";

interface Props {
  children: ReactNode;
  subtitle?: string;
}

export default function AtestadoShell({ children, subtitle }: Props) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground leading-tight">
              Envio de Atestado Médico
            </h1>
            <p className="text-xs text-muted-foreground">
              {subtitle ?? "Canal oficial LYTORÂNEA para colaboradores"}
            </p>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-4 py-6">{children}</div>
      </main>
      <footer className="border-t border-border py-4">
        <div className="max-w-3xl mx-auto px-4 text-xs text-muted-foreground text-center">
          Em caso de dúvidas, procure o RH ou o setor de SSO.
        </div>
      </footer>
    </div>
  );
}
