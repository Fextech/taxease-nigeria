"use client";

import { useState, useEffect } from "react";
import { sanitizeHtml } from "@/lib/sanitize-html";

export default function HowToGuideModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [pages, setPages] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  const openModal = () => setIsOpen(true);
  const closeModal = () => {
    setIsOpen(false);
    localStorage.setItem("taxease_guide_seen", "true");
  };

  useEffect(() => {
    // Listen for custom event to manually trigger modal
    const handleOpenEvent = () => openModal();
    window.addEventListener("open-how-to", handleOpenEvent);

    return () => {
      window.removeEventListener("open-how-to", handleOpenEvent);
    };
  }, []);

  useEffect(() => {
    // Fetch guide on mount
    const fetchGuide = async () => {
      try {
        const res = await fetch("/api/how-to");
        const data = await res.json();
        if (data.pages && data.pages.length > 0) {
          setPages(data.pages);
          // Check if user has seen it before
          const hasSeen = localStorage.getItem("taxease_guide_seen");
          if (!hasSeen) {
            setIsOpen(true);
          }
        }
      } catch (error) {
        console.error("Failed to load how-to guide:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchGuide();
  }, []);

  if (!isOpen || pages.length === 0) return null;

  const handlePrev = () => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => Math.min(pages.length - 1, prev + 1));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div 
        className="bg-[#131F20] w-full max-w-2xl rounded-2xl shadow-2xl border border-white/10 overflow-hidden flex flex-col relative"
        style={{ minHeight: "60vh", maxHeight: "85vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-[var(--te-cyan)]">school</span>
            How-To Guide
          </h2>
          <button 
            onClick={closeModal}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-8 text-slate-300">
          <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(pages[currentIndex]) }} />
        </div>

        {/* Footer Navigation */}
        <div className="p-4 border-t border-white/5 flex items-center justify-between bg-black/20">
          <div className="text-sm text-slate-500 font-medium">
            Page {currentIndex + 1} of {pages.length}
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none text-white text-sm font-medium transition-colors"
            >
              Previous
            </button>
            
            {currentIndex === pages.length - 1 ? (
              <button
                onClick={closeModal}
                className="px-6 py-2 rounded-lg bg-[var(--te-cyan)] hover:bg-[var(--te-cyan)]/80 text-slate-500 text-sm font-bold transition-colors"
              >
                Finish
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="px-6 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors"
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
