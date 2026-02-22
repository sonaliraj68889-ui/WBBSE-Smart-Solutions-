
import React, { useEffect, useRef } from 'react';

interface MathTextProps {
  text: string;
  className?: string;
  isInline?: boolean;
}

const MathText: React.FC<MathTextProps> = ({ text, className = '', isInline = false }) => {
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const renderMath = (el: HTMLElement, content: string) => {
      el.innerHTML = '';
      
      // Split by delimiters $$...$$ or $...$
      const parts = content.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]*?\$)/g);
      
      parts.forEach(part => {
        if (part.startsWith('$$') && part.endsWith('$$')) {
          const math = part.slice(2, -2);
          const div = document.createElement('div');
          div.className = "my-3 overflow-x-auto overflow-y-hidden text-center";
          if ((window as any).katex) {
            try {
              (window as any).katex.render(math, div, { displayMode: true, throwOnError: false });
            } catch (e) {
              div.textContent = part;
            }
          } else {
            div.textContent = part;
          }
          el.appendChild(div);
        } else if (part.startsWith('$') && part.endsWith('$')) {
          const math = part.slice(1, -1);
          const span = document.createElement('span');
          if ((window as any).katex) {
            try {
              (window as any).katex.render(math, span, { displayMode: false, throwOnError: false });
            } catch (e) {
              span.textContent = part;
            }
          } else {
            span.textContent = part;
          }
          el.appendChild(span);
        } else {
          // Handle text with newlines
          const lines = part.split('\n');
          lines.forEach((line, i) => {
            if (i > 0) el.appendChild(document.createElement('br'));
            if (line) el.appendChild(document.createTextNode(line));
          });
        }
      });
    };

    // Render immediately
    renderMath(element, text);

    // Poll for KaTeX if not loaded
    if (!(window as any).katex) {
      const interval = setInterval(() => {
        if ((window as any).katex) {
          clearInterval(interval);
          renderMath(element, text);
        }
      }, 100);
      
      const timeout = setTimeout(() => clearInterval(interval), 5000);
      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [text]);

  if (isInline) {
    return <span ref={containerRef as any} className={className} />;
  }
  return <div ref={containerRef as any} className={className} />;
};

export default MathText;
