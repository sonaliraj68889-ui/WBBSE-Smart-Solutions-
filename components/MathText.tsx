
import React, { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

interface MathTextProps {
  text: string;
  className?: string;
  isInline?: boolean;
}

mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
});

const MathText: React.FC<MathTextProps> = ({ text, className = '', isInline = false }) => {
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const renderContent = async (el: HTMLElement, content: string) => {
      el.innerHTML = '';
      
      // Split by Mermaid blocks, then by Math delimiters
      // We use a capture group to keep the delimiters
      const parts = content.split(/(```mermaid[\s\S]*?```|\$\$[\s\S]*?\$\$|\$[^$\n]*?\$)/g);
      
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        
        if (part.startsWith('```mermaid') && part.endsWith('```')) {
          const code = part.replace(/^```mermaid\n?/, '').replace(/```$/, '');
          const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
          const div = document.createElement('div');
          div.className = "mermaid my-4 flex justify-center";
          div.innerHTML = code; // Mermaid will replace this
          div.id = id;
          el.appendChild(div);
          
          try {
            await mermaid.run({
              nodes: [div],
            });
          } catch (e) {
            console.error("Mermaid error:", e);
            div.innerHTML = `<pre class="text-xs bg-gray-100 p-2 rounded text-red-500 overflow-auto">${code}</pre>`;
          }
        } else if (part.startsWith('$$') && part.endsWith('$$')) {
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
          // Handle text with newlines and bold formatting (**text**)
          // We can do a simple bold parser here or just text
          // For now, let's keep it simple but handle newlines
          const lines = part.split('\n');
          lines.forEach((line, j) => {
            if (j > 0) el.appendChild(document.createElement('br'));
            
            // Simple bold parser: **text**
            const boldParts = line.split(/(\*\*.*?\*\*)/g);
            boldParts.forEach(bPart => {
              if (bPart.startsWith('**') && bPart.endsWith('**')) {
                const strong = document.createElement('strong');
                strong.textContent = bPart.slice(2, -2);
                el.appendChild(strong);
              } else {
                if (bPart) el.appendChild(document.createTextNode(bPart));
              }
            });
          });
        }
      }
    };

    // Render immediately
    renderContent(element, text);

    // Poll for KaTeX if not loaded (Mermaid is bundled, so no need to poll for it)
    if (!(window as any).katex) {
      const interval = setInterval(() => {
        if ((window as any).katex) {
          clearInterval(interval);
          renderContent(element, text);
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
