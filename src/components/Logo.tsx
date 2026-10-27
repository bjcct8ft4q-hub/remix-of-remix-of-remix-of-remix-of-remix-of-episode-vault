import { Infinity as InfinityIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-1.5 text-primary">
      <InfinityIcon className="h-9 w-9" strokeWidth={2.75} />
      <span className="font-display text-2xl font-black italic tracking-tight text-foreground">
        Stream<span className="text-primary">ly</span>
      </span>
    </Link>
  );
}
