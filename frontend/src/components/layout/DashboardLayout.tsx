import { ReactNode } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import UserMenu from "@/components/UserMenu";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  Home,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useState } from "react";

interface DashboardLayoutProps {
  children: ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const { user, profile, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const navigation = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      current: isActive("/dashboard"),
      show: true,
    },
    {
      name: "Admin",
      href: "/admin",
      icon: Users,
      current: isActive("/admin"),
      show: isAdmin,
    },
    {
      name: "Settings",
      href: "/settings",
      icon: Settings,
      current: isActive("/settings"),
      show: true,
    },
  ];

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col">
        <div className="flex flex-col flex-grow border-r pt-5 bg-background overflow-y-auto">
          <div className="flex items-center flex-shrink-0 px-4">
            <Link to="/" className="flex items-center space-x-2">
              <span className="text-2xl font-bold text-primary">UGClive</span>
            </Link>
          </div>
          <div className="mt-8 flex-grow flex flex-col">
            <nav className="flex-1 px-2 pb-4 space-y-1">
              {navigation
                .filter((item) => item.show)
                .map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={cn(
                      item.current
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      "group flex items-center px-2 py-2 text-sm font-medium rounded-md"
                    )}
                  >
                    <item.icon
                      className={cn(
                        item.current
                          ? "text-primary"
                          : "text-muted-foreground group-hover:text-foreground",
                        "mr-3 flex-shrink-0 h-5 w-5"
                      )}
                      aria-hidden="true"
                    />
                    {item.name}
                  </Link>
                ))}
            </nav>
          </div>
          <div className="flex-shrink-0 flex border-t border-border p-4">
            <div className="flex items-center w-full justify-between">
              <div className="flex items-center">
                {user && (
                  <div className="ml-3">
                    <p className="text-sm font-medium text-foreground">
                      {user.user_metadata?.full_name ||
                        profile?.username ||
                        user.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {profile?.plan || "Free"} Plan
                    </p>
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSignOut}
                className="text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div className="md:hidden">
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 left-4 z-50"
            >
              <Menu className="h-6 w-6" />
              <span className="sr-only">Open menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[250px] sm:w-[300px]">
            <SheetHeader className="mb-6">
              <SheetTitle className="text-left">UGClive</SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-4">
              {navigation
                .filter((item) => item.show)
                .map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={cn(
                      item.current
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      "flex items-center px-2 py-2 text-base font-medium rounded-md"
                    )}
                    onClick={closeMobileMenu}
                  >
                    <item.icon
                      className={cn(
                        item.current
                          ? "text-primary"
                          : "text-muted-foreground",
                        "mr-4 flex-shrink-0 h-5 w-5"
                      )}
                      aria-hidden="true"
                    />
                    {item.name}
                  </Link>
                ))}
              <div className="pt-4 mt-6 border-t border-border">
                <Button
                  variant="ghost"
                  className="w-full justify-start text-base font-medium text-muted-foreground hover:text-foreground"
                  onClick={handleSignOut}
                >
                  <LogOut className="mr-4 h-5 w-5" />
                  Sign Out
                </Button>
              </div>
            </nav>
          </SheetContent>
        </Sheet>
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="w-full">
          <div className="relative z-10 flex-shrink-0 h-16 bg-background border-b border-border flex">
            <div className="flex-1 flex justify-between px-4 md:px-0">
              <div className="flex-1 flex md:hidden items-center">
                <Link to="/" className="flex-shrink-0 ml-8">
                  <span className="text-2xl font-bold text-primary">UGClive</span>
                </Link>
              </div>
              <div className="ml-4 md:ml-6 flex items-center">
                <UserMenu />
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto bg-muted/10">{children}</main>
      </div>
    </div>
  );
};

export default DashboardLayout; 