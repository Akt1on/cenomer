import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ProductPriceChart from "./ProductPriceChart";

const mockChartData = [
  { date: "06-01", price: 100 },
  { date: "06-02", price: 95 },
  { date: "06-03", price: 110 },
  { date: "06-04", price: 92 },
  { date: "06-05", price: 98 },
];

describe("ProductPriceChart", () => {
  it("renders chart with history title", () => {
    render(<ProductPriceChart data={mockChartData} />);
    expect(screen.getByText(/История цен/i)).toBeInTheDocument();
  });

  it("shows empty state with no data", () => {
    render(<ProductPriceChart data={[]} />);
    expect(screen.getByText(/Нет данных для графика/i)).toBeInTheDocument();
  });

  it("renders SVG with proper accessibility label", () => {
    render(<ProductPriceChart data={mockChartData} />);
    const svg = screen.getByLabelText(/График истории цен/i);
    expect(svg).toBeInTheDocument();
    expect(svg.tagName).toBe("svg");
  });

  it("renders SVG with viewBox attribute", () => {
    const { container } = render(<ProductPriceChart data={mockChartData} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("viewBox");
  });

  it("contains path elements for price line", () => {
    const { container } = render(<ProductPriceChart data={mockChartData} />);
    const paths = container.querySelectorAll("path");
    expect(paths.length).toBeGreaterThan(0);
  });

  it("renders circle markers for data points", () => {
    const { container } = render(<ProductPriceChart data={mockChartData} />);
    const circles = container.querySelectorAll("circle");
    expect(circles.length).toBeGreaterThanOrEqual(mockChartData.length);
  });

  it("renders grid lines", () => {
    const { container } = render(<ProductPriceChart data={mockChartData} />);
    const lines = container.querySelectorAll("line");
    expect(lines.length).toBeGreaterThan(0);
  });

  it("handles single data point", () => {
    const { container } = render(<ProductPriceChart data={[{ date: "06-01", price: 100 }]} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});
