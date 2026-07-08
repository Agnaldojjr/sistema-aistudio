import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';

interface WindowPortalProps {
  children: React.ReactNode;
  onClose?: () => void;
  title?: string;
}

function copyStyles(sourceDoc: Document, targetDoc: Document) {
  Array.from(sourceDoc.styleSheets).forEach(styleSheet => {
    try {
      if (styleSheet.cssRules) {
        const newStyleEl = targetDoc.createElement('style');
        Array.from(styleSheet.cssRules).forEach(cssRule => {
          newStyleEl.appendChild(targetDoc.createTextNode(cssRule.cssText));
        });
        targetDoc.head.appendChild(newStyleEl);
      } else if (styleSheet.href) {
        const newLinkEl = targetDoc.createElement('link');
        newLinkEl.rel = 'stylesheet';
        newLinkEl.href = styleSheet.href;
        targetDoc.head.appendChild(newLinkEl);
      }
    } catch (e) {
      console.warn('Could not copy stylesheet', e);
    }
  });
  targetDoc.body.className = 'bg-slate-950 text-slate-200 antialiased overflow-hidden w-screen h-screen flex flex-col';
}

export const WindowPortal: React.FC<WindowPortalProps> = ({ children, onClose, title = 'Apresentação Paciente' }) => {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  
  const externalWindow = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return window.open('', '', 'width=1000,height=800,left=200,top=200');
  }, []);

  useEffect(() => {
    if (externalWindow) {
      const div = externalWindow.document.createElement('div');
      div.className = 'w-full h-full flex flex-col relative';
      externalWindow.document.title = title;
      
      copyStyles(document, externalWindow.document);
      
      externalWindow.document.body.appendChild(div);
      setContainer(div);

      const handleBeforeUnload = () => {
        if (onClose) onClose();
      };
      
      externalWindow.addEventListener('beforeunload', handleBeforeUnload);

      return () => {
        externalWindow.removeEventListener('beforeunload', handleBeforeUnload);
        externalWindow.close();
      };
    }
  }, [externalWindow, onClose, title]);

  if (!container) return null;
  return createPortal(children, container);
};
