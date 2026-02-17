import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { GraduationCap, Menu, X, LogOut, User, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

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
      { label: "Profile", path: "/profile" },
      { label: "Roadmap", path: "/roadmap" },
    ];
  };

  const navLinks = getNavLinks();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border/50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-bold text-xl">
          <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="gradient-text hidden sm:inline">PlacePrep</span>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                location.pathname === link.path
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {user.role === "admin" ? (
                  <Shield className="w-4 h-4 text-primary" />
                ) : (
                  <User className="w-4 h-4" />
                )}
                <span className="font-medium text-foreground">{user.profile?.fullName?.split(" ")[0]}</span>
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full capitalize">{user.role}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1">
                <LogOut className="w-4 h-4" /> Logout
              </Button>
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
              <div className="pt-2 flex gap-2">
                {user ? (
                  <Button variant="outline" className="w-full gap-2" size="sm" onClick={handleLogout}>
                    <LogOut className="w-4 h-4" /> Logout ({user.profile?.fullName?.split(" ")[0]})
                  </Button>
                ) : (
                  <>
                    <Link to="/login" className="flex-1">
                      <Button variant="outline" className="w-full" size="sm">Log in</Button>
                    </Link>
                    <Link to="/signup" className="flex-1">
                      <Button className="w-full gradient-primary text-primary-foreground border-0" size="sm">
                        Get Started
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
