import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="border-t border-border/60 px-6 pb-10 pt-14 sm:px-10">
      <div className="mx-auto max-w-[1900px]">
        <Logo />
        <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Streamly is your home for watching series and movies. Discover new shows, catch the latest episodes and pick up where you left off.
        </p>
        <div className="mt-8 border-t border-border/60 pt-6">
          <p className="text-sm font-semibold">© {new Date().getFullYear()} Streamly. All rights reserved.</p>
          <nav className="mt-4 flex flex-wrap gap-6 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-foreground">Home</Link>
            <Link to="/browse" className="hover:text-foreground">Browse</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
