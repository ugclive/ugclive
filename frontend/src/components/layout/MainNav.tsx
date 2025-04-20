import { NavLink } from "react-router-dom";
import { Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import LogoIcon from "../LogoIcon";

const MainNav = () => {
  return (
    <header className="fixed top-0 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
      <nav className="container flex h-16 items-center justify-between">
        <div className="flex gap-6 md:gap-10">
          <NavLink to="/" className="flex items-center space-x-2">
            <LogoIcon size={24} />
            <span className="text-lg font-semibold">UGClive</span>
          </NavLink>
        </div>
        
        <div className="hidden md:flex items-center gap-6">
          <NavLink to="/dashboard" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Dashboard
          </NavLink>
          <a 
            href="https://x.com/rushabtated4" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Support
          </a>
        </div>
        
        <div className="flex items-center gap-4">
          <NavLink to="/dashboard">
            <Button>Get Started</Button>
          </NavLink>
        </div>
      </nav>
    </header>
  );
};

export default MainNav;
