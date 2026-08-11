import { useEffect } from "react";

interface PageMeta {
  title: string;
  description: string;
}

/**
 * Setzt Titel und Meta-Description pro Seite.
 * Bewusst ohne externe Helm-Bibliothek — für eine Client-App reicht das,
 * und es spart eine Abhängigkeit.
 */
export function usePageMeta({ title, description }: PageMeta) {
  useEffect(() => {
    document.title = title;

    const setMeta = (selector: string, attribute: string, value: string, content: string) => {
      let element = document.head.querySelector<HTMLMetaElement>(selector);
      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attribute, value);
        document.head.appendChild(element);
      }
      element.setAttribute("content", content);
    };

    setMeta('meta[name="description"]', "name", "description", description);
    setMeta('meta[property="og:title"]', "property", "og:title", title);
    setMeta('meta[property="og:description"]', "property", "og:description", description);
  }, [title, description]);
}
