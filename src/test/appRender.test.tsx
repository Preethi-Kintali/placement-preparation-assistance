import { render, screen } from "@testing-library/react";
import App from "@/App";

describe("app", () => {
  it("renders the home page", async () => {
    render(<App />);

    // Home hero marker text (should be present without needing backend)
    expect(screen.getByText(/AI-Powered Placement Prep/i)).toBeInTheDocument();
  });
});
