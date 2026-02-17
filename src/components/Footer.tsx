import { GraduationCap, Github, Linkedin, Twitter, Mail } from "lucide-react";
import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="bg-card border-t border-border/50 py-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <Link to="/" className="flex items-center gap-2 font-bold text-lg">
              <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                <GraduationCap className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="gradient-text">PlacePrep</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              Your personalized roadmap to product-based company placements.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-3 text-sm">Platform</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link></li>
              <li><Link to="/roadmap" className="hover:text-foreground transition-colors">Roadmap</Link></li>
              <li><Link to="/signup" className="hover:text-foreground transition-colors">Get Started</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-3 text-sm">Resources</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground transition-colors">DSA Practice</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Interview Tips</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Career Paths</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-3 text-sm">Connect</h4>
            <div className="flex gap-3">
              {[Github, Linkedin, Twitter, Mail].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-primary/10 transition-all"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border/50 text-center text-xs text-muted-foreground">
          © 2026 PlacePrep. Built for engineering students, by engineering minds.
        </div>
      </div>
    </footer>
  );
}
