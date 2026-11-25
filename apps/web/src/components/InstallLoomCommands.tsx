import { cn } from "~/lib/utils";

import { CommandBlock } from "./CommandBlock";

/**
 * Setup steps for another computer: install `loom`, then run `command`. Both installers are shown
 * because the browser showing this is often not the computer being set up.
 */
export function InstallLoomCommands({
  command,
  className,
}: {
  readonly command: string;
  readonly className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-xs text-muted-foreground">macOS, Linux</p>
      <CommandBlock command="curl -fsSL https://loom.local/install.sh | sh" />
      <p className="text-xs text-muted-foreground">Windows (PowerShell)</p>
      <CommandBlock command="irm https://loom.local/install.ps1 | iex" />
      <p className="text-xs text-muted-foreground">Then</p>
      <CommandBlock command={command} />
      <p className="text-xs text-muted-foreground">
        Skip the install if you already have <code className="font-mono">loom</code>. If{" "}
        <code className="font-mono">loom</code> is not found after installing, add the folder the
        installer names to your PATH.
      </p>
    </div>
  );
}
