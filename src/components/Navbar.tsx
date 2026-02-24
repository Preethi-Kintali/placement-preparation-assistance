import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { GraduationCap, Menu, X, LogOut, User, LayoutDashboard, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function firstLetter(name: string | undefined) {
  return String(name ?? "?").trim().slice(0, 1).toUpperCase() || "?";
}

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const handleLogout = () => {
    logout();
    navigate("/");
    setMobileOpen(false);
  };

  // Dynamic navigation links based on user role
  const getNavLinks = () => {
    if (!user) {
      return [{ label: "Home", path: "/" }];
    }
    if (user.role === "admin") {
      return [
        { label: "Dashboard", path: "/admin" },
      ];
    }
    return [
      { label: "Home", path: "/" },
      { label: "Dashboard", path: "/dashboard" },
      { label: "Roadmap", path: "/roadmap" },
      { label: "Leaderboard", path: "/leaderboard" },
      { label: "AI Interview", path: "/interview" },
      { label: "Study Assistant", path: "/study-assistant" },
    ];
  };

  const navLinks = getNavLinks();
  const avatarUrl = user?.profile?.avatarUrl;
  const healthPoints = useMemo(() => Number(user?.gamification?.healthPoints ?? 0), [user]);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card/85 backdrop-blur-xl shadow-sm">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-bold text-xl">
          <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="gradient-text hidden sm:inline">PlacePrep</span>
        </Link>

        <div className="hidden md:flex items-center gap-1 h-14">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`relative px-3 py-2 text-sm font-medium transition-all duration-300 hover:text-foreground hover:bg-muted/60 rounded-lg ${
                location.pathname === link.path
                  ? "text-foreground font-semibold"
                  : "text-muted-foreground"
              }`}
            >
              {link.label}
              <span
                className={`absolute left-3 right-3 -bottom-[1px] h-[2px] rounded-full transition-all duration-300 ${
                  location.pathname === link.path ? "bg-primary opacity-100" : "bg-transparent opacity-0"
                }`}
              />
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                aria-label="Toggle theme"
                className="rounded-full"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-full px-2 py-1 hover:bg-muted/70 transition-colors duration-300">
                    <div className="text-xs text-muted-foreground tabular-nums inline-flex items-center gap-1">
                      <span aria-hidden>🔥</span>
                      <span>{healthPoints}</span>
                    </div>
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={String(avatarUrl || "")} alt="Profile" />
                      <AvatarFallback>{firstLetter(user.profile?.fullName)}</AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-64 rounded-xl shadow-md">
                  <DropdownMenuLabel>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={String(avatarUrl || "")} alt="Profile" />
                        <AvatarFallback>{firstLetter(user.profile?.fullName)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{user.profile?.fullName || "Student"}</div>
                        <div className="text-xs text-muted-foreground truncate">{user.profile?.email}</div>
                        <div className="mt-1">
                          <Badge variant="secondary" className="capitalize">
                            {user.role}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  {user.role === "admin" ? (
                    <DropdownMenuItem
                      onClick={() => navigate("/admin")}
                      className="cursor-pointer rounded-lg hover:bg-muted/70 focus:bg-muted/70"
                    >
                      <LayoutDashboard className="w-4 h-4 mr-2" /> Admin Dashboard
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      onClick={() => navigate("/profile")}
                      className="cursor-pointer rounded-lg hover:bg-muted/70 focus:bg-muted/70"
                    >
                      <User className="w-4 h-4 mr-2" /> Profile
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="cursor-pointer rounded-lg text-destructive focus:text-destructive hover:bg-destructive/10 focus:bg-destructive/10"
                  >
                    <LogOut className="w-4 h-4 mr-2" /> Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost" size="sm">Log in</Button>
              </Link>
              <Link to="/signup">
                <Button size="sm" className="gradient-primary text-primary-foreground border-0">
                  Get Started
                </Button>
              </Link>
            </>
          )}
        </div>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 rounded-lg hover:bg-muted"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-card/95 backdrop-blur-xl border-b border-border/50 overflow-hidden"
          >
            <div className="px-4 py-4 space-y-2">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileOpen(false)}
                  className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    location.pathname === link.path
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              {!user && (
                <div className="pt-2 flex gap-2">
                  <Link to="/login" className="flex-1">
                    <Button variant="outline" className="w-full" size="sm">Log in</Button>
                  </Link>
                  <Link to="/signup" className="flex-1">
                    <Button className="w-full gradient-primary text-primary-foreground border-0" size="sm">
                      Get Started
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
