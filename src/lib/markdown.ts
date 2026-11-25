const esc = (s: string) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Rendu Markdown minimal et sûr (texte échappé avant interprétation) pour les
 * réponses de l'assistant IA : titres, listes, gras/italique. Pas de tableaux
 * ni de HTML brut — cohérent avec la consigne donnée au modèle (systemPrompt). */
export function renderMarkdown(src: string): string {
  const lines = esc(src).split("\n");
  let out = "";
  let list: "ul" | "ol" | null = null;
  const inline = (t: string) =>
    t
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|\s)\*(\S.+?)\*/g, "$1<em>$2</em>");
  const close = () => {
    if (list) {
      out += `</${list}>`;
      list = null;
    }
  };
  for (const l of lines) {
    let m: RegExpMatchArray | null;
    if ((m = l.match(/^#{1,4}\s+(.*)/))) {
      close();
      out += `<h4>${inline(m[1])}</h4>`;
    } else if ((m = l.match(/^\s*[-*•]\s+(.*)/))) {
      if (list !== "ul") {
        close();
        out += "<ul>";
        list = "ul";
      }
      out += `<li>${inline(m[1])}</li>`;
    } else if ((m = l.match(/^\s*\d+[.)]\s+(.*)/))) {
      if (list !== "ol") {
        close();
        out += "<ol>";
        list = "ol";
      }
      out += `<li>${inline(m[1])}</li>`;
    } else if (!l.trim() || /^-{3,}$/.test(l.trim())) {
      close();
    } else {
      close();
      out += `<p>${inline(l)}</p>`;
    }
  }
  close();
  return out;
}
