"use client";

import { useState, useRef, useEffect } from "react";

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
}

export default function Tooltip({ content, children, position = "top" }: TooltipProps) {
  const [show, setShow] = useState(false);
  const [adjustedPosition, setAdjustedPosition] = useState(position);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (show && tooltipRef.current && containerRef.current) {
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();

      // Flip if tooltip goes off-screen
      if (position === "top" && tooltipRect.top < 0) {
        setAdjustedPosition("bottom");
      } else if (position === "bottom" && tooltipRect.bottom > window.innerHeight) {
        setAdjustedPosition("top");
      } else if (position === "right" && tooltipRect.right > window.innerWidth) {
        setAdjustedPosition("left");
      } else if (position === "left" && containerRect.left - tooltipRect.width < 0) {
        setAdjustedPosition("right");
      } else {
        setAdjustedPosition(position);
      }
    }
  }, [show, position]);

  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  return (
    <span
      ref={containerRef}
      className="relative inline-flex items-center"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      {children}
      {show && (
        <div
          ref={tooltipRef}
          role="tooltip"
          className={`absolute z-50 px-3 py-2 text-xs text-gray-200 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-w-[240px] whitespace-normal leading-relaxed pointer-events-none ${positionClasses[adjustedPosition]}`}
        >
          {content}
        </div>
      )}
    </span>
  );
}

// Inline info icon with tooltip — use next to labels
export function InfoTip({ text }: { text: string }) {
  return (
    <Tooltip content={text}>
      <button
        type="button"
        className="inline-flex items-center justify-center w-4 h-4 ml-1 text-gray-600 hover:text-gray-400 transition-colors cursor-help"
        aria-label="More info"
        tabIndex={0}
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </button>
    </Tooltip>
  );
}
